/**
 * Admin Retailer Dashboard Controller
 * 
 * Provides comprehensive dashboard views for retailers showing:
 * - Credit balances across wholesalers
 * - Outstanding orders
 * - Payment history
 * 
 * Secured with API key authentication
 */

const prisma = require('../config/database');
const logger = require('../config/winston-logger').logger;

class AdminRetailerDashboardController {
  /**
   * Get retailer dashboard summary
   * Shows credit balance, outstanding orders, and payment summary
   * 
   * Query params:
   * - retailerId: Filter by specific retailer (optional)
   * - startDate: Filter payments from date (ISO format)
   * - endDate: Filter payments to date (ISO format)
   * 
   * Response: Aggregated dashboard data
   */
  async getRetailerDashboard(req, res) {
    try {
      const { retailerId, startDate, endDate } = req.query;

      // If retailerId is specified, get data for that retailer
      // Otherwise, get summary for all retailers
      const filters = {};
      if (retailerId) {
        filters.id = retailerId;
      }

      // Fetch retailers
      const retailers = await prisma.retailer.findMany({
        where: {
          ...filters,
          deletedAt: null // Exclude soft-deleted retailers
        },
        select: {
          id: true,
          pasalName: true,
          ownerName: true,
          phoneNumber: true,
          email: true,
          city: true,
          district: true,
          creditStatus: true,
          createdAt: true
        }
      });

      if (retailers.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No retailers found'
        });
      }

      // Build dashboard data for each retailer
      const dashboardData = await Promise.all(
        retailers.map(retailer =>
          this._buildRetailerDashboard(retailer, startDate, endDate)
        )
      );

      // Calculate totals across all retailers
      const totals = {
        totalRetailers: dashboardData.length,
        totalCreditBalance: dashboardData.reduce((sum, d) => sum + d.creditBalance, 0),
        totalOutstandingOrders: dashboardData.reduce((sum, d) => sum + d.outstandingOrders.length, 0),
        totalOutstandingAmount: dashboardData.reduce((sum, d) => sum + d.outstandingAmount, 0),
        totalPaymentsProcessed: dashboardData.reduce((sum, d) => sum + d.paymentHistory.length, 0),
        activeRetailers: dashboardData.filter(d => d.creditStatus === 'ACTIVE').length,
        pausedRetailers: dashboardData.filter(d => d.creditStatus === 'PAUSED').length
      };

