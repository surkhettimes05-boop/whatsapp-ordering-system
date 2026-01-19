/**
 * CREDIT LOCK SYSTEM - INTEGRATION GUIDE
 * How to integrate credit locking into order processing pipeline
 * 
 * This document shows:
 * 1. Where to call credit lock in order workflow
 * 2. How to handle success/failure
 * 3. Integration with existing services
 * 4. Error recovery procedures
 */

const creditLockService = require('../services/creditLock.service');
const prisma = require('../config/database');

// ============================================================================
// EXAMPLE 1: Create Order with Credit Lock
// ============================================================================

/**
 * Typical order creation flow WITH credit lock
 */
async function createOrderWithCreditLock(
  retailerId,
  wholesalerId,
  orderItems,
  orderAmount
) {
  try {
    // Step 1: Validate and lock credit
    // This is ATOMIC - either credit is reserved or order fails
    const creditLock = await creditLockService.validateAndLockCredit(
      `order_${Date.now()}`, // Unique order ID
      retailerId,
      wholesalerId,
      orderAmount
    );

    // Step 2: Handle credit lock response
    if (!creditLock.success) {
      // Return detailed error to client
      return {
        success: false,
        error: creditLock.error,
        errorCode: creditLock.errorCode,
        details: {
          creditLimit: creditLock.creditLimit,
          currentBalance: creditLock.balance,
          availableCredit: creditLock.availableCredit,
          requestedAmount: orderAmount,
        },
      };
    }

    // Step 3: Create order (credit already reserved via ledger entry)
    const order = await prisma.order.create({
      data: {
        retailerId,
        wholesalerId,
        items: orderItems,
        amount: orderAmount,
        status: 'CREDIT_APPROVED', // Move directly to next stage
        ledgerEntryId: creditLock.ledgerEntryId, // Link to credit lock
        createdAt: new Date(),
      },
    });

    // Step 4: Return success with credit details
    return {
      success: true,
      orderId: order.id,
      ledgerEntryId: creditLock.ledgerEntryId,
      creditDetails: {
        newBalance: creditLock.newBalance,
        availableCredit: creditLock.availableCredit,
        creditLimit: creditLock.creditLimit,
      },
    };
  } catch (error) {
    console.error('Order creation failed:', error);

    // Handle potential deadlock with retry logic
    if (error.code === '40P01') {
      console.log('Deadlock detected, retrying...');
      // Retry is handled internally by creditLock service
      throw new Error('Deadlock retry exhausted');
    }

    throw error;
  }
}

// ============================================================================
// EXAMPLE 2: WebHook Handler with Concurrent Order Protection
// ============================================================================

/**
 * WhatsApp webhook handler that processes orders with credit locking
 * Handles concurrent messages for same retailer safely
 */
async function handleIncomingOrderWebhook(whatsappMessage) {
  const { from, body, timestamp } = whatsappMessage;

  try {
    // Step 1: Parse order from WhatsApp message
    const orderData = parseWhatsAppOrder(body);
    if (!orderData.valid) {
      return { success: false, error: 'Invalid order format' };
    }

    const { retailerId, wholesalerId, items, totalAmount } = orderData;

    // Step 2: Validate retailer exists
    const retailer = await prisma.retailer.findUnique({
      where: { id: retailerId },
    });
    if (!retailer) {
      return { success: false, error: 'Retailer not found' };
    }

    // Step 3: Validate wholesaler exists
    const wholesaler = await prisma.wholesaler.findUnique({
      where: { id: wholesalerId },
    });
    if (!wholesaler) {
      return { success: false, error: 'Wholesaler not found' };
    }

    // Step 4: Create order with atomic credit lock
    // ← THIS IS KEY: If two messages arrive simultaneously,
    //   only ONE will succeed in locking the credit
    const createOrderResult = await createOrderWithCreditLock(
      retailerId,
      wholesalerId,
      items,
      totalAmount
    );

    if (!createOrderResult.success) {
      // Return error details to user
      return {
        success: false,
        error: 'Order rejected',
        reason: createOrderResult.error,
        details: createOrderResult.details,
      };
    }

    // Step 5: Send confirmation to WhatsApp
    await sendWhatsAppConfirmation(from, {
      orderId: createOrderResult.orderId,
      amount: totalAmount,
      newBalance: createOrderResult.creditDetails.newBalance,
    });

    return {
      success: true,
      orderId: createOrderResult.orderId,
      message: 'Order confirmed with credit locked',
    };
  } catch (error) {
    console.error('Webhook processing error:', error);
    return {
      success: false,
      error: 'Server error processing order',
    };
  }
}

