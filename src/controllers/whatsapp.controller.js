const whatsappService = require('../services/whatsapp.service');
const prisma = require('../config/database');
const conversationService = require('../services/conversation.service');
const stockService = require('../services/stock.service');
const whatsappCreditValidator = require('../services/whatsapp-credit-validator.service');
const whatsappCreditMessages = require('../services/whatsapp-credit-messages.service');
const biddingService = require('../services/bidding.service');
const broadcastService = require('../services/broadcast.service');
const vendorOfferService = require('../services/vendorOffer.service');
const messageParser = require('../services/messageParser.service');
const visionService = require('../services/vision.service');
const fs = require('fs');
const dedupService = require('../services/message-dedup.service');
const { checkDuplicate, markSuccess, markFailed, markSkipped } = require('../middleware/message-dedup.middleware');

class WhatsAppController {

  async handleIncomingMessage(req, res) {
    try {
      // Twilio webhook format
      const { From, Body, ProfileName, MessageSid, To } = req.body;

      const logger = require('../utils/logger');
      const correlationId = req.correlationId || `webhook-${Date.now()}`;

      // Check if this is a duplicate message
      if (checkDuplicate(req)) {
        logger.warn('Duplicate message skipped', {
          messageSid: MessageSid,
          from: From,
          correlationId
        });
        await markSkipped(req, 'Duplicate message - already processed');
        return; // Don't process duplicate
      }

      // Log incoming message
      logger.info('Incoming WhatsApp message', {
        from: From,
        to: To,
        messageSid: MessageSid,
        bodyLength: Body?.length || 0,
        isDuplicate: false,
        correlationId
      });

      // Always return 200 OK to Twilio immediately
      // Process message asynchronously
      res.status(200).send('OK');

      const phone = From.replace('whatsapp:', '').trim();
      const text = (Body || '').trim();
      const lowerText = text.toLowerCase();
      const numMedia = parseInt(req.body.NumMedia || '0');
      const mediaUrl = req.body.MediaUrl0;

      // Validate required fields (if no media, we need body)
      if (numMedia === 0 && !Body) {
        logger.warn('Invalid webhook payload - no media and no body', { from: From });
        await markFailed(req, null, 'Invalid payload - no media and no body');
        return;
      }

      // Log message to database (async, don't block)
      prisma.whatsAppMessage.create({
        data: {
          from: phone,
          to: 'SYSTEM',
          body: text.substring(0, 1000), // Limit body length
          mediaUrl: mediaUrl,
          direction: 'INCOMING'
        }
      }).catch(err => {
        logger.warn('Failed to log message to database', { error: err.message });
      });

      // ===============================================
      // 0. CHECK IF SENDER IS A WHOLESALER
      // ===============================================
      const wholesaler = await prisma.wholesaler.findUnique({
        where: { whatsappNumber: phone }
      });

      if (wholesaler) {
        await this.handleWholesalerMessage(wholesaler, lowerText, phone);
        return; // Response already sent in route handler
      }

      // ===============================================
      // 1. RETAILER FLOW
      // ===============================================
      // Find or Create Retailer
      let retailer = await prisma.retailer.findUnique({ where: { phoneNumber: phone } });
      if (!retailer) {
        retailer = await prisma.retailer.create({
          data: { phoneNumber: phone, pasalName: ProfileName || 'New Shop', status: 'ACTIVE' }
        });
        await whatsappService.sendMessage(phone, whatsappService.getMainMenu(), { immediate: true });
        return;
      }

      if (retailer.status === 'BLOCKED') {
        await whatsappService.sendMessage(phone,
          '❌ Your account has been blocked. Please contact support.',
          { immediate: true }
        );
        return; // Response already sent in route handler
      }

      // ===============================================
      // IMAGE ORDER PROCESSING (Moved after Retailer Check)
      // ===============================================
      if (numMedia > 0 && mediaUrl) {
        return await this.handleImageOrder(retailer, phone, mediaUrl);
      }

      const state = await conversationService.getState(retailer.id);

      // 2. Global Commands
      if (['hi', 'hello', 'start', 'menu'].includes(lowerText)) {
        await conversationService.clearState(retailer.id);
        await whatsappService.sendMessage(phone, whatsappService.getMainMenu(), { immediate: true });
        return;
      }

      if (['place order', 'checkout'].includes(lowerText)) {
        return await this.handlePlaceOrderIntent(retailer, phone);
      }

      if (lowerText === 'view catalog' || lowerText === '1') {
        const products = await prisma.product.findMany({ where: { isActive: true }, take: 20 });
        await whatsappService.sendMessage(phone, whatsappService.formatProductList(products), { immediate: true });
        return;
      }

      if (lowerText === 'check credit' || lowerText === '2') {
        const creditInfo = await whatsappCreditValidator.getRetailerCreditInfo(retailer.id);
        const message = whatsappCreditMessages.getCreditStatusMessage(retailer, creditInfo);
        await whatsappService.sendMessage(phone, message, { immediate: true });
        return;
      }

      if (lowerText === 'recent orders' || lowerText === '3') {
        const orders = await prisma.order.findMany({
          where: { retailerId: retailer.id },
          orderBy: { createdAt: 'desc' },
          take: 5
        });
        await whatsappService.sendMessage(phone, whatsappService.formatRecentOrders(orders), { immediate: true });
        return;
      }

      // 3. State Handling
      if (state && state.step === 'CONFIRMATION_PENDING') {
        if (['yes', 'confirm', 'ok'].includes(lowerText)) {
          return await this.confirmOrder(retailer, phone);
        } else if (['no', 'cancel'].includes(lowerText)) {
          await conversationService.clearState(retailer.id);
          await whatsappService.sendMessage(phone, '❌ Order cancelled.', { immediate: true });
          return; // Response already sent in route handler
        }
      }

      // 4. Rating Handling
      if (state && state.step === 'RATING_PENDING') {
        const rating = parseInt(lowerText);
        if (!isNaN(rating) && rating >= 1 && rating <= 5) {
          const orderRoutingService = require('../services/orderRoutingService');
          await orderRoutingService.addCustomerRating(state.data.orderId, rating);
          await conversationService.clearState(retailer.id);
          await whatsappService.sendMessage(phone,
            '🙏 Thank you for your feedback! It helps us improve your experience.',
            { immediate: true }
          );
          return;
        }
      }

      // 5. Order Item Parsing (Regex: "1 x 10")
      const orderMatch = text.match(/^(\d+)\s*[xX*]\s*(\d+)$/);
      if (orderMatch) {
        const index = parseInt(orderMatch[1]);
        const qty = parseInt(orderMatch[2]);
        return await this.handleAddItem(retailer, phone, index, qty);
      }

      // Fallback
      await whatsappService.sendMessage(phone, whatsappService.getHelpMessage());
      res.status(200).send('OK');

    } catch (error) {
      console.error('Webhook Error:', error);
      res.status(200).send('OK');
    }
  }

