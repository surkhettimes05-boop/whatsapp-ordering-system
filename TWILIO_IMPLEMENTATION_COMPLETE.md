# Twilio Webhook Security - Complete Implementation Guide

## Current Status

Your system **already has** comprehensive Twilio webhook signature validation and replay attack prevention middleware implemented.

### Location
- **Middleware**: [src/middleware/twilio-webhook.middleware.js](src/middleware/twilio-webhook.middleware.js)
- **Routes**: [src/routes/whatsapp.routes.js](src/routes/whatsapp.routes.js)
- **App Configuration**: [src/app.js](src/app.js)

## How It's Currently Mounted

### Step 1: Import in Routes
**File**: [src/routes/whatsapp.routes.js](src/routes/whatsapp.routes.js)

```javascript
// Lines 1-15
const express = require('express');
const router = express.Router();
const { webhookRateLimiter } = require('../middleware/rateLimit.middleware');
const { webhookIPAllowlist } = require('../middleware/ipAllowlist.middleware');
const { validateTwilioWebhook, replayProtectionMiddleware } = require('../middleware/twilio-webhook.middleware');
const whatsappController = require('../controllers/whatsapp.controller');
const logger = require('../utils/logger');
```

### Step 2: Mount on Webhook Route
**File**: [src/routes/whatsapp.routes.js](src/routes/whatsapp.routes.js)

```javascript
// Lines 60-88
const webhookUrl = process.env.WEBHOOK_URL || undefined;

router.post(
  '/webhook',
  webhookRateLimiter,                    // Step 1: Rate limit (60 req/min)
  replayProtectionMiddleware(),          // Step 2: Replay attack prevention
  validateTwilioWebhook(webhookUrl),     // Step 3: Signature validation
  async (req, res) => {
    // Step 4: Return 200 OK immediately to Twilio
    res.status(200).send('OK');

    // Step 5: Process message asynchronously (non-blocking)
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
```

## Architecture: How It Works

### Request Flow Diagram

```
Incoming Twilio Webhook Request
         ↓
   [Rate Limiter]
   Reject if 60+ req/min
         ↓
[Replay Protection Middleware]
- Check timestamp (not too old/future)
- Generate nonce from signature
- Check if nonce seen before (duplicate?)
- Cache nonce for replay detection
         ↓
[Signature Validation Middleware]
- Extract X-Twilio-Signature header
- Get TWILIO_AUTH_TOKEN from env
- Validate signature matches request
- Reject if unsigned or tampered
         ↓
    [Handler]
Return 200 OK to Twilio immediately
Process message asynchronously
```

### Middleware Stack Details

```javascript
// Order is CRITICAL (don't rearrange!)

1. webhookRateLimiter
   - Limits to 60 requests per minute
   - Uses express-rate-limit package
   - Prevents DoS attacks
   
2. replayProtectionMiddleware()
   - Detects duplicate requests
   - Checks timestamp freshness
   - Generates/caches nonces
   - Returns 409 if replay detected
   
3. validateTwilioWebhook(webhookUrl)
   - Validates X-Twilio-Signature header
   - Uses HMAC-SHA1 verification
   - Returns 403 if signature invalid
   - Requires TWILIO_AUTH_TOKEN env var
```

## Security Features Explained

### 1. Signature Validation

**What it does**: Ensures request came from Twilio, not a spoofed source

**How it works**:
```
Request arrives with header: X-Twilio-Signature: jW/J9ztEWCxd8UVHt7FQlCKJcew=

Server calculates:
  HMAC-SHA1(TWILIO_AUTH_TOKEN, URL + POST_PARAMS)
  = jW/J9ztEWCxd8UVHt7FQlCKJcew=

✓ MATCH → Request is genuine (from Twilio)
✗ NO MATCH → Request is spoofed (return 403)
```

**Configuration needed**:
- `TWILIO_AUTH_TOKEN` - From Twilio console
- `WEBHOOK_URL` - Must match Twilio's webhook config

### 2. Replay Attack Prevention

**What it does**: Detects when the same request is sent multiple times

**How it works**:

```
First Request:
  Signature: jW/J9ztEWCxd8UVHt7FQlCKJcew=
  Timestamp: 1705689200000
  Nonce: SHA256(signature + timestamp) = abc123...
  
  Check: Is "abc123..." in cache? NO
  Action: Add to cache, process request ✓

Duplicate Request (Replay):
  Signature: jW/J9ztEWCxd8UVHt7FQlCKJcew=  (same)
  Timestamp: 1705689200000  (same)
  Nonce: SHA256(signature + timestamp) = abc123...  (same!)
  
  Check: Is "abc123..." in cache? YES
  Action: REJECT with 409 (replay detected) ✗
```

### 3. Timestamp Validation

**Old requests rejected** (outside 5-minute window):
```
Request timestamp: 2025-01-15 10:00:00
Current time:      2025-01-15 10:10:00  (10 minutes later)

Age: 10 minutes > 5 minute window
Status: REJECT with 400 "Request too old"
```

**Future requests rejected** (clock skew > 30 seconds):
```
Request timestamp: 2025-01-15 10:15:00
Current time:      2025-01-15 10:10:00  (in the past!)

Skew: 5 minutes > 30 second tolerance
Status: REJECT with 400 "Clock skew invalid"
```

## Environment Configuration

### Required Variables

Create/update `.env`:

```env
# =============================================================================
# TWILIO CONFIGURATION
# =============================================================================

# Get from: https://www.twilio.com/console
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here

# CRITICAL: Must be exact URL that Twilio uses to call your webhook!
# If this doesn't match, signature validation will always fail
# Examples:
#   - https://api.example.com/api/v1/whatsapp/webhook
#   - https://production.example.com/api/v1/whatsapp/webhook
WEBHOOK_URL=https://your-domain.com/api/v1/whatsapp/webhook

# Optional: Override clock skew tolerance (milliseconds)
# Default: 30000 (30 seconds) - increase if you have intermittent clock issues
TWILIO_CLOCK_SKEW_MS=30000

# Optional: Override nonce window (milliseconds)
# Default: 300000 (5 minutes) - don't decrease below 1 minute
TWILIO_NONCE_WINDOW_MS=300000
```

### Verify Configuration

```bash
# Check that critical variables are set
grep -E "^TWILIO_AUTH_TOKEN|^WEBHOOK_URL" .env

# Output should show:
# TWILIO_AUTH_TOKEN=your_token...
# WEBHOOK_URL=https://...
```

## Testing & Validation

### 1. Test with Valid Signature

You need the exact signature for your webhook URL. Use this Node script:

```javascript
// test-webhook-signature.js
const twilio = require('twilio');

const authToken = 'your_auth_token';
const webhookUrl = 'https://your-domain.com/api/v1/whatsapp/webhook';
const params = {
  From: 'whatsapp:+9779800000000',
  To: 'whatsapp:+14155238886',
  Body: 'Hello World',
  MessageSid: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  AccountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
};

// Twilio's validation (it creates the signature)
const signature = twilio.validateRequest(authToken, '', webhookUrl, params);
console.log('Valid signature for testing:', signature);
```

Then test with curl:

```bash
# Get the valid signature first
node test-webhook-signature.js
# Output: Valid signature for testing: jW/J9ztEWCxd8UVHt7FQlCKJcew=

# Use it in the request
curl -X POST https://your-domain.com/api/v1/whatsapp/webhook \
  -H "X-Twilio-Signature: jW/J9ztEWCxd8UVHt7FQlCKJcew=" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:%2B9779800000000" \
  -d "To=whatsapp:%2B14155238886" \
  -d "Body=Hello" \
  -d "MessageSid=SM1234567890" \
  -d "AccountSid=AC1234567890"

# Expected response: 200 OK
```

### 2. Test Rejection Cases

```bash
# Test 1: Missing signature header
curl -X POST https://your-domain.com/api/v1/whatsapp/webhook \
  -d "From=whatsapp:%2B9779800000000"
# Response: 403 {"error": "Missing Twilio signature header"}

# Test 2: Invalid signature
curl -X POST https://your-domain.com/api/v1/whatsapp/webhook \
  -H "X-Twilio-Signature: invalid_signature_here" \
  -d "From=whatsapp:%2B9779800000000"
# Response: 403 {"error": "Invalid Twilio signature - request may be spoofed"}

# Test 3: Duplicate request (replay attack)
# Send the same request twice with valid signature
curl -X POST https://your-domain.com/api/v1/whatsapp/webhook \
  -H "X-Twilio-Signature: valid_signature" \
  -d "From=whatsapp:%2B9779800000000"
# First response: 200 OK
# Second response: 409 {"error": "Duplicate request detected - replay attack prevented"}
```

