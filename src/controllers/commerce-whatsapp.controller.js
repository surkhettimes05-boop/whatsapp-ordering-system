const prisma = require('../config/database');
const commerceService = require('../services/commerce.service');
const whatsappService = require('../services/whatsapp.service');
const conversationService = require('../services/conversation.service');
const legacyController = require('./whatsapp.controller');
const logger = require('../utils/logger');

class CommerceWhatsAppController {
  async handleIncomingMessage(req) {
    const { From, Body, ProfileName, MessageSid, To } = req.body;
    const phone = String(From || '').replace('whatsapp:', '').trim();
    const text = String(Body || '').trim();
    const lowerText = text.toLowerCase();

    if (!phone) {
      logger.warn('WhatsApp webhook missing sender', { messageSid: MessageSid });
      return;
    }

    logger.info('Incoming commerce WhatsApp message', {
      from: phone,
      to: To,
      messageSid: MessageSid,
      bodyLength: text.length
    });

    prisma.whatsAppMessage.create({
      data: {
        from: phone,
        to: 'SYSTEM',
        body: text.substring(0, 1000),
        mediaUrl: req.body.MediaUrl0 || null,
        direction: 'INCOMING'
      }
    }).catch(error => logger.warn('Failed to log inbound WhatsApp message', { error: error.message }));

    const wholesaler = await prisma.wholesaler.findUnique({ where: { whatsappNumber: phone } });
    if (wholesaler) {
      return legacyController.handleWholesalerMessage(wholesaler, lowerText, phone);
    }

    let retailer = await prisma.retailer.findFirst({
      where: { OR: [{ whatsappNumber: phone }, { phoneNumber: phone }] }
    });

    if (!retailer) {
      retailer = await prisma.retailer.create({
        data: {
          phoneNumber: phone,
          whatsappNumber: phone,
          pasalName: ProfileName || 'WhatsApp Customer',
          ownerName: ProfileName || null,
          status: 'ACTIVE'
        }
      });
      await whatsappService.sendMessage(phone, whatsappService.getMainMenu(), { immediate: true });
      return;
    }

    if (retailer.status === 'SUSPENDED' || retailer.status === 'DELETED' || retailer.creditStatus === 'BLOCKED') {
      await whatsappService.sendMessage(phone, '❌ Your account is not active. Please contact support.', { immediate: true });
      return;
    }

    const state = await conversationService.getState(retailer.id);

    if (state?.step === 'CHECKOUT_ADDRESS' && text) {
      retailer = await prisma.retailer.update({
        where: { id: retailer.id },
        data: { address: text }
      });
      const cart = await commerceService.getCart(retailer.id);
      await conversationService.setState(retailer.id, 'CONFIRMATION_PENDING', {});
      await whatsappService.sendMessage(
        phone,
        whatsappService.formatCartSummary(cart) + `\nDelivery: ${retailer.address}\n\nReply *YES* to place the order or *NO* to keep shopping.`,
        { immediate: true }
      );
      return;
    }

    if (state?.step === 'CONFIRMATION_PENDING') {
      if (['yes', 'confirm', 'ok'].includes(lowerText)) {
        return this.confirmCheckout(retailer, phone);
      }
      if (['no', 'cancel'].includes(lowerText)) {
        await conversationService.clearState(retailer.id);
        await whatsappService.sendMessage(phone, 'Checkout cancelled. Your cart is still saved.', { immediate: true });
        return;
      }
    }

    if (['hi', 'hello', 'start', 'menu'].includes(lowerText)) {
      await conversationService.clearState(retailer.id);
      await whatsappService.sendMessage(phone, whatsappService.getMainMenu(), { immediate: true });
      return;
    }

    if (['view catalog', 'catalog', 'shop', '1'].includes(lowerText)) {
      return this.sendCatalog(phone);
    }

    if (['cart', 'my cart'].includes(lowerText)) {
      const cart = await commerceService.getCart(retailer.id);
      await whatsappService.sendMessage(phone, whatsappService.formatCartSummary(cart), { immediate: true });
      return;
    }

    if (['place order', 'checkout'].includes(lowerText)) {
      return this.beginCheckout(retailer, phone);
    }

    if (['recent orders', 'orders', '3'].includes(lowerText)) {
      const orders = await prisma.order.findMany({
        where: { retailerId: retailer.id },
        orderBy: { createdAt: 'desc' },
        take: 5
      });
      await whatsappService.sendMessage(phone, whatsappService.formatRecentOrders(orders), { immediate: true });
      return;
    }

    if (['help', '4'].includes(lowerText)) {
      await whatsappService.sendMessage(phone, whatsappService.getHelpMessage(), { immediate: true });
      return;
    }

    const orderMatch = text.match(/^(\d+)\s*[xX*]\s*(\d+)$/);
    if (orderMatch) {
      return this.addCatalogItem(retailer, phone, Number(orderMatch[1]), Number(orderMatch[2]));
    }

    await whatsappService.sendMessage(
      phone,
      'I did not understand that. Type *catalog*, *cart*, *checkout*, *orders*, or *menu*.',
      { immediate: true }
    );
  }

