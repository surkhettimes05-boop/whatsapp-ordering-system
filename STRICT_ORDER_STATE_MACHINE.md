# Strict Order State Machine Implementation

## Overview

This document describes the **strict, hard-coded order state machine** implemented in the WhatsApp Ordering System. The state machine enforces atomic, transactional order status transitions with comprehensive event logging.

## States

The system defines 9 distinct states:

```
CREATED
  ↓
VALIDATED
  ↓
CREDIT_RESERVED
  ↓
VENDOR_NOTIFIED
  ├→ VENDOR_ACCEPTED → FULFILLED (terminal)
  └→ VENDOR_REJECTED → CANCELLED (terminal)

Terminal States: FULFILLED, CANCELLED, FAILED
```

### State Descriptions

| State | Description | When It Occurs |
|-------|-------------|----------------|
| **CREATED** | Order just created, awaiting validation | Initial state after order creation |
| **VALIDATED** | Order structure validated (items, quantities, prices) | After successful validation checks |
| **CREDIT_RESERVED** | Credit has been reserved for this order | After credit check and reserve |
| **VENDOR_NOTIFIED** | Vendor has been notified of order | After broadcasting to vendor |
| **VENDOR_ACCEPTED** | Vendor has accepted the order | When vendor confirms |
| **VENDOR_REJECTED** | Vendor declined the order | When vendor declines |
| **FULFILLED** | Order completed successfully (terminal) | When vendor ships/delivery confirmed |
| **CANCELLED** | Order cancelled (terminal) | When explicitly cancelled or expired |
| **FAILED** | Order processing failed (terminal) | When system error occurs |

## State Transitions

### Allowed Transitions Map

```javascript
CREATED → [VALIDATED, FAILED, CANCELLED]
VALIDATED → [CREDIT_RESERVED, FAILED, CANCELLED]
CREDIT_RESERVED → [VENDOR_NOTIFIED, FAILED, CANCELLED]
VENDOR_NOTIFIED → [VENDOR_ACCEPTED, VENDOR_REJECTED, FAILED, CANCELLED]
VENDOR_ACCEPTED → [FULFILLED, FAILED, CANCELLED]
VENDOR_REJECTED → [CANCELLED, FAILED]
FULFILLED → [] (terminal - no transitions)
CANCELLED → [] (terminal - no transitions)
FAILED → [] (terminal - no transitions)
```

### Invalid Transitions

- **No transitions FROM terminal states**: Once an order reaches FULFILLED, CANCELLED, or FAILED, it cannot transition further
- **Backwards transitions**: Orders cannot revert to earlier states (e.g., VALIDATED → CREATED is not allowed)
- **Skipping states**: Orders must follow the linear flow (e.g., VALIDATED → VENDOR_NOTIFIED without CREDIT_RESERVED is not allowed)

## Critical Rules

### 1. Atomicity of State Changes

Every state transition is **atomic** - it succeeds or fails entirely with no partial updates:

```javascript
await orderStateMachine.transitionOrderStatus(orderId, 'VENDOR_NOTIFIED', {
  performedBy: 'SYSTEM',
  reason: 'Broadcasting to vendors'
});
```

**Within a single database transaction:**
1. ✅ Order status is updated
2. ✅ State change event written to `order_events` table
3. ✅ Audit log entry created in `AdminAuditLog`

If ANY step fails, **all are rolled back** and order remains in original state.

### 2. Credit Reservation Required Before Fulfillment

**STRICT RULE**: An order cannot transition to FULFILLED unless CREDIT_RESERVED exists in its state history.

This is enforced in `validateTransition()`:

```javascript
if (toStatus === 'FULFILLED') {
  const creditReservedEvent = await client.orderEvent.findFirst({
    where: {
      orderId,
      eventType: 'STATE_CHANGE',
      payload: { contains: '"toState":"CREDIT_RESERVED"' }
    }
  });

  if (!creditReservedEvent) {
    throw new Error(`Cannot fulfill order: CREDIT_RESERVED not found in history`);
  }
}
```

### 3. Illegal Transitions Throw Errors

Any attempt to violate the state machine will throw a descriptive error:

```javascript
// This will throw an error:
await orderStateMachine.transitionOrderStatus(orderId, 'VENDOR_ACCEPTED', {});

// Error message:
// "Invalid transition from CREATED to VENDOR_ACCEPTED. 
//  Allowed transitions: VALIDATED, FAILED, CANCELLED"
```

### 4. Every State Change Writes to order_events

Each transition automatically writes a `STATE_CHANGE` event to the `order_events` table:

