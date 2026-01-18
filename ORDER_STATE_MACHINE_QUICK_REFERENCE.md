# ⚡ ORDER STATE MACHINE - QUICK REFERENCE

## 📦 What Was Built

A strict, non-skippable state machine for order management with 8 states and enforced transitions.

---

## 🗂️ Files Created (5 Files)

| File | Purpose | Lines |
|---|---|---|
| `src/constants/orderStates.js` | State enum & transition rules | 80 |
| `src/utils/orderStateMachineValidator.js` | Validation logic | 130 |
| `src/services/orderTransition.service.js` | Transition handler & logging | 250 |
| `src/services/orderStateMachine.service.js` | Main orchestrator | 350 |
| `src/controllers/orderStateMachine.controller.js` | API endpoints | 300 |
| `src/routes/orderStateMachine.routes.js` | Route definitions | 200 |

**Total: 1,310 lines of code**

---

## 8️⃣ Order States

```
CREATED → CREDIT_APPROVED → STOCK_RESERVED → WHOLESALER_ACCEPTED 
                                              ↓
                                         OUT_FOR_DELIVERY 
                                              ↓
From any state (except terminal):        DELIVERED ✓
         ↓
    → FAILED → CANCELLED ✓
      (except from OUT_FOR_DELIVERY, can cancel)
```

---

## ✅ Transition Rules

| From | To | Logic | Method |
|---|---|---|---|
| CREATED | CREDIT_APPROVED | Check credit | `approveCreditForOrder()` |
| CREDIT_APPROVED | STOCK_RESERVED | Reserve stock | `reserveStockForOrder()` |
| STOCK_RESERVED | WHOLESALER_ACCEPTED | Accept order | `acceptOrderAtWholesaler()` |
| WHOLESALER_ACCEPTED | OUT_FOR_DELIVERY | Start delivery | `startDelivery()` |
| OUT_FOR_DELIVERY | DELIVERED | Complete delivery | `completeDelivery()` |
| Any → | FAILED | Mark failed | `failOrder()` |
| Valid → | CANCELLED | Cancel order | `cancelOrder()` |

---

## 🔌 API Endpoints

### Create Order
```
POST /api/v1/orders/state-machine/create
Body: { wholesalerId, items: [{productId, quantity}], paymentMode? }
```

### Transition Endpoints
```
POST /api/v1/orders/:orderId/state-machine/approve-credit
POST /api/v1/orders/:orderId/state-machine/reserve-stock
POST /api/v1/orders/:orderId/state-machine/accept
POST /api/v1/orders/:orderId/state-machine/start-delivery
POST /api/v1/orders/:orderId/state-machine/complete-delivery
POST /api/v1/orders/:orderId/state-machine/fail (+ reason)
POST /api/v1/orders/:orderId/state-machine/cancel (+ reason)
```

### Query Endpoints
```
GET /api/v1/orders/:orderId/state-machine/state
GET /api/v1/orders/:orderId/state-machine/info
GET /api/v1/orders/:orderId/state-machine/history
POST /api/v1/orders/:orderId/state-machine/validate-transition
```

---

## 🛑 Error Codes

| Scenario | HTTP | Error Code |
|---|---|---|
| Skip states | 409 | INVALID_TRANSITION |
| Modify terminal | 409 | TERMINAL_STATE_ERROR |
| Insufficient credit | 402 | (Payment Required) |
| Order not found | 404 | (Not Found) |

---

## 💾 Business Logic Triggers

**State Transitions Automatically Execute:**

| State | Logic Executed |
|---|---|
| CREDIT_APPROVED | Check credit, place hold |
| STOCK_RESERVED | Reserve stock from inventory |
| WHOLESALER_ACCEPTED | Notify wholesaler |
| OUT_FOR_DELIVERY | Track shipment |
| DELIVERED | Deduct credit, deduct stock |
| FAILED | Release stock, release credit hold |
| CANCELLED | Release stock, release credit hold |

---

## 🚀 Integration Steps (5 Min)

### 1. Update Prisma Schema
Add to `prisma/schema.prisma`:
```prisma
model OrderTransitionLog {
  id        String   @id @default(cuid())
  orderId   String
  fromState String
  toState   String
  reason    String?
  userId    String
  metadata  String?
  timestamp DateTime @default(now())
  @@index([orderId])
  @@index([timestamp])
}
// Add to Order model: transitionHistory OrderTransitionLog[]
```

### 2. Run Migration
```bash
npx prisma migrate dev --name "add_order_state_machine"
```

### 3. Add Routes to app.js
```javascript
const orderStateMachineRoutes = require('./routes/orderStateMachine.routes');
app.use('/api/v1/orders', orderStateMachineRoutes);
```