  // ===============================================
  // WHOLESALER HANDLERS
  // ===============================================
  async handleWholesalerMessage(wholesaler, text, phone) {
    if (text === 'my orders') {
      const orders = await prisma.order.findMany({
        where: {
          wholesalerId: wholesaler.id,
          status: { in: ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY'] }
        },
        take: 5,
        orderBy: { createdAt: 'desc' }
      });
      let msg = '📦 *Your Active Orders*\n\n';
      if (orders.length === 0) {
        msg += 'No active orders at the moment.';
      } else {
        orders.forEach(o => {
          msg += `#${o.id.slice(-4)}\n`;
          msg += `Amount: Rs. ${o.totalAmount}\n`;
          msg += `Status: ${o.status}\n\n`;
        });
      }
      await whatsappService.sendMessage(phone, msg, { immediate: true });
      return; // Response already sent in route handler
    }

    const commandMatch = text.match(/^(accept|reject|complete)\s+order\s+(\w+)(?:\s+(\d{4}))?$/);
    if (commandMatch) {
      const action = commandMatch[1];
      const shortId = commandMatch[2];
      const otpProvided = commandMatch[3];

      const order = await prisma.order.findFirst({
        where: {
          id: { endsWith: shortId },
          wholesalerId: wholesaler.id
        },
        include: { retailer: true, items: true }
      });

      if (!order) {
        await whatsappService.sendMessage(phone,
          '❌ Order not found or not assigned to you.',
          { immediate: true }
        );
        return; // Response already sent in route handler
      }

      const orderRoutingService = require('../services/orderRoutingService');

      if (action === 'accept') {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'CONFIRMED', confirmedAt: new Date() }
        });
        await whatsappService.sendMessage(phone,
          `✅ You accepted Order #${order.id.slice(-4)}.`,
          { immediate: true }
        );
        await whatsappService.sendMessage(order.retailer.phoneNumber,
          `✅ Your order is accepted by ${wholesaler.businessName} and is being processed.`,
          { immediate: true }
        );

        await orderRoutingService.updateReliabilityScore(wholesaler.id, 'ACCEPT');
      }
      else if (action === 'reject') {
        try {
          // 1. Release previous stock reservation
          await stockService.releaseStock(order.id);

          await whatsappService.sendMessage(phone,
            `🚫 You rejected Order #${order.id.slice(-4)}. System is re-routing...`,
            { immediate: true }
          );

          const routeResult = await orderRoutingService.findBestWholesaler(order.retailerId, order.items, [wholesaler.id]);
          const newWholesaler = routeResult.selectedWholesaler;

          // 2. Reserve stock for new wholesaler
          await stockService.reserveStock(order.id, newWholesaler.id, order.items);

          await prisma.order.update({
            where: { id: order.id },
            data: {
              wholesalerId: newWholesaler.id,
              status: 'PLACED',
              confirmedAt: null
            }
          });

          await orderRoutingService.recordRoutingDecision(order.id, order.retailerId, routeResult, order.items);

          const newMsg = `📢 *REROUTED ORDER ALERT*\n\nOrder #${order.id.slice(-4)}\nAmount: Rs. ${order.totalAmount}\nItems: ${order.items.length}\nLocation: ${order.retailer.city || 'Unknown'}\n\nReply "Accept Order ${order.id.slice(-4)}" to claim.`;
          await whatsappService.sendMessage(newWholesaler.whatsappNumber, newMsg, { immediate: true });

          await whatsappService.sendMessage(order.retailer.phoneNumber,
            `ℹ️ Update: Your order has been reassigned to *${newWholesaler.businessName}* for faster fulfillment.`,
            { immediate: true }
          );

        } catch (error) {
          const logger = require('../utils/logger');
          logger.error('Re-routing failed', {
            error: error.message,
            orderId: order.id,
            wholesalerId: wholesaler.id
          });
          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'CANCELLED' }
          });
          await whatsappService.sendMessage(phone,
            `⚠️ Re-routing failed. Order cancelled.`,
            { immediate: true }
          );
          await whatsappService.sendMessage(order.retailer.phoneNumber,
            `⚠️ We could not find another available wholesaler. Your order #${order.id.slice(-4)} has been cancelled.`,
            { immediate: true }
          );
        }

        await orderRoutingService.updateReliabilityScore(wholesaler.id, 'REJECT');
      }
      else if (action === 'complete') {
        const orderRoutingService = require('../services/orderRoutingService');
        const orderService = require('../services/order.service');

        // Check if OTP is required and matches
        const fullOrder = await prisma.order.findUnique({ where: { id: order.id } });
        if (fullOrder.deliveryOTP && fullOrder.deliveryOTP !== otpProvided) {
          if (!otpProvided) {
            await whatsappService.sendMessage(phone,
              `⚠️ OTP required to complete Order #${order.id.slice(-4)}.\n\nPlease ask the retailer for the 4-digit code and reply:\n"Complete order ${shortId} [OTP]"`,
              { immediate: true }
            );
          } else {
            await whatsappService.sendMessage(phone,
              `❌ Invalid OTP for Order #${order.id.slice(-4)}. Please try again.`,
              { immediate: true }
            );
          }
          return;
        }

        try {
          // Use OrderService.updateOrderStatus to handle stock deduction and status transition
          await orderService.updateOrderStatus(order.id, 'DELIVERED', 'WHOLESALER', `Completed by WhatsApp (OTP Verified: ${!!fullOrder.deliveryOTP})`);

          await whatsappService.sendMessage(phone,
            `✅ Order #${order.id.slice(-4)} marked as completed.`,
            { immediate: true }
          );

          await whatsappService.sendMessage(order.retailer.phoneNumber,
            `📦 Order Delivered! Please rate your experience from 1 to 5 (Send: 5 for Excellent, 1 for Poor).`,
            { immediate: true }
          );

          await conversationService.setState(order.retailer.id, 'RATING_PENDING', { orderId: order.id });
          await orderRoutingService.updateReliabilityScore(wholesaler.id, 'COMPLETE');
        } catch (error) {
          await whatsappService.sendMessage(phone,
            `❌ Failed to complete order: ${error.message}`,
            { immediate: true }
          );
        }
      }
      return; // Response already sent in route handler
    }

    // Bid Pattern: PRICE <amount> ETA <time>
    // Use the new message parser to check if this is a bid
    if (messageParser.isVendorBid(text)) {
      const result = await vendorOfferService.processIncomingBid(wholesaler.id, text);
      await whatsappService.sendMessage(phone, result.message, { immediate: true });
      return;
    }

    await whatsappService.sendMessage(phone,
      'Wholesaler Dashboard:\n- "My Orders"\n- "Accept Order [ID]"\n- "Complete Order [ID]"\n- "PRICE <amount> ETA <time>" (to bid)',
      { immediate: true }
    );
    return;
  }

  async handleAddItem(retailer, phone, index, qty) {
    const products = await prisma.product.findMany({ where: { isActive: true }, take: 20 });
    if (index < 1 || index > products.length) {
      await whatsappService.sendMessage(phone, '❌ Invalid Item Number.');
      return;
    }
    const product = products[index - 1];

    try {
      // ============================================
      // ATOMIC TRANSACTION: ADD ITEM TO ORDER
      // ============================================
      // Operations that must be atomic:
      // 1. Find or create order
      // 2. Create order item
      // 3. Update order total
      //
      // ROLLBACK SCENARIO:
      // If any of these operations fail (e.g., database constraint violation):
      // - Order not created or found
      // - Order item not created
      // - Order total not updated
      // Result: No partial state, retailer can safely retry
      // ============================================

      const result = await prisma.$transaction(async (tx) => {
        // Find or create order in same transaction
        let order = await tx.order.findFirst({
          where: { retailerId: retailer.id, status: 'PENDING' }
        });

        if (!order) {
          order = await tx.order.create({
            data: {
              retailerId: retailer.id,
              status: 'PENDING',
              totalAmount: 0,
              paymentMode: 'COD'
            }
          });
        }

        const lineTotal = parseFloat(product.fixedPrice) * qty;

        // Create order item in same transaction
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            quantity: qty,
            priceAtOrder: product.fixedPrice
          }
        });

        // Update order total in same transaction
        const currentTotal = parseFloat(order.totalAmount);
        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: { totalAmount: currentTotal + lineTotal }
        });

        return { order: updatedOrder, lineTotal };
      });

      await whatsappService.sendMessage(phone,
        `✅ Added ${qty} x *${product.name}*.\nOrder Total: Rs. ${result.order.totalAmount}\nReply "Place Order" to finish.`,
        { immediate: true }
      );
    } catch (error) {
      // ============================================
      // TRANSACTION FAILED - Automatic rollback
      // ============================================
      // Prisma automatically rolled back:
      // ✓ Order creation (if new) reverted
      // ✓ Order item creation reverted
      // ✓ Order total update reverted
      // Result: No partial state, retailer can retry immediately
      // ============================================
      const logger = require('../utils/logger');
      logger.error('Error adding item to order', {
        error: error.message,
        retailerId: retailer.id
      });
      await whatsappService.sendMessage(phone,
        '❌ Error adding item. Please try again.',
        { immediate: true }
      );
    }
  }

  /**
   * Handle image-based orders using VisionService
   */
  async handleImageOrder(retailer, phone, mediaUrl) {
    const logger = require('../utils/logger');
    try {
      await whatsappService.sendMessage(phone, '🖼️ *Image Received!* Reading your order list... Please wait a moment. 🕒', { immediate: true });

      const result = await visionService.extractOrderFromImage(mediaUrl);

      if (!result.success) {
        await whatsappService.sendMessage(phone, `❌ Sorry, I couldn't read the image: ${result.error}. Please try sending a clear photo or type the order.`, { immediate: true });
        return;
      }

      if (result.items.length === 0) {
        await whatsappService.sendMessage(phone, '❓ I couldn\'t find any matching products from our catalog in that list. Please check the spelling or send a clearer photo.', { immediate: true });
        return;
      }

      // Atomically add all extracted items to a pending order
      const prisma = require('../config/database');
      const order = await prisma.$transaction(async (tx) => {
        let activeOrder = await tx.order.findFirst({
          where: { retailerId: retailer.id, status: 'PENDING' }
        });

        if (!activeOrder) {
          activeOrder = await tx.order.create({
            data: {
              retailerId: retailer.id,
              status: 'PENDING',
              totalAmount: 0,
              paymentMode: 'COD'
            }
          });
        }

        let extraTotal = 0;
        for (const item of result.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product) {
            await tx.orderItem.create({
              data: {
                orderId: activeOrder.id,
                productId: product.id,
                quantity: item.quantity,
                priceAtOrder: product.fixedPrice
              }
            });
            extraTotal += parseFloat(product.fixedPrice) * item.quantity;
          }
        }

        // Link the image to the order
        await tx.orderImage.create({
          data: {
            orderId: activeOrder.id,
            imageUrl: mediaUrl
          }
        });

        return await tx.order.update({
          where: { id: activeOrder.id },
          data: { totalAmount: { increment: extraTotal } },
          include: { items: { include: { product: true } } }
        });
      });

      let summary = `✅ *Items identified and added to cart:*\n\n`;
      result.items.forEach(item => {
        summary += `• ${item.name} x ${item.quantity}\n`;
      });
      summary += `\n*Order Total: Rs. ${order.totalAmount}*\n\nReply "Place Order" to confirm or send another photo to add more items.`;

      await whatsappService.sendMessage(phone, summary, { immediate: true });

    } catch (error) {
      logger.error('handleImageOrder error', { error: error.message, retailerId: retailer.id });
      await whatsappService.sendMessage(phone, '❌ An error occurred while processing your image. Please try again later.', { immediate: true });
    }
  }

  async handlePlaceOrderIntent(retailer, phone) {
    const order = await prisma.order.findFirst({
      where: { retailerId: retailer.id, status: 'PENDING' },
      include: { items: { include: { product: true } } }
    });

    if (!order || order.items.length === 0) {
      await whatsappService.sendMessage(phone, 'Your cart is empty.', { immediate: true });
      return;
    }

    await conversationService.setState(retailer.id, 'CONFIRMATION_PENDING', { orderId: order.id });
    await whatsappService.sendMessage(phone,
      whatsappService.formatOrderSummary(order, order.items) + '\n\nReply "Yes" to confirm.',
      { immediate: true }
    );
  }

  async confirmOrder(retailer, phone) {
    const order = await prisma.order.findFirst({
      where: { retailerId: retailer.id, status: 'PENDING' },
      include: { items: true }
    });

    if (!order) {
      await conversationService.clearState(retailer.id);
      return;
    }

    const orderRoutingService = require('../services/orderRoutingService');

    try {
      // ============================================
      // STEP 1: CREDIT CHECK (READ-ONLY)
      // ============================================
      // This is a read-only operation and doesn't need to be in the transaction
      // If this fails, we exit early before any writes
      await whatsappService.sendMessage(phone, '💳 Checking your credit...');

      const creditValidation = await whatsappCreditValidator.validateOrderCredit(
        retailer.id,
        order.totalAmount
      );

      // Log credit check event (read-only info)
      await whatsappCreditValidator.logCreditCheck(
        retailer.id,
        order.totalAmount,
        creditValidation.approved,
        creditValidation.reason
      );

      if (!creditValidation.approved) {
        // ❌ CREDIT REJECTED - Exit early without any writes
        const logger = require('../utils/logger');
        logger.warn('Credit check failed', {
          retailerId: retailer.id,
          reason: creditValidation.reason,
          amount: order.totalAmount
        });

        await whatsappService.sendMessage(phone, creditValidation.message, { immediate: true });
        await conversationService.clearState(retailer.id);

        // Keep order in PENDING state so retailer can try again
        return;
      }

      // ✅ Credit approved - log the approval
      const logger = require('../utils/logger');
      logger.info(`Credit approved for order`, {
        retailerId: retailer.id,
        orderId: order.id,
        amount: order.totalAmount
      });

      // ============================================
      // ATOMIC TRANSACTION: STEPS 2-5
      // ============================================
      // All these operations must succeed together or all must rollback:
      // 1. Place temporary hold on credit
      // 2. Find wholesaler & reserve stock (uses its own transaction)
      // 3. Finalize credit deduction (creates ledger entry)
      // 4. Update order status
      // 5. Record routing decision
      // 
      // ROLLBACK SCENARIO:
      // - If ANY operation fails after step 2, Prisma will rollback:
      //   * Temporary hold reverted
      //   * Stock reservation reverted (handled by stockService transaction)
      //   * Ledger entry reverted
      //   * Order status remains PENDING
      // Result: Clean state, retailer can retry
      // ============================================

      await whatsappService.sendMessage(phone, '🔄 Preparing order for broadcast...', { immediate: true });

      const routeResult = await orderRoutingService.findBestWholesaler(retailer.id, order.items);

      await prisma.$transaction(async (tx) => {
        // Record routing decision with all candidates
        await tx.orderRouting.create({
          data: {
            orderId: order.id,
            retailerId: retailer.id,
            productRequested: JSON.stringify(order.items),
            candidateWholesalers: JSON.stringify(routeResult.allCandidates.map(c => c.id)),
            selectedWholesalerId: null, // No one selected yet
            routingReason: 'Transitioned to multi-vendor bidding broadcast.',
            routingScore: 0,
            status: 'PENDING',
            attempt: 1
          }
        });

        // Update order status to indicate it's waiting for bids
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'PENDING_BIDS',
            paymentMode: 'CREDIT'
          }
        });
      });

      const successMsg = `✅ *Order Draft Submitted!*

Order #${order.id.slice(-4)}
Amount: Rs. ${order.totalAmount}

We are currently collecting bids from available wholesalers to get you the best price and delivery time. You will be notified in 15 minutes or less with the best offer. 🕒`;

      await whatsappService.sendMessage(phone, successMsg, { immediate: true });

      // Start the broadcast process using the new broadcast service
      await broadcastService.broadcastOrder(order.id);

    } catch (error) {
      // ============================================
      // TRANSACTION FAILED - Automatic rollback
      // ============================================
      // Prisma automatically rolled back:
      // ✓ Credit hold reverted (creditLedgerEntry deleted)
      // ✓ Stock reservation reverted (via stockService.reserveStock rollback)
      // ✓ Ledger entries reverted (all creditLedgerEntry deletes)
      // ✓ Order status remains PENDING (update was rolled back)
      // ✓ Routing decision not recorded (if it was in the transaction)
      //
      // Result: Clean state as if order confirmation never started
      // Retailer can immediately retry without any cleanup needed
      // ============================================
      const logger = require('../utils/logger');
      logger.error('Order confirmation error', {
        error: error.message,
        stack: error.stack,
        retailerId: retailer.id,
        orderId: order.id
      });
      await whatsappService.sendMessage(phone,
        '⚠️ Error placing order. Please try again or contact support.',
        { immediate: true }
      );
    }

    await conversationService.clearState(retailer.id);
  }
}

module.exports = new WhatsAppController();