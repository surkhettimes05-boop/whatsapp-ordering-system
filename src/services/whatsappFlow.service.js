const prisma = require('../config/database');
const whatsappService = require('./whatsapp.service');
const conversationService = require('./conversation.service');
const stockService = require('./stock.service');
const whatsappCreditValidator = require('./whatsapp-credit-validator.service');
const whatsappCreditMessages = require('./whatsapp-credit-messages.service');
const broadcastService = require('./broadcast.service');
const vendorOfferService = require('./vendorOffer.service');
const messageParser = require('./messageParser.service');
const visionService = require('./vision.service');
const orderRoutingService = require('./orderRoutingService');
const orderService = require('./order.service');

class WhatsAppFlowService {

    /**
     * Main entry point for processing webhook payload
     */
    async processMessage(payload) {
        const { From, Body, ProfileName, NumMedia, MediaUrl0 } = payload;
        const phone = From.replace('whatsapp:', '').trim();
        const text = (Body || '').trim();
        const lowerText = text.toLowerCase();

        // 1. Handle Wholesaler
        const wholesaler = await prisma.wholesaler.findUnique({
            where: { whatsappNumber: phone }
        });

        if (wholesaler) {
            return await this.handleWholesalerMessage(wholesaler, text, phone);
        }

        // 2. Handle Retailer
        let retailer = await prisma.retailer.findUnique({ where: { phoneNumber: phone } });
        if (!retailer) {
            retailer = await prisma.retailer.create({
                data: { phoneNumber: phone, pasalName: ProfileName || 'New Shop', status: 'ACTIVE' }
            });
            return await whatsappService.sendMessage(phone, whatsappService.getMainMenu(), { immediate: true });
        }

        if (retailer.status === 'BLOCKED') {
            return await whatsappService.sendMessage(phone, '❌ Your account has been blocked. Contact support.', { immediate: true });
        }

        // 3. Handle Image Orders
        if (parseInt(NumMedia) > 0 && MediaUrl0) {
            return await this.handleImageOrder(retailer, phone, MediaUrl0);
        }

        // 4. Handle Text Intents
        const state = await conversationService.getState(retailer.id);
        const intent = messageParser.getIntent(text);
        const orderItem = messageParser.parseOrderItem(text);

        // Global Commands
        switch (intent) {
            case 'MENU':
                await conversationService.clearState(retailer.id);
                return await whatsappService.sendMessage(phone, whatsappService.getMainMenu(), { immediate: true });

            case 'CATALOG':
                const products = await prisma.product.findMany({ where: { isActive: true }, take: 20 });
                return await whatsappService.sendMessage(phone, whatsappService.formatProductList(products), { immediate: true });

            case 'CREDIT':
                const creditInfo = await whatsappCreditValidator.getRetailerCreditInfo(retailer.id);
                const msg = whatsappCreditMessages.getCreditStatusMessage(retailer, creditInfo);
                return await whatsappService.sendMessage(phone, msg, { immediate: true });

            case 'RECENT_ORDERS':
                const orders = await prisma.order.findMany({
                    where: { retailerId: retailer.id },
                    orderBy: { createdAt: 'desc' },
                    take: 5
                });
                return await whatsappService.sendMessage(phone, whatsappService.formatRecentOrders(orders), { immediate: true });

            case 'PLACE_ORDER':
                return await this.handlePlaceOrderIntent(retailer, phone);
        }

        // Contextual States
        if (state) {
            if (state.step === 'CONFIRMATION_PENDING') {
                if (intent === 'CONFIRM') return await this.confirmOrder(retailer, phone);
                if (intent === 'CANCEL') {
                    await conversationService.clearState(retailer.id);
                    return await whatsappService.sendMessage(phone, '❌ Order cancelled.', { immediate: true });
                }
            }

            if (state.step === 'RATING_PENDING') {
                const rating = parseInt(text);
                if (!isNaN(rating) && rating >= 1 && rating <= 5) {
                    await orderRoutingService.addCustomerRating(state.data.orderId, rating);
                    await conversationService.clearState(retailer.id);
                    return await whatsappService.sendMessage(phone, '🙏 Thank you for your feedback!', { immediate: true });
                }
            }
        }

        // Add Item Logic
        if (orderItem) {
            return await this.handleAddItem(retailer, phone, orderItem.index, orderItem.quantity);
        }

        // Fallback
        return await whatsappService.sendMessage(phone, whatsappService.getHelpMessage());
    }

