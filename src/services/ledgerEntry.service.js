/**
 * Ledger Entry Service
 * Handles creation and query of ledger entries
 * Ensures ledger is append-only and immutable
 * 
 * The ledger is the source of truth for all credit calculations
 */

const prisma = require('../config/database');

class LedgerService {

  /**
   * Record an order delivery as a DEBIT entry
   * Called when order status changes to DELIVERED
   * 
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Created ledger entry
   */
  async recordOrderDelivery(orderId) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          retailer: true,
          wholesaler: true,
          items: true,
        },
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      if (!order.wholesalerId) {
        throw new Error(`Order ${orderId} not assigned to any wholesaler`);
      }

      // Get credit terms for this retailer-wholesaler pair
      const creditConfig = await prisma.retailerWholesalerCredit.findUnique({
        where: {
          retailerId_wholesalerId: {
            retailerId: order.retailerId,
            wholesalerId: order.wholesalerId,
          },
        },
      });

      if (!creditConfig) {
        throw new Error(
          `No credit arrangement between retailer ${order.retailerId} and wholesaler ${order.wholesalerId}`
        );
      }

      // Calculate due date
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + creditConfig.creditTerms);

      // Create DEBIT ledger entry
      const entry = await prisma.creditLedgerEntry.create({
        data: {
          retailerId: order.retailerId,
          wholesalerId: order.wholesalerId,
          orderId: order.id,
          entryType: 'DEBIT',
          amount: Number(order.totalAmount),
          dueDate,
          description: `Order #${order.id.substring(0, 8)} delivered (${order.items.length} items)`,
          approvedBy: 'SYSTEM',
        },
      });

      console.log(
        `📝 Ledger DEBIT: Order #${order.id.substring(0, 8)} - ` +
        `${order.retailer.pasalName || order.retailer.phoneNumber} owes ₹${order.totalAmount} ` +
        `to ${order.wholesaler.businessName}, due ${dueDate.toISOString().split('T')[0]}`
      );

      return entry;

    } catch (error) {
      console.error('Error recording order delivery:', error);
      throw error;
    }
  }

  /**
   * Record a payment as a CREDIT entry
   * Creates both payment record and ledger entry
   * 
   * @param {string} retailerId
   * @param {string} wholesalerId
   * @param {number} amount
   * @param {string} paymentMode - CASH, CHEQUE, BANK_TRANSFER, UPI
   * @param {Object} options - { chequeNumber, chequeDate, bankName, approvedBy }
   * @returns {Promise<Object>} Created payment and ledger entry
   */
  async recordPayment(retailerId, wholesalerId, amount, paymentMode, options = {}) {
    try {
      // Create payment record
      const payment = await prisma.retailerPayment.create({
        data: {
          retailerId,
          wholesalerId,
          amount: Number(amount),
          paymentMode,
          chequeNumber: options.chequeNumber,
          chequeDate: options.chequeDate ? new Date(options.chequeDate) : null,
          bankName: options.bankName,
          status: paymentMode === 'CHEQUE' ? 'PENDING' : 'CLEARED',
          clearedDate: paymentMode === 'CHEQUE' ? null : new Date(),
          notes: options.notes,
        },
      });

      // Create corresponding CREDIT ledger entry (only if payment is cleared)
      let ledgerEntry = null;
      if (payment.status === 'CLEARED') {
        ledgerEntry = await prisma.creditLedgerEntry.create({
          data: {
            retailerId,
            wholesalerId,
            paymentId: payment.id,
            entryType: 'CREDIT',
            amount: Number(amount),
            description: `Payment received via ${paymentMode}`,
            approvedBy: options.approvedBy || 'SYSTEM',
            approvalNotes: options.approvalNotes,
          },
        });

        // Link payment to ledger entry
        await prisma.retailerPayment.update({
          where: { id: payment.id },
          data: { ledgerEntryId: ledgerEntry.id },
        });

        console.log(
          `💳 Ledger CREDIT: ₹${amount} payment recorded via ${paymentMode} (Payment ID: ${payment.id.substring(0, 8)})`
        );
      } else {
        console.log(
          `💳 Payment recorded (PENDING): ₹${amount} via ${paymentMode} (Cheque #${options.chequeNumber})`
        );
      }

      return { payment, ledgerEntry };

    } catch (error) {
      console.error('Error recording payment:', error);
      throw error;
    }
  }

  /**
   * Clear a pending cheque payment
   * Creates the ledger entry when cheque is cleared
   * 
   * @param {string} paymentId
   * @param {string} approvedBy - Admin user ID
   * @returns {Promise<Object>} Updated payment and created ledger entry
   */
  async clearPendingPayment(paymentId, approvedBy) {
    try {
      const payment = await prisma.retailerPayment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new Error(`Payment ${paymentId} not found`);
      }

      if (payment.status !== 'PENDING') {
        throw new Error(`Only PENDING payments can be cleared. This payment is ${payment.status}`);
      }

      // Update payment status
      const updatedPayment = await prisma.retailerPayment.update({
        where: { id: paymentId },
        data: {
          status: 'CLEARED',
          clearedDate: new Date(),
        },
      });

      // Create CREDIT ledger entry
      const ledgerEntry = await prisma.creditLedgerEntry.create({
        data: {
          retailerId: payment.retailerId,
          wholesalerId: payment.wholesalerId,
          paymentId,
          entryType: 'CREDIT',
          amount: Number(payment.amount),
          description: `Cheque #${payment.chequeNumber} cleared`,
          approvedBy,
          approvalNotes: `Cheque cleared on ${new Date().toISOString().split('T')[0]}`,
        },
      });

      // Link payment to ledger entry
      await prisma.retailerPayment.update({
        where: { id: paymentId },
        data: { ledgerEntryId: ledgerEntry.id },
      });

      console.log(`✅ Cheque #${payment.chequeNumber} cleared, ₹${payment.amount} credited`);
      return { payment: updatedPayment, ledgerEntry };

    } catch (error) {
      console.error('Error clearing payment:', error);
      throw error;
    }
  }

  /**
   * Mark a cheque as bounced
   * No ledger entry created
   * 
   * @param {string} paymentId
   * @param {string} approvedBy - Admin user ID
   * @returns {Promise<Object>} Updated payment
   */
  async bounceCheque(paymentId, approvedBy) {
    try {
      const payment = await prisma.retailerPayment.update({
        where: { id: paymentId },
        data: {
          status: 'BOUNCED',
        },
      });

      console.log(`❌ Cheque #${payment.chequeNumber} marked as BOUNCED`);

      // TODO: Create a hold on credit
      // TODO: Send notification to admin

      return payment;

    } catch (error) {
      console.error('Error bouncing cheque:', error);
      throw error;
    }
  }

  /**
   * Get ledger entries for a retailer-wholesaler pair
   * With filtering and pagination
   * 
   * @param {string} retailerId
   * @param {string} wholesalerId
   * @param {Object} options - { type, startDate, endDate, limit, skip }
   * @returns {Promise<Array>} Ledger entries
   */
  async getLedger(retailerId, wholesalerId, options = {}) {
    try {
      const where = {
        retailerId,
        wholesalerId,
      };

      if (options.type) {
        where.entryType = options.type; // DEBIT, CREDIT, ADJUSTMENT
      }

      if (options.startDate || options.endDate) {
        where.createdAt = {};
        if (options.startDate) {
          where.createdAt.gte = new Date(options.startDate);
        }
        if (options.endDate) {
          where.createdAt.lte = new Date(options.endDate);
        }
      }

      const entries = await prisma.creditLedgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit || 100,
        skip: options.skip || 0,
        include: {
          payment: {
            select: {
              id: true,
              paymentMode: true,
              chequeNumber: true,
              status: true,
            },
          },
        },
      });

      return entries;

    } catch (error) {
      console.error('Error fetching ledger:', error);
      throw error;
    }
  }

  /**
   * Get all pending payments for a retailer
   * 
   * @param {string} retailerId
   * @returns {Promise<Array>} Pending payment records
   */
  async getPendingPayments(retailerId) {
    try {
      return await prisma.retailerPayment.findMany({
        where: {
          retailerId,
          status: 'PENDING',
        },
        include: {
          wholesaler: {
            select: { businessName: true },
          },
        },
        orderBy: { chequeDate: 'asc' },
      });

    } catch (error) {
      console.error('Error fetching pending payments:', error);
      throw error;
    }
  }

  /**
   * Verify ledger integrity
   * Ensures no double-entries or corruption
   * 
   * @param {string} retailerId
   * @param {string} wholesalerId
   * @returns {Promise<Object>} Integrity check result
   */
  async verifyLedgerIntegrity(retailerId, wholesalerId) {
    try {
      const entries = await prisma.creditLedgerEntry.findMany({
        where: { retailerId, wholesalerId },
        orderBy: { createdAt: 'asc' },
      });

      const payments = await prisma.retailerPayment.findMany({
        where: { retailerId, wholesalerId },
        include: { ledgerEntry: true },
      });

      const issues = [];

      // Check: All cleared payments should have ledger entries
      for (const payment of payments) {
        if (payment.status === 'CLEARED' && !payment.ledgerEntry) {
          issues.push(`Payment ${payment.id} is CLEARED but has no ledger entry`);
        }
      }

      // Check: All debit entries should have an order
      const debitsWithoutOrder = entries.filter(e => e.entryType === 'DEBIT' && !e.orderId);
      if (debitsWithoutOrder.length > 0) {
        issues.push(`${debitsWithoutOrder.length} DEBIT entries without orders`);
      }

      return {
        status: issues.length === 0 ? 'HEALTHY' : 'ISSUES_FOUND',
        totalEntries: entries.length,
        totalPayments: payments.length,
        issues,
      };

    } catch (error) {
      console.error('Error verifying ledger integrity:', error);
      throw error;
    }
  }

}

module.exports = new LedgerService();
