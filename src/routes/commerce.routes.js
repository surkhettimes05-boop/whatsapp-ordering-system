const express = require('express');
const router = express.Router();
const retailerScope = require('../middleware/retailerScope.middleware');
const controller = require('../controllers/commerce.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');

// Customer-facing catalog is public. It exposes only active products.
router.get('/catalog', controller.catalog);
router.get('/categories', controller.categories);
router.get('/meta-catalog-feed.csv', controller.metaCatalogFeed);

// Cart/checkout APIs are protected operational endpoints.
// WhatsApp uses commerce.service directly after identifying the retailer by phone.
router.get('/retailers/:retailerId/cart', authenticate, retailerScope, controller.getCart);
router.post('/retailers/:retailerId/cart/items', authenticate, retailerScope, controller.addCartItem);
router.put('/retailers/:retailerId/cart/items/:productId', authenticate, retailerScope, controller.setCartItem);
router.delete('/retailers/:retailerId/cart', authenticate, retailerScope, controller.clearCart);
router.post('/retailers/:retailerId/checkout', authenticate, retailerScope, controller.checkout);
router.get('/retailers/:retailerId/addresses', authenticate, retailerScope, controller.getAddresses);
router.post('/retailers/:retailerId/addresses', authenticate, retailerScope, controller.saveAddress);

// Admin catalog + sales dashboard.
router.post('/admin/categories', authenticate, isAdmin, controller.createCategory);
router.post('/admin/products', authenticate, isAdmin, controller.createProduct);
router.put('/admin/products/:id', authenticate, isAdmin, controller.updateProduct);
router.get('/admin/orders', authenticate, isAdmin, async (req, res, next) => {
  try { res.json({ data: await require('../services/commerce.service').listOperationalOrders(req.query) }); } catch (error) { next(error); }
});
router.get('/admin/orders/:id', authenticate, isAdmin, async (req, res, next) => {
  try { res.json({ data: await require('../services/commerce.service').getOperationalOrder(req.params.id) }); } catch (error) { next(error); }
});
router.put('/admin/orders/:id/status', authenticate, isAdmin, controller.updateOrderStatus);
router.get('/admin/sales', authenticate, isAdmin, controller.sales);
router.get('/admin/reconciliation', authenticate, isAdmin, controller.reconciliation);
router.get('/admin/service-areas', authenticate, isAdmin, controller.listServiceAreas);
router.post('/admin/service-areas', authenticate, isAdmin, controller.upsertServiceArea);
router.get('/admin/support-tickets', authenticate, isAdmin, controller.listSupportTickets);
router.put('/admin/support-tickets/:id', authenticate, isAdmin, controller.updateSupportTicket);

router.post('/admin/inventory/:productId/receipts', authenticate, isAdmin, async (req, res) => {
  try { res.json({ success: true, data: await require('../services/commerceInventory.service').receiveStock(req.params.productId, Number(req.body.quantity), req.body.reference, req.user.id) }); }
  catch (error) { res.status(400).json({ error: error.message }); }
});
router.get('/admin/messages/failed', authenticate, isAdmin, async (req, res, next) => {
  try {
    const prisma = require('../config/database');
    res.json({ data: { inbound: await prisma.whatsAppInboundEvent.findMany({ where: { processedAt: null, attempts: { gte: 10 } }, take: 50 }), outbound: await prisma.whatsAppOutbox.findMany({ where: { sentAt: null, attempts: { gte: 10 } }, take: 50 }) } });
  } catch (error) { next(error); }
});
router.post('/admin/messages/:kind/:id/retry', authenticate, isAdmin, async (req, res, next) => {
  try {
    const prisma = require('../config/database');
    const model = req.params.kind === 'inbound' ? prisma.whatsAppInboundEvent : req.params.kind === 'outbound' ? prisma.whatsAppOutbox : null;
    if (!model) return res.status(400).json({ error: 'Unknown message type' });
    await model.update({ where: { id: req.params.id }, data: { attempts: 0, nextAttemptAt: new Date(), lastError: null } });
    res.json({ success: true });
  } catch (error) { next(error); }
});
module.exports = router;
