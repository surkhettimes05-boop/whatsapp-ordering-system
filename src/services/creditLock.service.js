/**
 * Credit Lock System - Prevents Double Spending with Concurrent Orders
 * 
 * Problem: When two orders arrive simultaneously for the same retailer,
 * both might pass credit validation before the ledger is updated, allowing
 * overspending.
 * 
 * Solution: Row-level database locking via Prisma transactions:
 * 1. Lock the RetailerWholesalerCredit row (FOR UPDATE)
 * 2. Read current balance from ledger
 * 3. Validate credit availability
 * 4. Record debit entry (appends to immutable ledger)
 * 5. Release lock (transaction completes)
 * 
 * This ensures SERIALIZABLE isolation at the database level.
 */

const prisma = require('../config/database');
const { withTransaction } = require('../utils/transaction');
const logger = require('../utils/logger');

class CreditLockService {
  /**
   * ========================================================================
   * CORE: Acquire lock and validate credit in single transaction
   * ========================================================================
   */

  /**
   * Atomically check credit availability and reserve it for an order
   * Uses row-level database locking (FOR UPDATE) to prevent race conditions
   * 
   * Flow:
   * 1. Lock RetailerWholesalerCredit row exclusively
   * 2. Calculate current balance from immutable ledger
   * 3. Check if order amount exceeds available credit
   * 4. If valid: create PENDING debit entry
   * 5. Release lock on transaction commit
   * 
   * @param {string} orderId - Order ID to process
   * @param {string} retailerId - Retailer placing order
   * @param {string} wholesalerId - Wholesaler fulfilling order
   * @param {number} orderAmount - Order total in base currency units
   * @param {Object} options - Optional config
   * @returns {Promise<Object>} { success, balance, reserved, error }
   */
  async validateAndLockCredit(
    orderId,
    retailerId,
    wholesalerId,
    orderAmount,
    options = {}
  ) {
    const {
      timeout = 10000,
      maxRetries = 3,
      retryDelayMs = 100,
    } = options;

    // Retry logic for deadlock recovery
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this._validateAndLockCreditOnce(
          orderId,
          retailerId,
          wholesalerId,
          orderAmount,
          timeout
        );
        return result;
      } catch (error) {
        // Deadlock detected (40P01 = serialization failure in PostgreSQL)
        if ((error.code === '40P01' || error.message.includes('deadlock')) && attempt < maxRetries) {
          const backoffMs = retryDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
          logger.warn(`Credit lock deadlock, retrying (attempt ${attempt}/${maxRetries})`, {
            orderId,
            retailerId,
            wholesalerId,
            backoffMs,
            error: error.message,
          });
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Internal: Single attempt at credit validation with locking
   * @private
   */
  async _validateAndLockCreditOnce(
    orderId,
    retailerId,
    wholesalerId,
    orderAmount,
    timeout
  ) {
    return withTransaction(
      async (tx) => {
        // Step 1: Acquire row-level lock on credit relationship
        // FOR UPDATE ensures no other transaction can modify this row until we're done
        logger.debug('Acquiring credit lock', {
          orderId,
          retailerId,
          wholesalerId,
        });

        const creditAccount = await tx.$queryRaw`
          SELECT 
            id,
            "retailerId",
            "wholesalerId",
            "creditLimit",
            "isActive"
          FROM "retailer_wholesaler_credits"
          WHERE "retailerId" = ${retailerId}
            AND "wholesalerId" = ${wholesalerId}
          FOR UPDATE
        `;

        if (!creditAccount || creditAccount.length === 0) {
          return {
            success: false,
            error: 'No credit relationship found',
            errorCode: 'NO_CREDIT_ACCOUNT',
          };
        }

        const account = creditAccount[0];

        // Step 2: Check if credit is active
        if (!account.isActive) {
          return {
            success: false,
            error: 'Credit account is blocked',
            errorCode: 'CREDIT_BLOCKED',
            retailerId,
            wholesalerId,
          };
        }

        // Step 3: Calculate current balance from immutable ledger
        const balance = await this._calculateBalanceForUpdate(tx, retailerId, wholesalerId);
        const creditLimit = Number(account.creditLimit);
        const availableCredit = creditLimit - balance;

        logger.debug('Credit balance calculated', {
          orderId,
          balance,
          creditLimit,
          availableCredit,
          orderAmount,
        });

        // Step 4: Check if order exceeds available credit
        if (orderAmount > availableCredit) {
          return {
            success: false,
            error: 'Insufficient credit available',
            errorCode: 'INSUFFICIENT_CREDIT',
            balance,
            creditLimit,
            availableCredit,
            orderAmount,
          };
        }

        // Step 5: Create PENDING debit entry (locks in the credit reservation)
        // This prevents another transaction from double-spending the same credit
        const newBalance = balance + Number(orderAmount);

        const ledgerEntry = await tx.ledgerEntry.create({
          data: {
            retailerId,
            wholesalerId,
            orderId,
            entryType: 'DEBIT',
            amount: orderAmount,
            balanceAfter: newBalance,
            createdBy: 'SYSTEM',
            // Note: no dueDate here - dueDate set when order is confirmed
          },
          select: {
            id: true,
            orderId: true,
            entryType: true,
            amount: true,
            balanceAfter: true,
            createdAt: true,
          },
        });

        logger.info('Credit reserved for order', {
          orderId,
          retailerId,
          wholesalerId,
          amount: orderAmount,
          newBalance,
          ledgerEntryId: ledgerEntry.id,
        });

        return {
          success: true,
          orderId,
          balance,
          reserved: orderAmount,
          newBalance,
          creditLimit,
          availableCredit: creditLimit - newBalance,
          ledgerEntryId: ledgerEntry.id,
          ledgerEntry,
        };
      },
      {
        operation: 'CREDIT_LOCK_VALIDATE',
        entityId: orderId,
        entityType: 'Order',
        timeout,
      }
    );
  }

  /**
   * ========================================================================
   * UTILITY: Calculate balance within transaction context
   * ========================================================================
   */

  /**
   * Calculate current balance from ledger entries during transaction
   * Must be called within transaction context for consistency
   * 
   * @param {Object} tx - Prisma transaction client
   * @param {string} retailerId
   * @param {string} wholesalerId
   * @returns {Promise<number>} Current balance (positive = owes money)
   * @private
   */
  async _calculateBalanceForUpdate(tx, retailerId, wholesalerId) {
    const lastEntry = await tx.ledgerEntry.findFirst({
      where: {
        retailerId,
        wholesalerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        balanceAfter: true,
      },
    });

    return lastEntry ? Number(lastEntry.balanceAfter) : 0;
  }

  /**
   * ========================================================================
   * RECOVERY: Handle order cancellation with credit reversal
   * ========================================================================
   */

  /**
   * Reverse a credit reservation when order is cancelled
   * Creates REVERSAL entry to negate the previous DEBIT
   * 
   * @param {string} orderId - Order being cancelled
   * @param {string} reason - Reason for reversal (e.g., "CANCELLED", "PAYMENT_FAILED")
   * @returns {Promise<Object>} Reversal entry details
   */
  async reverseCreditReservation(orderId, reason = 'CANCELLED') {
    return withTransaction(
      async (tx) => {
        // Find the original DEBIT entry for this order
        const originalDebit = await tx.ledgerEntry.findFirst({
          where: {
            orderId,
            entryType: 'DEBIT',
          },
          orderBy: {
            createdAt: 'desc', // Most recent debit (in case of multiple)
          },
        });

        if (!originalDebit) {
          throw new Error(`No debit entry found for order ${orderId}`);
        }

        const { retailerId, wholesalerId, amount } = originalDebit;

        // Lock the credit row for this pair
        await tx.$queryRaw`
          SELECT 1 FROM "retailer_wholesaler_credits"
          WHERE "retailerId" = ${retailerId}
            AND "wholesalerId" = ${wholesalerId}
          FOR UPDATE
        `;

        // Calculate new balance (should reduce by the amount we're reversing)
        const currentBalance = await this._calculateBalanceForUpdate(tx, retailerId, wholesalerId);
        const newBalance = currentBalance - Number(amount);

        // Create REVERSAL entry
        const reversalEntry = await tx.ledgerEntry.create({
          data: {
            retailerId,
            wholesalerId,
            orderId,
            entryType: 'REVERSAL',
            amount: -Number(amount), // Negative to indicate reversal
            balanceAfter: newBalance,
            createdBy: 'SYSTEM',
          },
        });

        logger.info('Credit reservation reversed', {
          orderId,
          retailerId,
          wholesalerId,
          originalAmount: amount,
          newBalance,
          reason,
        });

        return {
          success: true,
          orderId,
          reversalEntryId: reversalEntry.id,
          amountReversed: amount,
          newBalance,
        };
      },
      {
        operation: 'CREDIT_REVERSAL',
        entityId: orderId,
        entityType: 'Order',
        timeout: 10000,
      }
    );
  }

  /**
   * ========================================================================
   * REPORTING: Credit exposure and lock status
   * ========================================================================
   */

  /**
   * Get comprehensive credit status for retailer-wholesaler pair
   * Shows locked vs available credit
   * 
   * @param {string} retailerId
   * @param {string} wholesalerId
   * @returns {Promise<Object>} Credit exposure report
   */
  async getCreditExposure(retailerId, wholesalerId) {
    // Get credit account
    const account = await prisma.retailerWholesalerCredit.findUnique({
      where: {
        retailerId_wholesalerId: {
          retailerId,
          wholesalerId,
        },
      },
    });

    if (!account) {
      return {
        exists: false,
        error: 'Credit relationship not found',
      };
    }

    // Get all ledger entries (immutable history)
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        retailerId,
        wholesalerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        order: {
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    // Get pending (not yet settled) orders
    const pendingOrders = entries.filter(e =>
      e.entryType === 'DEBIT' && e.order?.status !== 'DELIVERED'
    );

    // Calculate balances
    const currentBalance = entries.length > 0
      ? Number(entries[0].balanceAfter)
      : 0;

    const reservedCredit = pendingOrders.reduce(
      (sum, entry) => sum + Number(entry.amount),
      0
    );

    const creditLimit = Number(account.creditLimit);
    const availableCredit = creditLimit - currentBalance;

    return {
      exists: true,
      retailerId,
      wholesalerId,
      creditLimit,
      currentBalance,
      reservedCredit,
      availableCredit,
      utilizationPercent: ((currentBalance / creditLimit) * 100).toFixed(2),
      isActive: account.isActive,
      blockedReason: account.blockedReason,
      blockedAt: account.blockedAt,
      pendingOrdersCount: pendingOrders.length,
      lastEntryAt: entries.length > 0 ? entries[0].createdAt : null,
    };
  }

  /**
   * List all retailers with critical credit exposure
   * 
   * @param {string} wholesalerId
   * @param {number} criticalThresholdPercent - Alert if > this utilization (default 80%)
   * @returns {Promise<Array>} List of credit accounts exceeding threshold
   */
  async getCriticalExposures(wholesalerId, criticalThresholdPercent = 80) {
    const criticalAccounts = [];

    const accounts = await prisma.retailerWholesalerCredit.findMany({
      where: {
        wholesalerId,
        isActive: true,
      },
      include: {
        retailer: {
          select: {
            id: true,
            shopName: true,
            phoneNumber: true,
          },
        },
        ledgerEntries: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    for (const account of accounts) {
      const currentBalance = account.ledgerEntries.length > 0
        ? Number(account.ledgerEntries[0].balanceAfter)
        : 0;

      const creditLimit = Number(account.creditLimit);
      const utilization = (currentBalance / creditLimit) * 100;

      if (utilization > criticalThresholdPercent) {
        criticalAccounts.push({
          retailerId: account.retailerId,
          retailerName: account.retailer?.shopName,
          phoneNumber: account.retailer?.phoneNumber,
          creditLimit,
          currentBalance,
          utilizationPercent: utilization.toFixed(2),
          availableCredit: creditLimit - currentBalance,
        });
      }
    }

    return criticalAccounts.sort((a, b) => b.utilizationPercent - a.utilizationPercent);
  }
}

module.exports = new CreditLockService();
