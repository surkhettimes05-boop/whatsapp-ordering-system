# Multi-Vendor Routing System - Complete Implementation Guide

## Overview

The Multi-Vendor Routing System is a distributed, race-safe order routing mechanism where:

1. **Orders broadcast to all eligible vendors simultaneously**
2. **First vendor to accept wins the order** (via DB-enforced lock)
3. **Other vendors receive auto-cancel messages** (no manual handling needed)
4. **All responses logged** in order_events table for audit trail
5. **Database-enforced locking prevents race conditions** (not memory-based)

### Key Innovation: Race-Safe Without Locks

Traditional distributed systems use expensive locks. This system uses:
- **Unique constraint enforcement** at the database level
- **Atomic transactions** with SERIALIZABLE isolation
- **Compare-and-swap pattern** implemented via UPDATE...WHERE clause
- **No application-level mutual exclusion** needed

## Architecture

### Database Model Relationships

```
Order
  ├── vendorRoutings[]: VendorRouting[]  (one routing per order typically)
  └── orderEvents[]: OrderEvent[]        (audit trail)

VendorRouting (one per active order-routing attempt)
  ├── order: Order (FK)
  ├── retailer: Retailer (FK)
  ├── lockedVendor?: Wholesaler (FK to lockedWholesalerId)
  └── vendorResponses[]: VendorResponse[]

VendorResponse (one per vendor per routing)
  ├── vendorRouting: VendorRouting (FK)
  ├── wholesaler: Wholesaler (FK)
  └── cancellation?: VendorCancellation (one-to-one)

VendorCancellation
  └── vendorResponse: VendorResponse (FK, unique)
```

### State Diagram

```
Order Created
    ↓
[ORDER ENTERS PENDING_BIDS STATE]
    ↓
routeOrderToVendors()
  • Create VendorRouting record
  • Identify eligible vendors (score-based)
  • Log VENDOR_BROADCAST_INITIATED event
    ↓
[BROADCAST TO ALL VENDORS VIA WHATSAPP/API]
    ↓
respondToVendor() (for each vendor response)
  • Record VendorResponse with type (ACCEPT|REJECT|TIMEOUT)
  • Log VENDOR_RESPONSE_RECORDED event
    ↓
acceptVendor() [CRITICAL RACE-SAFE SECTION]
  • Attempt UPDATE...WHERE lockedWholesalerId IS NULL
  • If UPDATE succeeds: WE WON THE RACE ✓
  • If UPDATE fails: Another vendor won already
  • Log VENDOR_ACCEPTED event
    ↓
[IF WE WON: LOCK ACQUIRED]
    ↓
sendAutoCancellations()
  • Send cancellations to all other vendors (async)
  • Create VendorCancellation records
  • Log ORDER_LOCKED_AUTO_CANCELLATIONS_SENT event
    ↓
[ORDER TRANSITIONS TO VENDOR_ACCEPTED STATE]
    ↓
Order fulfills or fails normally
```

## Race Condition Handling

### Scenario: Two Vendors Accept Simultaneously

```
VENDOR A                          DATABASE              VENDOR B
                                  (lockedWholesalerId IS NULL)
                                           ↑
GET lockedWholesalerId                     ↓              GET lockedWholesalerId
  → returns NULL              BOTH SEE NULL               → returns NULL
                                           ↓
UPDATE SET lockedWholesalerId = A
  success ✓ (1 row updated)                ↑
                                      UNIQUE CONSTRAINT
                                      (orderId, lockedWholesalerId)
                                      PREVENTS SECOND INSERT
                                           ↓
                              UPDATE SET lockedWholesalerId = B
                              FAILS (0 rows updated)
                              Constraint violation caught
                              
                              Return { accepted: false, reason: 'LOST_RACE' }
```

**Key Point**: Both vendors could READ NULL simultaneously, but only ONE can successfully write due to the unique constraint. This is why we check the update count - if 0 rows updated, someone else won.

### Safety Guarantees

1. **Atomicity**: All updates happen in a single transaction
2. **Isolation**: SERIALIZABLE level prevents phantom reads
3. **Durability**: Updates persisted before response sent
4. **Idempotency**: Calling accept again returns same result

