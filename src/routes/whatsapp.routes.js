/**
 * WhatsApp Routes
 * 
 * Production-ready Twilio WhatsApp webhook integration
 */

const express = require('express');
const router = express.Router();
const { webhookRateLimiter } = require('../middleware/rateLimit.middleware');
const { webhookIPAllowlist } = require('../middleware/ipAllowlist.middleware');
const { verifyTwilioSignature } = require('../middleware/production.middleware');
const whatsappController = require('../controllers/whatsapp.controller');
const logger = require('../utils/logger');

/**
 * GET /api/v1/whatsapp/webhook
 * Webhook verification for Twilio
 * 
 * Twilio webhook verification format:
 * - GET request with query parameters
 * - No specific verification token format (unlike Meta)
 * - Just need to return 200 OK
 */
router.get('/webhook', webhookRateLimiter, (req, res) => {
  // Twilio doesn't use hub.mode/hub.verify_token like Meta
  // For Twilio, we just need to respond with 200 OK
  // Optionally verify the request came from Twilio using signature validation

  logger.info('Webhook verification request', {
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
 * IMPORTANT: Always return 200 OK immediately to Twilio
 * Process message asynchronously to prevent timeouts
 */
router.post('/webhook', webhookRateLimiter, verifyTwilioSignature, async (req, res) => {
  // Return 200 OK immediately to Twilio
  // This prevents Twilio from retrying and timing out
  res.status(200).send('OK');

  // Process message asynchronously (don't await)
  whatsappController.handleIncomingMessage(req, res).catch(error => {
    logger.error('Error processing WhatsApp message', {
      error: error.message,
      stack: error.stack,
      from: req.body.From,
      body: req.body
    });
  });
});

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
    }
  });
});

module.exports = router;
