/**
 * Admin Dashboard Routes
 * Comprehensive dashboard API endpoints
 */

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const manualOverrideController = require('../controllers/manual-override.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');
const { adminRateLimiter } = require('../middleware/rateLimit.middleware');

// Apply authentication and admin check to all routes
router.use(authenticate);
router.use(isAdmin);
router.use(adminRateLimiter);

// ============================================================================
// LIVE ORDERS DASHBOARD
// ============================================================================

/**
 * Get live orders with real-time status
 * GET /api/v1/dashboard/orders/live
 * Query params: status, retailerId, wholesalerId, priority, page, limit, sortBy, sortOrder
 */
router.get('/orders/live', dashboardController.getLiveOrders);

/**
 * Get order details with full context
 * GET /api/v1/dashboard/orders/:id/details
 */
router.get('/orders/:id/details', async (req, res) => {
  try {
    const { id: orderId } = req.params;
    
    const order = await require('../config/database').order.findUnique({
      where: { id: orderId },
      include: {
        retailer: {
          select: { 
            id: true, 
            pasalName: true, 
            phoneNumber: true, 
            location: true,
            creditAccounts: {
              include: {
                wholesaler: {
                  select: { businessName: true }
                }
              }
            }
          }
        },
        wholesaler: {
          select: { 
            id: true, 
            businessName: true, 
            phoneNumber: true, 
            location: true,
            performance: true
          }
        },
        items: {
          include: {
            product: {
              select: { name: true, unit: true, category: true, imageUrl: true }
            }
          }
        },
        routing: {
          include: {
            vendorResponses: {
              include: {
                vendor: {
                  select: { id: true, businessName: true, phoneNumber: true }
                }
              },
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 20
        },
        creditReservation: true,
        stockReservations: {
          include: {
            wholesalerProduct: {
              include: {
                product: {
                  select: { name: true }
                }
              }
            }
          }
        },
        payments: true,
        images: true
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Get credit status
    let creditStatus = null;
    if (order.retailerId && order.wholesalerId) {
      try {
        const creditService = require('../services/credit.service');
        const balance = await creditService.calculateBalance(order.retailerId, order.wholesalerId);
        const account = await creditService.getOrCreateCreditAccount(order.retailerId, order.wholesalerId);
        creditStatus = {
          balance,
          creditLimit: Number(account.creditLimit),
          availableCredit: Number(account.creditLimit) - balance,
          utilizationPercent: account.creditLimit > 0 ? (balance / Number(account.creditLimit)) * 100 : 0
        };
      } catch (error) {
        console.warn('Failed to get credit status:', error.message);
      }
    }

    res.json({
      success: true,
      data: {
        ...order,
        creditStatus,
        totalAmount: order.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get order details',
      message: error.message
    });
  }
});

// ============================================================================
// CREDIT EXPOSURE DASHBOARD
// ============================================================================

/**
 * Get credit exposure heatmap
 * GET /api/v1/dashboard/credit/heatmap
 * Query params: wholesalerId, riskLevel, limit
 */
router.get('/credit/heatmap', dashboardController.getCreditHeatmap);

/**
 * Get credit exposure details for specific retailer-wholesaler pair
 * GET /api/v1/dashboard/credit/:retailerId/:wholesalerId/details
 */
router.get('/credit/:retailerId/:wholesalerId/details', async (req, res) => {
  try {
    const { retailerId, wholesalerId } = req.params;
    const { limit = 50 } = req.query;

    const creditService = require('../services/credit.service');
    
    // Get account and balance
    const [account, balance] = await Promise.all([
      creditService.getOrCreateCreditAccount(retailerId, wholesalerId),
      creditService.calculateBalance(retailerId, wholesalerId)
    ]);

    // Get recent ledger entries
    const ledgerEntries = await require('../config/database').ledgerEntry.findMany({
      where: { retailerId, wholesalerId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      include: {
        order: {
          select: { id: true, status: true, totalAmount: true }
        }
      }
    });

    // Get overdue entries
    const overdueEntries = await require('../config/database').ledgerEntry.findMany({
      where: {
        retailerId,
        wholesalerId,
        entryType: 'DEBIT',
        dueDate: { lt: new Date() }
      },
      orderBy: { dueDate: 'asc' }
    });

    const overdueAmount = overdueEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);

    res.json({
      success: true,
      data: {
        account,
        balance,
        creditLimit: Number(account.creditLimit),
        availableCredit: Number(account.creditLimit) - balance,
        utilizationPercent: account.creditLimit > 0 ? (balance / Number(account.creditLimit)) * 100 : 0,
        overdueAmount,
        overdueEntries: overdueEntries.length,
        ledgerEntries,
        summary: {
          totalEntries: ledgerEntries.length,
          totalDebits: ledgerEntries.filter(e => e.entryType === 'DEBIT').length,
          totalCredits: ledgerEntries.filter(e => e.entryType === 'CREDIT').length
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get credit details',
      message: error.message
    });
  }
});

// ============================================================================
// VENDOR PERFORMANCE DASHBOARD
// ============================================================================

/**
 * Get vendor performance metrics
 * GET /api/v1/dashboard/vendors/performance
 * Query params: vendorId, timeframe, sortBy, sortOrder, limit
 */
router.get('/vendors/performance', dashboardController.getVendorPerformance);

/**
 * Get detailed vendor performance
 * GET /api/v1/dashboard/vendors/:id/performance/details
 */
router.get('/vendors/:id/performance/details', async (req, res) => {
  try {
    const { id: vendorId } = req.params;
    const { timeframe = '30d' } = req.query;

    // Calculate date range
    const timeframeMap = { '7d': 7, '30d': 30, '90d': 90 };
    const days = timeframeMap[timeframe] || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const vendor = await require('../config/database').wholesaler.findUnique({
      where: { id: vendorId },
      include: {
        performance: true,
        deliveryZones: true,
        orders: {
          where: { createdAt: { gte: startDate } },
          include: {
            retailer: { select: { pasalName: true } },
            routing: {
              include: {
                vendorResponses: {
                  where: { vendorId }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        error: 'Vendor not found'
      });
    }

    // Calculate detailed metrics
    const orders = vendor.orders;
    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'DELIVERED').length;
    const cancelledOrders = orders.filter(o => o.status === 'CANCELLED').length;
    const failedOrders = orders.filter(o => o.status === 'FAILED').length;

    // Response time analysis
    const responses = orders.flatMap(o => o.routing?.vendorResponses || []);
    const avgResponseTime = responses.length > 0
      ? responses.reduce((sum, r) => sum + (new Date(r.createdAt) - new Date(r.createdAt)), 0) / responses.length
      : 0;

    // Revenue analysis
    const totalRevenue = orders
      .filter(o => o.status === 'DELIVERED')
      .reduce((sum, o) => sum + Number(o.totalAmount), 0);

    res.json({
      success: true,
      data: {
        vendor: {
          id: vendor.id,
          businessName: vendor.businessName,
          phoneNumber: vendor.phoneNumber,
          location: vendor.location,
          isActive: vendor.isActive,
          createdAt: vendor.createdAt
        },
        performance: vendor.performance,
        metrics: {
          totalOrders,
          completedOrders,
          cancelledOrders,
          failedOrders,
          completionRate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0,
          cancellationRate: totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0,
          failureRate: totalOrders > 0 ? (failedOrders / totalOrders) * 100 : 0,
          avgResponseTime: Math.round(avgResponseTime / (1000 * 60)), // minutes
          totalRevenue
        },
        deliveryZones: vendor.deliveryZones,
        recentOrders: orders.slice(0, 20),
        timeframe: {
          period: timeframe,
          startDate,
          endDate: new Date()
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get vendor performance details',
      message: error.message
    });
  }
});

// ============================================================================
// RISK ALERTS
// ============================================================================

/**
 * Get active risk alerts
 * GET /api/v1/dashboard/alerts
 * Query params: severity, category, limit
 */
router.get('/alerts', dashboardController.getRiskAlerts);

/**
 * Mark alert as acknowledged
 * POST /api/v1/dashboard/alerts/:id/acknowledge
 */
router.post('/alerts/:id/acknowledge', async (req, res) => {
  try {
    const { id: alertId } = req.params;
    const { notes } = req.body;
    const adminId = req.user.id;

    // In a real implementation, you'd store alert acknowledgments
    // For now, we'll just log the action
    require('../infrastructure/logger').logger.info('Alert acknowledged', {
      action: 'alert_acknowledged',
      alertId,
      adminId,
      notes
    });

    res.json({
      success: true,
      message: 'Alert acknowledged successfully',
      data: {
        alertId,
        acknowledgedBy: adminId,
        acknowledgedAt: new Date(),
        notes
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert',
      message: error.message
    });
  }
});

// ============================================================================
// MANUAL OVERRIDES
// ============================================================================

// Retailer Management
router.post('/overrides/retailer/:id/freeze', manualOverrideController.freezeRetailer);
router.post('/overrides/retailer/:id/credit', manualOverrideController.adjustRetailerCredit);
router.post('/overrides/retailers/bulk-freeze', manualOverrideController.bulkFreezeRetailers);

// Vendor Management
router.post('/overrides/vendor/:id/pause', manualOverrideController.pauseVendor);

// Order Management
router.post('/overrides/order/:id/reassign', manualOverrideController.reassignOrder);
router.post('/overrides/order/:id/status', manualOverrideController.forceOrderStatus);

// ============================================================================
// DASHBOARD SUMMARY
// ============================================================================

/**
 * Get dashboard summary with key metrics
 * GET /api/v1/dashboard/summary
 */
router.get('/summary', async (req, res) => {
  try {
    const prisma = require('../config/database');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalOrders,
      todayOrders,
      pendingOrders,
      activeRetailers,
      activeVendors,
      totalRevenue,
      todayRevenue,
      criticalAlerts
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.count({ 
        where: { 
          status: { 
            in: ['CREATED', 'PENDING_BIDS', 'CREDIT_APPROVED', 'STOCK_RESERVED'] 
          } 
        } 
      }),
      prisma.retailer.count({ where: { isActive: true } }),
      prisma.wholesaler.count({ where: { isActive: true } }),
      prisma.order.aggregate({
        where: { status: 'DELIVERED' },
        _sum: { totalAmount: true }
      }),
      prisma.order.aggregate({
        where: { 
          status: 'DELIVERED',
          createdAt: { gte: today }
        },
        _sum: { totalAmount: true }
      }),
      // This would come from your alerts system
      0 // Placeholder for critical alerts count
    ]);

    // Get order status breakdown
    const statusBreakdown = await prisma.order.groupBy({
      by: ['status'],
      _count: { status: true }
    });

    const statusCounts = statusBreakdown.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        orders: {
          total: totalOrders,
          today: todayOrders,
          pending: pendingOrders,
          statusBreakdown: statusCounts
        },
        users: {
          activeRetailers,
          activeVendors
        },
        revenue: {
          total: Number(totalRevenue._sum.totalAmount) || 0,
          today: Number(todayRevenue._sum.totalAmount) || 0
        },
        alerts: {
          critical: criticalAlerts
        },
        timestamp: now
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard summary',
      message: error.message
    });
  }
});

// ============================================================================
// REAL-TIME UPDATES (WebSocket endpoint info)
// ============================================================================

/**
 * Get WebSocket connection info for real-time updates
 * GET /api/v1/dashboard/websocket-info
 */
router.get('/websocket-info', (req, res) => {
  res.json({
    success: true,
    data: {
      websocketUrl: process.env.WEBSOCKET_URL || 'ws://localhost:3000/ws',
      channels: [
        'orders.live',
        'credit.alerts',
        'vendor.performance',
        'system.alerts'
      ],
      authentication: {
        type: 'jwt',
        header: 'Authorization',
        prefix: 'Bearer '
      }
    }
  });
});

module.exports = router;