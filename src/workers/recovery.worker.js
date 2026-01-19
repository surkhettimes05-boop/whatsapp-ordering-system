/**
 * Fault-Tolerant Recovery Worker
 * 
 * Detects and repairs:
 * - Incomplete orders (expired, wrong status, missing ledger)
 * - Failed vendor selections
 * - Stuck ledger entries
 * - Orphaned stock reservations
 * 
 * Runs every 15 minutes via scheduled job
 */

const prisma = require('../config/database');
const biddingService = require('../services/bidding.service');
const ledgerService = require('../services/ledger.service');
const stockService = require('../services/stock.service');
const { logger } = require('../config/logger');

class RecoveryWorker {
    constructor() {
        this.MAX_REPAIRS_PER_RUN = 100;
        this.repairCount = 0;
    }

    /**
     * Main recovery orchestrator
     * Runs all recovery checks in sequence
     */
    async run() {
        const startTime = Date.now();
        this.repairCount = 0;

        logger.info('🔧 Recovery Worker Starting...');

        const report = {
            timestamp: new Date().toISOString(),
            duration: 0,
            checks: [],
            summary: {
                totalFound: 0,
                totalRepaired: 0,
                totalFailed: 0
            },
            failures: []
        };

        try {
            // Run all recovery checks
            report.checks.push(await this.recoverIncompleteOrders());
            report.checks.push(await this.recoverFailedVendorSelections());
            report.checks.push(await this.recoverStuckLedgerEntries());
            report.checks.push(await this.recoverOrphanedStockReservations());

            // Calculate summary
            report.checks.forEach(check => {
                report.summary.totalFound += check.found;
                report.summary.totalRepaired += check.repaired;
                report.summary.totalFailed += check.failed;
                report.failures.push(...check.failures);
            });

            report.duration = Date.now() - startTime;

            // Log summary
            await this.logRecoveryReport(report);

            logger.info('✅ Recovery Worker Completed', {
                duration: `${report.duration}ms`,
                repaired: report.summary.totalRepaired,
                failed: report.summary.totalFailed
            });

            return report;
        } catch (error) {
            logger.error('❌ Recovery Worker Failed', {
                error: error.message,
                stack: error.stack
            });

            report.duration = Date.now() - startTime;
            report.error = error.message;
            return report;
        }
    }

