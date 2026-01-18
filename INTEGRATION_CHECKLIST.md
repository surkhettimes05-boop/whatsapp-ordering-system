# 🚀 ORDER STATE MACHINE - INTEGRATION CHECKLIST

**Start Date**: Now  
**Est. Completion Time**: 30 minutes  
**Priority**: HIGH - Unblocks all order operations  

---

## ✅ PHASE 1: Schema & Database (5 minutes)

### Task 1.1: Update Prisma Schema
- [ ] Open `prisma/schema.prisma`
- [ ] Find the Order model (around line 261)
- [ ] Add relation field to Order:
  ```prisma
  transitionHistory OrderTransitionLog[]
  ```
- [ ] Add new OrderTransitionLog model (copy from SCHEMA_ADDITIONS_FOR_ORDER_STATE_MACHINE.md):
  ```prisma
  model OrderTransitionLog {
    id        String   @id @default(cuid())
    order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
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
  ```

### Task 1.2: Run Migration
- [ ] Open terminal in `/backend`
- [ ] Run: `npx prisma migrate dev --name "add_order_state_machine"`
- [ ] Confirm migration creates OrderTransitionLog table
- [ ] Verify no errors in migration output

### Task 1.3: Verify Database
- [ ] Run: `npx prisma studio` (optional, visual verification)
- [ ] Check OrderTransitionLog table exists
- [ ] Check indexes are created on orderId and timestamp

---

## ✅ PHASE 2: Route Integration (3 minutes)

### Task 2.1: Add Routes to app.js
- [ ] Open `src/app.js`
- [ ] Find where other routes are imported (around line 20-30)
- [ ] Add import:
  ```javascript
  const orderStateMachineRoutes = require('./routes/orderStateMachine.routes');
  ```
- [ ] Find where routes are registered (around line 50-70)
- [ ] Add route registration:
  ```javascript
  app.use('/api/v1/orders', orderStateMachineRoutes);
  ```
- [ ] Save file

### Task 2.2: Verify Routes
- [ ] Check app.js has no syntax errors
- [ ] Route should be registered before error handling middleware

---

## ✅ PHASE 3: Service Integration (Optional but Recommended - 5 minutes)

### Task 3.1: Inject Required Services
- [ ] Identify where credit service is initialized in app.js
- [ ] Identify where inventory service is initialized
- [ ] Add middleware (before orderStateMachineRoutes) to attach to req:
  ```javascript
  app.use((req, res, next) => {
    req.services = {
      creditService: creditService,
      inventoryService: inventoryService,
      notificationService: notificationService // if you have it
    };
    next();
  });
  ```
- [ ] Verify services are available in controller methods

---

## ✅ PHASE 4: Testing (15 minutes)

### Task 4.1: Start Server
- [ ] Start your backend: `node src/app.js` or `npm start`
- [ ] Verify server runs on http://localhost:5000
- [ ] Check no errors in console

### Task 4.2: Test Create Order
- [ ] Use curl or Postman to create order:
  ```bash
  curl -X POST http://localhost:5000/api/v1/orders/state-machine/create \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{
      "wholesalerId": "wh_123",
      "items": [{"productId": "p_1", "quantity": 5}],
      "paymentMode": "CREDIT"
    }'
  ```
- [ ] Verify response includes orderId and status: "CREATED"
- [ ] Note the orderId for next tests

### Task 4.3: Test Valid Transition
- [ ] Approve credit (CREATED → CREDIT_APPROVED):
  ```bash
  curl -X POST http://localhost:5000/api/v1/orders/{orderId}/state-machine/approve-credit \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{"context": {"userId": "admin_1"}}'
  ```
- [ ] Verify response shows status: "CREDIT_APPROVED"

### Task 4.4: Test Invalid Transition
- [ ] Try to skip state (CREDIT_APPROVED → DELIVERED directly):
  ```bash
  curl -X POST http://localhost:5000/api/v1/orders/{orderId}/state-machine/complete-delivery \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{"context": {"userId": "admin_1"}}'
  ```
- [ ] Verify error: HTTP 409 Conflict with "Invalid transition" message
- [ ] This confirms validator is working ✅

### Task 4.5: Test State Query
- [ ] Get current state:
  ```bash
  curl -X GET http://localhost:5000/api/v1/orders/{orderId}/state-machine/state \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```
- [ ] Verify response includes:
  - `currentState`: "CREDIT_APPROVED"
  - `validNextStates`: ["STOCK_RESERVED"]

### Task 4.6: Test Transition History
- [ ] Get transition history:
  ```bash
  curl -X GET http://localhost:5000/api/v1/orders/{orderId}/state-machine/history \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```
- [ ] Verify response shows array of transitions:
  - CREATED → CREDIT_APPROVED with timestamp

---

## ✅ PHASE 5: Validation (5 minutes)

### Task 5.1: Verify State Machine Works
- [ ] Complete full flow (create → approve → reserve → accept → deliver)
- [ ] Each step should return correct state
- [ ] Each step should succeed in order

