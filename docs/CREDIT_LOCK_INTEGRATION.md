# Credit Lock Mechanism - Integration Guide

## Overview

This guide shows how to integrate the credit lock mechanism into your order creation flow to prevent double-spending when concurrent orders arrive.

## Problem Solved

**Race Condition Without Locking:**
```
Time | Thread 1                  | Thread 2                  | Balance
-----|---------------------------|---------------------------|--------
T0   | Read balance: 50k         |                           | 50k
T1   |                           | Read balance: 50k         | 50k
T2   | Check: 50k > 40k ✓        |                           | 50k
T3   |                           | Check: 50k > 40k ✓        | 50k
T4   | Create DEBIT: -40k        |                           | 50k
T5   |                           | Create DEBIT: -40k        | 50k
T6   | Commit (balance: 10k left)|                           | 10k
T7   |                           | Commit (balance: 10k left)| 10k
     | RESULT: Both orders approved! Used 80k of 100k budget ❌
```

**With Row-Level Locking:**
```
Time | Thread 1                   | Thread 2                   | Lock Status
-----|----------------------------|----------------------------|---------------
T0   | Lock credit row            |                            | Thread 1 ✓
T1   | Read balance: 50k          |                            | Thread 1 ✓
T2   | Check: 50k > 40k ✓         |                            | Thread 1 ✓
T3   | Create DEBIT: -40k         |                            | Thread 1 ✓
T4   | Commit (balance: 10k left) |                            | Released
T5   |                            | Lock credit row (waiting)  | Waiting...
T6   |                            | Lock acquired              | Thread 2 ✓
T7   |                            | Read balance: 10k          | Thread 2 ✓
T8   |                            | Check: 10k > 40k ✗ FAIL   | Thread 2 ✓
T9   |                            | Rollback                   | Released
     | RESULT: First succeeds, second rejected properly ✓
```

## Integration Pattern

### Step 1: Import the Service

```javascript
const creditLockMechanism = require('../services/creditLockMechanism.service');

// Or instantiate if class-based:
const { CreditLockMechanism } = require('../services/creditLockMechanism.service');
const creditLock = new CreditLockMechanism();
```

### Step 2: In Order Creation Route

```javascript
// routes/whatsapp.routes.js or wherever orders are created

router.post('/webhook/incoming-message', async (req, res) => {
  try {
    const { retailerId, wholesalerId, items } = req.body;

    // STEP 1: Calculate order amount
    const orderAmount = calculateTotalAmount(items);

    // STEP 2: Try to acquire and validate credit
    // This will:
    // - Lock the retailer's credit row
    // - Verify account is active
    // - Check if balance + orderAmount <= creditLimit
    // - Create a DEBIT ledger entry
    // - Return within transaction (atomic)
    const creditLockResult = await creditLockMechanism.acquireAndValidateCredit(
      orderId,
      retailerId,
      wholesalerId,
      orderAmount,
      {
        maxRetries: 3,
        timeout: 1000,
      }
    );

    // STEP 3: Handle credit validation result
    if (!creditLockResult.success) {
      return res.status(400).json({
        success: false,
        error: creditLockResult.errorCode,
        message: `Order rejected: ${creditLockResult.message}`,
        details: {
          errorCode: creditLockResult.errorCode,
          availableCredit: creditLockResult.details?.availableCredit,
          projectedBalance: creditLockResult.details?.projectedBalance,
          creditLimit: creditLockResult.details?.creditLimit,
        },
      });
    }

    // STEP 4: Create order with ledger entry ID linked
    const order = await prisma.order.create({
      data: {
        orderId,
        retailerId,
        wholesalerId,
        items,
        amount: orderAmount,
        // IMPORTANT: Link the credit lock entry
        creditLedgerEntryId: creditLockResult.ledgerEntryId,
        status: 'PENDING',
        createdAt: new Date(),
      },
    });

    // STEP 5: Send confirmation
    return res.json({
      success: true,
      message: 'Order created successfully',
      order: {
        orderId: order.orderId,
        amount: orderAmount,
        newBalance: creditLockResult.newBalance,
        availableCredit: creditLockResult.availableCredit,
      },
    });
  } catch (error) {
    logger.error('Order creation failed', { error, body: req.body });
    return res.status(500).json({
      success: false,
      error: 'SYSTEM_ERROR',
      message: 'Failed to create order',
    });
  }
});
```

