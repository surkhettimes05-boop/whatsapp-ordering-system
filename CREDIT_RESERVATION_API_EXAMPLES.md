# Credit Reservation System - API Integration Examples

This guide shows how to integrate credit reservation into your API endpoints.

---

## 📋 Pre-Order Credit Check Endpoint

```javascript
/**
 * GET /api/v1/credit/check-order
 * Pre-check if order can be placed
 * 
 * Query Parameters:
 *   retailerId: string
 *   wholesalerId: string
 *   amount: number
 */
router.get('/api/v1/credit/check-order', async (req, res) => {
    try {
        const { retailerId, wholesalerId, amount } = req.query;

        if (!retailerId || !wholesalerId || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }

        const creditReservationService = require('../services/creditReservation.service');
        
        const check = await creditReservationService.canReserveCredit(
            retailerId,
            wholesalerId,
            parseFloat(amount)
        );

        res.json({
            success: true,
            canOrder: check.canReserve,
            availableCredit: check.available,
            requiredCredit: check.orderAmount,
            creditLimit: check.limit,
            currentDebts: check.debits,
            currentReservations: check.reserved,
            shortfall: check.shortfall,
            message: check.message,
            creditStatus: check.isActive ? 'ACTIVE' : 'BLOCKED'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

**Example Request:**
```bash
GET /api/v1/credit/check-order?retailerId=ret-123&wholesalerId=wh-456&amount=50000

# Response if sufficient credit:
{
    "success": true,
    "canOrder": true,
    "availableCredit": 75000,
    "requiredCredit": 50000,
    "creditLimit": 100000,
    "shortfall": 0,
    "message": "✅ Can reserve ₹50000"
}

# Response if insufficient credit:
{
    "success": true,
    "canOrder": false,
    "availableCredit": 30000,
    "requiredCredit": 50000,
    "shortfall": 20000,
    "message": "❌ Insufficient credit. Need ₹50000 but only ₹30000 available"
}
```

---

## 📋 Create Order Endpoint (with Credit Validation)

```javascript
/**
 * POST /api/v1/orders
 * Create order with automatic credit validation
 * 
 * Body:
 * {
 *   retailerId: string,
 *   wholesalerId: string,
 *   items: [ { productId, quantity } ]
 * }
 */
