/**
 * Message Deduplication Middleware
 * 
 * Checks for duplicate messages before processing webhook
 * 
 * Usage:
 *   router.post('/webhook', deduplicationMiddleware(), handler);
 */

const dedupService = require('../services/message-dedup.service');
const logger = require('../utils/logger');

/**
 * Deduplication middleware
 * 
 * - Checks if message is a duplicate
 * - Marks message as pending processing
 * - Handles retry scenarios
 */
function deduplicationMiddleware(options = {}) {
  const { 
    allowRetries = true,           // Allow processing of retried messages
    retryTimeWindow = 5000,        // Time window for retry detection (ms)
    markPendingOnly = false        // Only mark as pending, don't reject duplicates
  } = options;

  return async (req, res, next) => {
    try {
      const messageSid = req.body?.MessageSid;
      const phoneNumber = req.body?.From?.replace('whatsapp:', '').trim();
      const body = req.body?.Body;

      // Store in request for later use
      req.messageSid = messageSid;
      req.phoneNumber = phoneNumber;

      // If no message SID, skip deduplication
      if (!messageSid) {
        logger.warn('Deduplication middleware: No MessageSid in request');
        return next();
      }

      // Check if duplicate
      const { isDuplicate, existingRecord } = await dedupService.isDuplicate(messageSid);

      if (isDuplicate) {
        // Log duplicate attempt
        logger.warn('Duplicate message attempt detected', {
          messageSid,
          phoneNumber,
          previousStatus: existingRecord.status,
          previousOrderId: existingRecord.orderId,
          timeSinceFirst: Date.now() - existingRecord.processedAt.getTime()
        });

        // Check if this is a retry attempt
        const isRetry = await dedupService.isRetryAttempt(messageSid, retryTimeWindow);

        if (isRetry && allowRetries) {
          // Mark retry attempt
          await dedupService.markProcessed(messageSid, {
            phoneNumber,
            status: 'retrying',
            messageType: req.body.NumMedia > 0 ? 'image' : 'text',
            isRetry: true
          });

          logger.info('Retry attempt detected - allowing reprocessing', {
            messageSid,
            retryCount: existingRecord.retryCount + 1
          });

          // Allow retry processing
          req.isRetry = true;
          req.retryCount = existingRecord.retryCount + 1;
          return next();
        }

        // Duplicate detected and not a retry (or retries not allowed)
        if (markPendingOnly) {
          // Just continue, don't block
          req.isDuplicate = true;
          return next();
        }

        // Return duplicate response (but don't error - still return 200 to Twilio)
        req.isDuplicate = true;
        logger.info('Duplicate message blocked', { messageSid, phoneNumber });

        return next(); // Continue to handler, which will skip processing
      }

      // Mark as pending processing
      await dedupService.markProcessed(messageSid, {
        phoneNumber,
        status: 'pending',
        messageType: req.body.NumMedia > 0 ? 'image' : 'text'
      });

      req.isDuplicate = false;
      next();
    } catch (error) {
      logger.error('Error in deduplication middleware', {
        error: error.message,
        messageSid: req.body?.MessageSid
      });

      // On error, allow processing (don't block due to dedup error)
      next();
    }
  };
}

/**
 * Helper: Check dedup status in handler
 * 
 * Usage in route handler:
 *   if (checkDuplicate(req)) {
 *     // Handle duplicate
 *   }
 */
function checkDuplicate(req) {
  return req.isDuplicate === true;
}

/**
 * Helper: Mark successful processing
 */
async function markSuccess(req, orderId, result = {}) {
  if (req.messageSid) {
    await dedupService.updateStatus(req.messageSid, 'success', {
      orderId,
      result
    });
  }
}

/**
 * Helper: Mark failed processing
 */
async function markFailed(req, error, errorMessage = '') {
  if (req.messageSid) {
    await dedupService.updateStatus(req.messageSid, 'failed', {
      errorMessage: errorMessage || error?.message || 'Unknown error'
    });
  }
}

/**
 * Helper: Mark skipped
 */
async function markSkipped(req, reason = '') {
  if (req.messageSid) {
    await dedupService.updateStatus(req.messageSid, 'skipped', {
      errorMessage: reason
    });
  }
}

module.exports = {
  deduplicationMiddleware,
  checkDuplicate,
  markSuccess,
  markFailed,
  markSkipped
};
