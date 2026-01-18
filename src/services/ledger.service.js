const prisma = require('../config/database');
const { withTransaction } = require('../utils/transaction');

class LedgerService {
    /**
     * Get the current outstanding balance for a retailer with a specific wholesaler.
     * Positive balance means retailer owes money (Debit > Credit).
     * @param {string} retailerId
     * @param {string} wholesalerId
     * @returns {Promise<number>}
     */
    async getBalance(retailerId, wholesalerId) {
        const lastEntry = await prisma.ledgerEntry.findFirst({
            where: {
                retailerId,
                wholesalerId,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        // If no entries, balance is 0.
        return lastEntry ? Number(lastEntry.balanceAfter) : 0;
    }

    /**
     * Create a DEBIT entry (Retailer OWES more).
     * Typically when an order is delivered.
     * @param {string} orderId
     * @param {number} amount
     * @param {Date|string} dueDate
     * @returns {Promise<Object>} The created LedgerEntry
     */
    async createDebit(orderId, amount, dueDate) {
        if (!orderId) throw new Error("Order ID is required for Debit");
        if (amount <= 0) throw new Error("Amount must be positive");

        // Fetch Order to get retailer and wholesaler
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { retailerId: true, wholesalerId: true }
        });

        if (!order) throw new Error(`Order ${orderId} not found`);
        if (!order.wholesalerId) throw new Error(`Order ${orderId} has no wholesaler assigned`);

        const { retailerId, wholesalerId } = order;

        return withTransaction(async (tx) => {
            // LOCKING: Prevent race conditions by locking the Credit Relationship row.
            // This ensures only one transaction updates the ledger for this pair at a time.
            await tx.$queryRaw`
        SELECT 1 FROM "RetailerWholesalerCredit"
        WHERE "retailerId" = ${retailerId} AND "wholesalerId" = ${wholesalerId}
        FOR UPDATE
      `;

            // Get last calculated balance
            const lastEntry = await tx.ledgerEntry.findFirst({
                where: { retailerId, wholesalerId },
                orderBy: { createdAt: 'desc' },
            });

            const currentBalance = lastEntry ? Number(lastEntry.balanceAfter) : 0;
            const newBalance = currentBalance + Number(amount);

            // Create new immutable entry
            const entry = await tx.ledgerEntry.create({
                data: {
                    retailerId,
                    wholesalerId,
                    orderId,
                    entryType: 'DEBIT',
                    amount: amount,
                    balanceAfter: newBalance,
                    dueDate: dueDate ? new Date(dueDate) : null,
                    createdBy: 'SYSTEM',
                }
            });

            return entry;
        }, {
            operation: 'CREDIT_DEBIT',
            entityId: orderId,
            entityType: 'LedgerEntry',
            timeout: 10000
        });
    }

    /**
     * Create a CREDIT entry (Retailer PAYS / OWES LESS).
     * Typically when a payment is received.
     * @param {string} retailerId
     * @param {string} wholesalerId
     * @param {number} amount
     * @returns {Promise<Object>} The created LedgerEntry
     */
    async createCredit(retailerId, wholesalerId, amount) {
        if (amount <= 0) throw new Error("Amount must be positive");

        return withTransaction(async (tx) => {
            // LOCKING
            await tx.$queryRaw`
        SELECT 1 FROM "RetailerWholesalerCredit"
        WHERE "retailerId" = ${retailerId} AND "wholesalerId" = ${wholesalerId}
        FOR UPDATE
      `;

            // Get last balance
            const lastEntry = await tx.ledgerEntry.findFirst({
                where: { retailerId, wholesalerId },
                orderBy: { createdAt: 'desc' },
            });

            const currentBalance = lastEntry ? Number(lastEntry.balanceAfter) : 0;
            const newBalance = currentBalance - Number(amount);

            // Create Credit Entry
            const entry = await tx.ledgerEntry.create({
                data: {
                    retailerId,
                    wholesalerId,
                    entryType: 'CREDIT',
                    amount: amount,
                    balanceAfter: newBalance,
                    createdBy: 'SYSTEM',
                }
            });

            return entry;
        }, {
            operation: 'CREDIT_CREDIT',
            entityId: `${retailerId}-${wholesalerId}`,
            entityType: 'LedgerEntry',
            timeout: 10000
        });
    }
}

module.exports = new LedgerService();
