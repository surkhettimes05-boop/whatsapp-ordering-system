// Direct test of financial integrity without Jest
const { PrismaClient } = require('./jest.prisma-mock.js');
const { __resetMockStore__ } = require('./jest.prisma-mock.js');
const prisma = new PrismaClient();
const ledgerService = require('./src/services/ledger.service');

async function runTests() {
    console.log('🧪 Running Financial Integrity Tests\n');

    // Reset mock store
    __resetMockStore__();

    // Seed data
    console.log('📦 Seeding test data...');
    const wholesaler = await prisma.wholesaler.create({
        data: {
            businessName: 'Test Wholesaler',
            whatsappNumber: '8888888888',
            status: 'APPROVED',
            isVerified: true
        }
    });

    const retailer = await prisma.retailer.create({
        data: {
            pasalName: 'Test Retailer',
            phoneNumber: '9999999999',
            status: 'ACTIVE'
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

    const order = await prisma.order.create({
        data: {
            retailerId: retailer.id,
            wholesalerId: wholesaler.id,
            totalAmount: 100,
            status: 'CONFIRMED'
        }
    });

    console.log('✅ Seed complete\n');

    // Test 1: Balance Integrity
    console.log('Test 1: Balance Integrity');
    try {
        const startBalance = await ledgerService.getBalance(retailer.id, wholesaler.id);
        console.log('  Start balance:', startBalance);

        await ledgerService.createDebit(order.id, 1000, new Date());
        await ledgerService.createCredit(retailer.id, wholesaler.id, 200);
        await ledgerService.createDebit(order.id, 500, new Date());

        const endBalance = await ledgerService.getBalance(retailer.id, wholesaler.id);
        console.log('  End balance:', endBalance, '(expected: 1300)');

        if (endBalance === 1300) {
            console.log('  ✅ PASSED\n');
        } else {
            console.log('  ❌ FAILED - Balance mismatch\n');
        }
    } catch (err) {
        console.log('  ❌ FAILED -', err.message);
        console.error(err.stack);
    }

    // Test 2: Concurrency Safety
    console.log('Test 2: Concurrency Safety');
    try {
        const CONCURRENT_OPS = 10;
        const AMOUNT = 100;

        const operations = [];
        for (let i = 0; i < CONCURRENT_OPS; i++) {
            operations.push(ledgerService.createDebit(order.id, AMOUNT, new Date()));
        }

        await Promise.all(operations);

        const finalBalance = await ledgerService.getBalance(retailer.id, wholesaler.id);
        console.log('  Final balance:', finalBalance, '(expected: 2300)');

        // Check for unique balanceAfter values
        const entries = await prisma.ledgerEntry.findMany({
            where: {
                retailerId: retailer.id,
                wholesalerId: wholesaler.id,
                amount: 100,
                entryType: 'DEBIT'
            },
            orderBy: { balanceAfter: 'asc' }
        });

        const balances = entries.map(e => Number(e.balanceAfter));
        const uniqueBalances = new Set(balances);

        console.log('  Unique balances:', uniqueBalances.size, '/', entries.length);

        if (finalBalance === 2300 && uniqueBalances.size === entries.length) {
            console.log('  ✅ PASSED\n');
        } else {
            console.log('  ❌ FAILED - Concurrency issue detected\n');
            console.log('  Balances:', balances);
        }
    } catch (err) {
        console.log('  ❌ FAILED -', err.message);
        console.error(err.stack);
    }
}

runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