## Service Methods

### routeOrderToVendors(orderId, retailerId, productRequested)

**Purpose**: Initial broadcast - identify eligible vendors and create routing record.

**Algorithm**:
1. Query for vendors based on eligibility criteria:
   - Active and verified status
   - Within service area (geospatial query when available)
   - Have adequate stock
   - Current load < capacity
   - Order amount >= minimum order

2. Score vendors using:
   - Completion rate (40% weight)
   - Average rating (30% weight)
   - Reliability score (30% weight)

3. Select top 10 vendors by score

4. Create VendorRouting record with:
   - All eligible vendors as JSON (for audit)
   - Initial version = 1
   - lockedWholesalerId = NULL

5. Log event: VENDOR_BROADCAST_INITIATED

**Returns**:
```javascript
{
  routingId: "uuid",
  vendorCount: 8,
  vendors: [
    { id, businessName, score: 87.5 },
    ...
  ]
}
```

**Error Handling**:
- Order not found → NOT_FOUND error
- No eligible vendors → INVALID_REQUEST error
- Database transaction failed → propagates up

### respondToVendor(vendorRoutingId, wholesalerId, responseType, metadata)

**Purpose**: Record vendor's response (ACCEPT, REJECT, TIMEOUT, ERROR).

**Algorithm**:
1. Check if vendor already responded (unique constraint)
   - If yes: throw INVALID_STATE error (idempotent safety)

2. Create VendorResponse with:
   - responseType: ACCEPT|REJECT|TIMEOUT|ERROR
   - acceptedAt: timestamp if ACCEPT, else NULL
   - rejectionReason: populated if not ACCEPT
   - responseTime: milliseconds to respond
   - payload: vendor-specific data (JSON)

3. Log event: VENDOR_RESPONSE_RECORDED

**Returns**:
```javascript
{
  id: "response-id",
  vendorRoutingId: "...",
  wholesalerId: "...",
  responseType: "ACCEPT",
  acceptedAt: "2025-01-21T...",
  createdAt: "2025-01-21T..."
}
```

**No Acceptance Logic Here**: Just records the response. The actual race happens in acceptVendor().

### acceptVendor(vendorRoutingId, wholesalerId) ⚡ RACE-SAFE

**Purpose**: Vendor attempts to accept order. Only first to successfully execute wins.

**Algorithm** (CRITICAL):
```
1. Fetch current routing
   if not found → NOT_FOUND error
   
2. if routing.lockedWholesalerId exists:
     if it's same vendor → return { accepted: true, reason: 'ALREADY_ACCEPTED' }
     if different vendor → return { accepted: false, reason: 'ALREADY_LOCKED' }
     
3. RACE-SAFE UPDATE:
   UPDATE vendor_routings
   SET 
     lockedWholesalerId = <this_vendor_id>,
     lockedAt = NOW(),
     version = version + 1
   WHERE 
     id = <routing_id>
     AND lockedWholesalerId IS NULL  ← CRITICAL: Only update if still null
   
4. if updated count == 0 → Lost race to another vendor
   Refresh to see winner
   Update own response to REJECTED with reason ANOTHER_VENDOR_ACCEPTED
   Return { accepted: false, reason: 'LOST_RACE' }
   
5. if updated count == 1 → WE WON! 🎉
   Update response to ACCEPT
   Log event: VENDOR_ACCEPTED
   Schedule sendAutoCancellations() (async)
   Return { accepted: true, reason: 'LOCKED' }
```

**Returns**:
```javascript
// Won the race
{
  accepted: true,
  reason: 'LOCKED',
  lockedVendor: 'wholesaler-id'
}

// Lost race
{
  accepted: false,
  reason: 'LOST_RACE',
  lockedVendor: 'other-wholesaler-id'
}

// Already locked by same vendor (idempotent)
{
  accepted: true,
  reason: 'ALREADY_ACCEPTED',
  lockedVendor: 'wholesaler-id'
}
```

**Why This Works**:
- UPDATE...WHERE clause is atomic
- If no rows match WHERE condition, update fails silently
- Unique constraint on (orderId, lockedWholesalerId) ensures only one winner
- SERIALIZABLE isolation prevents dirty reads
- Version increment helps with optimistic locking patterns

