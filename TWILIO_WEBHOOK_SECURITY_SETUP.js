/**
 * TWILIO WEBHOOK SECURITY SETUP GUIDE
 * Complete implementation with signature validation + replay protection
 * 
 * ============================================================================
 * PART 1: ENVIRONMENT CONFIGURATION
 * ============================================================================
 */

// In your .env file:
//
// # Required: Your Twilio Auth Token (from Twilio Console)
// TWILIO_AUTH_TOKEN=your_auth_token_here
//
// # Required in production: The exact URL Twilio uses to POST to your webhook
// # Must match EXACTLY what you configured in Twilio Console > Webhook URL
// WEBHOOK_URL=https://api.example.com/api/v1/whatsapp/webhook
// 
// # Optional: Force Twilio verification even in development
// FORCE_TWILIO_VERIFY=false
//
// # Optional: Custom replay protection window (milliseconds)
// TWILIO_WEBHOOK_WINDOW_MS=300000  # Default: 5 minutes


/**
 * ============================================================================
 * PART 2: MIDDLEWARE IMPLEMENTATION
 * ============================================================================
 * 
 * File: src/middleware/twilio-webhook.middleware.js
 * 
 * This file provides two middlewares:
 * 
 * 1. replayProtectionMiddleware()
 *    - Detects duplicate requests (replay attacks)
 *    - Validates request timestamp is within acceptable window
 *    - Checks for clock skew (future-dated requests)
 *    - Uses in-memory nonce cache (upgradeable to Redis)
 * 
 * 2. validateTwilioWebhook(webhookUrl)
 *    - Validates Twilio signature using HMAC-SHA1
 *    - Requires: X-Twilio-Signature header + AUTH_TOKEN + exact URL
 *    - Prevents request spoofing/man-in-the-middle attacks
 * 
 * Both are already implemented in the file.
 */


/**
 * ============================================================================
 * PART 3: MOUNTING IN ROUTES (RECOMMENDED)
 * ============================================================================
 */

// ✅ ALREADY DONE: src/routes/whatsapp.routes.js

const express = require('express');
const router = express.Router();

// Import security middlewares
const { validateTwilioWebhook, replayProtectionMiddleware } = require('../middleware/twilio-webhook.middleware');
const { webhookRateLimiter } = require('../middleware/rateLimit.middleware');

// Get webhook URL from environment (MUST match Twilio config)
const webhookUrl = process.env.WEBHOOK_URL || 'https://api.example.com/api/v1/whatsapp/webhook';

/**
 * Middleware stack for /webhook endpoint (in order):
 * 
 * 1. webhookRateLimiter (60 requests/minute)
 *    → Prevents burst attacks and DoS
 * 
 * 2. replayProtectionMiddleware()
 *    → Detects replay attacks + old requests
 *    → Blocks if timestamp outside 5-minute window
 *    → Blocks if duplicate request detected
 * 
 * 3. validateTwilioWebhook(webhookUrl)
 *    → Validates X-Twilio-Signature header
 *    → Confirms request came from Twilio (verified by signature)
 *    → Rejects if signature invalid or missing
 * 
 * Security flow:
 *   Incoming Request
 *   ↓
 *   Rate Limit Check (60/min) → REJECT if exceeded
 *   ↓
 *   Replay Detection (timestamp + nonce) → REJECT if duplicate/old
 *   ↓
 *   Signature Validation (HMAC-SHA1) → REJECT if invalid
 *   ↓
 *   Handler: req.twilio + req.replayProtection populated
 */
router.post(
  '/webhook',
  webhookRateLimiter,
  replayProtectionMiddleware(),
  validateTwilioWebhook(webhookUrl),
  async (req, res) => {
    // At this point, request has passed ALL security checks
    
    // Return 200 OK immediately (required by Twilio)
    res.status(200).send('OK');
    
    // Process asynchronously to avoid timeout
    handleIncomingMessage(req).catch(error => {
      logger.error('Webhook processing error', { error: error.message });
    });
  }
);

module.exports = router;


/**
 * ============================================================================
 * PART 4: ALTERNATIVE: MOUNTING IN APP.JS
 * ============================================================================
 * 
 * If you want centralized security middleware for ALL webhooks:
 */

// In src/app.js:

const express = require('express');
const { replayProtectionMiddleware, validateTwilioWebhook } = require('./middleware/twilio-webhook.middleware');

const app = express();

// ... existing middleware ...

