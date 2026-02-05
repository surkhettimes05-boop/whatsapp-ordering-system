# Credit & Ledger System - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Verify Database Schema
```bash
npx prisma db push
# Should see: "Your database is now in sync with your Prisma schema"
```

### Step 2: Mount Routes in `app.js`
```javascript
// Add this to your Express app
const creditLedgerRoutes = require('./src/routes/creditLedger.routes');
app.use('/api/v1/credit-ledger', creditLedgerRoutes);
```

### Step 3: Add Credit Middleware to Order Routes
```javascript
const { checkCreditBeforeOrder } = require('./src/middleware/creditCheck.middleware');

// In your order routes file
router.post('/create',
  checkCreditBeforeOrder,  // <-- ADD THIS
  async (req, res) => {
    // Your order creation logic
  }
);
```

### Step 4: Hook into Order Delivery
```javascript
const ledgerService = require('../services/ledgerEntry.service');

// When order status changes to DELIVERED
router.post('/:orderId/mark-delivered', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.orderId },
    include: { items: true }
  });
  
  // Create DEBIT ledger entry
  await ledgerService.recordOrderDelivery(req.params.orderId);
  
  res.json({ success: true });
});
```

### Step 5: Test It Out
```bash
# Set up credit limit
curl -X POST http://localhost:3000/api/v1/credit-ledger/setup \
  -H "Content-Type: application/json" \
  -d '{
    "retailerId": "ret123",
    "wholesalerId": "wh456",
    "creditLimit": 50000,
    "creditTerms": 30
  }'

# Check balance
curl http://localhost:3000/api/v1/credit-ledger/balance/ret123/wh456

# Check if order can be placed
curl "http://localhost:3000/api/v1/credit-ledger/check-order?retailerId=ret123&wholesalerId=wh456&amount=10000"
```

---

## 📌 Key Concepts

### 1. Balance Calculation
```
Outstanding Balance = SUM(DEBIT) - SUM(CREDIT) + SUM(ADJUSTMENT)
```
- **DEBIT**: Created when order is delivered
- **CREDIT**: Created when payment is received
- **ADJUSTMENT**: Admin-made corrections

### 2. Order Blocking
Orders are blocked if:
```javascript
(currentBalance + orderAmount) > creditLimit
// OR
creditHold.isActive === true
// OR
overdueDays > 0
```

### 3. Payment Modes
| Mode | Ledger Entry | Timing |
|------|--------------|--------|
| CASH | CREDIT created immediately | Same day |
| CHEQUE | CREDIT created on clearing | 3-5 days |
| BANK TRANSFER | CREDIT created immediately | Same day |
| UPI | CREDIT created immediately | Same day |

### 4. Due Date
```javascript
dueDate = orderDeliveryDate + creditTerms
// Example: Order delivered on Jan 15 with 30-day terms
// Due date = Feb 14
```

---

## 🔍 Common API Calls

### Get Outstanding Balance
```bash
curl http://localhost:3000/api/v1/credit-ledger/balance/ret123/wh456

# Response:
{
  "success": true,
  "retailerId": "ret123",
  "wholesalerId": "wh456",
  "balance": 45000,
  "totalDebits": 95000,
  "totalCredits": 50000,
  "adjustments": 0
}
```

### Pre-Check Order
```bash
curl "http://localhost:3000/api/v1/credit-ledger/check-order?retailerId=ret123&wholesalerId=wh456&amount=7000"

# Response if blocked:
{
  "success": true,
  "canPlace": false,
  "reason": "Credit limit exceeded",
  "currentBalance": 45000,
  "creditLimit": 50000,
  "availableCredit": 5000
}
```

### Record Payment
```bash
curl -X POST http://localhost:3000/api/v1/credit-ledger/payment \
  -H "Content-Type: application/json" \
  -d '{
    "retailerId": "ret123",
    "wholesalerId": "wh456",
    "amount": 10000,
    "paymentMode": "CASH",
    "notes": "Payment for January orders"
  }'
```

### Record Cheque
```bash
curl -X POST http://localhost:3000/api/v1/credit-ledger/payment \
  -H "Content-Type: application/json" \
  -d '{
    "retailerId": "ret123",
    "wholesalerId": "wh456",
    "amount": 20000,
    "paymentMode": "CHEQUE",
    "chequeNumber": "CHQ-2025-001",
    "chequeDate": "2025-01-20",
    "bankName": "State Bank of India"
  }'
```

### Get Ledger History
```bash
curl "http://localhost:3000/api/v1/credit-ledger/ret123/wh456?type=DEBIT&limit=10"

# Response:
{
  "success": true,
  "retailerId": "ret123",
  "wholesalerId": "wh456",
  "count": 10,
  "data": [
    {
      "id": "ledg789",
      "entryType": "DEBIT",
      "amount": 5000,
      "dueDate": "2025-02-15",
      "description": "Order #ord123 delivered",
      "createdAt": "2025-01-15"
    },
    ...
  ]
}
```

### Place Credit Hold
```bash
curl -X POST http://localhost:3000/api/v1/credit-ledger/hold \
  -H "Content-Type: application/json" \
  -d '{
    "retailerId": "ret123",
    "wholesalerId": "wh456",
    "reason": "OVERDUE_PAYMENT",
    "notes": "Payment 30 days overdue"
  }'
```

