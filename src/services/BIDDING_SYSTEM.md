# Competitive Bidding System

## Overview
Production-grade competitive bidding system with:
- **Broadcast service** - Send orders to multiple wholesalers
- **Offer ingestion** - Receive and validate bids
- **Decision engine** - Select winning bid based on scoring
- **Row-level locking** - Prevent race conditions
- **Timeout-based auto selection** - Automatic winner selection
- **Full audit trail** - Complete bidding history

## Architecture

### Components

#### 1. Bidding Service (`bidding.service.js`)
- Broadcasts orders to eligible wholesalers
- Ingests vendor offers with validation
- Auto-selects winners on timeout
- Row-level locking for concurrent safety

#### 2. Scoring Service (`scoring.service.js`)
- Multi-criteria scoring algorithm
- Weighted composite scoring
- Price, delivery time, reliability, rating, stock confirmation

#### 3. Decision Engine (`orderDecision.service.js`)
- Integrates with bidding system
- Financial and inventory safety checks
- Final winner assignment

## Scoring Algorithm

### Weight Distribution
- **Price**: 35% - Lower price is better
- **Delivery Time**: 25% - Faster delivery is better
- **Reliability**: 20% - Higher reliability is better
- **Rating**: 10% - Higher rating is better
- **Stock Confirmed**: 10% - Bonus for confirmed stock

### Score Calculation

```javascript
totalScore = (
    priceScore * 0.35 +
    deliveryScore * 0.25 +
    reliabilityScore * 0.20 +
    ratingScore * 0.10 +
    stockScore * 0.10
)
```

### Component Scoring

#### Price Score (0-100)
- 10%+ discount: 100 points
- 0-10% discount: 75-100 points
- 0-10% markup: 50-75 points
- 10-20% markup: 25-50 points
- 20%+ markup: 0-25 points

#### Delivery Time Score (0-100)
- 0-2 hours: 100 points
- 2-6 hours: 90-100 points
- 6-12 hours: 70-90 points
- 12-24 hours: 50-70 points
- 24-48 hours: 30-50 points
- 48+ hours: 0-30 points

#### Reliability Score (0-100)
- Based on reliability score (0-100) and completion rate
- 70% weight on reliability score
- 30% weight on completion rate

#### Rating Score (0-100)
- Converts 0-5 rating to 0-100 score
- Formula: (rating / 5) * 100

#### Stock Confirmation Score (0-100)
- Confirmed: 100 points
- Not confirmed: 0 points

## Row-Level Locking

### Implementation
All critical operations use `SELECT ... FOR UPDATE`:

```sql
SELECT id, status, "expiresAt", "final_wholesaler_id"
FROM "Order"
WHERE id = ${orderId}
FOR UPDATE
```

### Locked Operations
1. **Broadcast** - Prevents concurrent broadcasts
2. **Offer Ingestion** - Prevents duplicate/conflicting offers
3. **Auto Selection** - Prevents race conditions in winner selection

## Timeout-Based Auto Selection

### Configuration
- Default timeout: 30 minutes
- Configurable via `BIDDING_TIMEOUT_MINUTES` constant

### Process
1. Order broadcasted with `expiresAt` timestamp
2. Background job monitors expired bidding windows
3. Auto-selects winner when timeout expires
4. Falls back to highest-scored offer if no manual selection

### Background Job
- Runs every 2 minutes
- Checks for orders with expired bidding windows
- Processes in batches (50 orders at a time)

## Offer Ingestion

### Validation
- Order must be in `PENDING_BIDS` status
- Bidding window must not be expired
- No winner already assigned
- Required fields: `priceQuote`, `deliveryEta`

### Upsert Logic
- Creates new offer if doesn't exist
- Updates existing offer if already submitted
- Preserves `ACCEPTED` status if already accepted

## Broadcast Service

### Eligibility Criteria
1. Wholesaler must be active
2. Within delivery radius (if order has location)
3. Not soft-deleted

### Broadcast Message Format
```
📢 NEW ORDER AVAILABLE

Order #ABC123
Amount: Rs. 5000.00
Location: Kathmandu

Reply with your bid:
PRICE <amount> ETA <time>

Example: PRICE 5000 ETA 2H

Bidding closes in 30 minutes.
```

## API Endpoints

### Broadcast Order
```
POST /api/v1/bidding/broadcast/:orderId
Body: {
    wholesalerIds?: string[],  // Optional: specific wholesalers
    radius?: number            // Optional: delivery radius in km
}
```

### Ingest Offer
```
POST /api/v1/bidding/offers
Body: {
    orderId: string,
    wholesalerId: string,
    priceQuote: number,
    deliveryEta: string,
    stockConfirmed?: boolean
}
```

### Get Order Offers
```
GET /api/v1/bidding/offers/:orderId
```

Response:
```json
{
    "success": true,
    "data": {
        "orderId": "order-123",
        "totalOffers": 3,
        "offers": [
            {
                "id": "offer-1",
                "wholesalerId": "wholesaler-1",
                "priceQuote": 5000,
                "deliveryEta": "2H",
                "stockConfirmed": true,
                "score": {
                    "totalScore": 87.5,
                    "breakdown": {
                        "price": { "score": 90, "weight": 0.35, "weightedScore": 31.5 },
                        "deliveryTime": { "score": 100, "weight": 0.25, "weightedScore": 25.0 },
                        ...
                    }
                }
            }
        ]
    }
}
```

### Trigger Auto Selection
```
POST /api/v1/bidding/auto-select/:orderId
```

## Audit Trail

All bidding actions are logged to `AdminAuditLog`:

### Actions Logged
- `BIDDING_ORDER_BROADCAST` - Order broadcasted
- `BIDDING_OFFER_INGESTED` - Offer submitted/updated
- `BIDDING_AUTO_SELECT_WINNER` - Winner auto-selected
- `BIDDING_AUTO_SELECT_TIMEOUT` - No bids received

### Log Metadata
```json
{
    "orderId": "order-123",
    "wholesalerId": "wholesaler-1",
    "priceQuote": 5000,
    "deliveryEta": "2H",
    "stockConfirmed": true,
    "score": 87.5,
    "isUpdate": false,
    "timestamp": "2024-01-15T10:30:00Z"
}
```

## Integration Points

### Order Creation
- Orders start in `CREATED` or `PENDING_BIDS` status
- Broadcast service transitions to `PENDING_BIDS`

### Decision Engine
- Uses scoring service for offer evaluation
- Integrates financial and inventory checks
- Final winner assignment with state machine

### State Machine
- Bidding transitions: `CREATED` → `PENDING_BIDS` → `WHOLESALER_ACCEPTED`
- All transitions logged and validated

## Best Practices

1. **Always use transactions** - All operations are atomic
2. **Row-level locking** - Prevents race conditions
3. **Validate before processing** - Check order status and expiry
4. **Score all offers** - Consistent evaluation
5. **Log all actions** - Complete audit trail
6. **Handle timeouts gracefully** - Auto-select or mark as failed

## Error Handling

### Invalid State
```json
{
    "success": false,
    "error": "Order order-123 is not accepting bids (current status: CONFIRMED)"
}
```

### Expired Bidding Window
```json
{
    "success": false,
    "error": "Bidding window for order order-123 has expired"
}
```

### Already Assigned
```json
{
    "success": false,
    "error": "Order order-123 already has a winner assigned"
}
```

## Monitoring

### Key Metrics
- Broadcast success rate
- Offer ingestion rate
- Average bidding time
- Auto-selection frequency
- Score distribution

### Alerts
- High broadcast failure rate
- Low offer ingestion rate
- Bidding timeout failures
- Score calculation errors
