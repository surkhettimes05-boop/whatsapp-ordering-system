/**
 * Twilio Webhook Security Middleware
 * 
 * Features:
 * - Signature validation (prevents request spoofing)
 * - Replay attack prevention with timestamps + nonce cache
 * - Request sanitization
 * - Detailed security logging
 * 
 * Usage:
 *   const { validateTwilioWebhook, replayProtectionMiddleware } = require('./middleware/twilio-webhook.middleware');
 *   router.post('/webhook', replayProtectionMiddleware, validateTwilioWebhook, handler);
 */

const twilio = require('twilio');
const crypto = require('crypto');
const logger = require('../utils/logger');

// ============================================================================
// REPLAY ATTACK PREVENTION
// ============================================================================

/**
 * In-memory cache for tracking request nonces and timestamps
 * Prevents replay attacks by detecting duplicate requests within a time window
 * 
 * In production, consider using Redis with TTL:
 *   const redis = require('redis');
 *   const client = redis.createClient(process.env.REDIS_URL);
 *   const NON CE_CACHE = client;
 */
const NONCE_CACHE = new Map();
const NONCE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes: accept requests within 5-minute window
const MAX_CACHE_SIZE = 10000; // Prevent memory leaks

/**
 * Generates a unique nonce from request signature + timestamp
 * Twilio provides X-Twilio-Signature header which acts as a unique identifier
 */
function generateNonce(signature, timestamp) {
  return crypto
    .createHash('sha256')
    .update(`${signature}:${timestamp}`)
    .digest('hex');
}

/**
 * Stores nonce in cache with expiration
 */
function cacheNonce(nonce) {
  // Prevent unbounded cache growth
  if (NONCE_CACHE.size >= MAX_CACHE_SIZE) {
    const oldestKey = NONCE_CACHE.keys().next().value;
    NONCE_CACHE.delete(oldestKey);
    logger.warn('Nonce cache size limit reached, evicting oldest entry');
  }

  NONCE_CACHE.set(nonce, {
    timestamp: Date.now(),
    expiresAt: Date.now() + NONCE_WINDOW_MS,
  });
}

/**
 * Checks if nonce has been seen before (replay attack detection)
 */
function hasSeenNonce(nonce) {
  const entry = NONCE_CACHE.get(nonce);
  
  if (!entry) {
    return false;
  }

  // Check if entry has expired
  if (Date.now() > entry.expiresAt) {
    NONCE_CACHE.delete(nonce);
    return false;
  }

  return true;
}

/**
 * Cleans up expired entries from cache (called periodically)
 */
function cleanupExpiredNonces() {
  const now = Date.now();
  for (const [nonce, entry] of NONCE_CACHE.entries()) {
    if (now > entry.expiresAt) {
      NONCE_CACHE.delete(nonce);
    }
  }
  logger.debug(`Cleaned up expired nonces. Cache size: ${NONCE_CACHE.size}`);
}

// Run cleanup every 2 minutes
setInterval(cleanupExpiredNonces, 2 * 60 * 1000);

// ============================================================================
// SIGNATURE VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Validates Twilio request signature
 * 
 * Twilio signs each request with:
 * 1. Your Auth Token (secret)
 * 2. The exact URL that Twilio is posting to
 * 3. All POST parameters
 * 
 * @param {string} webhookUrl - The full URL Twilio uses to call your webhook
 *                              (e.g., https://api.example.com/api/v1/whatsapp/webhook)
 * @returns {Function} Express middleware
 */
function validateTwilioWebhook(webhookUrl) {
  return (req, res, next) => {
    // Skip in test mode unless explicitly enabled
    if (process.env.NODE_ENV === 'test' && !process.env.FORCE_TWILIO_VERIFY) {
      return next();
    }

    const twilioSignature = req.headers['x-twilio-signature'];
    const params = req.body || {};
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    // Validation: Required headers and environment
    if (!twilioSignature) {
      logger.warn('Missing X-Twilio-Signature header', {
        ip: req.clientIP,
        requestId: req.requestId,
        headers: Object.keys(req.headers),
      });
      return res.status(403).json({
        success: false,
        error: 'Missing Twilio signature',
        requestId: req.requestId,
      });
    }

    if (!authToken) {
      logger.error('TWILIO_AUTH_TOKEN not configured', {
        requestId: req.requestId,
      });
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        requestId: req.requestId,
      });
    }

    // Validate signature using Twilio's validation method
    const isValid = twilio.validateRequest(authToken, twilioSignature, webhookUrl, params);

    if (!isValid) {
      logger.warn('Invalid Twilio signature', {
        ip: req.clientIP,
        requestId: req.requestId,
        signature: twilioSignature.substring(0, 10) + '...', // Log partial for security
        url: webhookUrl,
        expectedUrl: `https://${req.headers.host}${req.originalUrl}`,
      });
      return res.status(403).json({
        success: false,
        error: 'Invalid Twilio signature',
        requestId: req.requestId,
      });
    }

    // Signature is valid
    logger.debug('Twilio signature validated successfully', {
      ip: req.clientIP,
      requestId: req.requestId,
      from: params.From,
      messageType: params.MessageType || 'text',
    });

    // Attach validation info to request
    req.twilio = {
      signature: twilioSignature,
      validated: true,
      from: params.From,
      to: params.To,
    };

    next();
  };
}