### sendAutoCancellations(vendorRoutingId, winningVendorId)

**Purpose**: After lock acquired, send cancellations to all other vendors (async, non-blocking).

**Algorithm**:
1. Parse eligible vendors from JSON
2. Find vendors who responded but didn't win
3. Find vendors who haven't responded yet
4. For each:
   - Create VendorCancellation record with reason
   - Send WhatsApp/API notification (async)
   - Log event

5. Log event: ORDER_LOCKED_AUTO_CANCELLATIONS_SENT

**Returns**:
```javascript
{
  success: true,
  cancelledCount: 7,
  losers: 2,        // Vendors who responded with ACCEPT/REJECT
  nonResponders: 5  // Vendors who timed out
}
```

**Important**: This runs AFTER lock is acquired, so no race condition is possible.

### timeoutVendor(vendorRoutingId, ttlSeconds)

**Purpose**: Mark non-responding vendors as TIMEOUT after TTL.

**Algorithm**:
1. If already locked, return early
2. Find vendors who haven't responded
3. Create TIMEOUT responses for each
4. If any acceptances exist, auto-select best one
5. Log events

**Returns**:
```javascript
{
  timedOut: 5,
  accepted: 1,
  allResponded: false
}
```

### getRoutingStatus(vendorRoutingId)

**Purpose**: Get complete routing status with all responses and cancellations.

**Returns**:
```javascript
{
  routingId: "uuid",
  orderId: "order-id",
  status: "LOCKED",  // or PENDING
  lockedVendor: "wholesaler-id",
  lockedAt: "2025-01-21T...",
  totalVendors: 8,
  acceptedCount: 1,
  rejectedCount: 3,
  timeoutCount: 4,
  cancelledCount: 7,
  responses: [
    {
      vendorId: "...",
      vendorName: "...",
      responseType: "ACCEPT",
      acceptedAt: "...",
      createdAt: "...",
      cancelled: true,
      cancellationReason: "ANOTHER_VENDOR_ACCEPTED"
    },
    ...
  ]
}
```

## Event Logging

Every significant event is logged to order_events table:

| Event | When | Payload |
|-------|------|---------|
| VENDOR_BROADCAST_INITIATED | After routeOrderToVendors | { vendorCount, vendorList[] } |
| VENDOR_RESPONSE_RECORDED | After respondToVendor | { vendorId, responseType, metadata } |
| VENDOR_ACCEPTED | After acceptVendor wins | { vendorId, lockedAt } |
| ORDER_LOCKED_AUTO_CANCELLATIONS_SENT | After sendAutoCancellations | { cancelledCount, losers, nonResponders } |

## Integration with Order State Machine

### New Order States

- `PENDING_BIDS` - Order broadcasted, waiting for vendor acceptance
- `VENDOR_ACCEPTED` - Vendor locked to order

### State Transitions

```
CREATED → VALIDATED → CREDIT_RESERVED → PENDING_BIDS
                                              ↓
                      [routeOrderToVendors() called]
                                              ↓
                                      VENDOR_ACCEPTED
                                              ↓
                                    FULFILLMENT_STARTED
                                              ↓
                                         DELIVERED
```

### Modified Order Service Methods

```javascript
// After order validated and credit reserved
await orderService.enterPendingBids(orderId);
  // Calls routeOrderToVendors()
  // Updates status to PENDING_BIDS
  
// When vendor accepts
await vendorRoutingService.acceptVendor(routingId, vendorId);
  // Updates status to VENDOR_ACCEPTED if won
  // Updates finalWholesalerId to locked vendor
```

## Concurrency Testing

### Test Scenario: 10 Vendors Accepting Simultaneously

```javascript
const routingId = 'test-routing-id';
const vendorIds = ['v1', 'v2', ..., 'v10'];

// Simulate 10 simultaneous acceptances
const promises = vendorIds.map(vid => 
  vendorRoutingService.acceptVendor(routingId, vid)
);

const results = await Promise.all(promises);

// Verify results
const accepted = results.filter(r => r.accepted).length;
assert.equal(accepted, 1); // Only one should win

const locked = results.filter(r => r.reason === 'LOCKED').length;
assert.equal(locked, 1);

const lost = results.filter(r => r.reason === 'LOST_RACE').length;
assert.equal(lost, 9);
```

