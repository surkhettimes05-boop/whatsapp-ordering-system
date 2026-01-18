/**
 * Credit System Controllers
 * 
 * Endpoints for:
 * - Credit limit checks
 * - Balance queries
 * - Daily exposure reports
 * - Ledger entry management
 */

const creditService = require('../services/credit.service');
const prisma = require('../config/database');

class CreditController {
    /**
     * Get current balance for retailer-wholesaler pair
     * GET /api/credit/balance/:retailerId/:wholesalerId
     */
    async getBalance(req, res) {
        try {
            const { retailerId, wholesalerId } = req.params;

            const balance = await creditService.calculateBalance(retailerId, wholesalerId);
            const account = await creditService.getOrCreateCreditAccount(retailerId, wholesalerId);

            res.json({
                retailerId,
                wholesalerId,
                balance,
                creditLimit: Number(account.creditLimit),
                availableCredit: Number(account.creditLimit) - balance,
                utilizationPercent: account.creditLimit > 0 
                    ? (balance / Number(account.creditLimit)) * 100 
                    : 0,
                isActive: account.isActive
            });
        } catch (error) {
            console.error('Error getting balance:', error);
            res.status(500).json({
                error: 'Failed to get balance',
                message: error.message
            });
        }
    }

    /**
     * Check credit limit before order
     * POST /api/credit/check-limit
     * Body: { retailerId, wholesalerId, orderAmount }
     */
    async checkLimit(req, res) {
        try {
            const { retailerId, wholesalerId, orderAmount } = req.body;

            if (!retailerId || !wholesalerId || !orderAmount) {
                return res.status(400).json({
                    error: 'Missing required fields: retailerId, wholesalerId, orderAmount'
                });
            }

            const result = await creditService.checkCreditLimit(
                retailerId,
                wholesalerId,
                Number(orderAmount)
            );

            res.json(result);
        } catch (error) {
            console.error('Error checking credit limit:', error);
            res.status(500).json({
                error: 'Failed to check credit limit',
                message: error.message
            });
        }
    }

    /**
     * Get daily exposure report for wholesaler
     * GET /api/credit/exposure/:wholesalerId
     * Query: ?date=2024-01-15 (optional, defaults to today)
     */
    async getExposureReport(req, res) {
        try {
            const { wholesalerId } = req.params;
            const { date } = req.query;

            const asOfDate = date ? new Date(date) : new Date();
            const report = await creditService.getDailyExposureReport(wholesalerId, asOfDate);
            const summary = await creditService.getExposureSummary(wholesalerId, asOfDate);

            res.json({
                summary,
                details: report
            });
        } catch (error) {
            console.error('Error getting exposure report:', error);
            res.status(500).json({
                error: 'Failed to get exposure report',
                message: error.message
            });
        }
    }

    /**
     * Create ledger entry (admin only)
     * POST /api/credit/ledger-entry
     * Body: { retailerId, wholesalerId, entryType, amount, orderId?, dueDate?, reason? }
     */
    async createLedgerEntry(req, res) {
        try {
            const {
                retailerId,
                wholesalerId,
                entryType,
                amount,
                orderId,
                dueDate,
                reason
            } = req.body;

            if (!retailerId || !wholesalerId || !entryType || !amount) {
                return res.status(400).json({
                    error: 'Missing required fields: retailerId, wholesalerId, entryType, amount'
                });
            }

            if (!['DEBIT', 'CREDIT', 'ADJUSTMENT', 'REVERSAL'].includes(entryType)) {
                return res.status(400).json({
                    error: 'Invalid entryType. Must be: DEBIT, CREDIT, ADJUSTMENT, or REVERSAL'
                });
            }

            const entry = await creditService.createLedgerEntry(
                retailerId,
                wholesalerId,
                entryType,
                Number(amount),
                {
                    orderId,
                    dueDate: dueDate ? new Date(dueDate) : null,
                    createdBy: req.user?.role === 'ADMIN' ? 'ADMIN' : 'SYSTEM',
                    reason
                }
            );

            res.json({
                success: true,
                entry
            });
        } catch (error) {
            console.error('Error creating ledger entry:', error);
            res.status(500).json({
                error: 'Failed to create ledger entry',
                message: error.message
            });
        }
    }

    /**
     * Get credit account details
     * GET /api/credit/account/:retailerId/:wholesalerId
     */
    async getCreditAccount(req, res) {
        try {
            const { retailerId, wholesalerId } = req.params;

            const account = await creditService.getOrCreateCreditAccount(retailerId, wholesalerId);
            const balance = await creditService.calculateBalance(retailerId, wholesalerId);

            res.json({
                account,
                balance,
                availableCredit: Number(account.creditLimit) - balance
            });
        } catch (error) {
            console.error('Error getting credit account:', error);
            res.status(500).json({
                error: 'Failed to get credit account',
                message: error.message
            });
        }
    }

    /**
     * Update credit limit (admin only)
     * PUT /api/credit/account/:retailerId/:wholesalerId
     * Body: { creditLimit, creditTerms?, interestRate? }
     */
    async updateCreditAccount(req, res) {
        try {
            const { retailerId, wholesalerId } = req.params;
            const { creditLimit, creditTerms, interestRate, isActive, blockedReason } = req.body;

            const account = await prisma.retailerWholesalerCredit.update({
                where: {
                    retailerId_wholesalerId: {
                        retailerId,
                        wholesalerId
                    }
                },
                data: {
                    ...(creditLimit !== undefined && { creditLimit: Number(creditLimit) }),
                    ...(creditTerms !== undefined && { creditTerms: Number(creditTerms) }),
                    ...(interestRate !== undefined && { interestRate: Number(interestRate) }),
                    ...(isActive !== undefined && { isActive: Boolean(isActive) }),
                    ...(blockedReason !== undefined && { blockedReason }),
                    ...(isActive === false && { blockedAt: new Date() }),
                    ...(isActive === true && { blockedAt: null })
                }
            });

            res.json({
                success: true,
                account
            });
        } catch (error) {
            console.error('Error updating credit account:', error);
            res.status(500).json({
                error: 'Failed to update credit account',
                message: error.message
            });
        }
    }
}

module.exports = new CreditController();
