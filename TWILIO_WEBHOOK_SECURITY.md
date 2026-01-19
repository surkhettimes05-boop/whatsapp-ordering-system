# Twilio Webhook Security Middleware Implementation

## Overview

This document describes the complete Twilio webhook signature validation middleware with replay attack prevention for your WhatsApp ordering system.

## Security Features

### 1. **Signature Validation**
- Validates `X-Twilio-Signature` header using Twilio's cryptographic verification
- Prevents spoofed requests from non-Twilio sources
- Uses your `TWILIO_AUTH_TOKEN` as the shared secret
- Validates against the exact webhook URL

### 2. **Replay Attack Prevention**
- Detects duplicate requests (exact message replays)
- Validates request timestamps to prevent old requests
- Allows configurable clock skew tolerance (default: 30 seconds)
- Uses nonce caching with 5-minute expiration window
- In-memory cache prevents memory leaks with max size limits

### 3. **Detailed Security Logging**
- Logs all security validations
- Records rejected requests with security reasons
- Tracks request source IP addresses
- Partially masks sensitive data (signatures, nonces)

## Middleware Stack

```
Request Flow:
  ↓
1. webhookRateLimiter (60 req/min)
  ↓
2. replayProtectionMiddleware() 
  ↓
3. validateTwilioWebhook(webhookUrl)
  ↓
4. Handler (whatsappController.handleIncomingMessage)
```

**Important**: Order matters! Call middleware in this order:
1. Rate limiter first (prevent DoS)
2. Replay protection (uses nonce generation)
3. Signature validation (most expensive operation)

## Configuration

### Required Environment Variables

```env
# .env
TWILIO_AUTH_TOKEN=your_auth_token_here
WEBHOOK_URL=https://your-domain.com/api/v1/whatsapp/webhook
```

⚠️ **Critical**: The `WEBHOOK_URL` must be the exact URL that Twilio uses to call your webhook. If it doesn't match, signature validation will fail!

### Optional Configuration

```env
# Clock skew tolerance (milliseconds, default: 30000)
TWILIO_CLOCK_SKEW_MS=30000

# Nonce window (milliseconds, default: 300000 = 5 minutes)
TWILIO_NONCE_WINDOW_MS=300000
```

## Current Implementation

Your system is already using this middleware in [src/routes/whatsapp.routes.js](src/routes/whatsapp.routes.js):

```javascript
router.post(
  '/webhook',
  webhookRateLimiter,
  replayProtectionMiddleware(),
  validateTwilioWebhook(webhookUrl),
  async (req, res) => {
    // Handler
  }
);
```

The middleware implementation is in [src/middleware/twilio-webhook.middleware.js](src/middleware/twilio-webhook.middleware.js).

## Testing Requests

### Valid Request (will pass validation)

```bash
curl -X POST https://your-domain.com/api/v1/whatsapp/webhook \
  -H "X-Twilio-Signature: valid_signature_here" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:%2B9779800000000&To=whatsapp:%2B14155238886&Body=Hello"
```

### Invalid Signatures (will be rejected)

1. **Missing Signature**: Returns 403 with "Missing Twilio signature"
2. **Invalid Signature**: Returns 403 with "Invalid Twilio signature"
3. **Wrong URL**: Signature won't match if URL doesn't match Twilio's config
4. **Tampered Body**: Signature won't match if request body is modified
5. **Duplicate Request**: Returns 409 with "Duplicate request (replay attack prevented)"
6. **Old Request**: Returns 400 with "Request too old"

## Security Headers Added to Request

After validation, the request object includes:

```javascript
req.twilio = {
  signature: 'x-twilio-signature-value',
  validated: true,
  from: 'whatsapp:+9779800000000',
  to: 'whatsapp:+14155238886',
};

req.replayProtection = {
  nonce: 'sha256-hash-of-signature-and-timestamp',
  timestamp: 1234567890000,
  age: 5000, // milliseconds old
};
```

## How Signature Validation Works