### Task 5.2: Verify Error Handling
- [ ] Test cancelling from CREATED (should work)
- [ ] Test cancelling from DELIVERED (should fail - terminal state)
- [ ] Test invalid transition (should fail)

### Task 5.3: Verify Logging
- [ ] Open Prisma Studio: `npx prisma studio`
- [ ] Check OrderTransitionLog table
- [ ] Verify all transitions are recorded with:
  - orderId
  - fromState
  - toState
  - timestamp
  - userId (if provided)

---

## ✅ PHASE 6: Integration with Existing Code (5 minutes)

### Task 6.1: Update Order Creation Flow
- [ ] Find where orders are currently created (if not using state machine)
- [ ] Replace with: `orderStateMachine.createOrder(...)`
- [ ] Remove old order creation logic if it exists

### Task 6.2: Update Order Status Updates
- [ ] Find where order status is directly updated
- [ ] Replace with appropriate state machine method:
  - → CREDIT_APPROVED: `approveCreditForOrder()`
  - → STOCK_RESERVED: `reserveStockForOrder()`
  - → WHOLESALER_ACCEPTED: `acceptOrderAtWholesaler()`
  - → OUT_FOR_DELIVERY: `startDelivery()`
  - → DELIVERED: `completeDelivery()`
  - → FAILED: `failOrder()`
  - → CANCELLED: `cancelOrder()`

### Task 6.3: Update Order Queries
- [ ] Find existing order status queries
- [ ] Update to use state machine info if needed
- [ ] No changes typically needed - Order model still has status field

---

## ✅ PHASE 7: Monitoring & Verification (2 minutes)

### Task 7.1: Check Logs
- [ ] Monitor console for any errors during transitions
- [ ] Verify no unhandled rejections

### Task 7.2: Test Edge Cases
- [ ] [ ] Test cancelling from different states
- [ ] [ ] Test multiple transitions in sequence
- [ ] [ ] Test transition with metadata/context

### Task 7.3: Production Readiness
- [ ] Verify all error codes are correct (409 for conflicts)
- [ ] Verify authentication is enforced on all endpoints
- [ ] Verify authorization is checked (ADMIN/STAFF)
- [ ] Verify transitions are idempotent if called twice

---

## 📋 Files to Check Before Running

### Must Exist:
- [ ] `src/constants/orderStates.js`
- [ ] `src/utils/orderStateMachineValidator.js`
- [ ] `src/services/orderTransition.service.js`
- [ ] `src/services/orderStateMachine.service.js`
- [ ] `src/controllers/orderStateMachine.controller.js`
- [ ] `src/routes/orderStateMachine.routes.js`

### Documentation (Reference):
- [ ] `ORDER_STATE_MACHINE_GUIDE.md`
- [ ] `ORDER_STATE_MACHINE_QUICK_REFERENCE.md`
- [ ] `SCHEMA_ADDITIONS_FOR_ORDER_STATE_MACHINE.md`

---

## ⚠️ Common Issues & Solutions

| Issue | Solution |
|---|---|
| Migration fails | Check Prisma schema syntax, remove duplicates |
| Routes not found (404) | Verify route import and registration in app.js |
| Invalid token error | Ensure authenticateJWT middleware is configured |
| Transition not working | Check validator for state combination in VALID_TRANSITIONS |
| No logs recorded | Verify OrderTransitionLog table was created in migration |
| Concurrent transitions fail | This is expected - should return 409 Conflict |

---

## 🎯 Success Criteria

✅ All 6 implementation files exist in `/src/`  
✅ Migration runs without errors  
✅ Routes are registered in app.js  
✅ Create order returns CREATED state  
✅ Valid transitions work (CREATED → CREDIT_APPROVED)  
✅ Invalid transitions fail with HTTP 409  
✅ Terminal states cannot transition  
✅ Transition history is logged  
✅ All endpoints respond with proper HTTP codes  
✅ No syntax errors in console  

---

## 📞 Quick Reference During Integration

### When creating orders:
```javascript
const order = await orderStateMachine.createOrder(retailerId, wholesalerId, items, paymentMode);
```

### When approving credit:
```javascript
await orderStateMachine.approveCreditForOrder(orderId, { userId: 'admin_1' });
```

### When checking state:
```javascript
const stateInfo = await orderStateMachine.getOrderState(orderId);
```

### When getting history:
```javascript
const transitions = await orderTransitionService.getTransitionHistory(orderId);
```

---

## ✨ You're All Set!

Follow this checklist in order and your state machine will be fully integrated in **30 minutes**. 

**Start with Phase 1 now!** 🚀

---

**Questions?** 
- See `ORDER_STATE_MACHINE_GUIDE.md` for detailed explanations
- See `ORDER_STATE_MACHINE_QUICK_REFERENCE.md` for quick lookups
- Check code comments in implementation files for context