## Monitoring Security

### Check Recent Security Events

```bash
# View all security-related logs
tail -f logs/security.log | grep -i "signature\|replay\|validation"

# View just the rejections
tail -f logs/security.log | grep -i "SECURITY\|invalid\|rejected"

# Count rejections by type
grep -c "Invalid Twilio signature" logs/security.log
grep -c "Replay attack" logs/security.log
grep -c "Missing signature" logs/security.log
```

### Monitor Cache Health

Add this endpoint to check cache stats:

```javascript
// In src/routes/whatsapp.routes.js

router.get('/webhook/status', (req, res) => {
  const { getCacheStats } = require('../middleware/twilio-webhook.middleware');
  res.json({
    timestamp: new Date().toISOString(),
    cache: getCacheStats(),
  });
});

// Test: curl https://your-domain.com/api/v1/whatsapp/webhook/status
// Response:
// {
//   "timestamp": "2025-01-19T...",
//   "cache": {
//     "size": 245,
//     "maxSize": 10000,
//     "percentFull": "2.45%",
//     "windowMs": 300000
//   }
// }
```

## Troubleshooting

### Issue: "Invalid Twilio signature" on every request

**Likely causes**:
1. ❌ Wrong `WEBHOOK_URL` in `.env` (doesn't match Twilio config)
2. ❌ Wrong `TWILIO_AUTH_TOKEN` (invalid token)
3. ❌ Proxy/firewall is modifying request body

**Solutions**:
1. In Twilio console, copy the exact webhook URL you configured
2. In `.env`, set `WEBHOOK_URL=` to that exact value
3. Verify token: `echo $TWILIO_AUTH_TOKEN | head -c 20`
4. Check proxy isn't modifying body: enable debug logging

### Issue: "Request too old" error

**Likely causes**:
1. ❌ Server clock is out of sync with Twilio's
2. ❌ Network/proxy delay is too long

**Solutions**:
1. Sync server time: `ntpdate -s time.nist.gov` (Linux)
2. Increase tolerance: Set `TWILIO_CLOCK_SKEW_MS=60000`
3. Check proxy isn't delaying requests

### Issue: Duplicate requests rejected (but should be allowed)

**Likely causes**:
1. ❌ Twilio is retrying genuine request
2. ✓ Replay attack prevention is working

**Note**: This is working as intended! Twilio retries on timeouts.

**Solutions**:
1. Ensure you return 200 OK within 5 seconds
2. Don't do heavy processing in the webhook handler (use async jobs)
3. If you need to accept duplicates: Adjust `TWILIO_NONCE_WINDOW_MS` in `.env`

## Production Checklist

- [ ] `TWILIO_AUTH_TOKEN` is set in production `.env`
- [ ] `WEBHOOK_URL` matches Twilio's webhook configuration exactly
- [ ] `NODE_ENV=production` is set
- [ ] Webhook URL is HTTPS (not HTTP)
- [ ] Rate limiting is enabled on webhook route
- [ ] Logs are configured to file or service (not just console)
- [ ] Monitor logs for security warnings (invalid signatures, replays)
- [ ] Error handler catches validation failures gracefully
- [ ] Webhook handler returns 200 OK within 5 seconds
- [ ] Long-running operations use background jobs (not blocking webhook)
- [ ] Server clock is synchronized (NTP)
- [ ] Firewall/proxy preserves request headers
- [ ] Alert monitoring for repeated validation failures

## References

- [Twilio Webhook Security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)
- [Twilio Request Validation (Node.js)](https://www.twilio.com/docs/usage/webhooks/webhooks-security#validating-requests)
- [OWASP: Replay Attack Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [twilio npm package docs](https://www.npmjs.com/package/twilio)

