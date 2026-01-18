# Vendor Offer System - Implementation Documentation

## Overview
This document describes the implementation of the WhatsApp-based vendor offer (bidding) system for handling incoming wholesaler bids on orders.

## Architecture

### Components Implemented

#### 1. **Message Parser Service** (`src/services/messageParser.service.js`)
- **Purpose**: Parse structured WhatsApp messages from wholesalers
- **Format**: `PRICE <number> ETA <time>`
- **Features**:
  - Case-insensitive parsing
  - Validates price is a valid positive number
  - Validates ETA is not empty
  - Returns parsed object with `price`, `eta`, and `raw` message

**Example Usage**:
```javascript
const messageParser = require('./services/messageParser.service');
const parsed = messageParser.parseVendorBid('PRICE 2450 ETA 2H');
// Returns: { price: 2450, eta: '2H', raw: 'PRICE 2450 ETA 2H' }
```

#### 2. **Vendor Offer Service** (`src/services/vendorOffer.service.js`)
- **Purpose**: Handle all vendor offer operations with comprehensive validation
- **Key Methods**:
  - `processIncomingBid(wholesalerId, messageText)` - Main entry point for processing bids
  - `validateWholesaler(wholesalerId)` - Validates sender is an active wholesaler
  - `findEligibleOrder(wholesalerId)` - Finds active, non-expired orders the wholesaler can bid on
  - `createOrUpdateOffer(orderId, wholesalerId, price, eta)` - Creates or updates bid (prevents duplicates)
  - `getOffersForOrder(orderId)` - Retrieves all offers for an order
  - `getBestOffer(orderId)` - Gets the lowest-priced offer
  - `hasSubmittedBid(orderId, wholesalerId)` - Checks if wholesaler already bid

**Validation Logic**:
1. ✅ Sender must be a registered wholesaler
2. ✅ Wholesaler account must be active
3. ✅ Message must match format: `PRICE <number> ETA <time>`
4. ✅ Order must exist and not be expired
5. ✅ Order status must be `PENDING_BIDS`
6. ✅ Wholesaler must be in the candidate list for the order
7. ✅ Prevents duplicate offers (uses upsert)

**Example Usage**:
```javascript
const vendorOfferService = require('./services/vendorOffer.service');

// Process incoming bid
const result = await vendorOfferService.processIncomingBid(
  wholesalerId,
  'PRICE 2450 ETA 2H'
);

if (result.success) {
  console.log(result.message); // Confirmation message
  console.log(result.orderId); // Order ID
  console.log(result.offerId); // Created offer ID
}
```

#### 3. **Vendor Offer Controller** (`src/controllers/vendorOffer.controller.js`)
- **Purpose**: REST API endpoints for vendor offer management
- **Endpoints**:
  - `GET /api/v1/vendor-offers/:orderId` - Get all offers for an order
  - `GET /api/v1/vendor-offers/:orderId/best` - Get best offer for an order
  - `GET /api/v1/vendor-offers/:orderId/check/:wholesalerId` - Check if wholesaler has bid
  - `POST /api/v1/vendor-offers` - Submit offer via API (for testing)

#### 4. **WhatsApp Controller Integration** (`src/controllers/whatsapp.controller.js`)
- **Updated**: `handleWholesalerMessage` method
- **Logic**: When a wholesaler sends a message matching the bid format, it's automatically processed
- **Flow**:
  1. Check if message matches bid pattern using `messageParser.isVendorBid()`
  2. Call `vendorOfferService.processIncomingBid()`
  3. Send confirmation message back to wholesaler via WhatsApp

## Database Schema

### VendorOffer Table
```sql
CREATE TABLE "VendorOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "wholesaler_id" TEXT NOT NULL,
    "price_quote" DOUBLE PRECISION NOT NULL,
    "delivery_eta" TEXT NOT NULL,
    "stock_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "VendorOffer_order_id_wholesaler_id_key" UNIQUE ("order_id", "wholesaler_id")
);
```

**Note**: The unique constraint on `(order_id, wholesaler_id)` prevents duplicate bids from the same wholesaler on the same order.

## Complete Flow

### 1. Order Broadcast
```
Retailer confirms order
  ↓
broadcastService.broadcastOrder(orderId)
  ↓
- Sets order.expires_at = now + 15 minutes
- Sets order.status = 'PENDING_BIDS'
- Finds eligible wholesalers (location, stock, active status)
- Sends WhatsApp message to each:
  "New Order #<ID>
   Reply: PRICE <amount> ETA <time>
   Example: PRICE 2450 ETA 2H"
```

### 2. Wholesaler Bid Submission
```
Wholesaler sends WhatsApp message: "PRICE 2450 ETA 2H"
  ↓
WhatsAppController.handleIncomingMessage()
  ↓
Identifies sender as wholesaler
  ↓
WhatsAppController.handleWholesalerMessage()
  ↓
messageParser.isVendorBid() → true
  ↓
vendorOfferService.processIncomingBid()
  ├─ Validate wholesaler (active, registered)
  ├─ Parse message (price, ETA)
  ├─ Find eligible order (not expired, PENDING_BIDS, wholesaler in candidates)
  ├─ Create/update VendorOffer (upsert prevents duplicates)
  └─ Return confirmation message
  ↓
Send confirmation to wholesaler:
"✅ Bid Recorded Successfully
 Order: #<ID>
 Your Price: Rs. 2450
 Your ETA: 2H
 ..."
```