## Error Handling

### Error Codes and Handling

```javascript
// INSUFFICIENT_CREDIT
// - Balance + orderAmount would exceed limit
// - Action: Reject order, inform customer
if (creditLockResult.errorCode === 'INSUFFICIENT_CREDIT') {
  const msg = `Order exceeds credit limit. Available: Rs ${creditLockResult.details.availableCredit}`;
  // Send WhatsApp message to retailer
  await sendWhatsAppMessage(retailerId, msg);
}

// CREDIT_BLOCKED
// - Credit account is inactive/blocked
// - Action: Reject order, inform customer to contact support
if (creditLockResult.errorCode === 'CREDIT_BLOCKED') {
  const msg = `Your credit account is currently inactive. Reason: ${creditLockResult.details.blockedReason}`;
  // Send WhatsApp message to retailer
  await sendWhatsAppMessage(retailerId, msg);
}

// MAX_RETRIES_EXCEEDED
// - Lock couldn't be acquired after 3 attempts
// - Action: Retry later or inform customer to try again
if (creditLockResult.errorCode === 'MAX_RETRIES_EXCEEDED') {
  const msg = 'System busy. Please try again in a moment.';
  // Send WhatsApp message to retailer
  await sendWhatsAppMessage(retailerId, msg);
  
  // Optional: Implement queue for retry
  await addToRetryQueue({
    orderId,
    retailerId,
    wholesalerId,
    amount: orderAmount,
  });
}

// CREDIT_ACCOUNT_NOT_FOUND
// - No credit account between retailer and wholesaler
// - Action: Inform customer they don't have credit available
if (creditLockResult.errorCode === 'CREDIT_ACCOUNT_NOT_FOUND') {
  const msg = 'Credit not available for this supplier. Contact them to enable credit.';
  // Send WhatsApp message to retailer
  await sendWhatsAppMessage(retailerId, msg);
}
```

## Order Cancellation

When an order is cancelled, release the credit lock:

```javascript
async function cancelOrder(orderId) {
  // Get the order
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { creditLedgerEntry: true },
  });

  // Release the credit lock
  const releaseResult = await creditLockMechanism.releaseCreditLock(
    order.creditLedgerEntryId,
    `Order ${orderId} cancelled`
  );

  if (!releaseResult.success) {
    logger.error('Failed to release credit lock', {
      orderId,
      ledgerEntryId: order.creditLedgerEntryId,
    });
    throw new Error('Failed to cancel order - credit not released');
  }

  // Update order status
  await prisma.order.update({
    where: { orderId },
    data: { status: 'CANCELLED' },
  });

  // Notify customer
  await sendWhatsAppMessage(
    order.retailerId,
    `Order cancelled. Credit of Rs ${order.amount} has been released.`
  );
}
```

## Testing Concurrent Orders

### Manual Test with cURL

```bash
#!/bin/bash

# Terminal 1: Send first order
curl -X POST http://localhost:3000/webhook/incoming-message \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_1",
    "retailerId": "ret_123",
    "wholesalerId": "who_456",
    "items": [{"product": "Rice 10kg", "quantity": 1, "price": 40000}]
  }' &

# Terminal 2: Send second order SIMULTANEOUSLY (within milliseconds)
curl -X POST http://localhost:3000/webhook/incoming-message \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_2",
    "retailerId": "ret_123",
    "wholesalerId": "who_456",
    "items": [{"product": "Sugar 5kg", "quantity": 1, "price": 40000}]
  }'

# Expected result:
# order_1: SUCCESS (50k used, 50k remaining)
# order_2: SUCCESS (90k used, 10k remaining)
#
# If amounts were reversed or both tried to use more than available:
# order_2: FAILED - INSUFFICIENT_CREDIT
```

### Jest Test Example

See [creditLockMechanism.test.js](../tests/creditLockMechanism.test.js) for comprehensive test suite including:

