/**
 * Credit Check Service
 * Handles all credit-related business logic
 * 
 * BUSINESS RULES:
 * 1. Each retailer has per-wholesaler credit limits
 * 2. Credit balance = SUM(ledger.DEBIT) - SUM(ledger.CREDIT)
 * 3. Order is blocked if (current balance + order amount) > credit limit
 * 4. Ledger is append-only (immutable after creation)
 * 5. No direct updates to balance fields
 */

const { PrismaClient } = require('@prisma/client');
import prisma from '../config/prismaClient.js';

class CreditCheckService {
  
  /**
   * Calculate current outstanding balance for a retailer-wholesaler pair
   * Balance = SUM(DEBIT entries) - SUM(CREDIT entries)
   * 
   * @param {string} retailerId - Retailer ID
   * @param {string} wholesalerId - Wholesaler ID
   * @returns {Promise<Object>} { balance, totalDebits, totalCredits }
   */
  async getOutstandingBalance(retailerId, wholesalerId) {
    const ledgerEntries = await prisma.creditLedgerEntry.findMany({
      where: {
        retailerId,
        wholesalerId,
      },
    });

    // Sum up debits and credits
    const totalDebits = ledgerEntries
      .filter(e => e.entryType === 'DEBIT')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const totalCredits = ledgerEntries
      .filter(e => e.entryType === 'CREDIT')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const adjustments = ledgerEntries
      .filter(e => e.entryType === 'ADJUSTMENT')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const balance = totalDebits - totalCredits + adjustments;

    return {
      balance: Number(balance),
      totalDebits: Number(totalDebits),
      totalCredits: Number(totalCredits),
      adjustments: Number(adjustments),
      entries: ledgerEntries,
    };
  }

