const ledgerService = require('../../src/services/ledger.service');
const prisma = require('../../src/config/database');

// Mock Prisma
jest.mock('../../src/config/database', () => ({
    ledgerEntry: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
    },
    retailerWholesalerCredit: {
        findUnique: jest.fn(),
        upsert: jest.fn()
    },
    $transaction: jest.fn((callback) => callback(prisma))
}));

describe('Idempotency Tests', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should return EXISTING ledger entry if idempotency key matches (No Double Spend)', async () => {
        const idempotencyKey = 'unique_key_123';
        const mockEntry = { id: 'existing_id', idempotencyKey, amount: 100 };

        // Mock FindUnique to return existing
        prisma.ledgerEntry.findUnique.mockResolvedValue(mockEntry);

        const result = await ledgerService.recordTransaction({
            idempotencyKey,
            retailerId: 'r1',
            wholesalerId: 'w1',
            amount: 100,
            type: 'DEBIT'
        });

        // Verification
        expect(result).toBe(mockEntry); // Should happen immediately
        expect(prisma.ledgerEntry.create).not.toHaveBeenCalled(); // No new write
        expect(prisma.retailerWholesalerCredit.upsert).not.toHaveBeenCalled(); // No double credit update
    });

    it('should create NEW entry if key is new', async () => {
        const idempotencyKey = 'new_key_456';

        // Mock FindUnique to null (not found)
        prisma.ledgerEntry.findUnique.mockResolvedValue(null);
        prisma.ledgerEntry.findFirst.mockResolvedValue(null); // No prev entry

        // Mock Create
        prisma.ledgerEntry.create.mockImplementation((args) => Promise.resolve(args.data));
        prisma.retailerWholesalerCredit.upsert.mockResolvedValue({});

        await ledgerService.recordTransaction({
            idempotencyKey,
            retailerId: 'r1',
            wholesalerId: 'w1',
            amount: 50,
            type: 'DEBIT'
        });

        // Verification
        expect(prisma.ledgerEntry.create).toHaveBeenCalled();
        expect(prisma.retailerWholesalerCredit.upsert).toHaveBeenCalled();
    });

});
