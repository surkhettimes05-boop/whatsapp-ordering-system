/**
 * Idempotency Service
 * 
 * Reliability Engineering: Prevent duplicate webhook processing
 * 
 * Features:
 * - Store and retrieve idempotency keys
 * - Cache request/response pairs
 * - TTL-based cleanup (default 24 hours)
 * - Replay cached responses
 * 
 * Standards:
 * - RFC 7231 compliant
 * - X-Idempotency-Key header
 * - Unique per webhook type and request
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class IdempotencyService {
  /**
   * Get existing idempotency entry if not expired
   * 
   * @param {string} idempotencyKey - Unique key from X-Idempotency-Key header
   * @returns {Promise<Object|null>} Cached webhook entry or null
   */
  async getIdempotencyEntry(idempotencyKey) {
    try {
      if (!idempotencyKey) {
        return null;
      }

      const entry = await prisma.webhookIdempotency.findUnique({
        where: { idempotency_key: idempotencyKey }
      });

      // Check if entry has expired
      if (entry) {
        const now = new Date();
        if (entry.expires_at <= now) {
          // Entry is expired, clean it up in background
          logger.info('Idempotency entry expired, scheduling cleanup', {
            idempotency_key: idempotencyKey,
            expired_at: entry.expires_at
          });
          
          // Delete expired entry (async, don't wait)
          this.deleteExpiredEntry(idempotencyKey).catch(err => {
            logger.error('Error deleting expired idempotency entry', {
              error: err.message,
              idempotency_key: idempotencyKey
            });
          });

          return null;
        }

        logger.debug('Idempotency cache hit', {
          idempotency_key: idempotencyKey,
          webhook_type: entry.webhook_type,
          status: entry.response_status
        });

        return entry;
      }

      return null;
    } catch (error) {
      logger.error('Error retrieving idempotency entry', {
        error: error.message,
        idempotency_key: idempotencyKey
      });
      return null;
    }
  }

  /**
   * Store webhook request/response pair for idempotency
   * 
   * @param {Object} params - Storage parameters
   * @param {string} params.idempotency_key - Unique key
   * @param {string} params.webhook_type - Type of webhook (whatsapp_message, order_webhook, etc.)
   * @param {Object} params.request_body - Full request body
   * @param {number} params.response_status - HTTP status code
   * @param {Object} params.response_body - Response data to cache
   * @param {number} params.ttl_seconds - TTL in seconds (default 24 hours)
   * @param {string} params.source_ip - Source IP address (optional)
   * @param {string} params.retailer_id - Retailer ID (optional)
   * @param {string} params.order_id - Order ID (optional)
   * @returns {Promise<Object>} Created webhook idempotency entry
   */
  async storeIdempotencyKey(params) {
    try {
      const {
        idempotency_key,
        webhook_type,
        request_body,
        response_status,
        response_body,
        ttl_seconds = 86400, // 24 hours default
        source_ip = null,
        retailer_id = null,
        order_id = null
      } = params;

      const now = new Date();
      const expires_at = new Date(now.getTime() + ttl_seconds * 1000);

      const entry = await prisma.webhookIdempotency.create({
        data: {
          idempotency_key,
          webhook_type,
          request_body,
          response_status,
          response_body,
          expires_at,
          source_ip,
          retailer_id,
          order_id
        }
      });

      logger.info('Idempotency key stored', {
        idempotency_key,
        webhook_type,
        ttl_seconds,
        expires_at
      });

      return entry;
    } catch (error) {
      // Unique constraint violation means this is a duplicate request
      if (error.code === 'P2002') {
        logger.debug('Idempotency key already exists (expected for retry)', {
          idempotency_key: params.idempotency_key,
          error: error.message
        });
        return null;
      }

      logger.error('Error storing idempotency key', {
        error: error.message,
        idempotency_key: params.idempotency_key
      });
      throw error;
    }
  }

  /**
   * Delete expired idempotency entries
   * Called by background cleanup job or after expiration detected
   * 
   * @param {string} idempotency_key - Optional specific key to delete
   * @returns {Promise<number>} Number of entries deleted
   */
  async deleteExpiredEntry(idempotency_key) {
    try {
      if (idempotency_key) {
        const result = await prisma.webhookIdempotency.deleteMany({
          where: {
            idempotency_key
          }
        });
        return result.count;
      }
    } catch (error) {
      logger.error('Error deleting expired idempotency entry', {
        error: error.message,
        idempotency_key
      });
    }
    return 0;
  }

  /**
   * Cleanup all expired idempotency entries
   * Should be called periodically (e.g., every hour)
   * 
   * @returns {Promise<number>} Number of entries deleted
   */
  async cleanupExpiredEntries() {
    try {
      const now = new Date();
      
      const result = await prisma.webhookIdempotency.deleteMany({
        where: {
          expires_at: {
            lt: now // Less than (before) now
          }
        }
      });

      logger.info('Idempotency cleanup completed', {
        deleted_count: result.count,
        timestamp: now
      });

      return result.count;
    } catch (error) {
      logger.error('Error during idempotency cleanup', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get idempotency statistics (for monitoring)
   * 
   * @returns {Promise<Object>} Statistics about stored idempotency keys
   */
  async getStatistics() {
    try {
      const now = new Date();

      const total = await prisma.webhookIdempotency.count();
      
      const active = await prisma.webhookIdempotency.count({
        where: {
          expires_at: {
            gt: now // Greater than (after) now
          }
        }
      });

      const expired = await prisma.webhookIdempotency.count({
        where: {
          expires_at: {
            lte: now // Less than or equal to now
          }
        }
      });

      // Count by webhook type
      const byType = await prisma.webhookIdempotency.groupBy({
        by: ['webhook_type'],
        _count: true,
        where: {
          expires_at: {
            gt: now
          }
        }
      });

      return {
        total_keys: total,
        active_keys: active,
        expired_keys: expired,
        by_webhook_type: byType.reduce((acc, item) => {
          acc[item.webhook_type] = item._count;
          return acc;
        }, {})
      };
    } catch (error) {
      logger.error('Error getting idempotency statistics', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Validate idempotency key format
   * 
   * Key should be:
   * - Non-empty string
   * - UUID v4, timestamp-based ID, or other unique identifier
   * - Max 255 characters
   * 
   * @param {string} key - Key to validate
   * @returns {boolean} True if valid
   */
  validateIdempotencyKey(key) {
    if (!key || typeof key !== 'string') {
      return false;
    }

    // Check length (max 255 chars)
    if (key.length > 255) {
      return false;
    }

    // Allow alphanumeric, hyphens, underscores
    const validFormat = /^[a-zA-Z0-9\-_]+$/.test(key);
    
    return validFormat;
  }
}

module.exports = new IdempotencyService();