  /**
   * Check if a new order can be placed given credit limits
   * Returns { canPlace: boolean, reason: string, currentBalance: number }
   * 
   * @param {string} retailerId - Retailer ID
   * @param {string} wholesalerId - Wholesaler ID
   * @param {number} orderAmount - Order amount in decimal
   * @returns {Promise<Object>} Credit check result
   */
  async canPlaceOrder(retailerId, wholesalerId, orderAmount) {
    try {
      // 1. Check if credit limit exists for this retailer-wholesaler pair
      const creditConfig = await prisma.retailerWholesalerCredit.findUnique({
        where: {
          retailerId_wholesalerId: {
            retailerId,
            wholesalerId,
          },
        },
      });

      if (!creditConfig) {
        return {
          canPlace: false,
          reason: 'No credit arrangement with this wholesaler',
          currentBalance: 0,
          creditLimit: 0,
        };
      }

      // 2. Check if credit is blocked
      if (!creditConfig.isActive) {
        return {
          canPlace: false,
          reason: `Credit blocked: ${creditConfig.blockedReason || 'Admin blocked'}`,
          currentBalance: 0,
          creditLimit: Number(creditConfig.creditLimit),
        };
      }

      // 3. Check for active holds
      const activeHold = await prisma.creditHoldHistory.findFirst({
        where: {
          retailerId,
          wholesalerId,
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (activeHold) {
        return {
          canPlace: false,
          reason: `Credit hold: ${activeHold.holdReason}`,
          currentBalance: 0,
          creditLimit: Number(creditConfig.creditLimit),
        };
      }

      // 4. Get current balance
      const balanceData = await this.getOutstandingBalance(retailerId, wholesalerId);
      const projectedBalance = balanceData.balance + Number(orderAmount);

      // 5. Check if projected balance exceeds limit
      if (projectedBalance > Number(creditConfig.creditLimit)) {
        return {
          canPlace: false,
          reason: `Credit limit exceeded. Order would bring balance to ${projectedBalance}, limit is ${creditConfig.creditLimit}`,
          currentBalance: balanceData.balance,
          projectedBalance,
          creditLimit: Number(creditConfig.creditLimit),
          availableCredit: Number(creditConfig.creditLimit) - balanceData.balance,
        };
      }

      // 6. Check for overdue payments
      const overdueEntries = await this.getOverdueEntries(retailerId, wholesalerId);
      if (overdueEntries.length > 0) {
        return {
          canPlace: false,
          reason: `Outstanding overdue payments from ${overdueEntries.length} order(s)`,
          currentBalance: balanceData.balance,
          creditLimit: Number(creditConfig.creditLimit),
          overdueAmount: overdueEntries.reduce((sum, e) => sum + Number(e.amount), 0),
        };
      }

      // All checks passed
      return {
        canPlace: true,
        reason: 'Credit check passed',
        currentBalance: balanceData.balance,
        creditLimit: Number(creditConfig.creditLimit),
        availableCredit: Number(creditConfig.creditLimit) - balanceData.balance,
        creditTerms: creditConfig.creditTerms,
      };

    } catch (error) {
      console.error('Error in canPlaceOrder:', error);
      return {
        canPlace: false,
        reason: `Credit check error: ${error.message}`,
        currentBalance: 0,
      };
    }
  }

  /**
   * Get overdue payments (due date passed)
   * 
   * @param {string} retailerId
   * @param {string} wholesalerId
   * @returns {Promise<Array>} Overdue debit entries
   */
  async getOverdueEntries(retailerId, wholesalerId) {
    const now = new Date();
    return await prisma.creditLedgerEntry.findMany({
      where: {
        retailerId,
        wholesalerId,
        entryType: 'DEBIT',
        dueDate: {
          lt: now,
        },
      },
    });
  }

  /**
   * Create a DEBIT ledger entry when order is placed/delivered
   * This decreases retailer's available credit
   * 
   * @param {string} retailerId
   * @param {string} wholesalerId
   * @param {string} orderId
   * @param {number} amount
   * @param {Object} options - { description, approvedBy, creditTerms, tx }
   *                           If options.tx provided, this operation uses that transaction context
   * @returns {Promise<Object>} Created ledger entry
   */
  async createDebitEntry(retailerId, wholesalerId, orderId, amount, options = {}) {
    // ============================================
    // DEBIT ENTRY CREATION
    // ============================================
    // This method can be used in two ways:
    // 1. Standalone (standalone transaction): tx = prisma
    // 2. Within larger transaction: tx = transaction context from caller
    //
    // ROLLBACK SCENARIOS:
    // - If standalone: Any error rolls back just this entry
    // - If called from transaction: Entire transaction rolls back if this fails
    // ============================================
    
    try {
      // Use provided transaction context or default to prisma
      const tx = options.tx || prisma;

      // Get credit terms if not provided
      const creditConfig = await prisma.retailerWholesalerCredit.findUnique({
        where: {
          retailerId_wholesalerId: {
            retailerId,
            wholesalerId,
          },
        },
      });

      const creditTerms = options.creditTerms || (creditConfig?.creditTerms || 30);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + creditTerms);

      // If no transaction context provided, wrap in our own transaction
      if (!options.tx) {
        return await prisma.$transaction(async (txContext) => {
          return await txContext.creditLedgerEntry.create({
            data: {
              retailerId,
              wholesalerId,
              orderId,
              entryType: 'DEBIT',
              amount: Number(amount),
              dueDate,
              description: options.description || `Order #${orderId} delivered`,
              approvedBy: options.approvedBy || 'SYSTEM',
              approvalNotes: options.approvalNotes,
            },
          });
        });
      }

      // If transaction context provided, use it directly (no nested transaction)
      const entry = await tx.creditLedgerEntry.create({
        data: {
          retailerId,
          wholesalerId,
          orderId,
          entryType: 'DEBIT',
          amount: Number(amount),
          dueDate,
          description: options.description || `Order #${orderId} delivered`,
          approvedBy: options.approvedBy || 'SYSTEM',
          approvalNotes: options.approvalNotes,
        },
      });

      console.log(`✅ DEBIT entry created: ${retailerId} owes ${amount} to ${wholesalerId}`);
      return entry;

    } catch (error) {
      console.error('Error creating debit entry:', error);
      throw error;
    }
  }

  /**
   * Create a CREDIT ledger entry when payment is received
   * This increases retailer's available credit
   * 
   * @param {string} retailerId
   * @param {string} wholesalerId
   * @param {string} paymentId
   * @param {number} amount
   * @param {Object} options - { description, approvedBy, tx }
   *                           If options.tx provided, this operation uses that transaction context
   * @returns {Promise<Object>} Created ledger entry
   */
  async createCreditEntry(retailerId, wholesalerId, paymentId, amount, options = {}) {
    // ============================================
    // CREDIT ENTRY CREATION
    // ============================================
    // This method can be used in two ways:
    // 1. Standalone (standalone transaction): tx = prisma
    // 2. Within larger transaction: tx = transaction context from caller
    //
    // ROLLBACK SCENARIOS:
    // - If standalone: Any error rolls back just this entry
    // - If called from transaction: Entire transaction rolls back if this fails
    // ============================================
    
    try {
      // Use provided transaction context or default to prisma
      const tx = options.tx || prisma;

      // If no transaction context provided, wrap in our own transaction
      if (!options.tx) {
        return await prisma.$transaction(async (txContext) => {
          return await txContext.creditLedgerEntry.create({
            data: {
              retailerId,
              wholesalerId,
              paymentId,
              entryType: 'CREDIT',
              amount: Number(amount),
              description: options.description || `Payment received`,
              approvedBy: options.approvedBy || 'SYSTEM',
              approvalNotes: options.approvalNotes,
            },
          });
        });
      }

      // If transaction context provided, use it directly (no nested transaction)
      const entry = await tx.creditLedgerEntry.create(
        {
          data: {
            retailerId,
            wholesalerId,
            paymentId,
            entryType: 'CREDIT',
            amount: Number(amount),
            description: options.description || `Payment received`,
            approvedBy: options.approvedBy || 'SYSTEM',
            approvalNotes: options.approvalNotes,
          },
        }
      );

      console.log(`✅ CREDIT entry created: ${retailerId} paid ${amount} to ${wholesalerId}`);
      return entry;

    } catch (error) {
      console.error('Error creating credit entry:', error);
      throw error;
    }
  }

  /**
   * Create an ADJUSTMENT entry (admin override)
   * Can be positive or negative
   * 
   * @param {string} retailerId
   * @param {string} wholesalerId
   * @param {number} amount - Positive or negative
   * @param {Object} options - { reason, approvedBy (required), tx }
   *                           If options.tx provided, this operation uses that transaction context
   * @returns {Promise<Object>} Created ledger entry
   */
  async createAdjustmentEntry(retailerId, wholesalerId, amount, options = {}) {
    // ============================================
    // ADJUSTMENT ENTRY CREATION
    // ============================================
    // This method can be used in two ways:
    // 1. Standalone (standalone transaction): tx = prisma
    // 2. Within larger transaction: tx = transaction context from caller
    //
    // ROLLBACK SCENARIOS:
    // - If standalone: Any error rolls back just this entry
    // - If called from transaction: Entire transaction rolls back if this fails
    // ============================================
    
    if (!options.approvedBy) {
      throw new Error('Adjustment requires approvedBy (admin user ID)');
    }

    try {
      // Use provided transaction context or default to prisma
      const tx = options.tx || prisma;

      // If no transaction context provided, wrap in our own transaction
      if (!options.tx) {
        return await prisma.$transaction(async (txContext) => {
          return await txContext.creditLedgerEntry.create({
            data: {
              retailerId,
              wholesalerId,
              entryType: 'ADJUSTMENT',
              amount: Number(amount),
              description: options.description,
              approvalNotes: options.reason,
              approvedBy: options.approvedBy,
            },
          });
        });
      }

      // If transaction context provided, use it directly (no nested transaction)
      const entry = await tx.creditLedgerEntry.create(
        {
          data: {
            retailerId,
            wholesalerId,
            entryType: 'ADJUSTMENT',
            amount: Number(amount),
            description: options.description,
            approvalNotes: options.reason,
            approvedBy: options.approvedBy,
          },
        }
      );

      console.log(`✅ ADJUSTMENT entry: ${retailerId} balance adjusted by ${amount} (${options.reason})`);
      return entry;

    } catch (error) {
      console.error('Error creating adjustment entry:', error);
      throw error;
    }
  }

  /**
   * Place a credit hold on retailer-wholesaler relationship
   * Prevents further orders until hold is released
   * 
   * @param {string} retailerId
   * @param {string} wholesalerId
   * @param {string} holdReason - Why hold was placed
   * @param {Object} options - { notes, approvedBy }
   * @returns {Promise<Object>} Created hold history
   */
  async placeCreditHold(retailerId, wholesalerId, holdReason, options = {}) {
    try {
      const hold = await prisma.creditHoldHistory.create({
        data: {
          retailerId,
          wholesalerId,
          holdReason,
          notes: options.notes,
          isActive: true,
        },
      });

      console.log(`🔒 Credit hold placed: ${retailerId} with ${wholesalerId} - ${holdReason}`);
      return hold;

    } catch (error) {
      console.error('Error placing credit hold:', error);
      throw error;
    }
  }

  /**
   * Release a credit hold
   * 
   * @param {string} holdId
   * @param {string} releasedBy - Admin user ID
   * @param {string} releasedReason - Why hold was released
   * @returns {Promise<Object>} Updated hold history
   */
  async releaseCreditHold(holdId, releasedBy, releasedReason) {
    try {
      const hold = await prisma.creditHoldHistory.update({
        where: { id: holdId },
        data: {
          isActive: false,
          releasedAt: new Date(),
          releasedBy,
          releasedReason,
        },
      });

      console.log(`🔓 Credit hold released: ${hold.retailerId}`);
      return hold;

    } catch (error) {
      console.error('Error releasing credit hold:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive credit report for a retailer
   * 
   * @param {string} retailerId
   * @returns {Promise<Object>} Complete credit status
   */
  async getCreditReport(retailerId) {
    try {
      const creditConfigs = await prisma.retailerWholesalerCredit.findMany({
        where: { retailerId },
        include: {
          wholesaler: {
            select: { id: true, businessName: true },
          },
        },
      });

      const report = {
        retailerId,
        wholesalers: [],
      };

      for (const config of creditConfigs) {
        const balance = await this.getOutstandingBalance(retailerId, config.wholesalerId);
        const overdue = await this.getOverdueEntries(retailerId, config.wholesalerId);
        const holds = await prisma.creditHoldHistory.findMany({
          where: {
            retailerId,
            wholesalerId: config.wholesalerId,
            isActive: true,
          },
        });

        report.wholesalers.push({
          wholesalerId: config.wholesalerId,
          wholesalerName: config.wholesaler.businessName,
          creditLimit: Number(config.creditLimit),
          creditTerms: config.creditTerms,
          outstandingBalance: balance.balance,
          availableCredit: Number(config.creditLimit) - balance.balance,
          isBlocked: !config.isActive,
          blockedReason: config.blockedReason,
          activeHolds: holds.length,
          overdueAmount: overdue.reduce((sum, e) => sum + Number(e.amount), 0),
          overdueEntries: overdue.length,
        });
      }

      return report;

    } catch (error) {
      console.error('Error generating credit report:', error);
      throw error;
    }
  }

}

module.exports = new CreditCheckService();
