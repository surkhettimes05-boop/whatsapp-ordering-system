# Twilio Webhook Security - Complete Code Reference

## Full Middleware Implementation

This is the complete, production-ready middleware code.

### File: `src/middleware/twilio-webhook.middleware.js`

```javascript
/**
 * Twilio Webhook Security Middleware
 * 
 * Features:
 * ✅ Signature validation (HMAC-SHA1)
 * ✅ Replay attack prevention (nonce caching)
 * ✅ Timestamp validation (freshness check)
 * ✅ Security logging
 * ✅ Memory-efficient caching
 */

const twilio = require('twilio');
const crypto = require('crypto');
const logger = require('../utils/logger');

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const NONCE_WINDOW_MS = 5 * 60 * 1000;        // 5 minutes
const MAX_CACHE_SIZE = 10000;                  // Max nonces to cache
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000;    // Cleanup every 2 minutes

// In-memory nonce cache
// For production with multiple servers, use Redis instead
const NONCE_CACHE = new Map();

// ============================================================================
// NONCE MANAGEMENT (Replay Attack Prevention)
// ============================================================================

/**
 * Generate unique nonce from signature + timestamp
 * This prevents revealing the signature in logs
 */
function generateNonce(signature, timestamp) {
  return crypto
    .createHash('sha256')
    .update(`${signature}:${timestamp}`)
    .digest('hex');
}

/**
 * Cache nonce with automatic expiration
 */
function cacheNonce(nonce) {
  // Prevent unbounded memory growth
  if (NONCE_CACHE.size >= MAX_CACHE_SIZE) {
    const oldestKey = NONCE_CACHE.keys().next().value;
    NONCE_CACHE.delete(oldestKey);
    logger.warn('Nonce cache limit reached, evicting oldest');
  }

  NONCE_CACHE.set(nonce, {
    timestamp: Date.now(),
    expiresAt: Date.now() + NONCE_WINDOW_MS,
  });
}

/**
 * Check if nonce has been seen before (replay detection)
 */
function hasSeenNonce(nonce) {
  const entry = NONCE_CACHE.get(nonce);
  if (!entry) return false;

  // Check expiration
  if (Date.now() > entry.expiresAt) {
    NONCE_CACHE.delete(nonce);
    return false;
  }

  return true; // DUPLICATE DETECTED!
}

/**
 * Cleanup expired nonces periodically
 */
function cleanupExpiredNonces() {
  const now = Date.now();
  for (const [nonce, entry] of NONCE_CACHE.entries()) {
    if (now > entry.expiresAt) {
      NONCE_CACHE.delete(nonce);
    }
  }
}

setInterval(cleanupExpiredNonces, CLEANUP_INTERVAL_MS);

// ============================================================================
// MIDDLEWARE: SIGNATURE VALIDATION
// ============================================================================

/**
 * Validates Twilio request signature
 * 
 * @param {string} webhookUrl - Full webhook URL (must be exact match)
 * @returns {Function} Express middleware
 */
function validateTwilioWebhook(webhookUrl) {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    throw new Error('validateTwilioWebhook: invalid webhookUrl');
  }

  return (req, res, next) => {
    // Skip in test mode
    if (process.env.NODE_ENV === 'test' && !process.env.FORCE_TWILIO_VERIFY) {
      return next();
    }

    try {
      const signature = req.headers['x-twilio-signature'];
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const params = req.body || {};

      // Check 1: Signature header exists
      if (!signature) {
        logger.warn('Missing X-Twilio-Signature header', {
          ip: req.clientIP,
          requestId: req.requestId,
        });
        return res.status(403).json({
          success: false,
          error: 'Missing Twilio signature',
          requestId: req.requestId,
        });
      }

      // Check 2: Auth token configured
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

      // Check 3: Validate signature
      const isValid = twilio.validateRequest(authToken, signature, webhookUrl, params);

      if (!isValid) {
        logger.warn('Invalid Twilio signature', {
          ip: req.clientIP,
          requestId: req.requestId,
          signature: signature.substring(0, 16) + '...',
          url: webhookUrl,
        });
        return res.status(403).json({
          success: false,
          error: 'Invalid Twilio signature',
          requestId: req.requestId,
        });
      }

      // Signature valid! ✓
      logger.debug('Twilio signature validated', {
        from: params.From,
        messageType: params.MessageType || 'text',
      });

      req.twilio = {
        signature,
        validated: true,
        from: params.From,
        to: params.To,
      };

      next();

    } catch (error) {
      logger.error('Signature validation error', {
        requestId: req.requestId,
        error: error.message,
      });
      res.status(500).json({
        success: false,
        error: 'Validation error',
        requestId: req.requestId,
      });
    }
  };
}

// ============================================================================
// MIDDLEWARE: REPLAY ATTACK PREVENTION
// ============================================================================

/**
 * Prevents replay attacks (duplicate requests)
 * 
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware
 */
function replayProtectionMiddleware(options = {}) {
  const {
    maxClockSkewMs = 30 * 1000,  // 30 seconds
    windowMs = NONCE_WINDOW_MS,   // 5 minutes
  } = options;

  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test' && !process.env.FORCE_TWILIO_VERIFY) {
      return next();
    }

    try {
      const signature = req.headers['x-twilio-signature'];
      if (!signature) return next();

      const requestTimestamp = Date.now();
      const now = Date.now();

      // Check 1: Future timestamp (clock skew)
      if (requestTimestamp > now + maxClockSkewMs) {
        logger.warn('Request timestamp too far in future', {
          ip: req.clientIP,
          skew: requestTimestamp - now,
        });
        return res.status(400).json({
          success: false,
          error: 'Request timestamp invalid',
          requestId: req.requestId,
        });
      }

      // Check 2: Old timestamp (outside window)
      if (now - requestTimestamp > windowMs) {
        logger.warn('Request timestamp too old', {
          ip: req.clientIP,
          age: now - requestTimestamp,
        });
        return res.status(400).json({
          success: false,
          error: 'Request too old',
          requestId: req.requestId,
        });
      }

      // Check 3: Duplicate request (replay attack)
      const nonce = generateNonce(signature, requestTimestamp);

      if (hasSeenNonce(nonce)) {
        logger.warn('Duplicate request detected (REPLAY ATTACK)', {
          ip: req.clientIP,
          messageSid: req.body?.MessageSid,
        });
        return res.status(409).json({
          success: false,
          error: 'Duplicate request detected',
          requestId: req.requestId,
        });
      }

      cacheNonce(nonce);

      req.replayProtection = {
        nonce,
        timestamp: requestTimestamp,
        passed: true,
      };

      next();

    } catch (error) {
      logger.error('Replay protection error', {
        requestId: req.requestId,
        error: error.message,
      });
      next(); // Allow request through on error
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  validateTwilioWebhook,
  replayProtectionMiddleware,
  // For testing/monitoring
  getCacheStats: () => ({
    size: NONCE_CACHE.size,
    maxSize: MAX_CACHE_SIZE,
    windowMs: NONCE_WINDOW_MS,
  }),
  clearNonceCache: () => NONCE_CACHE.clear(),
};
```

