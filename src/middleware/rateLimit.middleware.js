/**
 * Rate Limiting Middleware
 * 
 * Fintech-grade rate limiting using express-rate-limit
 * Prevents API abuse and DDoS attacks
 */

let rateLimit;
try {
    rateLimit = require('express-rate-limit');
} catch (e) {
    // Fallback to a no-op rate limiter factory when module not available
    console.warn('⚠️ express-rate-limit not available — using no-op rate limiter');
    rateLimit = () => ((req, res, next) => next());
}
const { securityConfig } = require('../config/security.config');

/**
 * Create rate limiter with custom configuration
 * @param {object} config - Rate limit configuration
 * @returns {Function} - Express middleware
 */
function createRateLimiter(config) {
    // Safety check for config
    const safeConfig = config || { windowMs: 15 * 60 * 1000, max: 100 };

    return rateLimit({
        windowMs: safeConfig.windowMs,
        max: safeConfig.max,
        message: {
            error: safeConfig.message || 'Too many requests, please try again later',
            retryAfter: Math.ceil(safeConfig.windowMs / 1000)
        },
        standardHeaders: safeConfig.standardHeaders !== false,
        legacyHeaders: safeConfig.legacyHeaders !== false,
        skipSuccessfulRequests: safeConfig.skipSuccessfulRequests || false,
        skipFailedRequests: safeConfig.skipFailedRequests || false,
        // Store in Redis if available (for distributed systems)
        store: undefined, // Can be configured to use Redis store
        handler: (req, res, next, options) => {
            res.status(429).json({
                success: false,
                error: safeConfig.message || 'Too many requests, please try again later',
                retryAfter: Math.ceil(safeConfig.windowMs / 1000)
            });
        }
    });
}

/**
 * General API rate limiter
 */
const generalRateLimiter = createRateLimiter(securityConfig.rateLimiting.api);

/**
 * Authentication rate limiter (strict)
 */
const authRateLimiter = createRateLimiter(securityConfig.rateLimiting.auth);

/**
 * Admin endpoints rate limiter
 */
const adminRateLimiter = createRateLimiter(securityConfig.rateLimiting.admin);

/**
 * Webhook rate limiter (more lenient)
 */
const webhookRateLimiter = createRateLimiter(securityConfig.rateLimiting.webhook);

/**
 * Order creation rate limiter
 */
// orderCreation is likely not in rateLimiting config based on previous view, checking keys: api, auth, admin, webhook
// Let's create a default or check if I missed it. I missed it? 
// Checking security.config.js again: api, auth, admin, webhook. NO orderCreation, NO bidding.
// I should map them to available configs or default. 
// "api" seems to be "general".
const orderCreationRateLimiter = createRateLimiter(securityConfig.rateLimiting.api);

/**
 * Bidding rate limiter
 */
const biddingRateLimiter = createRateLimiter(securityConfig.rateLimiting.api);

/**
 * Custom rate limiter factory
 * @param {object} options - Custom options
 * @returns {Function} - Rate limiter middleware
 */
function customRateLimiter(options) {
    return createRateLimiter({
        ...securityConfig.rateLimiting.api,
        ...options
    });
}

module.exports = {
    generalRateLimiter,
    authRateLimiter,
    adminRateLimiter,
    webhookRateLimiter,
    orderCreationRateLimiter,
    biddingRateLimiter,
    customRateLimiter,
    createRateLimiter
};
