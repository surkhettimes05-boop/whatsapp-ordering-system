# Inventory & Stock Reservation System

## Overview
We have implemented a strong consistency inventory truth layer ("Available to Promise" model).

## 1. Database Schema Changes
New fields and models have been added to `prisma/schema.prisma`:
- `WholesalerProduct.reservedStock`: Tracks stock reserved for active but not-yet-delivered orders.
- `StockReservation`: Tracks individual order reservations.

**Action Required:**
Update your database schema:
```bash
npx prisma db push
# OR
npx prisma migrate dev --name add_inventory_reservation
```

## 2. Service Logic
A new `StockService` (`src/services/stock.service.js`) handles:
- **Availability Check**: `Physical Stock - Reserved Stock >= Requested`
- **Reservation**: Locks stock when an order is assigned to a wholesaler.
- **Release**: Unlocks stock if an order is cancelled or rejected.
- **Deduction**: Permanently removes stock when an order is delivered.

## 3. Integration Points
- **Order Confirmation**: Stock is reserved immediately when the system assigns a wholesaler.
- **Order Rejection**: If a wholesaler rejects, stock is released and re-reserved for the next candidate.
- **Order Completion**: Stock is deducted upon delivery.
- **Order Cancellation**: Stock is released if the order is cancelled via API.

## 4. Testing
You can test the flow by:
1. Setting `stock` for a product to 10 and `reservedStock` to 0.
2. Placing an order for 5 items.
3. Checking DB: `reservedStock` should be 5.
4. Placing another order for 6 items. It should fail (Available: 10 - 5 = 5 < 6).
5. Defaulting the first order (Reject/Cancel): `reservedStock` becomes 0.
6. Completing the first order: `stock` becomes 5, `reservedStock` becomes 0.
