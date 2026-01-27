# Strict Order State Machine - Quick Reference & Examples

## Quick State Transitions

### Example 1: Basic Order Flow

```javascript
const orderStateMachine = require('../services/orderStateMachine.service');

// Order created
let order = await orderStateMachine.transitionOrderStatus(orderId, 'CREATED');
console.log('✓ Order created');

// Validate order
order = await orderStateMachine.transitionOrderStatus(orderId, 'VALIDATED', {
  reason: 'Items and quantities validated'
});
console.log('✓ Order validated');

// Reserve credit
order = await orderStateMachine.transitionOrderStatus(orderId, 'CREDIT_RESERVED', {
  reason: 'Credit limit verified and reserved'
});
console.log('✓ Credit reserved');

// Notify vendor
order = await orderStateMachine.transitionOrderStatus(orderId, 'VENDOR_NOTIFIED', {
  reason: 'Broadcast to available vendors'
});
console.log('✓ Vendor notified');

// Vendor accepts
order = await orderStateMachine.transitionOrderStatus(orderId, 'VENDOR_ACCEPTED', {
  performedBy: vendorId,
  reason: 'Vendor confirmed order'
});
console.log('✓ Vendor accepted');

// Order fulfilled
order = await orderStateMachine.transitionOrderStatus(orderId, 'FULFILLED', {
  reason: 'Order delivered and confirmed'
});
console.log('✓ Order fulfilled (terminal state)');
```

### Example 2: Handling Order Rejection

```javascript
// Vendor notified
await orderStateMachine.transitionOrderStatus(orderId, 'VENDOR_NOTIFIED', {
  reason: 'Sent to vendor'
});

// Vendor rejects order
await orderStateMachine.transitionOrderStatus(orderId, 'VENDOR_REJECTED', {
  performedBy: vendorId,
  reason: 'Vendor out of stock'
});

// No further transitions allowed (terminal-like in this case)
// Would need manual intervention to return to VENDOR_NOTIFIED
```

### Example 3: Handling Order Expiry

```javascript
// In worker processor
try {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, expiresAt: true }
  });

  if (order.expiresAt < new Date() && 
      !orderStateMachine.TERMINAL_STATES.includes(order.status)) {
    
    await orderStateMachine.transitionOrderStatus(orderId, 'CANCELLED', {
      reason: 'Order expired - no vendor accepted within timeout'
    });
  }
} catch (error) {
  console.error('Failed to expire order:', error.message);
}
```

### Example 4: Handling System Failures

```javascript
// If order processing fails at any point
try {
  // ... process order ...
} catch (error) {
  // Transition to FAILED state
  await orderStateMachine.transitionOrderStatus(orderId, 'FAILED', {
    reason: `Processing failed: ${error.message}`
  });
  
  // Release any reservations
  await stockService.releaseStock(orderId);
}
```

## Validation Examples

### Check Allowed Transitions

```javascript
const allowed = orderStateMachine.getAllowedTransitions('VENDOR_NOTIFIED');
console.log(allowed);
// Output: ['VENDOR_ACCEPTED', 'VENDOR_REJECTED', 'FAILED', 'CANCELLED']
```

### Validate Specific Transition

```javascript
const validation = await orderStateMachine.validateTransition(
  orderId,
  'VENDOR_ACCEPTED', // current
  'FULFILLED'        // target
);

if (validation.valid) {
  console.log('✓ Transition allowed');
  const order = await orderStateMachine.transitionOrderStatus(orderId, 'FULFILLED', {});
} else {
  console.error('✗ Transition not allowed:', validation.error);
  console.log('Allowed transitions:', validation.allowedTransitions);
}
```

### Pre-flight Check

```javascript
const verification = await orderStateMachine.verifyTransitionPossible(
  orderId,
  'FULFILLED'
);

if (!verification.possible) {
  return res.status(400).json({
    error: verification.error,
    currentState: verification.currentState,
    allowedStates: verification.allowedNextStates
  });
}
```

## State History & Audit

### View Complete State Journey

