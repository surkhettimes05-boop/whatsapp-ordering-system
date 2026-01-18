# Platform Transaction Framework

## Overview
Production-grade transaction wrapper utility that provides:
- **SERIALIZABLE isolation** for strict consistency
- **Automatic deadlock retry** with exponential backoff
- **Failure logging** to WebhookLog for audit trail
- **Automatic rollback** on ANY error

## Usage

### Basic Usage
```javascript
const { withTransaction } = require('../utils/transaction');

const result = await withTransaction(async (tx) => {
  // Your transaction logic here
  const order = await tx.order.create({ ... });
  await tx.orderItem.createMany({ ... });
  return order;
}, {
  operation: 'ORDER_CREATION',
  entityId: null,
  entityType: 'Order',
  timeout: 10000
});
```

### Options
- `operation` (string): Operation name for logging (required)
- `entityId` (string): Entity ID for logging (optional)
- `entityType` (string): Entity type for logging (default: 'Transaction')
- `maxRetries` (number): Maximum retry attempts (default: 3)
- `timeout` (number): Transaction timeout in ms (default: 10000)

## Applied Operations

### ✅ Order Creation
**File**: `backend/src/services/order.service.js`
- Wraps order and order item creation
- Ensures atomicity of order creation

### ✅ Vendor Selection (Decision Engine)
**File**: `backend/src/services/orderDecision.service.js`
- Wraps winner assignment with financial & inventory checks
- Handles credit check, stock reservation, ledger entry creation

### ✅ Stock Reservation
**File**: `backend/src/services/stock.service.js`
- `reserveStock()`: Reserves stock for orders
- `releaseStock()`: Releases reserved stock
- `deductStock()`: Finalizes stock deduction

### ✅ Credit Debit Operations
**File**: `backend/src/services/ledger.service.js`
- `createDebit()`: Creates debit ledger entries
- `createCredit()`: Creates credit ledger entries
- Both use row-level locking for consistency

### ✅ Admin Overrides
**File**: `backend/src/services/admin.service.js`
- `forceSelectVendor()`: Force select vendor with full safety checks
- `forceCancelOrder()`: Cancel order with cleanup
- `extendOrderExpiry()`: Extend order expiry time

## Features

### 1. SERIALIZABLE Isolation
- Highest isolation level
- Prevents phantom reads
- Ensures strict serialization

### 2. Deadlock Retry
- Detects PostgreSQL deadlock errors (40001, 40P01)
- Exponential backoff with jitter
- Maximum 3 retries by default

### 3. Failure Logging
- All failures logged to WebhookLog
- Includes error details, context, and retry attempts
- Separate transaction ensures logging persists

### 4. Automatic Rollback
- Any error triggers automatic rollback
- No partial state possible
- All-or-nothing guarantee

## Error Handling

### Retryable Errors
- Deadlock detected (40001)
- Serialization failure (40P01)
- Any error containing "deadlock" or "serialization" in message

### Non-Retryable Errors
- Validation errors
- Business logic errors
- All other errors

## Examples

See `backend/src/utils/transaction.examples.js` for complete examples:
- Order creation
- Vendor selection
- Credit debit
- Stock reservation
- Admin overrides
- Complex multi-step operations

## Best Practices

1. **Always specify operation name** for better logging
2. **Set appropriate timeout** based on operation complexity
3. **Use row-level locking** for critical sections (SELECT FOR UPDATE)
4. **Keep transactions short** to reduce deadlock probability
5. **Handle errors appropriately** - transaction already rolled back

## Monitoring

Monitor WebhookLog for:
- Transaction failure patterns
- Deadlock frequency
- Retry success rates
- Operation performance

```sql
-- Query transaction failures
SELECT 
  eventType,
  entityType,
  status,
  COUNT(*) as failure_count,
  AVG(retryCount) as avg_retries
FROM webhook_logs
WHERE eventType = 'TRANSACTION_FAILURE'
GROUP BY eventType, entityType, status;
```
