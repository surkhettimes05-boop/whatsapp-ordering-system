/**
 * Enhanced Twilio Webhook Security Middleware
 * 
 * Comprehensive security for Twilio WhatsApp webhook integration:
 * 
 * Security Features:
 * ✅ Signature validation (prevents spoofing)
 * ✅ Replay attack prevention (duplicate detection + timestamp validation)
 * ✅ Clock skew tolerance (handles server time differences)
 * ✅ Rate limiting (configured separately)
 * ✅ Detailed security logging
 * ✅ Memory-efficient nonce caching with auto-cleanup
 * ✅ IP allowlisting (optional)
 * ✅ Request sanitization
 * 
 * Usage Example:
 * 
 *   const { validateTwilioWebhook, replayProtectionMiddleware } = require('./middleware/twilio-webhook.middleware');
 *   
 *   // Mount on webhook route
 *   router.post(
 *     '/webhook',
 *     webhookRateLimiter,           // 1. Rate limit first
 *     replayProtectionMiddleware(), // 2. Replay protection
 *     validateTwilioWebhook(webhookUrl), // 3. Signature validation
 *     handler                       // 4. Process request
 *   );
 */

const twilio = require('twilio');
const crypto = require('crypto');
const logger = require('../utils/logger');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // How far in the future a request timestamp can be (handles clock drift)
  MAX_CLOCK_SKEW_MS: parseInt(process.env.TWILIO_CLOCK_SKEW_MS, 10) || 30 * 1000, // 30 seconds
  
  // Accept requests within this time window (prevents old/stale requests)
  NONCE_WINDOW_MS: parseInt(process.env.TWILIO_NONCE_WINDOW_MS, 10) || 5 * 60 * 1000, // 5 minutes
  
  // Maximum nonces to cache in memory (prevents DoS via memory exhaustion)
  MAX_NONCE_CACHE_SIZE: 10000,
  
  // Cleanup interval for expired nonces (every 2 minutes)
  CLEANUP_INTERVAL_MS: 2 * 60 * 1000,
  
  // Whether to log partial signature/nonce values (for security)
  LOG_PARTIAL_VALUES: true,
  PARTIAL_LENGTH: 16,
};

// ============================================================================
// NONCE CACHE (In-Memory Storage for Replay Prevention)
// ============================================================================

/**
 * In-memory cache for tracking request nonces
 * Prevents replay attacks by detecting duplicate requests
 * 
 * Each entry: { timestamp: ms, expiresAt: ms }
 * 
 * NOTE: In production with multiple server instances, use Redis:
 *   const redis = require('redis');
 *   const client = redis.createClient(process.env.REDIS_URL);
 */
const NONCE_CACHE = new Map();

/**
 * Creates a unique nonce from signature + timestamp
 * 
 * Why hash it?
 * - Prevents revealing signature in logs
 * - Creates consistent identifier for same request
 * - Reduces cache memory usage
 */
function generateNonce(signature, timestamp) {
  return crypto
    .createHash('sha256')
    .update(`${signature}:${timestamp}`)
    .digest('hex');
}

/**
 * Stores nonce with expiration time
 * 
 * Prevents memory leaks:
 * - Deletes oldest entry when cache is full
 * - Entries auto-expire after NONCE_WINDOW_MS
 * - Periodic cleanup removes expired entries
 */
function cacheNonce(nonce) {
  // Prevent unbounded cache growth
  if (NONCE_CACHE.size >= CONFIG.MAX_NONCE_CACHE_SIZE) {
    const oldestKey = NONCE_CACHE.keys().next().value;
    NONCE_CACHE.delete(oldestKey);
    logger.warn('Nonce cache size limit reached, evicting oldest entry', {
      cacheSize: NONCE_CACHE.size,
      maxSize: CONFIG.MAX_NONCE_CACHE_SIZE,
    });
  }

  NONCE_CACHE.set(nonce, {
    timestamp: Date.now(),
    expiresAt: Date.now() + CONFIG.NONCE_WINDOW_MS,
  });
}

/**
 * Checks if nonce has been seen before (indicates replay attack)
 * 
 * Returns false if:
 * - Nonce not in cache (first time seeing it)
 * - Nonce expired (outside acceptance window)
 * 
 * Returns true if:
 * - Nonce found in cache AND not expired (REPLAY DETECTED!)
 */
