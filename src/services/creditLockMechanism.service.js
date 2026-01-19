/**
 * CREDIT LOCK MECHANISM - Double Spending Prevention
 * 
 * Prevents concurrent order processing from allowing a retailer to exceed credit limits.
 * 
 * Problem:
 *   Time T0: Two orders arrive simultaneously for Retailer A, Credit Limit Rs 100,000
 *   
 *   Thread 1                          Thread 2
 *   ├─ Read balance: Rs 50,000        ├─ Read balance: Rs 50,000
 *   ├─ Available: 50,000              ├─ Available: 50,000
 *   ├─ Order amount: 40,000 ✓         ├─ Order amount: 40,000 ✓
 *   └─ Create entry (new bal: 90k)    └─ Create entry (new bal: 90k) ❌ WRONG!
 * 
 *   Result: Final balance = 90k (should be 130k, both orders should fail!)
 * 
 * Solution: Row-Level Locking with Transactions
 *   Thread 1                                    Thread 2
 *   ├─ BEGIN TRANSACTION
 *   ├─ LOCK credit row (acquired)              ├─ BEGIN TRANSACTION
 *   ├─ Read balance: 50,000                    ├─ LOCK credit row (WAITING...)
 *   ├─ Check: 50k + 40k < 100k? YES
 *   ├─ Create debit: +40k
 *   └─ COMMIT & UNLOCK                        └─ LOCK credit row (ACQUIRED!)
 *                                              ├─ Read balance: 90,000 (updated)
 *                                              ├─ Check: 90k + 40k < 100k? NO ❌
 *                                              ├─ Return error: INSUFFICIENT_CREDIT
 *                                              └─ ROLLBACK
 * 
 * Result: Thread 1 succeeds, Thread 2 fails, final balance = 90k ✅
 */

const prisma = require('../config/database');
const { withTransaction } = require('../utils/transaction');
const logger = require('../utils/logger');