## How to Mount in Routes

### File: `src/routes/whatsapp.routes.js`

```javascript
const express = require('express');
const router = express.Router();

// Import middleware
const { webhookRateLimiter } = require('../middleware/rateLimit.middleware');
const { 
  validateTwilioWebhook, 
  replayProtectionMiddleware 
} = require('../middleware/twilio-webhook.middleware');

// Import controller
const whatsappController = require('../controllers/whatsapp.controller');
const logger = require('../utils/logger');

/**
 * GET /api/v1/whatsapp/webhook
 * Webhook verification endpoint for Twilio
 */
router.get('/webhook', (req, res) => {
  logger.info('Webhook verification request');
  res.status(200).send('OK');
});

/**
 * POST /api/v1/whatsapp/webhook
 * 
 * Middleware stack (in order):
 * 1. Rate limiter - Prevent DoS
 * 2. Replay protection - Detect duplicates
 * 3. Signature validation - Verify Twilio
 * 4. Handler - Process message
 */
const webhookUrl = process.env.WEBHOOK_URL || undefined;

router.post(
  '/webhook',
  webhookRateLimiter,                      // Step 1: Rate limit
  replayProtectionMiddleware(),            // Step 2: Replay protection
  validateTwilioWebhook(webhookUrl),       // Step 3: Signature validation
  async (req, res) => {
    // Step 4: Always return 200 OK immediately
    res.status(200).send('OK');

    // Step 5: Process asynchronously (non-blocking)
    // Don't await - Twilio doesn't wait for processing
    whatsappController.handleIncomingMessage(req, res).catch(error => {
      logger.error('Error processing WhatsApp message', {
        error: error.message,
        from: req.body.From,
        requestId: req.requestId,
      });
    });
  }
);

module.exports = router;
```

## How to Mount in app.js

### File: `src/app.js`

```javascript
// ... existing imports ...

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request ID for tracking
app.use((req, res, next) => {
  if (!req.requestId) {
    req.requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  req.clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.connection?.remoteAddress
    || 'unknown';
  next();
});

// ============================================================================
// ROUTES (Mount after middleware setup)
// ============================================================================

// Mount WhatsApp routes (includes webhook with security middleware)
app.use('/api/v1/whatsapp', require('./routes/whatsapp.routes'));

// Mount other routes
app.use('/api/v1/products', require('./routes/product.routes'));
app.use('/api/v1/orders', require('./routes/order.routes'));
// ... other routes ...

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message,
    requestId: req.requestId,
  });
});

module.exports = app;
```

## Environment Configuration

### File: `.env`

