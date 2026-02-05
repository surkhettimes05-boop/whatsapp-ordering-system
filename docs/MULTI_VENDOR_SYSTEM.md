# Multi-Vendor Routing System - Database Schema & Algorithm

## Table of Contents
1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Intelligent Routing Algorithm](#intelligent-routing-algorithm)
4. [Migration & Setup](#migration--setup)
5. [Testing Scenarios](#testing-scenarios)

---

## Overview

This multi-vendor system intelligently routes customer orders to the best available wholesaler based on multiple factors including:
- **Availability** (Do they have stock?)
- **Distance** (How close are they?)
- **Reliability** (Past performance)
- **Pricing** (Best value)
- **Capacity** (Can they handle more orders?)

---

## Database Schema

### New Models

#### 1. **Wholesaler**
Represents vendors who fulfill orders.

**Key Fields:**
```javascript
{
  // Business Info
  businessName: String
  ownerName: String
  phoneNumber: String (unique)
  whatsappNumber: String (unique)
  email: String (optional, unique)
  gstNumber: String (optional, unique)
  
  // Location (for distance calculation)
  businessAddress: String
  city: String
  state: String
  pincode: String
  latitude: Float  // Critical for routing
  longitude: Float // Critical for routing
  
  // Performance Metrics (updated after each order)
  reliabilityScore: Float (0-100)
  totalOrders: Int
  completedOrders: Int
  cancelledOrders: Int
  averageRating: Float (0-5)
  totalRevenue: Decimal
  
  // Status
  isActive: Boolean
  isVerified: Boolean
  
  // Capacity Management
  capacity: Int         // Max concurrent orders
  currentOrders: Int    // Currently handling
  
  // Business Configuration
  categories: String    // JSON: ["Electronics", "Groceries"]
  deliveryRadius: Float // km
  minimumOrder: Decimal
  deliveryCharges: Decimal
  operatingHours: String // JSON with schedule
}
```

**Relationships:**
- `products` → WholesalerProduct[] (inventory)
- `orders` → Order[] (assigned orders)
- `routingDecisions` → OrderRouting[] (routing history)
- `ratings` → WholesalerRating[] (feedback received)

---

#### 2. **WholesalerProduct**
Links products to wholesalers with specific pricing and availability.

**Key Fields:**
```javascript
{
  wholesalerId: String
  productId: String
  
  priceOffered: Decimal     // Their price
  stock: Int                // Available quantity
  minOrderQuantity: Int     // Minimum order
  leadTime: Int             // Hours to fulfill
  isAvailable: Boolean
}
```

**Unique Constraint:** `[wholesalerId, productId]` (one entry per product per wholesaler)

---

#### 3. **OrderRouting**
Tracks routing decisions for transparency and analytics.

**Key Fields:**
```javascript
{
  orderId: String
  retailerId: String
  
  productRequested: String        // JSON array of product IDs
  candidateWholesalers: String    // JSON array of considered wholesaler IDs
  
  selectedWholesalerId: String    // Who was chosen
  routingReason: String           // Why they were chosen
  routingScore: Float             // Calculated score (0-100)
  
  status: String                  // PENDING, ACCEPTED, REJECTED, REROUTED
  attempt: Int                    // Routing attempt number
  
  timestamp: DateTime
}
```

---

#### 4. **WholesalerRating**
Customer feedback for continuous improvement.

**Key Fields:**
```javascript
{
  orderId: String (unique)
  wholesalerId: String
  retailerId: String
  
  overallRating: Int (1-5)
  deliveryTime: Int (1-5)
  productQuality: Int (1-5)
  communication: Int (1-5)
  
  comment: String (optional)
  timestamp: DateTime
}
```

---

### Updated Models

#### **Order** (Modified)
Added wholesaler assignment:
```javascript
{
  // NEW FIELDS:
  wholesalerId: String (optional)
  confirmedAt: DateTime (when wholesaler accepted)
  deliveredAt: DateTime (when completed)
  
  // Updated status values:
  // PLACED → CONFIRMED → IN_PROGRESS → DELIVERED → PAID
  // Can also be CANCELLED
  
  // NEW RELATIONSHIPS:
  routing: OrderRouting[] // Routing history
  rating: WholesalerRating (optional)
}
```

#### **Retailer** (Modified)
Added location for distance calculation:
```javascript
{
  // NEW FIELDS:
  city: String
  address: String
  latitude: Float
  longitude: Float
  
  // NEW RELATIONSHIPS:
  ratings: WholesalerRating[] // Ratings given
}
```

#### **Product** (Modified)
Added wholesaler inventory link:
```javascript
{
  // NEW RELATIONSHIPS:
  wholesalerProducts: WholesalerProduct[]
}
```

---

## Intelligent Routing Algorithm

### Scoring Formula

```javascript
Final Score = (
  availabilityScore × 30% +
  distanceScore     × 25% +
  reliabilityScore  × 20% +
  pricingScore      × 15% +
  capacityScore     × 10%
)
```

### Component Breakdown

#### 1. **Availability Score** (30% weight)
**Most important** - Can they fulfill the order?

```javascript
if (hasInStock) {
  score = 100
} else if (canGetIn24Hours) {
  score = 70
} else if (canGetIn48Hours) {
  score = 40
} else {
  score = 0 // Exclude from consideration
}
```

**Logic:**
- Check `WholesalerProduct.stock >= orderedQuantity`
- Check `WholesalerProduct.isAvailable === true`
- Consider `leadTime` for fulfillment

---

#### 2. **Distance Score** (25% weight)
**Second priority** - Proximity to customer

```javascript
Using: geolib.getDistance(customerLocation, wholesalerLocation)

if (distance < 5km) {
  score = 100
} else if (distance < 10km) {
  score = 80
} else if (distance < 20km) {
  score = 60
} else if (distance < 50km) {
  score = 40
} else {
  score = 20
}

// Also check: distance <= wholesaler.deliveryRadius
```

**Requirements:**
- Both retailer and wholesaler must have `latitude` and `longitude`
- Wholesaler's `deliveryRadius` must cover the distance

---

#### 3. **Reliability Score** (20% weight)
**Track record** - Past performance

```javascript
score = wholesaler.reliabilityScore // Already 0-100

// reliabilityScore is calculated from:
// - On-time delivery rate
// - Order completion rate (completedOrders / totalOrders)
// - Customer ratings (averageRating / 5 * 100)
// - Low cancellation rate
```

**Update Formula (after each order):**
```javascript
reliabilityScore = (
  (completionRate × 40) +
  (ratingScore × 30) +
  (onTimeRate × 20) +
  (lowCancellationBonus × 10)
)

completionRate = (completedOrders / totalOrders) * 100
ratingScore = (averageRating / 5) * 100
onTimeRate = // Track if deliveredAt <= expectedDelivery
lowCancellationBonus = cancelledOrders < 5% ? 100 : 0
```

---

#### 4. **Pricing Score** (15% weight)
**Value for money** - Competitive pricing

```javascript
// Find cheapest option among candidates
cheapestPrice = Math.min(...candidatePrices)

priceDifference = ((price - cheapestPrice) / cheapestPrice) * 100

if (priceDifference === 0) {
  score = 100 // Cheapest
} else if (priceDifference <= 5) {
  score = 80
} else if (priceDifference <= 10) {
  score = 60
} else if (priceDifference <= 20) {
  score = 40
} else {
  score = 20
}
```

---

#### 5. **Capacity Score** (10% weight)
**Can they handle it?** - Workload management

```javascript
capacityUsage = (currentOrders / capacity) * 100

if (capacityUsage < 50) {
  score = 100 // Plenty of room
} else if (capacityUsage < 75) {
  score = 70
} else if (capacityUsage < 90) {
  score = 40
} else {
  score = 10 // Nearly full
}

// Exclude if currentOrders >= capacity
```

---

### Routing Process Flow

```
1. Customer places order via WhatsApp
   ↓
2. Extract: customer location, products, quantities
   ↓
3. Find candidate wholesalers:
   - Have the product (WholesalerProduct exists)
   - Within delivery radius
   - Currently active (isActive = true)
   - Not at full capacity
   ↓
4. Calculate scores for each candidate
   ↓
5. Rank by final score (highest first)
   ↓
6. Select top-ranked wholesaler
   ↓
7. Create OrderRouting record
   ↓
8. Send WhatsApp to:
   - Customer: "Order assigned to [Wholesaler]"
   - Wholasaler: "New order #[ID] from [Customer]"
   ↓
9. Wait for wholesaler response (30 min timeout)
   ↓
10. If ACCEPTED: Proceed with order
    If REJECTED/TIMEOUT: Re-route to next best
```

---

### Failover & Re-routing

**Scenario:** Wholesaler rejects or doesn't respond

```javascript
async function rerouteOrder(orderId) {
  // 1. Get previous routing attempts
  const previousAttempts = await getRoutingHistory(orderId)
  
  // 2. Get list of already-tried wholesalers
  const excludedWholesalers = previousAttempts.map(r => r.selectedWholesalerId)
  
  // 3. Re-run routing algorithm, excluding previous choices
  const candidates = await findCandidates(order, { exclude: excludedWholesalers })
  
  // 4. Calculate scores again
  const scored = await scoreWholesalers(candidates, order)
  
  // 5. Select next best
  const newWholesaler = scored[0]
  
  // 6. Create new routing record (attempt++)
  await createRoutingRecord({
    orderId,
    selectedWholesalerId: newWholesaler.id,
    attempt: previousAttempts.length + 1,
    status: 'REROUTED'
  })
  
  // 7. Notify customer of change
  await sendWhatsApp(customer, `Your order has been reassigned to ${newWholesaler.businessName}`)
  
  // 8. Notify new wholesaler
  await sendWhatsApp(newWholesaler, `New order #${orderId}`)
}
```

---

## Migration & Setup

### Step 1: Apply Prisma Migration

```bash
cd backend
npx prisma migrate dev --name add_multi_vendor_system
```

This will:
- Create new tables (Wholesaler, WholesalerProduct, OrderRouting, WholesalerRating)
- Update existing tables (Order, Retailer, Product)
- Generate Prisma Client with new models

### Step 2: Install Required Packages

```bash
npm install geolib node-schedule lodash
```

**Packages:**
- `geolib` - Distance calculation between coordinates
- `node-schedule` - Timeout handling for wholesaler responses
- `lodash` - Data manipulation utilities

### Step 3: Run Seed Data

```bash
node prisma/seed-wholesalers.js
```

This creates:
- 4 test wholesalers (Kathmandu, Pokhara, Lalitpur, Bhaktapur)
- 6 products
- Wholesaler-product links with varying prices
- 2 test retailers with locations
- 1 admin user

### Step 4: Generate Prisma Client

```bash
npx prisma generate
```

---

## Testing Scenarios

### Scenario 1: Distance-Based Routing

**Setup:**
- Retailer in Kathmandu orders iPhone 15
- Wholesaler 1 (Kathmandu): 5km away, score: 87
- Wholesaler 2 (Pokhara): 200km away, score: 95

**Expected:** Wholesaler 1 wins due to proximity despite lower reliability

---

### Scenario 2: Price vs. Reliability

**Setup:**
- Retailer orders Rice
- Wholesaler 2: NPR 3400, reliability: 95
- Wholesaler 3: NPR 3450, reliability: 72

**Expected:** Wholesaler 2 wins (better price + much higher reliability)

---

### Scenario 3: Capacity Constraint

**Setup:**
- Wholesaler 4 at full capacity (8/8 orders)
- Should be excluded from candidates

**Expected:** Routes to alternative wholesaler even if other metrics are good

---

### Scenario 4: Failover Re-routing

**Setup:**
1. Order assigned to Wholesaler A
2. Wholesaler A rejects
3. System automatically re-routes to Wholesaler B

**Expected:**
- Customer notified of change
- Wholesaler B gets new order notification
- OrderRouting shows attempt=2

---

### Scenario 5: Multi-Product Order

**Setup:**
- Order contains: iPhone + Laptop + Rice
- Only Wholesaler 2 has all three products

**Expected:** Routes to Wholesaler 2 (only option), even if not ideal on other metrics

---

## Performance Tracking

### After Order Completion

```javascript
async function updateWholesalerPerformance(orderId) {
  const order = await getOrder(orderId)
  const wholesaler = await getWholesaler(order.wholesalerId)
  
  // 1. Calculate on-time delivery
  const expectedDelivery = order.createdAt + (leadTime * 60 * 60 * 1000)
  const onTime = order.deliveredAt <= expectedDelivery
  
  // 2. Get customer rating
  const rating = await getOrderRating(orderId)
  
  // 3. Update metrics
  await updateWholesaler(wholesaler.id, {
    totalOrders: wholesaler.totalOrders + 1,
    completedOrders: wholesaler.completedOrders + 1,
    
    // Recalculate average rating
    averageRating: ((wholesaler.averageRating * (totalRatings - 1)) + rating.overallRating) / totalRatings,
    
    // Update revenue
    totalRevenue: wholesaler.totalRevenue + order.totalAmount,
    
    // Recalculate reliability score
    reliabilityScore: calculateReliabilityScore(wholesaler, onTime, rating)
  })
}
```

---

## Admin Analytics Endpoints

### GET `/api/v1/analytics/routing`
Routing efficiency metrics

**Response:**
```json
{
  "totalRoutings": 1250,
  "successRate": 94.5,
  "averageRoutingTime": "2.3 minutes",
  "reroutingRate": 5.5,
  "topPerformingWholesalers": [...]
}
```

### GET `/api/v1/analytics/wholesalers`
Wholesaler performance comparison

**Response:**
```json
{
  "wholesalers": [
    {
      "id": "...",
      "businessName": "Pokhara Premium",
      "reliabilityScore": 95,
      "totalOrders": 230,
      "completionRate": 99.1,
      "averageRating": 4.8,
      "totalRevenue": 3850000
    }
  ]
}
```

### GET `/api/v1/analytics/orders-by-region`
Geographic distribution

**Response:**
```json
{
  "regions": [
    { "city": "Kathmandu", "orders": 450, "revenue": 12500000 },
    { "city": "Pokhara", "orders": 280, "revenue": 7800000 }
  ]
}
```

---

## Next Steps

1. ✅ **Phase 1: Database Schema** (COMPLETED)
2. ✅ **Phase 2: Routing Algorithm Service** (COMPLETED)
3. ✅ **Phase 3: WhatsApp Integration** (COMPLETED)
4. 🔄 **Phase 4: Failover System** (PARTIALLY IMPLEMENTED - Rejection Logic)
5. 🔄 **Phase 5: Performance Tracking** (Analytics API Ready)
6. ✅ **Phase 6: Admin APIs** (COMPLETED)

---

## Questions?

For implementation details of each phase, refer to:
- `src/services/orderRoutingService.js` (Routing logic)
- `src/controllers/whatsapp.controller.js` (Bot integration)
- `src/routes/wholesaler.routes.js` (Admin endpoints)
