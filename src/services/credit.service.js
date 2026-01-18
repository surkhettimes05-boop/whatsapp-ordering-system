/**
 * Fintech-Grade Credit System
 * 
 * Features:
 * - CreditAccount per retailer-wholesaler pair
 * - Immutable CreditLedger entries
 * - Balance calculated from ledger (not stored)
 * - Credit limit enforcement
 * - Daily exposure reports
 */

const prisma = require('../config/database');
const { withTransaction } = require('../utils/transaction');

class CreditService {
    /**
     * Calculate current balance from ledger entries (not stored)
     * Positive balance = retailer owes money (DEBIT > CREDIT)
     * Negative balance = retailer has credit (CREDIT > DEBIT)
     * 
     * @param {string} retailerId
     * @param {string} wholesalerId
     * @returns {Promise<number>} Current balance
     */
    async calculateBalance(retailerId, wholesalerId) {
        const entries = await prisma.ledgerEntry.findMany({
            where: {
                retailerId,
                wholesalerId
            },
            orderBy: {
                createdAt: 'asc' // Process in chronological order
            },
            select: {
                entryType: true,
                amount: true
            }
        });

        let balance = 0;
        for (const entry of entries) {
            const amount = Number(entry.amount);

            switch (entry.entryType) {
                case 'DEBIT':
                    balance += amount;
                    break;
                case 'CREDIT':
                    balance -= amount;
                    break;
                case 'ADJUSTMENT':
                    // Adjustment can be positive (increase debt) or negative (decrease debt)
                    balance += amount;
                    break;
                case 'REVERSAL':
                    // Reversal negates a previous entry
                    // We need to find and reverse the original entry
                    // For now, treat as negative adjustment
                    balance -= amount;
                    break;
            }
        }

        return balance;
    }

    /**
     * Get credit account for retailer-wholesaler pair
     * Creates if doesn't exist
     * 
     * @param {string} retailerId
     * @param {string} wholesalerId
     * @returns {Promise<Object>} Credit account
     */
    async getOrCreateCreditAccount(retailerId, wholesalerId) {
        let account = await prisma.retailerWholesalerCredit.findUnique({
            where: {
                retailerId_wholesalerId: {
                    retailerId,
                    wholesalerId
                }
            }
        });

        if (!account) {
            account = await prisma.retailerWholesalerCredit.create({
                data: {
                    retailerId,
                    wholesalerId,
                    creditLimit: 0, // Default, should be set by admin
                    creditTerms: 30,
                    interestRate: 0,
                    isActive: true
                }
            });
        }

        return account;
    }

    /**
     * Check if retailer can place order (credit limit check)
     * 
     * @param {string} retailerId
     * @param {string} wholesalerId
     * @param {number} orderAmount
     * @returns {Promise<{canPlace: boolean, reason?: string, currentBalance: number, creditLimit: number, availableCredit: number}>}
     */
    async checkCreditLimit(retailerId, wholesalerId, orderAmount, tx = null) {
        const db = tx || prisma;

        // Lock credit account row to ensure atomic balance calculation
        // This prevents concurrent orders from seeing the same balance
        const account = await db.$queryRaw`
            SELECT * FROM "RetailerWholesalerCredit"
            WHERE "retailerId" = ${retailerId} AND "wholesalerId" = ${wholesalerId}
            LIMIT 1
            FOR UPDATE
        `;

            // (debug logging removed)

        if (!account || account.length === 0) {
            return { canPlace: false, reason: 'Credit account not found' };
        }

        const creditAccount = account[0];

        // Calculate current balance from ledger using the SAME transaction
        const entries = await db.ledgerEntry.findMany({
            where: { retailerId, wholesalerId },
            select: { entryType: true, amount: true }
        });

        let currentBalance = 0;
        for (const entry of entries) {
            const amount = Number(entry.amount);
            if (entry.entryType === 'DEBIT' || entry.entryType === 'ADJUSTMENT') currentBalance += amount;
            else if (entry.entryType === 'CREDIT' || entry.entryType === 'REVERSAL') currentBalance -= amount;
        }

        const creditLimit = Number(creditAccount.creditLimit);
        const availableCredit = creditLimit - currentBalance;
        const projectedBalance = currentBalance + Number(orderAmount);

        // DEBUG: log computed values to help tests diagnose failures
            // (debug logging removed)

        // First check projected balance exceeds limit
        if (projectedBalance > creditLimit) {
            return {
                canPlace: false,
                reason: `Credit limit exceeded. Current balance: Rs.${currentBalance.toFixed(2)}, Credit limit: Rs.${creditLimit.toFixed(2)}, Order amount: Rs.${orderAmount.toFixed(2)}`,
                currentBalance,
                creditLimit,
                availableCredit
            };
        }

        // Then check if account is active; blocked accounts cannot place even if under limit
        if (creditAccount.isActive === false) {
            return {
                canPlace: false,
                reason: `Credit account is blocked: ${creditAccount.blockedReason || 'No reason provided'}`,
                currentBalance,
                creditLimit,
                availableCredit
            };
        }

        return {
            canPlace: true,
            currentBalance,
            creditLimit,
            availableCredit: availableCredit - Number(orderAmount),
            projectedBalance
        };
    }

