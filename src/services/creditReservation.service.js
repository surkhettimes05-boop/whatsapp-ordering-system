/**
 * Credit Reservation Service
 * 
 * Production-Grade Credit Reservation System
 * 
 * BUSINESS RULES:
 * 1. Available credit = limit - sum(active reservations) - sum(DEBIT entries)
 * 2. Reservation placed when order is validated
 * 3. Reservation released when order fails or cancels
 * 4. Reservation converted to ledger DEBIT when order fulfills
 * 5. All operations are atomic/transactional
 * 
 * STATE FLOW:
 *   ACTIVE ──[order fails]───→ RELEASED
 *         ──[order cancels]──→ RELEASED
 *         ──[order delivers]→ CONVERTED_TO_DEBIT
 */

const prisma = require('../config/database');
const Decimal = require('decimal.js');

class CreditReservationService {
  /**
   * Calculate current available credit for a retailer-wholesaler pair
   * 
   * Available = Limit - SUM(Active Reservations) - SUM(DEBIT Ledger Entries)
   * 
   * @param {string} retailerId
   * @param {string} wholesalerId
   * @returns {Promise<Object>} { available, limit, reserved, debits, reservations, ledgerDebits }
   */
  async getAvailableCredit(retailerId, wholesalerId) {
    try {
      // 1. Get credit limit
      const creditAccount = await prisma.retailerWholesalerCredit.findUnique({
        where: {
          retailerId_wholesalerId: { retailerId, wholesalerId },
        },
      });

      if (!creditAccount) {
        throw new Error(`CREDIT_ACCOUNT_NOT_FOUND: No credit account for ${retailerId}-${wholesalerId}`);
      }

      if (!creditAccount.isActive) {
        throw new Error(`CREDIT_ACCOUNT_BLOCKED: Account is blocked. Reason: ${creditAccount.blockedReason}`);
      }

      const limit = new Decimal(creditAccount.creditLimit);

      // 2. Sum active reservations
      const activeReservations = await prisma.creditReservation.findMany({
        where: {
          retailerId,
          wholesalerId,
          status: 'ACTIVE',
        },
        select: {
          reservationAmount: true,
        },
      });

      const totalReserved = activeReservations.reduce(
        (sum, res) => sum.plus(new Decimal(res.reservationAmount)),
        new Decimal(0)
      );

      // 3. Sum DEBIT ledger entries (outstanding balance)
      const debitEntries = await prisma.ledgerEntry.findMany({
        where: {
          retailerId,
          wholesalerId,
          entryType: 'DEBIT',
        },
        select: {
          amount: true,
        },
      });

      const totalDebits = debitEntries.reduce(
        (sum, entry) => sum.plus(new Decimal(entry.amount)),
        new Decimal(0)
      );

      // 4. Calculate available credit
      const available = limit.minus(totalReserved).minus(totalDebits);

      return {
        available: available.toNumber(),
        availableDecimal: available,
        limit: limit.toNumber(),
        reserved: totalReserved.toNumber(),
        debits: totalDebits.toNumber(),
        isActive: creditAccount.isActive,
        activeReservationCount: activeReservations.length,
        debitEntryCount: debitEntries.length,
      };
    } catch (error) {
      console.error('❌ Error calculating available credit:', error.message);
      throw error;
    }
  }

