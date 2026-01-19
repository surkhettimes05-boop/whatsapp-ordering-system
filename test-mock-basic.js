// Quick test to debug the mock
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    console.log('Testing mock...');

    // Test 1: Create a retailer
    const retailer = await prisma.retailer.create({
        data: {
            pasalName: 'Test Shop',
            phoneNumber: '1234567890',
            status: 'ACTIVE'
        }
    });
    console.log('✓ Created retailer:', retailer.id);

    // Test 2: Find the retailer
    const found = await prisma.retailer.findUnique({
        where: { id: retailer.id }
    });
    console.log('✓ Found retailer:', found ? 'yes' : 'no');

    // Test 3: Transaction test
    const result = await prisma.$transaction(async (tx) => {
        const r2 = await tx.retailer.create({
            data: {
                pasalName: 'Test Shop 2',
                phoneNumber: '0987654321',
                status: 'ACTIVE'
            }
        });

        // Can we find it within the transaction?
        const foundInTx = await tx.retailer.findUnique({
            where: { id: r2.id }
        });

        console.log('✓ Created in tx:', r2.id);
        console.log('✓ Found in tx:', foundInTx ? 'yes' : 'no');

        return r2;
    });

    console.log('✓ Transaction committed:', result.id);

    // Can we find it after transaction?
    const foundAfterTx = await prisma.retailer.findUnique({
        where: { id: result.id }
    });
    console.log('✓ Found after tx:', foundAfterTx ? 'yes' : 'no');

    console.log('\n✅ All basic tests passed!');
}

test().catch(err => {
    console.error('❌ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
});