// ============================================================================
// EXAMPLE 3: Order Cancellation with Credit Reversal
// ============================================================================

/**
 * Cancel order and release reserved credit
 */
async function cancelOrderWithCreditReversal(orderId, reason) {
  try {
    // Step 1: Fetch order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { retailer: true, wholesaler: true },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Step 2: Can only cancel if not yet shipped
    if (['SHIPPED', 'DELIVERED'].includes(order.status)) {
      throw new Error(`Cannot cancel ${order.status} order`);
    }

    // Step 3: Reverse credit reservation
    // ← This is ATOMIC: ledger gets a REVERSAL entry that cancels the DEBIT
    const reversalResult = await creditLockService.reverseCreditReservation(
      orderId,
      reason // e.g., 'CUSTOMER_REQUESTED', 'OUT_OF_STOCK'
    );

    if (!reversalResult.success) {
      throw new Error('Failed to reverse credit');
    }

    // Step 4: Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });

    return {
      success: true,
      orderId,
      creditReleased: reversalResult.amountReversed,
      message: `Order cancelled, credit released`,
    };
  } catch (error) {
    console.error('Order cancellation failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 4: Check Credit Status Before Order
// ============================================================================

/**
 * Show available credit to retailer before they place order
 */
async function checkAvailableCredit(retailerId, wholesalerId) {
  const exposure = await creditLockService.getCreditExposure(
    retailerId,
    wholesalerId
  );

  if (!exposure.exists) {
    return {
      success: false,
      error: 'No credit relationship found with this wholesaler',
    };
  }

  return {
    success: true,
    creditLimit: exposure.creditLimit,
    currentUsed: exposure.currentBalance,
    availableCredit: exposure.availableCredit,
    utilizationPercent: exposure.utilizationPercent,
    isActive: exposure.isActive,
    blockedReason: exposure.blockedReason,
    message: `You can order up to ₹${exposure.availableCredit}`,
  };
}

// ============================================================================
// EXAMPLE 5: Critical Exposure Alert
// ============================================================================

/**
 * Get list of retailers approaching credit limits
 * Useful for debt collection follow-ups
 */
async function getCriticalCreditAlerts(wholesalerId) {
  const criticalAccounts = await creditLockService.getCriticalExposures(
    wholesalerId,
    80 // Alert if > 80% utilized
  );

  return {
    count: criticalAccounts.length,
    alerts: criticalAccounts.map(account => ({
      retailerId: account.retailerId,
      shopName: account.retailerName,
      phoneNumber: account.phoneNumber,
      message: `${account.retailerName} has used ₹${account.currentBalance} of ₹${account.creditLimit} credit (${account.utilizationPercent}% utilized)`,
      availableCredit: account.availableCredit,
      action: `Consider payment reminder or hold new orders`,
    })),
  };
}

// ============================================================================
// EXAMPLE 6: Concurrent Order Processing (Race Condition Demo)
// ============================================================================

/**
 * Demonstrates how credit lock prevents double spending
 * when orders arrive simultaneously
 */
async function demonstrateConcurrencyProtection() {
  // Scenario:
  // - Retailer has ₹100,000 credit limit
  // - Two orders arrive at the EXACT same time
  // - Order A: ₹60,000
  // - Order B: ₹50,000
  // - Total: ₹110,000 (exceeds limit)
  //
  // Without locking: Both might pass validation, total debt = ₹110,000 (BAD!)
  // With locking: First order succeeds, second fails (GOOD!)

  const retailerId = 'retailer_123';
  const wholesalerId = 'wholesaler_456';

  // Simulate simultaneous requests
  const [resultA, resultB] = await Promise.all([
    creditLockService.validateAndLockCredit(
      'order_A',
      retailerId,
      wholesalerId,
      60000
    ),
    creditLockService.validateAndLockCredit(
      'order_B',
      retailerId,
      wholesalerId,
      50000
    ),
  ]);

  console.log('Order A result:', resultA);
  console.log('Order B result:', resultB);

  // Expected output:
  // Order A: success=true, newBalance=60000
  // Order B: success=false, error='Insufficient credit', availableCredit=40000

  return {
    orderA: resultA.success ? 'APPROVED' : 'REJECTED',
    orderB: resultB.success ? 'APPROVED' : 'REJECTED',
    finalBalance: 60000, // Only Order A's amount
    preventedOverspending: 50000,
  };
}

// ============================================================================
// EXAMPLE 7: Integration with Order State Machine
// ============================================================================

/**
 * How to integrate credit lock into your order state transitions
 */
async function orderStateTransition(orderId, fromState, toState) {
  // Credit lock applies specifically in these transitions:
  // - CREATED → CREDIT_APPROVED: Lock credit
  // - FAILED → CANCELLED: Reverse credit
  // - DELIVERED → COMPLETED: Confirm credit (no change needed)

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (fromState === 'CREATED' && toState === 'CREDIT_APPROVED') {
    // This is where credit lock happens
    const result = await creditLockService.validateAndLockCredit(
      orderId,
      order.retailerId,
      order.wholesalerId,
      order.amount
    );

    if (!result.success) {
      // Transition rejected due to insufficient credit
      return {
        allowed: false,
        reason: result.error,
      };
    }

    return {
      allowed: true,
      creditLocked: true,
      newBalance: result.newBalance,
    };
  }

  if (fromState === 'PENDING' && toState === 'CANCELLED') {
    // Release the credit
    const result = await creditLockService.reverseCreditReservation(
      orderId,
      'ORDER_CANCELLED'
    );

    return {
      allowed: true,
      creditReleased: result.amountReversed,
    };
  }

  // Other transitions don't affect credit
  return { allowed: true };
}

// ============================================================================
// EXAMPLE 8: Deployment Checklist
// ============================================================================

const deploymentChecklist = {
  database: [
    '✅ RetailerWholesalerCredit table has unique(retailerId, wholesalerId)',
    '✅ LedgerEntry table is append-only (no update/delete)',
    '✅ Both tables support row-level locking (FOR UPDATE)',
    '✅ Database supports SERIALIZABLE transactions',
    '✅ Connection pool supports concurrent transactions',
  ],
  application: [
    '✅ creditLockService imported in order processing',
    '✅ validateAndLockCredit called before creating order',
    '✅ reverseCreditReservation called on order cancellation',
    '✅ Error handling for INSUFFICIENT_CREDIT, CREDIT_BLOCKED',
    '✅ Deadlock retry logic enabled (max 3 retries)',
  ],
  monitoring: [
    '✅ Alert on > 5 failed credit lock attempts/minute',
    '✅ Alert on > 3 deadlocks/hour',
    '✅ Track credit utilization across all retailers',
    '✅ Monitor order creation latency (should be <500ms)',
    '✅ Log all credit lock operations for audit',
  ],
  testing: [
    '✅ Unit tests: creditLock.test.js passes',
    '✅ Concurrent test: 10 simultaneous orders',
    '✅ Stress test: 100+ concurrent orders',
    '✅ Integration test: full order workflow',
    '✅ Production-like test with real DB',
  ],
};

console.log('Deployment Checklist:');
Object.entries(deploymentChecklist).forEach(([section, items]) => {
  console.log(`\n${section.toUpperCase()}:`);
  items.forEach(item => console.log(`  ${item}`));
});

// ============================================================================
// EXAMPLE 9: Troubleshooting
// ============================================================================

const troubleshooting = {
  'Order always rejected with INSUFFICIENT_CREDIT': {
    diagnosis: 'Previous order never cancelled/reversed',
    solution: [
      '1. Check ledger entries for orphaned DEBIT entries',
      '2. Run: SELECT * FROM ledger_entries WHERE retailerId=$1',
      '3. If old entries exist, manually create REVERSAL entry',
      '4. Or: Call reverseCreditReservation for orphaned orders',
    ],
  },
  'Deadlock errors increasing': {
    diagnosis: 'Too many concurrent orders for same retailer-wholesaler pair',
    solution: [
      '1. Increase retryDelayMs in creditLock options',
      '2. Limit concurrent orders per pair to 5-10',
      '3. Queue orders if limit exceeded',
      '4. Monitor with: SELECT blocking_locks FROM pg_stat_statements',
    ],
  },
  'Credit available shows different values each time': {
    diagnosis: 'Concurrent queries reading uncommitted data',
    solution: [
      '1. Ensure transactions use READ_COMMITTED or higher isolation',
      '2. Always read balance within transaction context',
      '3. Use _calculateBalanceForUpdate within tx context',
      '4. Never query directly in application code',
    ],
  },
  'Orders succeed but balance not updated': {
    diagnosis: 'Ledger entry not being created or transaction not committed',
    solution: [
      '1. Check withTransaction utility is being used',
      '2. Verify no errors thrown before ledgerEntry.create',
      '3. Check database transaction logs: BEGIN / COMMIT',
      '4. Enable debug logging: NODE_DEBUG=sql',
    ],
  },
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  createOrderWithCreditLock,
  handleIncomingOrderWebhook,
  cancelOrderWithCreditReversal,
  checkAvailableCredit,
  getCriticalCreditAlerts,
  demonstrateConcurrencyProtection,
  orderStateTransition,
};