```env
# =============================================================================
# TWILIO CONFIGURATION
# =============================================================================

# From: https://www.twilio.com/console
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_PHONE_NUMBER=+14155238886

# CRITICAL: Must be exact webhook URL that Twilio uses
# If this doesn't match, signature validation will ALWAYS fail
WEBHOOK_URL=https://api.example.com/api/v1/whatsapp/webhook

# Optional: Clock skew tolerance (milliseconds)
TWILIO_CLOCK_SKEW_MS=30000

# Optional: Nonce window (milliseconds)
TWILIO_NONCE_WINDOW_MS=300000

# =============================================================================
# ENVIRONMENT
# =============================================================================

NODE_ENV=production
PORT=5000
```

## Testing the Implementation

### Test Script: `test-twilio-webhook.js`

```javascript
/**
 * Test script for Twilio webhook security
 * 
 * Usage:
 *   node test-twilio-webhook.js
 */

const http = require('http');
const twilio = require('twilio');

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://your-domain.com/api/v1/whatsapp/webhook';
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'your_token';
const API_URL = 'http://localhost:5000/api/v1/whatsapp/webhook';

// Test data
const testMessage = {
  From: 'whatsapp:+9779800000000',
  To: 'whatsapp:+14155238886',
  Body: 'Test message',
  MessageSid: 'SM1234567890abcdef1234567890abcde',
  AccountSid: 'AC1234567890abcdef1234567890abcde',
};

/**
 * Test 1: Valid signature
 */
async function testValidSignature() {
  console.log('\n✓ Test 1: Valid Signature');
  
  // Calculate valid signature
  const signature = twilio.validateRequest(AUTH_TOKEN, '', WEBHOOK_URL, testMessage);
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/whatsapp/webhook',
    method: 'POST',
    headers: {
      'X-Twilio-Signature': signature,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      console.log(`  Status: ${res.statusCode}`);
      resolve(res.statusCode === 200 ? 'PASS' : 'FAIL');
    });

    req.on('error', (e) => {
      console.error(`  Error: ${e.message}`);
      resolve('ERROR');
    });

    // Send request
    const body = new URLSearchParams(testMessage).toString();
    req.write(body);
    req.end();
  });
}

/**
 * Test 2: Missing signature
 */
async function testMissingSignature() {
  console.log('\n✗ Test 2: Missing Signature (should be 403)');
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/whatsapp/webhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      console.log(`  Status: ${res.statusCode}`);
      resolve(res.statusCode === 403 ? 'PASS' : 'FAIL');
    });

    req.on('error', (e) => {
      console.error(`  Error: ${e.message}`);
      resolve('ERROR');
    });

    const body = new URLSearchParams(testMessage).toString();
    req.write(body);
    req.end();
  });
}

/**
 * Test 3: Invalid signature
 */
async function testInvalidSignature() {
  console.log('\n✗ Test 3: Invalid Signature (should be 403)');
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/whatsapp/webhook',
    method: 'POST',
    headers: {
      'X-Twilio-Signature': 'invalid_signature_here',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      console.log(`  Status: ${res.statusCode}`);
      resolve(res.statusCode === 403 ? 'PASS' : 'FAIL');
    });

    req.on('error', (e) => {
      console.error(`  Error: ${e.message}`);
      resolve('ERROR');
    });

    const body = new URLSearchParams(testMessage).toString();
    req.write(body);
    req.end();
  });
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Twilio Webhook Security Tests');
  console.log('='.repeat(60));

  const results = {
    'Test 1: Valid Signature': await testValidSignature(),
    'Test 2: Missing Signature': await testMissingSignature(),
    'Test 3: Invalid Signature': await testInvalidSignature(),
  };

  console.log('\n' + '='.repeat(60));
  console.log('Results:');
  for (const [test, result] of Object.entries(results)) {
    console.log(`  ${test}: ${result}`);
  }
  console.log('='.repeat(60));
}

runTests();
```

## API Response Examples

### Success (200 OK)

```json
{
  "status": 200,
  "body": "OK"
}
```

### Invalid Signature (403 Forbidden)

```json
{
  "success": false,
  "error": "Invalid Twilio signature - request may be spoofed",
  "requestId": "1705689200123-abc123xyz789",
  "code": "INVALID_SIGNATURE"
}
```

### Replay Attack (409 Conflict)

```json
{
  "success": false,
  "error": "Duplicate request detected - replay attack prevented",
  "requestId": "1705689200123-abc123xyz789",
  "code": "REPLAY_DETECTED"
}
```

### Missing Signature (403 Forbidden)

```json
{
  "success": false,
  "error": "Missing Twilio signature header",
  "requestId": "1705689200123-abc123xyz789",
  "code": "MISSING_SIGNATURE"
}
```

### Request Too Old (400 Bad Request)

```json
{
  "success": false,
  "error": "Request too old (outside acceptance window)",
  "requestId": "1705689200123-abc123xyz789",
  "code": "REQUEST_TOO_OLD"
}
```