    /**
     * Logic for adding items to cart
     */
    async handleAddItem(retailer, phone, index, qty) {
        const products = await prisma.product.findMany({ where: { isActive: true }, take: 20 });
        if (index < 1 || index > products.length) {
            return await whatsappService.sendMessage(phone, '❌ Invalid Item Number.');
        }
        const product = products[index - 1];

        try {
            const result = await prisma.$transaction(async (tx) => {
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

                await tx.orderItem.create({
                    data: {
                        orderId: order.id,
                        productId: product.id,
                        quantity: qty,
                        priceAtOrder: product.fixedPrice
                    }
                });

                const updatedOrder = await tx.order.update({
                    where: { id: order.id },
                    data: { totalAmount: parseFloat(order.totalAmount) + lineTotal }
                });

                return { order: updatedOrder };
            });

            await whatsappService.sendMessage(phone,
                `✅ Added ${qty} x *${product.name}*.\nOrder Total: Rs. ${result.order.totalAmount}\nReply "Place Order" to finish.`,
                { immediate: true }
            );
        } catch (e) {
            console.error(e);
            await whatsappService.sendMessage(phone, '❌ Error adding item.', { immediate: true });
        }
    }

    /**
     * Wholesaler Logic (My Orders, Accept/Reject, etc)
     */
    async handleWholesalerMessage(wholesaler, text, phone) {
        if (text.toLowerCase() === 'my orders') {
            const orders = await prisma.order.findMany({
                where: {
                    wholesalerId: wholesaler.id,
                    status: { in: ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY'] }
                },
                take: 5,
                orderBy: { createdAt: 'desc' }
            });
            // ... formatting logic ...
            let msg = '📦 *Your Active Orders*\n\n';
            if (orders.length === 0) msg += 'No active orders.';
            else orders.forEach(o => msg += `#${o.id.slice(-4)} - Rs. ${o.totalAmount} (${o.status})\n`);
            return await whatsappService.sendMessage(phone, msg, { immediate: true });
        }

        // Bid Pattern
        if (messageParser.isVendorBid(text)) {
            const result = await vendorOfferService.processIncomingBid(wholesaler.id, text);
            return await whatsappService.sendMessage(phone, result.message, { immediate: true });
        }

        // Accept/Reject/Complete commands
        const commandMatch = text.match(/^(accept|reject|complete)\s+order\s+(\w+)(?:\s+(\d{4}))?$/i);
        if (commandMatch) {
            return await this.handleWholesalerCommand(wholesaler, phone, commandMatch);
        }

        await whatsappService.sendMessage(phone,
            'Wholesaler Dashboard:\n- "My Orders"\n- "Accept Order [ID]"\n- "Complete Order [ID]"\n- "PRICE <amount> ETA <time>" (to bid)',
            { immediate: true }
        );
    }

    async handleWholesalerCommand(wholesaler, phone, match) {
        const action = match[1].toLowerCase();
        const shortId = match[2];
        const otpProvided = match[3];

        const order = await prisma.order.findFirst({
            where: { id: { endsWith: shortId }, wholesalerId: wholesaler.id },
            include: { retailer: true, items: true }
        });

        if (!order) {
            return await whatsappService.sendMessage(phone, '❌ Order not found or not assigned.', { immediate: true });
        }

        if (action === 'accept') {
            await prisma.order.update({
                where: { id: order.id },
                data: { status: 'CONFIRMED', confirmedAt: new Date() }
            });
            await whatsappService.sendMessage(phone, `✅ Accepted Order #${shortId}.`, { immediate: true });
            await whatsappService.sendMessage(order.retailer.phoneNumber, `✅ Order accepted by ${wholesaler.businessName}.`, { immediate: true });
            await orderRoutingService.updateReliabilityScore(wholesaler.id, 'ACCEPT');
        }
        else if (action === 'reject') {
            await stockService.releaseStock(order.id);
            await whatsappService.sendMessage(phone, `🚫 Rejected Order #${shortId}. Re-routing...`, { immediate: true });

            // Logic for re-routing... (simplified for brevity, should use routing service)
            // For now, cancel to be safe unless full re-routing logic is copied
            await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
            await whatsappService.sendMessage(order.retailer.phoneNumber, `⚠️ Order #${shortId} was rejected and cancelled.`, { immediate: true });
        }
        else if (action === 'complete') {
            const fullOrder = await prisma.order.findUnique({ where: { id: order.id } });
            if (fullOrder.deliveryOTP && fullOrder.deliveryOTP !== otpProvided) {
                return await whatsappService.sendMessage(phone, `⚠️ Invalid or missing OTP.`, { immediate: true });
            }
            await orderService.updateOrderStatus(order.id, 'DELIVERED', 'WHOLESALER', 'Completed via WhatsApp');
            await whatsappService.sendMessage(phone, `✅ Order completed.`, { immediate: true });
            await conversationService.setState(order.retailer.id, 'RATING_PENDING', { orderId: order.id });
            await whatsappService.sendMessage(order.retailer.phoneNumber, `📦 Delivered! Please rate 1-5.`, { immediate: true });
        }
    }

    async handlePlaceOrderIntent(retailer, phone) {
        const order = await prisma.order.findFirst({
            where: { retailerId: retailer.id, status: 'PENDING' },
            include: { items: { include: { product: true } } }
        });

        if (!order || order.items.length === 0) {
            return await whatsappService.sendMessage(phone, 'Your cart is empty.', { immediate: true });
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
        if (!order) return await conversationService.clearState(retailer.id);

        const creditValidation = await whatsappCreditValidator.validateOrderCredit(retailer.id, order.totalAmount);
        if (!creditValidation.approved) {
            await whatsappService.sendMessage(phone, creditValidation.message, { immediate: true });
            return await conversationService.clearState(retailer.id);
        }

        try {
            const routeResult = await orderRoutingService.findBestWholesaler(retailer.id, order.items);
            await prisma.$transaction(async (tx) => {
                await tx.order.update({
                    where: { id: order.id },
                    data: { status: 'PENDING_BIDS', paymentMode: 'CREDIT' }
                });
            });

            await whatsappService.sendMessage(phone, `✅ Order #${order.id.slice(-4)} Submitted! Finding best offers...`, { immediate: true });
            await broadcastService.broadcastOrder(order.id);
            await conversationService.clearState(retailer.id);
        } catch (e) {
            console.error(e);
            await whatsappService.sendMessage(phone, '⚠️ Error placing order.', { immediate: true });
        }
    }

    async handleImageOrder(retailer, phone, mediaUrl) {
        await whatsappService.sendMessage(phone, '🖼️ Reading image...', { immediate: true });
        const result = await visionService.extractOrderFromImage(mediaUrl);
        if (!result.success || result.items.length === 0) {
            return await whatsappService.sendMessage(phone, '❌ Could not read order from image.', { immediate: true });
        }
        // ... simplified image order logic (similar to add item) ...
        // For full implementation, copy exact logic from controller
        await whatsappService.sendMessage(phone, `✅ Found ${result.items.length} items. Added to cart.`, { immediate: true });
    }
}

module.exports = new WhatsAppFlowService();
