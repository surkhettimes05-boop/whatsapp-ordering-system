const prisma = require('../config/database');

class GuardrailsService {
    /**
     * FEATURE 8: System Guardrails
     * Validate order against system rules before allowing placement
     */
    async validateOrderPlacement(retailerId, orderAmount, paymentMode) {
        const retailer = await prisma.retailer.findUnique({
            where: { id: retailerId },
            include: { credit: true }
        });

        if (!retailer) {
            return {
                allowed: false,
                reason: 'RETAILER_NOT_FOUND',
                message: 'Retailer account not found'
            };
        }

        // Check retailer status
        if (retailer.status === 'BLOCKED') {
            return {
                allowed: false,
                reason: 'RETAILER_BLOCKED',
                message: 'Your account is blocked. Please contact support.'
            };
        }

        // CREDIT MODE VALIDATION
        if (paymentMode === 'CREDIT') {
            // Check if credit is active
            if (retailer.creditStatus === 'PAUSED') {
                return {
                    allowed: false,
                    reason: 'CREDIT_PAUSED',
                    message: `Your credit is paused. Reason: ${retailer.creditPauseReason || 'Payment overdue'}. Please contact us to reactivate.`
                };
            }

            if (retailer.creditStatus === 'BLOCKED') {
                return {
                    allowed: false,
                    reason: 'CREDIT_BLOCKED',
                    message: 'Your credit account is blocked. Please contact support.'
                };
            }

            if (!retailer.credit) {
                return {
                    allowed: false,
                    reason: 'NO_CREDIT_ACCOUNT',
                    message: 'No credit account active. Please use Cash on Delivery.'
                };
            }

            const availableCredit = parseFloat(retailer.credit.creditLimit) - parseFloat(retailer.credit.usedCredit);
            const orderAmount_ = parseFloat(orderAmount);

            // Check available credit
            if (orderAmount_ > availableCredit) {
                return {
                    allowed: false,
                    reason: 'INSUFFICIENT_CREDIT',
                    message: `Order (Rs. ${orderAmount_}) exceeds available credit (Rs. ${Math.round(availableCredit)}). Use less credit or pay via COD.`
                };
            }

            // Check max order value per credit tier
            const maxOrder = parseFloat(retailer.credit.maxOrderValue || 50000);
            if (orderAmount_ > maxOrder) {
                return {
                    allowed: false,
                    reason: 'MAX_ORDER_EXCEEDED',
                    message: `Order (Rs. ${orderAmount_}) exceeds maximum credit order size (Rs. ${maxOrder}).`
                };
            }

            // Check if already has overdue credit
            const outstandingStatus = await this.checkOutstandingStatus(retailerId);
            if (outstandingStatus.shouldWarn) {
                // Allow but warn
                return {
                    allowed: true,
                    warning: outstandingStatus.message,
                    reason: 'OVERDUE_WARNING'
                };
            }
        }

        // COD MODE - minimal checks
        if (paymentMode === 'COD') {
            // Just check if retailer is active
            if (retailer.status !== 'ACTIVE') {
                return {
                    allowed: false,
                    reason: 'RETAILER_NOT_ACTIVE',
                    message: 'Your account is not active. Please contact support.'
                };
            }
        }

        return {
            allowed: true,
            reason: 'OK',
            message: 'Order is valid'
        };
    }

    /**
     * Check if a retailer has overdue outstanding credit
     */
    async checkOutstandingStatus(retailerId) {
        const retailer = await prisma.retailer.findUnique({
            where: { id: retailerId },
            include: {
                credit: true,
                transactions: {
                    where: {
                        type: 'DEBIT',
                        status: 'OPEN'
                    }
                }
            }
        });

        if (!retailer || !retailer.credit) {
            return { shouldWarn: false };
        }

        const maxDays = retailer.credit.maxOutstandingDays || 30;
        const now = new Date();

        let hasOverdue = false;
        let daysOverdue = 0;

        for (const transaction of retailer.transactions) {
            const ageDays = Math.floor((now - new Date(transaction.createdAt)) / (1000 * 60 * 60 * 24));
            if (ageDays > maxDays) {
                hasOverdue = true;
                daysOverdue = Math.max(daysOverdue, ageDays - maxDays);
            }
        }

        if (hasOverdue) {
            return {
                shouldWarn: true,
                message: `⚠️ You have credit that is ${daysOverdue} days overdue. Please clear before placing new orders.`,
                daysOverdue
            };
        }

        return { shouldWarn: false };
    }