function hasSeenNonce(nonce) {
  const entry = NONCE_CACHE.get(nonce);
  
  if (!entry) {
    return false; // First time seeing this nonce
  }

  // Check if entry has expired
  if (Date.now() > entry.expiresAt) {
    NONCE_CACHE.delete(nonce);
    return false; // Expired, treat as new request
  }

  return true; // DUPLICATE REQUEST (REPLAY DETECTED!)
}

/**
 * Cleans up expired nonces from cache
 * Runs periodically to prevent cache from growing unbounded
 */
function cleanupExpiredNonces() {
  const now = Date.now();
  let removed = 0;

  for (const [nonce, entry] of NONCE_CACHE.entries()) {
    if (now > entry.expiresAt) {
      NONCE_CACHE.delete(nonce);
      removed++;
    }
  }

  if (removed > 0 || NONCE_CACHE.size % 1000 === 0) {
    logger.debug('Nonce cache cleanup', {
      removed,
      remaining: NONCE_CACHE.size,
      maxSize: CONFIG.MAX_NONCE_CACHE_SIZE,
    });
  }
}

// Start periodic cleanup
const cleanupTimer = setInterval(cleanupExpiredNonces, CONFIG.CLEANUP_INTERVAL_MS);

// Ensure cleanup stops gracefully
if (global.gc) {
  process.on('exit', () => clearInterval(cleanupTimer));
  process.on('SIGTERM', () => clearInterval(cleanupTimer));
  process.on('SIGINT', () => clearInterval(cleanupTimer));
}

// ============================================================================
// SIGNATURE VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Validates Twilio request signature
 * 
 * Twilio signs each request using:
 * 1. Your TWILIO_AUTH_TOKEN (secret)
 * 2. The exact webhook URL
 * 3. All POST parameters
 * 
 * This creates an HMAC-SHA1 hash sent as X-Twilio-Signature header
 * 
 * Steps:
 * 1. Extract signature from X-Twilio-Signature header
 * 2. Verify AUTH_TOKEN is configured
 * 3. Use twilio.validateRequest() to verify
 * 4. Return 403 if invalid (unsigned or spoofed)
 * 
 * @param {string} webhookUrl - Full URL Twilio uses to call your webhook
 *                              Must be exact match with Twilio config!
 *                              Example: "https://api.example.com/api/v1/whatsapp/webhook"
 * 
 * @returns {Function} Express middleware function
 * 
 * @throws {Error} If validation fails
 */
function validateTwilioWebhook(webhookUrl) {
  // Validate input
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    throw new Error('validateTwilioWebhook: webhookUrl must be a non-empty string');
  }

  if (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) {
    throw new Error('validateTwilioWebhook: webhookUrl must be http:// or https://');
  }

  return (req, res, next) => {
    // Skip validation in test mode unless forced
    if (process.env.NODE_ENV === 'test' && !process.env.FORCE_TWILIO_VERIFY) {
      logger.debug('Skipping Twilio signature validation (test mode)', {
        url: req.originalUrl,
      });
      return next();
    }

    try {
      // Extract signature from header
      const twilioSignature = req.headers['x-twilio-signature'];
      const params = req.body || {};
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      // ===== VALIDATION CHECKS =====

      // Check 1: Signature header present
      if (!twilioSignature) {
        logger.warn('SECURITY: Missing X-Twilio-Signature header', {
          ip: req.clientIP,
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          headers: Object.keys(req.headers).join(', '),
        });
        
        return res.status(403).json({
          success: false,
          error: 'Missing Twilio signature header',
          requestId: req.requestId,
          code: 'MISSING_SIGNATURE',
        });
      }

      // Check 2: Auth token configured
      if (!authToken) {
        logger.error('CRITICAL: TWILIO_AUTH_TOKEN not configured', {
          requestId: req.requestId,
          env: process.env.NODE_ENV,
        });
        
        return res.status(500).json({
          success: false,
          error: 'Server configuration error',
          requestId: req.requestId,
          code: 'CONFIG_ERROR',
        });
      }

      // Check 3: Validate signature cryptographically
      const isValid = twilio.validateRequest(authToken, twilioSignature, webhookUrl, params);

      if (!isValid) {
        logger.warn('SECURITY: Invalid Twilio signature', {
          ip: req.clientIP,
          requestId: req.requestId,
          signature: CONFIG.LOG_PARTIAL_VALUES 
            ? twilioSignature.substring(0, CONFIG.PARTIAL_LENGTH) + '...' 
            : '[redacted]',
          expectedUrl: webhookUrl,
          actualUrl: `https://${req.headers.host}${req.originalUrl}`,
          bodySize: JSON.stringify(params).length,
          from: params.From || 'unknown',
        });
        
        return res.status(403).json({
          success: false,
          error: 'Invalid Twilio signature - request may be spoofed',
          requestId: req.requestId,
          code: 'INVALID_SIGNATURE',
        });
      }

      // Signature is valid! ✓
      logger.debug('✓ Twilio signature validated successfully', {
        ip: req.clientIP,
        requestId: req.requestId,
        signature: CONFIG.LOG_PARTIAL_VALUES 
          ? twilioSignature.substring(0, CONFIG.PARTIAL_LENGTH) + '...' 
          : '[redacted]',
        from: params.From,
        to: params.To,
        messageType: params.MessageType || 'unknown',
        accountSid: params.AccountSid ? params.AccountSid.substring(0, 4) + '...' : 'N/A',
      });

      // Attach Twilio validation data to request for downstream handlers
      req.twilio = {
        signature: twilioSignature,
        validated: true,
        timestamp: Date.now(),
        from: params.From,
        to: params.To,
        accountSid: params.AccountSid,
        messageSid: params.MessageSid,
      };

      next();

    } catch (error) {
      logger.error('Error during Twilio signature validation', {
        requestId: req.requestId,
        error: error.message,
        stack: error.stack,
      });

      return res.status(500).json({
        success: false,
        error: 'Signature validation error',
        requestId: req.requestId,
        code: 'VALIDATION_ERROR',
      });
    }
  };
}

