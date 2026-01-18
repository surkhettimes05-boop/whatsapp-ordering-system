const { logger } = require('./src/config/logger');

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const isRetryableError = (err) => {
  if (!err) return false;
  const code = err.code || err?.originalError?.code || err?.meta?.code;
  const msg = (err.message || '').toString();

  // Postgres serialization failure and deadlock codes
  if (code === '40001' || code === '40P01') return true;

  // Generic message checks
  if (/deadlock/i.test(msg)) return true;
  if (/could not serialize/i.test(msg)) return true;
  if (/serialization failure/i.test(msg)) return true;

  return false;
};

/**
 * Run a callback inside a SERIALIZABLE Prisma transaction with automatic retry on deadlock/serialization failures.
 *
 * @param {object} prisma - Prisma client instance
 * @param {function} callback - async function which receives the transaction client
 * @param {object} [opts] - options { retries, minDelayMs }
 */
async function runSerializableTransaction(prisma, callback, opts = {}) {
  const maxRetries = Number(opts.retries ?? 5);
  const minDelay = Number(opts.minDelayMs ?? 50);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug('Starting SERIALIZABLE transaction', { attempt });

      const result = await prisma.$transaction(async (tx) => {
        return await callback(tx);
      }, { isolationLevel: 'Serializable' });

      logger.debug('Transaction committed', { attempt });
      return result;
    } catch (err) {
      logger.error('Transaction failed', { attempt, message: err.message, code: err.code });

      if (isRetryableError(err) && attempt < maxRetries) {
        const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        const jitter = Math.floor(Math.random() * 200);
        const waitMs = Math.max(minDelay, backoff + jitter);
        logger.warn('Retrying transaction after retryable error', { attempt, waitMs });
        await delay(waitMs);
        continue;
      }

      // Non-retryable or out of retries: log and rethrow
      logger.error('Transaction aborted permanently', { attempt, message: err.message, code: err.code });
      throw err;
    }
  }
}

module.exports = {
  runSerializableTransaction,
};
