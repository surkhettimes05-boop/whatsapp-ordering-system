# 📦 Inventory Truth Layer with Stock Reservation

## Overview

Complete inventory management system ensuring:
- ✅ No overselling (stock can never go negative)
- ✅ Real-time stock tracking
- ✅ Atomic reservations and deductions
- ✅ Partial fulfillment support
- ✅ Order lifecycle with stock management
- ✅ Audit trails for compliance

---

## Architecture

### Data Model

**WholesalerProduct** (Inventory Truth)
```
- stock: Int                // Physical quantity available
- reservedStock: Int        // Quantity locked in active orders
- availableStock = stock - reservedStock
```

**StockReservation** (Order-level Inventory Holds)
```
- wholesalerProductId: FK → WholesalerProduct
- orderId: FK → Order
- quantity: Int             // How much locked for this order
- status: ACTIVE | RELEASED | FULFILLED | PARTIALLY_FULFILLED
```

### Stock Flow

```
Order Created
    ↓
[VALIDATE] Check availability
    ↓
[RESERVE] Lock stock (reservedStock += qty)
    ↓ (on cancellation)
[RELEASE] Unlock stock (reservedStock -= qty)
    ↓ (on delivery)
[DEDUCT] Finalize (stock -= qty, reservedStock -= qty)
```

---

## Key Components

### 1. **Inventory Service** (`inventory.service.js`)

Core service with all stock operations:

#### `getAvailableStock(wholesalerId, productId)`
Returns immediate available quantity.
```javascript
const available = await inventoryService.getAvailableStock(wId, pId);
// Returns: number (could be 0 or negative scenario)
```

#### `validateOrderAvailability(wholesalerId, items)`
Pre-check before ordering.
```javascript
const validation = await inventoryService.validateOrderAvailability(wId, [
  { productId: 'p1', quantity: 10 },
  { productId: 'p2', quantity: 5 }
]);

// Returns:
{
  canFulfill: boolean,
  shortages: [
    {
      productId,
      productName,
      requested,
      available,
      shortage
    }
  ],
  errors: []
}
```

#### `reserveStock(orderId, wholesalerId, items)`
🔒 **ATOMIC TRANSACTION** - All items reserved or transaction fails.

```javascript
try {
  const result = await inventoryService.reserveStock(
    'order-123',
    'wholesaler-456',
    [
      { productId: 'prod-1', quantity: 10 },
      { productId: 'prod-2', quantity: 5 }
    ]
  );
  
  console.log(`Reserved ${result.reservationCount} items`);
  // result.reservations: [{reservationId, productId, quantity, status}]
} catch (err) {
  console.error(err.message);
  // Stock NOT reserved - order cannot be created
}
```

**Critical Rule**: If ANY item fails, ENTIRE transaction rolls back.

#### `releaseStock(orderId)`
🔓 Unlock reserved stock (order cancelled or re-routed).

```javascript
const result = await inventoryService.releaseStock('order-123');
// result: {orderId, releasedCount, reservations}
// reservedStock automatically decremented
```

#### `deductStock(orderId, options?)`
📦 Finalize delivery - removes from physical stock.

```javascript
// Full fulfillment
await inventoryService.deductStock('order-123');

// Partial fulfillment (customer received 8 out of 10)
await inventoryService.deductStock('order-123', {
  partialQuantities: {
    'reservation-id-1': 8
  }
});
```

**Post-deduction**:
- `stock` decreases
- `reservedStock` decreases
- Reservation status → `FULFILLED` or `PARTIALLY_FULFILLED`

#### `getInventoryStatus(wholesalerId, productId)`
Real-time inventory view.
```javascript
const status = await inventoryService.getInventoryStatus(wId, pId);
// Returns:
{
  productName,
  physicalStock,
  reservedStock,
  availableStock,
  activeReservations,
  isAvailable,
  lastUpdated
}
```

#### `getInventoryAudit(wholesalerId, productId)`
Complete audit trail for compliance.
```javascript
const audit = await inventoryService.getInventoryAudit(wId, pId);
// Shows all reservations, orders, and status changes
```

