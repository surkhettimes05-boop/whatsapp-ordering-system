# 🎯 ORDER STATE MACHINE - IMPLEMENTATION GUIDE

## Overview

A strict, **non-skippable state machine** for order lifecycle management that ensures:
- ✅ Orders follow a single, defined path
- ✅ Invalid transitions are prevented at runtime
- ✅ All transitions are logged for audit trails
- ✅ Business logic is triggered by state changes
- ✅ No manual status updates bypass validation

---

## 📊 Order States & Transitions

### State Diagram

```
    ┌─────────────┐
    │   CREATED   │ (New order)
    └──────┬──────┘
           │
     ┌─────▼──────┐
     │ CREDIT     │ (Credit approved & held)
     │ APPROVED   │
     └─────┬──────┘
           │
     ┌─────▼──────┐
     │   STOCK    │ (Stock reserved)
     │ RESERVED   │
     └─────┬──────┘
           │
  ┌────────▼────────┐
  │ WHOLESALER      │ (Wholesaler accepted)
  │ ACCEPTED        │
  └────────┬────────┘
           │
  ┌────────▼──────────┐
  │ OUT_FOR_           │ (Delivery in progress)
  │ DELIVERY           │
  └────────┬──────────┘
           │
  ┌────────▼────────┐
  │   DELIVERED     │ ◄─── TERMINAL STATE
  └─────────────────┘

From any state (except DELIVERED & CANCELLED):
           │
           ├──► FAILED ─┐     (Delivery failed)
           │            ├──► CANCELLED
           └──► CANCELLED     (User cancelled)
```

### Valid Transitions

| Current State | Valid Next States | Business Logic |
|---|---|---|
| **CREATED** | CREDIT_APPROVED, FAILED, CANCELLED | Validate order exists |
| **CREDIT_APPROVED** | STOCK_RESERVED, FAILED, CANCELLED | Check credit availability, hold credit |
| **STOCK_RESERVED** | WHOLESALER_ACCEPTED, FAILED, CANCELLED | Reserve stock from inventory |
| **WHOLESALER_ACCEPTED** | OUT_FOR_DELIVERY, FAILED, CANCELLED | Notify wholesaler |
| **OUT_FOR_DELIVERY** | DELIVERED, FAILED, CANCELLED | Track shipment |
| **DELIVERED** | *(Terminal)* | Deduct credit, deduct stock, enable rating |
| **FAILED** | CANCELLED | Release all holds |
| **CANCELLED** | *(Terminal)* | Release all holds |

---

## 🗂️ File Structure

```
backend/
├── src/
│   ├── constants/
│   │   └── orderStates.js                    # State enum & transitions
│   │
│   ├── utils/
│   │   └── orderStateMachineValidator.js     # Validation logic
│   │
│   ├── services/
│   │   ├── orderStateMachine.service.js      # Main orchestrator
│   │   └── orderTransition.service.js        # Transition manager
│   │
│   ├── controllers/
│   │   └── orderStateMachine.controller.js   # API endpoints
│   │
│   └── routes/
│       └── orderStateMachine.routes.js       # Route definitions
│
└── prisma/
    └── schema.prisma                         # Add OrderTransitionLog model
```

---

## 🔧 Implementation Steps

### Step 1: Update Prisma Schema

Add to `prisma/schema.prisma`:

```prisma
// Order State Machine Models
model OrderTransitionLog {
  id        String   @id @default(cuid())
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderId   String
  
  fromState String   // Previous state
  toState   String   // New state
  reason    String?  // Why the transition happened
  userId    String   // Who initiated the transition
  metadata  String?  // JSON metadata
  
  timestamp DateTime @default(now())
  
  @@index([orderId])
  @@index([timestamp])
}

// Add to Order model:
// transitionHistory OrderTransitionLog[]
```

Run migration:
```bash
npx prisma migrate dev --name "add_order_state_machine"
```

### Step 2: Add Routes to App

In `src/app.js`:

```javascript
const orderStateMachineRoutes = require('./routes/orderStateMachine.routes');

// After other routes:
app.use('/api/v1/orders', orderStateMachineRoutes);
```

### Step 3: Inject Services (Optional)

For business logic integration, add middleware to attach services:

```javascript
app.use('/api/v1/orders', (req, res, next) => {
  req.services = {
    creditService: require('./services/credit.service'),
    inventoryService: require('./services/inventory.service'),
    notificationService: require('./services/notification.service')
  };
  next();
});
```

---

## 🚀 Usage Examples

### Create Order

```bash
POST /api/v1/orders/state-machine/create
Content-Type: application/json
Authorization: Bearer <token>

{
  "wholesalerId": "wh_123",
  "items": [
    { "productId": "prod_1", "quantity": 10 },
    { "productId": "prod_2", "quantity": 5 }
  ],
  "paymentMode": "CREDIT"
}

Response:
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order": {
      "id": "ord_123",
      "status": "CREATED",
      "retailerId": "ret_123",
      "wholesalerId": "wh_123",
      "totalAmount": 15000,
      "paymentMode": "CREDIT",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "state": {
      "current": "CREATED",
      "validNextStates": ["CREDIT_APPROVED", "FAILED", "CANCELLED"]
    }
  }
}
```

