# Credit & Ledger System Documentation

## Overview

This is a complete **append-only credit and ledger system** for managing per-wholesaler credit limits and payment tracking. The system is designed for B2B wholesale ordering where retailers purchase on credit.

### Key Features

✅ **Per-Wholesaler Credit Limits** - Each retailer has different credit terms with each wholesaler
✅ **Append-Only Ledger** - Immutable transaction history (no edits/deletes)
✅ **Automatic Balance Calculation** - Balance = SUM(DEBIT) - SUM(CREDIT)
✅ **Order Blocking** - Orders automatically blocked if credit exceeded
✅ **Payment Tracking** - Cash, cheque, bank transfer, UPI support
✅ **Due Date Tracking** - Automatic calculation based on credit terms
✅ **Credit Holds** - Admin can block credit for overdue payments
✅ **Ledger Integrity** - Built-in verification to detect double-entries

---

## Business Rules

### 1. Credit Balance Calculation
```
Outstanding Balance = SUM(All DEBIT entries) - SUM(All CREDIT entries) + SUM(ADJUSTMENT entries)
```

**Key Point:** Balance is **calculated on-the-fly** from ledger entries, never stored directly.

### 2. DEBIT Entry (Order Delivery)
- Created automatically when order is delivered
- Amount = Order total
- Due date = Order date + credit terms (e.g., 30 days)
- Retailer's outstanding balance increases

### 3. CREDIT Entry (Payment Received)
- Created when payment is received/cleared
- Amount = Payment amount
- Retailer's outstanding balance decreases
- Supports partial payments

### 4. ADJUSTMENT Entry (Admin Override)
- Created when admin makes manual corrections
- Can be positive or negative
- Requires: Admin approval + clear reason
- Use cases: Writeoffs, disputes, corrections

### 5. Order Blocking
Order is blocked if:
- `(Current Balance + Order Amount) > Credit Limit`
- Credit is marked as inactive (blocked)
- Active credit hold exists
- Overdue payments from previous orders exist

---

## Database Schema

### Core Tables

#### `RetailerWholesalerCredit`
```sql
-- Per-wholesaler credit configuration
CREATE TABLE RetailerWholesalerCredit (
  id              STRING PRIMARY KEY,
  retailerId      STRING NOT NULL,
  wholesalerId    STRING NOT NULL,
  creditLimit     DECIMAL (e.g., 50000),
  creditTerms     INT (e.g., 30 days),
  interestRate    DECIMAL (optional, for overdue),
  isActive        BOOL,
  blockedReason   STRING (if blocked),
  createdAt       DATETIME,
  updatedAt       DATETIME,
  
  UNIQUE(retailerId, wholesalerId)
);
```

**Example:**
- Retailer A's credit limit with Wholesaler X: ₹50,000 (30 days)
- Retailer A's credit limit with Wholesaler Y: ₹30,000 (15 days)
- Each wholesaler has different terms

#### `CreditLedgerEntry` (Append-Only)
```sql
CREATE TABLE CreditLedgerEntry (
  id              STRING PRIMARY KEY,
  retailerId      STRING NOT NULL,
  wholesalerId    STRING NOT NULL,
  entryType       STRING, -- DEBIT | CREDIT | ADJUSTMENT
  amount          DECIMAL NOT NULL,
  orderId         STRING, -- If from order delivery
  paymentId       STRING, -- If from payment
  dueDate         DATETIME, -- For DEBIT only
  description     STRING, -- Business context
  approvalNotes   STRING, -- For adjustments
  approvedBy      STRING, -- Admin user ID
  createdAt       DATETIME NOT NULL,
  
  INDEX(retailerId),
  INDEX(wholesalerId),
  INDEX(createdAt)
);
```

**IMMUTABLE:** Once created, never edited or deleted. Only INSERT operations allowed.

#### `RetailerPayment`
```sql
CREATE TABLE RetailerPayment (
  id              STRING PRIMARY KEY,
  retailerId      STRING NOT NULL,
  wholesalerId    STRING NOT NULL,
  amount          DECIMAL NOT NULL,
  paymentMode     STRING, -- CASH | CHEQUE | BANK_TRANSFER | UPI
  chequeNumber    STRING, -- If cheque
  chequeDate      DATETIME,
  bankName        STRING,
  status          STRING, -- PENDING | CLEARED | BOUNCED | CANCELLED
  clearedDate     DATETIME,
  ledgerEntryId   STRING, -- Links to CreditLedgerEntry (CREDIT)
  notes           STRING,
  createdAt       DATETIME,
  updatedAt       DATETIME
);
```