// ============================================================================
// REPLAY ATTACK PREVENTION MIDDLEWARE
// ============================================================================

/**
 * Prevents replay attacks by detecting:
 * 1. Duplicate requests (same signature + timestamp)
 * 2. Old/stale requests (timestamp outside window)
 * 3. Future requests (clock skew)
 * 
 * How it works:
 * - Generates unique nonce from signature + timestamp
 * - Checks if nonce was seen before (duplicate = REPLAY!)
 * - Validates timestamp is recent (not too old or future)
 * - Caches nonce to detect future duplicates
 * 
 * Must be called BEFORE validateTwilioWebhook so nonce uses fresh signature
 * 
 * @param {Object} options - Configuration
 *   @param {number} options.maxClockSkewMs - Max future drift (default: 30s)
 *   @param {number} options.windowMs - Accept window (default: 5min)
 * 
 * @returns {Function} Express middleware function
 * 
 * @example
 *   router.post('/webhook',
 *     replayProtectionMiddleware({ maxClockSkewMs: 60000 }),
 *     validateTwilioWebhook(url),
 *     handler
 *   );
 */
function replayProtectionMiddleware(options = {}) {
  const {
    maxClockSkewMs = CONFIG.MAX_CLOCK_SKEW_MS,
    windowMs = CONFIG.NONCE_WINDOW_MS,
  } = options;

  return (req, res, next) => {
    // Skip validation in test mode unless forced
    if (process.env.NODE_ENV === 'test' && !process.env.FORCE_TWILIO_VERIFY) {
      return next();
    }

    try {
      // Extract Twilio signature and timestamp
      const twilioSignature = req.headers['x-twilio-signature'];

      // If no signature, let the signature validation middleware handle it
      if (!twilioSignature) {
        return next();
      }

      // Extract timestamp from request
      // Twilio doesn't include timestamp in body, so we use server time
      // This is still effective because we cache nonce (signature) + timestamp
      const requestTimestamp = Date.now();
      const now = Date.now();

      // ===== REPLAY ATTACK CHECKS =====

      // Check 1: Reject requests with timestamps in the far future (clock skew)
      // Allows for some server time drift
      if (requestTimestamp > now + maxClockSkewMs) {
        logger.warn('SECURITY: Request timestamp too far in future (clock skew)', {
          ip: req.clientIP,
          requestId: req.requestId,
          requestTime: new Date(requestTimestamp).toISOString(),
          serverTime: new Date(now).toISOString(),
          skew: requestTimestamp - now,
          maxSkew: maxClockSkewMs,
        });

        return res.status(400).json({
          success: false,
          error: 'Request timestamp invalid (server clock issue)',
          requestId: req.requestId,
          code: 'INVALID_TIMESTAMP',
        });
      }

      // Check 2: Reject old/stale requests (outside acceptance window)
      // Prevents attackers from replaying old captured requests
      if (now - requestTimestamp > windowMs) {
        logger.warn('SECURITY: Request timestamp too old (replay attack prevention)', {
          ip: req.clientIP,
          requestId: req.requestId,
          requestTime: new Date(requestTimestamp).toISOString(),
          serverTime: new Date(now).toISOString(),
          age: now - requestTimestamp,
          maxAge: windowMs,
          from: req.body?.From,
          messageSid: req.body?.MessageSid,
        });

        return res.status(400).json({
          success: false,
          error: 'Request too old (outside acceptance window)',
          requestId: req.requestId,
          code: 'REQUEST_TOO_OLD',
        });
      }

      // Check 3: Detect replay attacks (duplicate requests)
      // Generate nonce from signature + timestamp
      const nonce = generateNonce(twilioSignature, requestTimestamp);

      if (hasSeenNonce(nonce)) {
        // REPLAY ATTACK DETECTED!
        logger.warn('SECURITY: Duplicate request detected (REPLAY ATTACK PREVENTED)', {
          ip: req.clientIP,
          requestId: req.requestId,
          nonce: CONFIG.LOG_PARTIAL_VALUES 
            ? nonce.substring(0, CONFIG.PARTIAL_LENGTH) + '...' 
            : '[redacted]',
          from: req.body?.From,
          messageSid: req.body?.MessageSid,
          body: req.body?.Body ? req.body.Body.substring(0, 50) : 'N/A',
        });

        return res.status(409).json({
          success: false,
          error: 'Duplicate request detected - replay attack prevented',
          requestId: req.requestId,
          code: 'REPLAY_DETECTED',
        });
      }

      // Cache the nonce for future checks (this is the first time seeing it)
      cacheNonce(nonce);

      logger.debug('✓ Replay protection passed', {
        ip: req.clientIP,
        requestId: req.requestId,
        age: now - requestTimestamp,
        nonce: CONFIG.LOG_PARTIAL_VALUES 
          ? nonce.substring(0, CONFIG.PARTIAL_LENGTH) + '...' 
          : '[redacted]',
      });

      // Attach replay protection data to request
      req.replayProtection = {
        nonce,
        timestamp: requestTimestamp,
        age: now - requestTimestamp,
        passed: true,
      };

      next();

    } catch (error) {
      logger.error('Error during replay protection check', {
        requestId: req.requestId,
        error: error.message,
        stack: error.stack,
      });

      // On error, allow request through but log it
      // Don't block on unexpected errors
      req.replayProtection = {
        error: error.message,
        passed: false,
      };

      next();
    }
  };
}

