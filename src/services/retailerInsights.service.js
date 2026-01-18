const prisma = require('../config/database');

class RetailerInsightsService {
    /**
     * FEATURE 6: Basic Retailer Insights (Text-based only)
     * Generate simple text summaries for retailer engagement
     */
    async generateRetailerInsights(retailerId) {
        const retailer = await prisma.retailer.findUnique({
            where: { id: retailerId }
        });

        if (!retailer) throw new Error('Retailer not found');

        const now = new Date();

        // Current week (Monday to now)
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
        weekStart.setHours(0, 0, 0, 0);

        // Previous week
        const prevWeekEnd = new Date(weekStart);
        prevWeekEnd.setDate(weekStart.getDate() - 1);
        const prevWeekStart = new Date(prevWeekEnd);
        prevWeekStart.setDate(prevWeekEnd.getDate() - 6);

        // This month
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Last 30 days
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);

        // Fetch orders for different periods
        const [thisWeekOrders, lastWeekOrders, thisMonthOrders, last30Orders] = await Promise.all([
            prisma.order.findMany({
                where: {
                    retailerId,
                    status: 'DELIVERED',
                    createdAt: { gte: weekStart }
                }
            }),
            prisma.order.findMany({
                where: {
                    retailerId,
                    status: 'DELIVERED',
                    createdAt: { gte: prevWeekStart, lt: prevWeekEnd }
                }
            }),
            prisma.order.findMany({
                where: {
                    retailerId,
                    status: 'DELIVERED',
                    createdAt: { gte: monthStart }
                }
            }),
            prisma.order.findMany({
                where: {
                    retailerId,
                    status: 'DELIVERED',
                    createdAt: { gte: thirtyDaysAgo }
                }
            })
        ]);