#### `CreditHoldHistory`
```sql
CREATE TABLE CreditHoldHistory (
  id              STRING PRIMARY KEY,
  retailerId      STRING NOT NULL,
  wholesalerId    STRING NOT NULL,
  holdReason      STRING, -- LIMIT_EXCEEDED | OVERDUE_PAYMENT | ADMIN_ACTION
  notes           STRING,
  isActive        BOOL,
  releasedAt      DATETIME,
  releasedBy      STRING, -- Admin ID
  releasedReason  STRING,
  createdAt       DATETIME
);
```

---

## API Endpoints

### Base URL
```
/api/v1/credit-ledger
```

### 1. Get Outstanding Balance
```
GET /balance/:retailerId/:wholesalerId

Response:
{
  "success": true,
  "retailerId": "ret123",
  "wholesalerId": "wh456",
  "balance": 45000,
  "totalDebits": 95000,
  "totalCredits": 50000,
  "adjustments": 0,
  "entries": [...]
}
```

### 2. Check if Order Can Be Placed
```
GET /check-order?retailerId=ret123&wholesalerId=wh456&amount=10000

Response (CAN PLACE):
{
  "success": true,
  "canPlace": true,
  "reason": "Credit check passed",
  "currentBalance": 45000,
  "creditLimit": 50000,
  "availableCredit": 5000,
  "creditTerms": 30
}

Response (BLOCKED):
{
  "success": true,
  "canPlace": false,
  "reason": "Credit limit exceeded. Order would bring balance to 55000, limit is 50000",
  "currentBalance": 45000,
  "projectedBalance": 55000,
  "creditLimit": 50000,
  "availableCredit": 5000
}
```

### 3. Setup/Update Credit Limit (ADMIN)
```
POST /setup
{
  "retailerId": "ret123",
  "wholesalerId": "wh456",
  "creditLimit": 50000,
  "creditTerms": 30,
  "interestRate": 2.5
}

Response:
{
  "success": true,
  "message": "Credit limit configured",
  "data": { ... }
}
```

### 4. Record Payment (ADMIN)
```
POST /payment
{
  "retailerId": "ret123",
  "wholesalerId": "wh456",
  "amount": 10000,
  "paymentMode": "CHEQUE",
  "chequeNumber": "CHQ-2025-001",
  "bankName": "State Bank of India",
  "notes": "Payment for orders from Jan"
}

Response:
{
  "success": true,
  "message": "Payment recorded",
  "data": {
    "payment": { ... },
    "ledgerEntry": null  // CREDIT entry created only after cheque clears
  }
}
```

### 5. Make Credit Adjustment (ADMIN ONLY)
```
POST /adjustment
{
  "retailerId": "ret123",
  "wholesalerId": "wh456",
  "amount": -5000,  // Negative = write-off
  "reason": "Damaged goods writeoff",
  "notes": "As approved by MD on 2025-01-15"
}

Response:
{
  "success": true,
  "message": "Credit adjustment recorded",
  "data": { ... }
}
```

### 6. Get Full Ledger History
```
GET /:retailerId/:wholesalerId?type=DEBIT&limit=50&skip=0

Response:
{
  "success": true,
  "retailerId": "ret123",
  "wholesalerId": "wh456",
  "count": 23,
  "data": [
    {
      "id": "ledg789",
      "entryType": "DEBIT",
      "amount": 5000,
      "dueDate": "2025-02-15",
      "description": "Order #ord123 delivered (5 items)",
      "createdAt": "2025-01-15"
    },
    ...
  ]
}
```

### 7. Get Comprehensive Credit Report
```
GET /report/:retailerId

Response:
{
  "success": true,
  "data": {
    "retailerId": "ret123",
    "wholesalers": [
      {
        "wholesalerId": "wh456",
        "wholesalerName": "Fresh Supplies Co",
        "creditLimit": 50000,
        "creditTerms": 30,
        "outstandingBalance": 45000,
        "availableCredit": 5000,
        "isBlocked": false,
        "activeHolds": 0,
        "overdueAmount": 0,
        "overdueEntries": 0
      },
      ...
    ]
  }
}
```

### 8. Place Credit Hold (ADMIN)
```
POST /hold
{
  "retailerId": "ret123",
  "wholesalerId": "wh456",
  "reason": "OVERDUE_PAYMENT",
  "notes": "Invoice #INV-001 is 45 days overdue"
}

Response:
{
  "success": true,
  "message": "Credit hold placed",
  "data": { ... }
}
```

