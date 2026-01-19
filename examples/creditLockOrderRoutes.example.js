/**
 * CREDIT LOCK MECHANISM - PRACTICAL IMPLEMENTATION EXAMPLE
 * 
 * This file shows real-world usage in an Express order handler.
 * Copy and adapt these patterns to your actual order routes.
 */

const express = require('express');
const logger = require('../config/logger');
const creditLockMechanism = require('../services/creditLockMechanism.service');
const { withTransaction } = require('../utils/transaction');
const prisma = require('../config/database');

const router = express.Router();

// ============================================================================
// EXAMPLE 1: Simple Order Creation with Credit Lock
// ============================================================================

router.post('/orders/simple', async (req, res) => {
  try {
    const { retailerId, wholesalerId, items } = req.body;
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate order total
    const orderAmount = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    logger.info('Processing order', {
      orderId,
      retailerId,
      wholesalerId,
      amount: orderAmount,
    });

    // CRITICAL: Acquire credit lock BEFORE creating order
    const creditLock = await creditLockMechanism.acquireAndValidateCredit(
      orderId,
      retailerId,
      wholesalerId,
      orderAmount
    );

    if (!creditLock.success) {
      logger.warn('Order rejected - insufficient credit', {
        orderId,
        errorCode: creditLock.errorCode,
        message: creditLock.message,
      });

      return res.status(400).json({
        success: false,
        error: creditLock.errorCode,
        message: creditLock.message,
        details: creditLock.details,
      });
    }

    // Create the order
    const order = await prisma.order.create({
      data: {
        orderId,
        retailerId,
        wholesalerId,
        items: { create: items },
        totalAmount: orderAmount,
        creditLedgerEntryId: creditLock.ledgerEntryId,
        status: 'CONFIRMED',
        createdAt: new Date(),
      },
      include: { items: true },
    });

    logger.info('Order created successfully', {
      orderId,
      amount: orderAmount,
      newBalance: creditLock.newBalance,
    });

    return res.json({
      success: true,
      message: 'Order confirmed successfully',
      order: {
        orderId: order.orderId,
        amount: orderAmount,
        items: order.items.length,
        newBalance: creditLock.newBalance,
        availableCredit: creditLock.availableCredit,
      },
    });
  } catch (error) {
    logger.error('Order creation failed', { error, body: req.body });
    return res.status(500).json({
      success: false,
      error: 'SYSTEM_ERROR',
      message: 'Failed to create order. Please try again.',
    });
  }
});

// ============================================================================
// EXAMPLE 2: Order Creation with Custom Error Handling
// ============================================================================

router.post('/orders/advanced', async (req, res) => {
  try {
    const { retailerId, wholesalerId, items } = req.body;
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const orderAmount = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    // Try to acquire credit lock with custom timeout for slow connections
    const creditLock = await creditLockMechanism.acquireAndValidateCredit(
      orderId,
      retailerId,
      wholesalerId,
      orderAmount,
      {
        maxRetries: 3,
        timeout: 2000, // 2 seconds instead of default 1 second
      }
    );

    // Custom error handling based on error code
    if (!creditLock.success) {
      switch (creditLock.errorCode) {
        case 'INSUFFICIENT_CREDIT':
          // User-friendly message about credit limit
          const availableCredit = creditLock.details.availableCredit || 0;
          return res.status(400).json({
            success: false,
            error: 'INSUFFICIENT_CREDIT',
            message: `Your order of Rs ${orderAmount} exceeds available credit.`,
            details: {
              available: availableCredit,
              orderAmount: orderAmount,
              creditLimit: creditLock.details.creditLimit,
              suggestion: availableCredit > 0
                ? `You can place an order up to Rs ${availableCredit}`
                : 'Your credit is fully used. Please make a payment.',
            },
          });

        case 'CREDIT_BLOCKED':
          // Account is suspended
          return res.status(403).json({
            success: false,
            error: 'CREDIT_BLOCKED',
            message: 'Your credit account has been suspended.',
            details: {
              reason: creditLock.details.blockedReason,
              contact: 'Please contact our support team to resolve this.',
            },
          });

        case 'MAX_RETRIES_EXCEEDED':
          // System is overloaded
          return res.status(503).json({
            success: false,
            error: 'SYSTEM_BUSY',
            message: 'System is currently busy. Please try again in a moment.',
          });

        case 'CREDIT_ACCOUNT_NOT_FOUND':
          // No credit setup
          return res.status(400).json({
            success: false,
            error: 'NO_CREDIT',
            message: 'No credit account found. Please set up credit before ordering.',
          });

        default:
          return res.status(400).json({
            success: false,
            error: creditLock.errorCode,
            message: creditLock.message,
          });
      }
    }

    // Credit validation passed - create order
    const order = await prisma.order.create({
      data: {
        orderId,
        retailerId,
        wholesalerId,
        items: { create: items },
        totalAmount: orderAmount,
        creditLedgerEntryId: creditLock.ledgerEntryId,
        status: 'CONFIRMED',
      },
      include: { items: true },
    });

    return res.json({
      success: true,
      message: 'Order placed successfully!',
      order: {
        orderId,
        amount: orderAmount,
        newBalance: creditLock.newBalance,
        availableCredit: creditLock.availableCredit,
      },
    });
  } catch (error) {
    logger.error('Order creation failed', { error });
    return res.status(500).json({
      success: false,
      error: 'SYSTEM_ERROR',
      message: 'An unexpected error occurred. Our team has been notified.',
    });
  }
});

