/**
 * Daily Health Report Job
 * 
 * Generates comprehensive health report every day at 9 AM
 * Includes trends, alerts, and system status
 */

const schedule = require('node-schedule');
const prisma = require('../config/database');
const metricsService = require('../services/metrics.service');
const { logger } = require('../config/logger');

// Run every day at 9 AM
const job = schedule.scheduleJob('0 9 * * *', async function () {
    logger.info('📊 Generating Daily Health Report...');

    try {
        const report = await generateHealthReport();

        // Store in database (if you have a HealthReport model)
        try {
            await prisma.auditLog.create({
                data: {
                    entity: 'System',
                    action: 'DAILY_HEALTH_REPORT',
                    description: `Daily health report generated: ${report.summary.status}`,
                    metadata: JSON.stringify(report)
                }
            });
        } catch (dbError) {
            logger.warn('Failed to store health report in database', { error: dbError.message });
        }

        // Log summary
        logger.info('✅ Daily Health Report Generated', {
            status: report.summary.status,
            alerts: report.summary.alerts,
            warnings: report.summary.warnings
        });

        // TODO: Send email to admins
        // await emailService.send({
        //     to: process.env.ADMIN_EMAIL,
        //     subject: `Daily Health Report - ${report.date}`,
        //     html: formatHealthReportHTML(report)
        // });

    } catch (error) {
        logger.error('❌ Daily Health Report Failed', {
            error: error.message,
            stack: error.stack
        });
    }
});

/**
 * Generate comprehensive health report
 */
async function generateHealthReport() {
    const now = new Date();
    const yesterday = new Date(now - 24 * 60 * 60 * 1000);

    // Get current metrics
    const metrics = await metricsService.getMetrics();

    // Get yesterday's data for comparison
    const [ordersToday, ordersYesterday, deliveredToday, deliveredYesterday] = await Promise.all([
        prisma.order.count({
            where: { createdAt: { gte: yesterday } }
        }),
        prisma.order.count({
            where: {
                createdAt: {
                    gte: new Date(yesterday - 24 * 60 * 60 * 1000),
                    lt: yesterday
                }
            }
        }),
        prisma.order.count({
            where: {
                status: 'DELIVERED',
                updatedAt: { gte: yesterday }
            }
        }),
        prisma.order.count({
            where: {
                status: 'DELIVERED',
                updatedAt: {
                    gte: new Date(yesterday - 24 * 60 * 60 * 1000),
                    lt: yesterday
                }
            }
        })
    ]);

    // Calculate trends
    const orderTrend = ordersYesterday > 0
        ? ((ordersToday - ordersYesterday) / ordersYesterday * 100).toFixed(1)
        : 0;

    const deliveryTrend = deliveredYesterday > 0
        ? ((deliveredToday - deliveredYesterday) / deliveredYesterday * 100).toFixed(1)
        : 0;

    // Determine overall status
    const alerts = [];
    const warnings = [];
    let status = 'healthy';

    // Check error rate
    const errorRate = parseFloat(metrics.system.errors.rate);
    if (errorRate > 5) {
        alerts.push(`Critical: Error rate at ${errorRate}%`);
        status = 'critical';
    } else if (errorRate > 1) {
        warnings.push(`Warning: Error rate at ${errorRate}%`);
        status = status === 'healthy' ? 'degraded' : status;
    }

    // Check latency
    if (metrics.system.latency.p95 > 1000) {
        alerts.push(`Critical: P95 latency at ${metrics.system.latency.p95}ms`);
        status = 'critical';
    } else if (metrics.system.latency.p95 > 500) {
        warnings.push(`Warning: P95 latency at ${metrics.system.latency.p95}ms`);
        status = status === 'healthy' ? 'degraded' : status;
    }

    // Check credit approval rate
    if (metrics.credit.approvalRate < 0.7) {
        alerts.push(`Critical: Credit approval rate at ${(metrics.credit.approvalRate * 100).toFixed(0)}%`);
        status = 'critical';
    } else if (metrics.credit.approvalRate < 0.8) {
        warnings.push(`Warning: Credit approval rate at ${(metrics.credit.approvalRate * 100).toFixed(0)}%`);
        status = status === 'healthy' ? 'degraded' : status;
    }

    // Check order conversion
    if (metrics.orders.conversionRate < 0.6) {
        warnings.push(`Warning: Order conversion rate at ${(metrics.orders.conversionRate * 100).toFixed(0)}%`);
        status = status === 'healthy' ? 'degraded' : status;
    }

    return {
        date: now.toISOString().split('T')[0],
        timestamp: now.toISOString(),
        period: '24h',
        summary: {
            status,
            alerts: alerts.length,
            warnings: warnings.length
        },
        orders: {
            total: ordersToday,
            delivered: deliveredToday,
            conversionRate: metrics.orders.conversionRate,
            avgTimeToDeliver: `${metrics.orders.avgTimeToDeliver} hours`,
            trend: `${orderTrend > 0 ? '+' : ''}${orderTrend}% vs yesterday`
        },
        vendors: {
            totalActive: metrics.vendors.totalVendors,
            topPerformers: metrics.vendors.vendors.slice(0, 3)
        },
        credit: {
            approvalRate: (metrics.credit.approvalRate * 100).toFixed(0) + '%',
            avgUtilization: (metrics.credit.avgUtilization * 100).toFixed(0) + '%',
            totalChecks: metrics.credit.checks.total
        },
        system: {
            uptime: `${(metrics.system.uptime / 3600).toFixed(1)} hours`,
            errorRate: metrics.system.errors.rate,
            avgLatency: `${metrics.system.latency.avg}ms`,
            p95Latency: `${metrics.system.latency.p95}ms`,
            totalRequests: metrics.system.requests.total
        },
        alerts,
        warnings
    };
}