### Approve Credit

```bash
POST /api/v1/orders/ord_123/state-machine/approve-credit
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Credit approved for order",
  "data": {
    "order": { ...order with status: "CREDIT_APPROVED" },
    "transition": {
      "from": "CREATED",
      "to": "CREDIT_APPROVED",
      "timestamp": "2024-01-15T10:31:00Z",
      "reason": "Credit approved by system",
      "userId": "user_123"
    }
  }
}
```

### Reserve Stock

```bash
POST /api/v1/orders/ord_123/state-machine/reserve-stock
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Stock reserved for order",
  "data": {
    "order": { ...order with status: "STOCK_RESERVED" },
    "transition": { ...transition details }
  }
}
```

### Get Order State

```bash
GET /api/v1/orders/ord_123/state-machine/state
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "orderId": "ord_123",
    "currentState": "STOCK_RESERVED",
    "validNextStates": ["WHOLESALER_ACCEPTED", "FAILED", "CANCELLED"],
    "isTerminal": false,
    "canBeCancelled": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:31:30Z"
  }
}
```

### Get Full State Machine Info

```bash
GET /api/v1/orders/ord_123/state-machine/info
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "orderId": "ord_123",
    "order": { ...order details },
    "currentState": "STOCK_RESERVED",
    "validNextStates": ["WHOLESALER_ACCEPTED", "FAILED", "CANCELLED"],
    "transitionHistory": [
      {
        "from": "CREATED",
        "to": "CREDIT_APPROVED",
        "reason": "Credit approved by system",
        "userId": "user_123",
        "timestamp": "2024-01-15T10:31:00Z"
      },
      {
        "from": "CREDIT_APPROVED",
        "to": "STOCK_RESERVED",
        "reason": "Stock reserved successfully",
        "userId": "user_123",
        "timestamp": "2024-01-15T10:31:30Z"
      }
    ],
    "statistics": {
      "totalTransitions": 2,
      "createdAt": "2024-01-15T10:30:00Z",
      "lastUpdatedAt": "2024-01-15T10:31:30Z",
      "isTerminal": false
    }
  }
}
```

### Get Transition History

```bash
GET /api/v1/orders/ord_123/state-machine/history
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "orderId": "ord_123",
    "transitionCount": 2,
    "transitions": [
      {
        "from": "CREATED",
        "to": "CREDIT_APPROVED",
        "reason": "Credit approved by system",
        "userId": "user_123",
        "timestamp": "2024-01-15T10:31:00Z",
        "metadata": { "creditApproved": true }
      },
      {
        "from": "CREDIT_APPROVED",
        "to": "STOCK_RESERVED",
        "reason": "Stock reserved successfully",
        "userId": "user_123",
        "timestamp": "2024-01-15T10:31:30Z",
        "metadata": { "reservationId": "res_456" }
      }
    ]
  }
}
```

### Validate Transition

```bash
POST /api/v1/orders/ord_123/state-machine/validate-transition
Authorization: Bearer <token>
Content-Type: application/json

{
  "nextState": "WHOLESALER_ACCEPTED"
}

Response:
{
  "success": true,
  "data": {
    "orderId": "ord_123",
    "currentState": "STOCK_RESERVED",
    "requestedState": "WHOLESALER_ACCEPTED",
    "isValid": true,
    "errors": []
  }
}
```

### Cancel Order

```bash
POST /api/v1/orders/ord_123/state-machine/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Customer requested cancellation"
}

Response:
{
  "success": true,
  "message": "Order cancelled successfully",
  "data": {
    "order": { ...order with status: "CANCELLED" },
    "transition": {
      "from": "STOCK_RESERVED",
      "to": "CANCELLED",
      "timestamp": "2024-01-15T10:35:00Z",
      "reason": "Customer requested cancellation",
      "userId": "user_123"
    }
  }
}
```

---

## 🔒 Error Handling

### Invalid Transition Error

```javascript
// Thrown when trying to skip states
try {
  await orderStateMachine.reserveStockForOrder(orderId);
  // But order is still in CREATED state (not CREDIT_APPROVED)
} catch (error) {
  // Error: "Invalid transition from CREATED to STOCK_RESERVED. 
  //         Valid transitions: CREDIT_APPROVED, FAILED, CANCELLED"
}

// HTTP Response: 409 Conflict
{
  "success": false,
  "error": "Invalid transition from CREATED to STOCK_RESERVED",
  "code": "INVALID_TRANSITION",
  "fromState": "CREATED",
  "toState": "STOCK_RESERVED"
}
```

### Terminal State Error

```javascript
// Thrown when trying to transition from terminal state
try {
  await orderStateMachine.cancelOrder(orderId);
  // But order is already DELIVERED (terminal state)
} catch (error) {
  // Error: "Cannot transition from terminal state: DELIVERED"
}

// HTTP Response: 409 Conflict
{
  "success": false,
  "error": "Cannot transition from terminal state: DELIVERED",
  "code": "TERMINAL_STATE_ERROR",
  "state": "DELIVERED"
}
```

