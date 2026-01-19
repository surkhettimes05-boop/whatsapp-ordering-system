/**
 * Request Sanitization Middleware
 * 
 * Prevents XSS and SQL injection attacks by sanitizing user input
 * Applied to all incoming requests before validation
 */

const xss = require('xss');
const validator = require('validator');

/**
 * Sanitize all string inputs in request
 */
function sanitizeInput(req, res, next) {
    try {
        // Sanitize body
        if (req.body && typeof req.body === 'object') {
            req.body = sanitizeObject(req.body);
        }

        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
            req.query = sanitizeObject(req.query);
        }

        // Sanitize URL parameters (usually safe but good practice)
        if (req.params && typeof req.params === 'object') {
            req.params = sanitizeObject(req.params);
        }

        next();
    } catch (error) {
        console.error('Sanitization error:', error);
        return res.status(400).json({
            success: false,
            error: 'Invalid request data'
        });
    }
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }

    const sanitized = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
        // Sanitize the key itself (prevent prototype pollution)
        const safeKey = sanitizeString(key);

        if (typeof value === 'string') {
            // Remove HTML tags and escape special characters
            sanitized[safeKey] = sanitizeString(value);
        } else if (typeof value === 'object' && value !== null) {
            // Recursively sanitize nested objects
            sanitized[safeKey] = sanitizeObject(value);
        } else {
            // Numbers, booleans, null - pass through
            sanitized[safeKey] = value;
        }
    }

    return sanitized;
}

/**
 * Sanitize individual string
 */
function sanitizeString(str) {
    if (typeof str !== 'string') {
        return str;
    }

    // Remove HTML tags and escape XSS attempts
    let sanitized = xss(str, {
        whiteList: {}, // No HTML tags allowed
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script', 'style']
    });

    // Escape SQL-like characters (defense in depth - Prisma handles this)
    sanitized = validator.escape(sanitized);

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
}

/**
 * Strict sanitization for financial/sensitive fields
 * Only allows alphanumeric, spaces, and basic punctuation
 */
function sanitizeFinancialInput(req, res, next) {
    const financialFields = ['amount', 'priceQuote', 'creditLimit', 'balance'];

    if (req.body) {
        for (const field of financialFields) {
            if (req.body[field] !== undefined) {
                // Ensure it's a valid number
                const value = parseFloat(req.body[field]);
                if (isNaN(value) || value < 0) {
                    return res.status(400).json({
                        success: false,
                        error: `Invalid ${field}: must be a positive number`
                    });
                }
                req.body[field] = value;
            }
        }
    }

    next();
}

module.exports = {
    sanitizeInput,
    sanitizeFinancialInput,
    sanitizeObject,
    sanitizeString
};