### 4. (Optional) Inject Services
```javascript
app.use('/api/v1/orders', (req, res, next) => {
  req.services = {
    creditService: require('./services/credit.service'),
    inventoryService: require('./services/inventory.service')
  };
  next();
});
```

### 5. Test
```bash
# Create order
curl -X POST http://localhost:5000/api/v1/orders/state-machine/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"wholesalerId":"wh_123","items":[{"productId":"p_1","quantity":5}]}'

# Approve credit
curl -X POST http://localhost:5000/api/v1/orders/<ORDER_ID>/state-machine/approve-credit \
  -H "Authorization: Bearer <token>"
```

---

## 📋 Example Flow

```
1. Create order
   POST /orders/state-machine/create
   → Status: CREATED

2. Approve credit
   POST /orders/{id}/state-machine/approve-credit
   → Status: CREDIT_APPROVED
   → Credit hold placed

3. Reserve stock
   POST /orders/{id}/state-machine/reserve-stock
   → Status: STOCK_RESERVED
   → Stock reserved from inventory

4. Accept at wholesaler
   POST /orders/{id}/state-machine/accept
   → Status: WHOLESALER_ACCEPTED

5. Start delivery
   POST /orders/{id}/state-machine/start-delivery
   → Status: OUT_FOR_DELIVERY

6. Complete delivery
   POST /orders/{id}/state-machine/complete-delivery
   → Status: DELIVERED ✓ (Terminal)
   → Credit deducted
   → Stock deducted
   → Order complete
```

---

## 🔒 What Cannot Happen

❌ **Skip States**: CREATED → STOCK_RESERVED (must go through CREDIT_APPROVED)  
❌ **Backwards**: DELIVERED → WHOLESALER_ACCEPTED  
❌ **Modify Terminal**: DELIVERED → anything (terminal state)  
❌ **Manual Status**: Cannot directly set status without transition  
❌ **Duplicate Deduction**: Credit deducted only once at DELIVERED  
❌ **Lost Resources**: Stock always released on cancel/fail  

---

## 📊 Data Structures

### Order State
```javascript
{
  orderId: "ord_123",
  currentState: "STOCK_RESERVED",
  validNextStates: ["WHOLESALER_ACCEPTED", "FAILED", "CANCELLED"],
  isTerminal: false,
  canBeCancelled: true,
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-15T10:31:30Z"
}
```

### Transition Log
```javascript
{
  from: "CREATED",
  to: "CREDIT_APPROVED",
  reason: "Credit approved by system",
  userId: "user_123",
  timestamp: "2024-01-15T10:31:00Z",
  metadata: { creditApproved: true }
}
```

---

## 🧪 Testing

### Valid Transition
```javascript
const order = await orderStateMachine.createOrder(retailerId, wholesalerId, items);
// order.status === 'CREATED'

await orderStateMachine.approveCreditForOrder(order.id);
// ✅ Success: order.status === 'CREDIT_APPROVED'
```

### Invalid Transition
```javascript
try {
  await orderStateMachine.reserveStockForOrder(order.id);
  // But order is still in CREATED state
} catch (error) {
  // ✅ Caught: "Invalid transition from CREATED to STOCK_RESERVED"
}
```

### Terminal State
```javascript
try {
  await orderStateMachine.cancelOrder(deliveredOrder.id);
} catch (error) {
  // ✅ Caught: "Cannot transition from terminal state: DELIVERED"
}
```

---

## 📚 Documentation

- **Full Guide**: `ORDER_STATE_MACHINE_GUIDE.md`
- **Schema Additions**: `SCHEMA_ADDITIONS_FOR_ORDER_STATE_MACHINE.md`
- **Code Comments**: Each file has inline documentation

---

## 🎯 Key Features

✅ **No State Skipping**: Enforced linear progression  
✅ **Atomic Transitions**: All-or-nothing operations  
✅ **Complete Logging**: Every transition recorded  
✅ **Business Logic**: Triggered by state changes  
✅ **Error Prevention**: Invalid operations caught early  
✅ **Audit Trail**: Full history available  
✅ **Resource Management**: Automatic hold/release of credit & stock  
✅ **Extensible**: Easy to add new states or logic  

---

## 🚀 Next Steps

1. ✅ Read this quick reference
2. ✅ Read full guide: `ORDER_STATE_MACHINE_GUIDE.md`
3. ✅ Update Prisma schema
4. ✅ Run migration
5. ✅ Add routes to app.js
6. ✅ Test all transitions
7. ✅ Monitor transition logs

---

**Everything is ready to use!** 🎉