        // Calculate stats
        const thisWeekTotal = thisWeekOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);
        const lastWeekTotal = lastWeekOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);
        const thisMonthTotal = thisMonthOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);
        const last30Total = last30Orders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);
        const last30Avg = last30Orders.length > 0 ? (last30Total / last30Orders.length) : 0;

        // Unique days active (last 30 days)
        const activeDays = new Set(last30Orders.map(o => o.createdAt.toDateString())).size;

        // Update the RetailerInsight cache
        await prisma.retailerInsight.upsert({
            where: { retailerId },
            create: {
                retailerId,
                ordersThisWeek: thisWeekOrders.length,
                ordersLastWeek: lastWeekOrders.length,
                ordersThisMonth: thisMonthOrders.length,
                avgOrderValue: last30Avg,
                totalSpent: last30Total,
                daysActive: activeDays
            },
            update: {
                ordersThisWeek: thisWeekOrders.length,
                ordersLastWeek: lastWeekOrders.length,
                ordersThisMonth: thisMonthOrders.length,
                avgOrderValue: last30Avg,
                totalSpent: last30Total,
                daysActive: activeDays,
                lastCalculatedAt: new Date()
            }
        });

        return {
            retailerId,
            period: {
                thisWeek: {
                    orders: thisWeekOrders.length,
                    total: thisWeekTotal,
                    avgOrder: thisWeekOrders.length > 0 ? thisWeekTotal / thisWeekOrders.length : 0
                },
                lastWeek: {
                    orders: lastWeekOrders.length,
                    total: lastWeekTotal,
                    avgOrder: lastWeekOrders.length > 0 ? lastWeekTotal / lastWeekOrders.length : 0
                },
                thisMonth: {
                    orders: thisMonthOrders.length,
                    total: thisMonthTotal,
                    avgOrder: thisMonthOrders.length > 0 ? thisMonthTotal / thisMonthOrders.length : 0
                },
                last30Days: {
                    orders: last30Orders.length,
                    total: last30Total,
                    avgOrder: last30Avg,
                    activeDays
                }
            }
        };
    }

    /**
     * Get cached insights for a retailer
     */
    async getRetailerInsights(retailerId) {
        let insight = await prisma.retailerInsight.findUnique({
            where: { retailerId }
        });

        if (!insight) {
            // Generate if not cached
            await this.generateRetailerInsights(retailerId);
            insight = await prisma.retailerInsight.findUnique({
                where: { retailerId }
            });
        }

        return insight;
    }

    /**
     * Generate friendly text message with insights for WhatsApp
     */
    async getInsightMessage(retailerId) {
        const insights = await this.getRetailerInsights(retailerId);

        if (!insights) return 'We don\'t have any order data yet. Start ordering!';

        let message = '📊 *Your Trading Stats*\n\n';

        // This week summary
        message += `📅 *This Week*\n`;
        message += `Orders: ${insights.ordersThisWeek}\n`;

        // Comparison with last week
        if (insights.ordersLastWeek > 0) {
            const change = insights.ordersThisWeek - insights.ordersLastWeek;
            const arrow = change > 0 ? '📈' : change < 0 ? '📉' : '→';
            message += `Trend: ${arrow} (vs ${insights.ordersLastWeek} last week)\n\n`;
        } else {
            message += '\n';
        }

        // Monthly
        message += `📆 *This Month*\n`;
        message += `Orders: ${insights.ordersThisMonth}\n`;

        // 30-day stats
        message += `\n📊 *Last 30 Days*\n`;
        message += `Total Orders: ${insights.ordersThisMonth}\n`;
        message += `Avg Order Value: Rs. ${Math.round(insights.avgOrderValue)}\n`;
        message += `Total Spent: Rs. ${Math.round(insights.totalSpent)}\n`;
        message += `Active Days: ${insights.daysActive}\n\n`;

        // Encouragement
        if (insights.ordersThisMonth >= 10) {
            message += `🌟 *You're on fire!* Keep ordering regularly to unlock better terms.\n`;
        } else if (insights.ordersThisMonth >= 5) {
            message += `💪 *Great start!* Place a few more orders this month to build your profile.\n`;
        } else {
            message += `👋 *Welcome!* Start building your order history with us.\n`;
        }

        message += `\nReply "View Catalog" to place an order!`;

        return message;
    }

    /**
     * Batch generate insights for all retailers (for admin)
     * This can be run daily as a job
     */
    async regenerateAllInsights() {
        const retailers = await prisma.retailer.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true }
        });

        let success = 0;
        let failed = 0;

        for (const { id } of retailers) {
            try {
                await this.generateRetailerInsights(id);
                success++;
            } catch (error) {
                console.error(`Failed to generate insights for ${id}:`, error.message);
                failed++;
            }
        }

        return {
            total: retailers.length,
            success,
            failed,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get comparison insights (how this retailer compares to others)
     * - Top retailer by orders
     * - Top by spending
     * - Average order frequency
     */
    async getSystemInsights() {
        const activeRetailers = await prisma.retailer.findMany({
            where: { status: 'ACTIVE' },
            include: {
                orders: {
                    where: { status: 'DELIVERED' }
                }
            }
        });

        // Calculate stats
        const totalRetailers = activeRetailers.length;
        const totalOrders = activeRetailers.reduce((sum, r) => sum + r.orders.length, 0);
        const avgOrdersPerRetailer = totalRetailers > 0 ? totalOrders / totalRetailers : 0;

        // Top retailers
        const topByOrders = activeRetailers
            .map(r => ({
                retailerId: r.id,
                pasalName: r.pasalName || 'Unknown',
                orders: r.orders.length
            }))
            .sort((a, b) => b.orders - a.orders)
            .slice(0, 5);

        return {
            activeRetailers: totalRetailers,
            totalOrders,
            avgOrdersPerRetailer: Math.round(avgOrdersPerRetailer),
            topRetailers: topByOrders,
            insight: `Average retailer places ${Math.round(avgOrdersPerRetailer)} orders. ${totalOrders} orders across the system.`
        };
    }
}

module.exports = new RetailerInsightsService();
