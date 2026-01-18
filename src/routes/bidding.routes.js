/**
 * Bidding Routes
 */

const express = require('express');
const router = express.Router();
const biddingController = require('../controllers/bidding.controller');
const { biddingRateLimiter } = require('../middleware/rateLimit.middleware');
// const { authenticate, authorize } = require('../middleware/auth.middleware'); // Uncomment when auth is ready
// const { isAdmin } = require('../middleware/admin.middleware');

// Broadcast order to wholesalers
router.post('/broadcast/:orderId', biddingController.broadcastOrder);

// Ingest vendor offer (with rate limiting)
router.post('/offers', biddingRateLimiter, biddingController.ingestOffer);

// Get all offers for an order
router.get('/offers/:orderId', biddingController.getOrderOffers);

// Manually trigger auto-selection (admin only)
// router.post('/auto-select/:orderId', authenticate, authorize(['ADMIN']), biddingController.triggerAutoSelect);
router.post('/auto-select/:orderId', biddingController.triggerAutoSelect);

module.exports = router;
