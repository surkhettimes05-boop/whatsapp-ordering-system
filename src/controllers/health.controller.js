/**
 * Enhanced Health Check Controller
 * 
 * Provides comprehensive health status for production monitoring
 */

const prisma = require('../config/database');
const { connection: redisConnection } = require('../queue/queue');
const os = require('os');
const fs = require('fs');
const path = require('path');

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
}

module.exports = new HealthController();
