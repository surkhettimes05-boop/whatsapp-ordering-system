# Strict Order State Machine - Quick Reference Card

## 9 States (Strict Order)

```
┌─────────┐
│ CREATED │
└────┬────┘
     │
┌────▼──────────┐
│  VALIDATED    │
└────┬──────────┘
     │
┌────▼──────────────┐
│ CREDIT_RESERVED   │
└────┬──────────────┘
     │
┌────▼─────────────┐
│ VENDOR_NOTIFIED  │
└────┬────────┬────┘
     │        │
  ✅ │        │ ❌
     │        │
┌────▼──────────────┐  ┌────────────────┐
│ VENDOR_ACCEPTED   │  │VENDOR_REJECTED │
└────┬──────────────┘  └────┬───────────┘
     │                      │
┌────▼────────┐      ┌──────▼─────┐
│ FULFILLED   │      │ CANCELLED  │
└─────────────┘      └────────────┘

Plus: FAILED (terminal state from anywhere)
```

## Valid Transitions

```
CREATED              → VALIDATED, CANCELLED, FAILED
VALIDATED            → CREDIT_RESERVED, CANCELLED, FAILED
CREDIT_RESERVED      → VENDOR_NOTIFIED, CANCELLED, FAILED
VENDOR_NOTIFIED      → VENDOR_ACCEPTED, VENDOR_REJECTED, CANCELLED, FAILED
VENDOR_ACCEPTED      → FULFILLED, CANCELLED, FAILED
VENDOR_REJECTED      → CANCELLED, FAILED
FULFILLED            → ❌ (Terminal)
CANCELLED            → ❌ (Terminal)
FAILED               → ❌ (Terminal)
```

## Code Snippets

### Transition Status
```javascript
await orderStateMachine.transitionOrderStatus(orderId, 'VALIDATED', {
  reason: 'Items validated'
});
```

### Validate Before Transition
```javascript
const valid = await orderStateMachine.validateTransition(
  orderId, 'VALIDATED', 'CREDIT_RESERVED'
);
```

### Get Allowed Next States
```javascript
const allowed = orderStateMachine.getAllowedTransitions('VENDOR_NOTIFIED');
// ['VENDOR_ACCEPTED', 'VENDOR_REJECTED', 'FAILED', 'CANCELLED']
```

### View State History
```javascript
const history = await orderStateMachine.getOrderStateHistory(orderId);
```

## Key Rules

| Rule | Details |
|------|---------|
| **Atomic** | Status + event + audit all succeed or all fail |
| **Credit Required** | Cannot reach FULFILLED without CREDIT_RESERVED |
| **No Backwards** | Cannot go from FULFILLED to VENDOR_ACCEPTED |
| **Terminal States** | FULFILLED, CANCELLED, FAILED = end of line |
| **Linear Flow** | Must follow allowed transitions sequentially |
| **Logged** | Every transition written to order_events table |

## Error Messages

| Error | Meaning |
|-------|---------|
| "Invalid transition from X to Y" | Transition not in allowed list |
| "Cannot fulfill: CREDIT_RESERVED not found" | Missing credit reservation |
| "Order not found" | Order ID doesn't exist |
| "Already in terminal state" | Order cannot transition further |

## Common Flows

### Success Path
```
CREATED → VALIDATED → CREDIT_RESERVED → VENDOR_NOTIFIED 
→ VENDOR_ACCEPTED → FULFILLED ✅
```

### Vendor Rejects
```
CREATED → VALIDATED → CREDIT_RESERVED → VENDOR_NOTIFIED
→ VENDOR_REJECTED → CANCELLED ✅
```

### Quick Cancel
```
CREATED → CANCELLED ✅
```

### Error Handling
```
[ANY_STATE] → FAILED ✅
```

## Database Queries

### Last 5 State Changes
```sql
SELECT payload->>'toState', timestamp 
FROM order_events 
WHERE orderId = 'order-123'
AND eventType = 'STATE_CHANGE'
ORDER BY timestamp DESC LIMIT 5;
```

### State Duration
```sql
SELECT 
  payload->>'toState' as state,
  COUNT(*) as count
FROM order_events 
WHERE eventType = 'STATE_CHANGE'
GROUP BY payload->>'toState'
ORDER BY count DESC;
```

## API Pattern

```javascript
router.post('/orders/:id/transition', async (req, res) => {
  try {
    const order = await orderStateMachine.transitionOrderStatus(
      req.params.id,
      req.body.targetState,
      { reason: req.body.reason }
    );
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

## Module Functions

| Function | Purpose |
|----------|---------|
| `transitionOrderStatus()` | Change state (atomic) |
| `validateTransition()` | Check if transition possible |
| `getAllowedTransitions()` | Get next states from current |
| `getOrderStateHistory()` | View state change timeline |
| `verifyTransitionPossible()` | Pre-flight check with details |
| `isTransitionAllowed()` | Boolean check |

## Files

| File | Purpose |
|------|---------|
| `orderStateMachine.service.js` | Core state machine logic |
| `order.service.js` | Uses state machine for updates |
| `orderExpiry.processor.js` | Worker using state machine |
| `STRICT_ORDER_STATE_MACHINE.md` | Full documentation |
| `STATE_MACHINE_EXAMPLES.md` | Code examples |
| `ORDER_STATUS_MIGRATION_GUIDE.md` | Schema migration |

## When to Use Each Function

### Creating New Flow
```javascript
// Check what states are available
const allowed = orderStateMachine.getAllowedTransitions(currentState);

// Transition
const updated = await orderStateMachine.transitionOrderStatus(
  orderId, nextState, { reason }
);
```

### Building API Endpoint
```javascript
// Validate first
const validation = await orderStateMachine.validateTransition(
  orderId, null, targetState
);

if (!validation.valid) return res.status(400).json(validation);

// Then transition
const order = await orderStateMachine.transitionOrderStatus(
  orderId, targetState, { reason }
);
```

### Debugging Order Issues
```javascript
// Get full history
const history = await orderStateMachine.getOrderStateHistory(orderId);
console.table(history);

// Check what's next
const allowed = orderStateMachine.getAllowedTransitions(order.status);
```

## Requirements Checklist

- ✅ 9 states (CREATED, VALIDATED, CREDIT_RESERVED, VENDOR_NOTIFIED, VENDOR_ACCEPTED, VENDOR_REJECTED, FULFILLED, CANCELLED, FAILED)
- ✅ Atomic state changes (all-or-nothing)
- ✅ Illegal transitions throw errors
- ✅ Order_events table logging on every change
- ✅ Credit reservation required before FULFILLED
- ✅ Integrated into order.service.js
- ✅ Integrated into worker (orderExpiry.processor)
- ✅ Comprehensive documentation

---

**Last Updated:** January 21, 2026  
**Status:** ✅ Production Ready