### Business Logic Failures

```javascript
// Credit approval fails if retailer has insufficient credit
try {
  await orderStateMachine.approveCreditForOrder(orderId);
} catch (error) {
  // Error: "Insufficient credit for order: Balance too low"
}

// HTTP Response: 402 Payment Required
{
  "success": false,
  "error": "Insufficient credit for order: Balance too low"
}
```

---

## 📝 Logging & Audit Trail

Every state transition is logged with:
- **From State**: Previous state
- **To State**: New state
- **Reason**: Why transition happened
- **User ID**: Who triggered it
- **Timestamp**: When it happened
- **Metadata**: Additional context (credit hold, reservation ID, etc.)

Query transition history:
```javascript
const history = await orderTransitionService.getTransitionHistory(orderId);
// Returns array of all transitions with timestamps
```

---

## 🔗 Integration with Existing Services

### Credit Service Integration

```javascript
const creditService = {
  checkCreditAvailability: async (retailerId, wholesalerId, amount) => {
    // Check if retailer has sufficient credit with this wholesaler
    return { available: true/false, reason: '...' };
  },
  holdCredit: async (orderId, amount) => {
    // Place temporary hold on credit when order moves to CREDIT_APPROVED
  },
  releaseCreditHold: async (orderId) => {
    // Release hold if order is cancelled or fails
  },
  deductCredit: async (retailerId, wholesalerId, amount) => {
    // Permanently deduct credit when order is DELIVERED
  }
};
```

### Inventory Service Integration

```javascript
const inventoryService = {
  reserveStock: async (orderId, wholesalerId, items) => {
    // Lock stock when order moves to STOCK_RESERVED
    return { id: 'reservation_id' };
  },
  releaseStock: async (orderId) => {
    // Unlock stock if order is cancelled or fails
  },
  deductStock: async (orderId, partialQuantities) => {
    // Permanently deduct stock when order is DELIVERED
  }
};
```

### Notification Service Integration

```javascript
const notificationService = {
  notifyWholesalerOrderAccepted: async (order) => {
    // Send WhatsApp/SMS when order moves to WHOLESALER_ACCEPTED
  },
  notifyRetailerOrderDelivered: async (order) => {
    // Notify retailer when order is DELIVERED
  }
};
```

---

## ✅ Business Rules Enforced

1. **No Skipping States**: Orders cannot jump from CREATED directly to DELIVERED
2. **No Backwards Transitions**: Orders cannot go from DELIVERED back to any other state
3. **Atomic Transactions**: State changes with business logic are all-or-nothing
4. **Mandatory Logging**: Every transition is logged for audit
5. **Resource Cleanup**: Stock and credit are automatically released on cancellation/failure
6. **Credit Holds**: Credit is held (not deducted) during CREDIT_APPROVED state
7. **Stock Reservations**: Stock is reserved (not deducted) during STOCK_RESERVED state
8. **Final Deduction**: Credit and stock are only deducted when order reaches DELIVERED

---

## 🧪 Testing the State Machine

### Test Valid Transition

```javascript
const order = await orderStateMachine.createOrder(retailerId, wholesalerId, items);
// order.status === 'CREATED'

await orderStateMachine.approveCreditForOrder(order.id);
// ✅ Success: order.status === 'CREDIT_APPROVED'
```

### Test Invalid Transition

```javascript
const order = await orderStateMachine.createOrder(retailerId, wholesalerId, items);

try {
  // Try to skip CREDIT_APPROVED and go directly to STOCK_RESERVED
  await orderStateMachine.reserveStockForOrder(order.id);
} catch (error) {
  // ✅ Error caught: "Invalid transition from CREATED to STOCK_RESERVED"
}
```

### Test Terminal States

```javascript
const deliveredOrder = await prisma.order.findUnique({
  where: { id: orderId }
});
// deliveredOrder.status === 'DELIVERED'

try {
  await orderStateMachine.cancelOrder(deliveredOrder.id);
} catch (error) {
  // ✅ Error caught: "Cannot transition from terminal state: DELIVERED"
}
```

---

## 📊 State Machine Statistics

- **Total States**: 8
- **Total Possible Transitions**: 15
- **Terminal States**: 2 (DELIVERED, CANCELLED)
- **Failure States**: 2 (FAILED, CANCELLED)
- **Max Transitions per Order**: 8 (in optimal flow)

---

## 🎯 Key Benefits

✅ **Safety**: Impossible to create invalid order states  
✅ **Auditability**: Complete history of every state change  
✅ **Consistency**: Business logic tied to state transitions  
✅ **Clarity**: Single source of truth for order status  
✅ **Traceability**: Know exactly why and when orders changed state  
✅ **Atomicity**: No partial state changes  
✅ **Decoupling**: Services triggered by state, not direct calls  

---

## 🚀 Next Steps

1. Add `OrderTransitionLog` model to Prisma schema
2. Run migration: `npx prisma migrate dev`
3. Add routes to `app.js`
4. Inject services for business logic
5. Update existing controllers to use state machine
6. Test all valid and invalid transitions
7. Monitor transition logs for troubleshooting

---

