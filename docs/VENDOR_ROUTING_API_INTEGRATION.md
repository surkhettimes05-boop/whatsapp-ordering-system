# Multi-Vendor Routing - API Integration Guide

## Overview

This guide shows how to integrate the Multi-Vendor Routing System into your application via REST APIs and WhatsApp webhook handlers.

## REST API Endpoints

### 1. Broadcast Order to Vendors

**Endpoint**: `POST /api/orders/:orderId/route-to-vendors`

**Purpose**: Initiate vendor routing for an order

**Request**:
```json
{
  "orderId": "order-123",
  "retailerId": "retailer-456",
  "productRequested": "Cocoa Powder"
}
```

**Implementation**:
```javascript
// routes/orderRouting.js
const express = require('express');
const router = express.Router();
const VendorRoutingService = require('../src/services/vendorRouting.service');

router.post('/orders/:orderId/route-to-vendors', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { retailerId, productRequested } = req.body;

    // Validate input
    if (!retailerId || !productRequested) {
      return res.status(400).json({
        error: 'Missing retailerId or productRequested'
      });
    }

    // Route to vendors
    const result = await VendorRoutingService.routeOrderToVendors(
      orderId,
      retailerId,
      productRequested
    );

    res.json({
      success: true,
      routingId: result.routingId,
      vendorCount: result.vendorCount,
      vendors: result.vendors
    });
  } catch (error) {
    console.error('Routing error:', error);
    res.status(500).json({
      error: error.message || 'Routing failed'
    });
  }
});

module.exports = router;
```

**Response (Success)**:
```json
{
  "success": true,
  "routingId": "uuid-123",
  "vendorCount": 8,
  "vendors": [
    {
      "id": "wholesaler-1",
      "businessName": "ABC Wholesale",
      "score": 89.5
    },
    ...
  ]
}
```

**Response (Error)**:
```json
{
  "error": "No eligible vendors found"
}
```

---

### 2. Record Vendor Response

**Endpoint**: `POST /api/routing/:routingId/vendor-response`

**Purpose**: Record vendor's response to order broadcast

**Request**:
```json
{
  "wholesalerId": "wholesaler-1",
  "responseType": "ACCEPT",
  "metadata": {
    "responseTime": 2500,
    "payload": {
      "price": 450,
      "quantity": 20,
      "deliveryTime": "2 hours"
    }
  }
}
```

**Implementation**:
```javascript
router.post('/routing/:routingId/vendor-response', async (req, res) => {
  try {
    const { routingId } = req.params;
    const { wholesalerId, responseType, metadata = {} } = req.body;

    // Validate input
    const validTypes = ['ACCEPT', 'REJECT', 'TIMEOUT', 'ERROR'];
    if (!validTypes.includes(responseType)) {
      return res.status(400).json({
        error: 'Invalid responseType'
      });
    }

    // Record response
    const response = await VendorRoutingService.respondToVendor(
      routingId,
      wholesalerId,
      responseType,
      metadata
    );

    res.json({
      success: true,
      responseId: response.id,
      responseType: response.responseType,
      createdAt: response.createdAt
    });
  } catch (error) {
    console.error('Response error:', error);
    res.status(500).json({
      error: error.message || 'Failed to record response'
    });
  }
});
```

**Response (Success)**:
```json
{
  "success": true,
  "responseId": "response-uuid",
  "responseType": "ACCEPT",
  "createdAt": "2025-01-21T10:30:00Z"
}
```

---

### 3. Accept Order (Race-Safe)

**Endpoint**: `POST /api/routing/:routingId/accept`

**Purpose**: Vendor accepts order (race-safe operation)

**Request**:
```json
{
  "wholesalerId": "wholesaler-1"
}
```

**Implementation**:
```javascript
router.post('/routing/:routingId/accept', async (req, res) => {
  try {
    const { routingId } = req.params;
    const { wholesalerId } = req.body;

    // Attempt to accept (race-safe)
    const result = await VendorRoutingService.acceptVendor(
      routingId,
      wholesalerId
    );

    if (result.accepted) {
      // Update order in database
      await prisma.order.update({
        where: { id: /* get from routing */ },
        data: {
          finalWholesalerId: wholesalerId,
          status: 'VENDOR_ACCEPTED'
        }
      });

      res.json({
        success: true,
        message: 'Order accepted! Lock acquired.',
        accepted: true,
        lockedVendor: result.lockedVendor
      });
    } else {
      res.json({
        success: true,
        message: 'Order already accepted by another vendor',
        accepted: false,
        reason: result.reason,
        lockedVendor: result.lockedVendor
      });
    }
  } catch (error) {
    console.error('Accept error:', error);
    res.status(500).json({
      error: error.message || 'Failed to accept order'
    });
  }
});
```