    /**
     * Recover incomplete orders (expired, wrong status, missing ledger)
     */
    async recoverIncompleteOrders() {
        const checkName = 'Incomplete Orders';
        logger.info(`🔍 Checking: ${checkName}`);

        const result = {
            name: checkName,
            found: 0,
            repaired: 0,
            failed: 0,
            failures: []
        };

        try {
            // Find orders in inconsistent states
            const incompleteOrders = await prisma.order.findMany({
                where: {
                    OR: [
                        // Expired but not assigned
                        {
                            status: 'PENDING_BIDS',
                            expiresAt: { lt: new Date() },
                            finalWholesalerId: null
                        },
                        // Has winner but wrong status
                        {
                            finalWholesalerId: { not: null },
                            status: { in: ['PENDING_BIDS', 'CREATED'] }
                        },
                        // Delivered but no ledger
                        {
                            status: 'DELIVERED',
                            wholesalerId: { not: null },
                            ledgerEntries: { none: {} }
                        }
                    ]
                },
                include: {
                    vendorOffers: true,
                    ledgerEntries: true
                },
                take: this.MAX_REPAIRS_PER_RUN
            });

            result.found = incompleteOrders.length;

            for (const order of incompleteOrders) {
                if (this.repairCount >= this.MAX_REPAIRS_PER_RUN) {
                    logger.warn('Max repairs per run reached');
                    break;
                }

                try {
                    await this.repairOrder(order);
                    result.repaired++;
                    this.repairCount++;
                } catch (error) {
                    result.failed++;
                    result.failures.push({
                        type: 'INCOMPLETE_ORDER',
                        orderId: order.id,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            logger.error('Error in recoverIncompleteOrders', { error: error.message });
            result.failed++;
            result.failures.push({
                type: 'CHECK_FAILED',
                error: error.message
            });
        }

        return result;
    }

    /**
     * Repair a single incomplete order
     */
    async repairOrder(order) {
        // Case 1: Expired but not assigned (has offers)
        if (order.status === 'PENDING_BIDS' && order.expiresAt < new Date() && !order.finalWholesalerId) {
            if (order.vendorOffers && order.vendorOffers.length > 0) {
                await biddingService.selectWinner(order.id, {
                    performedBy: 'RECOVERY_WORKER',
                    triggeredBy: 'AUTO_RECOVERY'
                });

                await this.logRecoveryEvent('RECOVERY_ORDER_EXPIRED_ASSIGNED', {
                    orderId: order.id,
                    reason: 'Expired order with offers - auto-assigned winner'
                });
            } else {
                // No offers - mark as failed
                await prisma.order.update({
                    where: { id: order.id },
                    data: { status: 'FAILED', failureReason: 'No offers received before expiry' }
                });

                await this.logRecoveryEvent('RECOVERY_ORDER_EXPIRED_FAILED', {
                    orderId: order.id,
                    reason: 'Expired order with no offers - marked as failed'
                });
            }
        }

        // Case 2: Has winner but wrong status
        if (order.finalWholesalerId && ['PENDING_BIDS', 'CREATED'].includes(order.status)) {
            await prisma.order.update({
                where: { id: order.id },
                data: { status: 'ASSIGNED' }
            });

            await this.logRecoveryEvent('RECOVERY_ORDER_STATUS_FIXED', {
                orderId: order.id,
                oldStatus: order.status,
                newStatus: 'ASSIGNED',
                reason: 'Order had winner but incorrect status'
            });
        }

        // Case 3: Delivered but no ledger
        if (order.status === 'DELIVERED' && order.wholesalerId && order.ledgerEntries.length === 0) {
            await ledgerService.createDebit(
                order.id,
                order.totalAmount,
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
            );

            await this.logRecoveryEvent('RECOVERY_LEDGER_CREATED', {
                orderId: order.id,
                amount: order.totalAmount,
                reason: 'Delivered order missing ledger entry'
            });
        }
    }

    /**
     * Recover failed vendor selections
     */
    async recoverFailedVendorSelections() {
        const checkName = 'Failed Vendor Selections';
        logger.info(`🔍 Checking: ${checkName}`);

        const result = {
            name: checkName,
            found: 0,
            repaired: 0,
            failed: 0,
            failures: []
        };

        try {
            // Find expired orders with offers but no winner
            const failedSelections = await prisma.order.findMany({
                where: {
                    status: 'PENDING_BIDS',
                    expiresAt: { lt: new Date() },
                    finalWholesalerId: null,
                    vendorOffers: {
                        some: { status: 'PENDING' }
                    }
                },
                take: this.MAX_REPAIRS_PER_RUN
            });

            result.found = failedSelections.length;

            for (const order of failedSelections) {
                if (this.repairCount >= this.MAX_REPAIRS_PER_RUN) break;

                try {
                    await biddingService.selectWinner(order.id, {
                        performedBy: 'RECOVERY_WORKER',
                        triggeredBy: 'AUTO_RECOVERY'
                    });

                    await this.logRecoveryEvent('RECOVERY_VENDOR_SELECTION_RETRY', {
                        orderId: order.id,
                        reason: 'Expired order with pending offers - retried selection'
                    });

                    result.repaired++;
                    this.repairCount++;
                } catch (error) {
                    result.failed++;
                    result.failures.push({
                        type: 'VENDOR_SELECTION',
                        orderId: order.id,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            logger.error('Error in recoverFailedVendorSelections', { error: error.message });
            result.failed++;
            result.failures.push({
                type: 'CHECK_FAILED',
                error: error.message
            });
        }

        return result;
    }

    /**
     * Recover stuck ledger entries
     */
    async recoverStuckLedgerEntries() {
        const checkName = 'Stuck Ledger Entries';
        logger.info(`🔍 Checking: ${checkName}`);

        const result = {
            name: checkName,
            found: 0,
            repaired: 0,
            failed: 0,
            failures: []
        };

        try {
            // Find delivered orders without ledger entries
            const ordersWithoutLedger = await prisma.order.findMany({
                where: {
                    status: 'DELIVERED',
                    wholesalerId: { not: null },
                    ledgerEntries: { none: {} }
                },
                take: this.MAX_REPAIRS_PER_RUN
            });

            result.found = ordersWithoutLedger.length;

            for (const order of ordersWithoutLedger) {
                if (this.repairCount >= this.MAX_REPAIRS_PER_RUN) break;

                try {
                    // Create missing DEBIT entry
                    await ledgerService.createDebit(
                        order.id,
                        order.totalAmount,
                        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
                    );

                    await this.logRecoveryEvent('RECOVERY_LEDGER_CREATED', {
                        orderId: order.id,
                        amount: order.totalAmount,
                        reason: 'Delivered order missing ledger entry'
                    });

                    result.repaired++;
                    this.repairCount++;
                } catch (error) {
                    result.failed++;
                    result.failures.push({
                        type: 'LEDGER_ENTRY',
                        orderId: order.id,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            logger.error('Error in recoverStuckLedgerEntries', { error: error.message });
            result.failed++;
            result.failures.push({
                type: 'CHECK_FAILED',
                error: error.message
            });
        }

        return result;
    }

    /**
     * Recover orphaned stock reservations
     */
    async recoverOrphanedStockReservations() {
        const checkName = 'Orphaned Stock Reservations';
        logger.info(`🔍 Checking: ${checkName}`);

        const result = {
            name: checkName,
            found: 0,
            repaired: 0,
            failed: 0,
            failures: []
        };

        try {
            // Find active reservations for terminal orders
            const orphanedReservations = await prisma.stockReservation.findMany({
                where: {
                    status: 'ACTIVE',
                    order: {
                        status: { in: ['CANCELLED', 'FAILED', 'DELIVERED'] }
                    }
                },
                include: { order: true },
                take: this.MAX_REPAIRS_PER_RUN
            });

            result.found = orphanedReservations.length;

            for (const reservation of orphanedReservations) {
                if (this.repairCount >= this.MAX_REPAIRS_PER_RUN) break;

                try {
                    // Release the reservation
                    await stockService.releaseStock(reservation.orderId);

                    await this.logRecoveryEvent('RECOVERY_STOCK_RELEASED', {
                        orderId: reservation.orderId,
                        reservationId: reservation.id,
                        orderStatus: reservation.order.status,
                        reason: 'Active reservation for terminal order state'
                    });

                    result.repaired++;
                    this.repairCount++;
                } catch (error) {
                    result.failed++;
                    result.failures.push({
                        type: 'STOCK_RESERVATION',
                        orderId: reservation.orderId,
                        reservationId: reservation.id,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            logger.error('Error in recoverOrphanedStockReservations', { error: error.message });
            result.failed++;
            result.failures.push({
                type: 'CHECK_FAILED',
                error: error.message
            });
        }

        return result;
    }

    /**
     * Log recovery event to audit trail
     */
    async logRecoveryEvent(eventType, metadata) {
        try {
            await prisma.auditLog.create({
                data: {
                    entity: 'Order',
                    action: eventType,
                    description: this.getEventDescription(eventType),
                    metadata: JSON.stringify({
                        ...metadata,
                        timestamp: new Date().toISOString(),
                        worker: 'RecoveryWorker'
                    })
                }
            });
        } catch (error) {
            logger.warn('Failed to log recovery event', {
                eventType,
                error: error.message
            });
        }
    }

    /**
     * Get human-readable description for event type
     */
    getEventDescription(eventType) {
        const descriptions = {
            RECOVERY_ORDER_EXPIRED_ASSIGNED: 'Expired order auto-assigned winner',
            RECOVERY_ORDER_EXPIRED_FAILED: 'Expired order marked as failed (no offers)',
            RECOVERY_ORDER_STATUS_FIXED: 'Order status corrected to match winner assignment',
            RECOVERY_LEDGER_CREATED: 'Missing ledger entry created for delivered order',
            RECOVERY_VENDOR_SELECTION_RETRY: 'Vendor selection retried for expired order',
            RECOVERY_STOCK_RELEASED: 'Orphaned stock reservation released',
            RECOVERY_FAILED: 'Recovery action failed'
        };

        return descriptions[eventType] || eventType;
    }

    /**
     * Log complete recovery report
     */
    async logRecoveryReport(report) {
        try {
            await prisma.auditLog.create({
                data: {
                    entity: 'System',
                    action: 'RECOVERY_REPORT',
                    description: `Recovery worker completed: ${report.summary.totalRepaired} repairs, ${report.summary.totalFailed} failures`,
                    metadata: JSON.stringify(report)
                }
            });
        } catch (error) {
            logger.warn('Failed to log recovery report', { error: error.message });
        }
    }
}

module.exports = new RecoveryWorker();
