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
const securityConfig = require('../config/security.config');

/**
 * Create rate limiter with custom configuration
 * @param {object} config - Rate limit configuration
 * @returns {Function} - Express middleware
 */
function createRateLimiter(config) {
    return rateLimit({
        windowMs: config.windowMs,
        max: config.max,
        message: {
            error: config.message || 'Too many requests, please try again later',
            retryAfter: Math.ceil(config.windowMs / 1000)
        },
        standardHeaders: config.standardHeaders !== false,
        legacyHeaders: config.legacyHeaders !== false,
        skipSuccessfulRequests: config.skipSuccessfulRequests || false,
        skipFailedRequests: config.skipFailedRequests || false,
        // Store in Redis if available (for distributed systems)
        store: undefined, // Can be configured to use Redis store
        handler: (req, res) => {
            res.status(429).json({
                success: false,
                error: config.message || 'Too many requests, please try again later',
                retryAfter: Math.ceil(config.windowMs / 1000)
            });
        }
    });
}

/**
 * General API rate limiter
 */
const generalRateLimiter = createRateLimiter(securityConfig.RATE_LIMITS.general);

/**
 * Authentication rate limiter (strict)
 */
const authRateLimiter = createRateLimiter(securityConfig.RATE_LIMITS.auth);

/**
 * Admin endpoints rate limiter
 */
const adminRateLimiter = createRateLimiter(securityConfig.RATE_LIMITS.admin);

/**
 * Webhook rate limiter (more lenient)
 */
const webhookRateLimiter = createRateLimiter(securityConfig.RATE_LIMITS.webhook);

/**
 * Order creation rate limiter
 */
const orderCreationRateLimiter = createRateLimiter(securityConfig.RATE_LIMITS.orderCreation);

/**
 * Bidding rate limiter
 */
const biddingRateLimiter = createRateLimiter(securityConfig.RATE_LIMITS.bidding);

/**
 * Custom rate limiter factory
 * @param {object} options - Custom options
 * @returns {Function} - Rate limiter middleware
 */
function customRateLimiter(options) {
    return createRateLimiter({
        ...securityConfig.RATE_LIMITS.general,
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
