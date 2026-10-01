const express = require('express');
const router = express.Router();
const controller = require('../controllers/commerce.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');

// Customer-facing catalog is public. It exposes only active products.
router.get('/catalog', controller.catalog);
router.get('/categories', controller.categories);

// Cart/checkout APIs are protected operational endpoints.
// WhatsApp uses commerce.service directly after identifying the retailer by phone.
router.get('/retailers/:retailerId/cart', authenticate, controller.getCart);
router.post('/retailers/:retailerId/cart/items', authenticate, controller.addCartItem);
router.put('/retailers/:retailerId/cart/items/:productId', authenticate, controller.setCartItem);
router.delete('/retailers/:retailerId/cart', authenticate, controller.clearCart);
router.post('/retailers/:retailerId/checkout', authenticate, controller.checkout);

// Admin catalog + sales dashboard.
router.post('/admin/categories', authenticate, isAdmin, controller.createCategory);
router.post('/admin/products', authenticate, isAdmin, controller.createProduct);
router.put('/admin/products/:id', authenticate, isAdmin, controller.updateProduct);
router.get('/admin/sales', authenticate, isAdmin, controller.sales);
router.get('/admin/reconciliation', authenticate, isAdmin, controller.reconciliation);

module.exports = router;