- Test 3: Two concurrent orders within limit (both succeed)
- Test 4: Two concurrent orders exceeding limit (second fails) - **CRITICAL TEST**
- Test 5: Three concurrent orders with progressive enforcement
- Test 11-12: Stress tests with 10 concurrent orders

Run tests:
```bash
npm run test -- creditLockMechanism.test.js

# Run specific test
npm run test -- creditLockMechanism.test.js -t "Two concurrent orders \(second would exceed"
```

## Deployment Checklist

Before deploying to production:

- [ ] All tests in `creditLockMechanism.test.js` pass
- [ ] Stress tests (Tests 11-12) complete within acceptable time
- [ ] Lock timeout of 1000ms is appropriate for your database
- [ ] Retry configuration (3 attempts, exponential backoff) tested under load
- [ ] Error messages are user-friendly (especially INSUFFICIENT_CREDIT)
- [ ] Order record includes `creditLedgerEntryId` column
- [ ] `cancelOrder()` is integrated for all cancellation paths
- [ ] Monitoring is set up for lock timeout and retry failures
- [ ] Database indexes exist on (retailerId, wholesalerId) for lock performance

## Performance Optimization

### Lock Contention Analysis

For a retailer with concurrent orders:
- **Best case**: Different retailer-wholesaler pairs = No contention
- **Worst case**: Same retailer-wholesaler = Sequential locking (by design)

Average lock hold time: **5-50ms**
- Prisma transaction setup: ~2ms
- Lock acquisition: ~1ms
- Balance calculation from ledger: ~2-20ms (depends on ledger size)
- Entry creation: ~1-5ms
- Total: ~8-30ms

With 3 concurrent orders for same retailer:
```
Order 1: T0-T30ms (succeeds)
Order 2: T30-T60ms (waits, then succeeds or fails)
Order 3: T60-T90ms (waits, then succeeds or fails)
```

### Optimization if Needed

1. **Denormalize balance** in `RetailerWholesalerCredit`:
   - Eliminates ledger sum calculation
   - Reduces lock time to ~5-10ms
   - **Tradeoff**: Breaks audit trail principle, requires careful updates

2. **Implement read-only replicas** for balance queries:
   - Doesn't help with locking (still needs to lock primary)
   - Could reduce other balance queries

3. **Increase timeout** if database is slower:
   ```javascript
   await creditLockMechanism.acquireAndValidateCredit(
     orderId, retailerId, wholesalerId, amount,
     { maxRetries: 3, timeout: 2000 } // 2 seconds
   )
   ```

## Monitoring & Alerts

Track these metrics:

```javascript
// In creditLockMechanism.service.js, add telemetry:

async acquireAndValidateCredit(...) {
  const startTime = Date.now();

  try {
    const result = await this._validateWithLock(...);
    const duration = Date.now() - startTime;

    // Metrics
    metrics.timer('credit_lock.duration', duration);
    if (result.success) {
      metrics.increment('credit_lock.success');
    } else {
      metrics.increment('credit_lock.failure', {
        reason: result.errorCode
      });
    }

    return result;
  } catch (error) {
    metrics.increment('credit_lock.error');
    throw error;
  }
}
```

Set alerts for:
- `credit_lock.duration` > 100ms (potential database issue)
- `credit_lock.failure.INSUFFICIENT_CREDIT` spike (high fraud attempts)
- `credit_lock.error` > 1% (system issue)

## FAQ

**Q: What if the database is down?**
A: The lock acquisition will throw an error, caught by the middleware. The WhatsApp order won't be created.

**Q: Can the same order be created twice?**
A: No. Each order gets a unique `orderId`. The credit lock is acquired and committed atomically.

**Q: What if payment arrives while order is pending?**
A: The payment is a separate CREDIT ledger entry. Next order will see reduced balance correctly.

**Q: How long does a lock hold?**
A: Until the transaction commits (5-50ms typically). Queries waiting for lock timeout after 1000ms and retry.

**Q: Can we batch orders for efficiency?**
A: No. Each order must acquire its own lock to prevent double-spending. Locking is atomic per order.

**Q: What happens if wholesaler changes credit limit?**
A: New limit applies to next orders. Existing reserved credits still count toward old balance.

