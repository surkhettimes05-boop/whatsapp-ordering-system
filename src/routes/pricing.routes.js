const express = require('express');
const router = express.Router();
const pricingController = require('../controllers/pricing.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/admin.middleware');

// Public route (for calculating prices)
router.post('/calculate', authenticate, pricingController.calculatePrice);

// Admin routes
router.use(authenticate, isAdmin);

router.post('/', pricingController.createPricingRule);
router.get('/', pricingController.getPricingRules);
router.put('/:id', pricingController.updatePricingRule);
router.delete('/:id', pricingController.deletePricingRule);

module.exports = router;