#### `detectNegativeStock()`
Emergency diagnosis (should never happen).
```javascript
const issues = await inventoryService.detectNegativeStock();
// Returns issues: NEGATIVE_PHYSICAL_STOCK, NEGATIVE_RESERVED, EXCEEDS_PHYSICAL
```

---

### 2. **Order Service V2** (`order.service.v2.js`)

Enhanced order creation with inventory integration.

#### `createOrderWithInventory(retailerId, wholesalerId, items, options)`

Complete order creation flow:
1. Validate retailer
2. Validate wholesaler
3. Check credit (if CREDIT mode)
4. **Validate inventory availability**
5. Calculate totals
6. **Reserve stock (atomic)**
7. Create order
8. Log action

```javascript
const result = await orderServiceV2.createOrderWithInventory(
  'retailer-1',
  'wholesaler-2',
  [
    { productId: 'prod-A', quantity: 100 },
    { productId: 'prod-B', quantity: 50 }
  ],
  { paymentMode: 'COD' }
);

// Success:
{
  order: {
    id,
    status: 'PLACED',
    totalAmount,
    itemCount,
    items: [{ productId, productName, quantity, price }],
    createdAt
  },
  stockStatus: {
    reserved: true,
    reservationCount: 2,
    message: "2 items reserved from Wholesaler ABC"
  }
}
```

**On Failure**: Stock is NOT reserved, order is NOT created.

#### `cancelOrder(orderId, reason?)`
Cancel and release stock.
```javascript
const result = await orderServiceV2.cancelOrder(
  'order-123',
  'Customer requested cancellation'
);
// Returns: {orderId, status: 'CANCELLED', message}
```

#### `confirmOrder(orderId)`
Wholesaler accepts order (PLACED → CONFIRMED).
```javascript
const result = await orderServiceV2.confirmOrder('order-123');
// Stock remains reserved
```

#### `completeOrder(orderId, options?)`
Deliver and deduct stock.
```javascript
// Full delivery
await orderServiceV2.completeOrder('order-123');

// Partial delivery (10 items delivered out of 15 ordered)
await orderServiceV2.completeOrder('order-123', {
  partialQuantities: {
    'reservation-123': 10
  }
});
```

#### `getOrderWithInventory(orderId)`
Order + inventory status.
```javascript
const order = await orderServiceV2.getOrderWithInventory('order-123');
// Returns items with reserved/fulfilled status
```

---

## API Endpoints

### Check Availability (Pre-Order)

```http
POST /api/v1/inventory/check
Content-Type: application/json

{
  "wholesalerId": "w1",
  "items": [
    { "productId": "p1", "quantity": 10 },
    { "productId": "p2", "quantity": 5 }
  ]
}
```

**Response (Can Fulfill)**:
```json
{
  "success": true,
  "data": {
    "canFulfill": true,
    "shortages": [],
    "errors": [],
    "message": "All items available"
  }
}
```

**Response (Cannot Fulfill)**:
```json
{
  "success": true,
  "data": {
    "canFulfill": false,
    "shortages": [
      {
        "productId": "p1",
        "productName": "Rice Sack",
        "requested": 10,
        "available": 5,
        "shortage": 5
      }
    ],
    "errors": []
  }
}
```

### Get Inventory Status

```http
GET /api/v1/inventory/{wholesalerId}/{productId}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "productName": "Rice Sack",
    "physicalStock": 100,
    "reservedStock": 45,
    "availableStock": 55,
    "activeReservations": 3,
    "isAvailable": true
  }
}
```

### Create Order with Reservation

