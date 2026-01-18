// Admin Dashboard Service
// Handles shared inbox, team management, and message routing

const prisma = require('../config/database');

class AdminDashboardService {
  // ============================================
  // TEAM MEMBER MANAGEMENT
  // ============================================

  async createTeamMember(data) {
    return await prisma.user.create({
      data: {
        phoneNumber: data.phoneNumber,
        name: data.name,
        email: data.email,
        role: data.role || 'STAFF' // ADMIN, STAFF, SUPPORT
      }
    });
  }

  async getTeamMembers() {
    return await prisma.user.findMany({
      select: {
        id: true,
        phoneNumber: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getTeamMemberStats(userId) {
    const conversations = await prisma.conversation.findMany({
      where: { assignedToUserId: userId },
      include: { messages: true }
    });

    const totalConversations = conversations.length;
    const unreadCount = conversations.reduce(
      (sum, c) => sum + (c.messages.filter(m => !m.isRead).length),
      0
    );
    const activeConversations = conversations.filter(c => c.status === 'OPEN').length;

    return {
      userId,
      totalConversations,
      unreadCount,
      activeConversations,
      responseTime: await this.calculateAverageResponseTime(userId)
    };
  }

  async calculateAverageResponseTime(userId) {
    const messages = await prisma.conversation.findMany({
      where: { assignedToUserId: userId },
      include: { messages: true }
    });

    let totalTime = 0;
    let count = 0;

    messages.forEach(conv => {
      const sortedMsgs = conv.messages.sort((a, b) => a.timestamp - b.timestamp);
      for (let i = 0; i < sortedMsgs.length - 1; i++) {
        if (sortedMsgs[i].isFromRetailer && !sortedMsgs[i + 1].isFromRetailer) {
          const diff = sortedMsgs[i + 1].timestamp - sortedMsgs[i].timestamp;
          totalTime += diff;
          count++;
        }
      }
    });

    return count > 0 ? Math.round(totalTime / count / 60000) : 0; // in minutes
  }

  // ============================================
  // SHARED INBOX MANAGEMENT
  // ============================================

  async getSharedInbox(filters = {}) {
    const where = {
      assignedToUserId: filters.userId ? filters.userId : undefined,
      status: filters.status || 'OPEN' // OPEN, CLOSED, PENDING
    };

    if (!filters.userId) delete where.assignedToUserId;

    return await prisma.conversation.findMany({
      where,
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1 // Last message preview
        },
        assignedToUser: {
          select: { name: true, id: true }
        },
        retailer: {
          select: { phoneNumber: true, pasalName: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      skip: filters.skip || 0,
      take: filters.take || 20
    });
  }

  async assignConversationToTeamMember(conversationId, userId) {
    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedToUserId: userId,
        assignedAt: new Date()
      },
      include: { assignedToUser: true }
    });

    // Log audit
    await this.logAdminAction({
      action: 'CONVERSATION_ASSIGNED',
      performedBy: userId,
      reference: `conversation:${conversationId}`,
      details: `Assigned to ${conversation.assignedToUser?.name}`
    });

    return conversation;
  }

  async unassignConversation(conversationId) {
    return await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedToUserId: null,
        assignedAt: null
      }
    });
  }

  async getConversation(conversationId) {
    return await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' }
        },
        retailer: true,
        assignedToUser: {
          select: { name: true, id: true, phoneNumber: true }
        }
      }
    });
  }

  async markConversationAsResolved(conversationId, notes) {
    return await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        resolvedNotes: notes
      }
    });
  }

  async reopenConversation(conversationId) {
    return await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'OPEN',
        closedAt: null
      }
    });
  }

  // ============================================
  // PRODUCT MANAGEMENT
  // ============================================

  async getAllProducts(filters = {}) {
    return await prisma.product.findMany({
      where: {
        isActive: filters.isActive !== false,
        categoryId: filters.categoryId
      },
      include: {
        category: true,
        inventory: true
      },
      orderBy: filters.sortBy === 'newest' ? { createdAt: 'desc' } : { name: 'asc' },
      skip: filters.skip || 0,
      take: filters.take || 50
    });
  }

  async getProductById(id) {
    return await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        inventory: true
      }
    });
  }

  async createProduct(data) {
    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        basePrice: parseFloat(data.basePrice),
        image: data.image,
        unit: data.unit,
        minOrderQuantity: data.minOrderQuantity || 1,
        isActive: true
      },
      include: { category: true }
    });

    // Initialize inventory
    if (data.wholesalerPrices && Array.isArray(data.wholesalerPrices)) {
      for (const wp of data.wholesalerPrices) {
        await prisma.productInventory.create({
          data: {
            productId: product.id,
            wholesalerId: wp.wholesalerId,
            stock: wp.stock || 0,
            price: parseFloat(wp.price)
          }
        });
      }
    }

    // Log audit
    await this.logAdminAction({
      action: 'PRODUCT_CREATED',
      reference: `product:${product.id}`,
      details: `Created: ${product.name}`
    });

    return product;
  }

  async updateProduct(id, data) {
    const product = await prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        basePrice: data.basePrice ? parseFloat(data.basePrice) : undefined,
        image: data.image,
        unit: data.unit,
        minOrderQuantity: data.minOrderQuantity,
        isActive: data.isActive
      },
      include: { category: true }
    });

    // Log audit
    await this.logAdminAction({
      action: 'PRODUCT_UPDATED',
      reference: `product:${id}`,
      details: `Updated: ${product.name}`
    });

    return product;
  }

  async deleteProduct(id) {
    const product = await prisma.product.findUnique({ where: { id } });

    await prisma.product.update({
      where: { id },
      data: { isActive: false }
    });

    // Log audit
    await this.logAdminAction({
      action: 'PRODUCT_DELETED',
      reference: `product:${id}`,
      details: `Deleted: ${product.name}`
    });

    return { success: true, message: 'Product deleted' };
  }

  async updateProductStock(productId, wholesalerId, stock) {
    return await prisma.productInventory.upsert({
      where: {
        productId_wholesalerId: { productId, wholesalerId }
      },
      update: { stock },
      create: {
        productId,
        wholesalerId,
        stock,
        price: 0
      }
    });
  }

  async getBulkProductStats() {
    const totalProducts = await prisma.product.count({ where: { isActive: true } });
    
    const lowStockProducts = await prisma.productInventory.findMany({
      where: {
        stock: { lte: 5 }
      },
      include: { product: true }
    });

    const topSellingProducts = await prisma.order.groupBy({
      by: ['productId'],
      _count: true,
      orderBy: { _count: { productId: 'desc' } },
      take: 5
    });

    return {
      totalProducts,
      lowStockCount: lowStockProducts.length,
      lowStockProducts: lowStockProducts.slice(0, 10),
      topSellingProducts: topSellingProducts.map(p => ({ productId: p.productId, orders: p._count }))
    };
  }

  // ============================================
  // DASHBOARD ANALYTICS
  // ============================================

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const thisMonth = new Date(today);
    thisMonth.setDate(1);

    // Orders
    const todayOrders = await prisma.order.count({
      where: { createdAt: { gte: today } }
    });

    const yesterdayOrders = await prisma.order.count({
      where: { 
        createdAt: { gte: yesterday, lt: today }
      }
    });

    const monthOrders = await prisma.order.count({
      where: { createdAt: { gte: thisMonth } }
    });

    // Revenue
    const todayRevenue = await prisma.order.aggregate({
      where: { createdAt: { gte: today } },
      _sum: { totalAmount: true }
    });

    const monthRevenue = await prisma.order.aggregate({
      where: { createdAt: { gte: thisMonth } },
      _sum: { totalAmount: true }
    });

    // Active conversations
    const activeConversations = await prisma.conversation.count({
      where: { status: 'OPEN' }
    });

    const pendingMessages = await prisma.conversation.count({
      where: {
        status: 'OPEN',
        messages: {
          some: {
            isFromRetailer: true,
            isRead: false
          }
        }
      }
    });

    // Retailers & Wholesalers
    const totalRetailers = await prisma.retailer.count();
    const totalWholesalers = await prisma.wholesaler.count();

    return {
      orders: {
        today: todayOrders,
        yesterday: yesterdayOrders,
        thisMonth: monthOrders,
        trend: todayOrders >= yesterdayOrders ? 'up' : 'down'
      },
      revenue: {
        today: Number(todayRevenue._sum.totalAmount || 0),
        thisMonth: Number(monthRevenue._sum.totalAmount || 0)
      },
      messages: {
        activeConversations,
        pendingMessages
      },
      users: {
        totalRetailers,
        totalWholesalers,
        teamMembers: await prisma.user.count()
      }
    };
  }

  async getConversationStats() {
    const stats = await prisma.conversation.groupBy({
      by: ['status'],
      _count: true
    });

    const statsMap = {
      OPEN: 0,
      CLOSED: 0,
      PENDING: 0
    };

    stats.forEach(s => {
      statsMap[s.status] = s._count;
    });

    return statsMap;
  }

  // ============================================
  // AUDIT LOGGING
  // ============================================

  async logAdminAction(data) {
    const targetId = data.reference ? data.reference.split(':')[1] : null; // Extract ID from "type:id"
    return await prisma.adminAuditLog.create({
      data: {
        adminId: data.performedBy,
        action: data.action,
        targetId: targetId,
        reason: data.details,
      },
    });
  }
}

module.exports = new AdminDashboardService();
