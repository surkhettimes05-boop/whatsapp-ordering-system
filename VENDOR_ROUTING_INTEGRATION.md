# Vendor Routing - Order Service Integration

Complete step-by-step guide to integrate the race-safe vendor routing system into your order creation flow.

## 🎯 Integration Overview

When an order is created:
1. Order record saved to database
2. **NEW**: Routing created and sent to matching vendors
3. Vendors respond with ACCEPT/REJECT via WhatsApp
4. First vendor to accept wins (race-safe)
5. Non-winners automatically notified

---

## 📝 Step 1: Update Order Service

### File: `backend/src/services/order.service.js`

**Add at the top (after other imports):**

```javascript
const VendorRoutingService = require('./vendorRouting.service');
const logger = require('../utils/logger');

// Add helper to find matching vendors by category
async function findVendorsForCategory(category) {
  try {
    const vendors = await prisma.wholesaler.findMany({
      where: {
        categories: {
          contains: category
        },
        isActive: true,
        isVerified: true
      },
      select: {
        id: true,
        businessName: true,
        whatsappNumber: true,
        phoneNumber: true
      }
    });
    return vendors;
  } catch (error) {
    logger.error('Error finding vendors for category:', error);
    return [];
  }
}
```

**Update `createOrder()` method:**

```javascript
async createOrder(retailerId, items) {
  try {
    // 1. Validate retailer exists
    const retailer = await prisma.retailer.findUnique({
      where: { id: retailerId }
    });

    if (!retailer) {
      throw new AppError('Retailer not found', ErrorTypes.NOT_FOUND);
    }

    // 2. Create order record
    const order = await prisma.order.create({
      data: {
        retailerId,
        orderNumber: `ORDER-${Date.now()}`,
        totalAmount: calculateTotal(items),
        status: 'CREATED',
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            priceAtTime: item.priceAtTime
          }))
        }
      },
      include: { items: true }
    });

    logger.info(`Order created: ${order.id}`);

    // 3. VENDOR ROUTING: Route order to vendors
    try {
      const primaryCategory = items[0]?.category || 'General';
      
      const routing = await VendorRoutingService.routeOrderToVendors(
        order.id,
        retailerId,
        primaryCategory
      );

      logger.info(`Order routed to vendors: routing-${routing.routingId}`);

      // 4. VENDOR ROUTING: Find matching vendors and notify them
      const matchingVendors = await findVendorsForCategory(primaryCategory);

      if (matchingVendors.length === 0) {
        logger.warn(`No vendors found for category: ${primaryCategory}`);
        // Fall back to manual order management
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'NO_VENDORS_AVAILABLE' }
        });
      } else {
        // Send WhatsApp notifications to all matching vendors
        for (const vendor of matchingVendors) {
          try {
            await sendVendorRoutingNotification(
              vendor,
              order,
              routing.routingId
            );
          } catch (error) {
            logger.error(`Failed to notify vendor ${vendor.id}:`, error);
            // Continue notifying other vendors even if one fails
          }
        }

        // Update order status to PENDING_BIDS
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'PENDING_BIDS' }
        });

        logger.info(`Order ${order.id} in PENDING_BIDS state, notified ${matchingVendors.length} vendors`);
      }
    } catch (routingError) {
      logger.error('Failed to route order to vendors:', routingError);
      
      // Order was created but routing failed
      // This is a recoverable error - order exists but vendors weren't notified
      // Could trigger manual intervention or retry queue
      
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'ROUTING_FAILED' }
      });
      
      throw routingError; // Re-throw so caller knows routing failed
    }

    return order;
  } catch (error) {
    logger.error('Error creating order:', error);
    throw error;
  }
}
```

**Add helper function to send WhatsApp notifications:**

```javascript
async function sendVendorRoutingNotification(vendor, order, routingId) {
  const whatsappService = require('./whatsapp.service');
  
  const message = `