### 9. Release Credit Hold (ADMIN)
```
POST /hold/:holdId/release
{
  "reason": "Payment received for overdue invoice"
}

Response:
{
  "success": true,
  "message": "Credit hold released",
  "data": { ... }
}
```

### 10. Clear Pending Cheque
```
POST /clear-cheque/:paymentId

Response:
{
  "success": true,
  "message": "Cheque cleared and credited",
  "data": {
    "payment": { status: "CLEARED", ... },
    "ledgerEntry": { entryType: "CREDIT", ... }
  }
}
```

### 11. Bounce Cheque
```
POST /bounce-cheque/:paymentId

Response:
{
  "success": true,
  "message": "Cheque marked as bounced",
  "data": { status: "BOUNCED", ... }
}
```

---

## Integration with Order Placement

### Order Creation Flow

```javascript
// 1. Retailer initiates order via WhatsApp
POST /api/v1/orders/create

// 2. Middleware checks credit BEFORE creating order
const checkCreditBeforeOrder = (req, res, next) => {
  const check = await creditCheckService.canPlaceOrder(
    retailerId,
    wholesalerId,
    orderAmount
  );
  
  if (!check.canPlace) {
    res.status(403).json({
      error: "Order blocked: " + check.reason
    });
    return;
  }
  
  next(); // Proceed to create order
};

// 3. Order is created
// 4. When order is delivered, create DEBIT ledger entry
await ledgerService.recordOrderDelivery(orderId);

// 5. When payment received, create CREDIT ledger entry
await ledgerService.recordPayment(retailerId, wholesalerId, amount, mode);
```

### Integration Code
```javascript
// In your order controller
const { checkCreditBeforeOrder } = require('../middleware/creditCheck.middleware');

router.post('/create-order',
  checkCreditBeforeOrder,  // Add this middleware
  async (req, res) => {
    // Create order...
  }
);

// When order is delivered
router.post('/:orderId/deliver', async (req, res) => {
  // ... update order status
  
  // Create debit ledger entry
  await ledgerService.recordOrderDelivery(orderId);
  
  res.json({ success: true });
});
```

---

## Service Layer

### CreditCheckService
```javascript
const creditCheckService = require('../services/creditCheck.service');

// Get current balance
const balance = await creditCheckService.getOutstandingBalance(
  retailerId, 
  wholesalerId
);

// Check if order can be placed
const check = await creditCheckService.canPlaceOrder(
  retailerId,
  wholesalerId,
  orderAmount
);

// Get overdue entries
const overdue = await creditCheckService.getOverdueEntries(
  retailerId,
  wholesalerId
);

// Place hold
await creditCheckService.placeCreditHold(
  retailerId,
  wholesalerId,
  'OVERDUE_PAYMENT',
  { notes: 'Invoice overdue by 30 days' }
);

// Release hold
await creditCheckService.releaseCreditHold(
  holdId,
  adminUserId,
  'Payment received'
);

// Get full credit report
const report = await creditCheckService.getCreditReport(retailerId);
```

### LedgerService
```javascript
const ledgerService = require('../services/ledgerEntry.service');

// Record order delivery (creates DEBIT)
const debit = await ledgerService.recordOrderDelivery(orderId);

// Record payment (creates CREDIT)
const result = await ledgerService.recordPayment(
  retailerId,
  wholesalerId,
  amount,
  'CASH',
  { approvedBy: adminId }
);

// Get ledger history
const entries = await ledgerService.getLedger(
  retailerId,
  wholesalerId,
  { type: 'DEBIT', limit: 50 }
);

// Verify ledger integrity
const health = await ledgerService.verifyLedgerIntegrity(
  retailerId,
  wholesalerId
);
```

---

## Business Examples

### Example 1: Order Placement with Credit Check

```
Scenario:
- Retailer: Gupta Store (ret001)
- Wholesaler: Fresh Supplies (wh001)
- Credit Limit: ₹50,000
- Current Balance: ₹45,000
- Available Credit: ₹5,000

Action: Customer orders ₹7,000 worth of goods

Result: ORDER BLOCKED
Reason: Projected balance (45,000 + 7,000 = 52,000) > limit (50,000)
```

### Example 2: Payment & Ledger Tracking