/**
 * Format health report as HTML (for email)
 */
function formatHealthReportHTML(report) {
    const statusColor = {
        healthy: '#10b981',
        degraded: '#f59e0b',
        critical: '#ef4444'
    };

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .header { background: ${statusColor[report.summary.status]}; color: white; padding: 20px; }
                .section { margin: 20px 0; padding: 15px; border-left: 4px solid #3b82f6; }
                .metric { display: inline-block; margin: 10px 20px 10px 0; }
                .metric-label { font-size: 12px; color: #666; }
                .metric-value { font-size: 24px; font-weight: bold; }
                .alert { background: #fee2e2; border-left: 4px solid #ef4444; padding: 10px; margin: 10px 0; }
                .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px; margin: 10px 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Daily Health Report - ${report.date}</h1>
                <p>Status: ${report.summary.status.toUpperCase()}</p>
            </div>

            ${report.alerts.length > 0 ? `
                <div class="section">
                    <h2>🚨 Alerts</h2>
                    ${report.alerts.map(alert => `<div class="alert">${alert}</div>`).join('')}
                </div>
            ` : ''}

            ${report.warnings.length > 0 ? `
                <div class="section">
                    <h2>⚠️ Warnings</h2>
                    ${report.warnings.map(warning => `<div class="warning">${warning}</div>`).join('')}
                </div>
            ` : ''}

            <div class="section">
                <h2>📦 Orders</h2>
                <div class="metric">
                    <div class="metric-label">Total</div>
                    <div class="metric-value">${report.orders.total}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Delivered</div>
                    <div class="metric-value">${report.orders.delivered}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Conversion Rate</div>
                    <div class="metric-value">${(report.orders.conversionRate * 100).toFixed(0)}%</div>
                </div>
                <p>Trend: ${report.orders.trend}</p>
            </div>

            <div class="section">
                <h2>💳 Credit System</h2>
                <div class="metric">
                    <div class="metric-label">Approval Rate</div>
                    <div class="metric-value">${report.credit.approvalRate}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Avg Utilization</div>
                    <div class="metric-value">${report.credit.avgUtilization}</div>
                </div>
            </div>

            <div class="section">
                <h2>⚙️ System Health</h2>
                <div class="metric">
                    <div class="metric-label">Error Rate</div>
                    <div class="metric-value">${report.system.errorRate}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Avg Latency</div>
                    <div class="metric-value">${report.system.avgLatency}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Uptime</div>
                    <div class="metric-value">${report.system.uptime}</div>
                </div>
            </div>
        </body>
        </html>
    `;
}

module.exports = { job, generateHealthReport, formatHealthReportHTML };
