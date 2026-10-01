const crypto = require('crypto');
const prisma = require('../config/database');

const SALE_STATUSES = ['DELIVERED'];
const PAYMENT_MODES = new Set(['COD', 'ONLINE', 'CHEQUE', 'BANK_TRANSFER', 'CASH']);
const ORDER_CHANNELS = new Set(['WHATSAPP', 'ADMIN', 'API']);

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function toNumber(value) {
  return value == null ? null : Number(value);
}

function absoluteImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const base = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  return base ? base + (imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl) : imageUrl;
}

function serializeProduct(product) {
  const inventories = product.wholesalerProducts || [];
  const availableUnits = inventories.reduce(
    (sum, row) => sum + Math.max(0, Number(row.stock || 0) - Number(row.reservedStock || 0)),
    0
  );
  const stockStatus = inventories.length === 0
    ? 'UNKNOWN'
    : availableUnits <= 0
      ? 'OUT'
      : availableUnits <= 10 ? 'LOW' : 'AVAILABLE';

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    slug: product.slug,
    categoryId: product.categoryId,
    category: product.category || null,
    unit: product.unit,
    packSize: product.packSize,
    price: toNumber(product.fixedPrice),
    mrp: toNumber(product.mrp),
    description: product.description,
    imageUrl: absoluteImageUrl(product.imageUrl),
    stockStatus,
    availableUnits,
    isActive: product.isActive
  };
}

function cartSummary(cart) {
  const items = (cart.items || []).map(item => ({
    id: item.id,
    productId: item.productId,
    name: item.product.name,
    sku: item.product.sku,
    imageUrl: absoluteImageUrl(item.product.imageUrl),
    quantity: item.quantity,
    unitPrice: toNumber(item.product.fixedPrice),
    lineTotal: Number(item.product.fixedPrice) * item.quantity
  }));

  return {
    id: cart.id,
    retailerId: cart.retailerId,
    status: cart.status,
    currency: cart.currency,
    items,
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: items.reduce((sum, item) => sum + item.lineTotal, 0)
  };
}

