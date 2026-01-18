/* eslint-env jest */
const prisma = require('../src/config/database');
const creditService = require('../src/services/credit.service');
const ledgerService = require('../src/services/ledger.service');
const { runSerializableTransaction } = require('../transaction');

// Helper to reset mock store when running in test mode
async function resetStore() {
  if (prisma.__store__) {
    Object.keys(prisma.__store__).forEach(k => {
      if (k === '__counters__') return;
      prisma.__store__[k] = {};
    });
    prisma.__store__.__counters__ = {};
  }
}

describe('Financial correctness tests', () => {
  let retailer, wholesaler, credit;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    await resetStore();
    // Seed basic data
    retailer = await prisma.retailer.create({ data: { phoneNumber: '9999999991', pasalName: 'Retailer A' } });
    wholesaler = await prisma.wholesaler.create({ data: { businessName: 'WhA', ownerName: 'W', phoneNumber: '7777777700', whatsappNumber: '7777777700', businessAddress: 'Addr', city: 'C', state: 'S', pincode: '111111', latitude: 0, longitude: 0, categories: 'grocery' } });
    credit = await prisma.retailerWholesalerCredit.create({ data: { retailerId: retailer.id, wholesalerId: wholesaler.id, creditLimit: 100, creditTerms: 30, isActive: true } });
  });

  test('Ledger entries are immutable (cannot update or delete)', async () => {
    const entry = await prisma.ledgerEntry.create({ data: { retailerId: retailer.id, wholesalerId: wholesaler.id, entryType: 'DEBIT', amount: 50, balanceAfter: 50 } });

    await expect(prisma.ledgerEntry.update({ where: { id: entry.id }, data: { amount: 10 } })).rejects.toThrow(/immutable/);
    await expect(prisma.ledgerEntry.delete({ where: { id: entry.id } })).rejects.toThrow(/immutable/);
  });

  test('Balance equals sum of ledger entries', async () => {
    // Create multiple ledger entries
    await prisma.ledgerEntry.create({ data: { retailerId: retailer.id, wholesalerId: wholesaler.id, entryType: 'DEBIT', amount: 40, balanceAfter: 40 } });
    await prisma.ledgerEntry.create({ data: { retailerId: retailer.id, wholesalerId: wholesaler.id, entryType: 'DEBIT', amount: 10, balanceAfter: 50 } });
    await prisma.ledgerEntry.create({ data: { retailerId: retailer.id, wholesalerId: wholesaler.id, entryType: 'CREDIT', amount: 5, balanceAfter: 45 } });

    const calculated = await creditService.calculateBalance(retailer.id, wholesaler.id);
    // Expected: 40 + 10 - 5 = 45
    expect(calculated).toBe(45);
  });

  test('Credit limit blocks assignment when projected balance exceeds limit', async () => {
    // existing balance 90
    await prisma.ledgerEntry.create({ data: { retailerId: retailer.id, wholesalerId: wholesaler.id, entryType: 'DEBIT', amount: 90, balanceAfter: 90 } });

    const check = await creditService.checkCreditLimit(retailer.id, wholesaler.id, 20);
    expect(check.canPlace).toBe(false);
    expect(check.reason).toMatch(/Credit limit exceeded/);
  });

  test('Concurrent orders do not overdraw credit', async () => {
    // Set initial balance to 60, limit 100
    await prisma.ledgerEntry.create({ data: { retailerId: retailer.id, wholesalerId: wholesaler.id, entryType: 'DEBIT', amount: 60, balanceAfter: 60 } });

    // Helper: place order atomically with lock and check
    async function placeOrderAtomic(amount) {
      return prisma.$transaction(async (tx) => {
        // Acquire lock
        await tx.$queryRaw`SELECT 1 FROM "RetailerWholesalerCredit" WHERE "retailerId" = ${retailer.id} AND "wholesalerId" = ${wholesaler.id} FOR UPDATE`;

        // Recalculate balance
        const entries = await tx.ledgerEntry.findMany({ where: { retailerId: retailer.id, wholesalerId: wholesaler.id } });
        let current = 0;
        for (const e of entries) {
          if (e.entryType === 'DEBIT' || e.entryType === 'ADJUSTMENT') current += Number(e.amount);
          else if (e.entryType === 'CREDIT' || e.entryType === 'REVERSAL') current -= Number(e.amount);
        }

        // Check credit limit
        const account = await tx.retailerWholesalerCredit.findUnique({ where: { retailerId_wholesalerId: { retailerId: retailer.id, wholesalerId: wholesaler.id } } });
        const limit = Number(account.creditLimit);
        if (current + amount > limit) {
          throw new Error('Credit limit exceeded at placement time');
        }

        // Create ledger entry
        return await tx.ledgerEntry.create({ data: { retailerId: retailer.id, wholesalerId: wholesaler.id, entryType: 'DEBIT', amount, balanceAfter: current + amount } });
      });
    }

    // Run two placements concurrently that together would exceed limit (each 30): allowed only one
    const p1 = placeOrderAtomic(30).then(() => ({ ok: true })).catch(e => ({ ok: false, err: e.message }));
    const p2 = placeOrderAtomic(30).then(() => ({ ok: true })).catch(e => ({ ok: false, err: e.message }));

    const results = await Promise.all([p1, p2]);

    // At least one should have failed (cannot both succeed)
    const successes = results.filter(r => r.ok).length;
    expect(successes).toBeLessThanOrEqual(1);

    const finalBalance = await creditService.calculateBalance(retailer.id, wholesaler.id);
    expect(finalBalance).toBeLessThanOrEqual(Number(credit.creditLimit));
  }, 10000);

});
