const whatsappFlowService = require('../services/whatsappFlow.service');
const { checkDuplicate, markSkipped, markFailed } = require('../middleware/message-dedup.middleware');
const logger = require('../utils/logger');
const prisma = require('../config/database');

class WhatsAppController {

  async handleIncomingMessage(req, res) {
    try {
      const { MessageSid, From } = req.body;
      const correlationId = req.correlationId || `webhook-${Date.now()}`;

      // 1. Deduplication Check
      if (checkDuplicate(req)) {
        logger.warn('Duplicate message skipped', { messageSid: MessageSid, from: From, correlationId });
        await markSkipped(req, 'Duplicate message - already processed');
        return res.status(200).send('OK');
      }

      // 2. Log Incoming
      logger.info('Incoming WhatsApp message', {
        from: From,
        messageSid: MessageSid,
        correlationId
      });

      // 3. Log to DB (Async)
      this.logMessageToDB(req.body).catch(err =>
        logger.warn('Failed to log message to database', { error: err.message })
      );

      // 4. Return 200 OK immediately (Twilio requirement)
      res.status(200).send('OK');

      // 5. Process Logic (Async)
      await whatsappFlowService.processMessage(req.body);

    } catch (error) {
      console.error('Webhook Error:', error);
      // Ensure we don't timeout Twilio even on error
      if (!res.headersSent) res.status(200).send('OK');
    }
  }

  async logMessageToDB(body) {
    const { From, Body, MediaUrl0, NumMedia } = body;
    const phone = From.replace('whatsapp:', '').trim();
    const text = (Body || '').trim();

    await prisma.whatsAppMessage.create({
      data: {
        from: phone,
        to: 'SYSTEM',
        body: text.substring(0, 1000),
        mediaUrl: parseInt(NumMedia) > 0 ? MediaUrl0 : null,
        direction: 'INCOMING'
      }
    });
  }
}

module.exports = new WhatsAppController();