  /**
   * Reserve credit for an order
   * Called during order validation, BEFORE order is confirmed
   * 
   * @param {string} retailerId
   * @param {string} wholesalerId
   * @param {string} orderId
   * @param {number} amount - Order amount to reserve
   * @returns {Promise<Object>} Reservation record
   */
  async reserveCredit(retailerId, wholesalerId, orderId, amount) {
    const tx = await prisma.$transaction(async (txn) => {
      try {
        // 1. Check if order already has a reservation
        const existing = await txn.creditReservation.findUnique({
          where: { orderId },
        });

        if (existing && existing.status === 'ACTIVE') {
          throw new Error(`RESERVATION_ALREADY_EXISTS: Order ${orderId} already has active reservation`);
        }

        // 2. Get available credit
        const creditAccount = await txn.retailerWholesalerCredit.findUnique({
          where: {
            retailerId_wholesalerId: { retailerId, wholesalerId },
          },
        });

        if (!creditAccount) {
          throw new Error(`CREDIT_ACCOUNT_NOT_FOUND`);
        }

        if (!creditAccount.isActive) {
          throw new Error(`CREDIT_ACCOUNT_BLOCKED: ${creditAccount.blockedReason}`);
        }

        // 3. Calculate current available credit
        const activeReservations = await txn.creditReservation.findMany({
          where: {
            retailerId,
            wholesalerId,
            status: 'ACTIVE',
          },
          select: {
            reservationAmount: true,
          },
        });

        const totalReserved = activeReservations.reduce(
          (sum, res) => sum.plus(new Decimal(res.reservationAmount)),
          new Decimal(0)
        );

        const debitEntries = await txn.ledgerEntry.findMany({
          where: {
            retailerId,
            wholesalerId,
            entryType: 'DEBIT',
          },
          select: {
            amount: true,
          },
        });

        const totalDebits = debitEntries.reduce(
          (sum, entry) => sum.plus(new Decimal(entry.amount)),
          new Decimal(0)
        );

        const limit = new Decimal(creditAccount.creditLimit);
        const available = limit.minus(totalReserved).minus(totalDebits);
        const amountDecimal = new Decimal(amount);

        // 4. Check if sufficient credit
        if (amountDecimal.greaterThan(available)) {
          throw new Error(
            `INSUFFICIENT_CREDIT: Need ₹${amount}, but only ₹${available.toNumber()} available. ` +
            `Limit: ₹${limit.toNumber()}, Reserved: ₹${totalReserved.toNumber()}, Debits: ₹${totalDebits.toNumber()}`
          );
        }

        // 5. Create reservation (or update if was released)
        const reservation = await txn.creditReservation.upsert({
          where: { orderId },
          update: {
            status: 'ACTIVE',
            reservationAmount: amountDecimal,
            releasedAt: null,
            releasedReason: null,
            updatedAt: new Date(),
          },
          create: {
            id: require('uuid').v4(),
            retailerId,
            wholesalerId,
            orderId,
            reservationAmount: amountDecimal,
            status: 'ACTIVE',
          },
        });

        console.log(
          `✅ Credit reserved: Order=${orderId}, Amount=₹${amount}, Available=₹${available.toNumber()}`
        );

        return reservation;
      } catch (error) {
        console.error(`❌ Credit reservation failed for order ${orderId}:`, error.message);
        throw error;
      }
    });

    return tx;
  }

  /**
   * Release (cancel) a credit reservation
   * Called when order is cancelled, failed, or expired
   * 
   * @param {string} orderId
   * @param {string} reason - Reason for release (CANCELLED, FAILED, EXPIRED)
   * @returns {Promise<Object>} Updated reservation
   */
  async releaseReservation(orderId, reason = 'CANCELLED') {
    const tx = await prisma.$transaction(async (txn) => {
      try {
        // 1. Get reservation
        const reservation = await txn.creditReservation.findUnique({
          where: { orderId },
        });

        if (!reservation) {
          throw new Error(`RESERVATION_NOT_FOUND: No reservation for order ${orderId}`);
        }

        if (reservation.status !== 'ACTIVE') {
          throw new Error(
            `INVALID_STATE: Reservation is ${reservation.status}, cannot release. ` +
            `Only ACTIVE reservations can be released.`
          );
        }

        // 2. Update reservation to RELEASED
        const updated = await txn.creditReservation.update({
          where: { orderId },
          data: {
            status: 'RELEASED',
            releasedAt: new Date(),
            releasedReason: reason,
            updatedAt: new Date(),
          },
        });

        console.log(
          `✅ Credit released: Order=${orderId}, Amount=₹${updated.reservationAmount}, Reason=${reason}`
        );

        return updated;
      } catch (error) {
        console.error(`❌ Failed to release reservation for order ${orderId}:`, error.message);
        throw error;
      }
    });

    return tx;
  }

