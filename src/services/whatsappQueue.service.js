/**
 * WhatsApp Queue Service
 * 
 * Wrapper service to send WhatsApp messages via BullMQ
 */

const { addJob, JOB_TYPES } = require('../queue/queue');
const whatsappService = require('./whatsapp.service');

class WhatsAppQueueService {
    /**
     * Send WhatsApp message via queue
     * @param {string} phoneNumber - Recipient phone number
     * @param {string} message - Message text
     * @param {object} options - Options
     * @param {number} options.priority - Job priority (higher = more important)
     * @param {number} options.delay - Delay in milliseconds
     * @returns {Promise<object>} - Job info
     */
    async sendMessage(phoneNumber, message, options = {}) {
        const { priority = 0, delay = 0 } = options;

        const job = await addJob(
            JOB_TYPES.WHATSAPP_MESSAGE_SEND,
            {
                phoneNumber,
                message
            },
            {
                priority,
                delay
            }
        );

        return {
            jobId: job.id,
            phoneNumber,
            status: 'queued',
            message: 'Message queued for sending'
        };
    }

    /**
     * Send WhatsApp message with media via queue
     * @param {string} phoneNumber - Recipient phone number
     * @param {string} message - Message text
     * @param {string} mediaUrl - Media URL
     * @param {string} mediaType - Media type (image, video, document)
     * @param {object} options - Options
     * @returns {Promise<object>} - Job info
     */
    async sendMessageWithMedia(phoneNumber, message, mediaUrl, mediaType, options = {}) {
        const { priority = 0, delay = 0 } = options;

        const job = await addJob(
            JOB_TYPES.WHATSAPP_MESSAGE_SEND,
            {
                phoneNumber,
                message,
                mediaUrl,
                mediaType
            },
            {
                priority,
                delay
            }
        );

        return {
            jobId: job.id,
            phoneNumber,
            status: 'queued',
            message: 'Message with media queued for sending'
        };
    }

    /**
     * Send WhatsApp message immediately (bypass queue)
     * Use for critical/time-sensitive messages
     * @param {string} phoneNumber - Recipient phone number
     * @param {string} message - Message text
     * @returns {Promise<object>} - Result
     */
    async sendMessageImmediate(phoneNumber, message) {
        return await whatsappService.sendMessage(phoneNumber, message);
    }
}

module.exports = new WhatsAppQueueService();