    /**
     * Create ledger entry (immutable)
     * 
     * @param {string} retailerId
     * @param {string} wholesalerId
     * @param {string} entryType - DEBIT, CREDIT, ADJUSTMENT, REVERSAL
     * @param {number} amount
     * @param {object} options
     * @param {string} options.orderId - Optional order ID
     * @param {Date} options.dueDate - Optional due date
     * @param {string} options.createdBy - SYSTEM or ADMIN
     * @param {string} options.referenceId - ID of entry being reversed (for REVERSAL)
     * @param {string} options.reason - Reason for adjustment/reversal
     * @returns {Promise<Object>} Created ledger entry
     */
    async createLedgerEntry(retailerId, wholesalerId, entryType, amount, options = {}) {
        const {
            orderId = null,
            dueDate = null,
            createdBy = 'SYSTEM',
            referenceId = null,
            reason = null
        } = options;

        if (amount <= 0) {
            throw new Error('Amount must be positive');
        }

        return withTransaction(async (tx) => {
            // Lock credit account row
            await tx.$queryRaw`
                SELECT 1 FROM retailer_wholesaler_credits
                WHERE "retailerId" = ${retailerId} AND "wholesalerId" = ${wholesalerId}
                FOR UPDATE
            `;

            // Calculate current balance from all entries
            const entries = await tx.ledgerEntry.findMany({
                where: {
                    retailerId,
                    wholesalerId
                },
                orderBy: { createdAt: 'asc' },
                select: {
                    entryType: true,
                    amount: true
                }
            });

            let currentBalance = 0;
            for (const entry of entries) {
                const entryAmount = Number(entry.amount);
                switch (entry.entryType) {
                    case 'DEBIT':
                        currentBalance += entryAmount;
                        break;
                    case 'CREDIT':
                        currentBalance -= entryAmount;
                        break;
                    case 'ADJUSTMENT':
                        currentBalance += entryAmount;
                        break;
                    case 'REVERSAL':
                        currentBalance -= entryAmount;
                        break;
                }
            }

            // Calculate new balance based on entry type
            let newBalance = currentBalance;
            const entryAmount = Number(amount);

            switch (entryType) {
                case 'DEBIT':
                    newBalance = currentBalance + entryAmount;
                    break;
                case 'CREDIT':
                    newBalance = currentBalance - entryAmount;
                    break;
                case 'ADJUSTMENT':
                    // Adjustment can be positive or negative
                    newBalance = currentBalance + entryAmount;
                    break;
                case 'REVERSAL':
                    // Reversal negates a previous entry
                    if (referenceId) {
                        const originalEntry = await tx.ledgerEntry.findUnique({
                            where: { id: referenceId }
                        });
                        if (!originalEntry) {
                            throw new Error(`Original entry ${referenceId} not found for reversal`);
                        }
                        // Reverse the original entry's effect
                        const originalAmount = Number(originalEntry.amount);
                        if (originalEntry.entryType === 'DEBIT') {
                            newBalance = currentBalance - originalAmount;
                        } else if (originalEntry.entryType === 'CREDIT') {
                            newBalance = currentBalance + originalAmount;
                        } else {
                            newBalance = currentBalance - originalAmount;
                        }
                    } else {
                        // Simple reversal (decrease balance)
                        newBalance = currentBalance - entryAmount;
                    }
                    break;
            }

            // Create immutable ledger entry
            const entry = await tx.ledgerEntry.create({
                data: {
                    retailerId,
                    wholesalerId,
                    orderId,
                    entryType,
                    amount: entryAmount,
                    balanceAfter: newBalance, // Stored for performance, but calculated from entries
                    dueDate: dueDate ? new Date(dueDate) : null,
                    createdBy,
                    // Store metadata in a JSON field if available, or use reason field
                }
            });

            return entry;
        }, {
            operation: 'CREATE_LEDGER_ENTRY',
            entityId: orderId || `${retailerId}-${wholesalerId}`,
            entityType: 'LedgerEntry',
            timeout: 10000
        });
    }