**Event Payload:**
```json
{
  "fromState": "VENDOR_NOTIFIED",
  "toState": "VENDOR_ACCEPTED",
  "performedBy": "SYSTEM",
  "reason": "Vendor accepted order",
  "timestamp": "2026-01-21T10:30:45Z"
}
```

This creates an immutable audit trail of all state changes.

## Usage

### Basic State Transition

```javascript
const orderStateMachine = require('./services/orderStateMachine.service');

// Simple transition
const updatedOrder = await orderStateMachine.transitionOrderStatus(
  'order-id-123',
  'VENDOR_NOTIFIED',
  {
    performedBy: 'SYSTEM',
    reason: 'Broadcasting order to vendors'
  }
);

console.log(updatedOrder.status); // 'VENDOR_NOTIFIED'
```

### Validate Before Transitioning

```javascript
// Check if transition is possible
const validation = await orderStateMachine.validateTransition(
  'order-id-123',
  'VENDOR_NOTIFIED',  // current status (optional)
  'VENDOR_ACCEPTED'   // target status
);

if (!validation.valid) {
  console.error(validation.error);
  console.log('Allowed transitions:', validation.allowedTransitions);
  return;
}

// Safe to proceed
await orderStateMachine.transitionOrderStatus('order-id-123', 'VENDOR_ACCEPTED', {});
```

### Get State History

```javascript
// Fetch all state changes for an order
const history = await orderStateMachine.getOrderStateHistory('order-id-123');

// Output:
// [
//   {
//     timestamp: '2026-01-21T10:00:00Z',
//     fromState: 'CREATED',
//     toState: 'VALIDATED',
//     performedBy: 'SYSTEM',
//     reason: 'Order validated'
//   },
//   {
//     timestamp: '2026-01-21T10:05:00Z',
//     fromState: 'VALIDATED',
//     toState: 'CREDIT_RESERVED',
//     performedBy: 'SYSTEM',
//     reason: 'Credit reserved for order'
//   },
//   ...
// ]
```

### Verify Transition Possible

```javascript
const result = await orderStateMachine.verifyTransitionPossible(
  'order-id-123',
  'FULFILLED'
);

// Output:
{
  possible: false,
  currentState: 'VENDOR_ACCEPTED',
  targetState: 'FULFILLED',
  allowed: true,
  allowedNextStates: ['FULFILLED', 'FAILED', 'CANCELLED'],
  error: null,
  requirementsMissing: []
}
```

### Within a Transaction

```javascript
// Use when combining state change with other operations
const result = await prisma.$transaction(async (tx) => {
  // Change state within transaction
  const updatedOrder = await orderStateMachine.transitionOrderStatusInTransaction(
    tx,
    orderId,
    'CREDIT_RESERVED',
    {
      performedBy: 'SYSTEM',
      reason: 'Credit reserved'
    }
  );

  // Do other operations in same transaction
  await tx.creditReservation.create({
    data: {
      orderId,
      amount: order.totalAmount,
      status: 'ACTIVE'
    }
  });

  return updatedOrder;
});
```

## Integration Points

### 1. Order Service (`order.service.js`)

The order service uses the state machine for all status updates:

```javascript
async updateOrderStatus(id, status, performedBy, reason) {
  const updatedOrder = await orderStateMachine.transitionOrderStatus(id, status, {
    performedBy,
    reason,
    skipValidation: false
  });
  return updatedOrder;
}
```

### 2. Worker Processors

All queue processors use the state machine for transitions:

**orderExpiry.processor.js:**
```javascript
const updatedOrder = await orderStateMachine.transitionOrderStatus(
  orderId,
  'CANCELLED',
  {
    performedBy: 'SYSTEM',
    reason: 'Order expired - no vendor accepted within timeout'
  }
);
```

### 3. API Endpoints

Controllers should use the state machine for state changes:

```javascript
router.post('/orders/:id/transition', async (req, res) => {
  const { targetState, reason } = req.body;
  
  try {
    const order = await orderStateMachine.transitionOrderStatus(
      req.params.id,
      targetState,
      {
        performedBy: req.user.id,
        reason
      }
    );
    
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

## Error Handling

### Transition Validation Error

```javascript
try {
  await orderStateMachine.transitionOrderStatus(orderId, 'INVALID_STATE', {});
} catch (error) {
  // Error: "Invalid transition from VENDOR_NOTIFIED to INVALID_STATE. 
  //         Allowed transitions: VENDOR_ACCEPTED, VENDOR_REJECTED, FAILED, CANCELLED"
  console.error(error.message);
}
```

### Credit Reservation Missing

```javascript
try {
  await orderStateMachine.transitionOrderStatus(orderId, 'FULFILLED', {});
} catch (error) {
  // Error: "Cannot fulfill order: CREDIT_RESERVED not found in history"
  console.error(error.message);
}
```

### Order Not Found

```javascript
try {
  await orderStateMachine.transitionOrderStatus('nonexistent-id', 'CANCELLED', {});
} catch (error) {
  // Error: "Order nonexistent-id not found"
  console.error(error.message);
}
```

## State Machine Definition

Get the complete state machine definition:

```javascript
const definition = orderStateMachine.getStateMachineDefinition();

