const express = require('express');
const router = express.Router();
const controller = require('../controllers/shopping.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');

router.get('/serviceability', controller.serviceability);
router.get('/offers', controller.offers);
router.get('/payments/providers', controller.providers);

router.get('/payments/khalti/callback', controller.khaltiCallback);
router.get('/payments/esewa/:paymentId/pay', controller.esewaPay);
router.get('/payments/esewa/success', controller.esewaSuccess);
router.post('/payments/esewa/success', controller.esewaSuccess);
router.get('/payments/esewa/failure', controller.esewaFailure);
router.post('/payments/esewa/failure', controller.esewaFailure);

router.get('/retailers/:retailerId/addresses', authenticate, controller.addresses);
router.post('/retailers/:retailerId/addresses', authenticate, controller.createAddress);
router.put('/retailers/:retailerId/addresses/:id', authenticate, controller.updateAddress);
router.post('/retailers/:retailerId/addresses/:id/default', authenticate, controller.defaultAddress);
router.delete('/retailers/:retailerId/addresses/:id', authenticate, controller.deleteAddress);

router.post('/retailers/:retailerId/cart/coupon', authenticate, controller.applyCoupon);
router.delete('/retailers/:retailerId/cart/coupon', authenticate, controller.removeCoupon);
router.get('/retailers/:retailerId/quote', authenticate, controller.quote);
router.post('/retailers/:retailerId/checkout', authenticate, controller.checkout);
router.post('/payments/:orderId/:provider', authenticate, controller.initiatePayment);

router.get('/admin/offers', authenticate, isAdmin, controller.offers);
router.post('/admin/offers', authenticate, isAdmin, controller.createOffer);
router.put('/admin/offers/:id', authenticate, isAdmin, controller.updateOffer);
router.get('/admin/service-areas', authenticate, isAdmin, controller.listServiceAreas);
router.post('/admin/service-areas', authenticate, isAdmin, controller.upsertServiceArea);

module.exports = router;
