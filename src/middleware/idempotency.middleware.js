/**
 * Idempotency Middleware
 * 
 * Reliability Engineering: Handle duplicate webhook requests gracefully
 * 
 * Flow:
 * 1. Extract X-Idempotency-Key header
 * 2. Validate key format
 * 3. Check if key already exists (duplicate request)
 * 4. If found and not expired: return cached response immediately (200)
 * 5. If not found: continue to handler, then cache response
 * 6. Deleted expired entries automatically
 * 
 * Standards: RFC 7231, Stripe Idempotency API
 */

const idempotencyService = require('../services/idempotency.service');
const logger = require('../utils/logger');

/**
 * Middleware to handle webhook idempotency
 * 
 * Options:
 * - ttl_seconds: Time to live for idempotency keys (default 86400 = 24 hours)
 * - header_name: Custom header name (default 'x-idempotency-key')
 * - enabled: Enable/disable idempotency (default true)
 * 
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware
 */
const idempotencyMiddleware = (options = {}) => {
  const {
    ttl_seconds = 86400, // 24 hours
    header_name = 'x-idempotency-key',
    enabled = true
  } = options;

  return async (req, res, next) => {
    if (!enabled) {
      return next();
    }

    // Store options on request for later use in handler
    req.idempotency = {
      ttl_seconds,
      enabled: true,
      key: null,
      is_replay: false
    };

    try {
      // Extract idempotency key from header
      const idempotency_key = req.headers[header_name];

      if (!idempotency_key) {
        // No idempotency key provided (optional)
        logger.debug('No idempotency key provided', {
          path: req.path,
          method: req.method
        });
        return next();
      }

      // Validate key format
      if (!idempotencyService.validateIdempotencyKey(idempotency_key)) {
        logger.warn('Invalid idempotency key format', {
          key: idempotency_key,
          path: req.path
        });
        return res.status(400).json({
          success: false,
          error: 'Invalid idempotency key format. Must be alphanumeric, hyphen, or underscore (max 255 chars)'
        });
      }

      req.idempotency.key = idempotency_key;

      // Check if this is a duplicate request
      const existingEntry = await idempotencyService.getIdempotencyEntry(idempotency_key);

      if (existingEntry) {
        // This is a duplicate request - return cached response
        logger.info('Idempotency cache hit - replaying response', {
          idempotency_key,
          webhook_type: existingEntry.webhook_type,
          original_status: existingEntry.response_status,
          original_timestamp: existingEntry.created_at
        });

        req.idempotency.is_replay = true;

        // Return the original response
        res.status(existingEntry.response_status).json(existingEntry.response_body);

        // Log the replay
        logger.info('Webhook replay completed', {
          idempotency_key,
          request_ip: req.clientIP,
          original_request_time: existingEntry.created_at
        });

        return; // Don't continue to handler
      }

      // Not a duplicate - continue to handler
      // Handler will cache the response later
      logger.debug('Idempotency key is new', {
        idempotency_key,
        path: req.path
      });

      next();
    } catch (error) {
      // Log error but don't block request
      logger.error('Error in idempotency middleware', {
        error: error.message,
        path: req.path,
        idempotency_key: req.headers[header_name]
      });

      // Continue without idempotency on error
      req.idempotency.enabled = false;
      next();
    }
  };
};

/**
 * Decorator to cache webhook response for idempotency
 * Call this after handler completes successfully
 * 
 * Usage:
 * const response = await handler(req, res);
 * await cacheIdempotencyResponse(req, res, 'whatsapp_message', response);
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {string} webhook_type - Type of webhook (e.g., 'whatsapp_message', 'order_webhook')
 * @param {Object} response_data - Response data to cache
 * @returns {Promise<boolean>} True if cached successfully
 */
const cacheIdempotencyResponse = async (req, res, webhook_type, response_data) => {
  try {
    // Skip caching if idempotency not enabled or no key
    if (!req.idempotency?.enabled || !req.idempotency?.key || req.idempotency?.is_replay) {
      return false;
    }

    // Only cache successful responses (2xx status codes)
    const status = res.statusCode || 200;
    if (status < 200 || status >= 300) {
      logger.warn('Not caching non-2xx response for idempotency', {
        idempotency_key: req.idempotency.key,
        status_code: status
      });
      return false;
    }

    // Extract optional metadata
    const retailer_id = req.retailerId || req.body?.retailer_id || null;
    const order_id = req.body?.order_id || null;
    const source_ip = req.clientIP || req.ip;

    // Store the idempotency key
    await idempotencyService.storeIdempotencyKey({
      idempotency_key: req.idempotency.key,
      webhook_type,
      request_body: req.body || {},
      response_status: status,
      response_body: response_data,
      ttl_seconds: req.idempotency.ttl_seconds,
      source_ip,
      retailer_id,
      order_id
    });

    logger.info('Webhook response cached for idempotency', {
      idempotency_key: req.idempotency.key,
      webhook_type,
      status_code: status
    });

    return true;
  } catch (error) {
    logger.error('Error caching idempotency response', {
      error: error.message,
      idempotency_key: req.idempotency?.key,
      webhook_type
    });
    return false;
  }
};

/**
 * Helper to extract idempotency key from request
 * 
 * @param {Object} req - Express request
 * @param {string} header_name - Header name to check (default 'x-idempotency-key')
 * @returns {string|null} Idempotency key or null
 */
const getIdempotencyKey = (req, header_name = 'x-idempotency-key') => {
  return req.headers[header_name] || null;
};

module.exports = {
  idempotencyMiddleware,
  cacheIdempotencyResponse,
  getIdempotencyKey
};
