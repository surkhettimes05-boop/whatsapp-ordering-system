const prisma = require('./src/config/database');
const creditService = require('./src/services/credit.service');

// Helper component to add days to a date
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

async function runTest() {
    console.log('🧪 Testing Credit Risk Logic...');

    try {
        // 1. Create a dummy retailer
        console.log(' Creating dummy retailer...');
        const retailer = await prisma.retailer.create({
            data: {
                phoneNumber: '9999999999',
                pasalName: 'Risk Test Pasal',
                status: 'ACTIVE',
                credit: {
                    create: {
                        creditLimit: 50000,
                        usedCredit: 0
                    }
                }
            }
        });

        // 2. Create transactions with different ages
        // We want to test logic: 
        // 0-7 days
        // 8-14 days
        // 15-30 days
        // 30+ days

        const today = new Date();

        const transactions = [
            { daysAgo: 2, amount: 1000, expectedBucket: '0-7' },
            { daysAgo: 10, amount: 2000, expectedBucket: '8-14' },
            { daysAgo: 20, amount: 3000, expectedBucket: '15-30' },
            { daysAgo: 40, amount: 4000, expectedBucket: '30+' }
        ];

        console.log(' Creating aged transactions...');
        for (const tx of transactions) {
            await prisma.creditTransaction.create({
                data: {
                    retailerId: retailer.id,
                    amount: tx.amount,
                    type: 'DEBIT',
                    status: 'OPEN',
                    createdAt: addDays(today, -tx.daysAgo)
                }
            });
            // Update used credit
            await prisma.creditAccount.update({
                where: { retailerId: retailer.id },
                data: { usedCredit: { increment: tx.amount } }
            });
        }

        // 3. Test Service System Wide
        console.log(' Fetching System Credit Risk...');
        const systemReport = await creditService.getSystemCreditRisk();

        // We filter for our retailer to verify exact numbers
        const ourRetailerStats = systemReport.retailerRisks.find(r => r.retailerId === retailer.id);

        console.log(' Retailer Stats:', ourRetailerStats);

        let pass = true;
        if (ourRetailerStats['0-7'] !== 1000) pass = false;
        if (ourRetailerStats['8-14'] !== 2000) pass = false;
        if (ourRetailerStats['15-30'] !== 3000) pass = false;
        if (ourRetailerStats['30+'] !== 4000) pass = false;
        if (ourRetailerStats.total !== 10000) pass = false;

        if (pass) {
            console.log('✅ PASS: Aging buckets calculated correctly.');
        } else {
            console.log('❌ FAIL: Buckets mismatch.');
            console.log('Expected: 1000, 2000, 3000, 4000');
            console.log('Got:', ourRetailerStats);
        }

        // 4. Test Retailer Specific
        console.log(' Fetching Retailer Profile...');
        const profile = await creditService.getRetailerCreditProfile(retailer.id);
        if (profile['30+'] === 4000) {
            console.log('✅ PASS: Retailer profile access works.');
        } else {
            console.log('❌ FAIL: Retailer profile mismatch.');
        }

        // Cleanup
        console.log(' Cleaning up...');
        await prisma.creditTransaction.deleteMany({ where: { retailerId: retailer.id } });
        await prisma.creditAccount.delete({ where: { retailerId: retailer.id } });
        await prisma.retailer.delete({ where: { id: retailer.id } });

    } catch (err) {
        console.error('Errors:', err);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
