const express = require('express');
const router = express.Router();
const vendorOfferController = require('../controllers/vendorOffer.controller');

/**
 * Vendor Offer Routes
 * Endpoints for managing vendor bids/offers on orders
 */

// Get all offers for a specific order
router.get('/:orderId', vendorOfferController.getOrderOffers);

// Get the best (lowest price) offer for an order
router.get('/:orderId/best', vendorOfferController.getBestOffer);

// Check if a wholesaler has submitted a bid for an order
router.get('/:orderId/check/:wholesalerId', vendorOfferController.checkBidStatus);

// Submit a vendor offer (for API/testing purposes)
router.post('/', vendorOfferController.submitOffer);

module.exports = router;
