const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const orderRoutingService = require('./src/services/orderRoutingService');

async function testRouting() {
    console.log('🧪 Testing Intelligent Routing Service\n');

    try {
        // 1. Get a test retailer (Phokara Mobile Shop - in Pokhara)
        const retailer = await prisma.retailer.findFirst({
            where: { city: 'Pokhara' }
        });

        if (!retailer) {
            throw new Error('Test retailer not found. Run seed first.');
        }
        console.log(`👤 Customer: ${retailer.pasalName} in ${retailer.city}`);

        // 2. Get a product to order (iPhone 15)
        const product = await prisma.product.findFirst({
            where: { name: { contains: 'iPhone 15' } }
        });

        if (!product) {
            throw new Error('Test product not found.');
        }
        console.log(`📱 Product: ${product.name}\n`);

        // 3. Define the Order Items
        const items = [
            { productId: product.id, quantity: 1 }
        ];

        // 4. Run the Routing Algorithm
        console.log('🔄 Running routing algorithm...');
        const result = await orderRoutingService.findBestWholesaler(retailer.id, items);

        // 5. Display Results
        console.log('\n═══════════════════════════════════════');
        console.log('🎯 ROUTING RESULT');
        console.log('═══════════════════════════════════════');
        console.log(`✅ Selected Wholesaler: ${result.selectedWholesaler.businessName}`);
        console.log(`📍 Location: ${result.selectedWholesaler.city}`);
        console.log(`📊 Final Score: ${result.routingScore.toFixed(2)}/100`);
        console.log(`📝 Reason: ${result.routingReason}`);

        console.log('\n📉 Candidate Comparison:');
        result.allCandidates.forEach((c, i) => {
            console.log(`   ${i + 1}. ${c.name} (Score: ${c.score.toFixed(2)})`);
        });

        // Verification Logic for testing
        // Expectation: Pokhara Premium Suppliers should win because customer is in Pokhara
        // Even if price is slightly higher, distance score (100) vs Kathmandu (20 or 40) is huge difference.

        if (result.selectedWholesaler.city === 'Pokhara') {
            console.log('\n✅ TEST PASSED: correctly routed to local wholesaler.');
        } else {
            console.log('\n❌ TEST FAILED: Routing logic might need tuning.');
        }

    } catch (error) {
        console.error('❌ Routing Test Failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testRouting();
