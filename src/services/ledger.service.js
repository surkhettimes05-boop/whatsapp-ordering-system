const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = require('../config/database');
const logger = require('../config/logger');

class LedgerService {
    constructor() {
        this.prisma = prisma;
    }

    /**
     * Calculate SHA-256 hash for a ledger entry
     * @param {Object} data - Entry data
     * @param {String} previousHash - Previous entry's hash
     * @returns {String} Hex hash
     */
    calculateHash(data, previousHash) {
        const payload = JSON.stringify({
            idempotencyKey: data.idempotencyKey,
            retailerId: data.retailerId,
            wholesalerId: data.wholesalerId,
            amount: data.amount.toString(),
            type: data.entryType,
            prev: previousHash || 'GENESIS'
        });
        return crypto.createHash('sha256').update(payload).digest('hex');
    }

    /**
     * Record a double-entry transaction strictly.
     * Atomic: specific order of operations to ensure integrity.
     */
    async recordTransaction({
        idempotencyKey,
        retailerId,
        wholesalerId,
        orderId = null,
        amount,
        type, // 'DEBIT' or 'CREDIT' from Retailer perspective usually, but here strict LedgerEntryType
        description = '',
        relatedPaymentId = null
    }) {
        // 1. Validate Input
        if (!amount || amount <= 0) throw new Error('Invalid transaction amount');
        if (!idempotencyKey) throw new Error('Idempotency Key required');

        const Decimal = require('decimal.js');
        const txAmount = new Decimal(amount);

        return await this.prisma.$transaction(async (tx) => {
            // 2. Check Idempotency
            const existing = await tx.ledgerEntry.findUnique({
                where: { idempotencyKey }
            });
            if (existing) {
                logger.info(`Idempotency hit for ${idempotencyKey}`);
                return existing;
            }

            // 3. Get Previous Entry Hash (Gap prevention logic could be here, strict for now)
            const lastEntry = await tx.ledgerEntry.findFirst({
                where: { retailerId, wholesalerId },
                orderBy: { createdAt: 'desc' },
                select: { hash: true, balanceAfter: true } // Assuming balance is tracked per-relationship
            });

            const previousHash = lastEntry ? lastEntry.hash : null;
            // Use Decimal for previous balance
            const previousBalance = lastEntry ? new Decimal(lastEntry.balanceAfter) : new Decimal(0);

            // 4. Calculate New Balance
            // Logic: 
            // DEBIT (Retailer owes MORE) -> Balance increases (assuming Balance = Debt)
            // CREDIT (Retailer pays/owed) -> Balance decreases
            let balanceImpact = new Decimal(0);
            if (type === 'DEBIT') balanceImpact = txAmount;
            else if (type === 'CREDIT') balanceImpact = txAmount.negated();

            const newBalance = previousBalance.plus(balanceImpact);

            // 5. Prepare Entry Data
            const entryData = {
                idempotencyKey,
                retailerId,
                wholesalerId,
                orderId,
                entryType: type,
                amount: txAmount.toString(), // Convert to string for consistency
                balanceAfter: newBalance.toString(),
                previousHash,
                createdBy: 'SYSTEM'
            };

            // 6. Compute Hash
            const hash = this.calculateHash(entryData, previousHash);

            // 7. Insert Entry
            const entry = await tx.ledgerEntry.create({
                data: {
                    ...entryData,
                    hash
                }
            });

            // 8. Update mutable pointers (CreditAccount / RetailerWholesalerCredit)
            // This is "Materialized View" update for fast reads
            await tx.retailerWholesalerCredit.upsert({
                where: {
                    retailerId_wholesalerId: { retailerId, wholesalerId }
                },
                create: {
                    retailerId,
                    wholesalerId,
                    creditLimit: 0, // Default, needs setup
                    usedCredit: newBalance.toNumber() // Prisma might expect Decimal or Float. Check schema.
                },
                update: {
                    usedCredit: newBalance.toNumber()
                }
            });

            // 9. Update Retailer Global Credit Usage (if applicable)
            // (Optional depending on business logic overlap)

            logger.info(`Ledger transaction recorded: ${hash}`);
            return entry;
        });
    }

    async getBalance(retailerId, wholesalerId) {
        const creditRecord = await this.prisma.retailerWholesalerCredit.findUnique({
            where: { retailerId_wholesalerId: { retailerId, wholesalerId } }
        });
        return creditRecord ? Number(creditRecord.usedCredit) : 0;
    }
}

module.exports = new LedgerService();
