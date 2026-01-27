# Multi-Vendor Routing - Quick Reference

## Installation

1. Run migration:
```bash
npx prisma migrate deploy
```

2. Import service:
```javascript
const VendorRoutingService = require('./src/services/vendorRouting.service');
```

## Usage Examples

### 1. Broadcast Order to Vendors

```javascript
// When order validated and credit reserved
const result = await VendorRoutingService.routeOrderToVendors(
  'order-id-123',
  'retailer-id-456',
  'Cocoa Powder'
);

console.log(`Broadcasted to ${result.vendorCount} vendors`);
// Output: Broadcasted to 8 vendors
```

### 2. Record Vendor Response

```javascript
// When vendor responds via WhatsApp or API
await VendorRoutingService.respondToVendor(
  'routing-id-789',
  'wholesaler-id-101',
  'ACCEPT',  // or 'REJECT', 'TIMEOUT'
  {
    responseTime: 3500,  // milliseconds
    payload: { price: 450, quantity: 20 }
  }
);
```

### 3. Vendor Attempts to Accept (RACE-SAFE)

```javascript
// When vendor sends ACCEPT message
const result = await VendorRoutingService.acceptVendor(
  'routing-id-789',
  'wholesaler-id-101'
);

if (result.accepted) {
  console.log('✓ Order locked! You won the race');
  // Update Order.finalWholesalerId = wholesaler-id-101
  // Update Order.status = VENDOR_ACCEPTED
} else {
  console.log(`✗ Another vendor accepted first: ${result.lockedVendor}`);
  // Send auto-cancel message
  // Mark order as fulfilled by other vendor
}
```

### 4. Check Routing Status

```javascript
const status = await VendorRoutingService.getRoutingStatus('routing-id-789');

console.log(`Status: ${status.status}`);
console.log(`Vendor responses: ${status.responses.length}`);
console.log(`  - Accepted: ${status.acceptedCount}`);
console.log(`  - Rejected: ${status.rejectedCount}`);
console.log(`  - Timeout: ${status.timeoutCount}`);
console.log(`  - Cancelled: ${status.cancelledCount}`);
```

## Race Condition: The 10-Vendor Test

```javascript
// Simulate 10 vendors all trying to accept simultaneously
const vendors = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10'];

const results = await Promise.all(
  vendors.map(vid => VendorRoutingService.acceptVendor('routing-123', vid))
);

const winners = results.filter(r => r.accepted);
const losers = results.filter(r => !r.accepted);

console.log(`Winners: ${winners.length}`);  // Should be exactly 1
console.log(`Losers: ${losers.length}`);    // Should be exactly 9
```

## Database Schema

### VendorRouting Table
```sql
CREATE TABLE vendor_routings (
  id UUID PRIMARY KEY,
  orderId UUID UNIQUE,           -- Links to Order
  retailerId UUID,               -- Links to Retailer
  
  eligibleVendors JSON,          -- [{ wholesalerId, score }, ...]
  
  lockedWholesalerId UUID NULL,  -- Winning vendor
  lockedAt TIMESTAMP NULL,       -- When lock acquired
  
  version INT,                   -- Optimistic lock version
  
  UNIQUE(orderId, lockedWholesalerId)  -- ONE LOCK PER ORDER
);
```

### VendorResponse Table
```sql
CREATE TABLE vendor_responses (
  id UUID PRIMARY KEY,
  vendorRoutingId UUID,    -- Links to VendorRouting
  wholesalerId UUID,       -- Links to Wholesaler
  
  responseType VARCHAR,    -- ACCEPT | REJECT | TIMEOUT | ERROR
  acceptedAt TIMESTAMP NULL,
  rejectionReason VARCHAR NULL,
  responseTime INT,        -- milliseconds
  payload JSON,
  
  UNIQUE(vendorRoutingId, wholesalerId)  -- ONE RESPONSE PER VENDOR
);
```

### VendorCancellation Table
```sql
CREATE TABLE vendor_cancellations (
  id UUID PRIMARY KEY,
  vendorResponseId UUID UNIQUE,  -- Links to VendorResponse
  
  reason VARCHAR,  -- ANOTHER_VENDOR_ACCEPTED | ORDER_EXPIRED | RETAILER_CANCELLED
  sentAt TIMESTAMP,
  confirmedAt TIMESTAMP NULL,
  
  UNIQUE(vendorResponseId)  -- ONE CANCELLATION PER RESPONSE
);
```

## Event Logging

All events logged to `order_events` table:

```javascript
// After routeOrderToVendors()
{
  orderId: 'order-123',
  eventType: 'VENDOR_BROADCAST_INITIATED',
  payload: { vendorCount: 8, vendorList: [...] },
  createdAt: '2025-01-21T10:00:00Z'
}

// After acceptVendor() wins
{
  orderId: 'order-123',
  eventType: 'VENDOR_ACCEPTED',
  payload: { vendorId: 'v1', lockedAt: '2025-01-21T10:05:00Z' },
  createdAt: '2025-01-21T10:05:00Z'
}

// After sendAutoCancellations()
{
  orderId: 'order-123',
  eventType: 'ORDER_LOCKED_AUTO_CANCELLATIONS_SENT',
  payload: { cancelledCount: 7, losers: 2, nonResponders: 5 },
  createdAt: '2025-01-21T10:05:05Z'
}
```