// Output:
{
  states: ['CREATED', 'VALIDATED', 'CREDIT_RESERVED', 'VENDOR_NOTIFIED', 
           'VENDOR_ACCEPTED', 'VENDOR_REJECTED', 'FULFILLED', 'CANCELLED', 'FAILED'],
  terminalStates: ['FULFILLED', 'CANCELLED', 'FAILED'],
  transitions: { /* allowed transitions map */ },
  requirements: {
    FULFILLED: ['CREDIT_RESERVED']
  },
  getTransition: (from, to) => { /* validation function */ }
}
```

## Database Schema

### order_events Table

```sql
CREATE TABLE order_events (
  id UUID PRIMARY KEY,
  orderId STRING NOT NULL,
  eventType STRING NOT NULL, -- 'STATE_CHANGE'
  payload TEXT, -- JSON with state change details
  timestamp TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_orderId (orderId),
  INDEX idx_eventType (eventType)
);
```

### order_events Query Examples

```sql
-- Get all state changes for an order
SELECT * FROM order_events 
WHERE orderId = 'order-123' 
AND eventType = 'STATE_CHANGE'
ORDER BY timestamp ASC;

-- Find when order entered CREDIT_RESERVED
SELECT * FROM order_events 
WHERE orderId = 'order-123' 
AND payload @> '{"toState":"CREDIT_RESERVED"}';

-- Audit trail for all orders
SELECT 
  orderId,
  payload->'fromState' as fromState,
  payload->'toState' as toState,
  payload->'performedBy' as performedBy,
  timestamp
FROM order_events 
WHERE eventType = 'STATE_CHANGE'
ORDER BY timestamp DESC;
```

## Monitoring & Debugging

### Check Order State History

```javascript
const history = await orderStateMachine.getOrderStateHistory('order-123');
console.table(history);
```

### Verify Transition Possible

```javascript
const result = await orderStateMachine.verifyTransitionPossible('order-123', 'FULFILLED');
console.log(result); // { possible: false, error: '...' }
```

### Get Allowed Next States

```javascript
const allowed = orderStateMachine.getAllowedTransitions('VENDOR_NOTIFIED');
console.log(allowed); // ['VENDOR_ACCEPTED', 'VENDOR_REJECTED', 'FAILED', 'CANCELLED']
```

## Best Practices

1. **Always use the state machine** for state transitions - never update order.status directly
2. **Validate before transitioning** - use `validateTransition()` to check if move is possible
3. **Provide meaningful reasons** - always include a reason for the transition for audit trail
4. **Use atomic transactions** - when combining state change with other operations, use `transitionOrderStatusInTransaction()`
5. **Check state history** - use `getOrderStateHistory()` for debugging state-related issues
6. **Handle errors gracefully** - catch and log validation errors before showing to users

## Testing

### Unit Tests

```javascript
describe('Order State Machine', () => {
  test('VALIDATED → CREDIT_RESERVED should be allowed', () => {
    const allowed = orderStateMachine.isTransitionAllowed('VALIDATED', 'CREDIT_RESERVED');
    expect(allowed).toBe(true);
  });

  test('FULFILLED → VENDOR_ACCEPTED should NOT be allowed', () => {
    const allowed = orderStateMachine.isTransitionAllowed('FULFILLED', 'VENDOR_ACCEPTED');
    expect(allowed).toBe(false);
  });

  test('Cannot fulfill without CREDIT_RESERVED in history', async () => {
    const validation = await orderStateMachine.validateTransition(
      'order-without-credit',
      'VENDOR_ACCEPTED',
      'FULFILLED'
    );
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('CREDIT_RESERVED');
  });
});
```

## Future Enhancements

- Add state machine visualization endpoint (for admin dashboard)
- Implement state-specific actions (hooks) that trigger on each transition
- Add state timeout handling (auto-transition if stuck in state)
- Implement state machine versioning for migrations
- Add webhooks on state changes

---

**Last Updated:** January 21, 2026  
**Implementation Status:** ✅ Production Ready  
**Atomicity Guarantee:** ✅ Full ACID compliance
