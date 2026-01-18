const express = require('express');
const router = express.Router();
const { adminRateLimiter } = require('../middleware/rateLimit.middleware');
const adminController = require('../controllers/admin.controller');
const creditController = require('../controllers/credit.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');

router.use(authenticate, isAdmin);

// Existing admin endpoints
router.get('/dashboard', adminController.getDashboardStats);
router.get('/retailers', adminController.getAllRetailers);
router.get('/retailers/:id/credit', adminController.getRetailerCredit);
router.get('/credit/analytics', adminController.getCreditAnalytics);
router.get('/credit/overdue', adminController.getOverdueCredits);

router.get('/orders', adminController.getAllOrders);
router.put('/orders/:id/status', adminController.updateOrderStatus);

// New credit management endpoints
router.use('/credit', creditController);

// Order Decision Engine endpoints
router.post('/orders/:orderId/assign-winner', adminController.assignOrderWinner);
router.get('/orders/:orderId/offers', adminController.getOrderOffers);
router.post('/orders/process-expired', adminController.processExpiredOrders);

// Analytics endpoints
router.get('/analytics/offer-counts', adminController.getOfferCountPerOrder);
router.get('/analytics/response-time', adminController.getAverageResponseTime);
router.get('/analytics/win-rates', adminController.getWinRatePerWholesaler);
router.get('/analytics/dashboard', adminController.getAnalyticsDashboard);

// Admin override endpoints
const adminOverrideController = require('../controllers/adminOverride.controller');
router.use('/overrides', adminOverrideController);

module.exports = router;
