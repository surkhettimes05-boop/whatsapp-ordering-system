const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/admin.middleware');
const { orderCreationRateLimiter } = require('../middleware/rateLimit.middleware');

router.use(authenticate);

// User routes (with rate limiting for order creation)
router.post('/', orderCreationRateLimiter, orderController.createOrder);
router.get('/', orderController.getUserOrders);
router.get('/:id', orderController.getOrder);
router.put('/:id/cancel', orderController.cancelOrder);

// Admin routes
router.get('/admin/all', isAdmin, orderController.getAllOrders);
const { validateOrderTransition, getAllowedTransitions } = require('../middleware/orderStateValidation.middleware');

// Get allowed transitions for an order
router.get('/:id/transitions', getAllowedTransitions);

// Update order status (with state machine validation)
router.put('/:id/status', isAdmin, validateOrderTransition, orderController.updateOrderStatus);

module.exports = router;

