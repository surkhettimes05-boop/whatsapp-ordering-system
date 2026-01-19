const mock = require('./jest.prisma-mock.js');
const { PrismaClient, __resetMockStore__ } = mock;
const prisma = new PrismaClient();

async function debug() {
    console.log('Resetting store...');
    __resetMockStore__();

    try {
        console.log('Testing transaction with create...');
        await prisma.$transaction(async (tx) => {
            await tx.retailer.create({
                data: {
                    pasalName: 'Test',
                    phoneNumber: '123'
                }
            });
        });
        console.log('✓ Transaction 1 passed');

        // Check if retailer exists
        const r = await prisma.retailer.findMany();
        console.log('✓ Retailers count:', r.length);

        // Test nested/sequential transactions
        await prisma.$transaction(async (tx) => {
            await tx.wholesaler.create({
                data: { businessName: 'W1', whatsappNumber: '111' }
            });
        });
        console.log('✓ Transaction 2 passed');

    } catch (err) {
        console.error('❌ FAILED with error:', err.message);
        console.error(err.stack);
    }
}

debug();