    /**
     * Get daily exposure report for a wholesaler
     * Shows all retailers' outstanding balances with that wholesaler
     * 
     * @param {string} wholesalerId
     * @param {Date} asOfDate - Date to calculate exposure as of (default: today)
     * @returns {Promise<Array>} Exposure report
     */
    async getDailyExposureReport(wholesalerId, asOfDate = new Date()) {
        // Get all active credit accounts for this wholesaler
        const accounts = await prisma.retailerWholesalerCredit.findMany({
            where: {
                wholesalerId,
                isActive: true
            },
            include: {
                retailer: {
                    select: {
                        id: true,
                        pasalName: true,
                        ownerName: true,
                        phoneNumber: true,
                        city: true
                    }
                }
            }
        });

        const report = [];

        for (const account of accounts) {
            // Calculate balance as of the specified date
            const entries = await prisma.ledgerEntry.findMany({
                where: {
                    retailerId: account.retailerId,
                    wholesalerId: account.wholesalerId,
                    createdAt: {
                        lte: asOfDate
                    }
                },
                orderBy: {
                    createdAt: 'asc'
                },
                select: {
                    entryType: true,
                    amount: true,
                    dueDate: true
                }
            });

            let balance = 0;
            let overdueAmount = 0;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (const entry of entries) {
                const amount = Number(entry.amount);

                switch (entry.entryType) {
                    case 'DEBIT':
                        balance += amount;
                        // Check if overdue
                        if (entry.dueDate && new Date(entry.dueDate) < today) {
                            overdueAmount += amount;
                        }
                        break;
                    case 'CREDIT':
                        balance -= amount;
                        break;
                    case 'ADJUSTMENT':
                        balance += amount;
                        break;
                    case 'REVERSAL':
                        balance -= amount;
                        break;
                }
            }

            if (balance > 0) { // Only include retailers with outstanding balance
                report.push({
                    retailerId: account.retailerId,
                    retailerName: account.retailer.pasalName || account.retailer.ownerName || 'Unknown',
                    phoneNumber: account.retailer.phoneNumber,
                    city: account.retailer.city,
                    creditLimit: Number(account.creditLimit),
                    currentBalance: balance,
                    overdueAmount: overdueAmount,
                    availableCredit: Number(account.creditLimit) - balance,
                    utilizationPercent: account.creditLimit > 0
                        ? (balance / Number(account.creditLimit)) * 100
                        : 0,
                    creditTerms: account.creditTerms,
                    isBlocked: !account.isActive,
                    blockedReason: account.blockedReason
                });
            }
        }

        // Sort by balance (highest first)
        report.sort((a, b) => b.currentBalance - a.currentBalance);

        return report;
    }

    /**
     * Get summary exposure for wholesaler
     * 
     * @param {string} wholesalerId
     * @param {Date} asOfDate
     * @returns {Promise<Object>} Summary statistics
     */
    async getExposureSummary(wholesalerId, asOfDate = new Date()) {
        const report = await this.getDailyExposureReport(wholesalerId, asOfDate);

        const totalExposure = report.reduce((sum, r) => sum + r.currentBalance, 0);
        const totalOverdue = report.reduce((sum, r) => sum + r.overdueAmount, 0);
        const totalCreditLimit = report.reduce((sum, r) => sum + r.creditLimit, 0);
        const averageUtilization = report.length > 0
            ? report.reduce((sum, r) => sum + r.utilizationPercent, 0) / report.length
            : 0;

        return {
            wholesalerId,
            asOfDate,
            totalRetailers: report.length,
            totalExposure,
            totalOverdue,
            totalCreditLimit,
            totalAvailableCredit: totalCreditLimit - totalExposure,
            averageUtilizationPercent: averageUtilization,
            retailersAtLimit: report.filter(r => r.utilizationPercent >= 100).length,
            retailersOverdue: report.filter(r => r.overdueAmount > 0).length
        };
    }
}

module.exports = new CreditService();
