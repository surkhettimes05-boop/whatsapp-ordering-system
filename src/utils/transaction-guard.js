/**
 * Lightweight guard to encourage using the centralized transaction wrapper.
 *
 * This intentionally does not block execution. It logs a clear, actionable
 * warning when legacy `prisma.$transaction` adapters are loaded so engineers
 * are nudged to use the single integration point: `backend/transaction.js`.
 */
const { logger } = require('../config/logger');

function shouldWarn() {
  if (process.env.DISABLE_TRANSACTION_GUARD === '1') return false;
  if (process.env.NODE_ENV === 'test') return false;
  return true;
}

function warn() {
  if (!shouldWarn()) return;
  const message = 'Use the centralized transaction wrapper `backend/transaction.js` for SERIALIZABLE transactions and automatic retry — avoid ad-hoc prisma.$transaction calls.';
  try {
    logger.warn(message, { source: 'transaction-guard' });
  } catch (e) {
    // Fallback
    console.warn(message);
  }
}

module.exports = {
  warn
};