  /**
   * Convert reservation to ledger DEBIT entry when order is delivered
   * 
   * This is the CRITICAL operation that converts held credit into actual debt
   * 
   * @param {string} orderId
   * @param {string} retailerId
   * @param {string} wholesalerId
   * @param {number} amount - Order amount (should match reservation)
   * @param {Object} ledgerOptions - Additional ledger entry options
   * @returns {Promise<Object>} { reservation, ledgerEntry }
   */
  async convertReservationToDebit(orderId, retailerId, wholesalerId, amount, ledgerOptions = {}) {
    const tx = await prisma.$transaction(async (txn) => {
      try {
        // 1. Get reservation
        const reservation = await txn.creditReservation.findUnique({
          where: { orderId },
        });

        if (!reservation) {
          throw new Error(`RESERVATION_NOT_FOUND: No reservation for order ${orderId}`);
        }

        if (reservation.status !== 'ACTIVE') {
          throw new Error(
            `INVALID_STATE: Reservation is ${reservation.status}. ` +
            `Cannot convert. Only ACTIVE reservations can be converted to DEBIT.`
          );
        }

        // 2. Verify amounts match
        const reservedAmount = new Decimal(reservation.reservationAmount);
        const amountDecimal = new Decimal(amount);

        if (!reservedAmount.equals(amountDecimal)) {
          console.warn(
            `⚠️ Amount mismatch: Reserved=₹${reservedAmount.toNumber()}, Actual=₹${amountDecimal.toNumber()}`
          );
          // Still proceed - use the actual amount delivered
        }

        // 3. Calculate new balance after this debit
        const existingDebits = await txn.ledgerEntry.findMany({
          where: {
            retailerId,
            wholesalerId,
            entryType: 'DEBIT',
          },
          select: {
            amount: true,
          },
        });

        const totalExistingDebits = existingDebits.reduce(
          (sum, entry) => sum.plus(new Decimal(entry.amount)),
          new Decimal(0)
        );

        const balanceAfter = totalExistingDebits.plus(amountDecimal);

        // 4. Create DEBIT ledger entry
        const ledgerEntry = await txn.ledgerEntry.create({
          data: {
            id: require('uuid').v4(),
            idempotencyKey: `${orderId}-debit-${Date.now()}`,
            retailerId,
            wholesalerId,
            orderId,
            entryType: 'DEBIT',
            amount: amountDecimal,
            balanceAfter: balanceAfter,
            dueDate: ledgerOptions.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
            createdBy: 'SYSTEM',
            hash: require('crypto').createHash('sha256').update(JSON.stringify({
              orderId,
              retailerId,
              wholesalerId,
              amount: amountDecimal.toString(),
              entryType: 'DEBIT',
              timestamp: new Date().toISOString(),
            })).digest('hex'),
            previousHash: null,
          },
        });

        // 5. Update reservation to CONVERTED_TO_DEBIT
        const updated = await txn.creditReservation.update({
          where: { orderId },
          data: {
            status: 'CONVERTED_TO_DEBIT',
            convertedAt: new Date(),
            ledgerEntryId: ledgerEntry.id,
            updatedAt: new Date(),
          },
        });

        console.log(
          `✅ Reservation converted to DEBIT: Order=${orderId}, Amount=₹${amount}, ` +
          `LedgerEntry=${ledgerEntry.id}, NewBalance=₹${balanceAfter.toNumber()}`
        );

        return {
          reservation: updated,
          ledgerEntry,
        };
      } catch (error) {
        console.error(`❌ Failed to convert reservation for order ${orderId}:`, error.message);
        throw error;
      }
    });

    return tx;
  }

  /**
   * Get reservation details for an order
   * 
   * @param {string} orderId
   * @returns {Promise<Object>} Reservation with full context
   */
  async getReservation(orderId) {
    try {
      const reservation = await prisma.creditReservation.findUnique({
        where: { orderId },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              status: true,
              createdAt: true,
            },
          },
          ledgerEntry: {
            select: {
              id: true,
              entryType: true,
              amount: true,
              dueDate: true,
              createdAt: true,
            },
          },
        },
      });

      if (!reservation) {
        throw new Error(`RESERVATION_NOT_FOUND: No reservation for order ${orderId}`);
      }

      return reservation;
    } catch (error) {
      console.error(`❌ Failed to get reservation for order ${orderId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get all active reservations for a retailer-wholesaler pair
   * 
   * @param {string} retailerId
   * @param {string} wholesalerId
   * @returns {Promise<Array>} Active reservations
   */
  async getActiveReservations(retailerId, wholesalerId) {
    try {
      const reservations = await prisma.creditReservation.findMany({
        where: {
          retailerId,
          wholesalerId,
          status: 'ACTIVE',
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return reservations;
    } catch (error) {
      console.error(
        `❌ Failed to get active reservations for ${retailerId}-${wholesalerId}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Pre-validation check before accepting an order
   * Returns detailed credit status and whether order can proceed
   * 
   * @param {string} retailerId
   * @param {string} wholesalerId
   * @param {number} orderAmount
   * @returns {Promise<Object>} { canReserve, available, limit, message, details }
   */
  async canReserveCredit(retailerId, wholesalerId, orderAmount) {
    try {
      const creditInfo = await this.getAvailableCredit(retailerId, wholesalerId);
      const amountDecimal = new Decimal(orderAmount);
      const availableDecimal = new Decimal(creditInfo.available);

      const canReserve = amountDecimal.lessThanOrEqualTo(availableDecimal);

      return {
        canReserve,
        available: creditInfo.available,
        limit: creditInfo.limit,
        reserved: creditInfo.reserved,
        debits: creditInfo.debits,
        isActive: creditInfo.isActive,
        orderAmount: orderAmount,
        shortfall: canReserve ? 0 : amountDecimal.minus(availableDecimal).toNumber(),
        message: canReserve
          ? `✅ Can reserve ₹${orderAmount}`
          : `❌ Insufficient credit. Need ₹${orderAmount} but only ₹${creditInfo.available} available`,
        details: creditInfo,
      };
    } catch (error) {
      console.error(
        `❌ Credit pre-check failed for ${retailerId}-${wholesalerId}:`,
        error.message
      );
      throw error;
    }
  }
}

module.exports = new CreditReservationService();
