/**
 * Queue Management Controller
 * 
 * Provides endpoints for monitoring and managing job queues
 */

const {
    getAllQueueMetrics,
    getQueueMetrics,
    getDeadLetterJobs,
    retryJob,
    cleanFailedJobs,
    JOB_TYPES
} = require('../queue/queue');

class QueueController {
    /**
     * Get all queue metrics
     * GET /api/v1/queue/metrics
     */
    async getAllMetrics(req, res) {
        try {
            const metrics = await getAllQueueMetrics();
            
            // Calculate totals
            const totals = metrics.reduce((acc, m) => {
                acc.waiting += m.waiting;
                acc.active += m.active;
                acc.completed += m.completed;
                acc.failed += m.failed;
                acc.delayed += m.delayed;
                acc.total += m.total;
                return acc;
            }, { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, total: 0 });

            res.json({
                success: true,
                data: {
                    queues: metrics,
                    totals
                }
            });
        } catch (error) {
            console.error('Error getting queue metrics:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get metrics for specific queue
     * GET /api/v1/queue/metrics/:queueName
     */
    async getQueueMetric(req, res) {
        try {
            const { queueName } = req.params;

            if (!JOB_TYPES[queueName.toUpperCase()]) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid queue name: ${queueName}`
                });
            }

            const metrics = await getQueueMetrics(queueName);
            res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            console.error('Error getting queue metric:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get dead-letter queue jobs
     * GET /api/v1/queue/dead-letter/:queueName
     */
    async getDeadLetter(req, res) {
        try {
            const { queueName } = req.params;
            const jobs = await getDeadLetterJobs(queueName);

            res.json({
                success: true,
                data: {
                    queueName,
                    count: jobs.length,
                    jobs
                }
            });
        } catch (error) {
            console.error('Error getting dead-letter jobs:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Retry a failed job
     * POST /api/v1/queue/retry/:queueName/:jobId
     */
    async retryFailedJob(req, res) {
        try {
            const { queueName, jobId } = req.params;

            const job = await retryJob(queueName, jobId);

            res.json({
                success: true,
                message: 'Job queued for retry',
                data: {
                    jobId: job.id,
                    queueName
                }
            });
        } catch (error) {
            console.error('Error retrying job:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Clean failed jobs
     * POST /api/v1/queue/clean/:queueName
     */
    async cleanFailed(req, res) {
        try {
            const { queueName } = req.params;
            const { limit = 100 } = req.body;

            const cleaned = await cleanFailedJobs(queueName, limit);

            res.json({
                success: true,
                message: `Cleaned ${cleaned} failed jobs`,
                data: {
                    queueName,
                    cleaned
                }
            });
        } catch (error) {
            console.error('Error cleaning failed jobs:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get available job types
     * GET /api/v1/queue/job-types
     */
    async getJobTypes(req, res) {
        res.json({
            success: true,
            data: {
                jobTypes: Object.entries(JOB_TYPES).map(([key, value]) => ({
                    key,
                    value
                }))
            }
        });
    }

    /**
     * Get monitoring dashboard
     * GET /api/v1/queue/dashboard
     */
    async getDashboard(req, res) {
        try {
            const metrics = await getAllQueueMetrics();
            
            // Calculate health status
            const totalFailed = metrics.reduce((sum, m) => sum + m.failed, 0);
            const totalActive = metrics.reduce((sum, m) => sum + m.active, 0);
            const totalWaiting = metrics.reduce((sum, m) => sum + m.waiting, 0);
            
            const healthStatus = totalFailed > 100 ? 'unhealthy' : 
                               totalActive > 50 ? 'warning' : 'healthy';

            // Get recent failures
            const failedQueues = metrics.filter(m => m.failed > 0);

            res.json({
                success: true,
                data: {
                    health: {
                        status: healthStatus,
                        totalFailed,
                        totalActive,
                        totalWaiting
                    },
                    queues: metrics,
                    alerts: failedQueues.map(q => ({
                        queue: q.queueName,
                        failed: q.failed,
                        message: `${q.queueName} has ${q.failed} failed jobs`
                    })),
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error getting dashboard:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new QueueController();