🛒 NEW ORDER AVAILABLE

Order ID: ${order.id}
Items: ${order.items.length} products
Total: Rs. ${order.totalAmount}

Category: ${order.items[0]?.category || 'General'}

To accept: Reply "ACCEPT ${routingId}"
To reject: Reply "REJECT ${routingId}"

⏰ Respond within 5 minutes!
  `.trim();

  await whatsappService.sendMessage(vendor.whatsappNumber, message);
}

function calculateTotal(items) {
  return items.reduce((sum, item) => {
    return sum + (item.priceAtTime * item.quantity);
  }, 0);
}
```

---

## 📲 Step 2: Update WhatsApp Webhook Handler

### File: `backend/src/services/whatsapp.service.js`

**Add vendor routing response handler:**

```javascript
async function handleVendorRoutingResponse(from, message, vendorId) {
  const VendorRoutingService = require('./vendorRouting.service');
  
  // Parse message: "ACCEPT routing-123" or "REJECT routing-123"
  const parts = message.trim().split(' ');
  const action = parts[0]?.toUpperCase();
  const routingId = parts[1];

  if (!action || !routingId) {
    await sendMessage(from, '❌ Invalid format. Reply: ACCEPT routing-id or REJECT routing-id');
    return;
  }

  try {
    if (action === 'ACCEPT') {
      // Step 1: Record acceptance
      await VendorRoutingService.respondToVendor(routingId, vendorId, 'ACCEPTED');

      // Step 2: Attempt to win the race
      try {
        const result = await VendorRoutingService.acceptVendor(routingId, vendorId);
        
        await sendMessage(
          from,
          `✅ Order accepted!\n\nYou won the bid for order ${result.routingId}\n\nProceed to checkout`
        );

        logger.info(`Vendor ${vendorId} won routing ${routingId}`);
      } catch (acceptError) {
        if (acceptError.message.includes('already accepted')) {
          await sendMessage(
            from,
            '❌ Another vendor already accepted this order\n\nBetter luck next time!'
          );
        } else {
          throw acceptError;
        }
      }
    } else if (action === 'REJECT') {
      // Record rejection
      await VendorRoutingService.respondToVendor(routingId, vendorId, 'REJECTED');
      
      await sendMessage(from, '👍 Order request rejected.');
      logger.info(`Vendor ${vendorId} rejected routing ${routingId}`);
    } else {
      await sendMessage(from, '❌ Invalid action. Reply: ACCEPT or REJECT followed by routing-id');
    }
  } catch (error) {
    logger.error('Error handling vendor routing response:', error);
    await sendMessage(from, '❌ Error processing your response. Please try again.');
  }
}

// Update main message handler to detect routing responses
async function handleIncomingMessage(message) {
  const { from, body } = message;
  
  // Check if this is a vendor routing response
  if (body.includes('ACCEPT') || body.includes('REJECT')) {
    const vendorId = await getVendorIdByPhone(from);
    if (vendorId) {
      await handleVendorRoutingResponse(from, body, vendorId);
      return;
    }
  }

  // ... existing message handling ...
}
```

---

## 🔄 Step 3: Create Vendor Acceptance Timeout Handler

### New File: `backend/src/jobs/vendorRoutingTimeout.job.js`

