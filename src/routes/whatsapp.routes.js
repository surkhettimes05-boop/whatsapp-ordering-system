/**
 * WhatsApp webhook routes for Meta Cloud API (preferred) or Twilio fallback.
 */
const express = require('express');
const router = express.Router();
const { webhookRateLimiter } = require('../middleware/rateLimit.middleware');
const { verifyTwilioSignature } = require('../middleware/production.middleware');
const whatsappController = require('../controllers/commerce-whatsapp.controller');
const webhookService = require('../services/whatsappWebhook.service');
const meta = require('../services/metaWhatsApp.service');
const logger = require('../utils/logger');

function verifyProviderSignature(req, res, next) {
  if (webhookService.provider() !== 'meta') {
    return verifyTwilioSignature(req, res, next);
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!process.env.META_WHATSAPP_APP_SECRET) {
    logger.error('META_WHATSAPP_APP_SECRET is required for Meta webhook verification');
    return res.status(500).json({ success: false, error: 'Webhook verification is not configured' });
  }

  if (!meta.verifyWebhookSignature(req.rawBody, signature)) {
    logger.warn('Rejected invalid Meta WhatsApp webhook signature');
    return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
  }

  next();
}

router.get('/webhook', webhookRateLimiter, (req, res) => {
  if (webhookService.provider() === 'meta') {
    const challenge = meta.verifyChallenge(req.query);
    if (!challenge) return res.sendStatus(403);
    return res.status(200).send(challenge);
  }
  return res.status(200).send('OK');
});

router.post('/webhook', webhookRateLimiter, verifyProviderSignature, async (req, res) => {
  try {
    // Acknowledge only after every message in the provider batch is durable.
    await webhookService.persistEvents(webhookService.normalizeAll(req));
    res.status(200).send('EVENT_RECEIVED');
    if (process.env.NODE_ENV !== 'test') setImmediate(() => webhookService.tick());
  } catch (error) {
    logger.error('Failed to persist WhatsApp webhook', { error: error.message });
    res.status(503).send('Retry later');
  }
});

router.get('/test', (req, res) => {
  const provider = webhookService.provider();
  res.json({
    success: true,
    provider,
    configured: provider === 'meta'
      ? Boolean(process.env.META_WHATSAPP_PHONE_NUMBER_ID && process.env.META_WHATSAPP_ACCESS_TOKEN)
      : Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    catalogConfigured: Boolean(process.env.META_CATALOG_ID),
    graphVersion: provider === 'meta' ? (process.env.META_GRAPH_VERSION || 'v26.0') : null
  });
});

module.exports = router;
