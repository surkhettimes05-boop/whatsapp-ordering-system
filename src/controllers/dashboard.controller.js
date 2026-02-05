/**
 * Admin Dashboard Controller
 * Comprehensive dashboard with live orders, credit exposure, vendor performance, and manual overrides
 */

const prisma = require('../config/database');
const creditService = require('../services/credit.service');
const vendorRoutingService = require('../services/vendor-routing.service');
const analyticsService = require('../services/analytics.service');
const adminService = require('../services/admin.service');
const { logger } = require('../infrastructure/logger');

class DashboardController {
  
  // ============================================================================
  // LIVE ORDERS DASHBOARD
  // ============================================================================

  /**
   * Get live orders with real-time status
   * GET /api/v1/dashboard/orders/live
   */
  async getLiveOrders(req, res) {
    try {
      const { 
        status, 
        retailerId, 
        wholesalerId, 
        priority,
        page = 1, 
        limit = 50,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (page - 1) * limit;
      const where = {};

      // Build filters
      if (status) where.status = status;
      if (retailerId) where.retailerId = retailerId;
      if (wholesalerId) where.wholesalerId = wholesalerId;
      if (priority) where.priority = priority;

      // Get orders with related data
      const [orders, totalCount] = await Promise.all([
        prisma.order.findMany({
          where,
          skip: parseInt(skip),
          take: parseInt(limit),
          orderBy: { [sortBy]: sortOrder },
          include: {
            retailer: {
              select: { id: true, pasalName: true, phoneNumber: true, location: true }
            },
            wholesaler: {
              select: { id: true, businessName: true, phoneNumber: true }
            },
            items: {
              include: {
                product: {
                  select: { name: true, unit: true, category: true }
                }
              }
            },
            routing: {
              include: {
                vendorResponses: {
                  include: {
                    vendor: {
                      select: { id: true, businessName: true }
                    }
                  }
                }
              }
            },
            events: {
              orderBy: { createdAt: 'desc' },
              take: 5
            },
            creditReservation: true
          }
        }),
        prisma.order.count({ where })
      ]);

      // Enrich with real-time data
      const enrichedOrders = await Promise.all(
        orders.map(async (order) => {
          // Get current credit status
          let creditStatus = null;
          if (order.retailerId && order.wholesalerId) {
            try {
              const balance = await creditService.calculateBalance(order.retailerId, order.wholesalerId);
              const account = await creditService.getOrCreateCreditAccount(order.retailerId, order.wholesalerId);
              creditStatus = {
                balance,
                creditLimit: Number(account.creditLimit),
                utilizationPercent: account.creditLimit > 0 ? (balance / Number(account.creditLimit)) * 100 : 0
              };
            } catch (error) {
              logger.warn('Failed to get credit status for order', { orderId: order.id, error: error.message });
            }
          }

          // Calculate order age and SLA status
          const orderAge = Date.now() - new Date(order.createdAt).getTime();
          const slaStatus = this.calculateSLAStatus(order.status, orderAge);

          return {
            ...order,
            creditStatus,
            orderAge: Math.floor(orderAge / (1000 * 60)), // minutes
            slaStatus,
            totalAmount: order.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
          };
        })
      );

      res.json({
        success: true,
        data: {
          orders: enrichedOrders,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          },
          summary: {
            totalOrders: totalCount,
            statusBreakdown: await this.getOrderStatusBreakdown(where)
          }
        }
      });

    } catch (error) {
      logger.error('Failed to get live orders', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get live orders',
        message: error.message
      });
    }
  }

  /**
   * Get order status breakdown
   */
  async getOrderStatusBreakdown(baseWhere = {}) {
    const statusCounts = await prisma.order.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { status: true }
    });

    return statusCounts.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {});
  }

  /**
   * Calculate SLA status based on order status and age
   */
  calculateSLAStatus(status, ageMs) {
    const ageMinutes = ageMs / (1000 * 60);
    
    const slaThresholds = {
      CREATED: 5,
      PENDING_BIDS: 30,
      CREDIT_APPROVED: 10,
      STOCK_RESERVED: 15,
      WHOLESALER_ACCEPTED: 60,
      CONFIRMED: 120,
      PROCESSING: 240,
      PACKED: 60,
      OUT_FOR_DELIVERY: 480
    };

    const threshold = slaThresholds[status];
    if (!threshold) return 'ON_TIME';

    if (ageMinutes > threshold * 1.5) return 'CRITICAL';
    if (ageMinutes > threshold) return 'WARNING';
    return 'ON_TIME';
  }

  // ============================================================================
  // CREDIT EXPOSURE HEATMAP
  // ============================================================================

  /**
   * Get credit exposure heatmap data
   * GET /api/v1/dashboard/credit/heatmap
   */
  async getCreditHeatmap(req, res) {
    try {
      const { wholesalerId, riskLevel, limit = 100 } = req.query;

      // Get all active credit accounts with current balances
      const accounts = await prisma.creditAccount.findMany({
        where: {
          isActive: true,
          ...(wholesalerId && { wholesalerId })
        },
        include: {
          retailer: {
            select: { id: true, pasalName: true, phoneNumber: true, location: true }
          },
          wholesaler: {
            select: { id: true, businessName: true, phoneNumber: true }
          }
        },
        take: parseInt(limit)
      });

      // Calculate current balances and risk levels
      const heatmapData = await Promise.all(
        accounts.map(async (account) => {
          const balance = await creditService.calculateBalance(account.retailerId, account.wholesalerId);
          const creditLimit = Number(account.creditLimit);
          const utilizationPercent = creditLimit > 0 ? (balance / creditLimit) * 100 : 0;
          
          // Calculate risk level
          let riskLevel = 'LOW';
          if (utilizationPercent > 90) riskLevel = 'CRITICAL';
          else if (utilizationPercent > 75) riskLevel = 'HIGH';
          else if (utilizationPercent > 50) riskLevel = 'MEDIUM';

          // Get overdue amount
          const overdueEntries = await prisma.ledgerEntry.findMany({
            where: {
              retailerId: account.retailerId,
              wholesalerId: account.wholesalerId,
              entryType: 'DEBIT',
              dueDate: { lt: new Date() }
            }
          });

          const overdueAmount = overdueEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);

          return {
            retailerId: account.retailerId,
            wholesalerId: account.wholesalerId,
            retailerName: account.retailer.pasalName,
            wholesalerName: account.wholesaler.businessName,
            balance,
            creditLimit,
            availableCredit: creditLimit - balance,
            utilizationPercent: Math.round(utilizationPercent * 100) / 100,
            riskLevel,
            overdueAmount,
            lastActivity: account.updatedAt,
            location: account.retailer.location
          };
        })
      );

      // Filter by risk level if specified
      const filteredData = riskLevel 
        ? heatmapData.filter(item => item.riskLevel === riskLevel)
        : heatmapData;

      // Sort by utilization percentage (highest risk first)
      filteredData.sort((a, b) => b.utilizationPercent - a.utilizationPercent);

      // Calculate summary statistics
      const summary = {
        totalAccounts: heatmapData.length,
        totalExposure: heatmapData.reduce((sum, item) => sum + item.balance, 0),
        totalCreditLimit: heatmapData.reduce((sum, item) => sum + item.creditLimit, 0),
        totalOverdue: heatmapData.reduce((sum, item) => sum + item.overdueAmount, 0),
        riskBreakdown: {
          CRITICAL: heatmapData.filter(item => item.riskLevel === 'CRITICAL').length,
          HIGH: heatmapData.filter(item => item.riskLevel === 'HIGH').length,
          MEDIUM: heatmapData.filter(item => item.riskLevel === 'MEDIUM').length,
          LOW: heatmapData.filter(item => item.riskLevel === 'LOW').length
        }
      };

      res.json({
        success: true,
        data: {
          heatmap: filteredData,
          summary
        }
      });

    } catch (error) {
      logger.error('Failed to get credit heatmap', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get credit heatmap',
        message: error.message
      });
    }
  }

  // ============================================================================
  // VENDOR PERFORMANCE DASHBOARD
  // ============================================================================

  /**
   * Get vendor performance metrics
   * GET /api/v1/dashboard/vendors/performance
   */
  async getVendorPerformance(req, res) {
    try {
      const { 
        vendorId, 
        timeframe = '7d',
        sortBy = 'overallScore',
        sortOrder = 'desc',
        limit = 50 
      } = req.query;

      // Calculate date range
      const timeframeMap = {
        '1d': 1,
        '7d': 7,
        '30d': 30,
        '90d': 90
      };
      const days = timeframeMap[timeframe] || 7;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Get vendor performance data
      const vendors = await prisma.wholesaler.findMany({
        where: {
          isActive: true,
          ...(vendorId && { id: vendorId })
        },
        include: {
          performance: true,
          deliveryZones: true,
          _count: {
            orders: {
              where: {
                createdAt: { gte: startDate }
              }
            }
          }
        },
        take: parseInt(limit)
      });

      // Enrich with calculated metrics
      const performanceData = await Promise.all(
        vendors.map(async (vendor) => {
          // Get recent orders for metrics calculation
          const recentOrders = await prisma.order.findMany({
            where: {
              wholesalerId: vendor.id,
              createdAt: { gte: startDate }
            },
            include: {
              routing: {
                include: {
                  vendorResponses: {
                    where: { vendorId: vendor.id }
                  }
                }
              }
            }
          });

          // Calculate metrics
          const totalOrders = recentOrders.length;
          const completedOrders = recentOrders.filter(o => o.status === 'DELIVERED').length;
          const cancelledOrders = recentOrders.filter(o => o.status === 'CANCELLED').length;
          
          const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;
          const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

          // Calculate average response time
          const responses = recentOrders
            .flatMap(o => o.routing?.vendorResponses || [])
            .filter(r => r.vendorId === vendor.id);
          
          const avgResponseTime = responses.length > 0
            ? responses.reduce((sum, r) => {
                const responseTime = new Date(r.createdAt) - new Date(r.createdAt); // This should be calculated properly
                return sum + responseTime;
              }, 0) / responses.length
            : 0;

          // Get current performance scores
          const performance = vendor.performance || {};
          
          return {
            vendorId: vendor.id,
            businessName: vendor.businessName,
            phoneNumber: vendor.phoneNumber,
            location: vendor.location,
            isActive: vendor.isActive,
            
            // Performance scores
            overallScore: performance.overallScore || 0,
            priceScore: performance.priceScore || 0,
            deliveryScore: performance.deliveryScore || 0,
            reliabilityScore: performance.reliabilityScore || 0,
            creditScore: performance.creditScore || 0,
            
            // Calculated metrics
            totalOrders,
            completedOrders,
            cancelledOrders,
            completionRate: Math.round(completionRate * 100) / 100,
            cancellationRate: Math.round(cancellationRate * 100) / 100,
            avgResponseTime: Math.round(avgResponseTime / (1000 * 60)), // minutes
            
            // Service areas
            deliveryZones: vendor.deliveryZones.length,
            
            // Last activity
            lastActivity: performance.updatedAt || vendor.updatedAt
          };
        })
      );

      // Sort results
      performanceData.sort((a, b) => {
        const aVal = a[sortBy] || 0;
        const bVal = b[sortBy] || 0;
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });

      // Calculate summary
      const summary = {
        totalVendors: performanceData.length,
        activeVendors: performanceData.filter(v => v.isActive).length,
        avgOverallScore: performanceData.reduce((sum, v) => sum + v.overallScore, 0) / performanceData.length,
        avgCompletionRate: performanceData.reduce((sum, v) => sum + v.completionRate, 0) / performanceData.length,
        totalOrders: performanceData.reduce((sum, v) => sum + v.totalOrders, 0)
      };

      res.json({
        success: true,
        data: {
          vendors: performanceData,
          summary,
          timeframe: {
            period: timeframe,
            startDate,
            endDate: new Date()
          }
        }
      });

    } catch (error) {
      logger.error('Failed to get vendor performance', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get vendor performance',
        message: error.message
      });
    }
  }

  // ============================================================================
  // RISK ALERTS
  // ============================================================================

  /**
   * Get active risk alerts
   * GET /api/v1/dashboard/alerts
   */
  async getRiskAlerts(req, res) {
    try {
      const { severity, category, limit = 50 } = req.query;

      const alerts = [];

      // Credit risk alerts
      const creditAlerts = await this.getCreditRiskAlerts();
      alerts.push(...creditAlerts);

      // Order processing alerts
      const orderAlerts = await this.getOrderProcessingAlerts();
      alerts.push(...orderAlerts);

      // Vendor performance alerts
      const vendorAlerts = await this.getVendorPerformanceAlerts();
      alerts.push(...vendorAlerts);

      // System health alerts
      const systemAlerts = await this.getSystemHealthAlerts();
      alerts.push(...systemAlerts);

      // Filter and sort alerts
      let filteredAlerts = alerts;
      if (severity) {
        filteredAlerts = alerts.filter(alert => alert.severity === severity);
      }
      if (category) {
        filteredAlerts = filteredAlerts.filter(alert => alert.category === category);
      }

      // Sort by severity and timestamp
      const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      filteredAlerts.sort((a, b) => {
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });

      // Limit results
      filteredAlerts = filteredAlerts.slice(0, parseInt(limit));

      res.json({
        success: true,
        data: {
          alerts: filteredAlerts,
          summary: {
            total: alerts.length,
            critical: alerts.filter(a => a.severity === 'CRITICAL').length,
            high: alerts.filter(a => a.severity === 'HIGH').length,
            medium: alerts.filter(a => a.severity === 'MEDIUM').length,
            low: alerts.filter(a => a.severity === 'LOW').length
          }
        }
      });

    } catch (error) {
      logger.error('Failed to get risk alerts', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get risk alerts',
        message: error.message
      });
    }
  }

  /**
   * Get credit risk alerts
   */
  async getCreditRiskAlerts() {
    const alerts = [];

    // High credit utilization
    const highUtilization = await prisma.creditAccount.findMany({
      where: { isActive: true },
      include: {
        retailer: { select: { pasalName: true } },
        wholesaler: { select: { businessName: true } }
      }
    });

    for (const account of highUtilization) {
      const balance = await creditService.calculateBalance(account.retailerId, account.wholesalerId);
      const utilization = Number(account.creditLimit) > 0 ? (balance / Number(account.creditLimit)) * 100 : 0;

      if (utilization > 90) {
        alerts.push({
          id: `credit-util-${account.retailerId}-${account.wholesalerId}`,
          category: 'CREDIT',
          severity: 'CRITICAL',
          title: 'Critical Credit Utilization',
          message: `${account.retailer.pasalName} has ${utilization.toFixed(1)}% credit utilization with ${account.wholesaler.businessName}`,
          timestamp: new Date(),
          data: {
            retailerId: account.retailerId,
            wholesalerId: account.wholesalerId,
            utilization,
            balance,
            creditLimit: Number(account.creditLimit)
          }
        });
      } else if (utilization > 75) {
        alerts.push({
          id: `credit-util-${account.retailerId}-${account.wholesalerId}`,
          category: 'CREDIT',
          severity: 'HIGH',
          title: 'High Credit Utilization',
          message: `${account.retailer.pasalName} has ${utilization.toFixed(1)}% credit utilization with ${account.wholesaler.businessName}`,
          timestamp: new Date(),
          data: {
            retailerId: account.retailerId,
            wholesalerId: account.wholesalerId,
            utilization,
            balance,
            creditLimit: Number(account.creditLimit)
          }
        });
      }
    }

    // Overdue payments
    const overdueEntries = await prisma.ledgerEntry.findMany({
      where: {
        entryType: 'DEBIT',
        dueDate: { lt: new Date() }
      },
      include: {
        retailer: { select: { pasalName: true } },
        wholesaler: { select: { businessName: true } }
      }
    });

    const overdueByAccount = {};
    overdueEntries.forEach(entry => {
      const key = `${entry.retailerId}-${entry.wholesalerId}`;
      if (!overdueByAccount[key]) {
        overdueByAccount[key] = {
          retailerId: entry.retailerId,
          wholesalerId: entry.wholesalerId,
          retailerName: entry.retailer.pasalName,
          wholesalerName: entry.wholesaler.businessName,
          amount: 0,
          oldestDue: entry.dueDate
        };
      }
      overdueByAccount[key].amount += Number(entry.amount);
      if (entry.dueDate < overdueByAccount[key].oldestDue) {
        overdueByAccount[key].oldestDue = entry.dueDate;
      }
    });

    Object.values(overdueByAccount).forEach(overdue => {
      const daysPastDue = Math.floor((Date.now() - new Date(overdue.oldestDue).getTime()) / (1000 * 60 * 60 * 24));
      
      alerts.push({
        id: `overdue-${overdue.retailerId}-${overdue.wholesalerId}`,
        category: 'CREDIT',
        severity: daysPastDue > 30 ? 'CRITICAL' : daysPastDue > 7 ? 'HIGH' : 'MEDIUM',
        title: 'Overdue Payment',
        message: `${overdue.retailerName} has ₹${overdue.amount.toFixed(2)} overdue to ${overdue.wholesalerName} (${daysPastDue} days)`,
        timestamp: new Date(),
        data: {
          retailerId: overdue.retailerId,
          wholesalerId: overdue.wholesalerId,
          amount: overdue.amount,
          daysPastDue
        }
      });
    });

    return alerts;
  }

  /**
   * Get order processing alerts
   */
  async getOrderProcessingAlerts() {
    const alerts = [];

    // Stuck orders (orders that haven't progressed in expected time)
    const stuckOrders = await prisma.order.findMany({
      where: {
        status: {
          in: ['CREATED', 'PENDING_BIDS', 'CREDIT_APPROVED', 'STOCK_RESERVED']
        },
        createdAt: {
          lt: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
        }
      },
      include: {
        retailer: { select: { pasalName: true } }
      }
    });

    stuckOrders.forEach(order => {
      const ageHours = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60));
      
      alerts.push({
        id: `stuck-order-${order.id}`,
        category: 'ORDER',
        severity: ageHours > 4 ? 'CRITICAL' : ageHours > 2 ? 'HIGH' : 'MEDIUM',
        title: 'Stuck Order',
        message: `Order ${order.id} from ${order.retailer.pasalName} stuck in ${order.status} for ${ageHours} hours`,
        timestamp: new Date(),
        data: {
          orderId: order.id,
          status: order.status,
          ageHours,
          retailerId: order.retailerId
        }
      });
    });

    return alerts;
  }

  /**
   * Get vendor performance alerts
   */
  async getVendorPerformanceAlerts() {
    const alerts = [];

    // Low performing vendors
    const vendors = await prisma.wholesaler.findMany({
      where: { isActive: true },
      include: { performance: true }
    });

    vendors.forEach(vendor => {
      const performance = vendor.performance;
      if (performance && performance.overallScore < 60) {
        alerts.push({
          id: `vendor-performance-${vendor.id}`,
          category: 'VENDOR',
          severity: performance.overallScore < 40 ? 'CRITICAL' : 'HIGH',
          title: 'Low Vendor Performance',
          message: `${vendor.businessName} has low performance score: ${performance.overallScore}`,
          timestamp: new Date(),
          data: {
            vendorId: vendor.id,
            overallScore: performance.overallScore,
            priceScore: performance.priceScore,
            deliveryScore: performance.deliveryScore,
            reliabilityScore: performance.reliabilityScore
          }
        });
      }
    });

    return alerts;
  }

  /**
   * Get system health alerts
   */
  async getSystemHealthAlerts() {
    const alerts = [];

    // Check for high error rates (this would typically come from monitoring system)
    // For now, we'll check for recent failed orders
    const recentFailures = await prisma.order.count({
      where: {
        status: 'FAILED',
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      }
    });

    if (recentFailures > 10) {
      alerts.push({
        id: 'high-failure-rate',
        category: 'SYSTEM',
        severity: 'CRITICAL',
        title: 'High Order Failure Rate',
        message: `${recentFailures} orders failed in the last hour`,
        timestamp: new Date(),
        data: {
          failureCount: recentFailures,
          timeframe: '1 hour'
        }
      });
    }

    return alerts;
  }
}

module.exports = new DashboardController();