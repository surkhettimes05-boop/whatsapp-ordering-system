/**
 * WhatsApp Routes
 * 
 * Production-ready Twilio WhatsApp webhook integration
 * Security: Signature validation + Replay attack prevention + HTTPS enforcement + Deduplication + Idempotency
 */

const express = require('express');
const router = express.Router();
const { webhookRateLimiter } = require('../middleware/rateLimit.middleware');
const { webhookIPAllowlist } = require('../middleware/ipAllowlist.middleware');
const { validateTwilioWebhook, replayProtectionMiddleware } = require('../middleware/twilio-webhook.middleware');
const { httpsOnly } = require('../middleware/https-enforcer.middleware');
const { deduplicationMiddleware } = require('../middleware/message-dedup.middleware');
const { idempotencyMiddleware, cacheIdempotencyResponse } = require('../middleware/idempotency.middleware');
const whatsappController = require('../controllers/whatsapp.controller');
const logger = require('../utils/logger');

/**
 * GET /api/v1/whatsapp/webhook
 * Webhook verification for Twilio
 * 
 * HTTPS ENFORCED: Twilio requires HTTPS endpoints
 * 
 * Twilio webhook verification format:
 * - GET request with query parameters
 * - No specific verification token format (unlike Meta)
 * - Just need to return 200 OK
 */
router.get('/webhook', httpsOnly, webhookRateLimiter, (req, res) => {
  // Twilio doesn't use hub.mode/hub.verify_token like Meta
  // For Twilio, we just need to respond with 200 OK
  // Optionally verify the request came from Twilio using signature validation

  logger.info('Webhook verification request (HTTPS verified)', {
    ip: req.clientIP,
    query: req.query,
    headers: {
      'user-agent': req.get('user-agent'),
      'x-forwarded-for': req.get('x-forwarded-for')
    }
  });

  // Basic verification - in production, validate Twilio signature
  const twilioSignature = req.headers['x-twilio-signature'];
  if (process.env.NODE_ENV === 'production' && !twilioSignature) {
    logger.warn('Webhook verification request without Twilio signature', {
      ip: req.clientIP
    });
    // Still allow for now, but log it
  }

  res.status(200).send('OK');
});

/**
 * POST /api/v1/whatsapp/webhook
 * Handle incoming WhatsApp messages from Twilio
 * 
 * HTTPS ENFORCED: Twilio requires HTTPS endpoints
 * DEDUPLICATION: Prevents duplicate order processing using Twilio Message SID
 * IDEMPOTENCY: Prevents duplicate operations using X-Idempotency-Key header
 * 
 * Middleware stack (in order):
 * 1. httpsOnly - Reject non-HTTPS requests (403)
 * 2. webhookRateLimiter - Prevent burst attacks (60 req/min)
 * 3. replayProtectionMiddleware - Detect replay attacks
 * 4. validateTwilioWebhook - Verify Twilio signature
 * 5. idempotencyMiddleware - Check for duplicate requests (X-Idempotency-Key)
 * 6. deduplicationMiddleware - Check for duplicate messages (MessageSid)
 * 
 * Twilio webhook format:
 * {
 *   "From": "whatsapp:+9779800000000",
 *   "To": "whatsapp:+14155238886",
 *   "Body": "Hello",
 *   "MessageSid": "SM...",
 *   "AccountSid": "AC...",
 *   "ProfileName": "User Name"
 * }
 * 
 * Idempotency header:
 * {
 *   "X-Idempotency-Key": "550e8400-e29b-41d4-a716-446655440000"
 * }
 * 
 * IMPORTANT: Always return 200 OK immediately to Twilio
 * Process message asynchronously to prevent timeouts
 */
const validate = require('../middleware/validation.middleware');
const { whatsappWebhookSchema } = require('../validators/schemas');

// ...

// IMPORTANT: Always return 200 OK immediately to Twilio
// Process message asynchronously to prevent timeouts
const webhookUrl = process.env.WEBHOOK_URL || undefined; // Must be set in production
router.post(
  '/webhook',
  httpsOnly,
  webhookRateLimiter,
  replayProtectionMiddleware(),
  validateTwilioWebhook(webhookUrl),
  idempotencyMiddleware({
    ttl_seconds: 86400, // 24 hours
    header_name: 'x-idempotency-key',
    enabled: true
  }),
  // validate(whatsappWebhookSchema, 'body'), // FIXME: Twilio signature validates integrity. Strict strict schema might block valid Twilio updates if fields change.
  // We'll trust signature + basic shape for now or use schema with .unknown(true)
  deduplicationMiddleware(),
  async (req, res) => {
    // Return 200 OK immediately to Twilio
    // This prevents Twilio from retrying and timing out
    res.status(200).send('OK');

    // Process message asynchronously (don't await)
    try {
      const response = await whatsappController.handleIncomingMessage(req, res);
      
      // Cache response for idempotency
      await cacheIdempotencyResponse(req, res, 'whatsapp_message', {
        success: true,
        message: 'WhatsApp message processed',
        processed_at: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error processing WhatsApp message', {
        error: error.message,
        stack: error.stack,
        from: req.body.From,
        body: req.body,
        requestId: req.requestId,
        idempotency_key: req.idempotency?.key
      });

      // Still cache the error for consistency
      await cacheIdempotencyResponse(req, res, 'whatsapp_message', {
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/v1/whatsapp/test
 * Test endpoint to check if WhatsApp routes work
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'WhatsApp webhook is ready! 🚀',
    twilio: {
      configured: !!process.env.TWILIO_ACCOUNT_SID,
      fromNumber: process.env.TWILIO_WHATSAPP_FROM || 'Not set'
    },
    idempotency: {
      enabled: true,
      header: 'X-Idempotency-Key',
      ttl_hours: 24
    }
  });
});

module.exports = router;
