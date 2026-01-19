/**
 * Debug test - simple transaction test
 */
const prisma = require('../src/config/database');

describe('Debug: Simple Transaction Test', () => {
  test('Basic transaction should work', async () => {
    // Direct test without ledgerService
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          retailerId: 'r1',
          wholesalerId: 'w1',
          totalAmount: 100,
          status: 'CONFIRMED'
        }
      });
      
      const entry = await tx.ledgerEntry.create({
        data: {
          retailerId: 'r1',
          wholesalerId: 'w1',
          orderId: order.id,
          amount: 50,
          balanceAfter: 50,
          entryType: 'DEBIT',
          createdBy: 'SYSTEM'
        }
      });

      return { order, entry };
    });

    expect(result).toBeDefined();
    expect(result.order).toBeDefined();
    expect(result.entry).toBeDefined();
    expect(result.entry.balanceAfter).toBe(50);

    // Verify data was stored
    const entries = await prisma.ledgerEntry.findMany({ where: { retailerId: 'r1' } });
    expect(entries.length).toBeGreaterThan(0);
  });
});