```http
POST /api/v1/orders/with-inventory
Content-Type: application/json
Authorization: Bearer {token}

{
  "wholesalerId": "w1",
  "items": [
    { "productId": "p1", "quantity": 10 }
  ],
  "paymentMode": "COD"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "Order created and stock reserved",
  "data": {
    "order": {
      "id": "ord-123",
      "status": "PLACED",
      "totalAmount": 5000,
      "itemCount": 1,
      "items": [
        {
          "productId": "p1",
          "productName": "Rice Sack",
          "quantity": 10,
          "price": 500
        }
      ]
    },
    "stockStatus": {
      "reserved": true,
      "reservationCount": 1
    }
  }
}
```

**Response (Failed - No Stock)**:
```json
{
  "success": false,
  "error": "Stock shortage: Rice Sack (need 8 more)"
}
```

### Cancel Order

```http
POST /api/v1/orders/{orderId}/cancel
Content-Type: application/json

{
  "reason": "Customer changed mind"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "orderId": "ord-123",
    "status": "CANCELLED",
    "message": "Order cancelled. Stock released: 1 items"
  }
}
```

### Confirm Order

```http
POST /api/v1/orders/{orderId}/confirm
```

**Response**:
```json
{
  "success": true,
  "data": {
    "orderId": "ord-123",
    "status": "CONFIRMED"
  }
}
```

### Deliver Order (Full)

```http
POST /api/v1/orders/{orderId}/deliver
```

**Response**:
```json
{
  "success": true,
  "data": {
    "orderId": "ord-123",
    "status": "DELIVERED",
    "message": "Order delivered. Stock deducted for 1 items"
  }
}
```

### Deliver Order (Partial)

```http
POST /api/v1/orders/{orderId}/deliver
Content-Type: application/json

{
  "partialQuantities": {
    "reservation-id-1": 8
  }
}
```

### Get Order with Inventory

```http
GET /api/v1/orders/{orderId}/inventory
```

**Response**:
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "ord-123",
      "status": "PLACED",
      "items": [
        {
          "productId": "p1",
          "inventory": [
            {
              "reserved": 10,
              "status": "ACTIVE"
            }
          ]
        }
      ]
    },
    "inventory": {
      "reservedItemCount": 1,
      "fulfilledItemCount": 0,
      "releasedItemCount": 0
    }
  }
}
```

### Get Inventory Audit (Admin)

```http
GET /api/v1/inventory/{wholesalerId}/{productId}/audit
Authorization: Bearer {admin-token}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "product": { "id": "p1", "name": "Rice Sack" },
    "currentStock": {
      "physical": 100,
      "reserved": 45,
      "available": 55
    },
    "reservations": [
      {
        "reservationId": "res-1",
        "orderId": "ord-123",
        "quantity": 10,
        "status": "ACTIVE",
        "orderStatus": "PLACED",
        "createdAt": "2026-01-15T10:00:00Z"
      }
    ]
  }
}
```

---

## Guarantees & Safeguards

### 1. **No Negative Stock**
Every operation validates before executing. If any check fails, transaction rolls back entirely.

```javascript
// This will throw error - no partial execution
if (available < requested) {
  throw new Error('Insufficient stock');
  // Transaction is rolled back immediately
}
```

### 2. **Atomic Transactions**
All stock changes use Prisma transactions:
```javascript
await prisma.$transaction(async (tx) => {
  // All operations succeed or all fail
  // No partial updates
});
```

### 3. **Reserved vs Physical**
- **Physical Stock** (`stock`): Actual product in warehouse
- **Reserved Stock** (`reservedStock`): Locked for orders
- **Available** = Physical - Reserved (can never order more than this)

### 4. **Audit Trail**
Every operation logged:
```
✅ Stock reserved for order ord-123: 2 items
❌ Stock release failed for order ord-456: ...
📦 Stock deducted for order ord-789: 3 items
```

### 5. **Partial Fulfillment**
Support for customer receiving fewer items:
```javascript
// Order: 100 units
// Delivered: 90 units
// Remaining: 10 units released back

await inventoryService.deductStock(orderId, {
  partialQuantities: { 'res-id': 90 }
});
// Result: 10 units automatically released
```

---

## Integration Steps

### 1. Add Routes to App
```javascript
// In src/app.js
app.use('/api/v1/inventory', require('./routes/inventory.routes'));
app.use('/api/v1/orders', require('./routes/orders-inventory.routes'));
```

### 2. Update Order Creation
```javascript
// OLD:
const order = await orderService.createOrder(retailerId, items);

