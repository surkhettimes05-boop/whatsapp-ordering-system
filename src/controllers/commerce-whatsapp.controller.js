const prisma = require('../config/database');
const commerceService = require('../services/commerce.service');
const shoppingService = require('../services/shopping.service');
const paymentService = require('../services/payment.service');
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
    await webhookService.persistEvents([event]);
    await webhookService.processPending(this);
  }

  async processEvent(event) {
    const phone = cleanPhone(event.phone);
    const text = String(event.text || '').trim();
    const lowerText = text.toLowerCase();
    const actionId = event.actionId || null;

    if (!/^9779[78]\d{8}$/.test(phone)) return;
    if (event.nativeOrder && event.nativeOrder.catalogId !== process.env.META_CATALOG_ID) throw new Error('Invalid catalog');

    await prisma.whatsAppMessage.create({
      data: {
        from: phone,
        to: 'SYSTEM',
        body: text.substring(0, 1000),
        mediaUrl: event.mediaUrl || null,
        direction: 'INCOMING'
      }
    }).catch(error => logger.warn('Failed to log inbound WhatsApp message', { error: error.message }));

    const wholesaler = process.env.ENABLE_LEGACY_ROUTES === 'true' ? await prisma.wholesaler.findFirst({
      where: { OR: [{ whatsappNumber: phone }, { phoneNumber: phone }] }
    }) : null;
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
    }

    if (retailer.status !== 'ACTIVE' || retailer.deletedAt || retailer.creditStatus === 'BLOCKED') {
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
    if (lowerText === 'remove coupon' || lowerText === 'clear coupon') return this.applyCoupon(retailer, phone, null);
    if (lowerText.startsWith('coupon ') || lowerText.startsWith('apply ')) {
      const code = text.replace(/^(coupon|apply)\s+/i, '').trim();
      return this.applyCoupon(retailer, phone, code);
    }
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
      const result = await shoppingService.resolveServiceArea(text);
      if (!result.serviceable) {
        await whatsappService.sendMessage(phone, 'Sorry, we do not deliver to that area yet. Send another postal/service code, city or area name.', { immediate: true });
        return true;
      }
      await conversationService.setState(retailer.id, 'CHECKOUT_ADDRESS', {
        serviceAreaCode: result.area?.code || text,
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

      const address = await shoppingService.createAddress(retailer.id, {
        label: 'Home',
        recipientName: retailer.ownerName || retailer.pasalName,
        phone: retailer.phoneNumber,
        addressLine1: addressText,
        city: state.data?.area?.city || retailer.city,
        district: state.data?.area?.district || retailer.district,
        postalCode: state.data?.area?.postalCode || state.data?.serviceAreaCode || null,
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
    if (actionId === 'menu_catalog') {
      await this.sendCatalog(phone);
      return true;
    }
    if (actionId === 'menu_categories') {
      await this.sendCategories(phone);
      return true;
    }
    if (actionId === 'menu_offers') {
      await this.sendOffers(phone);
      return true;
    }
    if (actionId === 'menu_cart') {
      await this.sendCart(retailer, phone);
      return true;
    }
    if (actionId === 'menu_orders') {
      await this.sendOrders(retailer, phone);
      return true;
    }
    if (actionId === 'menu_repeat') {
      await this.repeatLastOrder(retailer, phone);
      return true;
    }
    if (actionId === 'menu_address') {
      await this.showAddress(retailer, phone);
      return true;
    }
    if (actionId === 'menu_support') {
      await this.startSupport(retailer, phone);
      return true;
    }
    if (actionId === 'checkout_start') {
      await this.beginCheckout(retailer, phone);
      return true;
    }
    if (actionId === 'address_use') {
      const addresses = await shoppingService.listAddresses(retailer.id);
      const address = addresses.find(item => item.isDefault) || addresses[0];
      if (!address) {
        await this.askForAddress(retailer, phone);
        return true;
      }
      await this.showCheckoutReview(retailer, phone, address);
      return true;
    }
    if (actionId === 'address_change') {
      await this.showAddress(retailer, phone);
      return true;
    }
    if (actionId === 'address_new') {
      await this.askForAddress(retailer, phone);
      return true;
    }
    if (actionId.startsWith('address_select:')) {
      const id = actionId.slice('address_select:'.length);
      const address = await shoppingService.setDefaultAddress(retailer.id, id);
      await whatsappService.sendButtons(
        phone,
        `✅ Default address set to *${address.label}*\n${address.addressLine1}`,
        [
          { id: 'checkout_start', title: 'Checkout' },
          { id: 'address_new', title: 'Add address' }
        ]
      );
      return true;
    }
    if (actionId === 'checkout_review') {
      await this.choosePayment(retailer, phone);
      return true;
    }
    if (actionId === 'checkout_cod') {
      await this.placeOrder(retailer, phone, null);
      return true;
    }
    if (actionId === 'checkout_khalti') {
      await this.placeOrder(retailer, phone, 'khalti');
      return true;
    }
    if (actionId === 'checkout_esewa') {
      await this.placeOrder(retailer, phone, 'esewa');
      return true;
    }
    if (actionId === 'checkout_online') {
      await this.choosePayment(retailer, phone);
      return true;
    }
    if (actionId === 'checkout_cancel') {
      await conversationService.clearState(retailer.id);
      await whatsappService.sendMessage(phone, 'Checkout cancelled. Your cart is still saved.', { immediate: true });
      return true;
    }
    if (actionId.startsWith('category:')) {
      const categoryId = actionId.slice('category:'.length);
      await this.sendCategory(phone, categoryId);
      return true;
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
    const topLevel = categories.filter(category => !category.parentId);
    if (!topLevel.length) return whatsappService.sendMessage(phone, 'No categories are available yet.', { immediate: true });

    if (whatsappService.usingMeta()) {
      try {
        return await whatsappService.sendList(
          phone,
          'Choose a category.',
          'Categories',
          [{
            title: 'Shop by category',
            rows: topLevel.slice(0, 10).map(category => ({
              id: `category:${category.id}`,
              title: category.name,
              description: category.children?.length
                ? `${category.children.length} subcategories`
                : (category.description || 'Browse products')
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
      '📂 *Categories*\n\n' + topLevel.map((c, i) => `${i + 1}. ${c.name}`).join('\n'),
      { immediate: true }
    );
  }

  async sendCategory(phone, categoryId) {
    const categories = await commerceService.listCategories();
    const category = categories.find(item => item.id === categoryId);
    if (!category) {
      return whatsappService.sendMessage(phone, 'Category not found.', { immediate: true });
    }

    if (category.children?.length) {
      if (whatsappService.usingMeta()) {
        return whatsappService.sendList(
          phone,
          `Choose a ${category.name} subcategory.`,
          'Subcategories',
          [{
            title: category.name,
            rows: category.children.slice(0, 10).map(child => ({
              id: `category:${child.id}`,
              title: child.name,
              description: child.description || 'Browse products'
            }))
          }],
          { header: category.name }
        );
      }
      return whatsappService.sendMessage(
        phone,
        `📂 *${category.name}*\n\n` + category.children.map((child, i) => `${i + 1}. ${child.name}`).join('\n'),
        { immediate: true }
      );
    }

    const result = await commerceService.listCatalog({ categoryId, limit: 30, page: 1 });
    return this.sendProducts(phone, result.products, category.name);
  }

  async sendOffers(phone) {
    const [campaigns, products] = await Promise.all([
      shoppingService.listOffers(true),
      commerceService.listOffers(30)
    ]);

    if (campaigns.length) {
      const message = campaigns.slice(0, 10).map(offer => {
        const code = offer.code ? ` • Code: *${offer.code}*` : ' • Auto-applied';
        const value = offer.type === 'PERCENT'
          ? `${offer.value}% off`
          : offer.type === 'FIXED'
            ? `Rs. ${offer.value} off`
            : 'Free delivery';
        return `🔥 *${offer.title}* — ${value}${code}`;
      }).join('\n');
      await whatsappService.sendMessage(phone, message + '\n\nUse *coupon CODE* to apply a coupon.', { immediate: true });
    }

    if (products.length) return this.sendProducts(phone, products, 'Discounted products');
    if (!campaigns.length) {
      return whatsappService.sendMessage(phone, '🔥 No offers are active right now.', { immediate: true });
    }
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
    await prisma.retailer.updateMany({ where: { whatsappNumber: phone }, data: { catalogProductIds: JSON.stringify(products.map(p => p.id)) } });
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
    const current = await prisma.retailer.findUnique({ where: { id: retailer.id } });
    const ids = JSON.parse(current.catalogProductIds || '[]');
    if (index < 1 || index > ids.length) return whatsappService.sendMessage(phone, 'Invalid product number. Type *catalog* to refresh.', { immediate: true });
    const product = await prisma.product.findUnique({ where: { id: ids[index - 1] } });
    if (!product) throw new Error('Product unavailable');
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

    const addresses = await shoppingService.listAddresses(retailer.id);
    const address = addresses.find(item => item.isDefault) || addresses[0];
    if (address) {
      return whatsappService.sendButtons(
        phone,
        `📍 Deliver to:\n*${address.label}*\n${address.addressLine1}${address.city ? ', ' + address.city : ''}${address.postalCode ? ' • ' + address.postalCode : ''}`,
        [
          { id: 'address_use', title: 'Use address' },
          { id: 'address_change', title: 'Choose another' }
        ]
      );
    }

    if (retailer.address) {
      const saved = await shoppingService.createAddress(retailer.id, {
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
    const areas = await shoppingService.listServiceAreas();
    if (areas.some(area => area.isActive)) {
      await conversationService.setState(retailer.id, 'CHECKOUT_SERVICE_AREA', {});
      return whatsappService.sendMessage(
        phone,
        '📍 Send your delivery postal/service code, city, district, or area name to check availability.',
        { immediate: true }
      );
    }
    await conversationService.setState(retailer.id, 'CHECKOUT_ADDRESS', {});
    return whatsappService.sendMessage(phone, '📍 Send your full delivery address or WhatsApp location.', { immediate: true });
  }

  async showCheckoutReview(retailer, phone, address) {
    try {
      const quote = await shoppingService.quote(retailer.id, { addressId: address.id });
      let summary = whatsappService.formatCartSummary(await commerceService.getCart(retailer.id));
      if (quote.discountAmount > 0) summary += `\nOffer discount: -Rs. ${quote.discountAmount}`;
      if (quote.deliveryFee > 0) summary += `\nDelivery: Rs. ${quote.deliveryFee}`;
      if (quote.totalSavings > 0) summary += `\n🎉 Total savings: Rs. ${quote.totalSavings}`;
      summary += `\n*Payable: Rs. ${quote.totalAmount}*`;

      return whatsappService.sendButtons(
        phone,
        summary + `\n\n📍 Delivery: ${address.addressLine1}\nReview your order before payment.`,
        [
          { id: 'checkout_review', title: 'Continue' },
          { id: 'menu_cart', title: 'Edit cart' },
          { id: 'checkout_cancel', title: 'Cancel' }
        ]
      );
    } catch (error) {
      await whatsappService.sendMessage(phone, `⚠️ ${error.message}`, { immediate: true });
      return this.showAddress(retailer, phone);
    }
  }

  async choosePayment(retailer, phone) {
    const addresses = await shoppingService.listAddresses(retailer.id);
    const address = addresses.find(item => item.isDefault) || addresses[0];
    const quote = await shoppingService.quote(retailer.id, { addressId: address?.id });
    const providers = [];
    const buttons = [{ id: 'checkout_cod', title: 'Cash on delivery' }];
    if (providers.includes('khalti')) buttons.push({ id: 'checkout_khalti', title: 'Khalti' });
    if (providers.includes('esewa')) buttons.push({ id: 'checkout_esewa', title: 'eSewa' });

    return whatsappService.sendButtons(
      phone,
      `💳 *Choose payment*\nPayable: Rs. ${quote.totalAmount}${quote.totalSavings ? `\nYou save: Rs. ${quote.totalSavings}` : ''}`,
      buttons,
      { footer: 'Pay cash when your order arrives.' }
    );
  }

  async placeOrder(retailer, phone, provider = null) {
    const addresses = await shoppingService.listAddresses(retailer.id);
    const address = addresses.find(item => item.isDefault) || addresses[0];
    if (!address) return this.askForAddress(retailer, phone);

    try {
      const result = await shoppingService.checkout(retailer.id, {
        addressId: address.id,
        cartId: (await commerceService.getCart(retailer.id)).id,
        paymentProvider: provider,
        sourceChannel: 'WHATSAPP'
      });
      const order = result.order;

      if (result.payment?.checkoutUrl) {
        await whatsappService.sendCtaUrl(
          phone,
          `Order *${order.orderNumber}* created.\nAmount: Rs. ${order.totalAmount}\nPayment: ${provider.toUpperCase()}`,
          `Pay with ${provider === 'khalti' ? 'Khalti' : 'eSewa'}`,
          result.payment.checkoutUrl,
          { header: 'Secure payment' }
        );
        return;
      }

      if (provider && result.paymentError) {
        await whatsappService.sendMessage(
          phone,
          `✅ Order *${order.orderNumber}* was created, but ${provider.toUpperCase()} could not start: ${result.paymentError}\nYou can retry payment from support/admin without creating another order.`,
          { immediate: true }
        );
        return;
      }

      await whatsappService.sendButtons(
        phone,
        `✅ *Order placed*\n\nOrder: *${order.orderNumber}*\nTotal: Rs. ${order.totalAmount}\nPayment: COD\nStatus: ${order.status}${Number(order.savingsAmount || 0) > 0 ? `\nYou saved: Rs. ${order.savingsAmount}` : ''}\n\nWe will send status updates here until delivery.`,
        [
          { id: 'menu_orders', title: 'Track orders' },
          { id: 'menu_catalog', title: 'Shop again' }
        ]
      );
    } catch (error) {
      logger.warn('Checkout failed', { retailerId: retailer.id, provider, error: error.message });
      await whatsappService.sendMessage(phone, `⚠️ Checkout failed: ${error.message}`, { immediate: true });
    }
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
    const addresses = await shoppingService.listAddresses(retailer.id);
    if (!addresses.length) {
      return whatsappService.sendButtons(phone, '📍 No saved delivery address.', [{ id: 'address_new', title: 'Add address' }]);
    }

    if (whatsappService.usingMeta()) {
      return whatsappService.sendList(
        phone,
        'Choose a saved address or add a new one.',
        'Addresses',
        [{
          title: 'Saved addresses',
          rows: [
            ...addresses.slice(0, 9).map(address => ({
              id: `address_select:${address.id}`,
              title: `${address.isDefault ? '✓ ' : ''}${address.label}`.slice(0, 24),
              description: [address.addressLine1, address.city, address.postalCode].filter(Boolean).join(', ').slice(0, 72)
            })),
            { id: 'address_new', title: 'Add new address', description: 'Save another delivery location' }
          ]
        }],
        { header: 'Delivery addresses' }
      );
    }

    const text = addresses.map((address, i) =>
      `${i + 1}. ${address.isDefault ? '✓ ' : ''}*${address.label}* — ${address.addressLine1}`
    ).join('\n');
    return whatsappService.sendButtons(phone, '📍 *Saved addresses*\n\n' + text, [{ id: 'address_new', title: 'Add address' }]);
  }

  async applyCoupon(retailer, phone, code) {
    try {
      const quote = await shoppingService.setCartCoupon(retailer.id, code);
      const line = code
        ? `✅ Coupon *${String(code).toUpperCase()}* applied.`
        : '✅ Coupon removed.';
      return whatsappService.sendButtons(
        phone,
        `${line}\nDiscount: Rs. ${quote.discountAmount}\nPayable before delivery: Rs. ${quote.totalAmount}`,
        [
          { id: 'menu_cart', title: 'View cart' },
          { id: 'checkout_start', title: 'Checkout' }
        ]
      );
    } catch (error) {
      return whatsappService.sendMessage(phone, `❌ ${error.message}`, { immediate: true });
    }
  }

  async startSupport(retailer, phone) {
    await conversationService.setState(retailer.id, 'SUPPORT_DESCRIPTION', {});
    return whatsappService.sendMessage(phone, '💬 Tell us what went wrong or what you need help with.', { immediate: true });
  }
}

module.exports = new CommerceWhatsAppController();