// ============================================================================
// EXAMPLE 3: Batch Order Creation (Limited - Use with Caution!)
// ============================================================================

/**
 * IMPORTANT: This should be used carefully. Batching multiple orders
 * from the same retailer will serialize them due to locking, so there's
 * minimal performance gain. Only use if you need to process multiple
 * order sources (e.g., web + WhatsApp + API simultaneously).
 */

router.post('/orders/batch', async (req, res) => {
  try {
    const { retailerId, wholesalerId, orders: orderBatch } = req.body;

    if (!Array.isArray(orderBatch) || orderBatch.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        message: 'orders must be a non-empty array',
      });
    }

    const results = [];

    // Process each order sequentially (due to credit lock)
    for (const orderData of orderBatch) {
      try {
        const orderId = orderData.orderId || `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const orderAmount = orderData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

        const creditLock = await creditLockMechanism.acquireAndValidateCredit(
          orderId,
          retailerId,
          wholesalerId,
          orderAmount
        );

        if (!creditLock.success) {
          results.push({
            orderId,
            success: false,
            error: creditLock.errorCode,
            message: creditLock.message,
          });
          continue;
        }

        const order = await prisma.order.create({
          data: {
            orderId,
            retailerId,
            wholesalerId,
            items: { create: orderData.items },
            totalAmount: orderAmount,
            creditLedgerEntryId: creditLock.ledgerEntryId,
            status: 'CONFIRMED',
          },
        });

        results.push({
          orderId,
          success: true,
          amount: orderAmount,
          newBalance: creditLock.newBalance,
        });
      } catch (error) {
        logger.error('Batch order processing error', { error, orderData });
        results.push({
          orderId: orderData.orderId,
          success: false,
          error: 'PROCESSING_ERROR',
          message: error.message,
        });
      }
    }

    return res.json({
      success: true,
      processed: results.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error) {
    logger.error('Batch order creation failed', { error });
    return res.status(500).json({
      success: false,
      error: 'SYSTEM_ERROR',
      message: 'Batch processing failed',
    });
  }
});

// ============================================================================
// EXAMPLE 4: Cancel Order (Release Credit Lock)
// ============================================================================

router.post('/orders/:orderId/cancel', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason = 'Requested by customer' } = req.body;

    // Get the order with credit entry
    const order = await prisma.order.findUnique({
      where: { orderId },
      include: { retailer: { select: { id: true } } },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: `Order ${orderId} not found`,
      });
    }

    if (!order.creditLedgerEntryId) {
      // No credit was locked (shouldn't happen, but handle it)
      return res.status(400).json({
        success: false,
        error: 'NO_CREDIT_TO_RELEASE',
        message: 'This order has no credit lock to release',
      });
    }

    // Release the credit lock
    const releaseResult = await creditLockMechanism.releaseCreditLock(
      order.creditLedgerEntryId,
      reason
    );

    if (!releaseResult.success) {
      logger.error('Failed to release credit lock', {
        orderId,
        ledgerEntryId: order.creditLedgerEntryId,
      });

      return res.status(500).json({
        success: false,
        error: 'RELEASE_FAILED',
        message: 'Failed to release credit. Please try again.',
      });
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { orderId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });

    logger.info('Order cancelled successfully', {
      orderId,
      creditReleased: order.totalAmount,
      reason,
    });

    return res.json({
      success: true,
      message: 'Order cancelled successfully. Credit has been released.',
      order: {
        orderId: updatedOrder.orderId,
        amount: updatedOrder.totalAmount,
        status: updatedOrder.status,
        creditReleased: order.totalAmount,
      },
    });
  } catch (error) {
    logger.error('Order cancellation failed', { error });
    return res.status(500).json({
      success: false,
      error: 'SYSTEM_ERROR',
      message: 'Failed to cancel order',
    });
  }
});

// ============================================================================
// EXAMPLE 5: Check Available Credit (No Lock)
// ============================================================================

router.get('/credit/:retailerId/:wholesalerId', async (req, res) => {
  try {
    const { retailerId, wholesalerId } = req.params;

    // Get credit account
    const creditAccount = await prisma.retailerWholesalerCredit.findUnique({
      where: {
        retailerId_wholesalerId: {
          retailerId,
          wholesalerId,
        },
      },
    });

    if (!creditAccount) {
      return res.status(404).json({
        success: false,
        error: 'CREDIT_NOT_FOUND',
        message: 'No credit account found',
      });
    }

    if (!creditAccount.isActive) {
      return res.status(403).json({
        success: false,
        error: 'CREDIT_BLOCKED',
        message: 'Credit account is inactive',
        details: {
          reason: creditAccount.blockedReason,
        },
      });
    }

    // Calculate current balance from ledger
    // NOTE: This is a read-only query without lock, so it may show stale data
    // if used during concurrent order processing. Only use for display.
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { retailerId, wholesalerId },
      select: { entryType: true, amount: true },
    });

    let balance = 0;
    for (const entry of ledgerEntries) {
      const amount = Number(entry.amount);
      if (entry.entryType === 'DEBIT' || entry.entryType === 'ADJUSTMENT') {
        balance += amount;
      } else if (entry.entryType === 'CREDIT' || entry.entryType === 'REVERSAL') {
        balance -= amount;
      }
    }

    const availableCredit = creditAccount.creditLimit - balance;

    return res.json({
      success: true,
      credit: {
        creditLimit: creditAccount.creditLimit,
        usedCredit: balance,
        availableCredit: Math.max(0, availableCredit),
        isActive: creditAccount.isActive,
        paymentTerms: `Net ${creditAccount.creditTerms} days`,
      },
    });
  } catch (error) {
    logger.error('Credit check failed', { error });
    return res.status(500).json({
      success: false,
      error: 'SYSTEM_ERROR',
      message: 'Failed to check credit',
    });
  }
});

// ============================================================================
// EXAMPLE 6: WhatsApp Message Handler Integration
// ============================================================================

/**
 * This is how you'd integrate credit-lock with your existing WhatsApp handler
 * (the webhook that receives incoming messages from Twilio)
 */

router.post('/webhook/whatsapp', async (req, res) => {
  try {
    const incomingMessage = req.body.Body;
    const phoneNumber = req.body.From;

    // Find or create retailer
    const retailer = await prisma.retailer.findFirst({
      where: { phoneNumber },
    });

    if (!retailer) {
      return res.status(400).json({ success: false, error: 'RETAILER_NOT_FOUND' });
    }

    // Parse order from message (e.g., "order rice 10kg dal 5kg")
    // This is simplified - your parsing logic may be different
    const parsedOrder = parseOrderFromMessage(incomingMessage);

    if (!parsedOrder) {
      // Not a valid order format
      return res.status(400).json({ success: false, error: 'INVALID_FORMAT' });
    }

    // Get the retailer's credit with wholesaler
    const creditAccount = await prisma.retailerWholesalerCredit.findFirst({
      where: { retailerId: retailer.id, isActive: true },
    });

    if (!creditAccount) {
      await sendWhatsAppReply(phoneNumber, '❌ No credit account available');
      return res.json({ success: false });
    }

    // Calculate order amount from parsed items
    const orderAmount = parsedOrder.items.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );

    const orderId = `wa_${Date.now()}_${retailer.id}`;

    // HERE'S THE CRITICAL INTEGRATION POINT
    const creditLock = await creditLockMechanism.acquireAndValidateCredit(
      orderId,
      retailer.id,
      creditAccount.wholesalerId,
      orderAmount
    );

    if (!creditLock.success) {
      // Credit validation failed - send appropriate message
      if (creditLock.errorCode === 'INSUFFICIENT_CREDIT') {
        await sendWhatsAppReply(
          phoneNumber,
          `❌ Order exceeds credit limit.\n\nAvailable: Rs ${creditLock.details.availableCredit}`
        );
      } else if (creditLock.errorCode === 'CREDIT_BLOCKED') {
        await sendWhatsAppReply(
          phoneNumber,
          `❌ Your credit account is suspended.\nPlease contact support.`
        );
      } else {
        await sendWhatsAppReply(
          phoneNumber,
          `❌ Unable to process order. Please try again.`
        );
      }
      return res.json({ success: false });
    }

    // Credit validation passed - create order
    const order = await prisma.order.create({
      data: {
        orderId,
        retailerId: retailer.id,
        wholesalerId: creditAccount.wholesalerId,
        items: { create: parsedOrder.items },
        totalAmount: orderAmount,
        creditLedgerEntryId: creditLock.ledgerEntryId,
        status: 'CONFIRMED',
        channel: 'WHATSAPP',
      },
    });

    // Send confirmation
    await sendWhatsAppReply(
      phoneNumber,
      `✅ Order confirmed!\n\nOrder #${order.orderId}\nAmount: Rs ${orderAmount}\nBalance: Rs ${creditLock.newBalance}`
    );

    return res.json({ success: true });
  } catch (error) {
    logger.error('WhatsApp order processing failed', { error });
    return res.status(500).json({ success: false });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseOrderFromMessage(message) {
  // Implement your order parsing logic
  // This is a simplified example
  try {
    // Example: "order rice 10kg@500 dal 5kg@400"
    const items = message
      .replace('order', '')
      .trim()
      .split(' ')
      .reduce((acc, item) => {
        // Parse your format
        return acc;
      }, []);

    return { items };
  } catch (error) {
    return null;
  }
}

async function sendWhatsAppReply(phoneNumber, message) {
  // Use Twilio or your WhatsApp provider to send message
  logger.info('Sending WhatsApp reply', { phoneNumber, message });
}

module.exports = router;
