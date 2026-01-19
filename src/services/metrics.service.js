/**
 * Production Metrics Service
 * 
 * Real-time metrics collection for:
 * - Order lifecycle tracking
 * - Vendor performance monitoring
 * - Credit system health
 * - System performance metrics
 */

const prisma = require('../config/database');
const { logger } = require('../config/logger');

class MetricsService {
    constructor() {
        // In-memory metrics storage
        this.metrics = {
            orders: {
                total: 0,
                byStatus: new Map(),
                timeInStatus: new Map(), // orderId -> { status -> duration }
                conversionRate: 0
            },
            vendors: {
                responseTimes: new Map(), // wholesalerId -> [times]
                winRates: new Map(), // wholesalerId -> { wins, total }
                stockConfirmationRate: 0
            },
            credit: {
                checks: { total: 0, approved: 0, rejected: 0 },
                utilization: [],
                overdue: { count: 0, amount: 0 }
            },
            system: {
                errors: { total: 0, byType: new Map() },
                requests: { total: 0, byStatus: new Map() },
                latencies: []
            }
        };

        // Start periodic aggregation
        this.startAggregation();
    }

    /**
     * Track order lifecycle event
     */
    async trackOrderEvent(orderId, status, metadata = {}) {
        try {
            this.metrics.orders.total++;

            // Update status count
            const currentCount = this.metrics.orders.byStatus.get(status) || 0;
            this.metrics.orders.byStatus.set(status, currentCount + 1);

            // Track time in status
            if (!this.metrics.orders.timeInStatus.has(orderId)) {
                this.metrics.orders.timeInStatus.set(orderId, new Map());
            }

            const orderTimings = this.metrics.orders.timeInStatus.get(orderId);
            orderTimings.set(status, {
                enteredAt: new Date(),
                ...metadata
            });

            logger.debug('Order event tracked', {
                orderId,
                status,
                event: 'ORDER_LIFECYCLE'
            });
        } catch (error) {
            logger.error('Failed to track order event', { error: error.message });
        }
    }

    /**
     * Track vendor response time
     */
    trackVendorResponse(wholesalerId, orderId, responseTimeMs) {
        try {
            if (!this.metrics.vendors.responseTimes.has(wholesalerId)) {
                this.metrics.vendors.responseTimes.set(wholesalerId, []);
            }

            this.metrics.vendors.responseTimes.get(wholesalerId).push(responseTimeMs);

            // Keep only last 100 responses per vendor
            const times = this.metrics.vendors.responseTimes.get(wholesalerId);
            if (times.length > 100) {
                times.shift();
            }

            logger.debug('Vendor response tracked', {
                wholesalerId,
                orderId,
                responseTimeMs,
                event: 'VENDOR_RESPONSE'
            });
        } catch (error) {
            logger.error('Failed to track vendor response', { error: error.message });
        }
    }

    /**
     * Track vendor bid result (win/loss)
     */
    trackBidResult(wholesalerId, won) {
        try {
            if (!this.metrics.vendors.winRates.has(wholesalerId)) {
                this.metrics.vendors.winRates.set(wholesalerId, { wins: 0, total: 0 });
            }

            const stats = this.metrics.vendors.winRates.get(wholesalerId);
            stats.total++;
            if (won) stats.wins++;

            logger.debug('Bid result tracked', {
                wholesalerId,
                won,
                event: 'BID_RESULT'
            });
        } catch (error) {
            logger.error('Failed to track bid result', { error: error.message });
        }
    }

    /**
     * Track credit check event
     */
    trackCreditEvent(type, approved, amount) {
        try {
            this.metrics.credit.checks.total++;

            if (approved) {
                this.metrics.credit.checks.approved++;
            } else {
                this.metrics.credit.checks.rejected++;
            }

            logger.debug('Credit event tracked', {
                type,
                approved,
                amount,
                event: 'CREDIT_CHECK'
            });
        } catch (error) {
            logger.error('Failed to track credit event', { error: error.message });
        }
    }

    /**
     * Track system error
     */
    trackError(error, context = {}) {
        try {
            this.metrics.system.errors.total++;

            const errorType = error.name || 'UnknownError';
            const currentCount = this.metrics.system.errors.byType.get(errorType) || 0;
            this.metrics.system.errors.byType.set(errorType, currentCount + 1);

            logger.error('System error tracked', {
                errorType,
                message: error.message,
                ...context,
                event: 'SYSTEM_ERROR'
            });
        } catch (err) {
            logger.error('Failed to track error', { error: err.message });
        }
    }

    /**
     * Track API request
     */
    trackRequest(statusCode, latencyMs) {
        try {
            this.metrics.system.requests.total++;

            const statusCategory = Math.floor(statusCode / 100) * 100; // 200, 400, 500
            const currentCount = this.metrics.system.requests.byStatus.get(statusCategory) || 0;
            this.metrics.system.requests.byStatus.set(statusCategory, currentCount + 1);

            this.metrics.system.latencies.push(latencyMs);

            // Keep only last 1000 latencies
            if (this.metrics.system.latencies.length > 1000) {
                this.metrics.system.latencies.shift();
            }
        } catch (error) {
            logger.error('Failed to track request', { error: error.message });
        }
    }