## Vendor Scoring Algorithm

```
Score = (completion_rate × 40%) + (rating × 30%) + (reliability × 30%)

Where:
  completion_rate = (completedOrders / totalOrders) × 100%
  rating = (averageRating / 5) × 100%
  reliability = reliabilityScore (0-100)
```

## State Transitions

```
Order.status flow:
  CREATED
    ↓
  VALIDATED
    ↓
  CREDIT_RESERVED
    ↓
  PENDING_BIDS ← routeOrderToVendors() called here
    ↓
  VENDOR_ACCEPTED ← acceptVendor() won here
    ↓
  FULFILLMENT_STARTED
    ↓
  DELIVERED
```

## Debugging Tips

### Check if routing exists
```javascript
const routing = await prisma.vendorRouting.findUnique({
  where: { id: 'routing-id' }
});
console.log(routing);
```

### See all vendor responses
```javascript
const responses = await prisma.vendorResponse.findMany({
  where: { vendorRoutingId: 'routing-id' },
  include: { cancellation: true }
});
responses.forEach(r => console.log(r.responseType, r.acceptedAt));
```

### Check who won
```javascript
const routing = await prisma.vendorRouting.findUnique({
  where: { id: 'routing-id' }
});
console.log(`Winner: ${routing.lockedWholesalerId}`);
console.log(`Locked at: ${routing.lockedAt}`);
```

### See all events for order
```javascript
const events = await prisma.orderEvent.findMany({
  where: { orderId: 'order-id' },
  orderBy: { createdAt: 'asc' }
});
events.forEach(e => console.log(`[${e.createdAt}] ${e.eventType}`));
```

## Performance Metrics

| Operation | Avg Time | Notes |
|-----------|----------|-------|
| routeOrderToVendors | ~50ms | Finds top 10 vendors |
| respondToVendor | ~10ms | Simple insert |
| acceptVendor | ~15ms | UPDATE with WHERE |
| getRoutingStatus | ~30ms | Includes all responses |

## Common Scenarios

### Scenario 1: All Vendors Reject
```
→ routeOrderToVendors()
→ All vendors respondToVendor(..., 'REJECT', ...)
→ timeoutVendor() marks rest as TIMEOUT
→ Order stays PENDING_BIDS
→ Fallback: Re-broadcast or manual assignment
```

### Scenario 2: One Vendor Accepts
```
→ routeOrderToVendors()
→ Vendor1 respondToVendor(..., 'ACCEPT', ...)
→ Vendor1 acceptVendor() → WINS ✓
→ sendAutoCancellations() automatically sends to others
→ Order transitions to VENDOR_ACCEPTED
```

### Scenario 3: Race Condition (Multiple Simultaneous)
```
→ Vendor1 acceptVendor() ✓ WINS
→ Vendor2 acceptVendor() ✗ LOST (updated count = 0)
→ Vendor3 acceptVendor() ✗ LOST (updated count = 0)
→ Only Vendor1 sees accepted: true
```

### Scenario 4: Duplicate Accept Attempt
```
→ Vendor1 acceptVendor() → WINS (accepted: true)
→ Vendor1 acceptVendor() AGAIN → OK (accepted: true, reason: ALREADY_ACCEPTED)
→ Idempotent - same result
```

## API Integration

### REST Endpoint: Accept Order
```
POST /api/vendors/accept
{
  "routingId": "routing-789",
  "wholesalerId": "w-123"
}

Response:
{
  "accepted": true,
  "reason": "LOCKED",
  "lockedVendor": "w-123"
}
```

### WhatsApp Handler: Vendor Accepts
```javascript
// When vendor sends "ACCEPT" via WhatsApp
const message = await whatsappService.receiveMessage({
  body: 'ACCEPT',
  from: 'wholesaler-id-123'
});

// Link wholesaler to routing (via some mapping)
const routing = await findRoutingByOrder(orderId);

const result = await VendorRoutingService.acceptVendor(
  routing.id,
  'wholesaler-id-123'
);

if (result.accepted) {
  await whatsappService.sendMessage(
    'wholesaler-id-123',
    'Order confirmed! Order ID: ' + orderId
  );
} else {
  await whatsappService.sendMessage(
    'wholesaler-id-123',
    'Order already accepted by another vendor. Better luck next time!'
  );
}
```

## Troubleshooting

### Q: Why is lockedWholesalerId always NULL?
**A**: No vendor has accepted yet. Check vendorResponses table.

### Q: All 10 vendors show acceptedAt timestamp but lockedWholesalerId is NULL?
**A**: They set acceptedAt but never called acceptVendor(). respondToVendor() doesn't lock.

### Q: How can I force a specific vendor to win?
**A**: Call acceptVendor() for that vendor first, before others. Or update lockedWholesalerId directly in dev environment.

### Q: Orders stuck in PENDING_BIDS forever?
**A**: Call timeoutVendor() with TTL to mark non-responders and auto-select.

## Related Files

- `src/services/vendorRouting.service.js` - Main service implementation
- `src/services/orderStateMachine.service.js` - State transitions
- `src/services/order.service.js` - Order lifecycle
- `prisma/schema.prisma` - Database models
- `VENDOR_ROUTING_COMPLETE.md` - Full documentation
