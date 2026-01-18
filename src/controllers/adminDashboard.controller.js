// Admin Controller - Products & Shared Inbox Management
const adminDashboardService = require('../services/adminDashboard.service');
const whatsappService = require('../services/whatsapp.service');

class AdminController {
  // ============================================
  // PRODUCT MANAGEMENT
  // ============================================

  async getAllProducts(req, res) {
    try {
      const { skip, take, categoryId, isActive, sortBy } = req.query;
      const products = await adminDashboardService.getAllProducts({
        skip: skip ? parseInt(skip) : 0,
        take: take ? parseInt(take) : 50,
        categoryId,
        isActive: isActive !== 'false',
        sortBy
      });
      res.json(products);
    } catch (error) {
      console.error('Get products error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getProduct(req, res) {
    try {
      const product = await adminDashboardService.getProductById(req.params.id);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async createProduct(req, res) {
    try {
      const { name, description, categoryId, basePrice, image, unit, minOrderQuantity, wholesalerPrices } = req.body;

      if (!name || !categoryId || !basePrice) {
        return res.status(400).json({ error: 'Missing required fields: name, categoryId, basePrice' });
      }

      const product = await adminDashboardService.createProduct({
        name,
        description,
        categoryId,
        basePrice,
        image,
        unit: unit || 'piece',
        minOrderQuantity: minOrderQuantity || 1,
        wholesalerPrices
      });

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        product
      });
    } catch (error) {
      console.error('Create product error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async updateProduct(req, res) {
    try {
      const product = await adminDashboardService.updateProduct(req.params.id, req.body);
      res.json({
        success: true,
        message: 'Product updated successfully',
        product
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async deleteProduct(req, res) {
    try {
      const result = await adminDashboardService.deleteProduct(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateProductStock(req, res) {
    try {
      const { wholesalerId, stock } = req.body;
      if (!wholesalerId || stock === undefined) {
        return res.status(400).json({ error: 'Missing wholesalerId or stock' });
      }

      const result = await adminDashboardService.updateProductStock(req.params.id, wholesalerId, stock);
      res.json({
        success: true,
        message: 'Stock updated',
        inventory: result
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getProductStats(req, res) {
    try {
      const stats = await adminDashboardService.getBulkProductStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // SHARED INBOX MANAGEMENT
  // ============================================

  async getSharedInbox(req, res) {
    try {
      const { userId, status, skip, take } = req.query;
      const conversations = await adminDashboardService.getSharedInbox({
        userId,
        status,
        skip: skip ? parseInt(skip) : 0,
        take: take ? parseInt(take) : 20
      });

      const stats = await adminDashboardService.getConversationStats();

      res.json({
        conversations,
        stats
      });
    } catch (error) {
      console.error('Get inbox error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getConversation(req, res) {
    try {
      const conversation = await adminDashboardService.getConversation(req.params.id);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
      res.json(conversation);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async assignConversation(req, res) {
    try {
      const { conversationId } = req.params;
      const { userId } = req.body;

      if (!userId) return res.status(400).json({ error: 'Missing userId' });

      const conversation = await adminDashboardService.assignConversationToTeamMember(conversationId, userId);

      // Notify team member
      await whatsappService.sendMessage(
        '+1-NOTIFICATION-SYSTEM',
        `📌 New conversation assigned: ${conversation.retailer?.pasalName || 'New Retailer'}`
      );

      res.json({
        success: true,
        message: 'Conversation assigned',
        conversation
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async unassignConversation(req, res) {
    try {
      const conversation = await adminDashboardService.unassignConversation(req.params.id);
      res.json({
        success: true,
        message: 'Conversation unassigned',
        conversation
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async resolveConversation(req, res) {
    try {
      const { notes } = req.body;
      const conversation = await adminDashboardService.markConversationAsResolved(req.params.id, notes);
      res.json({
        success: true,
        message: 'Conversation resolved',
        conversation
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async reopenConversation(req, res) {
    try {
      const conversation = await adminDashboardService.reopenConversation(req.params.id);
      res.json({
        success: true,
        message: 'Conversation reopened',
        conversation
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // TEAM MEMBER MANAGEMENT
  // ============================================

  async createTeamMember(req, res) {
    try {
      const { phoneNumber, name, email, role } = req.body;

      if (!phoneNumber || !name) {
        return res.status(400).json({ error: 'Missing required fields: phoneNumber, name' });
      }

      const member = await adminDashboardService.createTeamMember({
        phoneNumber,
        name,
        email,
        role: role || 'STAFF'
      });

      res.status(201).json({
        success: true,
        message: 'Team member created',
        member
      });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Phone number or email already exists' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async getTeamMembers(req, res) {
    try {
      const members = await adminDashboardService.getTeamMembers();
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getTeamMemberStats(req, res) {
    try {
      const stats = await adminDashboardService.getTeamMemberStats(req.params.userId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // DASHBOARD & ANALYTICS
  // ============================================

  async getDashboard(req, res) {
    try {
      const stats = await adminDashboardService.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getActivityLog(req, res) {
    try {
      const { userId, action, since, skip, take } = req.query;
      const logs = await adminDashboardService.getAdminActivityLog({
        userId,
        action,
        since: since ? new Date(since) : undefined,
        skip: skip ? parseInt(skip) : 0,
        take: take ? parseInt(take) : 50
      });
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new AdminController();
