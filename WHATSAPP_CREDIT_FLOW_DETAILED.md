# 🏦 WhatsApp Credit Integration - COMPLETE FLOW GUIDE

---

## 🔄 Complete Order Processing Flow (WITH Credit Checks)

```
═══════════════════════════════════════════════════════════════════════════════

STEP 1: RETAILER SENDS CONFIRMATION
─────────────────────────────────────

Retailer WhatsApp:    "Yes" or "Confirm"
        ↓
Controller receives:  handleIncomingMessage()
        ↓
Check state:          CONFIRMATION_PENDING
        ↓
Fetch order:          { id, items, totalAmount, retailerId }


STEP 2: CALCULATE ORDER TOTAL
──────────────────────────────

Items: [
  { productId: "p1", qty: 5, price: 500 },
  { productId: "p2", qty: 3, price: 800 }
]

Total Calculation:
  • Item 1: 5 × 500 = 2,500
  • Item 2: 3 × 800 = 2,400
  • Order Total: Rs. 4,900


STEP 3: ⭐ CREDIT VALIDATION (NEW)
─────────────────────────────────────

await whatsappCreditValidator.validateOrderCredit(
  retailerId,
  4900
);

┌─────────────────────────────────────────┐
│ CHECK 1: Retailer Exists                │
│ SELECT * FROM Retailer WHERE id = ?     │
│ Result: ✅ Found                        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ CHECK 2: Has Credit Account             │
│ WHERE retailer.credit IS NOT NULL       │
│ Result: ✅ Found                        │
│ Credit Limit: Rs. 50,000                │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ CHECK 3: Credit Status ACTIVE           │
│ WHERE status = 'ACTIVE'                 │
│ Result: ✅ ACTIVE                       │
│ (Not PAUSED or BLOCKED)                 │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ CHECK 4: Calculate Available Credit     │
│ Available = Limit - Used                │
│ Available = 50,000 - 20,000 = 30,000   │
│                                          │
│ Order Amount: 4,900                     │
│ Can order?   4,900 ≤ 30,000?           │
│ Result: ✅ YES                          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ CHECK 5: Check Overdue Payments         │
│ Days Outstanding:                        │
│ SELECT MIN(createdAt) FROM Transactions │
│ WHERE status = 'OPEN'                   │
│ Age: 15 days (Max allowed: 30)         │
│ Result: ✅ Within limits                │
│ (Warn if > 30 days)                    │
└─────────────────────────────────────────┘

Return:
{
  approved: true,
  creditInfo: {
    creditLimit: 50000,
    usedCredit: 20000,
    availableCredit: 30000,
    outstandingAmount: 0,
    outstandingDays: 15,
    creditStatus: 'ACTIVE'
  },
  reason: 'CREDIT_APPROVED'
}


STEP 4: HANDLE CREDIT DECISION
───────────────────────────────

if (!creditValidation.approved) {
  // ❌ CREDIT REJECTED
  await whatsappCreditValidator.logCreditCheck(
    retailerId,
    4900,
    false,
    'INSUFFICIENT_CREDIT'
  );
  
  await whatsappService.sendMessage(phone, 
    whatsappCreditMessages.getCreditExceededMessage(...)
  );
  
  return; // Order stays PENDING
}

// ✅ CREDIT APPROVED - Continue...


STEP 5: PLACE TEMPORARY HOLD
──────────────────────────────

await whatsappCreditValidator.placeTemporaryHold(
  retailerId,
  4900,
  orderId
);

INSERT INTO CreditHold (retailerId, orderId, amount, status) 
VALUES (retail_123, order_456, 4900, 'ACTIVE');

Purpose: Prevent double-spending while processing


STEP 6: FIND BEST WHOLESALER
──────────────────────────────

await orderRoutingService.findBestWholesaler(
  retailerId,
  items
);

Selection Criteria:
  1. Available stock for all items
  2. Nearest location
  3. Highest reliability score
  4. Not currently overloaded

Result: Wholesaler = { id, businessName, location, whatsappNumber }


STEP 7: RESERVE STOCK
──────────────────────

await stockService.reserveStock(orderId, wholesalerId, items);

For each item:
  UPDATE Stock SET 
    reserved = reserved + qty,
    available = available - qty
  WHERE productId = ? AND wholesalerId = ?

Example:
  Product P1 @ Wholesaler W1:
    Before: { stock: 100, available: 90, reserved: 10 }
    After:  { stock: 100, available: 85, reserved: 15 }


STEP 8: FINALIZE CREDIT DEDUCTION
──────────────────────────────────

await whatsappCreditValidator.finalizeCredit(
  retailerId,
  orderId,
  4900
);

Performs:
1. UPDATE CreditAccount SET usedCredit = usedCredit + 4900
   Result: usedCredit changes from 20,000 to 24,900

2. INSERT INTO CreditTransaction
   { retailerId, orderId, amount: 4900, type: 'DEBIT', status: 'OPEN' }

3. UPDATE CreditHold SET status = 'FINALIZED'
   (Keep hold for reference, mark as finalized)

Return: { success: true, newUsedCredit: 24900 }


STEP 9: UPDATE ORDER STATUS
──────────────────────────────

UPDATE Order SET 
  status = 'PLACED',
  wholesalerId = wholesaler_id,
  paymentMode = 'CREDIT',
  creditApprovedAt = NOW()
WHERE id = order_id;


STEP 10: RECORD ROUTING DECISION
─────────────────────────────────

INSERT INTO RoutingDecision
{
  orderId,
  retailerId,
  wholesalerId,
  selectedBy: 'ALGORITHM',
  score: routing_score,
  items: [...]
};


STEP 11: SEND CONFIRMATION TO RETAILER
──────────────────────────────────────────

await whatsappService.sendMessage(phone, `
✅ *Order Confirmed!*