class CreditLockMechanism {
  /**
   * Atomic credit validation with row-level locking
   * 
   * Ensures only one thread can validate credit for a retailer-wholesaler pair at a time.
   * This prevents double-spending when concurrent orders arrive.
   * 
   * @param {string} orderId - Unique order identifier (for logging)
   * @param {string} retailerId - Retailer making order
   * @param {string} wholesalerId - Wholesaler being ordered from
   * @param {number} orderAmount - Order total in rupees
   * @param {Object} options - Configuration
   * @param {number} options.timeout - Lock wait timeout (ms), default 5000
   * @param {number} options.maxRetries - Max retry attempts, default 3
   * @returns {Promise<Object>} Lock result: {success, ledgerEntryId, newBalance, error}
   */
  async acquireAndValidateCredit(
    orderId,
    retailerId,
    wholesalerId,
    orderAmount,
    options = {}
  ) {
    const { timeout = 5000, maxRetries = 3 } = options;

    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug('Credit lock attempt', {
          orderId,
          attempt,
          retailerId,
          wholesalerId,
          orderAmount,
        });

        const result = await this._validateWithLock(
          orderId,
          retailerId,
          wholesalerId,
          orderAmount,
          timeout
        );

        if (result.success) {
          logger.info('Credit lock acquired', {
            orderId,
            ledgerEntryId: result.ledgerEntryId,
            newBalance: result.newBalance,
          });
          return result;
        }

        // Failed validation (not a lock error) - don't retry
        if (result.errorType !== 'LOCK_TIMEOUT' && result.errorType !== 'DEADLOCK') {
          return result;
        }

        // Lock timeout or deadlock - retry
        lastError = result;
        if (attempt < maxRetries) {
          const backoffMs = 100 * Math.pow(2, attempt - 1); // Exponential backoff
          logger.warn('Credit lock failed, retrying', {
            orderId,
            attempt,
            backoffMs,
            error: result.error,
          });
          await this._sleep(backoffMs);
        }
      } catch (error) {
        lastError = {
          success: false,
          error: error.message,
          errorType: 'UNEXPECTED_ERROR',
        };
        logger.error('Credit lock error', {
          orderId,
          attempt,
          error: error.message,
          stack: error.stack,
        });
      }
    }

    // All retries exhausted
    return {
      success: false,
      error: `Credit lock failed after ${maxRetries} attempts: ${lastError?.error}`,
      errorType: 'MAX_RETRIES_EXCEEDED',
      ledgerEntryId: null,
    };
  }

  /**
   * Single lock attempt with transaction
   * @private
   */
  async _validateWithLock(
    orderId,
    retailerId,
    wholesalerId,
    orderAmount,
    timeout
  ) {
    try {
      const result = await withTransaction(
        async (tx) => {
          // ====================================================================
          // STEP 1: ACQUIRE LOCK (Row-Level FOR UPDATE)
          // ====================================================================
          // This locks the credit account row. If another transaction
          // is updating it, this query will wait (or timeout).
          // This is the KEY to preventing double-spending.
          await tx.$queryRaw`
            SELECT id FROM "RetailerWholesalerCredit"
            WHERE "retailerId" = ${retailerId} 
              AND "wholesalerId" = ${wholesalerId}
            FOR UPDATE NOWAIT
          `;

          // ====================================================================
          // STEP 2: VERIFY CREDIT ACCOUNT EXISTS
          // ====================================================================
          const creditAccount = await tx.retailerWholesalerCredit.findUnique({
            where: {
              retailerId_wholesalerId: {
                retailerId,
                wholesalerId,
              },
            },
            select: {
              id: true,
              creditLimit: true,
              isActive: true,
              blockedReason: true,
            },
          });

          if (!creditAccount) {
            return {
              success: false,
              error: 'No credit relationship exists',
              errorCode: 'NO_CREDIT_ACCOUNT',
              errorType: 'VALIDATION_ERROR',
            };
          }

          if (!creditAccount.isActive) {
            return {
              success: false,
              error: `Credit account blocked: ${creditAccount.blockedReason || 'No reason provided'}`,
              errorCode: 'CREDIT_BLOCKED',
              errorType: 'VALIDATION_ERROR',
            };
          }

          // ====================================================================
          // STEP 3: CALCULATE CURRENT BALANCE FROM LEDGER (WITHIN LOCK)
          // ====================================================================
          // This read is now SERIALIZED - no other thread can modify the ledger
          // for this retailer-wholesaler pair until our transaction completes.
          const balance = await this._calculateBalance(tx, retailerId, wholesalerId);
          const creditLimit = Number(creditAccount.creditLimit);
          const projectedBalance = balance + orderAmount;

          // ====================================================================
          // STEP 4: VALIDATE CREDIT AVAILABILITY
          // ====================================================================
          if (projectedBalance > creditLimit) {
            return {
              success: false,
              error: `Insufficient credit. Current: Rs ${balance}, Limit: Rs ${creditLimit}, Order: Rs ${orderAmount}`,
              errorCode: 'INSUFFICIENT_CREDIT',
              errorType: 'VALIDATION_ERROR',
              details: {
                currentBalance: balance,
                creditLimit,
                orderAmount,
                availableCredit: creditLimit - balance,
                projectedBalance,
              },
            };
          }

          // ====================================================================
          // STEP 5: CREATE DEBIT ENTRY (ATOMIC UNDER LOCK)
          // ====================================================================
          // This entry is created while holding the lock. No other thread can
          // create an entry until this transaction commits.
          const ledgerEntry = await tx.ledgerEntry.create({
            data: {
              retailerId,
              wholesalerId,
              orderId,
              entryType: 'DEBIT',
              amount: orderAmount,
              balanceAfter: projectedBalance,
              createdBy: 'SYSTEM',
            },
            select: {
              id: true,
              orderId: true,
              amount: true,
              balanceAfter: true,
              entryType: true,
              createdAt: true,
            },
          });

          // ====================================================================
          // STEP 6: RETURN SUCCESS
          // ====================================================================
          return {
            success: true,
            ledgerEntryId: ledgerEntry.id,
            orderId: ledgerEntry.orderId,
            newBalance: projectedBalance,
            creditLimit,
            availableCredit: creditLimit - projectedBalance,
            timestamp: new Date().toISOString(),
          };
        },
        {
          operation: 'CREDIT_LOCK_VALIDATE',
          entityId: orderId,
          entityType: 'Order',
          timeout,
        }
      );

      return result;
    } catch (error) {
      // Handle database-specific lock errors
      if (error.message?.includes('NOWAIT') || error.code === 'P_ERROR') {
        return {
          success: false,
          error: 'Credit account is locked by another transaction',
          errorCode: 'LOCK_TIMEOUT',
          errorType: 'LOCK_TIMEOUT',
        };
      }

      if (error.message?.includes('deadlock')) {
        return {
          success: false,
          error: 'Deadlock detected, transaction rolled back',
          errorCode: 'DEADLOCK',
          errorType: 'DEADLOCK',
        };
      }

      throw error;
    }
  }

  /**
   * Calculate current balance from ledger entries
   * Must be called WITHIN transaction to ensure consistency
   * @private
   */
  async _calculateBalance(tx, retailerId, wholesalerId) {
    const entries = await tx.ledgerEntry.findMany({
      where: {
        retailerId,
        wholesalerId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        entryType: true,
        amount: true,
      },
    });

    let balance = 0;
    for (const entry of entries) {
      const amount = Number(entry.amount);
      switch (entry.entryType) {
        case 'DEBIT':
        case 'ADJUSTMENT': // Can be negative (decrease debt)
          balance += amount;
          break;
        case 'CREDIT':
        case 'REVERSAL':
          balance -= amount;
          break;
      }
    }

    return balance;
  }

  /**
   * Release credit lock early (for cancellations)
   * 
   * If an order is cancelled before payment, reverse the debit entry
   * to free up the reserved credit.
   */
  async releaseCreditLock(ledgerEntryId, reason = 'Order cancelled') {
    try {
      const result = await withTransaction(
        async (tx) => {
          // Get original entry
          const originalEntry = await tx.ledgerEntry.findUnique({
            where: { id: ledgerEntryId },
            select: {
              id: true,
              retailerId: true,
              wholesalerId: true,
              amount: true,
              balanceAfter: true,
              orderId: true,
            },
          });

          if (!originalEntry) {
            return {
              success: false,
              error: 'Ledger entry not found',
            };
          }

          // Lock the credit row
          await tx.$queryRaw`
            SELECT id FROM "RetailerWholesalerCredit"
            WHERE "retailerId" = ${originalEntry.retailerId}
              AND "wholesalerId" = ${originalEntry.wholesalerId}
            FOR UPDATE
          `;

          // Calculate current balance
          const currentBalance = await this._calculateBalance(
            tx,
            originalEntry.retailerId,
            originalEntry.wholesalerId
          );

          // Create reversal entry (decreases balance by original amount)
          const reversalEntry = await tx.ledgerEntry.create({
            data: {
              retailerId: originalEntry.retailerId,
              wholesalerId: originalEntry.wholesalerId,
              orderId: originalEntry.orderId,
              entryType: 'REVERSAL',
              amount: originalEntry.amount,
              balanceAfter: currentBalance - originalEntry.amount,
              createdBy: 'SYSTEM',
            },
          });

          logger.info('Credit lock released', {
            originalEntryId: ledgerEntryId,
            reversalEntryId: reversalEntry.id,
            reason,
            amountReleased: originalEntry.amount,
          });

          return {
            success: true,
            reversalEntryId: reversalEntry.id,
            amountReleased: originalEntry.amount,
            newBalance: currentBalance - originalEntry.amount,
          };
        },
        {
          operation: 'CREDIT_LOCK_RELEASE',
          entityId: ledgerEntryId,
          entityType: 'LedgerEntry',
        }
      );

      return result;
    } catch (error) {
      logger.error('Failed to release credit lock', {
        ledgerEntryId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Utility: Sleep for specified milliseconds
   * @private
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = new CreditLockMechanism();
