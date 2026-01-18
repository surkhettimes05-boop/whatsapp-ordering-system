/**
 * WhatsApp Credit Check Validator Service
 * 
 * Performs credit validation for orders coming from WhatsApp
 * Checks credit limits, outstanding balance, and payment status
 * before order confirmation
 */

const prisma = require('../config/database');
const whatsappCreditMessages = require('./whatsapp-credit-messages.service');

class WhatsAppCreditValidatorService {
  /**
   * Main credit validation function
   * Called before confirming order
   * 
   * Returns: {
   *   approved: boolean,
   *   creditInfo: { creditLimit, usedCredit, availableCredit, outstandingAmount, outstandingDays, creditStatus },
   *   reason: string (if rejected),
   *   message: string (WhatsApp message to send)
   * }
   */
  async validateOrderCredit(retailerId, orderAmount) {
    try {
      // Fetch retailer with credit details
      const retailer = await prisma.retailer.findUnique({
        where: { id: retailerId },
        include: {
          credit: true,
          transactions: {
            where: { type: 'DEBIT', status: 'OPEN' },
            orderBy: { createdAt: 'asc' }
          }
        }
      });

      if (!retailer) {
        return {
          approved: false,
          reason: 'RETAILER_NOT_FOUND',
          message: whatsappCreditMessages.getCreditCheckErrorMessage()
        };
      }

      // Check 1: Has credit account
      if (!retailer.credit) {
        return {
          approved: false,
          reason: 'NO_CREDIT_ACCOUNT',
          message: '❌ No credit account found. Contact support to set up credit.'
        };
      }

      // Check 2: Credit status is ACTIVE
      if (retailer.creditStatus !== 'ACTIVE') {
        return {
          approved: false,
          reason: 'CREDIT_PAUSED',
          message: whatsappCreditMessages.getCreditPausedMessage(retailer, retailer.creditPauseReason)
        };
      }

      // Check 3: Calculate available credit
      const creditLimit = parseFloat(retailer.credit.creditLimit);
      const usedCredit = parseFloat(retailer.credit.usedCredit || 0);
      const availableCredit = creditLimit - usedCredit;

      // Check 4: Calculate outstanding balance
      const outstandingAmount = retailer.transactions.reduce((sum, t) => {
        return sum + parseFloat(t.amount || 0);
      }, 0);

      // Check 5: Check for overdue payments
      const oldestTransaction = retailer.transactions.length > 0
        ? retailer.transactions[0]
        : null;

      const maxDays = retailer.credit.maxOutstandingDays || 30;
      const outstandingDays = oldestTransaction
        ? Math.floor((new Date() - new Date(oldestTransaction.createdAt)) / (1000 * 60 * 60 * 24))
        : 0;

      const isOverdue = outstandingDays > maxDays;

      // Build credit info
      const creditInfo = {
        creditLimit,
        usedCredit,
        availableCredit,
        outstandingAmount,
        outstandingDays,
        isOverdue,
        creditStatus: retailer.creditStatus,
        maxOutstandingDays: maxDays
      };

      // Check 6: Order amount validation
      if (orderAmount > availableCredit) {
        // NOT ENOUGH CREDIT
        return {
          approved: false,
          reason: 'INSUFFICIENT_CREDIT',
          creditInfo,
          message: whatsappCreditMessages.getCreditExceededMessage(retailer, { totalAmount: orderAmount, id: 'temp' }, creditInfo)
        };
      }

      // Check 7: If customer has overdue balance, warn but allow
      if (isOverdue && outstandingAmount > 0) {
        console.warn(`⚠️ OVERDUE ALERT: ${retailer.pasalName} has ${outstandingDays} days outstanding`);
        // Still approved but flagged for monitoring
      }

      // ✅ CREDIT APPROVED
      return {
        approved: true,
        creditInfo,
        reason: 'CREDIT_APPROVED'
      };

    } catch (error) {
      console.error('Credit validation error:', error);
      return {
        approved: false,
        reason: 'SYSTEM_ERROR',
        message: whatsappCreditMessages.getCreditCheckErrorMessage()
      };
    }
  }

