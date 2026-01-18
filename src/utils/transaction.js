/**
 * Platform Transaction Framework
 * 
 * Production-grade transaction wrapper with:
 * - SERIALIZABLE isolation level
 * - Automatic deadlock retry
 * - Failure logging to WebhookLog
 * - Automatic rollback on ANY error
 * 
 * Usage:
 *   const result = await withTransaction(async (tx) => {
 *     // Your transaction logic here
 *     return await tx.order.create({ ... });
 *   });
 */

const prisma = require('../config/database');
// Light guard: remind devs to use centralized transaction wrapper
try {
    const guard = require('./transaction-guard');
    guard.warn();
} catch (e) {
    // ignore if guard can't be loaded for any reason
}

// PostgreSQL error codes for deadlocks and serialization failures
const DEADLOCK_ERROR_CODES = ['40001', '40P01']; // Serialization failure, Deadlock detected
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100; // Base delay in milliseconds
const MAX_RETRY_DELAY_MS = 1000; // Maximum delay

/**
 * Check if error is a retryable deadlock/serialization failure
 * @param {Error} error - The error to check
 * @returns {boolean} - True if error is retryable
 */
function isRetryableError(error) {
    if (!error || !error.code) return false;
    
    // PostgreSQL error codes
    if (DEADLOCK_ERROR_CODES.includes(error.code)) {
        return true;
    }
    
    // Check error message for deadlock indicators
    const errorMessage = error.message?.toLowerCase() || '';
    if (errorMessage.includes('deadlock') || 
        errorMessage.includes('serialization') ||
        errorMessage.includes('could not serialize')) {
        return true;
    }
    
    return false;
}

/**
 * Calculate exponential backoff delay
 * @param {number} attempt - Current retry attempt (0-indexed)
 * @returns {number} - Delay in milliseconds
 */
function calculateRetryDelay(attempt) {
    const delay = Math.min(
        RETRY_DELAY_MS * Math.pow(2, attempt),
        MAX_RETRY_DELAY_MS
    );
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * delay * 0.1;
    return delay + jitter;
}

/**
 * Log transaction failure to WebhookLog
 * @param {Error} error - The error that occurred
 * @param {object} context - Additional context (operation, entityId, etc.)
 * @param {number} attempt - Retry attempt number
 */
async function logTransactionFailure(error, context = {}, attempt = 0) {
    try {
        // Use a separate transaction to ensure logging persists even if main transaction fails
        await prisma.$transaction(async (logTx) => {
            await logTx.webhookLog.create({
                data: {
                    eventType: 'TRANSACTION_FAILURE',
                    entityId: context.entityId || 'unknown',
                    entityType: context.entityType || 'Transaction',
                    payload: JSON.stringify({
                        error: {
                            message: error.message,
                            code: error.code,
                            name: error.name,
                            stack: error.stack?.split('\n').slice(0, 10) // Limit stack trace
                        },
                        context,
                        attempt,
                        timestamp: new Date().toISOString()
                    }),
                    url: 'internal://transaction',
                    status: attempt < MAX_RETRIES ? 'RETRYING' : 'FAILED',
                    errorMessage: error.message,
                    retryCount: attempt,
                    nextRetryAt: attempt < MAX_RETRIES ? new Date(Date.now() + calculateRetryDelay(attempt)) : null
                }
            });
        }, {
            isolationLevel: 'ReadCommitted', // Lower isolation for logging
            timeout: 5000
        });
    } catch (logError) {
        // Don't throw - logging failures shouldn't break the flow
        console.error('⚠️ Failed to log transaction failure:', logError);
    }
}

/**
 * Execute a function within a SERIALIZABLE transaction with retry logic
 * 
 * @param {Function} fn - Transaction function that receives Prisma transaction client
 * @param {object} options - Optional configuration
 * @param {string} options.operation - Operation name for logging (e.g., 'ORDER_CREATION')
 * @param {string} options.entityId - Entity ID for logging (e.g., orderId)
 * @param {string} options.entityType - Entity type for logging (e.g., 'Order')
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.timeout - Transaction timeout in ms (default: 10000)
 * @returns {Promise<any>} - Result of the transaction function
 * @throws {Error} - Last error if all retries fail
 */
async function withTransaction(fn, options = {}) {
    const {
        operation = 'UNKNOWN_OPERATION',
        entityId = null,
        entityType = 'Transaction',
        maxRetries = MAX_RETRIES,
        timeout = 10000
    } = options;

    const { runSerializableTransaction } = require('../../transaction');

    const context = {
        operation,
        entityId,
        entityType,
        timestamp: new Date().toISOString()
    };

    try {
        const result = await runSerializableTransaction(prisma, async (tx) => {
            return await fn(tx);
        }, { retries: maxRetries, minDelayMs: 100 });

        return result;
    } catch (error) {
        // Log failure to WebhookLog for observability (best-effort)
        try {
            await logTransactionFailure(error, context, 0);
        } catch (e) {
            // swallow logging errors
            console.error('Failed to log transaction failure:', e);
        }
        throw error;
    }
}

/**
 * Execute a transaction with automatic rollback on ANY error
 * This is a convenience wrapper that ensures errors are properly handled
 * 
 * @param {Function} fn - Transaction function
 * @param {object} options - Options (same as withTransaction)
 * @returns {Promise<any>} - Result of transaction
 */
async function safeTransaction(fn, options = {}) {
    try {
        return await withTransaction(fn, options);
    } catch (error) {
        // Transaction already rolled back automatically by Prisma
        // Just ensure we log and rethrow
        console.error('🚫 Transaction rolled back due to error:', error.message);
        throw error;
    }
}

/**
 * Execute multiple operations in a single transaction
 * Useful for complex operations that need to be atomic
 * 
 * @param {Array<Function>} operations - Array of transaction functions
 * @param {object} options - Options (same as withTransaction)
 * @returns {Promise<Array>} - Array of results from each operation
 */
async function withTransactionBatch(operations, options = {}) {
    return await withTransaction(async (tx) => {
        const results = [];
        for (const operation of operations) {
            const result = await operation(tx);
            results.push(result);
        }
        return results;
    }, options);
}

module.exports = {
    withTransaction,
    safeTransaction,
    withTransactionBatch,
    isRetryableError,
    calculateRetryDelay
};