      res.json({
        success: true,
        timestamp: new Date(),
        totals,
        retailers: dashboardData
      });
    } catch (error) {
      logger.error('Get retailer dashboard error:', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard'
      });
    }
  }

  /**
   * Get detailed retailer credit balance
   * Shows credit account info and per-wholesaler credit limits
   * 
   * Params:
   * - retailerId: Retailer ID
   * 
   * Response: Credit account details with wholesaler-specific credits
   */
  async getRetailerCreditBalance(req, res) {
    try {
      const { retailerId } = req.params;

      // Verify retailer exists
      const retailer = await prisma.retailer.findUnique({
        where: { id: retailerId },
        select: {
          id: true,
          pasalName: true,
          phoneNumber: true,
          creditStatus: true,
          creditPausedAt: true,
          creditPauseReason: true
        }
      });

      if (!retailer) {
        return res.status(404).json({
          success: false,
          error: 'Retailer not found'
        });
      }

      // Get main credit account
      const creditAccount = await prisma.creditAccount.findUnique({
        where: { retailerId },
        select: {
          creditLimit: true,
          usedCredit: true,
          maxOrderValue: true,
          maxOutstandingDays: true,
          updatedAt: true
        }
      });

      // Get credit with each wholesaler
      const wholesalerCredits = await prisma.retailerWholesalerCredit.findMany({
        where: { retailerId },
        select: {
          id: true,
          wholesalerId: true,
          creditLimit: true,
          creditTerms: true,
          interestRate: true,
          isActive: true,
          blockedReason: true,
          blockedAt: true,
          updatedAt: true
        }
      });

      // Get wholesaler names for credits
      const wholesalerIds = wholesalerCredits.map(c => c.wholesalerId);
      const wholesalers = await prisma.wholesaler.findMany({
        where: { id: { in: wholesalerIds } },
        select: {
          id: true,
          companyName: true,
          phoneNumber: true
        }
      });

      const wholesalerMap = Object.fromEntries(
        wholesalers.map(w => [w.id, { companyName: w.companyName, phoneNumber: w.phoneNumber }])
      );

      // Enrich wholesaler credits with company info
      const enrichedWholesalerCredits = wholesalerCredits.map(credit => ({
        ...credit,
        wholesaler: wholesalerMap[credit.wholesalerId],
        availableCredit: credit.creditLimit - (credit.creditLimit * 0.3) // Mock calculation
      }));

      const availableCredit = creditAccount
        ? creditAccount.creditLimit - creditAccount.usedCredit
        : 0;

      res.json({
        success: true,
        retailer,
        mainAccount: {
          creditLimit: creditAccount?.creditLimit || 0,
          usedCredit: creditAccount?.usedCredit || 0,
          availableCredit,
          utilizationRate: creditAccount
            ? ((creditAccount.usedCredit / creditAccount.creditLimit) * 100).toFixed(2)
            : 0,
          maxOrderValue: creditAccount?.maxOrderValue || 0,
          maxOutstandingDays: creditAccount?.maxOutstandingDays || 30,
          updatedAt: creditAccount?.updatedAt
        },
        wholesalerCredits: enrichedWholesalerCredits,
        creditStatus: retailer.creditStatus,
        creditPausedAt: retailer.creditPausedAt,
        creditPauseReason: retailer.creditPauseReason
      });
    } catch (error) {
      logger.error('Get retailer credit balance error:', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch credit balance'
      });
    }
  }

  /**
   * Get retailer outstanding orders
   * Shows all pending, confirmed, and unfulfilled orders
   * 
   * Params:
   * - retailerId: Retailer ID
   * 
   * Query params:
   * - status: Filter by order status (CREATED, CONFIRMED, IN_TRANSIT, DELIVERED, FAILED)
   * - limit: Max results (default: 50)
   * - skip: Pagination offset (default: 0)
   * 
   * Response: List of orders with status and details
   */
  async getRetailerOutstandingOrders(req, res) {
    try {
      const { retailerId } = req.params;
      const { status, limit = 50, skip = 0 } = req.query;

      // Verify retailer exists
      const retailer = await prisma.retailer.findUnique({
        where: { id: retailerId },
        select: { id: true, pasalName: true }
      });

      if (!retailer) {
        return res.status(404).json({
          success: false,
          error: 'Retailer not found'
        });
      }

      // Build order filters
      const orderFilters = {
        retailerId,
        deletedAt: null
      };

      // Filter by status if provided
      if (status) {
        orderFilters.status = status;
      } else {
        // Default: show non-completed orders
        orderFilters.status = {
          in: ['CREATED', 'CONFIRMED', 'IN_TRANSIT']
        };
      }

      // Fetch orders
      const [orders, totalCount] = await Promise.all([
        prisma.order.findMany({
          where: orderFilters,
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            paymentMode: true,
            status: true,
            createdAt: true,
            confirmedAt: true,
            deliveredAt: true,
            wholesaler: {
              select: {
                id: true,
                companyName: true,
                phoneNumber: true
              }
            },
            items: {
              select: {
                id: true,
                productName: true,
                quantity: true,
                unitPrice: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: parseInt(limit),
          skip: parseInt(skip)
        }),
        prisma.order.count({ where: orderFilters })
      ]);

      // Calculate age of each order
      const enrichedOrders = orders.map(order => {
        const ageMs = Date.now() - new Date(order.createdAt).getTime();
        const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
        const ageHours = Math.floor((ageMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        return {
          ...order,
          ageInDays: ageDays,
          ageInHours: ageHours,
          age: `${ageDays}d ${ageHours}h`,
          itemCount: order.items.length,
          items: order.items
        };
      });

      // Calculate stats
      const stats = {
        total: totalCount,
        byStatus: {
          CREATED: orders.filter(o => o.status === 'CREATED').length,
          CONFIRMED: orders.filter(o => o.status === 'CONFIRMED').length,
          IN_TRANSIT: orders.filter(o => o.status === 'IN_TRANSIT').length
        },
        totalAmount: orders.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0),
        averageOrderAge: enrichedOrders.length > 0
          ? Math.round(enrichedOrders.reduce((sum, o) => sum + o.ageInDays, 0) / enrichedOrders.length)
          : 0,
        oldestOrderDays: enrichedOrders.length > 0
          ? Math.max(...enrichedOrders.map(o => o.ageInDays))
          : 0
      };

      res.json({
        success: true,
        retailer,
        pagination: {
          skip: parseInt(skip),
          limit: parseInt(limit),
          total: totalCount,
          hasMore: parseInt(skip) + parseInt(limit) < totalCount
        },
        stats,
        orders: enrichedOrders
      });
    } catch (error) {
      logger.error('Get outstanding orders error:', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch outstanding orders'
      });
    }
  }

  /**
   * Get retailer payment history
   * Shows all payments made by the retailer
   * 
   * Params:
   * - retailerId: Retailer ID
   * 
   * Query params:
   * - status: Filter by payment status (PENDING, CLEARED, FAILED)
   * - startDate: Filter from date (ISO format)
   * - endDate: Filter to date (ISO format)
   * - limit: Max results (default: 50)
   * - skip: Pagination offset (default: 0)
   * 
   * Response: Payment history with details
   */
  async getRetailerPaymentHistory(req, res) {
    try {
      const { retailerId } = req.params;
      const { status, startDate, endDate, limit = 50, skip = 0 } = req.query;

      // Verify retailer exists
      const retailer = await prisma.retailer.findUnique({
        where: { id: retailerId },
        select: { id: true, pasalName: true }
      });

      if (!retailer) {
        return res.status(404).json({
          success: false,
          error: 'Retailer not found'
        });
      }

      // Build filters
      const paymentFilters = { retailerId };

      if (status) {
        paymentFilters.status = status;
      }

      if (startDate || endDate) {
        paymentFilters.createdAt = {};
        if (startDate) paymentFilters.createdAt.gte = new Date(startDate);
        if (endDate) paymentFilters.createdAt.lte = new Date(endDate);
      }

      // Fetch payments
      const [payments, totalCount] = await Promise.all([
        prisma.retailerPayment.findMany({
          where: paymentFilters,
          select: {
            id: true,
            amount: true,
            paymentMode: true,
            status: true,
            chequeNumber: true,
            chequeDate: true,
            bankName: true,
            clearedDate: true,
            notes: true,
            recordedAt: true,
            createdAt: true,
            wholesaler: {
              select: {
                id: true,
                companyName: true,
                phoneNumber: true
              }
            },
            ledgerEntry: {
              select: {
                entryType: true,
                orderId: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: parseInt(limit),
          skip: parseInt(skip)
        }),
        prisma.retailerPayment.count({ where: paymentFilters })
      ]);

      // Enrich payment data
      const enrichedPayments = payments.map(payment => {
        const daysOld = Math.floor(
          (Date.now() - new Date(payment.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          ...payment,
          daysOld,
          isPending: payment.status === 'PENDING',
          isCleared: payment.status === 'CLEARED',
          isFailed: payment.status === 'FAILED',
          clearancePending: payment.status === 'PENDING'
            ? `${Math.ceil((14 - daysOld).toFixed(0))} days`
            : null
        };
      });

      // Calculate summary
      const summary = {
        total: totalCount,
        totalAmount: payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
        byStatus: {
          PENDING: payments.filter(p => p.status === 'PENDING').length,
          CLEARED: payments.filter(p => p.status === 'CLEARED').length,
          FAILED: payments.filter(p => p.status === 'FAILED').length
        },
        pendingAmount: payments
          .filter(p => p.status === 'PENDING')
          .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
        clearedAmount: payments
          .filter(p => p.status === 'CLEARED')
          .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
      };

      res.json({
        success: true,
        retailer,
        pagination: {
          skip: parseInt(skip),
          limit: parseInt(limit),
          total: totalCount,
          hasMore: parseInt(skip) + parseInt(limit) < totalCount
        },
        summary,
        payments: enrichedPayments
      });
    } catch (error) {
      logger.error('Get payment history error:', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch payment history'
      });
    }
  }

  /**
   * Get all retailers list for admin overview
   * 
   * Query params:
   * - search: Search by name, phone, email
   * - creditStatus: Filter by credit status
   * - city: Filter by city
   * - limit: Max results (default: 100)
   * - skip: Pagination offset (default: 0)
   * 
   * Response: Retailers with their current credit status
   */
  async getAllRetailersOverview(req, res) {
    try {
      const { search, creditStatus, city, limit = 100, skip = 0 } = req.query;

      // Build filters
      const filters = { deletedAt: null };

      if (search) {
        filters.OR = [
          { pasalName: { contains: search, mode: 'insensitive' } },
          { ownerName: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (creditStatus) {
        filters.creditStatus = creditStatus;
      }

      if (city) {
        filters.city = city;
      }

      // Fetch retailers with credit info
      const [retailers, totalCount] = await Promise.all([
        prisma.retailer.findMany({
          where: filters,
          select: {
            id: true,
            pasalName: true,
            ownerName: true,
            phoneNumber: true,
            city: true,
            creditStatus: true,
            creditPausedAt: true,
            createdAt: true,
            credit: {
              select: {
                creditLimit: true,
                usedCredit: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: parseInt(limit),
          skip: parseInt(skip)
        }),
        prisma.retailer.count({ where: filters })
      ]);

      // Enrich with calculated fields
      const enrichedRetailers = retailers.map(retailer => ({
        ...retailer,
        availableCredit: retailer.credit
          ? retailer.credit.creditLimit - retailer.credit.usedCredit
          : 0,
        utilizationRate: retailer.credit
          ? ((retailer.credit.usedCredit / retailer.credit.creditLimit) * 100).toFixed(2)
          : 0
      }));

      // Calculate totals
      const totals = {
        totalRetailers: totalCount,
        activeRetailers: retailers.filter(r => r.creditStatus === 'ACTIVE').length,
        pausedRetailers: retailers.filter(r => r.creditStatus === 'PAUSED').length,
        totalCreditAllocated: retailers.reduce((sum, r) => sum + (r.credit?.creditLimit || 0), 0),
        totalCreditUsed: retailers.reduce((sum, r) => sum + (r.credit?.usedCredit || 0), 0)
      };

      res.json({
        success: true,
        pagination: {
          skip: parseInt(skip),
          limit: parseInt(limit),
          total: totalCount,
          hasMore: parseInt(skip) + parseInt(limit) < totalCount
        },
        totals,
        retailers: enrichedRetailers
      });
    } catch (error) {
      logger.error('Get retailers overview error:', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch retailers overview'
      });
    }
  }

  /**
   * Build dashboard data for a single retailer
   * @private
   */
  async _buildRetailerDashboard(retailer, startDate, endDate) {
    try {
      // Get credit account
      const creditAccount = await prisma.creditAccount.findUnique({
        where: { retailerId: retailer.id },
        select: { creditLimit: true, usedCredit: true }
      });

      const creditBalance = creditAccount
        ? creditAccount.creditLimit - creditAccount.usedCredit
        : 0;

      // Get outstanding orders
      const outstandingOrders = await prisma.order.findMany({
        where: {
          retailerId: retailer.id,
          status: { in: ['CREATED', 'CONFIRMED', 'IN_TRANSIT'] },
          deletedAt: null
        },
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true
        }
      });

      const outstandingAmount = outstandingOrders.reduce(
        (sum, o) => sum + parseFloat(o.totalAmount || 0),
        0
      );

      // Get payment history
      const paymentFilters = { retailerId: retailer.id };
      if (startDate || endDate) {
        paymentFilters.createdAt = {};
        if (startDate) paymentFilters.createdAt.gte = new Date(startDate);
        if (endDate) paymentFilters.createdAt.lte = new Date(endDate);
      }

      const paymentHistory = await prisma.retailerPayment.findMany({
        where: paymentFilters,
        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      return {
        retailer,
        creditBalance,
        creditAccount: {
          creditLimit: creditAccount?.creditLimit || 0,
          usedCredit: creditAccount?.usedCredit || 0
        },
        outstandingOrders,
        outstandingAmount,
        paymentHistory
      };
    } catch (error) {
      logger.error('Error building retailer dashboard:', { error: error.message });
      return {
        retailer,
        creditBalance: 0,
        creditAccount: { creditLimit: 0, usedCredit: 0 },
        outstandingOrders: [],
        outstandingAmount: 0,
        paymentHistory: []
      };
    }
  }
}

module.exports = new AdminRetailerDashboardController();