  async sendCatalog(phone) {
    const catalog = await commerceService.listCatalog({ limit: 20, page: 1 });
    if (!catalog.products.length) {
      await whatsappService.sendMessage(phone, '📦 No products are active in the catalog yet.', { immediate: true });
      return;
    }

    await whatsappService.sendMessage(phone, whatsappService.formatProductList(
      catalog.products.map(p => ({
        name: p.name,
        fixedPrice: p.price,
        unit: p.packSize || p.unit
      }))
    ), { immediate: true });

    for (const [index, product] of catalog.products.slice(0, 5).entries()) {
      if (!product.imageUrl || !/^https:\/\//i.test(product.imageUrl)) continue;
      const caption = `${index + 1}. *${product.name}*\nRs. ${product.price}${product.packSize ? ' • ' + product.packSize : ''}\nSKU: ${product.sku || '—'}\nReply *${index + 1} x 1* to add one.`;
      try {
        await whatsappService.sendMessage(phone, caption, {
          immediate: true,
          mediaUrl: product.imageUrl
        });
      } catch (error) {
        logger.warn('Failed to send catalog image', { productId: product.id, error: error.message });
      }
    }
  }

  async addCatalogItem(retailer, phone, index, quantity) {
    const catalog = await commerceService.listCatalog({ limit: 20, page: 1 });
    if (index < 1 || index > catalog.products.length) {
      await whatsappService.sendMessage(phone, '❌ Invalid product number. Type *catalog* to refresh the list.', { immediate: true });
      return;
    }

    const product = catalog.products[index - 1];
    const cart = await commerceService.addCartItem(retailer.id, product.id, quantity);
    await whatsappService.sendMessage(
      phone,
      `✅ Added ${quantity} × *${product.name}*\nCart total: Rs. ${cart.totalAmount}\n\nType *cart* to review or *checkout* to place the order.`,
      { immediate: true }
    );
  }

  async beginCheckout(retailer, phone) {
    const cart = await commerceService.getCart(retailer.id);
    if (!cart.items.length) {
      await whatsappService.sendMessage(phone, '🛒 Your cart is empty. Type *catalog* to shop.', { immediate: true });
      return;
    }

    if (!retailer.address) {
      await conversationService.setState(retailer.id, 'CHECKOUT_ADDRESS', {});
      await whatsappService.sendMessage(phone, '📍 Please send your delivery address.', { immediate: true });
      return;
    }

    await conversationService.setState(retailer.id, 'CONFIRMATION_PENDING', {});
    await whatsappService.sendMessage(
      phone,
      whatsappService.formatCartSummary(cart) + `\nDelivery: ${retailer.address}\n\nReply *YES* to place the order or *NO* to keep shopping.`,
      { immediate: true }
    );
  }

  async confirmCheckout(retailer, phone) {
    try {
      const order = await commerceService.checkoutCart({
        retailerId: retailer.id,
        paymentMode: 'COD',
        sourceChannel: 'WHATSAPP',
        deliveryName: retailer.ownerName || retailer.pasalName,
        deliveryPhone: retailer.phoneNumber,
        deliveryAddress: retailer.address
      });

      await conversationService.clearState(retailer.id);
      await whatsappService.sendMessage(
        phone,
        `✅ *Order placed*\n\nOrder: *${order.orderNumber}*\nTotal: Rs. ${order.totalAmount}\nPayment: COD\nStatus: ${order.status}\n\nWe will send updates here as your order moves forward.`,
        { immediate: true }
      );
    } catch (error) {
      logger.error('WhatsApp checkout failed', { retailerId: retailer.id, error: error.message });
      await whatsappService.sendMessage(phone, `⚠️ Could not place the order: ${error.message}`, { immediate: true });
    }
  }
}

module.exports = new CommerceWhatsAppController();