    /**
     * Get aggregated order metrics
     */
    async getOrderMetrics() {
        const statusCounts = Object.fromEntries(this.metrics.orders.byStatus);

        // Calculate conversion rate from database
        const [total, delivered] = await Promise.all([
            prisma.order.count(),
            prisma.order.count({ where: { status: 'DELIVERED' } })
        ]);

        return {
            total: this.metrics.orders.total,
            byStatus: statusCounts,
            conversionRate: total > 0 ? (delivered / total).toFixed(2) : 0,
            avgTimeToDeliver: await this.calculateAvgTimeToDeliver()
        };
    }

    /**
     * Get aggregated vendor metrics
     */
    getVendorMetrics() {
        const vendorStats = [];

        for (const [wholesalerId, times] of this.metrics.vendors.responseTimes.entries()) {
            const avgResponseTime = times.reduce((a, b) => a + b, 0) / times.length;
            const winStats = this.metrics.vendors.winRates.get(wholesalerId) || { wins: 0, total: 0 };
            const winRate = winStats.total > 0 ? (winStats.wins / winStats.total).toFixed(2) : 0;

            vendorStats.push({
                wholesalerId,
                avgResponseTimeMs: Math.round(avgResponseTime),
                winRate: parseFloat(winRate),
                totalBids: winStats.total
            });
        }

        return {
            vendors: vendorStats.sort((a, b) => b.winRate - a.winRate).slice(0, 10), // Top 10
            totalVendors: vendorStats.length
        };
    }

    /**
     * Get credit system metrics
     */
    async getCreditMetrics() {
        const approvalRate = this.metrics.credit.checks.total > 0
            ? (this.metrics.credit.checks.approved / this.metrics.credit.checks.total).toFixed(2)
            : 0;

        // Get real-time credit utilization from database
        const credits = await prisma.retailerWholesalerCredit.findMany({
            select: {
                creditLimit: true,
                usedCredit: true
            }
        });

        const avgUtilization = credits.length > 0
            ? credits.reduce((sum, c) => sum + (c.usedCredit / c.creditLimit), 0) / credits.length
            : 0;

        return {
            checks: this.metrics.credit.checks,
            approvalRate: parseFloat(approvalRate),
            avgUtilization: avgUtilization.toFixed(2)
        };
    }

    /**
     * Get system health metrics
     */
    getSystemMetrics() {
        const latencies = this.metrics.system.latencies;
        const sorted = [...latencies].sort((a, b) => a - b);

        const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
        const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
        const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

        const errorRate = this.metrics.system.requests.total > 0
            ? ((this.metrics.system.errors.total / this.metrics.system.requests.total) * 100).toFixed(2)
            : 0;

        return {
            requests: {
                total: this.metrics.system.requests.total,
                byStatus: Object.fromEntries(this.metrics.system.requests.byStatus)
            },
            errors: {
                total: this.metrics.system.errors.total,
                rate: `${errorRate}%`,
                byType: Object.fromEntries(this.metrics.system.errors.byType)
            },
            latency: {
                p50: Math.round(p50),
                p95: Math.round(p95),
                p99: Math.round(p99),
                avg: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) || 0
            },
            uptime: process.uptime(),
            memory: process.memoryUsage()
        };
    }

    /**
     * Get all metrics
     */
    async getMetrics() {
        return {
            timestamp: new Date().toISOString(),
            orders: await this.getOrderMetrics(),
            vendors: this.getVendorMetrics(),
            credit: await this.getCreditMetrics(),
            system: this.getSystemMetrics()
        };
    }

    /**
     * Calculate average time to deliver
     */
    async calculateAvgTimeToDeliver() {
        const deliveredOrders = await prisma.order.findMany({
            where: { status: 'DELIVERED' },
            select: { createdAt: true, updatedAt: true },
            take: 100,
            orderBy: { createdAt: 'desc' }
        });

        if (deliveredOrders.length === 0) return 0;

        const totalTime = deliveredOrders.reduce((sum, order) => {
            return sum + (new Date(order.updatedAt) - new Date(order.createdAt));
        }, 0);

        return Math.round(totalTime / deliveredOrders.length / 1000 / 60 / 60); // hours
    }

    /**
     * Start periodic aggregation (every 5 minutes)
     */
    startAggregation() {
        setInterval(async () => {
            try {
                const metrics = await this.getMetrics();
                logger.info('Metrics aggregated', {
                    orders: metrics.orders.total,
                    errorRate: metrics.system.errors.rate,
                    avgLatency: metrics.system.latency.avg
                });
            } catch (error) {
                logger.error('Metrics aggregation failed', { error: error.message });
            }
        }, 5 * 60 * 1000); // 5 minutes
    }

    /**
     * Reset metrics (for testing or daily reset)
     */
    reset() {
        this.metrics = {
            orders: { total: 0, byStatus: new Map(), timeInStatus: new Map(), conversionRate: 0 },
            vendors: { responseTimes: new Map(), winRates: new Map(), stockConfirmationRate: 0 },
            credit: { checks: { total: 0, approved: 0, rejected: 0 }, utilization: [], overdue: { count: 0, amount: 0 } },
            system: { errors: { total: 0, byType: new Map() }, requests: { total: 0, byStatus: new Map() }, latencies: [] }
        };
        logger.info('Metrics reset');
    }
}

module.exports = new MetricsService();