function orderNumber() {
  const date = new Date();
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `WA-${stamp}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function rangeStart(range, explicitDate) {
  if (explicitDate) {
    const start = new Date(explicitDate + 'T00:00:00.000Z');
    if (Number.isNaN(start.getTime())) throw new Error('Invalid date');
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  if (range === 'all') return { start: null, end: null };
  const now = new Date();
  if (range === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start, end: null };
  }
  const days = range === '7d' ? 7 : 30;
  return { start: new Date(now.getTime() - days * 86400000), end: null };
}

class CommerceService {
  async listCatalog(filters = {}) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(50, Math.max(1, Number(filters.limit || 20)));
    const where = { isActive: true, deletedAt: null };

    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { brand: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          wholesalerProducts: {
            where: { isAvailable: true },
            select: { stock: true, reservedStock: true }
          }
        },
        orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.product.count({ where })
    ]);

    return {
      products: products.map(serializeProduct),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
    };
  }

  async listCategories() {
    return prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
  }

  async createCategory(data) {
    if (!data.name) throw new Error('Category name is required');
    let slug = slugify(data.slug || data.name);
    if (!slug) throw new Error('Category slug is invalid');
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString().slice(-6)}`;
    return prisma.category.create({
      data: { name: data.name.trim(), slug, description: data.description || null }
    });
  }

  async createProduct(data) {
    if (!data.name || !data.categoryId || data.fixedPrice == null) {
      throw new Error('name, categoryId and fixedPrice are required');
    }
    if (!data.sku) throw new Error('SKU is required for new catalog products');

    const sku = String(data.sku).trim().toUpperCase();
    let slug = slugify(data.slug || `${data.name}-${sku}`);
    if (!slug) slug = `product-${Date.now()}`;
    const existingSlug = await prisma.product.findUnique({ where: { slug } });
    if (existingSlug) slug = `${slug}-${Date.now().toString().slice(-6)}`;

    const product = await prisma.product.create({
      data: {
        name: String(data.name).trim(),
        slug,
        sku,
        brand: data.brand ? String(data.brand).trim() : null,
        categoryId: data.categoryId,
        unit: data.unit || 'piece',
        packSize: data.packSize || null,
        fixedPrice: Number(data.fixedPrice),
        mrp: data.mrp == null || data.mrp === '' ? null : Number(data.mrp),
        description: data.description || null,
        imageUrl: data.imageUrl || null,
        isActive: data.isActive !== false
      },
      include: { category: true, wholesalerProducts: true }
    });
    return serializeProduct(product);
  }

  async updateProduct(id, data) {
    const update = {};
    for (const key of ['name', 'brand', 'unit', 'packSize', 'description', 'imageUrl', 'categoryId']) {
      if (data[key] !== undefined) update[key] = data[key] || null;
    }
    if (data.sku !== undefined) update.sku = data.sku ? String(data.sku).trim().toUpperCase() : null;
    if (data.fixedPrice !== undefined) update.fixedPrice = Number(data.fixedPrice);
    if (data.mrp !== undefined) update.mrp = data.mrp === '' || data.mrp == null ? null : Number(data.mrp);
    if (data.isActive !== undefined) update.isActive = Boolean(data.isActive);
    if (data.slug !== undefined) update.slug = slugify(data.slug);

    const product = await prisma.product.update({
      where: { id },
      data: update,
      include: { category: true, wholesalerProducts: true }
    });
    return serializeProduct(product);
  }

  async getOrCreateCart(retailerId, client = prisma) {
    let cart = await client.cart.findUnique({
      where: { activeKey: retailerId },
      include: { items: { include: { product: true }, orderBy: { createdAt: 'asc' } } }
    });
    if (!cart) {
      await client.retailer.findUniqueOrThrow({ where: { id: retailerId } });
      cart = await client.cart.create({
        data: { retailerId, activeKey: retailerId },
        include: { items: { include: { product: true } } }
      });
    }
    return cart;
  }

  async getCart(retailerId) {
    return cartSummary(await this.getOrCreateCart(retailerId));
  }

  async addCartItem(retailerId, productId, quantity = 1) {
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) throw new Error('Quantity must be a positive integer');

    return prisma.$transaction(async tx => {
      const product = await tx.product.findFirst({
        where: { id: productId, isActive: true, deletedAt: null }
      });
      if (!product) throw new Error('Product is not available');

      const cart = await this.getOrCreateCart(retailerId, tx);
      await tx.cartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId } },
        update: { quantity: { increment: qty }, unitPrice: product.fixedPrice },
        create: { cartId: cart.id, productId, quantity: qty, unitPrice: product.fixedPrice }
      });

      const refreshed = await tx.cart.findUnique({
        where: { id: cart.id },
        include: { items: { include: { product: true }, orderBy: { createdAt: 'asc' } } }
      });
      return cartSummary(refreshed);
    });
  }

  async setCartItem(retailerId, productId, quantity) {
    const qty = Number(quantity);
    if (!Number.isInteger(qty)) throw new Error('Quantity must be an integer');
    return prisma.$transaction(async tx => {
      const cart = await this.getOrCreateCart(retailerId, tx);
      if (qty <= 0) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
      } else {
        const product = await tx.product.findFirst({ where: { id: productId, isActive: true, deletedAt: null } });
        if (!product) throw new Error('Product is not available');
        await tx.cartItem.upsert({
          where: { cartId_productId: { cartId: cart.id, productId } },
          update: { quantity: qty, unitPrice: product.fixedPrice },
          create: { cartId: cart.id, productId, quantity: qty, unitPrice: product.fixedPrice }
        });
      }
      const refreshed = await tx.cart.findUnique({
        where: { id: cart.id },
        include: { items: { include: { product: true }, orderBy: { createdAt: 'asc' } } }
      });
      return cartSummary(refreshed);
    });
  }

  async clearCart(retailerId) {
    const cart = await this.getOrCreateCart(retailerId);
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(retailerId);
  }

  async checkoutCart(data) {
    const paymentMode = PAYMENT_MODES.has(data.paymentMode) ? data.paymentMode : 'COD';
    const sourceChannel = ORDER_CHANNELS.has(data.sourceChannel) ? data.sourceChannel : 'WHATSAPP';

    return prisma.$transaction(async tx => {
      const cart = await tx.cart.findUnique({
        where: { activeKey: data.retailerId },
        include: {
          retailer: true,
          items: { include: { product: true }, orderBy: { createdAt: 'asc' } }
        }
      });
      if (!cart || cart.items.length === 0) throw new Error('Cart is empty');

      const invalid = cart.items.find(item => !item.product.isActive || item.product.deletedAt);
      if (invalid) throw new Error(`Product is no longer available: ${invalid.product.name}`);

      const claimed = await tx.cart.updateMany({
        where: { id: cart.id, status: 'ACTIVE', activeKey: data.retailerId },
        data: { status: 'CHECKED_OUT', activeKey: null, checkedOutAt: new Date() }
      });
      if (claimed.count !== 1) throw new Error('Cart was already checked out');

      const totalAmount = cart.items.reduce(
        (sum, item) => sum + Number(item.product.fixedPrice) * item.quantity,
        0
      );

      const order = await tx.order.create({
        data: {
          orderNumber: orderNumber(),
          retailerId: data.retailerId,
          totalAmount,
          paymentMode,
          sourceChannel,
          status: 'CREATED',
          deliveryName: data.deliveryName || cart.retailer.ownerName || cart.retailer.pasalName,
          deliveryPhone: data.deliveryPhone || cart.retailer.phoneNumber,
          deliveryAddress: data.deliveryAddress || cart.retailer.address,
          customerNotes: data.customerNotes || null,
          items: {
            create: cart.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              priceAtOrder: item.product.fixedPrice
            }))
          }
        },
        include: {
          retailer: true,
          items: { include: { product: true } }
        }
      });

      await tx.cart.update({ where: { id: cart.id }, data: { checkoutOrderId: order.id } });
      return {
        ...order,
        totalAmount: Number(order.totalAmount),
        items: order.items.map(item => ({
          ...item,
          priceAtOrder: Number(item.priceAtOrder)
        }))
      };
    });
  }

  async getSalesDashboard(filters = {}) {
    const { start, end } = rangeStart(filters.range || 'today');
    const createdAt = {};
    if (start) createdAt.gte = start;
    if (end) createdAt.lt = end;

    const salesWhere = {
      status: { in: SALE_STATUSES },
      ...(start || end ? { deliveredAt: createdAt } : {})
    };
    const ordersWhere = start || end ? { createdAt } : {};

    const [salesOrders, recentOrders, statusRows] = await Promise.all([
      prisma.order.findMany({
        where: salesWhere,
        include: { items: { include: { product: true } }, retailer: true },
        orderBy: { deliveredAt: 'desc' }
      }),
      prisma.order.findMany({
        where: ordersWhere,
        include: { retailer: true },
        orderBy: { createdAt: 'desc' },
        take: 12
      }),
      prisma.order.groupBy({
        by: ['status'],
        where: ordersWhere,
        _count: { _all: true }
      })
    ]);

    const sales = salesOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
    const units = salesOrders.reduce(
      (sum, order) => sum + order.items.reduce((s, item) => s + item.quantity, 0), 0
    );
    const productMap = new Map();
    for (const order of salesOrders) {
      for (const item of order.items) {
        const current = productMap.get(item.productId) || {
          productId: item.productId,
          sku: item.product.sku,
          name: item.product.name,
          imageUrl: absoluteImageUrl(item.product.imageUrl),
          quantity: 0,
          sales: 0
        };
        current.quantity += item.quantity;
        current.sales += Number(item.priceAtOrder) * item.quantity;
        productMap.set(item.productId, current);
      }
    }

    const topProducts = [...productMap.values()]
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    return {
      range: filters.range || 'today',
      sales,
      deliveredOrders: salesOrders.length,
      unitsSold: units,
      averageOrderValue: salesOrders.length ? sales / salesOrders.length : 0,
      orderStatus: Object.fromEntries(statusRows.map(row => [row.status, row._count._all])),
      topProducts,
      recentOrders: recentOrders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customer: order.retailer.pasalName || order.retailer.ownerName || order.retailer.phoneNumber,
        totalAmount: Number(order.totalAmount),
        status: order.status,
        sourceChannel: order.sourceChannel,
        createdAt: order.createdAt
      }))
    };
  }

  async updateCommerceOrderStatus(orderId, nextStatus) {
    const transitions = {
      CREATED: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['PACKED', 'CANCELLED'],
      PACKED: ['OUT_FOR_DELIVERY', 'CANCELLED'],
      OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED', 'CANCELLED'],
      FAILED: ['PROCESSING', 'CANCELLED'],
      DELIVERED: [],
      CANCELLED: []
    };

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { retailer: true, items: { include: { product: true } } }
    });
    if (!order) throw new Error('Order not found');

    const allowed = transitions[order.status] || [];
    if (!allowed.includes(nextStatus)) {
      throw new Error(`Invalid commerce transition: ${order.status} → ${nextStatus}`);
    }

    const data = { status: nextStatus };
    if (nextStatus === 'CONFIRMED') data.confirmedAt = new Date();
    if (nextStatus === 'DELIVERED') data.deliveredAt = new Date();
    if (nextStatus === 'FAILED') data.failedAt = new Date();

    return prisma.order.update({
      where: { id: orderId },
      data,
      include: { retailer: true, items: { include: { product: true } } }
    });
  }

  async getDailyReconciliation(date) {
    const { start, end } = rangeStart(null, date);
    const orders = await prisma.order.findMany({
      where: {
        status: { in: SALE_STATUSES },
        deliveredAt: { gte: start, lt: end }
      },
      include: { items: { include: { product: true } } }
    });

    const rows = new Map();
    for (const order of orders) {
      for (const item of order.items) {
        const row = rows.get(item.productId) || {
          productId: item.productId,
          sku: item.product.sku,
          name: item.product.name,
          quantity: 0,
          salesAmount: 0
        };
        row.quantity += item.quantity;
        row.salesAmount += Number(item.priceAtOrder) * item.quantity;
        rows.set(item.productId, row);
      }
    }

    const items = [...rows.values()].sort((a, b) => b.salesAmount - a.salesAmount);
    return {
      date,
      deliveredOrders: orders.length,
      netSales: orders.reduce((sum, order) => sum + Number(order.totalAmount), 0),
      totalUnits: items.reduce((sum, item) => sum + item.quantity, 0),
      items
    };
  }
}

module.exports = new CommerceService();