## Performance Characteristics

### Database Queries

| Operation | Query Type | Indexes Used | Avg Time |
|-----------|-----------|--------------|----------|
| routeOrderToVendors | SELECT with sorting | (isActive, isVerified, capacity) | ~50ms |
| respondToVendor | INSERT | (vendorRoutingId, wholesalerId) | ~10ms |
| acceptVendor | UPDATE + SELECT | (id, lockedWholesalerId) | ~15ms |
| sendAutoCancellations | INSERT × N | (vendorResponseId) | ~50ms for 7 vendors |
| getRoutingStatus | SELECT with joins | (vendorRoutingId) | ~30ms |

### Scalability

- **Eligible vendors per order**: Up to 50 (configurable)
- **Concurrent orders**: Unlimited (no global locks)
- **Concurrent acceptances**: Race-safe up to 1000s simultaneously
- **Database throughput**: Limited only by PostgreSQL capacity

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|-----------|
| NOT_FOUND | Order/routing not found | Verify order exists, check routing ID |
| INVALID_REQUEST | No eligible vendors | Add more vendors or lower criteria |
| INVALID_STATE | Vendor already responded | Check duplicate requests |
| ALREADY_LOCKED | Another vendor won race | Move to next best vendor or retry |
| LOST_RACE | Lost race to another vendor | Normal - just retry with next vendor |

### Error Recovery

```javascript
const result = await acceptVendor(routingId, vendorId);

if (!result.accepted) {
  if (result.reason === 'LOST_RACE') {
    // Another vendor won - no need to retry
    // Vendor should get auto-cancel message
    logger.info(`Lost race to ${result.lockedVendor}`);
  } else if (result.reason === 'ALREADY_LOCKED') {
    // Someone else already locked - same handling
    logger.warn(`Order already locked to ${result.lockedVendor}`);
  }
}
```

## Migration Path

### Step 1: Run Migration
```bash
cd backend
npx prisma migrate deploy
```

### Step 2: Update Order Service
Add vendorRouting initialization on order creation

### Step 3: Add Vendor Response Listener
Listen for vendor responses via:
- WhatsApp incoming messages
- REST API endpoints
- Message queue (Redis)

### Step 4: Update Order State Machine
Add PENDING_BIDS state and transitions

### Step 5: Deploy and Monitor
- Monitor race condition frequency (should be 0 failures)
- Track vendor response times
- Monitor auto-cancellation delivery

## Best Practices

1. **Always check update count** in acceptVendor() - it's the race detector
2. **Never use memory-based locks** - use database constraints
3. **Log all events** - essential for debugging distributed issues
4. **Use timestamps** - helps with sorting and tie-breaking
5. **Make operations idempotent** - can retry without side effects
6. **Monitor database transaction isolation** - ensure SERIALIZABLE level

## FAQ

### Q: Why use database constraint instead of application lock?
**A**: Database constraints are:
- Atomic (can't be interrupted)
- Durable (survive crashes)
- Work across processes/servers
- Don't require separate lock service

### Q: What if database goes down during accept?
**A**: Transaction rolls back, client gets error. On retry, they either:
- Win the race (if nobody else accepted)
- Lose and get ALREADY_LOCKED response

### Q: Can two vendors both get locked?
**A**: No - impossible due to unique constraint. Only one can acquire lock.

### Q: How do non-responsive vendors get cancelled?
**A**: sendAutoCancellations() proactively creates TIMEOUT responses for them.

### Q: What about network delays?
**A**: timeoutVendor() handles by marking non-responders as TIMEOUT after TTL.

## See Also

- [Credit Reservation System](./CREDIT_RESERVATION_INDEX.md)
- [Order State Machine](./src/services/orderStateMachine.service.js)
- [Order Service](./src/services/order.service.js)
- [Vendor Routing Service](./src/services/vendorRouting.service.js)