**Response (Won Race)**:
```json
{
  "success": true,
  "accepted": true,
  "message": "Order accepted! Lock acquired.",
  "lockedVendor": "wholesaler-1"
}
```

**Response (Lost Race)**:
```json
{
  "success": true,
  "accepted": false,
  "message": "Order already accepted by another vendor",
  "reason": "LOST_RACE",
  "lockedVendor": "wholesaler-2"
}
```

---

### 4. Get Routing Status

**Endpoint**: `GET /api/routing/:routingId/status`

**Purpose**: Get complete routing status

**Implementation**:
```javascript
router.get('/routing/:routingId/status', async (req, res) => {
  try {
    const { routingId } = req.params;

    const status = await VendorRoutingService.getRoutingStatus(routingId);

    res.json({
      success: true,
      status: status.status,
      lockedVendor: status.lockedVendor,
      lockedAt: status.lockedAt,
      vendorResponses: {
        accepted: status.acceptedCount,
        rejected: status.rejectedCount,
        timeout: status.timeoutCount,
        cancelled: status.cancelledCount
      },
      responses: status.responses
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({
      error: error.message || 'Failed to get status'
    });
  }
});
```

**Response**:
```json
{
  "success": true,
  "status": "LOCKED",
  "lockedVendor": "wholesaler-1",
  "lockedAt": "2025-01-21T10:35:00Z",
  "vendorResponses": {
    "accepted": 1,
    "rejected": 3,
    "timeout": 2,
    "cancelled": 4
  },
  "responses": [
    {
      "vendorId": "wholesaler-1",
      "vendorName": "ABC Wholesale",
      "responseType": "ACCEPT",
      "acceptedAt": "2025-01-21T10:35:00Z",
      "cancelled": false
    },
    ...
  ]
}
```

---

## WhatsApp Integration

### Incoming Message Handler

When vendors send WhatsApp messages with order responses, process them here:

```javascript
// webhooks/whatsapp.js
const express = require('express');
const router = express.Router();
const VendorRoutingService = require('../src/services/vendorRouting.service');
const { prisma } = require('../db');

/**
 * Handle incoming WhatsApp messages
 * Message format: "ORDER <order_number> ACCEPT|REJECT"
 * Example: "ORDER ORD-20250121-001 ACCEPT"
 */
router.post('/webhook/whatsapp', async (req, res) => {
  try {
    const { from, body } = req.body;

    // Parse message
    // Format: "ACCEPT|REJECT|TIMEOUT" or "ORDER <id> ACCEPT"
    const messageText = body.trim().toUpperCase();

    // Find vendor by phone number
    const vendor = await prisma.wholesaler.findUnique({
      where: { whatsappNumber: from }
    });

    if (!vendor) {
      console.log(`Unknown vendor: ${from}`);
      return res.status(200).json({ ok: true }); // Don't error, just ignore
    }

    // Extract response type (ACCEPT or REJECT)
    let responseType = 'REJECT'; // Default
    if (messageText.includes('ACCEPT') || messageText.includes('✓')) {
      responseType = 'ACCEPT';
    } else if (
      messageText.includes('REJECT') ||
      messageText.includes('STOCK') ||
      messageText.includes('NO')
    ) {
      responseType = 'REJECT';
    }

    // Find the most recent routing for this vendor
    // In production, you'd maintain a mapping of orders to vendors
    const recentRouting = await prisma.vendorRouting.findFirst({
      where: {
        // Filter by eligible vendors (parse JSON)
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!recentRouting) {
      console.log('No recent routing found for vendor');
      return res.status(200).json({ ok: true });
    }

    // Record response
    const response = await VendorRoutingService.respondToVendor(
      recentRouting.id,
      vendor.id,
      responseType,
      {
        responseTime: Date.now() - recentRouting.createdAt.getTime(),
        payload: { rawMessage: messageText }
      }
    );

    console.log(
      `[WHATSAPP] Vendor ${vendor.businessName} responded: ${responseType}`
    );

    // If ACCEPT, attempt to lock order
    if (responseType === 'ACCEPT') {
      const acceptResult = await VendorRoutingService.acceptVendor(
        recentRouting.id,
        vendor.id
      );

      if (acceptResult.accepted) {
        // Send confirmation
        await sendWhatsAppMessage(
          from,
          `✓ Order confirmed!\n\nYour order has been locked.\nOrder ID: ${recentRouting.orderId}`
        );

        console.log(`[WHATSAPP] Sent confirmation to ${vendor.businessName}`);
      } else {
        // Send rejection
        await sendWhatsAppMessage(
          from,
          `✗ Another vendor accepted this order first.\nBetter luck next time!`
        );

        console.log(
          `[WHATSAPP] Order already taken by ${acceptResult.lockedVendor}`
        );
      }
    } else if (responseType === 'REJECT') {
      // Send acknowledgement
      await sendWhatsAppMessage(from, `✓ Noted. We'll offer other orders soon.`);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

