const crypto = require('crypto');
const prisma = require('../config/database');
const paymentService = require('./payment.service');

function n(value) { return Number(value || 0); }
function slug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function orderNumber() {
  return `WA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}
function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

class ShoppingService {
  async listAddresses(retailerId) {
    return prisma.commerceAddress.findMany({
      where: { retailerId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
    });
  }

  async createAddress(retailerId, data) {
    if (!data.addressLine1) throw new Error('Address is required');
    return prisma.$transaction(async tx => {
      if (data.isDefault !== false) {
        await tx.commerceAddress.updateMany({
          where: { retailerId, isDefault: true },
          data: { isDefault: false }
        });
      }
      return tx.commerceAddress.create({
        data: {
          retailerId,
          label: data.label || 'Home',
          recipientName: data.recipientName || null,
          phone: data.phone || null,
          addressLine1: data.addressLine1,
          city: data.city || null,
          district: data.district || null,
          postalCode: data.postalCode || null,
          latitude: data.latitude == null ? null : Number(data.latitude),
          longitude: data.longitude == null ? null : Number(data.longitude),
          isDefault: data.isDefault !== false,
          isActive: true
        }
      });
    });
  }

  async updateAddress(retailerId, id, data) {
    const current = await prisma.commerceAddress.findFirst({ where: { id, retailerId, isActive: true } });
    if (!current) throw new Error('Address not found');
    return prisma.$transaction(async tx => {
      if (data.isDefault === true) {
        await tx.commerceAddress.updateMany({
          where: { retailerId, isDefault: true, id: { not: id } },
          data: { isDefault: false }
        });
      }
      const allowed = {};
      for (const key of ['label','recipientName','phone','addressLine1','city','district','postalCode']) {
        if (data[key] !== undefined) allowed[key] = data[key] || null;
      }
      if (data.latitude !== undefined) allowed.latitude = data.latitude == null ? null : Number(data.latitude);
      if (data.longitude !== undefined) allowed.longitude = data.longitude == null ? null : Number(data.longitude);
      if (data.isDefault !== undefined) allowed.isDefault = Boolean(data.isDefault);
      return tx.commerceAddress.update({ where: { id }, data: allowed });
    });
  }

  async setDefaultAddress(retailerId, id) {
    return prisma.$transaction(async tx => {
      const address = await tx.commerceAddress.findFirst({ where: { id, retailerId, isActive: true } });
      if (!address) throw new Error('Address not found');
      await tx.commerceAddress.updateMany({ where: { retailerId, isDefault: true }, data: { isDefault: false } });
      return tx.commerceAddress.update({ where: { id }, data: { isDefault: true } });
    });
  }

  async deleteAddress(retailerId, id) {
    const current = await prisma.commerceAddress.findFirst({ where: { id, retailerId, isActive: true } });
    if (!current) throw new Error('Address not found');
    await prisma.commerceAddress.update({ where: { id }, data: { isActive: false, isDefault: false } });
    if (current.isDefault) {
      const replacement = await prisma.commerceAddress.findFirst({
        where: { retailerId, isActive: true, id: { not: id } },
        orderBy: { updatedAt: 'desc' }
      });
      if (replacement) await this.setDefaultAddress(retailerId, replacement.id);
    }
    return { success: true };
  }

  async resolveServiceArea(query, address = null) {
    const areas = await prisma.serviceArea.findMany({ where: { isActive: true } });
    if (!areas.length) return { configured: false, serviceable: true, area: null };

    const inputs = [
      query,
      address?.postalCode,
      address?.city,
      address?.district,
      address?.addressLine1
    ].filter(Boolean).map(normalizeText);

    let best = null;
    let bestScore = 0;
    for (const area of areas) {
      const exacts = [area.code, area.postalCode, area.city, area.district, area.name]
        .filter(Boolean)
        .map(normalizeText);
      const keywords = String(area.keywords || '')
        .split(',')
        .map(normalizeText)
        .filter(Boolean);
      let score = 0;
      for (const input of inputs) {
        if (exacts.includes(input)) score = Math.max(score, 100);
        for (const exact of exacts) {
          if (input.includes(exact) || exact.includes(input)) score = Math.max(score, 70);
        }
        for (const keyword of keywords) {
          if (input.includes(keyword)) score = Math.max(score, 50);
        }
      }
      if (score > bestScore) { best = area; bestScore = score; }
    }

    return { configured: true, serviceable: Boolean(best), area: best, matchScore: bestScore };
  }

  async createServiceArea(data) {
    if (!data.code) throw new Error('Service area code is required');
    const payload = {
      name: data.name || null,
      city: data.city || null,
      district: data.district || null,
      postalCode: data.postalCode || null,
      keywords: data.keywords || null,
      isActive: data.isActive !== false,
      minOrder: n(data.minOrder),
      deliveryFee: n(data.deliveryFee),
      etaText: data.etaText || null
    };
    return prisma.serviceArea.upsert({
      where: { code: String(data.code).trim() },
      create: { code: String(data.code).trim(), ...payload },
      update: payload
    });
  }

  async listServiceAreas() {
    return prisma.serviceArea.findMany({ orderBy: [{ isActive: 'desc' }, { code: 'asc' }] });
  }

  async createOffer(data) {
    if (!data.title || data.value == null || !data.endsAt) throw new Error('title, value and endsAt are required');
    const type = String(data.type || 'PERCENT').toUpperCase();
    if (!['PERCENT','FIXED','FREE_DELIVERY'].includes(type)) throw new Error('Offer type must be PERCENT, FIXED or FREE_DELIVERY');
    return prisma.commerceOffer.create({
      data: {
        code: data.code ? String(data.code).trim().toUpperCase() : null,
        title: data.title,
        description: data.description || null,
        type,
        value: n(data.value),
        minOrderAmount: n(data.minOrderAmount),
        maxDiscount: data.maxDiscount == null ? null : n(data.maxDiscount),
        categoryId: data.categoryId || null,
        productId: data.productId || null,
        autoApply: Boolean(data.autoApply),
        usageLimit: data.usageLimit == null ? null : Number(data.usageLimit),
        perCustomerLimit: Math.max(1, Number(data.perCustomerLimit || 1)),
        startsAt: data.startsAt ? new Date(data.startsAt) : new Date(),
        endsAt: new Date(data.endsAt),
        isActive: data.isActive !== false
      }
    });
  }

  async updateOffer(id, data) {
    const update = {};
    for (const key of ['title','description','categoryId','productId']) {
      if (data[key] !== undefined) update[key] = data[key] || null;
    }
    if (data.code !== undefined) update.code = data.code ? String(data.code).trim().toUpperCase() : null;
    if (data.type !== undefined) update.type = String(data.type).toUpperCase();
    for (const key of ['value','minOrderAmount','maxDiscount']) {
      if (data[key] !== undefined) update[key] = data[key] == null ? null : n(data[key]);
    }
    if (data.autoApply !== undefined) update.autoApply = Boolean(data.autoApply);
    if (data.usageLimit !== undefined) update.usageLimit = data.usageLimit == null ? null : Number(data.usageLimit);
    if (data.perCustomerLimit !== undefined) update.perCustomerLimit = Math.max(1, Number(data.perCustomerLimit));
    if (data.startsAt !== undefined) update.startsAt = new Date(data.startsAt);
    if (data.endsAt !== undefined) update.endsAt = new Date(data.endsAt);
    if (data.isActive !== undefined) update.isActive = Boolean(data.isActive);
    return prisma.commerceOffer.update({ where: { id }, data: update });
  }

  async listOffers(activeOnly = true) {
    const now = new Date();
    return prisma.commerceOffer.findMany({
      where: activeOnly ? { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } } : {},
      include: { _count: { select: { redemptions: true } } },
      orderBy: [{ autoApply: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async setCartCoupon(retailerId, code) {
    const cart = await prisma.cart.findUnique({ where: { activeKey: retailerId } });
    if (!cart) throw new Error('Cart is empty');
    const normalized = code ? String(code).trim().toUpperCase() : null;
    if (normalized) {
      const offer = await prisma.commerceOffer.findUnique({ where: { code: normalized } });
      if (!offer || !offer.isActive) throw new Error('Coupon is invalid');
    }
    await prisma.cart.update({ where: { id: cart.id }, data: { couponCode: normalized } });
    return this.quote(retailerId);
  }

  async eligibleOffer(retailerId, cart, explicitCode = null, deliveryFee = 0) {
    const now = new Date();
    const where = { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } };
    if (explicitCode) where.code = String(explicitCode).trim().toUpperCase();
    else where.autoApply = true;

    const offers = await prisma.commerceOffer.findMany({
      where,
      include: { _count: { select: { redemptions: true } } }
    });

    const subtotal = cart.items.reduce((sum, item) => sum + n(item.product.fixedPrice) * item.quantity, 0);
    const candidates = [];

    for (const offer of offers) {
      if (subtotal < n(offer.minOrderAmount)) continue;
      if (offer.usageLimit != null && offer._count.redemptions >= offer.usageLimit) continue;
      const customerUses = await prisma.commerceOfferRedemption.count({
        where: { offerId: offer.id, retailerId }
      });
      if (customerUses >= offer.perCustomerLimit) continue;

      let eligibleSubtotal = subtotal;
      if (offer.productId) {
        eligibleSubtotal = cart.items
          .filter(item => item.productId === offer.productId)
          .reduce((sum, item) => sum + n(item.product.fixedPrice) * item.quantity, 0);
      } else if (offer.categoryId) {
        eligibleSubtotal = cart.items
          .filter(item => item.product.categoryId === offer.categoryId)
          .reduce((sum, item) => sum + n(item.product.fixedPrice) * item.quantity, 0);
      }
      if (eligibleSubtotal <= 0 && offer.type !== 'FREE_DELIVERY') continue;

      let discount = 0;
      if (offer.type === 'PERCENT') discount = eligibleSubtotal * n(offer.value) / 100;
      if (offer.type === 'FIXED') discount = Math.min(eligibleSubtotal, n(offer.value));
      if (offer.type === 'FREE_DELIVERY') discount = n(deliveryFee);
      if (offer.maxDiscount != null) discount = Math.min(discount, n(offer.maxDiscount));
      discount = Math.max(0, Number(discount.toFixed(2)));
      if (discount > 0) candidates.push({ offer, discount });
    }

    if (explicitCode && !candidates.length) throw new Error('Coupon is not eligible for this cart');
    return candidates.sort((a,b) => b.discount - a.discount)[0] || null;
  }

  async quote(retailerId, options = {}) {
    const cart = await prisma.cart.findUnique({
      where: { activeKey: retailerId },
      include: { items: { include: { product: true }, orderBy: { createdAt: 'asc' } } }
    });
    if (!cart || !cart.items.length) throw new Error('Cart is empty');

    let address = null;
    if (options.addressId) {
      address = await prisma.commerceAddress.findFirst({
        where: { id: options.addressId, retailerId, isActive: true }
      });
      if (!address) throw new Error('Address not found');
    } else {
      address = await prisma.commerceAddress.findFirst({
        where: { retailerId, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
      });
    }

    const service = (address || options.serviceAreaCode)
      ? await this.resolveServiceArea(options.serviceAreaCode, address)
      : { configured: false, serviceable: true, area: null };
    if (service.configured && !service.serviceable) throw new Error('Delivery is not available to this address');

    const subtotal = cart.items.reduce((sum, item) => sum + n(item.product.fixedPrice) * item.quantity, 0);
    const mrpTotal = cart.items.reduce((sum, item) => {
      const mrp = item.product.mrp == null ? n(item.product.fixedPrice) : n(item.product.mrp);
      return sum + mrp * item.quantity;
    }, 0);
    const productSavings = Math.max(0, mrpTotal - subtotal);
    const deliveryFee = service.area ? n(service.area.deliveryFee) : 0;
    const minOrder = service.area ? n(service.area.minOrder) : 0;
    if (subtotal < minOrder) throw new Error(`Minimum order for this area is Rs. ${minOrder}`);

    const couponCode = options.couponCode !== undefined ? options.couponCode : cart.couponCode;
    const applied = await this.eligibleOffer(retailerId, cart, couponCode || null, deliveryFee);
    const discountAmount = applied?.discount || 0;
    const finalDeliveryFee = applied?.offer.type === 'FREE_DELIVERY' ? Math.max(0, deliveryFee - discountAmount) : deliveryFee;
    const merchandiseDiscount = applied?.offer.type === 'FREE_DELIVERY' ? 0 : discountAmount;
    const totalAmount = Math.max(0, subtotal - merchandiseDiscount + finalDeliveryFee);
    const totalSavings = productSavings + discountAmount;

    return {
      cartId: cart.id,
      address,
      serviceArea: service.area,
      subtotal,
      mrpTotal,
      productSavings,
      discountAmount,
      deliveryFee: finalDeliveryFee,
      totalSavings,
      totalAmount: Number(totalAmount.toFixed(2)),
      couponCode: applied?.offer.code || null,
      offer: applied ? {
        id: applied.offer.id,
        code: applied.offer.code,
        title: applied.offer.title,
        type: applied.offer.type,
        discount: applied.discount
      } : null,
      items: cart.items.map(item => ({
        productId: item.productId,
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: n(item.product.fixedPrice),
        mrp: item.product.mrp == null ? null : n(item.product.mrp)
      }))
    };
  }

  async checkout(retailerId, data = {}) {
    const quote = await this.quote(retailerId, {
      addressId: data.addressId,
      serviceAreaCode: data.serviceAreaCode,
      couponCode: data.couponCode
    });
    if (!quote.address) throw new Error('A saved delivery address is required');

    const paymentProvider = data.paymentProvider ? String(data.paymentProvider).toLowerCase() : null;
    const paymentMode = paymentProvider ? 'ONLINE' : 'COD';
    if (paymentProvider && !paymentService.isConfigured(paymentProvider)) {
      throw new Error(`${paymentProvider.toUpperCase()} payment is not configured`);
    }

    const order = await prisma.$transaction(async tx => {
      const cart = await tx.cart.findUnique({
        where: { activeKey: retailerId },
        include: { retailer: true, items: { include: { product: true } } }
      });
      if (!cart || !cart.items.length) throw new Error('Cart is empty');

      const claimed = await tx.cart.updateMany({
        where: { id: cart.id, activeKey: retailerId, status: 'ACTIVE' },
        data: {
          activeKey: null,
          status: 'CHECKED_OUT',
          checkedOutAt: new Date(),
          selectedAddressId: quote.address.id,
          couponCode: quote.couponCode,
          paymentProvider
        }
      });
      if (claimed.count !== 1) throw new Error('Cart was already checked out');

      const created = await tx.order.create({
        data: {
          orderNumber: orderNumber(),
          retailerId,
          subtotal: quote.subtotal,
          discountAmount: quote.discountAmount,
          deliveryFee: quote.deliveryFee,
          savingsAmount: quote.totalSavings,
          totalAmount: quote.totalAmount,
          paymentMode,
          paymentStatus: 'PENDING',
          paymentProvider,
          couponCode: quote.couponCode,
          serviceAreaCode: quote.serviceArea?.code || null,
          sourceChannel: data.sourceChannel || 'WHATSAPP',
          status: 'CREATED',
          deliveryName: quote.address.recipientName || cart.retailer.ownerName || cart.retailer.pasalName,
          deliveryPhone: quote.address.phone || cart.retailer.phoneNumber,
          deliveryAddress: [
            quote.address.addressLine1,
            quote.address.city,
            quote.address.district,
            quote.address.postalCode
          ].filter(Boolean).join(', '),
          customerNotes: data.customerNotes || null,
          items: {
            create: cart.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              priceAtOrder: item.product.fixedPrice
            }))
          }
        },
        include: { retailer: true, items: { include: { product: true } } }
      });

      await tx.cart.update({ where: { id: cart.id }, data: { checkoutOrderId: created.id } });

      if (quote.offer) {
        await tx.commerceOfferRedemption.create({
          data: {
            offerId: quote.offer.id,
            retailerId,
            orderId: created.id,
            amount: quote.discountAmount
          }
        });
      }
      return created;
    });

    let payment = null;
    let paymentError = null;
    if (paymentProvider) {
      try {
        payment = await paymentService.initiate(order.id, paymentProvider);
      } catch (error) {
        paymentError = error.message;
      }
    }
    return { order, quote, payment, paymentError };
  }
}

module.exports = new ShoppingService();