Order #a1b2
Amount: Rs. 4,900

Assigned to: *Wholesale Store*

Credit Update:
📊 Used: Rs. 24,900
✓ Available: Rs. 25,100

You will receive delivery updates shortly. 🎉
`);


STEP 12: NOTIFY WHOLESALER
──────────────────────────

await whatsappService.sendMessage(wholesaler.whatsappNumber, `
📢 *NEW ORDER ALERT*

Order #a1b2
Amount: Rs. 4,900
Items: 2
Location: Shop City

Reply "Accept Order a1b2" to claim.
`);


STEP 13: CLEAR CONVERSATION STATE
──────────────────────────────────

await conversationService.clearState(retailerId);

(Ready for next conversation)


═══════════════════════════════════════════════════════════════════════════════
```

---

## 📊 Data Changes During Flow

### Retailer's CreditAccount

| Phase | Used | Available | Change |
|-------|------|-----------|--------|
| Before | 20,000 | 30,000 | - |
| After Credit Check | 20,000 | 30,000 | ✅ Approved |
| After Finalize | 24,900 | 25,100 | ➕ 4,900 |

### Stock Levels

| Item | Wholesaler | Before | After |
|------|-----------|--------|-------|
| P1 | W1 | 90 available | 85 available |
| P2 | W1 | 50 available | 47 available |

### New Records Created

```
Order
  └─ status: 'PLACED'
  └─ paymentMode: 'CREDIT'
  └─ creditApprovedAt: '2026-01-15T10:30:00Z'
  └─ wholesalerId: 'w_123'

CreditTransaction
  └─ retailerId: 'r_456'
  └─ orderId: 'o_789'
  └─ amount: 4900
  └─ type: 'DEBIT'
  └─ status: 'OPEN'

CreditHold (optional)
  └─ retailerId: 'r_456'
  └─ orderId: 'o_789'
  └─ amount: 4900
  └─ status: 'FINALIZED'

StockReservation
  └─ orderId: 'o_789'
  └─ items: [...]
  └─ reserved: true

RoutingDecision
  └─ orderId: 'o_789'
  └─ selectedWholesaler: 'w_123'
  └─ score: 9.5
```

---

## ❌ If Credit Check FAILS

```
Retailer WhatsApp:   "Yes" (confirm)
        ↓
Order Amount: 5,000
        ↓
Credit Check: validateOrderCredit()
        ↓
Available Credit: 2,000
        ↓
5,000 > 2,000 ❌ REJECTED
        ↓
Log Rejection:
  INSERT INTO CreditAuditLog {
    retailerId,
    action: 'CREDIT_CHECK',
    orderAmount: 5000,
    approved: false,
    reason: 'INSUFFICIENT_CREDIT'
  }
        ↓
Send Message:

❌ *Credit Limit Exceeded*

Your Available: Rs. 2,000
Your Order: Rs. 5,000
Shortfall: Rs. 3,000

Options:
1️⃣ Reduce order size
2️⃣ Make a payment
3️⃣ Contact support

        ↓
Order Status: PENDING (unchanged)
        ↓
Retailer Can:
  • Try again with smaller order
  • Make a payment
  • Contact support
```

---

## ⚠️ If Stock Reservation FAILS

```
Credit Check: ✅ PASSED
        ↓
Place Temp Hold: ✅ SUCCESS
        ↓
Find Wholesaler: ✅ FOUND
        ↓
Reserve Stock: ❌ FAILED (Out of stock)
        ↓
Release Temp Hold:
  UPDATE CreditHold SET status = 'RELEASED'
        ↓
Send Error Message:
  "⚠️ Stock temporarily unavailable.
   Please try again in a moment."
        ↓
Order Status: PENDING
        ↓
Credit: NOT deducted (because stock reservation failed)
        ↓
Retailer Can: Try again in a moment
```

---

## 🔄 When Payment is Received

```
Admin: Receives payment of Rs. 10,000

System: recordPayment(retailerId, 10000)
        ↓
UPDATE CreditAccount 
SET usedCredit = usedCredit - 10000
WHERE retailerId = ?

Before: usedCredit = 24,900
After:  usedCredit = 14,900
        ↓
INSERT INTO CreditTransaction {
  type: 'CREDIT',
  amount: 10000,
  status: 'CLEARED'
}
        ↓
Send Message:
✅ *Payment Received!*

Amount: Rs. 10,000
New Used: Rs. 14,900
New Available: Rs. 35,100

You're all set! 🎉
        ↓
Credit Available Increases
Customer can place more orders
```

