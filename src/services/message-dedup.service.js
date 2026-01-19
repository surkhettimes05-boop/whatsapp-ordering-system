/**
 * Message Deduplication Service
 * 
 * Prevents duplicate WhatsApp message processing using Twilio Message SID
 * 
 * Features:
 * - Stores Twilio Message SID to detect duplicates
 * - Handles retry scenarios
 * - Tracks processing status
 * - Automatic cleanup of old records
 * 
 * Usage:
 *   const { isDuplicate, markProcessed } = require('./message-dedup.service');
 *   
 *   if (await isDuplicate(messageSid)) {
 *     return; // Message already processed
 *   }
 *   
 *   // Process message
 *   await markProcessed(messageSid, { orderId: '123', status: 'success' });
 */

const prisma = require('../config/database');
const logger = require('../utils/logger');

/**
 * Check if message has already been processed
 * 
 * Returns: { isDuplicate: boolean, existingRecord?: record }
 */
async function isDuplicate(messageSid) {
  if (!messageSid) {
    logger.warn('isDuplicate called without messageSid');
    return { isDuplicate: false };
  }

  try {
    const existing = await prisma.processedMessage.findUnique({
      where: { messageSid }
    });

    if (existing) {
      logger.info('Duplicate message detected', {
        messageSid,
        processedAt: existing.processedAt,
        status: existing.status
      });

      return {
        isDuplicate: true,
        existingRecord: existing
      };
    }

    return { isDuplicate: false };
  } catch (error) {
    logger.error('Error checking duplicate', { messageSid, error: error.message });
    // On error, don't assume duplicate (process the message)
    return { isDuplicate: false };
  }
}

/**
 * Mark message as processed
 * 
 * Status options: 'pending', 'processing', 'success', 'failed', 'skipped'
 */
async function markProcessed(messageSid, data = {}) {
  if (!messageSid) {
    logger.warn('markProcessed called without messageSid');
    return null;
  }

  try {
    const result = await prisma.processedMessage.upsert({
      where: { messageSid },
      create: {
        messageSid,
        phoneNumber: data.phoneNumber,
        status: data.status || 'processing',
        orderId: data.orderId,
        retailerId: data.retailerId,
        wholesalerId: data.wholesalerId,
        messageType: data.messageType || 'text', // text, image, order, etc.
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        processedAt: new Date(),
        result: data.result ? JSON.stringify(data.result) : null,
        errorMessage: data.errorMessage
      },
      update: {
        status: data.status || 'processing',
        orderId: data.orderId,
        retailerId: data.retailerId,
        wholesalerId: data.wholesalerId,
        messageType: data.messageType || 'text',
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        processedAt: new Date(),
        result: data.result ? JSON.stringify(data.result) : null,
        errorMessage: data.errorMessage,
        retryCount: data.isRetry ? (prisma.raw(`"retryCount" + 1`)) : undefined,
        lastRetryAt: data.isRetry ? new Date() : undefined
      }
    });

    logger.info('Message marked as processed', {
      messageSid,
      status: result.status,
      orderId: result.orderId
    });

    return result;
  } catch (error) {
    logger.error('Error marking message as processed', {
      messageSid,
      error: error.message
    });
    throw error;
  }
}

/**
 * Update processing status
 * 
 * Used to update status after initial creation
 */
async function updateStatus(messageSid, status, data = {}) {
  if (!messageSid) {
    return null;
  }

  try {
    const result = await prisma.processedMessage.update({
      where: { messageSid },
      data: {
        status,
        orderId: data.orderId,
        result: data.result ? JSON.stringify(data.result) : undefined,
        errorMessage: data.errorMessage
      }
    });

    logger.info('Message status updated', {
      messageSid,
      status,
      orderId: data.orderId
    });

    return result;
  } catch (error) {
    logger.error('Error updating message status', {
      messageSid,
      status,
      error: error.message
    });
    throw error;
  }
}

/**
 * Get message processing details
 */
