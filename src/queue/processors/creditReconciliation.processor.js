/**
 * Credit Reconciliation Processor
 * 
 * Reconciles credit accounts and ledger entries
 */

const prisma = require('../../config/database');
const creditService = require('../../services/credit.service');

/**
 * Process credit reconciliation job
 * @param {Job} job - BullMQ job
 * @returns {Promise<object>} - Result
 */
async function processCreditReconciliation(job) {
    const { retailerId, wholesalerId, asOfDate } = job.data;

    try {
        const reconciliationDate = asOfDate ? new Date(asOfDate) : new Date();

        if (retailerId && wholesalerId) {
            // Reconcile specific account
            const calculatedBalance = await creditService.calculateBalance(retailerId, wholesalerId);
            const account = await creditService.getOrCreateCreditAccount(retailerId, wholesalerId);

            // Get last ledger entry balance
            const lastEntry = await prisma.ledgerEntry.findFirst({
                where: {
                    retailerId,
                    wholesalerId
                },
                orderBy: { createdAt: 'desc' },
                select: { balanceAfter: true }
            });

            const storedBalance = lastEntry ? Number(lastEntry.balanceAfter) : 0;
            const discrepancy = Math.abs(calculatedBalance - storedBalance);

            return {
                success: true,
                retailerId,
                wholesalerId,
                calculatedBalance,
                storedBalance,
                discrepancy,
                isReconciled: discrepancy < 0.01, // Allow 0.01 rounding difference
                timestamp: new Date().toISOString()
            };
        } else {
            // Reconcile all accounts
            const accounts = await prisma.retailerWholesalerCredit.findMany({
                where: { isActive: true },
                select: {
                    retailerId: true,
                    wholesalerId: true
                }
            });

            const reconciliations = await Promise.all(
                accounts.map(async (account) => {
                    const calculatedBalance = await creditService.calculateBalance(
                        account.retailerId,
                        account.wholesalerId
                    );

                    const lastEntry = await prisma.ledgerEntry.findFirst({
                        where: {
                            retailerId: account.retailerId,
                            wholesalerId: account.wholesalerId
                        },
                        orderBy: { createdAt: 'desc' },
                        select: { balanceAfter: true }
                    });

                    const storedBalance = lastEntry ? Number(lastEntry.balanceAfter) : 0;
                    const discrepancy = Math.abs(calculatedBalance - storedBalance);

                    return {
                        retailerId: account.retailerId,
                        wholesalerId: account.wholesalerId,
                        calculatedBalance,
                        storedBalance,
                        discrepancy,
                        isReconciled: discrepancy < 0.01
                    };
                })
            );

            const unreconciled = reconciliations.filter(r => !r.isReconciled);

            return {
                success: true,
                totalAccounts: reconciliations.length,
                reconciled: reconciliations.length - unreconciled.length,
                unreconciled: unreconciled.length,
                unreconciledAccounts: unreconciled,
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        console.error('Error processing credit reconciliation:', error);
        throw error;
    }
}

module.exports = processCreditReconciliation;
