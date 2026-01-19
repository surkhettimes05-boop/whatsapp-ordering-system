const prisma = require('../config/database');
const orderService = require('../services/order.service');
const creditService = require('../services/credit.service');
const orderDecisionEngine = require('../services/orderDecision.service');
const analyticsService = require('../services/analytics.service');

class AdminController {

  async getDashboardStats(req, res) {
    try {
      const [totalRetailers, totalOrders, totalProduct, pendingOrders] = await Promise.all([
        prisma.retailer.count(),
        prisma.order.count(),
        prisma.product.count({ where: { isActive: true } }),
        prisma.order.count({ where: { status: 'PENDING' } })
      ]);

      res.json({
        success: true,
        data: {
          totalRetailers,
          totalOrders,
          activeProducts: totalProduct,
          pendingOrders
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getAllRetailers(req, res) {
    try {
      const { search } = req.query;
      const where = {};
      if (search) {
        where.OR = [
          { item: { pasalName: { contains: search } } },
          { item: { phoneNumber: { contains: search } } }
        ];
      }

      const retailers = await prisma.retailer.findMany({
        where,
        include: { credit: true },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      res.json({ success: true, data: { retailers } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getRetailerCredit(req, res) {
    try {
      const { id } = req.params;
      const credit = await prisma.creditAccount.findUnique({
        where: { retailerId: id }
      });
      const transactions = await prisma.creditTransaction.findMany({
        where: { retailerId: id },
        orderBy: { createdAt: 'desc' },
        take: 20
      });
      res.json({ success: true, data: { credit, transactions } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getOverdueCredits(req, res) {
    const today = new Date();
    try {
      const overdue = await prisma.creditTransaction.findMany({
        where: {
          status: 'OPEN',
          dueDate: { lt: today }
        },
        include: { retailer: true },
        orderBy: { dueDate: 'asc' }
      });

      res.json({ success: true, data: { overdue } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getCreditAnalytics(req, res) {
    try {
      const report = await creditService.getSystemCreditRisk();
      res.json({ success: true, data: report });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Orders
  async getAllOrders(req, res) {
    try {
      const result = await orderService.getAllOrders(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const order = await orderService.updateOrderStatus(id, status);
      res.json({ success: true, data: { order } });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  // Order Decision Engine
  async assignOrderWinner(req, res) {
    try {
      const { orderId } = req.params;
      const adminId = req.user?.id || 'admin'; // Assuming auth middleware sets req.user

      const result = await orderDecisionEngine.decideWinner(orderId, {
        adminTriggered: true,
        adminId
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        message: 'Order assigned successfully',
        data: {
          orderId: result.orderId,
          winner: result.winner,
          totalOffers: result.losers.length + 1
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getOrderOffers(req, res) {
    try {
      const { orderId } = req.params;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          vendorOffers: {
            include: {
              wholesaler: {
                select: {
                  id: true,
                  businessName: true,
                  reliabilityScore: true,
                  averageRating: true
                }
              }
            },
            orderBy: { price_quote: 'asc' }
          }
        }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      // Score each offer for admin visibility
      const scoredOffers = order.vendorOffers.map(offer => ({
        ...offer,
        score: orderDecisionEngine.scoreOffer(offer)
      }));

      scoredOffers.sort((a, b) => b.score - a.score);

      res.json({
        success: true,
        data: {
          orderId: order.id,
          status: order.status,
          expiresAt: order.expires_at,
          finalWholesalerId: order.final_wholesaler_id,
          offers: scoredOffers,
          totalOffers: scoredOffers.length
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async processExpiredOrders(req, res) {
    try {
      const result = await orderDecisionEngine.processExpiredOrders();

      res.json({
        success: true,
        message: 'Expired orders processed',
        data: result
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Analytics endpoints
  async getOfferCountPerOrder(req, res) {
    try {
      const filters = {
        orderId: req.query.orderId,
        status: req.query.status,
        limit: req.query.limit ? parseInt(req.query.limit) : 100
      };

      if (req.query.startDate && req.query.endDate) {
        filters.dateRange = {
          start: new Date(req.query.startDate),
          end: new Date(req.query.endDate)
        };
      }

      const result = await analyticsService.getOfferCountPerOrder(filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getAverageResponseTime(req, res) {
    try {
      const filters = {
        wholesalerId: req.query.wholesalerId
      };

      if (req.query.startDate && req.query.endDate) {
        filters.dateRange = {
          start: new Date(req.query.startDate),
          end: new Date(req.query.endDate)
        };
      }

      const result = await analyticsService.getAverageResponseTime(filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getWinRatePerWholesaler(req, res) {
    try {
      const filters = {
        wholesalerId: req.query.wholesalerId
      };

      if (req.query.startDate && req.query.endDate) {
        filters.dateRange = {
          start: new Date(req.query.startDate),
          end: new Date(req.query.endDate)
        };
      }

      const result = await analyticsService.getWinRatePerWholesaler(filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getAnalyticsDashboard(req, res) {
    try {
      const filters = {};

      if (req.query.startDate && req.query.endDate) {
        filters.dateRange = {
          start: new Date(req.query.startDate),
          end: new Date(req.query.endDate)
        };
      }

      const result = await analyticsService.getAnalyticsDashboard(filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get latest recovery report
   * GET /api/v1/admin/recovery/report
   */
  async getRecoveryReport(req, res) {
    try {
      // Get latest recovery report from audit log
      const latestReport = await prisma.auditLog.findFirst({
        where: { action: 'RECOVERY_REPORT' },
        orderBy: { createdAt: 'desc' }
      });

      if (!latestReport) {
        return res.json({
          success: true,
          message: 'No recovery reports found',
          data: null
        });
      }

      const report = JSON.parse(latestReport.metadata);

      res.json({
        success: true,
        data: {
          lastRun: latestReport.createdAt,
          ...report
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get recovery history (last N reports)
   * GET /api/v1/admin/recovery/history?limit=10
   */
  async getRecoveryHistory(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;

      const reports = await prisma.auditLog.findMany({
        where: { action: 'RECOVERY_REPORT' },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      const history = reports.map(log => ({
        timestamp: log.createdAt,
        ...JSON.parse(log.metadata)
      }));

      res.json({
        success: true,
        data: { history, total: history.length }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Manually trigger recovery worker
   * POST /api/v1/admin/recovery/run
   */
  async runRecoveryWorker(req, res) {
    try {
      const recoveryWorker = require('../workers/recovery.worker');
      const report = await recoveryWorker.run();

      res.json({
        success: true,
        message: 'Recovery worker completed',
        data: report
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new AdminController();