---

## 📈 Audit Trail Example

For one order:

```
2026-01-15 10:20:00 | CREDIT_CHECK    | Order Rs. 4,900  | APPROVED  | Available: 30,000
2026-01-15 10:20:01 | HOLD_PLACED     | Hold Rs. 4,900   | SUCCESS   | Hold ID: h_123
2026-01-15 10:20:05 | STOCK_RESERVED  | Items: 2         | SUCCESS   | Wholesaler: W1
2026-01-15 10:20:06 | CREDIT_FINALIZED| Amount Rs. 4,900 | SUCCESS   | New Used: 24,900
2026-01-15 10:20:07 | ORDER_PLACED    | Order #a1b2      | SUCCESS   | Status: PLACED
2026-01-15 10:20:08 | HOLD_RELEASED   | Hold #h_123      | FINALIZED | (No longer active)
2026-01-15 11:00:00 | ORDER_ACCEPTED  | By Wholesaler W1 | SUCCESS   | Status: CONFIRMED
2026-01-15 14:00:00 | ORDER_DELIVERED | Completed        | SUCCESS   | Status: DELIVERED
2026-01-16 08:00:00 | PAYMENT_RECEIVED| Rs. 4,900        | SUCCESS   | New Used: 20,000
```

---

## 🎯 Message Sequence Diagram

```
Retailer           System              Wholesaler
   |                 |                      |
   |--"Place Order"->|                      |
   |                 | (Show products)      |
   |<---Products-----|                      |
   |                 |                      |
   |--"1 x 5"------->|                      |
   |                 | (Calc: 5 × 500)      |
   |<---Review------|                      |
   | Amount: 5000    |                      |
   |                 |                      |
   |--"Yes"-------->|                      |
   |                 |                      |
   |<-"💳 Checking"--|                      |
   |                 |                      |
   |                 | (Credit Check)       |
   |                 |   ✅ Approved        |
   |                 | (Stock Reservation)  |
   |                 |   ✅ Reserved        |
   |                 | (Credit Finalize)    |
   |                 |   ✅ Deducted        |
   |                 |                      |
   |<-"✅ Confirmed"-|                      |
   | Order #a1b2     |--"📢 New Order"----->|
   | Amount: 5000    |                      |
   |                 |                      |
   |                 |<--"Accept a1b2"-----|
   |<-"ℹ️ Accepted"----|                      |
   | By Wholesaler   |                      |
   |                 |                      |
   |                 |---"Ready"----------->|
   |<-"📦 Processing"-|                      |
   |                 |                      |
   |                 |---"On Way"---------->|
   |<-"🚚 Delivery"---|                      |
   |                 |                      |
   |<-"Rate 1-5"-----|<--"Delivered"--------|
   |                 |                      |
   |--"5"---------->|                      |
   |<-"🙏 Thanks"----|                      |
```

---

## 🔐 Security Checkpoints

```
WhatsApp Message
    ↓
[1] Controller validates input
    ├─ From field not empty
    ├─ Body field not empty
    └─ Phone number format valid
    ↓
[2] Retailer lookup
    ├─ Must exist in database
    ├─ Must not be BLOCKED
    └─ Must have credit account
    ↓
[3] Conversation state check
    ├─ Must be in CONFIRMATION_PENDING
    ├─ Must have draft order
    └─ Draft must be PENDING status
    ↓
[4] ⭐ Credit validation
    ├─ Must have available credit
    ├─ Must not be paused
    └─ Must not be overdue (auto-warn)
    ↓
[5] Stock validation
    ├─ Wholesaler must have stock
    ├─ Sufficient for all items
    └─ Reservation succeeds atomically
    ↓
[6] Credit finalization
    ├─ Credit must be deducted
    ├─ Transaction must be logged
    └─ Hold must be finalized
    ↓
[7] Order creation
    ├─ Status set to PLACED
    ├─ Wholesaler assigned
    └─ All fields populated
    ↓
✅ Order Successfully Created
```

---

## 📊 Key Metrics

### Pre-Credit-Check Era
- No credit validation before order
- Orders placed without checking limits
- Bad debt accumulates
- No audit trail of credit decisions

### Post-Credit-Check Era
- Every order validated BEFORE creation
- Clear visibility into credit status
- Bad debt prevented proactively
- Complete audit trail for compliance
- Better customer experience (clear messages)
- Improved collections (clear visibility)

---

## ✨ Summary

The complete flow is:

1. ✅ **Customer sends confirmation**
2. ✅ **System calculates order total**
3. ⭐ **Credit validation (NEW) - 5 checks**
   - If fails → Send error + block order
   - If passes → Continue
4. ✅ **Place temporary hold**
5. ✅ **Find wholesaler**
6. ✅ **Reserve stock**
7. ✅ **Finalize credit deduction**
8. ✅ **Create order**
9. ✅ **Send confirmations**
10. ✅ **Clear state for next order**

**Result**: Safe, audited, zero-bad-debt orders! 🎉
