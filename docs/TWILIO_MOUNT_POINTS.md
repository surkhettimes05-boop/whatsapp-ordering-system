# Twilio Webhook - Exact Mount Points in app.js

## How to Mount the Security Middleware

### Current Architecture (Already Implemented)

Your system is already fully configured. Here's exactly how it's set up:

## File: `src/app.js`

This file loads all the routes, including the WhatsApp webhook routes:

```javascript
// Around line 75 in app.js
console.log('⏳ Loading WhatsApp routes...');
app.use('/api/v1/whatsapp', require('./routes/whatsapp.routes'));
```

This single line automatically mounts ALL WhatsApp routes, including the webhook with security middleware.

## File: `src/routes/whatsapp.routes.js`

This is where the security middleware is actually mounted:

```javascript
const express = require('express');
const router = express.Router();

// Import security middleware
const { webhookRateLimiter } = require('../middleware/rateLimit.middleware');
const { 
  validateTwilioWebhook, 
  replayProtectionMiddleware 
} = require('../middleware/twilio-webhook.middleware');

// Import controller
const whatsappController = require('../controllers/whatsapp.controller');

// ============================================================================
// GET /api/v1/whatsapp/webhook (Verification)
// ============================================================================
router.get('/webhook', webhookRateLimiter, (req, res) => {
  res.status(200).send('OK');
});

// ============================================================================
// POST /api/v1/whatsapp/webhook (Incoming Messages)
// 
// SECURITY MIDDLEWARE STACK (in order of execution):
// 1. webhookRateLimiter           - Prevent DoS (60 req/min)
// 2. replayProtectionMiddleware() - Detect replay attacks
// 3. validateTwilioWebhook()      - Validate signature
// 4. Handler                       - Process message
// ============================================================================

const webhookUrl = process.env.WEBHOOK_URL || undefined;

router.post(
  '/webhook',
  // SECURITY LAYER 1: Rate Limiting
  webhookRateLimiter,
  
  // SECURITY LAYER 2: Replay Attack Prevention
  replayProtectionMiddleware(),
  
  // SECURITY LAYER 3: Signature Validation
  validateTwilioWebhook(webhookUrl),
  
  // HANDLER: Process Message
  async (req, res) => {
    // IMPORTANT: Return 200 OK immediately to Twilio
    // This prevents Twilio from timing out and retrying
    res.status(200).send('OK');

    // Process message asynchronously (don't await)
    // This allows the handler to return quickly
    // while message processing happens in the background
    whatsappController.handleIncomingMessage(req, res).catch(error => {
      logger.error('Error processing WhatsApp message', {
        error: error.message,
        stack: error.stack,
        from: req.body.From,
        body: req.body,
        requestId: req.requestId,
      });
    });
  }
);

module.exports = router;
```

## Complete Request Flow

```
1. Browser/Client makes HTTP request to:
   POST /api/v1/whatsapp/webhook

2. Express routes it to:
   app.use('/api/v1/whatsapp', require('./routes/whatsapp.routes'))

3. whatsapp.routes.js router handles it:
   router.post('/webhook', ...middleware..., handler)

4. Request goes through middleware chain:

   ↓ Request arrives ↓
   
   [Middleware 1: webhookRateLimiter]
   • Check: Is this IP rate limited?
   • Allow or reject
   
   ↓ If passed ↓
   
   [Middleware 2: replayProtectionMiddleware()]
   • Check: Is this a duplicate request?
   • Check: Is timestamp valid?
   • Allow or reject
   
   ↓ If passed ↓
   
   [Middleware 3: validateTwilioWebhook(webhookUrl)]
   • Check: Is signature valid?
   • Check: Is this from Twilio?
   • Allow or reject
   
   ↓ If all passed ↓
   
   [Handler: async (req, res) => {...}]
   • Send 200 OK to Twilio immediately
   • Process message asynchronously
```

## Detailed Middleware Breakdown

### Middleware 1: Rate Limiter

**File**: `src/middleware/rateLimit.middleware.js`

```javascript
// Rejects more than 60 requests per minute from the same IP
// Returns: 429 Too Many Requests
// Response time: <1ms

const rateLimit = require('express-rate-limit');

const webhookRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 60,                   // 60 requests per minute
  message: 'Too many webhook requests, please try again later',
  standardHeaders: true,     // Return rate limit info in headers
  skip: (req) => process.env.NODE_ENV === 'test',
});

module.exports = { webhookRateLimiter };
```

### Middleware 2: Replay Protection

**File**: `src/middleware/twilio-webhook.middleware.js` (Line ~200-325)

```javascript
function replayProtectionMiddleware(options = {}) {
  const {
    maxClockSkewMs = 30 * 1000,  // Allow 30s clock drift
    windowMs = 5 * 60 * 1000,     // Accept 5-minute window
  } = options;

  return (req, res, next) => {
    // Check 1: Timestamp is recent enough (not >5 min old)
    // Returns: 400 Bad Request "Request too old"
    
    // Check 2: Timestamp not too far in future (not >30s)
    // Returns: 400 Bad Request "Invalid timestamp"
    
    // Check 3: Request is not a duplicate (replay attack)
    // Returns: 409 Conflict "Duplicate request detected"
    
    // If all checks pass: Add nonce to cache and continue
    next();
  };
}
```

### Middleware 3: Signature Validation

**File**: `src/middleware/twilio-webhook.middleware.js` (Line ~100-195)

