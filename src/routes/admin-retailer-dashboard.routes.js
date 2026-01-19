/**
 * Admin Retailer Dashboard Routes
 * 
 * Secure endpoints for viewing retailer data:
 * - Credit balances across all wholesalers
 * - Outstanding orders
 * - Payment history
 * 
 * Authentication: API Key (X-API-Key header)
 * All routes require admin API key with admin scope
 */

const express = require('express');
const router = express.Router();
const { authenticateApiKey, requireScope } = require('../middleware/apiKey.middleware');
const dashboardController = require('../controllers/admin-retailer-dashboard.controller');

// Middleware: All routes require valid API key with admin scope
router.use(authenticateApiKey);
router.use(requireScope('admin'));

// ============================================
// DASHBOARD & OVERVIEW
// ============================================

/**
 * GET /api/v1/admin/retailer-dashboard
 * Get comprehensive dashboard summary for retailer(s)
 * 
 * Query params (all optional):
 * - retailerId: Filter to specific retailer
 * - startDate: ISO format date (e.g., 2024-01-01)
 * - endDate: ISO format date (e.g., 2024-12-31)
 * 
 * Response:
 * {
 *   success: true,
 *   timestamp: ISO timestamp,
 *   totals: {
 *     totalRetailers: number,
 *     totalCreditBalance: decimal,
 *     totalOutstandingOrders: number,
 *     totalOutstandingAmount: decimal,
 *     totalPaymentsProcessed: number,
 *     activeRetailers: number,
 *     pausedRetailers: number
 *   },
 *   retailers: [
 *     {
 *       retailer: {...},
 *       creditBalance: decimal,
 *       creditAccount: {...},
 *       outstandingOrders: [...],
 *       outstandingAmount: decimal,
 *       paymentHistory: [...]
 *     }
 *   ]
 * }
 */
router.get('/dashboard', dashboardController.getRetailerDashboard);

/**
 * GET /api/v1/admin/retailers/overview
 * Get all retailers overview with credit status
 * 
 * Query params:
 * - search: Search by name, phone, email
 * - creditStatus: Filter by ACTIVE, PAUSED, INACTIVE
 * - city: Filter by city
 * - limit: Max results (default: 100)
 * - skip: Pagination offset (default: 0)
 * 
 * Response:
 * {
 *   success: true,
 *   pagination: {...},
 *   totals: {
 *     totalRetailers: number,
 *     activeRetailers: number,
 *     pausedRetailers: number,
 *     totalCreditAllocated: decimal,
 *     totalCreditUsed: decimal
 *   },
 *   retailers: [...]
 * }
 */
router.get('/retailers/overview', dashboardController.getAllRetailersOverview);

// ============================================
// RETAILER-SPECIFIC DATA
// ============================================

/**
 * GET /api/v1/admin/retailers/:retailerId/credit
 * Get detailed credit balance for specific retailer
 * Shows credit account info and per-wholesaler limits
 * 
 * Params:
 * - retailerId: Retailer ID
 * 
 * Response:
 * {
 *   success: true,
 *   retailer: {...},
 *   mainAccount: {
 *     creditLimit: decimal,
 *     usedCredit: decimal,
 *     availableCredit: decimal,
 *     utilizationRate: percentage,
 *     maxOrderValue: decimal,
 *     maxOutstandingDays: number,
 *     updatedAt: timestamp
 *   },
 *   wholesalerCredits: [
 *     {
 *       id: string,
 *       wholesalerId: string,
 *       wholesaler: { companyName, phoneNumber },
 *       creditLimit: decimal,
 *       creditTerms: number,
 *       interestRate: decimal,
 *       isActive: boolean,
 *       blockedReason: string,
 *       availableCredit: decimal
 *     }
 *   ],
 *   creditStatus: enum,
 *   creditPausedAt: timestamp,
 *   creditPauseReason: string
 * }
 */
router.get('/retailers/:retailerId/credit', dashboardController.getRetailerCreditBalance);

/**
 * GET /api/v1/admin/retailers/:retailerId/orders
 * Get outstanding orders for retailer
 * 
 * Params:
 * - retailerId: Retailer ID
 * 
 * Query params:
 * - status: Filter by CREATED, CONFIRMED, IN_TRANSIT, DELIVERED, FAILED
 * - limit: Max results (default: 50)
 * - skip: Pagination offset (default: 0)
 * 
 * Response:
 * {
 *   success: true,
 *   retailer: {...},
 *   pagination: {...},
 *   stats: {
 *     total: number,
 *     byStatus: { CREATED, CONFIRMED, IN_TRANSIT },
 *     totalAmount: decimal,
 *     averageOrderAge: days,
 *     oldestOrderDays: days
 *   },
 *   orders: [
 *     {
 *       id: string,
 *       orderNumber: string,
 *       totalAmount: decimal,
 *       paymentMode: enum,
 *       status: enum,
 *       ageInDays: number,
 *       ageInHours: number,
 *       itemCount: number,
 *       wholesaler: {...},
 *       items: [...]
 *     }
 *   ]
 * }
 */
router.get('/retailers/:retailerId/orders', dashboardController.getRetailerOutstandingOrders);

/**
 * GET /api/v1/admin/retailers/:retailerId/payments
 * Get payment history for retailer
 * 
 * Params:
 * - retailerId: Retailer ID
 * 
 * Query params:
 * - status: Filter by PENDING, CLEARED, FAILED
 * - startDate: ISO format date
 * - endDate: ISO format date
 * - limit: Max results (default: 50)
 * - skip: Pagination offset (default: 0)
 * 
 * Response:
 * {
 *   success: true,
 *   retailer: {...},
 *   pagination: {...},
 *   summary: {
 *     total: number,
 *     totalAmount: decimal,
 *     byStatus: { PENDING, CLEARED, FAILED },
 *     pendingAmount: decimal,
 *     clearedAmount: decimal
 *   },
 *   payments: [
 *     {
 *       id: string,
 *       amount: decimal,
 *       paymentMode: enum,
 *       status: enum,
 *       chequeNumber: string,
 *       chequeDate: date,
 *       bankName: string,
 *       clearedDate: date,
 *       daysOld: number,
 *       isPending: boolean,
 *       isCleared: boolean,
 *       clearancePending: string
 *     }
 *   ]
 * }
 */
router.get('/retailers/:retailerId/payments', dashboardController.getRetailerPaymentHistory);

module.exports = router;