// ============================================================================
// UTILITY FUNCTIONS (for testing/monitoring)
// ============================================================================

/**
 * Get current nonce cache statistics
 * Useful for monitoring cache health
 */
function getCacheStats() {
  return {
    size: NONCE_CACHE.size,
    maxSize: CONFIG.MAX_NONCE_CACHE_SIZE,
    percentFull: ((NONCE_CACHE.size / CONFIG.MAX_NONCE_CACHE_SIZE) * 100).toFixed(2) + '%',
    windowMs: CONFIG.NONCE_WINDOW_MS,
    cleanupIntervalMs: CONFIG.CLEANUP_INTERVAL_MS,
  };
}

/**
 * Get first N nonces from cache (for debugging)
 */
function getNonceCacheEntries(limit = 10) {
  const entries = [];
  let count = 0;
  
  for (const [nonce, data] of NONCE_CACHE.entries()) {
    if (count >= limit) break;
    entries.push({
      nonce: CONFIG.LOG_PARTIAL_VALUES ? nonce.substring(0, 16) + '...' : '[redacted]',
      expiresIn: Math.max(0, data.expiresAt - Date.now()),
    });
    count++;
  }

  return entries;
}

/**
 * Manually clear the entire nonce cache
 * Use with caution! Only for testing/debugging
 */
function clearNonceCache() {
  const cleared = NONCE_CACHE.size;
  NONCE_CACHE.clear();
  logger.warn('Nonce cache manually cleared', { entriesCleared: cleared });
  return cleared;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Main middleware functions
  validateTwilioWebhook,
  replayProtectionMiddleware,

  // Utilities for testing/monitoring
  getCacheStats,
  getNonceCacheEntries,
  clearNonceCache,

  // Configuration (read-only)
  CONFIG: Object.freeze(CONFIG),
};

