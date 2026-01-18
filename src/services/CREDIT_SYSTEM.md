# Fintech-Grade Credit System

## Overview
Production-grade credit management system with:
- **CreditAccount per retailer-wholesaler pair**
- **Immutable CreditLedger entries**
- **Balance calculated from ledger (not stored)**
- **Credit limit enforcement BEFORE order assignment**
- **Daily exposure reports per wholesaler**

## Architecture

### Models

#### RetailerWholesalerCredit
- One credit account per retailer-wholesaler pair
- Fields: `creditLimit`, `creditTerms`, `interestRate`, `isActive`
- Unique constraint on `(retailerId, wholesalerId)`

#### LedgerEntry
- Immutable append-only ledger
- Entry types: `DEBIT`, `CREDIT`, `ADJUSTMENT`, `REVERSAL`
- Balance calculated from entries (not stored, but `balanceAfter` cached for performance)

## Ledger Entry Types

### DEBIT
- Retailer owes money
- Created when order is assigned/delivered
- Increases balance

### CREDIT
- Retailer pays money
- Created when payment received
- Decreases balance

### ADJUSTMENT
- Manual adjustment by admin
- Can be positive (increase debt) or negative (decrease debt)
- Used for corrections, discounts, etc.

### REVERSAL
- Reverses a previous entry
- Requires `referenceId` of original entry
- Negates the effect of original entry

## Balance Calculation

Balance is **calculated**, not stored:

```javascript
let balance = 0;
for (const entry of entries) {
    switch (entry.entryType) {
        case 'DEBIT':
            balance += amount;
            break;
        case 'CREDIT':
            balance -= amount;
            break;
        case 'ADJUSTMENT':
            balance += amount; // Can be positive or negative
            break;
        case 'REVERSAL':
            balance -= amount; // Negates original entry
            break;
    }
}
```

**Note**: `balanceAfter` is stored in ledger entries for performance, but the authoritative balance is always calculated from all entries.

## Credit Limit Enforcement

### Before Order Assignment
Credit limit is checked **BEFORE** finalizing vendor selection:

```javascript
// In orderDecision.service.js
const creditCheck = await creditService.checkCreditLimit(
    retailerId,
    wholesalerId,
    orderAmount
);

if (!creditCheck.canPlace) {
    throw new Error(`Credit limit exceeded: ${creditCheck.reason}`);
}
```

### Check Includes:
1. Credit account exists and is active
2. No active credit holds
3. Projected balance (current + order amount) <= credit limit
4. No overdue payments (optional, can be configured)

## Services

### CreditService (`credit.service.js`)

#### Methods:
- `calculateBalance(retailerId, wholesalerId)` - Calculate balance from ledger
- `getOrCreateCreditAccount(retailerId, wholesalerId)` - Get/create credit account
- `checkCreditLimit(retailerId, wholesalerId, orderAmount)` - Check if order can be placed
- `createLedgerEntry(...)` - Create immutable ledger entry
- `getDailyExposureReport(wholesalerId, asOfDate)` - Get exposure report
- `getExposureSummary(wholesalerId, asOfDate)` - Get summary statistics

### Middleware (`creditLimit.middleware.js`)

- `enforceCreditLimit` - Express middleware for credit limit checks
- `checkCreditLimitService` - Service-level credit check

## API Endpoints

### Balance Queries
```
GET /api/v1/credit/balance/:retailerId/:wholesalerId
GET /api/v1/credit/account/:retailerId/:wholesalerId
```

### Credit Limit Checks
```
POST /api/v1/credit/check-limit
Body: { retailerId, wholesalerId, orderAmount }
```

### Exposure Reports
```
GET /api/v1/credit/exposure/:wholesalerId?date=2024-01-15
```

### Ledger Entry Management (Admin)
```
POST /api/v1/credit/ledger-entry
Body: { retailerId, wholesalerId, entryType, amount, orderId?, dueDate?, reason? }
```

### Credit Account Management (Admin)
```
PUT /api/v1/credit/account/:retailerId/:wholesalerId
Body: { creditLimit, creditTerms?, interestRate?, isActive?, blockedReason? }
```

## Daily Exposure Report

### Report Structure
```javascript
{
    summary: {
        wholesalerId,
        asOfDate,
        totalRetailers,
        totalExposure,
        totalOverdue,
        totalCreditLimit,
        totalAvailableCredit,
        averageUtilizationPercent,
        retailersAtLimit,
        retailersOverdue
    },
    details: [
        {
            retailerId,
            retailerName,
            phoneNumber,
            city,
            creditLimit,
            currentBalance,
            overdueAmount,
            availableCredit,
            utilizationPercent,
            creditTerms,
            isBlocked,
            blockedReason
        }
    ]
}
```

### Use Cases
- Daily risk assessment
- Identify retailers at credit limit
- Track overdue amounts
- Monitor exposure trends

## Integration Points

### Order Decision Engine
- Credit check happens in `orderDecision.service.js` before finalizing winner
- Uses `creditService.checkCreditLimit()`
- Transaction rolls back if credit check fails

### Stock Reservation
- Credit check happens before stock reservation
- Ensures retailer can pay before reserving inventory

### Payment Processing
- Creates CREDIT ledger entry when payment received
- Updates balance automatically

## Best Practices

1. **Always calculate balance from entries** - Don't rely solely on `balanceAfter`
2. **Check credit limit BEFORE order assignment** - Fail fast
3. **Use transactions** - All ledger operations are atomic
4. **Log all adjustments** - Use ADJUSTMENT entries for corrections
5. **Monitor exposure daily** - Use exposure reports for risk management

## Error Handling

### Credit Limit Exceeded
```json
{
    "error": "Credit limit exceeded",
    "reason": "Current balance: Rs.50000, Credit limit: Rs.50000, Order amount: Rs.10000",
    "currentBalance": 50000,
    "creditLimit": 50000,
    "availableCredit": 0
}
```

### Credit Account Blocked
```json
{
    "error": "Credit account is blocked",
    "reason": "Overdue payments",
    "currentBalance": 50000,
    "creditLimit": 100000
}
```

## Testing

### Unit Tests
- Test balance calculation with all entry types
- Test credit limit enforcement
- Test exposure report generation

### Integration Tests
- Test order assignment with credit limit
- Test ledger entry creation
- Test balance calculation accuracy

## Monitoring

### Key Metrics
- Credit limit utilization
- Overdue amounts
- Exposure per wholesaler
- Ledger entry volume

### Alerts
- Retailer approaching credit limit (>90%)
- Overdue payments
- High exposure per wholesaler
- Failed credit checks
