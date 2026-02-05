# Credit Reservation System - Quick Reference

## Available Credit Formula

```
Available = CreditLimit - SUM(ActiveReservations) - SUM(DEBITEntries)
```

## Order Lifecycle & Credit

| Order State | Reservation Status | Notes |
|-------------|-------------------|-------|
| CREATED | (none) | Not yet validated |
| VALIDATED | ACTIVE | Credit is HELD for this order |
| CREDIT_RESERVED | ACTIVE | Credit still on hold |
| VENDOR_ACCEPTED | ACTIVE | Credit still on hold |
| FULFILLED | CONVERTED_TO_DEBIT | Reservation → Ledger DEBIT entry |
| CANCELLED | RELEASED | Credit returned to available pool |
| FAILED | RELEASED | Credit returned to available pool |

## API Usage

### Check if Credit Available

```javascript
const creditService = require('./services/creditReservation.service');

const check = await creditService.canReserveCredit(
    retailerId,
    wholesalerId,
    orderAmount
);

if (!check.canReserve) {
    // REJECT ORDER - insufficient credit
    return { error: check.message };
}
```

### Reserve Credit (on Order Validation)

```javascript
const reservation = await creditService.reserveCredit(
    retailerId,
    wholesalerId,
    orderId,
    orderAmount
);
// Returns: { id, status: 'ACTIVE', ... }
```

### Release Credit (on Cancel/Fail)

```javascript
await creditService.releaseReservation(
    orderId,
    'CANCELLED'  // or 'FAILED'
);
// Updates: status = 'RELEASED', releasedAt = NOW()
```

### Convert to DEBIT (on Fulfillment)

```javascript
const result = await creditService.convertReservationToDebit(
    orderId,
    retailerId,
    wholesalerId,
    orderAmount,
    { dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
);
// Creates: DEBIT ledger entry
// Updates: reservation.status = 'CONVERTED_TO_DEBIT'
```

### Get Available Credit

```javascript
const credit = await creditService.getAvailableCredit(
    retailerId,
    wholesalerId
);

console.log(`Available: ₹${credit.available}`);
console.log(`Limit: ₹${credit.limit}`);
console.log(`Reserved: ₹${credit.reserved}`);
console.log(`Debits: ₹${credit.debits}`);
```

## Order Service Integration

### Validate & Reserve

```javascript
await orderService.validateAndReserveCredit(orderId);
```

### Cancel & Release

```javascript
await orderService.cancelOrderAndReleaseCredit(
    orderId,
    'CANCELLED_BY_RETAILER'
);
```

### Fail & Release

```javascript
await orderService.markOrderFailedAndReleaseCredit(
    orderId,
    'WHOLESALER_OUT_OF_STOCK'
);
```

### Fulfill & Convert

```javascript
await orderService.fulfillOrderAndConvertCredit(orderId);
```

## Database Queries

### All Active Reservations

```sql
SELECT * FROM credit_reservations 
WHERE status = 'ACTIVE'
ORDER BY createdAt DESC;
```

### Total Reserved Credit by Retailer

```sql
SELECT 
    retailerId,
    SUM(reservationAmount) as total_reserved,
    COUNT(*) as active_orders
FROM credit_reservations
WHERE status = 'ACTIVE'
GROUP BY retailerId;
```

### Outstanding Debt (All DEBIT entries)

```sql
SELECT 
    retailerId,
    wholesalerId,
    SUM(amount) as total_debt,
    COUNT(*) as num_debits
FROM ledger_entries
WHERE entryType = 'DEBIT'
GROUP BY retailerId, wholesalerId;
```

### Find Unreleased Reservations (Potential Issues)

```sql
SELECT 
    cr.orderId,
    cr.retailerId,
    cr.wholesalerId,
    cr.reservationAmount,
    o.status as order_status,
    cr.createdAt
FROM credit_reservations cr
JOIN orders o ON cr.orderId = o.id
WHERE cr.status = 'ACTIVE'
  AND o.status IN ('CANCELLED', 'FAILED')
  AND cr.createdAt < NOW() - INTERVAL '1 day';
```

## Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| INSUFFICIENT_CREDIT | No credit available | Reject order or request credit limit increase |
| CREDIT_ACCOUNT_NOT_FOUND | No credit account configured | Admin must set up credit account |
| CREDIT_ACCOUNT_BLOCKED | Account suspended | Admin must unblock |
| RESERVATION_NOT_FOUND | No reservation for order | Possible data inconsistency |
| INVALID_STATE | Trying to convert released reservation | Release already happened |
| WHOLESALER_NOT_ASSIGNED | Order has no wholesaler | Assign wholesaler first |

## Key Formulas

### Available Credit
```
Available = Limit - Reserved - Debits
```

### Utilization
```
Utilization = (Reserved + Debits) / Limit * 100%
```

### Can Proceed
```
CanProceed = (OrderAmount <= Available) AND CreditActive
```

## State Transitions

### Reservation State Diagram
```
        ┌────────────────────────┐
        │                        ↓
    ACTIVE ────────→ RELEASED (cancelled/failed)
        │
        └────────→ CONVERTED_TO_DEBIT (fulfilled)
```

## Deployment Checklist

- [ ] Database migration run: `npx prisma migrate dev`
- [ ] CreditReservation table created
- [ ] Indexes created for performance
- [ ] No errors during migration
- [ ] Can query credit_reservations table
- [ ] Ledger entries still immutable
- [ ] Test full order lifecycle with credit
