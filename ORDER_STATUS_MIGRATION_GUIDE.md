# Order Status Migration - Update Prisma Schema

## Overview

This guide explains how to update your Prisma schema to support the new strict order state machine with the new OrderStatus enum values.

## Current vs New States

### Old OrderStatus Enum
```prisma
enum OrderStatus {
  CREATED
  PENDING_BIDS
  CREDIT_APPROVED
  STOCK_RESERVED
  WHOLESALER_ACCEPTED
  CONFIRMED
  PROCESSING
  PACKED
  OUT_FOR_DELIVERY
  SHIPPED
  DELIVERED
  FAILED
  CANCELLED
  RETURNED
}
```

### New OrderStatus Enum (Strict State Machine)
```prisma
enum OrderStatus {
  CREATED
  VALIDATED
  CREDIT_RESERVED
  VENDOR_NOTIFIED
  VENDOR_ACCEPTED
  VENDOR_REJECTED
  FULFILLED
  CANCELLED
  FAILED
}
```

## Migration Steps

### Step 1: Update Prisma Schema

Edit `prisma/schema.prisma`:

```prisma
enum OrderStatus {
  CREATED
  VALIDATED
  CREDIT_RESERVED
  VENDOR_NOTIFIED
  VENDOR_ACCEPTED
  VENDOR_REJECTED
  FULFILLED
  CANCELLED
  FAILED
}
```

### Step 2: Create Migration

Run the Prisma migration command:

```bash
npx prisma migrate dev --name update_order_status_enum
```

This will:
1. Generate a migration file
2. Ask for manual intervention if needed (e.g., data migration)
3. Apply the migration to your database

### Step 3: Handle Data Migration (if database has existing orders)

If you have existing orders in the database, you'll need to migrate them:

**Create `prisma/migrations/[timestamp]_migrate_order_statuses/migration.sql`:**

```sql
-- Map old statuses to new ones
BEGIN;

-- PENDING_BIDS → VALIDATED
UPDATE orders SET status = 'VALIDATED' WHERE status = 'PENDING_BIDS';

-- CREDIT_APPROVED → CREDIT_RESERVED
UPDATE orders SET status = 'CREDIT_RESERVED' WHERE status = 'CREDIT_APPROVED';

-- STOCK_RESERVED → CREDIT_RESERVED (same concept)
UPDATE orders SET status = 'CREDIT_RESERVED' WHERE status = 'STOCK_RESERVED';

-- WHOLESALER_ACCEPTED → VENDOR_ACCEPTED
UPDATE orders SET status = 'VENDOR_ACCEPTED' WHERE status = 'WHOLESALER_ACCEPTED';

-- CONFIRMED → VENDOR_ACCEPTED (already accepted)
UPDATE orders SET status = 'VENDOR_ACCEPTED' WHERE status = 'CONFIRMED';

-- PROCESSING, PACKED, SHIPPED → VENDOR_ACCEPTED (in transit, not fulfilled yet)
UPDATE orders SET status = 'VENDOR_ACCEPTED' WHERE status IN ('PROCESSING', 'PACKED', 'SHIPPED');

-- OUT_FOR_DELIVERY → VENDOR_ACCEPTED (still not fulfilled)
UPDATE orders SET status = 'VENDOR_ACCEPTED' WHERE status = 'OUT_FOR_DELIVERY';

-- DELIVERED → FULFILLED
UPDATE orders SET status = 'FULFILLED' WHERE status = 'DELIVERED';

-- RETURNED → CANCELLED
UPDATE orders SET status = 'CANCELLED' WHERE status = 'RETURNED';

COMMIT;
```

### Step 4: Update Enum Values in Database

```bash
npx prisma migrate deploy
```

### Step 5: Generate Prisma Client

```bash
npx prisma generate
```

## Alternative: Blue-Green Deployment

If you want to keep the old status values while supporting the new state machine:

### Option A: Keep Both Enums

Create a mapping layer:

```javascript
// state-migration.js
const STATUS_MAPPING = {
  // Old → New
  'PENDING_BIDS': 'VALIDATED',
  'CREDIT_APPROVED': 'CREDIT_RESERVED',
  'STOCK_RESERVED': 'CREDIT_RESERVED',
  'WHOLESALER_ACCEPTED': 'VENDOR_ACCEPTED',
  'CONFIRMED': 'VENDOR_ACCEPTED',
  'PROCESSING': 'VENDOR_ACCEPTED',
  'PACKED': 'VENDOR_ACCEPTED',
  'OUT_FOR_DELIVERY': 'VENDOR_ACCEPTED',
  'SHIPPED': 'VENDOR_ACCEPTED',
  'DELIVERED': 'FULFILLED',
  'RETURNED': 'CANCELLED',
  'FAILED': 'FAILED',
  'CANCELLED': 'CANCELLED'
};

function mapOldStatusToNew(oldStatus) {
  return STATUS_MAPPING[oldStatus] || oldStatus;
}

module.exports = { mapOldStatusToNew, STATUS_MAPPING };
```

Use this in queries:

```javascript
async function getOrdersWithNewStatus(filter = {}) {
  const orders = await prisma.order.findMany({
    where: filter,
    select: { id: true, status: true }
  });

  return orders.map(order => ({
    ...order,
    newStatus: mapOldStatusToNew(order.status),
    mappedStatus: true
  }));
}
```

## Verification Steps

### 1. Check Enum Updated

```bash
# Should show new values
npx prisma introspect | grep -A 10 OrderStatus
```

### 2. Validate Existing Orders

```sql
-- Check for unmapped statuses
SELECT DISTINCT status FROM orders;
-- Should return: CREATED, VALIDATED, CREDIT_RESERVED, VENDOR_NOTIFIED, 
--                VENDOR_ACCEPTED, VENDOR_REJECTED, FULFILLED, CANCELLED, FAILED
```

### 3. Test State Machine

```javascript
const orderStateMachine = require('./services/orderStateMachine.service');

// Should work with new states
const validation = await orderStateMachine.validateTransition(
  'order-id',
  'VALIDATED',
  'CREDIT_RESERVED'
);

console.log('✓ State machine working:', validation.valid);
```

### 4. Check order_events Table

```sql
-- Verify order_events table exists
SELECT * FROM order_events LIMIT 1;

-- Should have state_change events with new states
SELECT * FROM order_events 
WHERE eventType = 'STATE_CHANGE'
ORDER BY timestamp DESC
LIMIT 5;
```

## Rollback Plan

If you need to rollback:

```bash
# Rollback last migration
npx prisma migrate resolve --rolled-back <migration-name>

# Or reset to previous migration
npx prisma migrate resolve --rolled-back [timestamp]_update_order_status_enum
```

## Production Checklist

- [ ] Backup database before migration
- [ ] Test migration in staging environment
- [ ] Update all state machine imports
- [ ] Update worker processors
- [ ] Update API endpoints
- [ ] Update tests to use new states
- [ ] Update documentation
- [ ] Deploy migration first, then application
- [ ] Monitor logs for state transition errors
- [ ] Verify order_events table is logging state changes

## Code Changes Required

### 1. Order Service

Already updated in the implementation. No changes needed.

### 2. Worker Processors

Example update for `orderExpiry.processor.js`:

```javascript
// Already done in the implementation
const updatedOrder = await orderStateMachine.transitionOrderStatus(
  orderId,
  'CANCELLED',
  { reason: 'Order expired' }
);
```

### 3. API Endpoints

Update any hardcoded status checks:

```javascript
// Before
if (order.status === 'DELIVERED') { ... }

// After
if (order.status === 'FULFILLED') { ... }

// Before
if (order.status === 'OUT_FOR_DELIVERY') { ... }

// After
// This is no longer a valid state - handle differently
const history = await orderStateMachine.getOrderStateHistory(orderId);
const isOutForDelivery = history.some(e => e.toState === 'OUT_FOR_DELIVERY');
```

### 4. Tests

Update test fixtures:

```javascript
// Before
const order = await prisma.order.create({
  data: { status: 'PENDING_BIDS' }
});

// After
const order = await prisma.order.create({
  data: { status: 'VALIDATED' }
});
```

## Common Issues & Solutions

### Issue: "Unknown enum value"

**Problem:** Code is still using old enum values

**Solution:** 
```bash
npm run build  # Rebuild with new Prisma schema
npm run test   # Run tests to catch issues
```

### Issue: Foreign key constraint violation

**Problem:** Some table still references old enum values

**Solution:**
1. Check which columns reference OrderStatus
2. Update those columns in the migration
3. Or keep a compatibility layer using the mapping

### Issue: Worker processors crashing

**Problem:** Processors trying to transition to old states

**Solution:**
Update all processors to use new states:
```javascript
// Update all occurrences
const oldStates = ['PENDING_BIDS', 'STOCK_RESERVED', 'DELIVERED'];
const newMapping = {
  'PENDING_BIDS': 'VALIDATED',
  'STOCK_RESERVED': 'CREDIT_RESERVED',
  'DELIVERED': 'FULFILLED'
};
```

## Testing the Migration

### Integration Test

```javascript
describe('Order Status Migration', () => {
  test('Can transition with new states', async () => {
    const order = await prisma.order.create({
      data: { retailerId: 'test', totalAmount: 1000, status: 'CREATED' }
    });

    const updated = await orderStateMachine.transitionOrderStatus(
      order.id,
      'VALIDATED',
      { reason: 'Test migration' }
    );

    expect(updated.status).toBe('VALIDATED');
  });

  test('State history is recorded', async () => {
    const history = await orderStateMachine.getOrderStateHistory(order.id);
    expect(history).toContainEqual(expect.objectContaining({
      fromState: 'CREATED',
      toState: 'VALIDATED'
    }));
  });
});
```

## References

- [Prisma Enum Migration](https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#enum)
- [Strict Order State Machine](./STRICT_ORDER_STATE_MACHINE.md)
- [State Machine Examples](./STATE_MACHINE_EXAMPLES.md)

---

**Migration Status:** Ready for Production  
**Last Updated:** January 21, 2026
