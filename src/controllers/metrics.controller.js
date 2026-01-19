/**
 * Metrics Controller
 * 
 * Exposes metrics and health check endpoints
 */

const metricsService = require('../services/metrics.service');

class MetricsController {
    /**
     * Get all metrics
     * GET /api/v1/metrics
     */
    async getMetrics(req, res) {
        try {
            const metrics = await metricsService.getMetrics();

            // Support Prometheus format
            if (req.query.format === 'prometheus') {
                return res.type('text/plain').send(this.formatPrometheus(metrics));
            }

            res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get system health check
     * GET /api/v1/health
     */
    async getHealth(req, res) {
        try {
            const metrics = await metricsService.getMetrics();
            const system = metrics.system;

            // Determine health status
            const errorRate = parseFloat(system.errors.rate);
            const avgLatency = system.latency.avg;

            let status = 'healthy';
            const issues = [];

            if (errorRate > 5) {
                status = 'unhealthy';
                issues.push(`High error rate: ${errorRate}%`);
            } else if (errorRate > 1) {
                status = 'degraded';
                issues.push(`Elevated error rate: ${errorRate}%`);
            }

            if (avgLatency > 1000) {
                status = 'unhealthy';
                issues.push(`High latency: ${avgLatency}ms`);
            } else if (avgLatency > 500) {
                status = status === 'healthy' ? 'degraded' : status;
                issues.push(`Elevated latency: ${avgLatency}ms`);
            }

            res.json({
                success: true,
                status,
                timestamp: new Date().toISOString(),
                uptime: system.uptime,
                issues,
                metrics: {
                    errorRate: system.errors.rate,
                    avgLatency: system.latency.avg,
                    totalRequests: system.requests.total
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                status: 'unhealthy',
                error: error.message
            });
        }
    }

    /**
     * Format metrics in Prometheus format
     */
    formatPrometheus(metrics) {
        const lines = [];

        // Orders
        lines.push(`# HELP orders_total Total number of orders`);
        lines.push(`# TYPE orders_total counter`);
        lines.push(`orders_total ${metrics.orders.total}`);

        lines.push(`# HELP orders_conversion_rate Order conversion rate`);
        lines.push(`# TYPE orders_conversion_rate gauge`);
        lines.push(`orders_conversion_rate ${metrics.orders.conversionRate}`);

        // System
        lines.push(`# HELP http_requests_total Total HTTP requests`);
        lines.push(`# TYPE http_requests_total counter`);
        lines.push(`http_requests_total ${metrics.system.requests.total}`);

        lines.push(`# HELP http_errors_total Total HTTP errors`);
        lines.push(`# TYPE http_errors_total counter`);
        lines.push(`http_errors_total ${metrics.system.errors.total}`);

        lines.push(`# HELP http_request_duration_ms HTTP request latency`);
        lines.push(`# TYPE http_request_duration_ms summary`);
        lines.push(`http_request_duration_ms{quantile="0.5"} ${metrics.system.latency.p50}`);
        lines.push(`http_request_duration_ms{quantile="0.95"} ${metrics.system.latency.p95}`);
        lines.push(`http_request_duration_ms{quantile="0.99"} ${metrics.system.latency.p99}`);

        // Credit
        lines.push(`# HELP credit_approval_rate Credit approval rate`);
        lines.push(`# TYPE credit_approval_rate gauge`);
        lines.push(`credit_approval_rate ${metrics.credit.approvalRate}`);

        return lines.join('\n');
    }
}

module.exports = new MetricsController();
