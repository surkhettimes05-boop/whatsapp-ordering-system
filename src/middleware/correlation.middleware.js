/**
 * Correlation ID Middleware
 * 
 * Adds unique correlation ID to each request for distributed tracing
 * Integrates with metrics service to track request performance
 */

const crypto = require('crypto');
const metricsService = require('../services/metrics.service');

function correlationMiddleware(req, res, next) {
    // Generate or use existing correlation ID
    req.correlationId = req.headers['x-correlation-id'] ||
        req.headers['x-request-id'] ||
        `${Date.now()}-${crypto.randomUUID()}`;

    // Add to response headers
    res.setHeader('X-Correlation-ID', req.correlationId);

    // Track request start time
    req.startTime = Date.now();

    // Intercept response to track metrics
    const originalSend = res.send;
    res.send = function (data) {
        const duration = Date.now() - req.startTime;

        // Track request metrics
        metricsService.trackRequest(res.statusCode, duration);

        return originalSend.call(this, data);
    };

    next();
}

module.exports = { correlationMiddleware };