// NEW: With inventory
const result = await orderServiceV2.createOrderWithInventory(
  retailerId,
  wholesalerId,
  items
);
```

### 3. Handle Order Cancellation
```javascript
// OLD:
await orderService.cancelOrder(orderId);

// NEW: With stock release
await orderServiceV2.cancelOrder(orderId);
// Stock automatically released
```

### 4. Handle Delivery
```javascript
// OLD:
await orderService.completeOrder(orderId);

// NEW: With stock deduction
await orderServiceV2.completeOrder(orderId);
// Stock automatically deducted from physical inventory
```

---

## Error Handling

### Stock Unavailable
```javascript
try {
  await inventoryService.reserveStock(orderId, wId, items);
} catch (err) {
  console.error(err.message);
  // "Insufficient stock for product prod-1. Requested: 100, Available: 45"
  
  // Order is NOT created
  // Retailer sees error and can adjust quantity
}
```

### Already Reserved
```javascript
try {
  await inventoryService.reserveStock('order-1', wId, items);
  await inventoryService.reserveStock('order-1', wId, items); // Same order?
} catch (err) {
  // Idempotent: Second call will fail with "already reserved" error
}
```

### Negative Stock Detection
```javascript
const issues = await inventoryService.detectNegativeStock();
if (issues.length > 0) {
  // Alert admin - data corruption
  // Investigate and fix manually
}
```

---

## Testing Scenarios

### ✅ Test 1: Normal Order Flow
```javascript
1. Check availability → ✅ Pass
2. Create order with reservation → ✅ Stock reserved
3. Confirm order → ✅ Remains reserved
4. Deliver order → ✅ Stock deducted
5. Verify stock decreased → ✅ physicalStock--, reservedStock--
```

### ✅ Test 2: Order Cancellation
```javascript
1. Create order → ✅ Stock reserved
2. Cancel order → ✅ Stock released
3. Verify stock unchanged → ✅ availableStock back to original
```

### ✅ Test 3: Partial Fulfillment
```javascript
1. Order 100 units → ✅ Reserved: 100
2. Deliver 90 units → ✅ Deducted: 90, Reserved: 10
3. Release remaining → ✅ Reserved: 0
```

### ✅ Test 4: Insufficient Stock
```javascript
1. Check availability (only 50 available)
2. Try to order 100 → ❌ Error thrown
3. Order NOT created
4. Stock NOT touched
```

### ✅ Test 5: Overselling Prevention
```javascript
1. Two orders simultaneously, each requesting 60 units
2. Only 100 total available
3. First order → ✅ Reserves 60
4. Second order → ❌ Only 40 available, fails
5. Final stock: 40 available, 60 reserved ✅
```

---

## Monitoring & Alerts

Monitor these in production:

```javascript
// Daily stock audit
const issues = await inventoryService.detectNegativeStock();
if (issues.length > 0) {
  sendAlert('CRITICAL: Inventory anomaly detected');
}

// Check for hung reservations (orders in PLACED for > 24h)
const hungOrders = await prisma.order.findMany({
  where: {
    status: 'PLACED',
    createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  }
});

// Monitor reservation release rate
const activeReservations = await prisma.stockReservation.findMany({
  where: { status: 'ACTIVE' }
});
```

---

## Summary

✅ **No negative stock guaranteed**
✅ **Atomic transactions prevent data corruption**
✅ **Real-time availability checking**
✅ **Automatic reservation on order creation**
✅ **Automatic release on cancellation**
✅ **Automatic deduction on delivery**
✅ **Partial fulfillment supported**
✅ **Audit trails for compliance**
✅ **Emergency diagnosis tools**

**The system ensures that stock quantity never goes negative and every order either fully succeeds or fully fails - no partial/inconsistent states.**