// Mount Twilio webhook security for all /api/v1/whatsapp/* routes
app.use(
  '/api/v1/whatsapp',
  replayProtectionMiddleware(),
  validateTwilioWebhook(process.env.WEBHOOK_URL)
);

// Then mount routes
app.use('/api/v1/whatsapp', require('./routes/whatsapp.routes'));


/**
 * ============================================================================
 * PART 5: REQUEST CONTEXT AFTER SECURITY CHECKS
 * ============================================================================
 */

// Inside your handler, after all security checks pass:

async function handleIncomingMessage(req, res) {
  // Data populated by replayProtectionMiddleware
  const { nonce, timestamp, age } = req.replayProtection;
  console.log(`Request age: ${age}ms, Nonce: ${nonce.substring(0,16)}...`);

  // Data populated by validateTwilioWebhook
  const { signature, validated, from, to } = req.twilio;
  console.log(`Verified Twilio signature for: ${from}`);

  // Standard request context
  const { requestId, clientIP } = req;
  console.log(`Request: ${requestId} from ${clientIP}`);

  // Process the message
  const { From, Body, MessageSid } = req.body;
  // ... your business logic ...
}


/**
 * ============================================================================
 * PART 6: CONFIGURING IN TWILIO CONSOLE
 * ============================================================================
 * 
 * CRITICAL: The webhook URL in Twilio Console MUST match WEBHOOK_URL env var
 * 
 * Steps:
 * 1. Go to Twilio Console → Phone Numbers → Manage Numbers
 * 2. Select your WhatsApp number
 * 3. Scroll to "Messaging" section
 * 4. In "When a message comes in" → Set Webhook URL:
 *    
 *    URL: https://api.example.com/api/v1/whatsapp/webhook
 *    Method: POST
 * 
 * 5. In .env set:
 *    WEBHOOK_URL=https://api.example.com/api/v1/whatsapp/webhook
 *    (must match EXACTLY)
 * 
 * 6. Twilio will now sign requests with your Auth Token
 *    Get Auth Token from: Twilio Console → Account Info → Auth Token
 * 
 * Common issues:
 * ❌ "Invalid signature" → WEBHOOK_URL doesn't match Twilio config
 * ❌ "Signature too old" → Server clock out of sync (use NTP)
 * ❌ "Duplicate request" → Retry from Twilio (expected, normal)


/**
 * ============================================================================
 * PART 7: TESTING LOCALLY WITH NGROK
 * ============================================================================
 */

// Local development setup:

// 1. Start your server on localhost:5000
//    npm run dev
// 
// 2. Start ngrok tunnel
//    ngrok http 5000
//    → Output: https://xxx.ngrok.io
// 
// 3. In .env set:
//    WEBHOOK_URL=https://xxx.ngrok.io/api/v1/whatsapp/webhook
//    FORCE_TWILIO_VERIFY=false  # Skip verification in dev
// 
// 4. Update Twilio Console to ngrok URL:
//    https://xxx.ngrok.io/api/v1/whatsapp/webhook
// 
// 5. Send test message from WhatsApp number to your Twilio number
// 
// 6. Check logs for security middleware:
//    - "Replay protection passed" → ✅ Timestamp check OK
//    - "Twilio signature validated" → ✅ Signature check OK
//
// For production-like testing:
//    FORCE_TWILIO_VERIFY=true  # Enable signature validation

// Simulate incoming Twilio request (for testing):

const testRequest = {
  From: 'whatsapp:+9779800000000',
  To: 'whatsapp:+14155238886',
  Body: 'Test message',
  MessageSid: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  AccountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
};

// Mock test:
// curl -X POST http://localhost:5000/api/v1/whatsapp/webhook \
//   -H "Content-Type: application/x-www-form-urlencoded" \
//   -H "X-Twilio-Signature: <signature_here>" \
//   -d "From=whatsapp:%2B9779800000000&To=whatsapp:%2B14155238886&Body=Test"


/**
 * ============================================================================
 * PART 8: SECURITY BEHAVIOR SUMMARY
 * ============================================================================
 */

// SIGNATURE VALIDATION FLOW:
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// Twilio creates signature by:
//   signature = HMAC-SHA1(
//     key = TWILIO_AUTH_TOKEN,
//     message = WEBHOOK_URL + all_form_parameters_in_order
//   )
//   encoded_signature = Base64(signature)
//
// Your server validates by:
//   1. Get X-Twilio-Signature header from request
//   2. Reconstruct signature using AUTH_TOKEN + URL + req.body
//   3. Compare: header_signature === reconstructed_signature
//   4. If match → Request is from Twilio (not spoofed)
//   5. If no match → Reject with 403