async function getProcessingDetails(messageSid) {
  if (!messageSid) {
    return null;
  }

  try {
    const record = await prisma.processedMessage.findUnique({
      where: { messageSid }
    });

    if (record && record.metadata) {
      record.metadata = JSON.parse(record.metadata);
    }
    if (record && record.result) {
      record.result = JSON.parse(record.result);
    }

    return record;
  } catch (error) {
    logger.error('Error getting processing details', {
      messageSid,
      error: error.message
    });
    return null;
  }
}

/**
 * Get all processed messages for a user
 * 
 * Useful for analytics and debugging
 */
async function getProcessedMessagesForUser(phoneNumber, options = {}) {
  const { limit = 100, skip = 0, status = null, days = 30 } = options;

  try {
    const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const where = {
      phoneNumber,
      processedAt: {
        gte: daysAgo
      }
    };

    if (status) {
      where.status = status;
    }

    const messages = await prisma.processedMessage.findMany({
      where,
      orderBy: { processedAt: 'desc' },
      take: limit,
      skip
    });

    return messages.map(msg => ({
      ...msg,
      metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
      result: msg.result ? JSON.parse(msg.result) : null
    }));
  } catch (error) {
    logger.error('Error getting processed messages', {
      phoneNumber,
      error: error.message
    });
    return [];
  }
}

/**
 * Clean up old processed message records
 * 
 * Deletes records older than specified days
 * Called by maintenance job
 */
async function cleanupOldRecords(daysToKeep = 90) {
  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const result = await prisma.processedMessage.deleteMany({
      where: {
        processedAt: {
          lt: cutoffDate
        }
      }
    });

    logger.info('Cleaned up old processed messages', {
      deletedCount: result.count,
      cutoffDate,
      daysToKeep
    });

    return result.count;
  } catch (error) {
    logger.error('Error cleaning up old records', {
      daysToKeep,
      error: error.message
    });
    throw error;
  }
}

/**
 * Detect if message is a retry attempt
 * 
 * Twilio retries messages if webhook doesn't respond quickly
 * Detects if this is a retry based on recent duplicate attempts
 */
async function isRetryAttempt(messageSid, timeWindowMs = 5000) {
  try {
    const existing = await prisma.processedMessage.findUnique({
      where: { messageSid }
    });

    if (!existing) {
      return false;
    }

    // If we have a recent attempt, it's likely a retry
    const timeSinceLastAttempt = Date.now() - existing.lastRetryAt?.getTime() || 0;
    if (timeSinceLastAttempt < timeWindowMs && existing.retryCount > 0) {
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Error detecting retry attempt', {
      messageSid,
      error: error.message
    });
    return false;
  }
}

/**
 * Get deduplication statistics
 * 
 * For monitoring and debugging
 */
async function getDedupStats(days = 7) {
  try {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const stats = await prisma.processedMessage.groupBy({
      by: ['status'],
      where: {
        processedAt: {
          gte: cutoffDate
        }
      },
      _count: {
        id: true
      }
    });

    const retries = await prisma.processedMessage.count({
      where: {
        retryCount: { gt: 0 },
        processedAt: { gte: cutoffDate }
      }
    });

    const duplicates = await prisma.processedMessage.count({
      where: {
        lastRetryAt: {
          not: null
        },
        processedAt: { gte: cutoffDate }
      }
    });

    return {
      period: `${days} days`,
      statsGroupedByStatus: stats,
      totalRetries: retries,
      totalDuplicates: duplicates,
      averageDuplicateRate: duplicates ? `${((duplicates / stats.reduce((sum, s) => sum + s._count.id, 0)) * 100).toFixed(2)}%` : '0%'
    };
  } catch (error) {
    logger.error('Error getting dedup stats', { error: error.message });
    return null;
  }
}

module.exports = {
  isDuplicate,
  markProcessed,
  updateStatus,
  getProcessingDetails,
  getProcessedMessagesForUser,
  cleanupOldRecords,
  isRetryAttempt,
  getDedupStats
};
