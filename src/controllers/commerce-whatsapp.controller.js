const prisma = require('../config/database');
const commerceService = require('../services/commerce.service');
const whatsappService = require('../services/whatsapp.service');
const conversationService = require('../services/conversation.service');
const webhookService = require('../services/whatsappWebhook.service');
const legacyController = require('./whatsapp.controller');
const logger = require('../utils/logger');

function cleanPhone(value) {
  return String(value || '').replace('whatsapp:', '').replace(/^\+/, '').trim();
}

class CommerceWhatsAppController {
  async handleIncomingEvent(event) {
    if (!event) return;
    if (event.kind === 'status') return;

    const reserved = await webhookService.reserveInboundEvent(event);
    if (reserved.duplicate) {
      logger.info('Ignoring duplicate WhatsApp webhook', { messageId: event.providerMessageId });
      return;
    }

    try {
      await this.processEvent(event);
      await webhookService.markProcessed(reserved.event?.id);
    } catch (error) {
      logger.error('WhatsApp commerce event failed', {
        error: error.message,
        stack: error.stack,
        providerMessageId: event.providerMessageId
      });
      throw error;
    }
  }

  async processEvent(event) {
    const phone = cleanPhone(event.phone);
    const text = String(event.text || '').trim();
    const lowerText = text.toLowerCase();
    const actionId = event.actionId || null;

    if (!phone) return;

    prisma.whatsAppMessage.create({
      data: {
        from: phone,
        to: 'SYSTEM',
        body: text.substring(0, 1000),
        mediaUrl: event.mediaUrl || null,
        direction: 'INCOMING'
      }
    }).catch(error => logger.warn('Failed to log inbound WhatsApp message', { error: error.message }));

    const wholesaler = await prisma.wholesaler.findFirst({
      where: { OR: [{ whatsappNumber: phone }, { phoneNumber: phone }] }
    });
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
          pasalName: event.profileName || 'WhatsApp Customer',
          ownerName: event.profileName || null,
          status: 'ACTIVE'
        }
      });
      await this.sendMainMenu(phone);
      return;
    }

    if (retailer.status === 'SUSPENDED' || retailer.status === 'DELETED' || retailer.creditStatus === 'BLOCKED') {
      await whatsappService.sendMessage(phone, '❌ Your account is not active. Please contact support.', { immediate: true });
      return;
    }

    if (event.nativeOrder?.products?.length) {
      const cart = await commerceService.replaceCartFromNativeOrder(retailer.id, event.nativeOrder.products);
      await whatsappService.sendMessage(
        phone,
        whatsappService.formatCartSummary(cart) + '\n\n✅ WhatsApp cart received.',
        { immediate: true }
      );
      return this.beginCheckout(retailer, phone);
    }

    const state = await conversationService.getState(retailer.id);
    if (state && await this.handleState(retailer, phone, event, state)) return;

    if (actionId) {
      if (await this.handleAction(retailer, phone, actionId)) return;
    }

    if (['hi', 'hello', 'start', 'menu'].includes(lowerText)) {
      await conversationService.clearState(retailer.id);
      return this.sendMainMenu(phone);
    }

    if (['catalog', 'shop', 'view catalog', '1'].includes(lowerText)) return this.sendCatalog(phone);
    if (['categories', 'category'].includes(lowerText)) return this.sendCategories(phone);
    if (['offers', 'deals', 'offer'].includes(lowerText)) return this.sendOffers(phone);
    if (['cart', 'my cart'].includes(lowerText)) return this.sendCart(retailer, phone);
    if (['checkout', 'place order'].includes(lowerText)) return this.beginCheckout(retailer, phone);
    if (['orders', 'recent orders', '3'].includes(lowerText)) return this.sendOrders(retailer, phone);
    if (['repeat', 'repeat order', 'order again'].includes(lowerText)) return this.repeatLastOrder(retailer, phone);
    if (['address', 'addresses', 'saved address'].includes(lowerText)) return this.showAddress(retailer, phone);
    if (['support', 'help me', 'customer care'].includes(lowerText)) return this.startSupport(retailer, phone);
    if (['help', '4'].includes(lowerText)) {
      return whatsappService.sendMessage(phone, whatsappService.getHelpMessage(), { immediate: true });
    }

    if (lowerText.startsWith('search ')) {
      return this.sendSearchResults(phone, text.slice(7).trim());
    }

    if (lowerText.startsWith('track')) {
      const reference = text.slice(5).trim();
      return this.trackOrder(retailer, phone, reference);
    }

    const indexedOrder = text.match(/^(\d+)\s*[xX*]\s*(\d+)$/);
    if (indexedOrder) {
      return this.addCatalogItem(retailer, phone, Number(indexedOrder[1]), Number(indexedOrder[2]));
    }

    if (text.length >= 2) {
      const results = await commerceService.listCatalog({ search: text, limit: 10, page: 1 });
      if (results.products.length) return this.sendProducts(phone, results.products, `Results for “${text}”`);
    }

    return whatsappService.sendMessage(
      phone,
      'I could not find that. Type *menu* to browse, or try *search <product>*.',
      { immediate: true }
    );
  }

  async handleState(retailer, phone, event, state) {
    const text = String(event.text || '').trim();

    if (state.step === 'CHECKOUT_SERVICE_AREA') {
      const result = await commerceService.checkServiceArea(text);
      if (!result.serviceable) {
        await whatsappService.sendMessage(phone, 'Sorry, we do not deliver to that postal/service code yet. Send another code or type *menu*.', { immediate: true });
        return true;
      }
      await conversationService.setState(retailer.id, 'CHECKOUT_ADDRESS', {
        postalCode: text,
        area: result.area || null
      });
      await whatsappService.sendMessage(
        phone,
        result.area?.etaText
          ? `✅ Delivery available. ${result.area.etaText}\n\nNow send your full delivery address or WhatsApp location.`
          : '✅ Delivery available. Now send your full delivery address or WhatsApp location.',
        { immediate: true }
      );
      return true;
    }

    if (state.step === 'CHECKOUT_ADDRESS') {
      const addressText = event.location?.address || event.location?.name || text;
      if (!addressText) {
        await whatsappService.sendMessage(phone, 'Please send a text address or WhatsApp location.', { immediate: true });
        return true;
      }

      const address = await commerceService.saveAddress(retailer.id, {
        label: 'Home',
        recipientName: retailer.ownerName || retailer.pasalName,
        phone: retailer.phoneNumber,
        addressLine1: addressText,
        city: state.data?.area?.city || retailer.city,
        district: state.data?.area?.district || retailer.district,
        postalCode: state.data?.postalCode || null,
        latitude: event.location?.latitude,
        longitude: event.location?.longitude,
        isDefault: true
      });
      await conversationService.clearState(retailer.id);
      return this.showCheckoutReview(retailer, phone, address);
    }

    if (state.step === 'SUPPORT_DESCRIPTION') {
      const ticket = await commerceService.createSupportTicket(retailer.id, {
        description: text || 'Customer requested support on WhatsApp'
      });
      await conversationService.clearState(retailer.id);
      await whatsappService.sendMessage(
        phone,
        `✅ Support request created: *${ticket.ticketNumber}*\nOur team can follow this ticket from the admin system.`,
        { immediate: true }
      );
      return true;
    }

    return false;
  }

  async handleAction(retailer, phone, actionId) {
    if (actionId === 'menu_catalog') return this.sendCatalog(phone), true;
    if (actionId === 'menu_categories') return this.sendCategories(phone), true;
    if (actionId === 'menu_offers') return this.sendOffers(phone), true;
    if (actionId === 'menu_cart') return this.sendCart(retailer, phone), true;
    if (actionId === 'menu_orders') return this.sendOrders(retailer, phone), true;
    if (actionId === 'menu_repeat') return this.repeatLastOrder(retailer, phone), true;
    if (actionId === 'menu_address') return this.showAddress(retailer, phone), true;
    if (actionId === 'menu_support') return this.startSupport(retailer, phone), true;
    if (actionId === 'checkout_start') return this.beginCheckout(retailer, phone), true;
    if (actionId === 'address_use') {
      const address = await commerceService.getDefaultAddress(retailer.id);
      if (!address) return this.askForAddress(retailer, phone), true;
      return this.showCheckoutReview(retailer, phone, address), true;
    }
    if (actionId === 'address_change') return this.askForAddress(retailer, phone), true;
    if (actionId === 'checkout_review') return this.choosePayment(retailer, phone), true;
    if (actionId === 'checkout_cod') return this.placeOrder(retailer, phone, 'COD'), true;
    if (actionId === 'checkout_online') return this.placeOrder(retailer, phone, 'ONLINE'), true;
    if (actionId === 'checkout_cancel') {
      await conversationService.clearState(retailer.id);
      await whatsappService.sendMessage(phone, 'Checkout cancelled. Your cart is still saved.', { immediate: true });
      return true;
    }
    if (actionId.startsWith('category:')) {
      const categoryId = actionId.slice('category:'.length);
      const result = await commerceService.listCatalog({ categoryId, limit: 30, page: 1 });
      return this.sendProducts(phone, result.products, 'Category'), true;
    }
    return false;
  }

  async sendMainMenu(phone) {
    if (whatsappService.usingMeta()) {
      try {
        return await whatsappService.sendList(
          phone,
          'Shop, reorder, track deliveries, and get support without leaving WhatsApp.',
          'Open menu',
          [
            {
              title: 'Shop',
              rows: [
                { id: 'menu_catalog', title: 'Browse catalog', description: 'Shop all products' },
                { id: 'menu_categories', title: 'Categories', description: 'Browse by category' },
                { id: 'menu_offers', title: 'Offers', description: 'See current savings' },
                { id: 'menu_cart', title: 'My cart', description: 'Review cart' }
              ]
            },
            {
              title: 'Orders & support',
              rows: [
                { id: 'menu_orders', title: 'My orders', description: 'Track recent orders' },
                { id: 'menu_repeat', title: 'Repeat last order', description: 'Refill your cart' },
                { id: 'menu_address', title: 'Saved address', description: 'View delivery address' },
                { id: 'menu_support', title: 'Support', description: 'Get help' }
              ]
            }
          ],
          { header: 'WhatsApp Shopping', footer: 'You can also type a product name.' }
        );
      } catch (error) {
        logger.warn('Interactive main menu failed; falling back to text', { error: error.message });
      }
    }
    return whatsappService.sendMessage(phone, whatsappService.getMainMenu(), { immediate: true });
  }

  async sendCatalog(phone) {
    const result = await commerceService.listCatalog({ limit: 30, page: 1 });
    return this.sendProducts(phone, result.products, 'Shop our catalog');
  }

  async sendCategories(phone) {
    const categories = await commerceService.listCategories();
    if (!categories.length) return whatsappService.sendMessage(phone, 'No categories are available yet.', { immediate: true });

    if (whatsappService.usingMeta()) {
      try {
        return await whatsappService.sendList(
          phone,
          'Choose a category.',
          'Categories',
          [{
            title: 'Shop by category',
            rows: categories.slice(0, 10).map(category => ({
              id: `category:${category.id}`,
              title: category.name,
              description: category.description || 'Browse products'
            }))
          }],
          { header: 'Categories' }
        );
      } catch (error) {
        logger.warn('Category list failed', { error: error.message });
      }
    }

    return whatsappService.sendMessage(
      phone,
      '📂 *Categories*\n\n' + categories.map((c, i) => `${i + 1}. ${c.name}`).join('\n'),
      { immediate: true }
    );
  }

  async sendOffers(phone) {
    const products = await commerceService.listOffers(30);
    if (!products.length) {
      return whatsappService.sendMessage(phone, '🔥 No discounted products are active right now.', { immediate: true });
    }
    return this.sendProducts(phone, products, 'Current offers');
  }

  async sendSearchResults(phone, query) {
    if (!query) return whatsappService.sendMessage(phone, 'Type *search* followed by a product name.', { immediate: true });
    const result = await commerceService.listCatalog({ search: query, limit: 20, page: 1 });
    if (!result.products.length) {
      return whatsappService.sendMessage(phone, `No products found for “${query}”.`, { immediate: true });
    }
    return this.sendProducts(phone, result.products, `Results for “${query}”`);
  }

  async sendProducts(phone, products, title) {
    if (!products.length) return whatsappService.sendMessage(phone, 'No products found.', { immediate: true });

    const nativeProducts = products.filter(product => product.metaRetailerId);
    if (whatsappService.usingMeta() && process.env.META_CATALOG_ID && nativeProducts.length) {
      try {
        const grouped = new Map();
        for (const product of nativeProducts.slice(0, 30)) {
          const category = product.category?.name || 'Products';
          if (!grouped.has(category)) grouped.set(category, []);
          grouped.get(category).push({ productRetailerId: product.metaRetailerId });
        }
        const sections = [...grouped.entries()].slice(0, 10).map(([sectionTitle, productItems]) => ({
          title: sectionTitle,
          productItems
        }));
        return await whatsappService.sendProductList(phone, sections, {
          header: String(title || 'Shop').slice(0, 60),
          body: 'Browse products, open details, add multiple items to your WhatsApp cart, then send the cart to us.',
          footer: 'Prices and availability are validated at checkout.'
        });
      } catch (error) {
        logger.warn('Native Meta product list failed; falling back', { error: error.message });
      }
    }

    await whatsappService.sendMessage(
      phone,
      whatsappService.formatProductList(products.map(product => ({
        name: product.name,
        fixedPrice: product.price,
        mrp: product.mrp,
        unit: product.packSize || product.unit
      }))),
      { immediate: true }
    );

    for (const [index, product] of products.slice(0, 5).entries()) {
      if (!product.imageUrl || !/^https:\/\//i.test(product.imageUrl)) continue;
      await whatsappService.sendMessage(
        phone,
        `${index + 1}. *${product.name}*\nRs. ${product.price}${product.savings ? ` • Save Rs. ${product.savings}` : ''}\nSKU: ${product.sku || '—'}`,
        { immediate: true, mediaUrl: product.imageUrl }
      ).catch(() => {});
    }
  }

  async addCatalogItem(retailer, phone, index, quantity) {
    const catalog = await commerceService.listCatalog({ limit: 30, page: 1 });
    if (index < 1 || index > catalog.products.length) {
      return whatsappService.sendMessage(phone, '❌ Invalid product number. Type *catalog* to refresh.', { immediate: true });
    }
    const product = catalog.products[index - 1];
    const cart = await commerceService.addCartItem(retailer.id, product.id, quantity);
    await whatsappService.sendButtons(
      phone,
      `✅ Added ${quantity} × *${product.name}*\nCart total: Rs. ${cart.totalAmount}`,
      [
        { id: 'menu_cart', title: 'View cart' },
        { id: 'checkout_start', title: 'Checkout' }
      ]
    );
  }

  async sendCart(retailer, phone) {
    const cart = await commerceService.getCart(retailer.id);
    const summary = whatsappService.formatCartSummary(cart);
    if (!cart.items.length) {
      return whatsappService.sendButtons(phone, summary, [{ id: 'menu_catalog', title: 'Browse catalog' }]);
    }
    return whatsappService.sendButtons(
      phone,
      summary,
      [
        { id: 'checkout_start', title: 'Checkout' },
        { id: 'menu_catalog', title: 'Keep shopping' }
      ]
    );
  }

  async beginCheckout(retailer, phone) {
    const cart = await commerceService.getCart(retailer.id);
    if (!cart.items.length) {
      return whatsappService.sendButtons(phone, '🛒 Your cart is empty.', [{ id: 'menu_catalog', title: 'Browse catalog' }]);
    }

    const address = await commerceService.getDefaultAddress(retailer.id);
    if (address) {
      return whatsappService.sendButtons(
        phone,
        `📍 Deliver to:\n*${address.label}*\n${address.addressLine1}${address.city ? ', ' + address.city : ''}${address.postalCode ? ' • ' + address.postalCode : ''}`,
        [
          { id: 'address_use', title: 'Use address' },
          { id: 'address_change', title: 'Change address' }
        ]
      );
    }

    if (retailer.address) {
      const saved = await commerceService.saveAddress(retailer.id, {
        label: 'Home',
        recipientName: retailer.ownerName || retailer.pasalName,
        phone: retailer.phoneNumber,
        addressLine1: retailer.address,
        city: retailer.city,
        district: retailer.district,
        latitude: retailer.latitude,
        longitude: retailer.longitude,
        isDefault: true
      });
      return this.showCheckoutReview(retailer, phone, saved);
    }

    return this.askForAddress(retailer, phone);
  }

  async askForAddress(retailer, phone) {
    const areas = await commerceService.listServiceAreas();
    if (areas.some(area => area.isActive)) {
      await conversationService.setState(retailer.id, 'CHECKOUT_SERVICE_AREA', {});
      return whatsappService.sendMessage(phone, '📍 Send your delivery postal/service code to check availability.', { immediate: true });
    }
    await conversationService.setState(retailer.id, 'CHECKOUT_ADDRESS', {});
    return whatsappService.sendMessage(phone, '📍 Send your full delivery address or WhatsApp location.', { immediate: true });
  }

  async showCheckoutReview(retailer, phone, address) {
    const cart = await commerceService.getCart(retailer.id);
    return whatsappService.sendButtons(
      phone,
      whatsappService.formatCartSummary(cart) + `\n📍 Delivery: ${address.addressLine1}\n\nReview your order before payment.`,
      [
        { id: 'checkout_review', title: 'Continue' },
        { id: 'menu_cart', title: 'Edit cart' },
        { id: 'checkout_cancel', title: 'Cancel' }
      ]
    );
  }

  async choosePayment(retailer, phone) {
    const cart = await commerceService.getCart(retailer.id);
    return whatsappService.sendButtons(
      phone,
      `💳 *Choose payment*\nOrder total: Rs. ${cart.totalAmount}`,
      [
        { id: 'checkout_cod', title: 'Cash on delivery' },
        { id: 'checkout_online', title: 'Pay online' }
      ],
      { footer: 'Online payment uses the configured Nepal payment provider.' }
    );
  }

  async placeOrder(retailer, phone, paymentMode) {
    const address = await commerceService.getDefaultAddress(retailer.id);
    if (!address) return this.askForAddress(retailer, phone);

    const order = await commerceService.checkoutCart({
      retailerId: retailer.id,
      paymentMode,
      sourceChannel: 'WHATSAPP',
      deliveryName: address.recipientName || retailer.ownerName || retailer.pasalName,
      deliveryPhone: address.phone || retailer.phoneNumber,
      deliveryAddress: address.addressLine1
    });

    if (paymentMode === 'ONLINE') {
      try {
        const payment = await commerceService.createOnlinePayment(order.id);
        await whatsappService.sendCtaUrl(
          phone,
          `Order *${order.orderNumber}* is reserved for checkout.\nAmount: Rs. ${order.totalAmount}`,
          'Pay now',
          payment.checkoutUrl,
          { header: 'Secure payment' }
        );
        return;
      } catch (error) {
        logger.warn('Online payment unavailable; order retained', { orderId: order.id, error: error.message });
        await whatsappService.sendMessage(
          phone,
          `✅ Order *${order.orderNumber}* created, but online payment is not configured yet.\nPlease contact support or use COD on your next order.`,
          { immediate: true }
        );
        return;
      }
    }

    await whatsappService.sendButtons(
      phone,
      `✅ *Order placed*\n\nOrder: *${order.orderNumber}*\nTotal: Rs. ${order.totalAmount}\nPayment: COD\nStatus: ${order.status}\n\nWe will send status updates here until delivery.`,
      [
        { id: 'menu_orders', title: 'Track orders' },
        { id: 'menu_catalog', title: 'Shop again' }
      ]
    );
  }

  async sendOrders(retailer, phone) {
    const orders = await prisma.order.findMany({
      where: { retailerId: retailer.id },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    return whatsappService.sendMessage(phone, whatsappService.formatRecentOrders(orders), { immediate: true });
  }

  async trackOrder(retailer, phone, reference) {
    let order;
    if (reference) {
      order = await commerceService.getOrderForRetailer(retailer.id, reference);
    } else {
      order = await prisma.order.findFirst({
        where: { retailerId: retailer.id },
        orderBy: { createdAt: 'desc' }
      });
    }
    if (!order) return whatsappService.sendMessage(phone, 'Order not found.', { immediate: true });
    return whatsappService.sendMessage(
      phone,
      `📦 *${order.orderNumber}*\nStatus: *${String(order.status).replaceAll('_', ' ')}*\nTotal: Rs. ${order.totalAmount}\nPayment: ${order.paymentMode} / ${order.paymentStatus}`,
      { immediate: true }
    );
  }

  async repeatLastOrder(retailer, phone) {
    try {
      const cart = await commerceService.repeatLastOrder(retailer.id);
      return whatsappService.sendButtons(
        phone,
        '🔁 Last order copied to your current cart.\n\n' + whatsappService.formatCartSummary(cart),
        [
          { id: 'checkout_start', title: 'Checkout' },
          { id: 'menu_catalog', title: 'Keep shopping' }
        ]
      );
    } catch (error) {
      return whatsappService.sendMessage(phone, `Could not repeat order: ${error.message}`, { immediate: true });
    }
  }

  async showAddress(retailer, phone) {
    const address = await commerceService.getDefaultAddress(retailer.id);
    if (!address) {
      return whatsappService.sendButtons(phone, '📍 No saved delivery address.', [{ id: 'address_change', title: 'Add address' }]);
    }
    return whatsappService.sendButtons(
      phone,
      `📍 *${address.label}*\n${address.addressLine1}${address.city ? ', ' + address.city : ''}${address.postalCode ? ' • ' + address.postalCode : ''}`,
      [{ id: 'address_change', title: 'Change address' }]
    );
  }

  async startSupport(retailer, phone) {
    await conversationService.setState(retailer.id, 'SUPPORT_DESCRIPTION', {});
    return whatsappService.sendMessage(phone, '💬 Tell us what went wrong or what you need help with.', { immediate: true });
  }
}

module.exports = new CommerceWhatsAppController();