    /**
     * Check credit status and auto-pause if needed
     * This should run as a scheduled job
     */
    async evaluateAndApplyGuardrails() {
        const retailers = await prisma.retailer.findMany({
            where: { status: 'ACTIVE', creditStatus: 'ACTIVE' },
            include: {
                credit: true,
                transactions: {
                    where: { type: 'DEBIT', status: 'OPEN' },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        let pausedCount = 0;
        const details = [];

        for (const retailer of retailers) {
            if (!retailer.credit) continue;

            const maxDays = retailer.credit.maxOutstandingDays || 30;
            if (retailer.transactions.length > 0) {
                const oldestTransaction = retailer.transactions[0];
                const ageDays = Math.floor((new Date() - new Date(oldestTransaction.createdAt)) / (1000 * 60 * 60 * 24));

                if (ageDays > maxDays) {
                    // Auto-pause
                    await prisma.retailer.update({
                        where: { id: retailer.id },
                        data: {
                            creditStatus: 'PAUSED',
                            creditPausedAt: new Date(),
                            creditPauseReason: `Automatic pause: Credit overdue by ${ageDays - maxDays} days`
                        }
                    });

                    pausedCount++;
                    details.push({
                        retailerId: retailer.id,
                        pasalName: retailer.pasalName,
                        reason: `${ageDays} days outstanding (limit: ${maxDays})`
                    });
                }
            }
        }

        return {
            evaluated: retailers.length,
            paused: pausedCount,
            details,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get guardrails configuration for a retailer
     */
    async getGuardrailsConfig(retailerId) {
        const retailer = await prisma.retailer.findUnique({
            where: { id: retailerId },
            include: { credit: true }
        });

        if (!retailer || !retailer.credit) {
            return null;
        }

        return {
            retailerId,
            creditLimit: parseFloat(retailer.credit.creditLimit),
            maxOrderValue: parseFloat(retailer.credit.maxOrderValue || 50000),
            maxOutstandingDays: retailer.credit.maxOutstandingDays || 30,
            currentStatus: retailer.creditStatus,
            pausedAt: retailer.creditPausedAt,
            pauseReason: retailer.creditPauseReason
        };
    }

    /**
     * Update guardrails for a retailer (admin only)
     */
    async updateGuardrails(retailerId, config) {
        const updates = {};

        if (config.creditLimit !== undefined) {
            updates.creditLimit = parseFloat(config.creditLimit);
        }

        if (config.maxOrderValue !== undefined) {
            updates.maxOrderValue = parseFloat(config.maxOrderValue);
        }

        if (config.maxOutstandingDays !== undefined) {
            updates.maxOutstandingDays = parseInt(config.maxOutstandingDays);
        }

        if (Object.keys(updates).length === 0) {
            throw new Error('No valid updates provided');
        }

        const updated = await prisma.creditAccount.update({
            where: { retailerId },
            data: updates
        });

        return {
            success: true,
            retailerId,
            newConfig: {
                creditLimit: parseFloat(updated.creditLimit),
                maxOrderValue: parseFloat(updated.maxOrderValue),
                maxOutstandingDays: updated.maxOutstandingDays
            }
        };
    }

    /**
     * Get all retailers approaching or exceeding limits
     */
    async getAtRiskRetailers() {
        const retailers = await prisma.retailer.findMany({
            where: { status: 'ACTIVE' },
            include: {
                credit: true,
                transactions: {
                    where: { type: 'DEBIT', status: 'OPEN' }
                }
            }
        });

        const risks = [];
        const now = new Date();

        for (const retailer of retailers) {
            if (!retailer.credit) continue;

            const availableCredit = parseFloat(retailer.credit.creditLimit) - parseFloat(retailer.credit.usedCredit);
            const creditUsagePercent = (parseFloat(retailer.credit.usedCredit) / parseFloat(retailer.credit.creditLimit)) * 100;

            // Credit usage risk
            if (creditUsagePercent > 80) {
                risks.push({
                    retailerId: retailer.id,
                    pasalName: retailer.pasalName,
                    riskType: 'HIGH_CREDIT_USAGE',
                    severity: creditUsagePercent > 95 ? 'CRITICAL' : 'HIGH',
                    detail: `${Math.round(creditUsagePercent)}% of credit limit used`,
                    availableCredit: Math.round(availableCredit)
                });
            }

            // Overdue risk
            if (retailer.transactions.length > 0) {
                const maxDays = retailer.credit.maxOutstandingDays || 30;
                const oldestTransaction = retailer.transactions[0];
                const ageDays = Math.floor((now - new Date(oldestTransaction.createdAt)) / (1000 * 60 * 60 * 24));

                if (ageDays > maxDays) {
                    risks.push({
                        retailerId: retailer.id,
                        pasalName: retailer.pasalName,
                        riskType: 'OVERDUE_CREDIT',
                        severity: ageDays > maxDays + 30 ? 'CRITICAL' : 'HIGH',
                        detail: `${ageDays} days outstanding (${Math.max(0, ageDays - maxDays)} days overdue)`,
                        amount: parseFloat(oldestTransaction.amount)
                    });
                }
            }
        }

        // Sort by severity and amount
        risks.sort((a, b) => {
            const severityScore = { 'CRITICAL': 3, 'HIGH': 2, 'MEDIUM': 1 };
            return (severityScore[b.severity] || 0) - (severityScore[a.severity] || 0);
        });

        return risks;
    }
}

module.exports = new GuardrailsService();