```
Timeline:
Jan 15: Order #ORD001 = ₹5,000 delivered
  → Creates DEBIT entry (due Jan 45, i.e., Feb 14)
  → Balance: ₹5,000

Jan 20: Order #ORD002 = ₹8,000 delivered
  → Creates DEBIT entry (due Feb 19)
  → Balance: ₹13,000

Jan 25: Payment of ₹10,000 received via NEFT
  → Creates CREDIT entry immediately
  → Balance: ₹3,000 (13,000 - 10,000)

Jan 28: Cheque #CHQ001 of ₹5,000 received
  → Status: PENDING (not credited yet)
  → Balance: Still ₹3,000

Feb 5: Cheque clears
  → Creates CREDIT entry
  → Balance: -₹2,000 (means retailer is in advance)
```

### Example 3: Admin Adjustment

```
Scenario:
- Retailer received damaged goods worth ₹2,000
- Admin approves writeoff

Action:
POST /adjustment
{
  "amount": -2000,
  "reason": "Damaged goods - invoice INV-123"
}

Result:
- Creates ADJUSTMENT entry (amount: -2000)
- Balance decreases by 2000
- Complete audit trail preserved
```

---

## Important Notes

### ⚠️ Immutability
- **Ledger entries can NEVER be edited or deleted**
- Only solution to wrong entry is to create an ADJUSTMENT entry
- This ensures complete audit trail and prevents fraud

### ⚠️ Balance Calculation
```javascript
// CORRECT - Always recalculate from ledger
const balance = debits - credits + adjustments;

// WRONG - Never trust a stored balance field
const balance = creditAccount.usedCredit;
```

### ⚠️ Order Blocking
```javascript
// MUST check before confirming order
const check = await creditCheckService.canPlaceOrder(
  retailerId,
  wholesalerId,
  orderAmount
);

if (!check.canPlace) {
  // Block order and notify retailer
  return notifyRetailerCredit LimitExceeded(retailerId);
}
```

### ⚠️ Cheque Handling
- Payment recorded immediately with status PENDING
- Ledger CREDIT entry created only after cheque clears
- If cheque bounces, mark as BOUNCED (don't reverse)
- Create a credit hold to prevent further orders

---

## Monitoring & Auditing

### Health Check
```javascript
// Daily: Check for ledger integrity
const health = await ledgerService.verifyLedgerIntegrity(
  retailerId,
  wholesalerId
);

if (health.issues.length > 0) {
  // Alert admin to investigate
  sendAlert(health.issues);
}
```

### Reports to Run

1. **Overdue Report** - Find all payments overdue by 15+ days
2. **At-Risk Report** - Retailers with 80%+ credit utilization
3. **Ledger Audit** - All adjustments with approvals
4. **Payment Tracking** - Pending cheques and due dates
5. **Credit Holds** - All active holds and their reasons

---

## Troubleshooting

### Q: Order is being blocked but balance looks low
**A:** Check for active credit holds or overdue payments:
```javascript
const holds = await prisma.creditHoldHistory.findMany({
  where: { retailerId, isActive: true }
});
const overdue = await creditCheckService.getOverdueEntries(
  retailerId,
  wholesalerId
);
```

### Q: Payment was recorded but balance didn't change
**A:** Check payment status:
```javascript
const payment = await prisma.retailerPayment.findUnique({
  where: { id: paymentId }
});

if (payment.status === 'PENDING') {
  // Cheque not cleared yet
  // CREDIT entry created only after clearing
}
```

### Q: Ledger shows entries but balance is wrong
**A:** Verify ledger integrity:
```javascript
const result = await ledgerService.verifyLedgerIntegrity(
  retailerId,
  wholesalerId
);

if (result.issues.length > 0) {
  // Found data corruption, contact admin
}
```

---

## Implementation Checklist

- [ ] Database migration applied
- [ ] Credit service deployed
- [ ] Ledger service deployed
- [ ] Credit middleware added to order routes
- [ ] API routes mounted in app.js
- [ ] Auth middleware configured for admin endpoints
- [ ] Admin UI created for credit management
- [ ] Order blocking tested
- [ ] Payment recording tested
- [ ] Ledger queries verified
- [ ] Credit report tested
- [ ] Hold/release functionality tested

---

## Support

For questions or issues:
1. Check database schema in Prisma schema.prisma
2. Review service logs for errors
3. Run ledger integrity check
4. Contact system admin

---

**System Version:** 1.0
**Last Updated:** January 2025
**Status:** Production Ready