```javascript
/**
 * Vendor Routing Timeout Job
 * 
 * Marks vendor responses as timed out if no acceptance within 5 minutes
 * Runs every 30 seconds
 */

const agenda = require('../config/agenda'); // BullMQ or similar job queue
const prisma = require('../config/database');
const VendorRoutingService = require('../services/vendorRouting.service');
const logger = require('../utils/logger');

// 5 minutes timeout
const VENDOR_RESPONSE_TIMEOUT = 5 * 60 * 1000;

async function handleVendorRoutingTimeouts() {
  try {
    // Find routings that are still PENDING_RESPONSES but expired
    const cutoffTime = new Date(Date.now() - VENDOR_RESPONSE_TIMEOUT);

    const expiredRoutings = await prisma.vendorRouting.findMany({
      where: {
        status: 'PENDING_RESPONSES',
        createdAt: {
          lt: cutoffTime
        }
      },
      include: {
        vendorResponses: true
      }
    });

    for (const routing of expiredRoutings) {
      // Mark all vendors who didn't respond as timed out
      const respondingVendorIds = routing.vendorResponses.map(r => r.vendorId);
      
      // Find all vendors that were contacted but didn't respond
      const allVendors = await findVendorsForCategory(routing.productCategory);
      const timeoutVendors = allVendors.filter(v => !respondingVendorIds.includes(v.id));

      for (const vendor of timeoutVendors) {
        try {
          await VendorRoutingService.timeoutVendor(routing.id, vendor.id);
          logger.info(`Timeout: Vendor ${vendor.id} for routing ${routing.id}`);
        } catch (error) {
          logger.error(`Failed to timeout vendor ${vendor.id}:`, error);
        }
      }

      // If no one accepted, mark as EXPIRED
      if (routing.status === 'PENDING_RESPONSES') {
        await prisma.vendorRouting.update({
          where: { id: routing.id },
          data: { status: 'EXPIRED' }
        });

        // Update order status
        await prisma.order.update({
          where: { id: routing.orderId },
          data: { status: 'NO_VENDOR_ACCEPTED' }
        });

        logger.warn(`Routing ${routing.id} expired - no vendor accepted`);
      }
    }
  } catch (error) {
    logger.error('Error in vendor routing timeout handler:', error);
  }
}

// Register with job queue (BullMQ example)
module.exports = {
  name: 'vendor-routing-timeout',
  handler: handleVendorRoutingTimeouts,
  schedule: '*/30 * * * * *' // Every 30 seconds
};
```

---

## 📊 Step 4: Update Order State Machine

### File: `backend/src/services/orderStateMachine.service.js`

**Add new states:**

```javascript
const ORDER_STATES = {
  'CREATED': 'Initial order state',
  'PENDING_BIDS': 'Waiting for vendor responses (NEW)',
  'VENDOR_ACCEPTED': 'A vendor has accepted the order (NEW)',
  'PAYMENT_PENDING': 'Awaiting payment',
  'CONFIRMED': 'Order confirmed with vendor',
  'PROCESSING': 'Order being processed',
  'SHIPPED': 'Order shipped',
  'DELIVERED': 'Order delivered',
  'CANCELLED': 'Order cancelled',
  'NO_VENDORS_AVAILABLE': 'No vendors match criteria (NEW)',
  'NO_VENDOR_ACCEPTED': 'Timeout - no vendor accepted (NEW)',
  'ROUTING_FAILED': 'Failed to route to vendors (NEW)'
};

// State transition rules
const VALID_TRANSITIONS = {
  'CREATED': ['PENDING_BIDS', 'CANCELLED'],
  'PENDING_BIDS': ['VENDOR_ACCEPTED', 'NO_VENDOR_ACCEPTED', 'CANCELLED'],
  'VENDOR_ACCEPTED': ['PAYMENT_PENDING', 'CANCELLED'],
  'PAYMENT_PENDING': ['CONFIRMED', 'CANCELLED'],
  'CONFIRMED': ['PROCESSING', 'CANCELLED'],
  'PROCESSING': ['SHIPPED', 'CANCELLED'],
  'SHIPPED': ['DELIVERED'],
  'DELIVERED': [],
  'CANCELLED': [],
  'NO_VENDORS_AVAILABLE': ['CANCELLED'],
  'NO_VENDOR_ACCEPTED': ['CANCELLED', 'PENDING_BIDS'], // Can retry
  'ROUTING_FAILED': ['PENDING_BIDS', 'CANCELLED'] // Can retry or cancel
};
```

---

## 🧪 Step 5: Integration Tests