```javascript
const history = await orderStateMachine.getOrderStateHistory(orderId);

history.forEach(event => {
  console.log(`${event.timestamp}: ${event.fromState} → ${event.toState}`);
  console.log(`  By: ${event.performedBy}`);
  console.log(`  Reason: ${event.reason}\n`);
});

// Output:
// 2026-01-21T10:00:00Z: CREATED → VALIDATED
//   By: SYSTEM
//   Reason: Order validated
//
// 2026-01-21T10:05:00Z: VALIDATED → CREDIT_RESERVED
//   By: SYSTEM
//   Reason: Credit limit verified
// ...
```

### Check State Entry Time

```javascript
const history = await orderStateMachine.getOrderStateHistory(orderId);
const vendorNotifiedEvent = history.find(e => e.toState === 'VENDOR_NOTIFIED');

if (vendorNotifiedEvent) {
  const timeInState = new Date() - new Date(vendorNotifiedEvent.timestamp);
  console.log(`Order in VENDOR_NOTIFIED for ${timeInState / 1000} seconds`);
}
```

### Audit Trail for Admin

```javascript
async function getOrderAuditTrail(orderId) {
  const events = await orderStateMachine.getOrderStateHistory(orderId);
  
  return events.map(e => ({
    time: new Date(e.timestamp).toLocaleString(),
    from: e.fromState,
    to: e.toState,
    actor: e.performedBy === 'SYSTEM' ? '🤖 System' : `👤 ${e.performedBy}`,
    reason: e.reason
  }));
}

// Display in admin dashboard
const trail = await getOrderAuditTrail(orderId);
console.table(trail);
```

## API Integration Examples

### Express Endpoint for State Transition