```javascript
function validateTwilioWebhook(webhookUrl) {
  return (req, res, next) => {
    // Check 1: X-Twilio-Signature header exists
    // Returns: 403 Forbidden "Missing Twilio signature"
    
    // Check 2: TWILIO_AUTH_TOKEN is configured
    // Returns: 500 Error "Server configuration error"
    
    // Check 3: Signature is cryptographically valid
    // Uses: HMAC-SHA1(TWILIO_AUTH_TOKEN, webhookUrl + params)
    // Returns: 403 Forbidden "Invalid Twilio signature"
    
    // If all checks pass: Attach req.twilio metadata and continue
    next();
  };
}
```

## Environment Configuration

### File: `.env`

```env
# CRITICAL: Get these from Twilio console
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here

# CRITICAL: Must match exactly what's configured in Twilio
# This is the full URL Twilio will POST to
WEBHOOK_URL=https://api.example.com/api/v1/whatsapp/webhook

# OPTIONAL: Fine-tune security parameters
# How far in the future a timestamp can be (handles clock drift)
TWILIO_CLOCK_SKEW_MS=30000

# How long to accept requests (prevents stale replays)
TWILIO_NONCE_WINDOW_MS=300000
```

## Request Object After Middleware

After all middleware passes, the handler receives:

```javascript
req.clientIP              // IP address of request source
req.requestId             // Unique ID for logging
req.body                  // Twilio message data
  .From                   // "whatsapp:+9779800000000"
  .To                     // "whatsapp:+14155238886"
  .Body                   // Message content
  .MessageSid             // Unique message ID
  .AccountSid             // Twilio account ID

req.twilio                // Added by validateTwilioWebhook
  .signature              // X-Twilio-Signature header
  .validated              // true (if reached handler)
  .from                   // From number
  .to                     // To number

req.replayProtection      // Added by replayProtectionMiddleware
  .nonce                  // SHA256 hash of signature+timestamp
  .timestamp              // Request timestamp
  .age                    // How old the request is (ms)
```

## Error Responses

When security middleware rejects a request:

```javascript
// Rate Limit Exceeded
{
  success: false,
  error: "Too many webhook requests, please try again later",
  status: 429
}

// Missing Signature
{
  success: false,
  error: "Missing Twilio signature header",
  requestId: "req-id-123",
  code: "MISSING_SIGNATURE",
  status: 403
}

// Invalid Signature
{
  success: false,
  error: "Invalid Twilio signature - request may be spoofed",
  requestId: "req-id-123",
  code: "INVALID_SIGNATURE",
  status: 403
}

// Replay Attack Detected
{
  success: false,
  error: "Duplicate request detected - replay attack prevented",
  requestId: "req-id-123",
  code: "REPLAY_DETECTED",
  status: 409
}

// Timestamp Invalid
{
  success: false,
  error: "Request timestamp invalid (server clock issue)",
  requestId: "req-id-123",
  code: "INVALID_TIMESTAMP",
  status: 400
}
```

## How to Add Additional Middleware

If you want to add more middleware to the webhook route:

```javascript
// In src/routes/whatsapp.routes.js

router.post(
  '/webhook',
  webhookRateLimiter,              // Security Layer 1
  replayProtectionMiddleware(),    // Security Layer 2
  validateTwilioWebhook(webhookUrl), // Security Layer 3
  
  // ADD YOUR MIDDLEWARE HERE:
  myCustomMiddleware1,             // Example: Logging
  myCustomMiddleware2,             // Example: Validation
  
  // Handler at the end
  async (req, res) => {
    res.status(200).send('OK');
    // ...
  }
);
```

**Order matters!** Always put security middleware FIRST:
1. Rate limiter
2. Replay protection
3. Signature validation
4. Your custom middleware
5. Handler

## Testing Middleware

### Test with Valid Signature

```javascript
// test-webhook.js
const twilio = require('twilio');
const axios = require('axios');

const authToken = process.env.TWILIO_AUTH_TOKEN;
const webhookUrl = process.env.WEBHOOK_URL;
const params = {
  From: 'whatsapp:+9779800000000',
  To: 'whatsapp:+14155238886',
  Body: 'Test message',
  MessageSid: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
};

// Calculate valid signature
const signature = twilio.validateRequest(authToken, '', webhookUrl, params);

// Send request
axios.post('http://localhost:5000/api/v1/whatsapp/webhook', params, {
  headers: {
    'X-Twilio-Signature': signature,
  },
}).then(res => {
  console.log('Status:', res.status);
  console.log('Response:', res.data);
});
```

### Test Rate Limiting

```bash
# Send 61 requests in 60 seconds
for i in {1..61}; do
  curl -X GET http://localhost:5000/api/v1/whatsapp/webhook
done

# First 60: 200 OK
# 61st: 429 Too Many Requests
```

### Test Replay Detection

```bash
# Send same request twice
curl -X POST http://localhost:5000/api/v1/whatsapp/webhook \
  -H "X-Twilio-Signature: valid_sig" \
  -d "From=whatsapp:..." 

# First: 200 OK
# Second: 409 Conflict (replay detected)
```

## Monitoring

Check logs for security events:

```bash
# View all security-related logs
grep -i "signature\|replay\|validation" logs/security.log

# Count rejections
grep -c "403" logs/security.log
grep -c "409" logs/security.log
```