### File: `backend/test/integration/vendorRouting.integration.test.js`

```javascript
const { describe, it, before, after } = require('mocha');
const assert = require('assert');
const prisma = require('../../src/config/database');
const VendorRoutingService = require('../../src/services/vendorRouting.service');
const orderService = require('../../src/services/order.service');

describe('Vendor Routing Integration', () => {
  let testOrder, testRouting;

  before(async () => {
    // Setup: Create test retailer and vendor
    // ...
  });

  after(async () => {
    // Cleanup
    // ...
  });

  it('should create order and route to vendors', async () => {
    const retailer = await createTestRetailer();
    
    const order = await orderService.createOrder(retailer.id, [
      { productId: 'prod-1', quantity: 10, priceAtTime: 100 }
    ]);

    assert(order.status === 'PENDING_BIDS', 'Order should be in PENDING_BIDS');
    
    const routing = await prisma.vendorRouting.findFirst({
      where: { orderId: order.id }
    });
    
    assert(routing, 'Should have routing record');
    assert.equal(routing.status, 'PENDING_RESPONSES');
  });

  it('should handle vendor responses correctly', async () => {
    const routing = testRouting;
    
    // Vendor accepts
    await VendorRoutingService.respondToVendor(
      routing.id,
      'vendor-1',
      'ACCEPTED'
    );

    // Vendor rejects
    await VendorRoutingService.respondToVendor(
      routing.id,
      'vendor-2',
      'REJECTED'
    );

    const status = await VendorRoutingService.getRoutingStatus(routing.id);
    
    assert.equal(status.acceptedCount, 1);
    assert.equal(status.rejectedCount, 1);
  });

  it('should handle race condition safely', async () => {
    // Simulate 5 vendors accepting simultaneously
    const vendorIds = ['v1', 'v2', 'v3', 'v4', 'v5'];
    
    const promises = vendorIds.map(vid =>
      VendorRoutingService.acceptVendor(testRouting.id, vid)
        .catch(e => ({ error: e.message }))
    );

    const results = await Promise.all(promises);
    const successes = results.filter(r => !r.error);
    const failures = results.filter(r => r.error);

    assert.equal(successes.length, 1, 'Only 1 should succeed');
    assert.equal(failures.length, 4, '4 should fail');
  });
});
```

---

## 🚀 Deployment Checklist

- [ ] Order service updated with routing integration
- [ ] WhatsApp handler updated for ACCEPT/REJECT responses
- [ ] Timeout job configured and scheduled
- [ ] Order state machine updated with new states
- [ ] Database migration applied (`npx prisma migrate deploy`)
- [ ] API endpoints available at `/api/v1/vendor-routing/*`
- [ ] Integration tests passing
- [ ] Error handling for routing failures
- [ ] Logging set up for vendor routing events
- [ ] Production deployment validated

---

## 📞 Testing Locally

```bash
# 1. Start database
docker-compose up -d postgres

# 2. Run migration
npx prisma migrate deploy

# 3. Test vendor routing
npm run test -- vendorRouting.integration.test.js

# 4. Start server
npm run dev

# 5. Create test order
curl -X POST http://localhost:5000/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "retailerId": "retailer-123",
    "items": [
      { "productId": "prod-1", "quantity": 10, "priceAtTime": 100 }
    ]
  }'

# 6. Check routing status
curl http://localhost:5000/api/v1/vendor-routing/routing-123/status
```

---

## 🎯 Production Considerations

1. **Error Handling**: All routing failures should be logged and monitored
2. **Timeout Configuration**: Adjust VENDOR_RESPONSE_TIMEOUT based on your business needs
3. **Vendor Notification**: Use reliable WhatsApp/SMS delivery service
4. **Database Backups**: Ensure regular backups before production
5. **Monitoring**: Track routing success rates and vendor response times
6. **Logging**: Log all vendor decisions for audit trail

