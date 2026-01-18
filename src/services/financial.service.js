const prisma = require('../config/database');
const crypto = require('crypto');

class FinancialService {

  /**
   * Create ledger entry (IMMUTABLE - cannot be updated/deleted)
   * Performs a SELECT ... FOR UPDATE on CreditAccount to compute reliable balanceAfter
   * Uses Prisma transaction and database triggers to enforce credit limits.
   * @param {Object} data - { retailerId, wholesalerId, orderId, entryType, amount, description, createdBy }
   */
  async createLedgerEntry(data) {
    const { retailerId, wholesalerId, orderId, entryType, amount, description, createdBy } = data;

    if (!retailerId) throw new Error('retailerId is required');
    if (!entryType) throw new Error('entryType is required');
    if (amount === undefined || amount === null) throw new Error('amount is required');

    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount)) throw new Error('amount must be numeric');

    // Use a transaction so the SELECT ... FOR UPDATE and INSERT happen atomically
    return await prisma.$transaction(async (tx) => {
      // Lock credit account row to compute expected used credit after this entry
      const rows = await tx.$queryRaw`
        SELECT id, "usedCredit", "creditLimit" FROM "CreditAccount"
        WHERE "retailerId" = ${retailerId} FOR UPDATE
      `;

      const creditRow = Array.isArray(rows) && rows.length ? rows[0] : null;

      if (!creditRow && entryType === 'DEBIT') {
        throw new Error(`No credit account for retailer ${retailerId}; cannot apply debit ledger entry`);
      }

      const usedCredit = creditRow ? parseFloat(creditRow.usedCredit || 0) : 0;
      const creditLimit = creditRow ? parseFloat(creditRow.creditLimit || 0) : 0;

      let newUsed = usedCredit;
      if (entryType === 'DEBIT') {
        newUsed = usedCredit + numericAmount;
        if (creditRow && newUsed > creditLimit) {
          throw new Error(`Credit limit exceeded for retailer ${retailerId}`);
        }
      } else if (entryType === 'CREDIT') {
        newUsed = Math.max(0, usedCredit - numericAmount);
      } else if (entryType === 'ADJUSTMENT' || entryType === 'REVERSAL') {
        // Admin flows: amount may be positive/negative depending on semantics
        newUsed = usedCredit + numericAmount;
      }

      const referenceNumber = `TXN-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

      // Create ledger entry with computed balanceAfter. DB trigger will also update CreditAccount.usedCredit.
      const entry = await tx.ledgerEntry.create({
        data: {
          retailerId,
          wholesalerId: wholesalerId || undefined,
          orderId: orderId || undefined,
          entryType,
          amount: numericAmount,
          balanceAfter: newUsed,
          createdBy: createdBy || 'SYSTEM',
          // additional metadata
          // note: Prisma model doesn't have referenceNumber field; include in description
          // append reference to description for traceability
          // if description is empty, set to referenceNumber
          // description stored in Order or Payment models; ledger has no description column in schema
        }
      });

      return entry;
    });
  }

  /**
   * Get current balance from last ledger entry
   */
  async getCurrentBalance(retailerId) {
    const lastEntry = await prisma.ledgerEntry.findFirst({
      where: { retailerId },
      orderBy: { createdAt: 'desc' }
    });

    return lastEntry ? parseFloat(lastEntry.balanceAfter) : 0;
  }

  /**
   * Verify balance matches ledger sum (simple integrity check)
   */
  async verifyBalance(retailerId) {
    const lastEntry = await prisma.ledgerEntry.findFirst({
      where: { retailerId },
      orderBy: { createdAt: 'desc' }
    });

    const entries = await prisma.ledgerEntry.findMany({ where: { retailerId } });

    // Calculate net used credit from entries (DEBIT increases used credit)
    const calculatedUsed = entries.reduce((sum, e) => {
      const amt = Number(e.amount || 0);
      if (e.entryType === 'DEBIT') return sum + amt;
      if (e.entryType === 'CREDIT') return sum - amt;
      return sum; // ADJUSTMENT/REVERSAL require domain-specific handling
    }, 0);

    const currentBalance = lastEntry ? parseFloat(lastEntry.balanceAfter) : 0;
    const difference = Math.abs(currentBalance - calculatedUsed);

    return {
      isValid: difference < 0.01,
      currentBalance,
      calculatedUsed,
      difference
    };
  }

  /**
   * Check if retailer has available credit for an order
   */
  async checkCreditAvailable(retailerId, orderAmount) {
    const creditAccount = await prisma.creditAccount.findUnique({ where: { retailerId } });

    if (!creditAccount) throw new Error('Credit account not found');

    const creditLimit = parseFloat(creditAccount.creditLimit || 0);
    const usedCredit = parseFloat(creditAccount.usedCredit || 0);
    const available = creditLimit - usedCredit;

    if (available < Number(orderAmount)) {
      return {
        canProceed: false,
        available,
        creditLimit,
        usedCredit
      };
    }

    return {
      canProceed: true,
      available,
      creditLimit,
      usedCredit
    };
  }

  /**
   * Process order with financial checks
   */
  async processOrderFinancials(retailerId, wholesalerId, orderId, orderAmount) {
    // Check credit availability
    const creditCheck = await this.checkCreditAvailable(retailerId, orderAmount);
    if (!creditCheck.canProceed) {
      throw new Error('Insufficient credit');
    }

    // Create ledger entry for order as DEBIT (amount should be positive)
    const ledgerEntry = await this.createLedgerEntry({
      retailerId,
      wholesalerId,
      orderId,
      entryType: 'DEBIT',
      amount: Number(orderAmount),
      createdBy: 'SYSTEM'
    });

    return ledgerEntry;
  }
}

module.exports = new FinancialService();