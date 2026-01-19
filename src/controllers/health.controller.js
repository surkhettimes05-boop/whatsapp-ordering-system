/**
 * Enhanced Health Check Controller
 * 
 * Provides comprehensive health status for production monitoring
 */

const prisma = require('../config/database');
const { connection: redisConnection } = require('../queue/queue');
const twilio = require('twilio');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { logger } = require('../config/logger');

class HealthController {
    /**
     * Basic health check
     * GET /health
     */
    async getHealth(req, res) {
        try {
            // Check database
            await prisma.$queryRaw`SELECT 1`;
            
            // Check Redis (if available)
            let redisStatus = 'unknown';
            try {
                if (redisConnection) {
                    await redisConnection.ping();
                    redisStatus = 'connected';
                }
            } catch (e) {
                redisStatus = 'disconnected';
            }
            
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                services: {
                    database: 'connected',
                    redis: redisStatus
                }
            });
        } catch (error) {
            res.status(503).json({
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error.message,
                services: {
                    database: 'disconnected',
                    redis: 'unknown'
                }
            });
        }
    }
    
    /**
     * Detailed health check
     * GET /health/detailed
     */
    async getDetailedHealth(req, res) {
        try {
            const health = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: process.env.APP_VERSION || 'unknown',
                environment: process.env.NODE_ENV || 'development',
                services: {},
                system: {},
                checks: {}
            };
            
            // Database check
            try {
                const startTime = Date.now();
                await prisma.$queryRaw`SELECT 1`;
                const dbLatency = Date.now() - startTime;
                
                health.services.database = {
                    status: 'connected',
                    latency: `${dbLatency}ms`
                };
                health.checks.database = 'pass';
            } catch (error) {
                health.services.database = {
                    status: 'disconnected',
                    error: error.message
                };
                health.checks.database = 'fail';
                health.status = 'degraded';
            }
            
            // Redis check
            try {
                if (redisConnection) {
                    const startTime = Date.now();
                    await redisConnection.ping();
                    const redisLatency = Date.now() - startTime;
                    
                    health.services.redis = {
                        status: 'connected',
                        latency: `${redisLatency}ms`
                    };
                    health.checks.redis = 'pass';
                } else {
                    health.services.redis = { status: 'not_configured' };
                    health.checks.redis = 'skip';
                }
            } catch (error) {
                health.services.redis = {
                    status: 'disconnected',
                    error: error.message
                };
                health.checks.redis = 'fail';
                health.status = 'degraded';
            }
            
            // System metrics
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            
            health.system = {
                memory: {
                    total: `${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
                    used: `${(usedMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
                    free: `${(freeMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
                    usage: `${((usedMem / totalMem) * 100).toFixed(2)}%`
                },
                cpu: {
                    loadAverage: os.loadavg(),
                    cores: os.cpus().length
                },
                uptime: `${(os.uptime() / 3600).toFixed(2)} hours`
            };
            
            // Disk space check
            try {
                const stats = fs.statSync(path.join(__dirname, '../../'));
                // This is a simplified check - in production, use a proper disk space library
                health.system.disk = {
                    status: 'ok'
                };
            } catch (error) {
                health.system.disk = {
                    status: 'error',
                    error: error.message
                };
            }
            
            // Determine overall status
            const failedChecks = Object.values(health.checks).filter(c => c === 'fail').length;
            if (failedChecks > 0) {
                health.status = failedChecks === Object.keys(health.checks).length ? 'error' : 'degraded';
            }
            
            const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503;
            res.status(statusCode).json(health);
        } catch (error) {
            res.status(503).json({
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    }
    
    /**
     * Readiness check (for Kubernetes)
     * GET /health/ready
     */
    async getReadiness(req, res) {
        try {
            // Check critical services
            await prisma.$queryRaw`SELECT 1`;
            
            res.json({
                status: 'ready',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(503).json({
                status: 'not_ready',
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    }
    
    /**
     * Liveness check (for Kubernetes)
     * GET /health/live
     */
    async getLiveness(req, res) {
        // Liveness just checks if the process is running
        res.json({
            status: 'alive',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    }

    /**
     * Check Twilio API connectivity
     * Internal utility method
     */
    async checkTwilioConnectivity() {
        try {
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;

            if (!accountSid || !authToken) {
                return {
                    status: 'not_configured',
                    message: 'Twilio credentials not configured'
                };
            }

            // Create Twilio client (doesn't make API call yet)
            const client = twilio(accountSid, authToken);

            // Make a lightweight API call to verify connectivity
            const startTime = Date.now();
            const account = await client.api.accounts(accountSid).fetch();
            const latency = Date.now() - startTime;

            return {
                status: 'connected',
                latency: `${latency}ms`,
                accountName: account.friendlyName || 'Unknown',
                accountStatus: account.status
            };
        } catch (error) {
            logger.error('Twilio connectivity check failed', { error: error.message });
            return {
                status: 'disconnected',
                error: error.message,
                type: error.constructor.name
            };
        }
    }

    /**
     * Check queue system status
     * Internal utility method
     */
    async checkQueueStatus() {
        try {
            if (!redisConnection) {
                return {
                    status: 'not_available',
                    message: 'Queue system not initialized'
                };
            }

            // Get Redis info to check queue health
            const startTime = Date.now();
            const info = await redisConnection.info();
            const latency = Date.now() - startTime;

            // Parse Redis info
            const lines = info.split('\r\n');
            const infoObj = {};
            lines.forEach(line => {
                const [key, value] = line.split(':');
                if (key && value) infoObj[key] = value;
            });

            // Get queue statistics (check if any major queues exist)
            const queueKeys = await redisConnection.keys('bull:*:*');
            
            return {
                status: 'operational',
                latency: `${latency}ms`,
                redis: {
                    version: infoObj.redis_version || 'unknown',
                    uptime: infoObj.uptime_in_seconds ? `${infoObj.uptime_in_seconds}s` : 'unknown',
                    memory: infoObj.used_memory_human || 'unknown',
                    connectedClients: infoObj.connected_clients || 'unknown',
                    commandsProcessed: infoObj.total_commands_processed || 'unknown'
                },
                queues: {
                    count: Math.floor(queueKeys.length / 3), // Each queue has ~3 keys
                    totalKeys: queueKeys.length
                }
            };
        } catch (error) {
            logger.error('Queue status check failed', { error: error.message });
            return {
                status: 'error',
                error: error.message,
                type: error.constructor.name
            };
        }
    }

    /**
     * Comprehensive health endpoint with all service checks
     * GET /health/status
     */
    async getHealthStatus(req, res) {
        try {
            const health = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: process.env.APP_VERSION || 'unknown',
                environment: process.env.NODE_ENV || 'development',
                services: {},
                checks: {}
            };

            // 1. Database check
            try {
                const startTime = Date.now();
                await prisma.$queryRaw`SELECT 1`;
                const dbLatency = Date.now() - startTime;

                health.services.database = {
                    status: 'connected',
                    latency: `${dbLatency}ms`
                };
                health.checks.database = 'pass';
            } catch (error) {
                health.services.database = {
                    status: 'disconnected',
                    error: error.message
                };
                health.checks.database = 'fail';
                health.status = 'degraded';
            }

            // 2. Redis/Queue check
            try {
                if (redisConnection) {
                    const startTime = Date.now();
                    await redisConnection.ping();
                    const redisLatency = Date.now() - startTime;

                    health.services.redis = {
                        status: 'connected',
                        latency: `${redisLatency}ms`
                    };
                    health.checks.redis = 'pass';
                } else {
                    health.services.redis = { status: 'not_configured' };
                    health.checks.redis = 'skip';
                }
            } catch (error) {
                health.services.redis = {
                    status: 'disconnected',
                    error: error.message
                };
                health.checks.redis = 'fail';
                health.status = 'degraded';
            }

            // 3. Twilio API check
            const twilioStatus = await this.checkTwilioConnectivity();
            health.services.twilio = twilioStatus;
            health.checks.twilio = twilioStatus.status === 'connected' ? 'pass' : 'fail';
            if (twilioStatus.status === 'disconnected') {
                health.status = 'degraded';
            }

            // 4. Queue system check
            const queueStatus = await this.checkQueueStatus();
            health.services.queue = queueStatus;
            health.checks.queue = 
                queueStatus.status === 'operational' ? 'pass' :
                queueStatus.status === 'not_available' ? 'skip' : 'fail';
            if (queueStatus.status === 'error') {
                health.status = 'degraded';
            }

            // Determine overall status
            const failedChecks = Object.values(health.checks).filter(c => c === 'fail').length;
            if (failedChecks > 0) {
                health.status = failedChecks === Object.keys(health.checks).length ? 'error' : 'degraded';
            }

            const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503;
            res.status(statusCode).json(health);
        } catch (error) {
            logger.error('Health status check failed', { error: error.message });
            res.status(503).json({
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    }

    /**
     * Simple monitoring endpoint (returns 200 if system is operational)
     * GET /health/monitor
     */
    async getMonitoringStatus(req, res) {
        try {
            const checks = {
                database: false,
                twilio: false,
                queue: false
            };

            // Database check
            try {
                await prisma.$queryRaw`SELECT 1`;
                checks.database = true;
            } catch (e) {
                checks.database = false;
            }

            // Twilio check
            try {
                if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
                    const client = twilio(
                        process.env.TWILIO_ACCOUNT_SID,
                        process.env.TWILIO_AUTH_TOKEN
                    );
                    await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
                    checks.twilio = true;
                }
            } catch (e) {
                checks.twilio = false;
            }

            // Queue check
            try {
                if (redisConnection) {
                    await redisConnection.ping();
                    checks.queue = true;
                }
            } catch (e) {
                checks.queue = false;
            }

            const allHealthy = Object.values(checks).every(v => v === true || v === false && Object.keys(checks).length > 0);
            const statusCode = Object.values(checks).some(v => v) ? 200 : 503;

            res.status(statusCode).json({
                status: statusCode === 200 ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString(),
                checks,
                uptime: process.uptime()
            });
        } catch (error) {
            res.status(503).json({
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    }
}

module.exports = new HealthController();