router.post('/api/v1/orders', async (req, res) => {
    try {
        const { retailerId, wholesalerId, items } = req.body;

        const orderService = require('../services/order.service');
        const creditReservationService = require('../services/creditReservation.service');

        // 1. Create order
        const order = await orderService.createOrder(retailerId, items);
        console.log(`✓ Order created: ${order.id}`);

        // 2. Assign wholesaler (in real flow, this comes from routing decision)
        const updatedOrder = await prisma.order.update({
            where: { id: order.id },
            data: { wholesalerId }
        });

        // 3. Validate credit availability
        const creditCheck = await creditReservationService.canReserveCredit(
            retailerId,
            wholesalerId,
            order.totalAmount.toNumber()
        );

        if (!creditCheck.canReserve) {
            // Credit insufficient - delete order and notify
            await prisma.order.delete({ where: { id: order.id } });
            
            return res.status(402).json({
                success: false,
                error: 'INSUFFICIENT_CREDIT',
                message: creditCheck.message,
                availableCredit: creditCheck.available,
                requiredCredit: creditCheck.orderAmount,
                shortfall: creditCheck.shortfall
            });
        }

        // 4. Reserve credit
        const reservation = await creditReservationService.reserveCredit(
            retailerId,
            wholesalerId,
            order.id,
            order.totalAmount.toNumber()
        );

        console.log(`✓ Credit reserved: ₹${reservation.reservationAmount}`);

        // 5. Return success
        res.status(201).json({
            success: true,
            order: {
                id: order.id,
                orderNumber: order.orderNumber,
                totalAmount: order.totalAmount,
                retailerId,
                wholesalerId
            },
            creditReservation: {
                id: reservation.id,
                status: reservation.status,
                amount: reservation.reservationAmount
            },
            message: `Order created with ₹${reservation.reservationAmount} credit reserved`
        });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

**Example Request:**
```bash
POST /api/v1/orders
Content-Type: application/json

{
    "retailerId": "ret-123",
    "wholesalerId": "wh-456",
    "items": [
        { "productId": "prod-1", "quantity": 100 },
        { "productId": "prod-2", "quantity": 50 }
    ]
}

# Response:
{
    "success": true,
    "order": {
        "id": "ord-789",
        "orderNumber": "ORD-2026-0001",
        "totalAmount": 56500,
        "retailerId": "ret-123",
        "wholesalerId": "wh-456"
    },
    "creditReservation": {
        "id": "res-999",
        "status": "ACTIVE",
        "amount": 56500
    }
}
```

---

## 📋 Cancel Order Endpoint

```javascript
/**
 * POST /api/v1/orders/:orderId/cancel
 * Cancel order and release credit
 * 
 * Body:
 * {
 *   reason: string (optional),
 *   userId: string (user making the request)
 * }
 */
router.post('/api/v1/orders/:orderId/cancel', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason = 'CANCELLED_BY_USER', userId } = req.body;

        const orderService = require('../services/order.service');

        // Cancel order and release credit
        const result = await orderService.cancelOrderAndReleaseCredit(
            orderId,
            reason,
            userId
        );

        res.json({
            success: true,
            message: `Order ${orderId} cancelled and credit released`,
            order: {
                id: orderId,
                status: 'CANCELLED'
            },
            creditReleased: result.reservationAmount
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

---

## 📋 Deliver Order Endpoint

```javascript
/**
 * POST /api/v1/orders/:orderId/deliver
 * Mark order delivered and convert credit to DEBIT
 * 
 * Body:
 * {
 *   deliveryOTP: string (verification),
 *   dueDate: date (optional, defaults to 30 days)
 * }
 */
router.post('/api/v1/orders/:orderId/deliver', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { deliveryOTP, dueDate } = req.body;

        const orderService = require('../services/order.service');

        // Verify OTP (your existing logic)
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { deliveryOTP: true }
        });

        if (order.deliveryOTP !== deliveryOTP) {
            return res.status(401).json({
                success: false,
                error: 'INVALID_OTP'
            });
        }

        // Fulfill order and convert credit to DEBIT
        const result = await orderService.fulfillOrderAndConvertCredit(
            orderId,
            {
                dueDate: dueDate ? new Date(dueDate) : 
                    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
        );

        res.json({
            success: true,
            message: 'Order delivered and credit converted to ledger DEBIT',
            order: {
                id: orderId,
                status: 'DELIVERED',
                deliveredAt: result.order.deliveredAt
            },
            ledgerEntry: {
                id: result.ledgerEntry.id,
                type: 'DEBIT',
                amount: result.ledgerEntry.amount,
                dueDate: result.ledgerEntry.dueDate,
                balanceAfter: result.ledgerEntry.balanceAfter
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

---

## 📋 Get Available Credit Endpoint

```javascript
/**
 * GET /api/v1/credit/available/:retailerId/:wholesalerId
 * Get current available credit for a pair
 */
router.get('/api/v1/credit/available/:retailerId/:wholesalerId', async (req, res) => {
    try {
        const { retailerId, wholesalerId } = req.params;
        const creditReservationService = require('../services/creditReservation.service');

        const credit = await creditReservationService.getAvailableCredit(
            retailerId,
            wholesalerId
        );

        res.json({
            success: true,
            available: credit.available,
            limit: credit.limit,
            reserved: credit.reserved,
            debts: credit.debits,
            utilizationPercent: ((credit.reserved + credit.debits) / credit.limit * 100).toFixed(2),
            accountStatus: credit.isActive ? 'ACTIVE' : 'BLOCKED',
            activeReservations: credit.activeReservationCount,
            debitEntries: credit.debitEntryCount
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

**Example Response:**
```json
{
    "success": true,
    "available": 45000,
    "limit": 100000,
    "reserved": 30000,
    "debts": 25000,
    "utilizationPercent": "55.00",
    "accountStatus": "ACTIVE",
    "activeReservations": 3,
    "debitEntries": 5
}
```

---

## 📋 Get Reservation Details Endpoint

```javascript
/**
 * GET /api/v1/orders/:orderId/reservation
 * Get credit reservation details for an order
 */
router.get('/api/v1/orders/:orderId/reservation', async (req, res) => {
    try {
        const { orderId } = req.params;
        const creditReservationService = require('../services/creditReservation.service');

        const reservation = await creditReservationService.getReservation(orderId);

        res.json({
            success: true,
            reservation: {
                id: reservation.id,
                status: reservation.status,
                amount: reservation.reservationAmount,
                createdAt: reservation.createdAt,
                releasedAt: reservation.releasedAt,
                releasedReason: reservation.releasedReason,
                convertedAt: reservation.convertedAt,
                ledgerEntryId: reservation.ledgerEntryId
            },
            linkedOrder: reservation.order,
            linkedLedgerEntry: reservation.ledgerEntry
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

---

## 📋 WhatsApp Bot Integration Example

```javascript
/**
 * Handle WhatsApp message: "Check Credit"
 * Sends available credit info
 */
async function handleCheckCredit(retailerPhone) {
    const creditReservationService = require('../services/creditReservation.service');
    
    try {
        // Find retailer by phone
        const retailer = await prisma.retailer.findUnique({
            where: { whatsappNumber: retailerPhone }
        });

        if (!retailer) {
            return sendWhatsAppMessage(
                retailerPhone,
                'Retailer not found. Please contact support.'
            );
        }

        // Get first wholesaler (or let user select)
        const wholesaler = await prisma.wholesaler.findFirst({
            where: { isActive: true }
        });

        if (!wholesaler) {
            return sendWhatsAppMessage(
                retailerPhone,
                'No wholesalers available. Please try again later.'
            );
        }

        // Get available credit
        const credit = await creditReservationService.getAvailableCredit(
            retailer.id,
            wholesaler.id
        );

        // Format message
        const message = `
💳 *Credit Status* 💳

*Business:* ${retailer.pasalName}
*Wholesaler:* ${wholesaler.businessName}

💰 *Credit Limit:* Rs. ${credit.limit.toLocaleString('en-NP')}
✅ *Available:* Rs. ${credit.available.toLocaleString('en-NP')}
⏸️ *Reserved:* Rs. ${credit.reserved.toLocaleString('en-NP')}
📊 *Outstanding:* Rs. ${credit.debits.toLocaleString('en-NP')}

📈 *Utilization:* ${((credit.reserved + credit.debits) / credit.limit * 100).toFixed(1)}%

${credit.available > 0 ? '✅ You can place orders' : '❌ No credit available'}

Questions? Reply with "HELP"
        `.trim();

        await sendWhatsAppMessage(retailerPhone, message);

    } catch (error) {
        console.error('Error checking credit:', error);
        await sendWhatsAppMessage(
            retailerPhone,
            'Error checking credit. Please try again.'
        );
    }
}
```

---

## 🔍 Error Handling

```javascript
/**
 * Standard error responses
 */

// INSUFFICIENT_CREDIT (402 Payment Required)
{
    "success": false,
    "error": "INSUFFICIENT_CREDIT",
    "message": "Order amount Rs. 50000 exceeds available credit Rs. 30000",
    "available": 30000,
    "required": 50000,
    "shortfall": 20000,
    "solution": "Pay down existing debt or request credit limit increase"
}

// CREDIT_ACCOUNT_BLOCKED (403 Forbidden)
{
    "success": false,
    "error": "CREDIT_ACCOUNT_BLOCKED",
    "message": "Credit account is blocked",
    "reason": "Overdue payment",
    "solution": "Contact your wholesaler to unblock"
}

// RESERVATION_NOT_FOUND (404 Not Found)
{
    "success": false,
    "error": "RESERVATION_NOT_FOUND",
    "message": "No credit reservation found for order ord-123",
    "solution": "Order may not have been validated yet"
}

// INVALID_STATE (400 Bad Request)
{
    "success": false,
    "error": "INVALID_STATE",
    "message": "Cannot release reservation that is already CONVERTED_TO_DEBIT",
    "currentStatus": "CONVERTED_TO_DEBIT",
    "solution": "Reservation has already been converted to debt"
}
```

---

## 🧪 cURL Examples

### Check Credit Availability
```bash
curl -X GET \
  "http://localhost:3000/api/v1/credit/check-order?retailerId=ret-123&wholesalerId=wh-456&amount=50000" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create Order
```bash
curl -X POST \
  "http://localhost:3000/api/v1/orders" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "retailerId": "ret-123",
    "wholesalerId": "wh-456",
    "items": [
      { "productId": "prod-1", "quantity": 100 }
    ]
  }'
```

### Cancel Order
```bash
curl -X POST \
  "http://localhost:3000/api/v1/orders/ord-789/cancel" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "CANCELLED_BY_USER",
    "userId": "user-123"
  }'
```

### Deliver Order
```bash
curl -X POST \
  "http://localhost:3000/api/v1/orders/ord-789/deliver" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryOTP": "1234"
  }'
```

### Get Available Credit
```bash
curl -X GET \
  "http://localhost:3000/api/v1/credit/available/ret-123/wh-456" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

**Ready to integrate?** These examples provide complete API endpoint implementations for credit reservation. Adapt them to your framework and existing auth/error handling patterns.