### 3. Retrieving Offers
```javascript
// Get all offers for an order (sorted by price, lowest first)
const offers = await vendorOfferService.getOffersForOrder(orderId);

// Get the best (lowest price) offer
const bestOffer = await vendorOfferService.getBestOffer(orderId);
```

## Testing

### Test Script: `test-vendor-offers.js`
Comprehensive test covering:
1. ✅ Message parser validation
2. ✅ Order broadcast
3. ✅ Wholesaler bid submission
4. ✅ Bid updates (wholesaler can update their bid)
5. ✅ Invalid wholesaler rejection
6. ✅ Invalid message format rejection
7. ✅ Expired order rejection
8. ✅ Duplicate prevention
9. ✅ Offer retrieval and sorting

**Run Test**:
```bash
node test-vendor-offers.js
```

## API Examples

### Get All Offers for an Order
```bash
GET /api/v1/vendor-offers/{orderId}

Response:
{
  "success": true,
  "data": [
    {
      "id": "...",
      "order_id": "...",
      "wholesaler_id": "...",
      "price_quote": 2200,
      "delivery_eta": "2H",
      "wholesaler": {
        "id": "...",
        "businessName": "Wholesaler A",
        "reliabilityScore": 85,
        "averageRating": 4.5
      }
    }
  ],
  "count": 2
}
```

### Get Best Offer
```bash
GET /api/v1/vendor-offers/{orderId}/best

Response:
{
  "success": true,
  "data": {
    "id": "...",
    "price_quote": 2200,
    "delivery_eta": "2H",
    "wholesaler": {
      "businessName": "Wholesaler A"
    }
  }
}
```

### Submit Offer via API (Testing)
```bash
POST /api/v1/vendor-offers
Content-Type: application/json

{
  "wholesalerId": "...",
  "orderId": "...",
  "price": 2450,
  "eta": "2H"
}
```

## Error Handling

### Validation Errors
- **Invalid wholesaler**: `❌ Wholesaler account not found.`
- **Inactive wholesaler**: `❌ Your wholesaler account is currently inactive.`
- **Invalid format**: `❌ Invalid bid format. Please use: PRICE <amount> ETA <time>`
- **No active orders**: `❌ No active orders available for bidding at this time.`
- **Not in candidate list**: `❌ No active order found for your bid.`
- **Expired order**: `❌ No active orders available for bidding at this time.`

### System Errors
- Database errors are caught and logged
- User receives: `⚠️ System error processing your bid. Please try again or contact support.`

## Security Features

1. **Wholesaler Validation**: Only registered, active wholesalers can submit bids
2. **Order Validation**: Wholesalers can only bid on orders they were invited to
3. **Expiration Check**: Expired orders automatically reject new bids
4. **Duplicate Prevention**: Unique constraint prevents multiple bids from same wholesaler
5. **Input Validation**: Price must be valid number, ETA must not be empty

## Performance Considerations

1. **Upsert Operation**: Uses Prisma's `upsert` for atomic create-or-update
2. **Indexed Queries**: `order_id_wholesaler_id` unique constraint creates index
3. **Sorted Results**: Offers automatically sorted by price (lowest first)
4. **Minimal Joins**: Only necessary data fetched in queries

## Future Enhancements

1. **Auto-Accept Best Offer**: Automatically accept lowest bid when timer expires
2. **Bid Notifications**: Notify retailer when new bids arrive
3. **Bid History**: Track bid changes over time
4. **Counter-Offers**: Allow retailers to counter-offer
5. **Bid Analytics**: Track average bid times, acceptance rates, etc.

## Files Created/Modified

### New Files
- `src/services/messageParser.service.js`
- `src/services/vendorOffer.service.js`
- `src/controllers/vendorOffer.controller.js`
- `src/routes/vendorOffer.routes.js`
- `test-vendor-offers.js`

### Modified Files
- `src/controllers/whatsapp.controller.js` - Added vendor offer processing
- `src/app.js` - Registered vendor offer routes
- `src/services/broadcast.service.js` - Updated to set order expiration
- `src/services/whatsapp.service.js` - Added Twilio integration
- `src/services/wholesaler.service.js` - Improved eligibility logic

## Summary

The vendor offer system provides a complete, production-ready solution for handling WhatsApp-based bidding from wholesalers. It includes:

✅ Structured message parsing
✅ Comprehensive validation
✅ Duplicate prevention
✅ Expiration handling
✅ REST API endpoints
✅ WhatsApp integration
✅ Complete test coverage
✅ Error handling
✅ Security features

The system is ready for deployment and can handle real-world bidding scenarios with multiple wholesalers competing for orders.
