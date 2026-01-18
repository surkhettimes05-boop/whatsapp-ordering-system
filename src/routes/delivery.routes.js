const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/delivery.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/admin.middleware');

// Public route (tracking)
router.get('/track/:trackingNumber', deliveryController.getDeliveryByTracking);

// Protected routes
router.use(authenticate);

router.get('/order/:orderId', deliveryController.getDeliveryByOrder);

// Admin routes
router.use(isAdmin);

router.post('/order/:orderId', deliveryController.createDelivery);
router.get('/', deliveryController.getAllDeliveries);
router.put('/:id/status', deliveryController.updateDeliveryStatus);
router.put('/:id/location', deliveryController.updateLocation);
router.put('/:id/assign', deliveryController.assignAgent);

module.exports = router;

