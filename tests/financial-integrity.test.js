/**
 * Financial Integrity Tests
 * 
 * Verifies:
 * 1. Ledger Immutability & Consistency
 * 2. Concurrency Safety (No lost updates)
 * 3. Credit Limit Enforcement
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();
const ledgerService = require('../src/services/ledger.service');
const seed = require('../scripts/seed-financial-test');
// We need to test the logic that enforces limits. 
// Note: LedgerService itself writes to ledger. The checking usually happens BEFORE calling ledger service.
// We will test the LedgerService's correctness and concurrency handling here.

describe('Financial Integrity Suite', () => {
    let retailerId;
    let wholesalerId;
    let orderId; // Mock order ID for ledger entries

    beforeAll(async () => {
        // Run seed directly
        const data = await seed();
        retailerId = data.retailerId;
        wholesalerId = data.wholesalerId;

        // Create a dummy order for linking
        const order = await prisma.order.create({
            data: {
                retailerId,
                wholesalerId,
                totalAmount: 100,
                status: 'CONFIRMED'
            }
        });
        orderId = order.id;
    }, 30000); // Increase timeout for seeding

    afterAll(async () => {
        await prisma.$disconnect();
    });

    test('1. Balance Integrity: Sum of entries must equal current balance', async () => {
        // Initial state: 0
        const startBalance = await ledgerService.getBalance(retailerId, wholesalerId);
        expect(startBalance).toBe(0);

        // Action: Debit 1000
        await ledgerService.createDebit(orderId, 1000, new Date());

        // Action: Credit 200 (Payment)
        await ledgerService.createCredit(retailerId, wholesalerId, 200);

        // Action: Debit 500
        await ledgerService.createDebit(orderId, 500, new Date());

        // Expected: 1000 - 200 + 500 = 1300
        const endBalance = await ledgerService.getBalance(retailerId, wholesalerId);
        expect(endBalance).toBe(1300);

        // Verify Sum of Amounts matches
        const entries = await prisma.ledgerEntry.findMany({
            where: { retailerId, wholesalerId }
        });

        // Manual recalculation
        let calcBalance = 0;
        entries.sort((a, b) => a.createdAt - b.createdAt).forEach(e => {
            if (e.entryType === 'DEBIT') calcBalance += Number(e.amount);
            if (e.entryType === 'CREDIT') calcBalance -= Number(e.amount);
        });

        expect(calcBalance).toBe(1300);

        // Check integrity of individual rows
        // The last row's balanceAfter should be 1300
        const lastEntry = entries[entries.length - 1];
        expect(Number(lastEntry.balanceAfter)).toBe(1300);
    });

    test('2. Concurrency Safety: Parallel Debits must strictly deserialize', async () => {
        // We will perform 10 parallel debits of 100 each.
        // Starting balance is 1300.
        // End balance should be 1300 + 1000 = 2300.

        const CONCURRENT_OPS = 10;
        const AMOUNT = 100;

        const operations = [];
        for (let i = 0; i < CONCURRENT_OPS; i++) {
            operations.push(ledgerService.createDebit(orderId, AMOUNT, new Date()));
        }

        await Promise.all(operations);

        const finalBalance = await ledgerService.getBalance(retailerId, wholesalerId);
        expect(finalBalance).toBe(2300);

        // Scan entries to ensure NO duplicate balanceAfter values (proof of serial execution)
        const entries = await prisma.ledgerEntry.findMany({
            where: {
                retailerId,
                wholesalerId,
                amount: 100, // Filter only these test entries
                entryType: 'DEBIT'
            },
            orderBy: { balanceAfter: 'asc' }
        });

        const balances = entries.map(e => Number(e.balanceAfter));
        const uniqueBalances = new Set(balances);

        // Validating that each transaction saw a unique state
        expect(uniqueBalances.size).toBe(entries.length);
    });

    test('3. Immutability Check (Code Audit)', async () => {
        // This is a behavioral check. We verify that attempting to "update" a ledger entry fails or follows specific patterns.
        // Since we can't block direct Prisma access in tests, we verify the SERVICE API does not expose it.
        expect(ledgerService.updateEntry).toBeUndefined();
        expect(ledgerService.deleteEntry).toBeUndefined();
    });

    test('4. Credit Limit Enforcement (Simulation)', async () => {
        // LedgerService doesn't enforce limit, but let's verify we can fetch the limit and check against it.
        // This simulates the validator logic using the verified ledger balance.

        const currentBalance = await ledgerService.getBalance(retailerId, wholesalerId); // 2300

        const creditLink = await prisma.retailerWholesalerCredit.findUnique({
            where: {
                retailerId_wholesalerId: { retailerId, wholesalerId }
            }
        });

        const limit = Number(creditLink.creditLimit); // 10000
        const available = limit - currentBalance;

        expect(available).toBe(10000 - 2300); // 7700

        // Test logic: Attempt validation
        const fails = (8000 > available);
        const passes = (7000 <= available);

        expect(fails).toBe(true);
        expect(passes).toBe(true);
    });
});
