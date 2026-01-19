/**
 * Mock Verification Test
 * Validates that the Prisma mock works correctly
 */

const { PrismaClient } = require('@prisma/client');

describe('Prisma Mock Verification', () => {
  let prisma;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  test('Mock initializes without errors', () => {
    expect(prisma).toBeDefined();
    expect(prisma.$transaction).toBeDefined();
    expect(prisma.ledgerEntry).toBeDefined();
  });

  test('Can create and retrieve a retailer', async () => {
    const retailer = await prisma.retailer.create({
      data: {
        pasalName: 'Test Retailer',
        phoneNumber: '9876543210',
        status: 'ACTIVE'
      }
    });

    expect(retailer).toBeDefined();
    expect(retailer.id).toBeDefined();
    expect(retailer.pasalName).toBe('Test Retailer');

    const found = await prisma.retailer.findUnique({
      where: { id: retailer.id }
    });

    expect(found).toBeDefined();
    expect(found.pasalName).toBe('Test Retailer');
  });

  test('$transaction executes callback', async () => {
    const result = await prisma.$transaction(async (tx) => {
      const retailer = await tx.retailer.create({
        data: {
          pasalName: 'TX Retailer',
          phoneNumber: '5555555555',
          status: 'ACTIVE'
        }
      });
      return retailer.id;
    });

    expect(result).toBeDefined();
  });

  test('Concurrent transactions serialize properly', async () => {
    // Create a test retailer and wholesaler first
    const retailer = await prisma.retailer.create({
      data: {
        pasalName: 'Ledger Test Retailer',
        phoneNumber: '7777777777',
        status: 'ACTIVE'
      }
    });

    const wholesaler = await prisma.wholesaler.create({
      data: {
        businessName: 'Ledger Test Wholesaler',
        whatsappNumber: '6666666666',
        status: 'APPROVED'
      }
    });

    await prisma.retailerWholesalerCredit.create({
      data: {
        retailerId: retailer.id,
        wholesalerId: wholesaler.id,
        creditLimit: 10000,
        creditTerms: 30,
        isActive: true
      }
    });

    // Create an order for testing
    const order = await prisma.order.create({
      data: {
        retailerId: retailer.id,
        wholesalerId: wholesaler.id,
        totalAmount: 100,
        status: 'CONFIRMED'
      }
    });

    // Simulate concurrent ledger operations
    const operations = [];
    for (let i = 0; i < 5; i++) {
      operations.push(
        prisma.$transaction(async (tx) => {
          // Simulate lock
          await tx.$queryRaw`SELECT 1 FROM "RetailerWholesalerCredit"
            WHERE "retailerId" = ${retailer.id} AND "wholesalerId" = ${wholesaler.id}
            FOR UPDATE`;

          // Get last entry
          const lastEntry = await tx.ledgerEntry.findFirst({
            where: { retailerId: retailer.id, wholesalerId: wholesaler.id },
            orderBy: { createdAt: 'desc' }
          });

          const currentBalance = lastEntry ? Number(lastEntry.balanceAfter) : 0;
          const newBalance = currentBalance + 100;

          // Create entry
          const entry = await tx.ledgerEntry.create({
            data: {
              retailerId: retailer.id,
              wholesalerId: wholesaler.id,
              orderId: order.id,
              entryType: 'DEBIT',
              amount: 100,
              balanceAfter: newBalance,
              dueDate: new Date(),
              createdBy: 'SYSTEM'
            }
          });

          return entry.balanceAfter;
        })
      );
    }

    const results = await Promise.all(operations);
    
    // Check that we have unique balance values (proof of serializability)
    const uniqueBalances = new Set(results);
    expect(uniqueBalances.size).toBe(results.length);
    expect(results).toEqual([100, 200, 300, 400, 500]);
  });
});