```javascript
router.post('/api/orders/:id/transition', async (req, res) => {
  const { orderId } = req.params;
  const { targetState, reason } = req.body;

  try {
    // Validate first
    const validation = await orderStateMachine.validateTransition(
      orderId,
      null, // fetch current
      targetState
    );

    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
        currentState: validation.currentStatus,
        allowedTransitions: validation.allowedTransitions
      });
    }

    // Transition
    const order = await orderStateMachine.transitionOrderStatus(
      orderId,
      targetState,
      {
        performedBy: req.user.id,
        reason: reason || 'Admin transition'
      }
    );

    res.json({
      success: true,
      order: {
        id: order.id,
        status: order.status,
        updatedAt: order.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Check Order Status Endpoint

```javascript
router.get('/api/orders/:id/state-info', async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, createdAt: true, updatedAt: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const history = await orderStateMachine.getOrderStateHistory(orderId);
    const allowed = orderStateMachine.getAllowedTransitions(order.status);

    res.json({
      orderId: order.id,
      currentState: order.status,
      allowedNextStates: allowed,
      isTerminal: orderStateMachine.TERMINAL_STATES.includes(order.status),
      createdAt: order.createdAt,
      lastUpdated: order.updatedAt,
      history: history.slice(-5) // Last 5 transitions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Worker Integration

### OrderExpiry Processor

```javascript
async function processOrderExpiry(job) {
  const { orderId } = job.data;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, expiresAt: true }
  });

  if (!order) throw new Error(`Order ${orderId} not found`);

  // Skip if already terminal
  if (orderStateMachine.TERMINAL_STATES.includes(order.status)) {
    return { skipped: true, reason: `Already in terminal state: ${order.status}` };
  }

  // Skip if not expired
  if (new Date(order.expiresAt) > new Date()) {
    return { skipped: true, reason: 'Not expired yet' };
  }

  // Cancel the order
  const updatedOrder = await orderStateMachine.transitionOrderStatus(
    orderId,
    'CANCELLED',
    { reason: 'Order expired' }
  );

  // Release stock
  await stockService.releaseStock(orderId);

  return {
    success: true,
    action: 'cancelled',
    orderId
  };
}
```

### Vendor Fallback Processor

```javascript
async function processVendorFallback(job) {
  const { orderId } = job.data;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true }
  });

  if (!order) throw new Error(`Order ${orderId} not found`);

  // Must be in VENDOR_NOTIFIED state to fallback
  if (order.status !== 'VENDOR_NOTIFIED') {
    return { 
      skipped: true, 
      reason: `Cannot fallback from ${order.status}` 
    };
  }

  // Try to find another vendor
  const newVendor = await orderDecisionService.selectAlternateVendor(orderId);

  if (!newVendor) {
    // No more vendors, fail the order
    await orderStateMachine.transitionOrderStatus(orderId, 'FAILED', {
      reason: 'No vendors available for order'
    });
    return { failed: true };
  }

  // Stay in VENDOR_NOTIFIED but notify different vendor
  console.log(`Notifying alternate vendor ${newVendor.id} for order ${orderId}`);

  return { success: true, newVendor: newVendor.id };
}
```

## Error Handling Patterns

### Graceful Degradation

```javascript
async function attemptStateTransition(orderId, targetState, reason) {
  try {
    return await orderStateMachine.transitionOrderStatus(orderId, targetState, {
      reason,
      performedBy: 'SYSTEM'
    });
  } catch (error) {
    if (error.message.includes('Invalid transition')) {
      console.warn(`Cannot transition ${orderId} to ${targetState}: ${error.message}`);
      // Fall back to FAILED state
      try {
        return await orderStateMachine.transitionOrderStatus(orderId, 'FAILED', {
          reason: `Failed to transition to ${targetState}: ${error.message}`
        });
      } catch (fallbackError) {
        console.error('Critical: Cannot transition to FAILED:', fallbackError);
        throw fallbackError;
      }
    }
    throw error;
  }
}
```

### Validation with User Feedback

```javascript
async function validateAndTransition(orderId, targetState) {
  const verification = await orderStateMachine.verifyTransitionPossible(
    orderId,
    targetState
  );

  if (!verification.possible) {
    const message = `Cannot transition to ${targetState}: ${verification.error}`;
    
    if (verification.requirementsMissing.length > 0) {
      return {
        allowed: false,
        message,
        missingRequirements: verification.requirementsMissing,
        hint: `Order must first transition through: ${verification.requirementsMissing.join(' → ')}`
      };
    }

    return {
      allowed: false,
      message,
      currentState: verification.currentState,
      allowedNextStates: verification.allowedNextStates
    };
  }

  return { allowed: true };
}
```

## Monitoring Queries

### Database Queries for State Analysis

```sql
-- Orders stuck in VENDOR_NOTIFIED for > 1 hour
SELECT 
  o.id,
  o.orderNumber,
  oe.timestamp as enteredState,
  NOW() - oe.timestamp as timeInState
FROM orders o
JOIN order_events oe ON o.id = oe.orderId
WHERE oe.payload->>'toState' = 'VENDOR_NOTIFIED'
AND oe.timestamp < NOW() - INTERVAL '1 hour'
AND NOT EXISTS (
  SELECT 1 FROM order_events oe2 
  WHERE oe2.orderId = o.id 
  AND oe2.timestamp > oe.timestamp 
  AND oe2.eventType = 'STATE_CHANGE'
);

-- State transition failures
SELECT 
  o.id,
  oe1.payload->>'toState' as attemptedState,
  COUNT(*) as failedAttempts,
  MAX(oe1.timestamp) as lastAttempt
FROM orders o
JOIN order_events oe1 ON o.id = oe1.orderId
WHERE oe1.payload->>'performedBy' = 'SYSTEM'
GROUP BY o.id, oe1.payload->>'toState'
HAVING COUNT(*) > 1;

-- Most common state transitions
SELECT 
  payload->>'fromState' as from_state,
  payload->>'toState' as to_state,
  COUNT(*) as count
FROM order_events
WHERE eventType = 'STATE_CHANGE'
GROUP BY from_state, to_state
ORDER BY count DESC;
```

## Testing Utilities

### Unit Test Helper

```javascript
async function createTestOrder(initialState = 'CREATED') {
  const order = await prisma.order.create({
    data: {
      retailerId: 'test-retailer',
      totalAmount: 1000,
      status: initialState
    }
  });

  return order;
}

async function testTransition(fromState, toState) {
  const order = await createTestOrder(fromState);

  try {
    const result = await orderStateMachine.transitionOrderStatus(
      order.id,
      toState
    );
    return { allowed: true, order: result };
  } catch (error) {
    return { allowed: false, error: error.message };
  }
}

// Usage in tests
test('VENDOR_ACCEPTED → FULFILLED allowed', async () => {
  const result = await testTransition('VENDOR_ACCEPTED', 'FULFILLED');
  expect(result.allowed).toBe(true);
});
```

---

**For more details, see:** [STRICT_ORDER_STATE_MACHINE.md](./STRICT_ORDER_STATE_MACHINE.md)