async function sendWhatsAppMessage(to, message) {
  // Use Twilio or your WhatsApp provider
  // Example with Twilio:
  const twilio = require('twilio');
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to: to,
    body: message
  });
}

module.exports = router;
```

### Alternative: Direct API Integration

If vendors use mobile app instead of WhatsApp:

```javascript
// Mobile app vendor response
async function acceptOrderFromApp(routingId, vendorId) {
  const response = await fetch(
    `https://api.example.com/routing/${routingId}/accept`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wholesalerId: vendorId
      })
    }
  );

  const result = await response.json();

  if (result.accepted) {
    // Show success toast
    showNotification('Order Locked! 🎉');
  } else {
    // Show error
    showNotification(
      `Another vendor was faster: ${result.lockedVendor}`
    );
  }

  return result;
}
```

---

## Order Service Integration

### Step 1: Update order creation flow

```javascript
// services/order.service.js

async function createAndRouteOrder(orderData) {
  // 1. Create order
  const order = await prisma.order.create({
    data: {
      ...orderData,
      status: 'CREATED'
    }
  });

  // 2. Validate and reserve credit
  await creditReservationService.reserveCredit(
    order.retailerId,
    order.wholesalerId,
    order.id,
    order.totalAmount
  );

  // 3. Update order status
  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'CREDIT_RESERVED' }
  });

  // 4. Route to vendors (multi-vendor broadcast)
  try {
    const routeResult = await VendorRoutingService.routeOrderToVendors(
      order.id,
      order.retailerId,
      order.productName // or extract from orderItems
    );

    // 5. Update order status to PENDING_BIDS
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'PENDING_BIDS',
        // Store routing ID for later reference
        vendorRoutingId: routeResult.routingId
      }
    });

    return {
      orderId: order.id,
      routingId: routeResult.routingId,
      vendorCount: routeResult.vendorCount
    };
  } catch (error) {
    // Fallback: Release credit if routing fails
    await creditReservationService.releaseReservation(
      order.retailerId,
      order.wholesalerId,
      order.id
    );

    throw error;
  }
}
```

### Step 2: Handle vendor acceptance in order service

```javascript
async function handleVendorAcceptance(routingId, vendorId) {
  // 1. Attempt race-safe acceptance
  const acceptResult = await VendorRoutingService.acceptVendor(
    routingId,
    vendorId
  );

  if (!acceptResult.accepted) {
    throw new Error('Order already accepted by another vendor');
  }

  // 2. Get routing to find order
  const routing = await prisma.vendorRouting.findUnique({
    where: { id: routingId }
  });

  const order = routing.order;

  // 3. Update order with winning vendor
  await prisma.order.update({
    where: { id: order.id },
    data: {
      finalWholesalerId: vendorId,
      wholesalerId: vendorId,
      status: 'VENDOR_ACCEPTED',
      confirmedAt: new Date()
    }
  });

  // 4. No need to release credit - it stays reserved
  // Credit will convert to DEBIT when order fulfills

  // 5. Notify retailer
  await notificationService.notifyRetailer(order.retailerId, {
    type: 'ORDER_ACCEPTED',
    orderId: order.id,
    vendorName: vendor.businessName,
    message: `Order accepted by ${vendor.businessName}`
  });

  return {
    orderId: order.id,
    acceptedVendor: vendorId
  };
}
```

---

## State Machine Integration

### New States

Add to order status enum:

```prisma
enum OrderStatus {
  // ... existing states ...
  PENDING_BIDS       // Order broadcasted, waiting for vendor
  VENDOR_ACCEPTED    // Vendor accepted the order
  // ... more states ...
}
```

### State Transitions

```javascript
// State machine handler
async function transitionToPendingBids(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId }
  });

  // Must be CREDIT_RESERVED before entering PENDING_BIDS
  if (order.status !== 'CREDIT_RESERVED') {
    throw new Error('Invalid state transition');
  }

  const routeResult = await VendorRoutingService.routeOrderToVendors(
    orderId,
    order.retailerId,
    order.productName
  );

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'PENDING_BIDS'
    }
  });

  return routeResult;
}