// REPLAY ATTACK PREVENTION FLOW:
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// 1. Extract timestamp from request (or current time if not present)
// 2. Check: is_timestamp_too_old? (> 5 minutes old)
//    → YES: Reject (potential replay)
//    → NO: Continue
//
// 3. Check: is_timestamp_in_future? (> 30 seconds future)
//    → YES: Reject (clock skew)
//    → NO: Continue
//
// 4. Generate nonce = SHA256(signature + timestamp)
// 5. Check: have_we_seen_this_nonce_before?
//    → YES: Reject (duplicate request)
//    → NO: Cache nonce, allow request
//
// Result:
//   ✅ First-time request within 5-minute window → ALLOW
//   ❌ Duplicate request (same signature+timestamp) → REJECT
//   ❌ Request older than 5 minutes → REJECT
//   ❌ Request from future → REJECT


/**
 * ============================================================================
 * PART 9: MONITORING & ALERTS
 * ============================================================================
 */

// Review logs for security events:

// 1. Replay attacks detected:
//    logger.warn('Duplicate request detected (replay attack prevented)', { ... })
//
// 2. Invalid signatures:
//    logger.warn('Invalid Twilio signature', { ... })
//
// 3. Old requests:
//    logger.warn('Request timestamp too old (replay attack prevention)', { ... })
//
// 4. Successful validations:
//    logger.debug('Twilio signature validated successfully', { ... })
//
// Set up alerts:
//    - More than 5 replay attacks/hour → investigate
//    - More than 3 invalid signatures/hour → possible misconfiguration
//    - Rate limit exceeded → possible DoS attack

// Export cache stats endpoint (for monitoring):
// 
// app.get('/admin/security/webhook-cache', (req, res) => {
//   const { getCacheStats } = require('./middleware/twilio-webhook.middleware');
//   res.json(getCacheStats());
// });


/**
 * ============================================================================
 * PART 10: PRODUCTION CHECKLIST
 * ============================================================================
 */

// Before deploying to production:

const productionChecklist = [
  '✅ TWILIO_AUTH_TOKEN set in production .env',
  '✅ WEBHOOK_URL matches Twilio Console exactly',
  '✅ WEBHOOK_URL uses https:// (not http://)',
  '✅ WEBHOOK_URL is your production domain',
  '✅ NODE_ENV=production in deployment',
  '✅ Signature validation enabled (FORCE_TWILIO_VERIFY not set or false)',
  '✅ Replay protection enabled (replayProtectionMiddleware present)',
  '✅ Rate limiting enabled (webhookRateLimiter present)',
  '✅ Logging configured (logs reviewed for security events)',
  '✅ Test webhook delivery in Twilio Console Logs',
  '✅ Monitor for "Invalid signature" errors (indicates misconfiguration)',
  '✅ Monitor for replay attacks (should be rare)',
  '✅ Set up alerts on security failures',
  '✅ Rotate TWILIO_AUTH_TOKEN every 90 days',
  '✅ Document webhook security in runbook',
];

console.table(productionChecklist);


/**
 * ============================================================================
 * PART 11: TROUBLESHOOTING
 * ============================================================================
 */

// Problem: "Invalid Twilio signature" errors in production
// Solutions:
//   1. Verify TWILIO_AUTH_TOKEN is correct (copy from console again)
//   2. Verify WEBHOOK_URL matches Twilio config EXACTLY (including protocol)
//   3. Check server time is synchronized (NTP sync, clock drift causes this)
//   4. If using load balancer: ensure URL matches what Twilio sees
//   5. Verify reverse proxy not modifying request body/headers

// Problem: "Request too old" errors
// Solutions:
//   1. Server clock is behind Twilio servers (enable NTP)
//   2. Replay protection window too small (increase TWILIO_WEBHOOK_WINDOW_MS)
//   3. Twilio retries after long delay (rare, normal behavior)

// Problem: "Duplicate request detected" during testing
// Solutions:
//   1. Twilio retried the request (expected, logs show this)
//   2. You clicked "Send" twice in Twilio Test interface (normal)
//   3. Replay protection working correctly (good sign)

// Problem: Rate limit exceeded on webhook
// Solutions:
//   1. Legitimate traffic spike (increase webhookLimiter max)
//   2. DDoS attack (good, rate limiter blocked it)
//   3. Client sending requests too fast (ask them to throttle)

module.exports = {
  // This entire file is documentation + examples
  // No exports needed
};
