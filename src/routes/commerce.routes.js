const express = require('express');
const router = express.Router();
const controller = require('../controllers/commerce.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');

// Customer-facing catalog is public. It exposes only active products.
router.get('/catalog', controller.catalog);
router.get('/categories', controller.categories);
router.get('/meta-catalog-feed.csv', controller.metaCatalogFeed);

// Cart/checkout APIs are protected operational endpoints.
// WhatsApp uses commerce.service directly after identifying the retailer by phone.
router.get('/retailers/:retailerId/cart', authenticate, controller.getCart);
router.post('/retailers/:retailerId/cart/items', authenticate, controller.addCartItem);
router.put('/retailers/:retailerId/cart/items/:productId', authenticate, controller.setCartItem);
router.delete('/retailers/:retailerId/cart', authenticate, controller.clearCart);
router.post('/retailers/:retailerId/checkout', authenticate, controller.checkout);
router.get('/retailers/:retailerId/addresses', authenticate, controller.getAddresses);
router.post('/retailers/:retailerId/addresses', authenticate, controller.saveAddress);

// Admin catalog + sales dashboard.
router.post('/admin/categories', authenticate, isAdmin, controller.createCategory);
router.post('/admin/products', authenticate, isAdmin, controller.createProduct);
router.put('/admin/products/:id', authenticate, isAdmin, controller.updateProduct);
router.put('/admin/orders/:id/status', authenticate, isAdmin, controller.updateOrderStatus);
router.get('/admin/sales', authenticate, isAdmin, controller.sales);
router.get('/admin/reconciliation', authenticate, isAdmin, controller.reconciliation);
router.get('/admin/service-areas', authenticate, isAdmin, controller.listServiceAreas);
router.post('/admin/service-areas', authenticate, isAdmin, controller.upsertServiceArea);
router.get('/admin/support-tickets', authenticate, isAdmin, controller.listSupportTickets);
router.put('/admin/support-tickets/:id', authenticate, isAdmin, controller.updateSupportTicket);

module.exports = router;