  /**
   * Get comprehensive credit info for a retailer
   * Used for "Check Credit" command
   */
  async getRetailerCreditInfo(retailerId) {
    try {
      const retailer = await prisma.retailer.findUnique({
        where: { id: retailerId },
        include: {
          credit: true,
          transactions: {
            where: { type: 'DEBIT', status: 'OPEN' },
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        }
      });

      if (!retailer || !retailer.credit) {
        return {
          creditLimit: 0,
          usedCredit: 0,
          availableCredit: 0,
          outstandingAmount: 0,
          outstandingDays: 0,
          creditStatus: 'INACTIVE',
          pendingTransactions: 0
        };
      }

      const creditLimit = parseFloat(retailer.credit.creditLimit);
      const usedCredit = parseFloat(retailer.credit.usedCredit || 0);
      const availableCredit = creditLimit - usedCredit;

      const outstandingAmount = retailer.transactions.reduce((sum, t) => {
        return sum + parseFloat(t.amount || 0);
      }, 0);

      const oldestTransaction = retailer.transactions.length > 0
        ? retailer.transactions[retailer.transactions.length - 1]
        : null;

      const outstandingDays = oldestTransaction
        ? Math.floor((new Date() - new Date(oldestTransaction.createdAt)) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        creditLimit,
        usedCredit,
        availableCredit,
        outstandingAmount,
        outstandingDays,
        creditStatus: retailer.creditStatus,
        pendingTransactions: retailer.transactions.length
      };
    } catch (error) {
      console.error('Error fetching credit info:', error);
      return null;
    }
  }

  /**
   * Check if retailer can make an additional purchase
   * without exceeding limits
   */
  canMakePurchase(availableCredit, orderAmount) {
    return orderAmount <= availableCredit && availableCredit > 0;
  }

  /**
   * Get suggested order amount if customer doesn't have enough credit
   */
  getSuggestedOrderAmount(availableCredit) {
    // Round down to nearest 100 for nice numbers
    return Math.floor(availableCredit / 100) * 100;
  }

  /**
   * Log credit check event for audit trail
   */
  async logCreditCheck(retailerId, orderAmount, approved, reason) {
    try {
      await prisma.creditAuditLog.create({
        data: {
          retailerId,
          action: 'CREDIT_CHECK',
          orderAmount,
          approved,
          reason,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Error logging credit check:', error);
      // Don't throw - audit logging should not block order flow
    }
  }

  /**
   * Create a hold on retailer's credit when order is placed
   * This prevents double-spending while order is processing
   */
  async placeTemporaryHold(retailerId, orderAmount, orderId) {
    try {
      // Create a hold transaction
      await prisma.creditHold.create({
        data: {
          retailerId,
          orderId,
          amount: orderAmount,
          status: 'ACTIVE',
          createdAt: new Date()
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error placing credit hold:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Release temporary hold if order is cancelled
   */
  async releaseTemporaryHold(orderId) {
    try {
      await prisma.creditHold.updateMany({
        where: { orderId, status: 'ACTIVE' },
        data: { status: 'RELEASED' }
      });

      return { success: true };
    } catch (error) {
      console.error('Error releasing credit hold:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Finalize credit deduction after order is placed
   */
  async finalizeCredit(retailerId, orderId, orderAmount) {
    try {
      // Update used credit
      const creditAccount = await prisma.creditAccount.findUnique({
        where: { retailerId }
      });

      if (!creditAccount) {
        throw new Error('Credit account not found');
      }

      const newUsedCredit = parseFloat(creditAccount.usedCredit || 0) + orderAmount;

      await prisma.creditAccount.update({
        where: { retailerId },
        data: { usedCredit: newUsedCredit }
      });

      // Create transaction record
      await prisma.creditTransaction.create({
        data: {
          retailerId,
          orderId,
          amount: orderAmount,
          type: 'DEBIT',
          status: 'OPEN',
          createdAt: new Date()
        }
      });

      // Release the temporary hold
      await this.releaseTemporaryHold(orderId);

      return { success: true, newUsedCredit };
    } catch (error) {
      console.error('Error finalizing credit:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new WhatsAppCreditValidatorService();
