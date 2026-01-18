/**
 * WhatsApp Message Send Processor
 * 
 * Processes WhatsApp message sending jobs via Twilio
 */

const whatsappService = require('../../services/whatsapp.service');
const logger = require('../../utils/logger');

/**
 * Process WhatsApp message send job
 * @param {Job} job - BullMQ job
 * @returns {Promise<object>} - Result
 */
async function processWhatsAppMessage(job) {
    const { phoneNumber, message, mediaUrl, mediaType } = job.data;

    if (!phoneNumber || !message) {
        throw new Error('phoneNumber and message are required');
    }

    try {
        // Use immediate send (bypass queue to avoid recursion)
        const result = await whatsappService.sendMessageImmediate(phoneNumber, message);

        logger.info('WhatsApp message sent via queue', {
            phoneNumber,
            messageId: result?.messageId,
            jobId: job.id
        });

        return {
            success: true,
            messageId: result?.messageId || result?.id || 'unknown',
            phoneNumber,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        logger.error('Error sending WhatsApp message via queue', {
            phoneNumber,
            error: error.message,
            code: error.code,
            status: error.status,
            jobId: job.id
        });
        
        // Re-throw to trigger retry
        throw error;
    }
}

module.exports = processWhatsAppMessage;
