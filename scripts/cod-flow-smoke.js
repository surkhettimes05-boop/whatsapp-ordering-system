#!/usr/bin/env node
require('dotenv').config();
process.env.WHATSAPP_PROVIDER = 'meta';
process.env.META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v26.0';
process.env.META_CATALOG_ID = process.env.META_CATALOG_ID || 'TEST-CATALOG';

const prisma = require('../src/config/database');
const { seedFreeTest } = require('./seed-free-test');
const commerce = require('../src/services/commerce.service');
const shopping = require('../src/services/shopping.service');
const controller = require('../src/controllers/commerce-whatsapp.controller');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function event(phone, data = {}) {
  return {
    provider: 'meta',
    providerMessageId: data.providerMessageId || ('smoke-' + Date.now() + '-' + Math.random().toString(36).slice(2)),
    phone,
    profileName: 'COD Smoke Customer',
    type: data.type || 'text',
    text: data.text || '',
    actionId: data.actionId || null,
    location: data.location || null
  };
}

async function run() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  await seedFreeTest();

  const phone = '97798' + String(Date.now()).slice(-8);

  await controller.processEvent(event(phone, { text: 'hi' }));
  const retailer = await prisma.retailer.findUnique({ where: { phoneNumber: phone } });
  assert(retailer, 'WhatsApp customer creation failed');

  await controller.processEvent(event(phone, { text: 'catalog' }));
  await controller.processEvent(event(phone, { text: 'categories' }));
  await controller.processEvent(event(phone, { text: 'search rice' }));

  const catalog = await commerce.listCatalog({ limit: 30, page: 1 });
  const productIndex = catalog.products.findIndex(p => p.sku === 'TEST-RICE-5KG');
  assert(productIndex >= 0, 'Seeded test product not found in catalog');

  await controller.processEvent(event(phone, { text: String(productIndex + 1) + 'x2' }));
  let cart = await commerce.getCart(retailer.id);
  assert(cart.items.some(i => i.product.sku === 'TEST-RICE-5KG' && i.quantity === 2), 'WhatsApp cart add failed');

  await controller.processEvent(event(phone, { text: 'coupon TEST10' }));
  const quoted = await shopping.quote(retailer.id);
  assert(quoted.couponCode === 'TEST10', 'Coupon was not applied');
  assert(quoted.discountAmount > 0, 'Coupon discount is zero');

  await controller.processEvent(event(phone, { text: 'cart' }));
  await controller.processEvent(event(phone, { text: 'checkout' }));
  await controller.processEvent(event(phone, { text: 'Birendranagar' }));
  await controller.processEvent(event(phone, { text: 'Test Chowk, Birendranagar' }));
  await controller.processEvent(event(phone, { actionId: 'checkout_review', type: 'interactive' }));
  await controller.processEvent(event(phone, { actionId: 'checkout_cod', type: 'interactive' }));

  const order = await prisma.order.findFirst({
    where: { retailerId: retailer.id },
    orderBy: { createdAt: 'desc' },
    include: { items: { include: { product: true } } }
  });
  assert(order, 'COD order was not created');
  assert(order.paymentMode === 'COD', 'Order is not COD');
  assert(order.sourceChannel === 'WHATSAPP', 'Order source is not WhatsApp');
  assert(order.couponCode === 'TEST10', 'Order did not retain coupon');
  assert(Number(order.discountAmount) > 0, 'Order discount missing');
  assert(order.deliveryAddress && order.deliveryAddress.includes('Test Chowk'), 'Delivery address missing');
  assert(order.serviceAreaCode === 'BIRENDRANAGAR-TEST', 'Service area was not resolved');

  await controller.processEvent(event(phone, { text: 'track ' + order.orderNumber }));

  for (const status of ['CONFIRMED', 'PROCESSING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
    await commerce.updateCommerceOrderStatus(order.id, status);
  }

  const delivered = await prisma.order.findUnique({ where: { id: order.id } });
  assert(delivered.status === 'DELIVERED', 'Delivery lifecycle did not reach DELIVERED');
  assert(delivered.deliveredAt, 'deliveredAt was not set');

  await controller.processEvent(event(phone, { text: 'track ' + order.orderNumber }));

  const dashboard = await commerce.getSalesDashboard({ range: 'today' });
  assert(dashboard.deliveredOrders >= 1, 'Dashboard did not count delivered order');
  assert(dashboard.sales > 0, 'Dashboard sales total is zero');

  const date = new Date().toISOString().slice(0, 10);
  const reconciliation = await commerce.getDailyReconciliation(date);
  const rice = reconciliation.items.find(item => item.sku === 'TEST-RICE-5KG');
  assert(rice && rice.quantity >= 2, 'SKU reconciliation did not include delivered rice quantity');
  assert(reconciliation.netSales > 0, 'Reconciliation net sales is zero');

  console.log(JSON.stringify({
    ok: true,
    flow: [
      'WhatsApp customer',
      'catalog',
      'categories',
      'search',
      'cart',
      'coupon',
      'address',
      'serviceability',
      'COD checkout',
      'order',
      'tracking',
      'delivery',
      'dashboard',
      'SKU reconciliation'
    ],
    orderNumber: order.orderNumber,
    total: Number(order.totalAmount),
    discount: Number(order.discountAmount),
    deliveredStatus: delivered.status,
    dashboardDeliveredOrders: dashboard.deliveredOrders,
    reconciliationUnits: reconciliation.totalUnits
  }, null, 2));
}

run()
  .catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await new Promise(resolve => setTimeout(resolve, 150));
    await prisma.$disconnect();
  });
