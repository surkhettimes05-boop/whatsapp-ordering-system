/**
 * WhatsApp Message Job Processor
 * 
 * Processes WhatsApp message sending jobs
 */

const whatsappService = require('../../services/whatsapp.service');

/**
 * Process WhatsApp message job
 * @param {object} job - BullMQ job object
 * @returns {Promise<object>} - Result
 */
async function processWhatsAppMessage(job) {
    const { phoneNumber, message, mediaUrl, mediaType } = job.data;

    if (!phoneNumber || !message) {
        throw new Error('Missing required fields: phoneNumber, message');
    }

    try {
        let result;
        
        if (mediaUrl && mediaType) {
            // Send message with media
            result = await whatsappService.sendMessageWithMedia(
                phoneNumber,
                message,
                mediaUrl,
                mediaType
            );
        } else {
            // Send text message
            result = await whatsappService.sendMessage(phoneNumber, message);
        }

        return {
            success: true,
            messageId: result?.messageId || null,
            sentAt: new Date().toISOString(),
        };
    } catch (error) {
        // Log error for retry
        console.error(`WhatsApp message send failed for ${phoneNumber}:`, error.message);
        throw error;
    }
}

module.exports = processWhatsAppMessage;
