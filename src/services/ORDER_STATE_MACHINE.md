# Order State Machine

## Overview
Hard state machine for order status transitions with:
- **Defined transition map** - Only allowed transitions are permitted
- **Controller-level validation** - Early validation at API layer
- **Database-level validation** - Transaction-level enforcement
- **Audit logging** - All transitions logged to AdminAuditLog

## State Machine Definition

### States
```
CREATED → PENDING_BIDS → CREDIT_APPROVED → STOCK_RESERVED → 
WHOLESALER_ACCEPTED → CONFIRMED → PROCESSING → PACKED → 
OUT_FOR_DELIVERY → SHIPPED → DELIVERED
```

### Terminal States
- `CANCELLED` - No transitions allowed
- `DELIVERED` - Can only transition to `RETURNED`

### Allowed Transitions

| From Status | Allowed To Status |
|------------|-------------------|
| CREATED | PENDING_BIDS, CANCELLED |
| PENDING_BIDS | CREDIT_APPROVED, STOCK_RESERVED, WHOLESALER_ACCEPTED, CANCELLED, FAILED |
| CREDIT_APPROVED | STOCK_RESERVED, WHOLESALER_ACCEPTED, CANCELLED, FAILED |
| STOCK_RESERVED | WHOLESALER_ACCEPTED, CANCELLED, FAILED |
| WHOLESALER_ACCEPTED | CONFIRMED, CANCELLED, FAILED |
| CONFIRMED | PROCESSING, CANCELLED, FAILED |
| PROCESSING | PACKED, CANCELLED, FAILED |
| PACKED | OUT_FOR_DELIVERY, CANCELLED, FAILED |
| OUT_FOR_DELIVERY | SHIPPED, DELIVERED, CANCELLED, FAILED |
| SHIPPED | DELIVERED, RETURNED, CANCELLED, FAILED |
| DELIVERED | RETURNED |
| FAILED | CANCELLED, PENDING_BIDS |
| CANCELLED | (none - terminal) |
| RETURNED | CANCELLED, PENDING_BIDS |

## Usage

### Service Layer

```javascript
const orderStateMachine = require('./orderStateMachine.service');

// Validate transition
const validation = await orderStateMachine.validateTransition(
    orderId,
    null, // Will fetch current status
    'DELIVERED'
);

if (!validation.valid) {
    throw new Error(validation.error);
}

// Transition with validation and logging
const order = await orderStateMachine.transitionOrderStatus(
    orderId,
    'DELIVERED',
    {
        performedBy: 'admin-id',
        reason: 'Order delivered to customer'
    }
);
```

### Within Transaction

```javascript
await withTransaction(async (tx) => {
    // Transition within transaction
    await orderStateMachine.transitionOrderStatusInTransaction(
        tx,
        orderId,
        'WHOLESALER_ACCEPTED',
        {
            performedBy: 'SYSTEM',
            reason: 'Winner selected'
        }
    );
    
    // Other operations...
});
```

### Controller Level

```javascript
// Middleware validates before controller
router.put('/:id/status', 
    isAdmin, 
    validateOrderTransition, // Validates transition
    orderController.updateOrderStatus
);
```

## Validation Layers

### 1. Controller Level (Early Validation)
- Middleware: `validateOrderTransition`
- Validates before service layer
- Returns 400 with detailed error if invalid

### 2. Service Level (Business Logic)
- `orderService.updateOrderStatus()` validates internally
- Uses `orderStateMachine.validateTransition()`
- Throws error if invalid

### 3. Database Level (Transaction Validation)
- Validates within transaction
- Ensures atomicity
- Rolls back if validation fails

## Audit Logging

All transitions are logged to `AdminAuditLog`:

```javascript
{
    adminId: 'admin-id' or null (if SYSTEM),
    action: 'ORDER_STATUS_TRANSITION',
    targetId: orderId,
    targetType: 'Order',
    oldValue: 'PENDING_BIDS',
    newValue: 'WHOLESALER_ACCEPTED',
    reason: 'Winner selected by decision engine',
    metadata: {
        fromStatus: 'PENDING_BIDS',
        toStatus: 'WHOLESALER_ACCEPTED',
        performedBy: 'SYSTEM',
        timestamp: '2024-01-15T10:30:00Z'
    }
}
```

## Error Handling

### Invalid Transition
```json
{
    "error": "Invalid transition from DELIVERED to PROCESSING. Allowed transitions: RETURNED",
    "type": "STATE_MACHINE_VALIDATION_ERROR",
    "currentStatus": "DELIVERED",
    "targetStatus": "PROCESSING",
    "allowedTransitions": ["RETURNED"]
}
```

### Terminal State
```json
{
    "error": "Invalid transition from CANCELLED to PROCESSING. Allowed transitions: none (terminal state)",
    "type": "STATE_MACHINE_VALIDATION_ERROR",
    "currentStatus": "CANCELLED",
    "targetStatus": "PROCESSING",
    "allowedTransitions": []
}
```

## API Endpoints

### Get Allowed Transitions
```
GET /api/v1/orders/:id/transitions
```

Response:
```json
{
    "orderId": "order-123",
    "currentStatus": "PENDING_BIDS",
    "isTerminal": false,
    "allowedTransitions": [
        "CREDIT_APPROVED",
        "STOCK_RESERVED",
        "WHOLESALER_ACCEPTED",
        "CANCELLED",
        "FAILED"
    ],
    "stateMachine": {
        "states": [...],
        "terminalStates": [...],
        "transitions": {...}
    }
}
```

### Update Order Status
```
PUT /api/v1/orders/:id/status
Body: {
    "status": "DELIVERED",
    "reason": "Order delivered to customer"
}
```

## Integration Points

### Order Decision Engine
- Uses `transitionOrderStatusInTransaction()` when selecting winner
- Transitions to `WHOLESALER_ACCEPTED` after all checks pass

### Order Service
- `updateOrderStatus()` validates and transitions
- Handles stock operations based on status

### Admin Controller
- Admin status updates go through state machine
- All transitions logged

## Best Practices

1. **Always use state machine** - Don't update status directly
2. **Validate early** - Use middleware for early validation
3. **Log all transitions** - Every transition is audited
4. **Handle terminal states** - Check if state is terminal before attempting transition
5. **Use transactions** - Ensure atomicity with other operations

## Testing

### Unit Tests
- Test all valid transitions
- Test invalid transitions
- Test terminal states
- Test validation logic

### Integration Tests
- Test transition with stock operations
- Test transition with ledger operations
- Test audit logging
- Test rollback on validation failure

## Monitoring

### Key Metrics
- Transition success rate
- Invalid transition attempts
- Terminal state violations
- Transition frequency by status

### Alerts
- Invalid transition attempts
- Terminal state violations
- High transition failure rate
- Missing audit logs