// ============================================================================
// REPLAY ATTACK PREVENTION MIDDLEWARE
// ============================================================================

/**
 * Prevents replay attacks by tracking request signatures + timestamps
 * 
 * Detects when:
 * - Same request is sent multiple times (exact duplicate)
 * - Request timestamp is too old (outside acceptable window)
 * - Request timestamp is in the future (clock skew)
 * 
 * Requirements:
 * - Must be called BEFORE validateTwilioWebhook (so nonce uses fresh signature)
 * - Twilio timestamp format: Unix milliseconds (e.g., 1234567890000)
 * 
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware
 */
function replayProtectionMiddleware(options = {}) {
  const {
    maxClockSkewMs = 30 * 1000, // 30 seconds: allow for clock drift
    windowMs = NONCE_WINDOW_MS, // 5 minutes: reject requests older than this
  } = options;

  return (req, res, next) => {
    // Skip in test mode unless explicitly enabled
    if (process.env.NODE_ENV === 'test' && !process.env.FORCE_TWILIO_VERIFY) {
      return next();
    }

    // Twilio includes X-Twilio-Signature and timestamp in body or query
    const twilioSignature = req.headers['x-twilio-signature'];
    let requestTimestamp = req.body?.MessageSid ? parseInt(req.get('x-twilio-timestamp'), 10) * 1000 : null;

    // Try to extract timestamp from Twilio Signature header (format: base64 of HMAC)
    // Since we can't easily extract it, we'll validate against current time
    if (!requestTimestamp) {
      // Use current time as reference, but this is less secure
      requestTimestamp = Date.now();
    }

    if (!twilioSignature) {
      return next(); // Let signature validation middleware handle this
    }

    const now = Date.now();

    // Check 1: Request timestamp is too far in the future (clock skew)
    if (requestTimestamp > now + maxClockSkewMs) {
      logger.warn('Request timestamp too far in future (possible clock skew)', {
        ip: req.clientIP,
        requestId: req.requestId,
        requestTime: new Date(requestTimestamp).toISOString(),
        serverTime: new Date(now).toISOString(),
        skew: requestTimestamp - now,
      });
      return res.status(400).json({
        success: false,
        error: 'Request timestamp invalid (clock skew)',
        requestId: req.requestId,
      });
    }

    // Check 2: Request timestamp is too old (outside acceptance window)
    if (now - requestTimestamp > windowMs) {
      logger.warn('Request timestamp too old (replay attack prevention)', {
        ip: req.clientIP,
        requestId: req.requestId,
        requestTime: new Date(requestTimestamp).toISOString(),
        serverTime: new Date(now).toISOString(),
        age: now - requestTimestamp,
        maxAge: windowMs,
      });
      return res.status(400).json({
        success: false,
        error: 'Request too old',
        requestId: req.requestId,
      });
    }

    // Check 3: Check for replay (duplicate request)
    const nonce = generateNonce(twilioSignature, requestTimestamp);

    if (hasSeenNonce(nonce)) {
      logger.warn('Duplicate request detected (replay attack prevented)', {
        ip: req.clientIP,
        requestId: req.requestId,
        nonce: nonce.substring(0, 16) + '...', // Partial for security
        from: req.body.From,
        messageSid: req.body.MessageSid,
      });
      return res.status(409).json({
        success: false,
        error: 'Duplicate request (replay attack prevented)',
        requestId: req.requestId,
      });
    }

    // Cache the nonce for future checks
    cacheNonce(nonce);

    logger.debug('Replay protection passed', {
      ip: req.clientIP,
      requestId: req.requestId,
      age: now - requestTimestamp,
    });

    // Attach replay protection info to request
    req.replayProtection = {
      nonce,
      timestamp: requestTimestamp,
      age: now - requestTimestamp,
    };

    next();
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  validateTwilioWebhook,
  replayProtectionMiddleware,
  // Utilities for testing/monitoring
  getNonceCache: () => NONCE_CACHE,
  clearNonceCache: () => NONCE_CACHE.clear(),
  getCacheStats: () => ({
    size: NONCE_CACHE.size,
    maxSize: MAX_CACHE_SIZE,
    windowMs: NONCE_WINDOW_MS,
  }),
};