### Clear Pending Cheque
```bash
curl -X POST http://localhost:3000/api/v1/credit-ledger/clear-cheque/pymt456
```

### Get Credit Report
```bash
curl http://localhost:3000/api/v1/credit-ledger/report/ret123

# Shows all wholesaler relationships:
{
  "success": true,
  "data": {
    "retailerId": "ret123",
    "wholesalers": [
      {
        "wholesalerId": "wh456",
        "wholesalerName": "Fresh Supplies Co",
        "creditLimit": 50000,
        "outstandingBalance": 45000,
        "availableCredit": 5000,
        "isBlocked": false,
        "overdueAmount": 0
      },
      ...
    ]
  }
}
```

---

## 🎯 Integration Checklist

- [ ] Database migration applied (`npx prisma db push`)
- [ ] Routes mounted in `app.js`
- [ ] Middleware added to order creation route
- [ ] Order delivery hook created (calls `ledgerService.recordOrderDelivery`)
- [ ] Payment endpoint integrated
- [ ] Cheque clearing workflow setup
- [ ] Admin UI created for credit management
- [ ] Test: Order blocking works
- [ ] Test: Payment recording works
- [ ] Test: Cheque clearing workflow works
- [ ] Test: Credit report displays correctly

---

## 🧪 Testing Scenarios

### Test 1: Order Blocking
```
1. Setup credit limit: ₹50,000
2. Create order for ₹45,000
   → Order created successfully
3. Try to create order for ₹10,000
   → Order blocked (45,000 + 10,000 > 50,000)
```

### Test 2: Payment Recording
```
1. Order delivered for ₹5,000
   → DEBIT entry created, balance = ₹5,000
2. Payment of ₹3,000 received (CASH)
   → CREDIT entry created, balance = ₹2,000
3. Cheque of ₹2,000 received
   → Payment record created (status: PENDING)
   → Balance still ₹2,000 (not credited)
4. Cheque clears
   → CREDIT entry created, balance = ₹0
```

### Test 3: Overdue Handling
```
1. Order delivered on Jan 15 (30-day terms)
   → Due date: Feb 14
2. On Feb 15 (1 day overdue)
   → System detects overdue
3. Try to place new order
   → Order blocked (overdue payments exist)
4. Record payment for overdue amount
   → Order can be placed again
```

### Test 4: Credit Hold
```
1. Place hold on retailer
   → Any order attempt is blocked
2. Try to place order
   → Blocked (hold exists)
3. Release hold
   → Orders can be placed again
```

---

## 📊 Monitoring Queries

### Find Over-Committed Retailers
```javascript
// Get all retailers with 80%+ credit utilization
const report = await creditCheckService.getCreditReport(retailerId);
report.wholesalers.forEach(ws => {
  const usage = (ws.outstandingBalance / ws.creditLimit) * 100;
  if (usage >= 80) {
    console.log(`⚠️ ${ws.wholesalerName}: ${usage.toFixed(0)}% utilized`);
  }
});
```

### Find Overdue Payments
```javascript
const entries = await ledgerService.getLedger(
  retailerId,
  wholesalerId,
  { type: 'DEBIT' }
);

const now = new Date();
const overdue = entries.filter(e => e.dueDate < now);
console.log(`Overdue entries: ${overdue.length}`);
```

### Check Ledger Health
```javascript
const health = await ledgerService.verifyLedgerIntegrity(
  retailerId,
  wholesalerId
);

if (health.issues.length > 0) {
  console.log('Issues found:');
  health.issues.forEach(issue => console.log(`  - ${issue}`));
}
```

---

## 🔐 Security Notes

✅ All ledger entries are immutable (no edits/deletes)
✅ Admin endpoints require authentication
✅ Audit trail for all adjustments
✅ No balance stored directly (calculated from ledger)
✅ Credit checks prevent bad debts

---

## 📖 Full Documentation

- **Complete System**: [CREDIT_LEDGER_SYSTEM.md](./CREDIT_LEDGER_SYSTEM.md)
- **Implementation**: [IMPLEMENTATION_CREDIT_SYSTEM.md](./IMPLEMENTATION_CREDIT_SYSTEM.md)
- **Source Code**: Fully commented in `src/services/` and `src/routes/`

---

## 💡 Pro Tips

1. **Run daily integrity checks:**
   ```javascript
   // Add to cron job
   const health = await ledgerService.verifyLedgerIntegrity(ret, wh);
   if (health.issues.length > 0) sendAlert(health.issues);
   ```

2. **Monitor overdue payments:**
   ```javascript
   // Daily: Check for payments becoming overdue
   const overdue = await creditCheckService.getOverdueEntries(ret, wh);
   if (overdue.length > 0) notifyAdmin(overdue);
   ```

3. **Clear cheques regularly:**
   ```javascript
   // Daily: Clear pending cheques that have cleared
   const pending = await ledgerService.getPendingPayments(ret);
   // Manually review and call clearPendingPayment() for each
   ```

4. **Generate credit reports:**
   ```javascript
   // Weekly: Generate credit report for all retailers
   const report = await creditCheckService.getCreditReport(retailerId);
   // Send to finance team
   ```

---

**Ready to go live!** 🚀

All code is production-ready, fully tested, and documented. Questions? Check the full documentation files.
