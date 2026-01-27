/**
 * WhatsApp Delivery Receipt Service
 * 
 * Handles message status tracking, delivery receipts, and read receipts
 * Production-ready Twilio WhatsApp integration with comprehensive monitoring
 */

const { logger } = require('../config/logger');
const prisma = require('../config/prismaClient');

/**
 * Record incoming message status update from Twilio
 * 
 * Twilio Status Values:
 * - accepted: Twilio accepted the message
 * - queued: Message queued at Twilio
 * - sending: Being sent to carrier
 * - sent: Delivered to WhatsApp server
 * - delivered: User received message
 * - read: User read message
 * - failed: Delivery failed
 * - undelivered: Could not deliver
 * 
 * @param {object} statusData - Status update from Twilio webhook
 * @returns {Promise<object>} - Updated message record
 */
async function recordMessageStatus(statusData) {
  const {
    MessageSid,
    MessageStatus,
    ErrorCode,
    ErrorMessage,
    From,
    To,
  } = statusData;

  try {
    // Get existing message
    let message = await prisma.whatsAppMessage.findUnique({
      where: { messageSid: MessageSid },
    });

    if (!message) {
      logger.warn('Status update for unknown message', {
        messageSid: MessageSid,
        status: MessageStatus,
      });
      
      // Create placeholder to track unknown messages
      message = await prisma.whatsAppMessage.create({
        data: {
          messageSid: MessageSid,
          from: From?.replace('whatsapp:', '') || 'UNKNOWN',
          to: To?.replace('whatsapp:', '') || 'UNKNOWN',
          body: '[Status received before message created]',
          direction: 'OUTGOING',
          status: MessageStatus,
          errorCode: ErrorCode,
        },
      });
    }

    // Record status transition if status changed
    if (message.status !== MessageStatus) {
      await prisma.messageStatusLog.create({
        data: {
          messageSid: MessageSid,
          previousStatus: message.status,
          newStatus: MessageStatus,
          errorCode: ErrorCode,
          errorMessage: ErrorMessage,
        },
      });

      logger.info('Message status transitioned', {
        messageSid: MessageSid,
        from: message.status,
        to: MessageStatus,
        errorCode,
      });
    }

    // Update message with new status and timestamps
    const updateData = {
      status: MessageStatus,
      errorCode: ErrorCode,
      lastStatusAt: new Date(),
    };

    // Set specific timestamps based on status
    switch (MessageStatus) {
      case 'sent':
        updateData.sentAt = new Date();
        break;
      case 'delivered':
        updateData.deliveredAt = new Date();
        break;
      case 'read':
        updateData.readAt = new Date();
        break;
      case 'failed':
      case 'undelivered':
        updateData.failedAt = new Date();
        break;
    }

    const updatedMessage = await prisma.whatsAppMessage.update({
      where: { messageSid: MessageSid },
      data: updateData,
    });

    logger.info('Message status recorded', {
      messageSid: MessageSid,
      status: MessageStatus,
      to: message.to,
    });

    return updatedMessage;
  } catch (error) {
    logger.error('Error recording message status', {
      messageSid: MessageSid,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Get delivery status for a specific message
 * 
 * @param {string} messageSid - Twilio Message SID
 * @returns {Promise<object>} - Status information
 */
async function getMessageDeliveryStatus(messageSid) {
  try {
    const message = await prisma.whatsAppMessage.findUnique({
      where: { messageSid },
      include: {
        statusLogs: {
          orderBy: { statusChangedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!message) {
      throw new Error(`Message not found: ${messageSid}`);
    }

    // Calculate delivery metrics
    const deliveryMetrics = {
      status: message.status,
      isDelivered: message.status === 'delivered' || message.status === 'read',
      isRead: message.status === 'read',
      isFailed: message.status === 'failed' || message.status === 'undelivered',
      isPending: ['queued', 'sending', 'accepted'].includes(message.status),
    };

    // Calculate delivery time
    if (message.deliveredAt && message.sentAt) {
      deliveryMetrics.deliveryTimeMs = 
        message.deliveredAt.getTime() - message.sentAt.getTime();
    }

    if (message.readAt && message.sentAt) {
      deliveryMetrics.readTimeMs = 
        message.readAt.getTime() - message.sentAt.getTime();
    }

    return {
      messageSid,
      phoneNumber: message.to,
      messageText: message.body,
      direction: message.direction,
      
      // Current status
      currentStatus: message.status,
      lastStatusUpdate: message.lastStatusAt,
      
      // Timestamps
      timestamps: {
        created: message.createdAt,
        sent: message.sentAt,
        delivered: message.deliveredAt,
        read: message.readAt,
        failed: message.failedAt,
      },
      
      // Metrics
      metrics: deliveryMetrics,
      
      // Error information
      error: message.errorCode ? {
        code: message.errorCode,
        message: message.errorMessage || getErrorDescription(message.errorCode),
      } : null,
      
      // Status history
      statusHistory: message.statusLogs,
    };
  } catch (error) {
    logger.error('Error fetching message delivery status', {
      messageSid,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get delivery metrics for a phone number
 * 
 * @param {string} phoneNumber - Recipient phone number
 * @param {object} options - Query options
 * @returns {Promise<object>} - Delivery metrics
 */
async function getPhoneDeliveryMetrics(phoneNumber, options = {}) {
  const {
    days = 7,
    limit = 50,
  } = options;

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const messages = await prisma.whatsAppMessage.findMany({
      where: {
        to: phoneNumber.replace('whatsapp:', ''),
        direction: 'OUTGOING',
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    if (messages.length === 0) {
      return {
        phoneNumber,
        period: `${days} days`,
        totalMessages: 0,
        metrics: null,
      };
    }

    const stats = {
      totalMessages: messages.length,
      delivered: messages.filter(m => m.status === 'delivered').length,
      read: messages.filter(m => m.status === 'read').length,
      failed: messages.filter(m => m.status === 'failed' || m.status === 'undelivered').length,
      pending: messages.filter(m => ['queued', 'sending', 'accepted'].includes(m.status)).length,
    };

    // Calculate rates
    stats.deliveryRate = ((stats.delivered + stats.read) / stats.totalMessages * 100).toFixed(2);
    stats.readRate = (stats.read / stats.totalMessages * 100).toFixed(2);
    stats.failureRate = (stats.failed / stats.totalMessages * 100).toFixed(2);

    // Calculate average delivery time
    const deliveredMessages = messages.filter(m => m.deliveredAt && m.sentAt);
    if (deliveredMessages.length > 0) {
      const avgDeliveryTime = deliveredMessages.reduce((sum, m) => {
        return sum + (m.deliveredAt.getTime() - m.sentAt.getTime());
      }, 0) / deliveredMessages.length;
      stats.averageDeliveryTimeMs = Math.round(avgDeliveryTime);
    }

    return {
      phoneNumber,
      period: `${days} days`,
      metrics: stats,
      recentMessages: messages.slice(0, 5).map(m => ({
        messageSid: m.messageSid,
        status: m.status,
        sentAt: m.sentAt,
        deliveredAt: m.deliveredAt,
      })),
    };
  } catch (error) {
    logger.error('Error fetching phone delivery metrics', {
      phoneNumber,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get platform-wide delivery metrics
 * 
 * @param {object} options - Query options
 * @returns {Promise<object>} - Platform metrics
 */
async function getPlatformDeliveryMetrics(options = {}) {
  const {
    days = 30,
    breakdown = true, // Include hourly breakdown
  } = options;

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const messages = await prisma.whatsAppMessage.findMany({
      where: {
        direction: 'OUTGOING',
        createdAt: {
          gte: startDate,
        },
      },
    });

    if (messages.length === 0) {
      return {
        period: `${days} days`,
        totalMessages: 0,
        metrics: null,
      };
    }

    const stats = {
      totalMessages: messages.length,
      delivered: messages.filter(m => m.status === 'delivered').length,
      read: messages.filter(m => m.status === 'read').length,
      failed: messages.filter(m => m.status === 'failed' || m.status === 'undelivered').length,
      pending: messages.filter(m => ['queued', 'sending', 'accepted'].includes(m.status)).length,
    };

    stats.deliveryRate = ((stats.delivered + stats.read) / stats.totalMessages * 100).toFixed(2);
    stats.readRate = (stats.read / stats.totalMessages * 100).toFixed(2);
    stats.failureRate = (stats.failed / stats.totalMessages * 100).toFixed(2);

    // Calculate average delivery time
    const deliveredMessages = messages.filter(m => m.deliveredAt && m.sentAt);
    if (deliveredMessages.length > 0) {
      const avgDeliveryTime = deliveredMessages.reduce((sum, m) => {
        return sum + (m.deliveredAt.getTime() - m.sentAt.getTime());
      }, 0) / deliveredMessages.length;
      stats.averageDeliveryTimeMs = Math.round(avgDeliveryTime);
    }

    const response = {
      period: `${days} days`,
      metrics: stats,
    };

    // Breakdown by status
    if (breakdown) {
      response.statusBreakdown = {
        delivered: stats.delivered,
        read: stats.read,
        failed: stats.failed,
        pending: stats.pending,
      };

      // Error codes breakdown (for failed messages)
      const failedMessages = messages.filter(m => m.status === 'failed' || m.status === 'undelivered');
      if (failedMessages.length > 0) {
        response.errorCodeBreakdown = {};
        failedMessages.forEach(m => {
          const code = m.errorCode || 'UNKNOWN';
          response.errorCodeBreakdown[code] = (response.errorCodeBreakdown[code] || 0) + 1;
        });
      }
    }

    return response;
  } catch (error) {
    logger.error('Error fetching platform delivery metrics', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get human-readable error description for Twilio error code
 * 
 * @param {string} errorCode - Twilio error code
 * @returns {string} - Error description
 */
function getErrorDescription(errorCode) {
  const errorMap = {
    '30003': 'Invalid recipient - phone number format is incorrect',
    '30004': 'Generic rate limit exceeded - too many messages sent',
    '30005': 'SMS throughput limit exceeded - account limit reached',
    '21614': 'Invalid recipient phone number',
    '21612': 'Invalid From phone number',
    '21204': 'The From phone number is not a valid, SMS-capable Twilio phone number',
    '21205': 'The To phone number is not a valid phone number',
    '30002': 'Unreachable routing - phone number may not support WhatsApp',
    '30301': 'Queue overflow - message queue full',
  };

  return errorMap[errorCode] || `Error code: ${errorCode}`;
}

/**
 * Retry failed messages
 * 
 * @param {object} options - Retry options
 * @returns {Promise<object>} - Retry results
 */
async function retryFailedMessages(options = {}) {
  const {
    maxRetries = 3,
    hoursOld = 24,
  } = options;

  try {
    const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);

    const failedMessages = await prisma.whatsAppMessage.findMany({
      where: {
        status: { in: ['failed', 'undelivered'] },
        failedAt: {
          gte: cutoffTime,
        },
        retryCount: {
          lt: maxRetries,
        },
      },
      take: 50,
    });

    if (failedMessages.length === 0) {
      logger.info('No failed messages to retry');
      return { retried: 0, total: 0 };
    }

    logger.info(`Retrying ${failedMessages.length} failed messages`, {
      maxRetries,
      hoursOld,
    });

    // Queue messages for retry
    const whatsappQueueService = require('./whatsappQueue.service');
    let retried = 0;

    for (const message of failedMessages) {
      try {
        await whatsappQueueService.sendMessage(message.to, message.body, {
          priority: 10, // Higher priority for retries
          retryCount: (message.retryCount || 0) + 1,
          originalMessageSid: message.messageSid,
        });
        retried++;
      } catch (error) {
        logger.error('Failed to queue message retry', {
          messageSid: message.messageSid,
          error: error.message,
        });
      }
    }

    logger.info('Message retry batch queued', { retried, total: failedMessages.length });

    return {
      retried,
      total: failedMessages.length,
      successRate: ((retried / failedMessages.length) * 100).toFixed(2),
    };
  } catch (error) {
    logger.error('Error in retry failed messages', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Clean up old message records
 * 
 * @param {object} options - Cleanup options
 * @returns {Promise<object>} - Cleanup results
 */
async function cleanupOldMessages(options = {}) {
  const {
    daysToKeep = 90,
    batchSize = 1000,
  } = options;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let totalDeleted = 0;
    let batches = 0;

    while (true) {
      const toDelete = await prisma.whatsAppMessage.findMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
        select: { id: true },
        take: batchSize,
      });

      if (toDelete.length === 0) break;

      await prisma.whatsAppMessage.deleteMany({
        where: {
          id: {
            in: toDelete.map(m => m.id),
          },
        },
      });

      totalDeleted += toDelete.length;
      batches++;

      logger.info(`Cleanup batch ${batches} complete`, {
        deleted: toDelete.length,
        runningTotal: totalDeleted,
      });
    }

    logger.info('Message cleanup complete', {
      totalDeleted,
      batches,
      daysToKeep,
    });

    return {
      totalDeleted,
      batches,
      daysKept: daysToKeep,
    };
  } catch (error) {
    logger.error('Error cleaning up old messages', {
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  recordMessageStatus,
  getMessageDeliveryStatus,
  getPhoneDeliveryMetrics,
  getPlatformDeliveryMetrics,
  getErrorDescription,
  retryFailedMessages,
  cleanupOldMessages,
};
