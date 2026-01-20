const creditCheckService = require('../../src/services/creditCheck.service');
const ledgerService = require('../../src/services/ledger.service');
const prisma = require('../../src/config/database');

// Mock Prisma
jest.mock('../../src/config/database', () => ({
    retailerWholesalerCredit: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
    },
    creditLedgerEntry: {
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
    },
    ledgerEntry: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(prisma)),
    creditHoldHistory: { // Add this mock
        findFirst: jest.fn()
    }
}));

// Fix for circular dependency in mock if needed, but simple mock usually works
// Assuming Services use the imported 'prisma' instance

describe('Financial Integrity Tests', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Credit Limit Enforcement', () => {
        const retailerId = 'ret_123';
        const wholesalerId = 'vdr_456';

        it('should REJECT order if balance + new amount > limit', async () => {
            // Mock Credit Config: Limit 10,000
            prisma.retailerWholesalerCredit.findUnique.mockResolvedValue({
                retailerId, wholesalerId, creditLimit: 10000, isActive: true
            });

            // Mock Existing Entries: Retailer owes 9,000
            prisma.creditLedgerEntry.findMany.mockResolvedValue([
                { entryType: 'DEBIT', amount: 9000 }
            ]);

            // Mock No Holds
            prisma.creditHoldHistory.findFirst.mockResolvedValue(null);

            // Attempt to spend 1,500 (Total 10,500 > 10,000)
            const result = await creditCheckService.canPlaceOrder(retailerId, wholesalerId, 1500);

            expect(result.canPlace).toBe(false);
            expect(result.reason).toContain('Credit limit exceeded');
            expect(result.currentBalance).toBe(9000);
            // Ensure strictly typed check if possible, assuming service returns Numbers
        });

        it('should ACCEPT order if balance + new amount <= limit', async () => {
            // Mock Limit 10,000
            prisma.retailerWholesalerCredit.findUnique.mockResolvedValue({
                retailerId, wholesalerId, creditLimit: 10000, isActive: true
            });

            // Mock Existing: Owes 9,000
            prisma.creditLedgerEntry.findMany.mockResolvedValue([
                { entryType: 'DEBIT', amount: 9000 }
            ]);

            // Mock No Holds
            prisma.creditHoldHistory.findFirst.mockResolvedValue(null);

            // Attempt to spend 1,000 (Total 10,000 == 10,000) -> Allowed
            const result = await creditCheckService.canPlaceOrder(retailerId, wholesalerId, 1000);

            expect(result.canPlace).toBe(true);
            expect(result.availableCredit).toBe(0); // Fully used
        });
    });

    describe('Ledger Balancing (Money Math)', () => {
        const retailerId = 'ret_money';
        const wholesalerId = 'vdr_money';

        it('should correctly sum Mixed Debits and Credits', async () => {
            // Mock entries: 
            // Debit 500.50
            // Debit 200.25
            // Credit 100.75 (Payment)
            // Expected Balance: 700.75 - 100.75 = 600.00

            prisma.creditLedgerEntry.findMany.mockResolvedValue([
                { entryType: 'DEBIT', amount: 500.50 },
                { entryType: 'DEBIT', amount: 200.25 },
                { entryType: 'CREDIT', amount: 100.75 }
            ]);

            const acc = await creditCheckService.getOutstandingBalance(retailerId, wholesalerId);

            // Strict floating point check (using closeTo for safety or exact if logic handles it)
            // Service uses Number(), so expect standard floating point behavior
            expect(acc.balance).toBeCloseTo(600.00, 2);
        });
    });

    describe('Ledger Hashing (Immutability)', () => {
        it('should change hash if amount changes', () => {
            const entryA = {
                idempotencyKey: 'id_1',
                retailerId: 'r1',
                wholesalerId: 'w1',
                amount: 100,
                entryType: 'DEBIT'
            };

            const entryB = { ...entryA, amount: 101 }; // Changed amount

            const hashA = ledgerService.calculateHash(entryA, 'prev_hash');
            const hashB = ledgerService.calculateHash(entryB, 'prev_hash');

            expect(hashA).not.toEqual(hashB);
        });
    });

});