1. **Twilio Creates Signature**:
   - Takes your Auth Token (secret)
   - Creates HMAC-SHA1 of: `URL + POST parameters`
   - Sends as `X-Twilio-Signature` header

2. **Your Server Validates**:
   - Retrieves Auth Token from `TWILIO_AUTH_TOKEN`
   - Recreates HMAC-SHA1 using same inputs
   - Compares with provided signature
   - If they match → Request is genuine

Example:
```
Your Auth Token: "abc123xyz789"
Twilio's Secret Calculation:
  HMAC-SHA1("abc123xyz789", 
    "https://api.example.com/api/v1/whatsapp/webhook" +
    "From=whatsapp:+9779800000000" +
    "To=whatsapp:+14155238886" +
    "Body=Hello"
  ) = "jW/J9ztEWCxd8UVHt7FQlCKJcew="
```

## How Replay Attack Prevention Works

1. **Nonce Generation**:
   ```
   nonce = SHA256(signature + timestamp)
   ```

2. **First Request**:
   - Generates nonce
   - Checks if nonce exists in cache → Not found ✓
   - Adds nonce to cache with timestamp
   - Processes request

3. **Duplicate Request (Replay)**:
   - Generates same nonce (same signature + timestamp)
   - Checks cache → Found ✓ (Duplicate detected!)
   - Rejects with 409 status

4. **Cache Cleanup**:
   - Runs every 2 minutes
   - Removes expired entries (older than 5 minutes)
   - Prevents unbounded memory growth

## Production Checklist

- [ ] `TWILIO_AUTH_TOKEN` is set in production `.env`
- [ ] `WEBHOOK_URL` matches Twilio webhook configuration
- [ ] `NODE_ENV=production` is set
- [ ] Redis is configured (or in-memory cache will be used)
- [ ] Rate limiting is enabled (`webhookRateLimiter`)
- [ ] Logs are monitored for security warnings
- [ ] Error handlers catch any validation failures
- [ ] Webhook timeout is set to prevent Twilio retries

## Monitoring & Troubleshooting

### Check Validation Status
```bash
# View recent security logs
tail -f logs/security.log | grep -i "twilio\|signature\|replay"
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Invalid Twilio signature" | Wrong URL | Verify `WEBHOOK_URL` matches Twilio config |
| | Wrong Auth Token | Verify `TWILIO_AUTH_TOKEN` is correct |
| | Modified request body | Check request isn't being modified by proxy |
| "Request too old" | Old request | Check server clock synchronization |
| "Duplicate request" | Replay attack OR Twilio retry | Check if legitimate retry or actual attack |
| "Missing signature" | Signature header lost | Check proxy/firewall preserves headers |

### Testing in Development

To force validation in test mode:
```bash
export FORCE_TWILIO_VERIFY=true
export NODE_ENV=test
npm test
```

## Integration Points

### In Application Routes
See [src/routes/whatsapp.routes.js](src/routes/whatsapp.routes.js) for:
- Middleware mounting
- Request body validation
- Error handling
- Asynchronous processing

### In Controllers
See [src/controllers/whatsapp.controller.js](src/controllers/whatsapp.controller.js) for:
- Message processing
- Database operations
- Response formatting

### In Services
See [src/services/whatsapp.service.js](src/services/whatsapp.service.js) for:
- Twilio API interactions
- Message sending
- Delivery status tracking

## Redis Integration (Production)

For production with Redis:

```javascript
// In middleware
const redis = require('redis');
const client = redis.createClient(process.env.REDIS_URL);

// Replace in-memory cache with Redis
async function cacheNonce(nonce) {
  await client.setex(`nonce:${nonce}`, 300, JSON.stringify({
    timestamp: Date.now()
  }));
}

async function hasSeenNonce(nonce) {
  return await client.exists(`nonce:${nonce}`) > 0;
}
```

## References

- [Twilio Webhook Security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)
- [Twilio Request Validation](https://www.twilio.com/docs/usage/webhooks/webhooks-security#validating-requests)
- [Node.js twilio library documentation](https://www.twilio.com/docs/libraries/node)