async function transitionToVendorAccepted(orderId, vendorId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId }
  });

  // Must be PENDING_BIDS before entering VENDOR_ACCEPTED
  if (order.status !== 'PENDING_BIDS') {
    throw new Error('Invalid state transition');
  }

  // This calls acceptVendor() internally
  await orderService.handleVendorAcceptance(
    order.vendorRoutingId,
    vendorId
  );

  // Update status
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'VENDOR_ACCEPTED' }
  });
}
```

---

## Monitoring & Debugging

### Check Routing Status

```javascript
async function debugOrder(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { vendorRoutings: true }
  });

  const routing = order.vendorRoutings[0];

  if (!routing) {
    console.log('No routing found');
    return;
  }

  const status = await VendorRoutingService.getRoutingStatus(routing.id);

  console.log(`Order: ${orderId}`);
  console.log(`Status: ${status.status}`);
  console.log(`Locked vendor: ${status.lockedVendor}`);
  console.log(`Responses: ${status.acceptedCount} accepted, ${status.rejectedCount} rejected`);
  console.log(`Cancelled: ${status.cancelledCount}`);

  // Show all responses
  console.log('\nAll responses:');
  status.responses.forEach((r) => {
    console.log(
      `  ${r.vendorName}: ${r.responseType} at ${r.createdAt}`
    );
  });
}
```

### Check Events

```javascript
async function showOrderEvents(orderId) {
  const events = await prisma.orderEvent.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' }
  });

  events.forEach((e) => {
    console.log(`[${e.createdAt}] ${e.eventType}`);
    console.log(`  ${JSON.stringify(e.payload, null, 2)}`);
  });
}
```

---

## Testing the Integration

### Complete Flow Test

```javascript
// Test the entire flow
async function testCompleteFlow() {
  console.log('Testing complete multi-vendor routing flow...\n');

  // 1. Create order
  const order = await createTestOrder();
  console.log(`✓ Order created: ${order.id}`);

  // 2. Route to vendors
  const routeResult = await VendorRoutingService.routeOrderToVendors(
    order.id,
    order.retailerId,
    'Test Product'
  );
  console.log(
    `✓ Routed to ${routeResult.vendorCount} vendors, Routing ID: ${routeResult.routingId}`
  );

  // 3. Vendors respond
  for (let i = 0; i < 3; i++) {
    await VendorRoutingService.respondToVendor(
      routeResult.routingId,
      routeResult.vendors[i].id,
      'ACCEPT'
    );
  }
  console.log(`✓ 3 vendors responded ACCEPT`);

  // 4. First vendor wins race
  const acceptResult = await VendorRoutingService.acceptVendor(
    routeResult.routingId,
    routeResult.vendors[0].id
  );
  console.log(
    `✓ Vendor ${acceptResult.lockedVendor.slice(0, 8)} won the race!`
  );

  // 5. Check final status
  const status = await VendorRoutingService.getRoutingStatus(
    routeResult.routingId
  );
  console.log(`✓ Final status: ${status.status}`);
  console.log(`  Cancelled: ${status.cancelledCount}`);

  console.log('\n✓ Complete flow test PASSED');
}
```

---

## Deployment Checklist

- [ ] Run database migration: `npx prisma migrate deploy`
- [ ] Deploy VendorRoutingService code
- [ ] Add REST API endpoints
- [ ] Add WhatsApp webhook handler
- [ ] Update order service integration
- [ ] Add monitoring/logging
- [ ] Run test suite
- [ ] Test with 10 simultaneous vendors
- [ ] Monitor database performance
- [ ] Update frontend to handle PENDING_BIDS state
- [ ] Update retailer notifications

---

## See Also

- [Multi-Vendor Routing - Complete Documentation](./VENDOR_ROUTING_COMPLETE.md)
- [Multi-Vendor Routing - Quick Reference](./VENDOR_ROUTING_QUICK_REF.md)
- [Order Service](./src/services/order.service.js)
- [Vendor Routing Service](./src/services/vendorRouting.service.js)
