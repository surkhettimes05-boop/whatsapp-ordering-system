const prisma = require('./src/config/database');
const orderService = require('./src/services/order.service.v2');

async function test() {
    try {
        console.log('Testing Order Creation...');

        // 1. Get/Create Wholesaler & Product
        const wholesaler = await prisma.wholesaler.findFirst();
        const product = await prisma.product.findFirst();

        if (!wholesaler || !product) {
            console.error('Run seeds first');
            return;
        }

        // 2. Create Retailer
        const retailer = await prisma.retailer.upsert({
            where: { phoneNumber: '9800000000' },
            update: {},
            create: {
                phoneNumber: '9800000000',
                pasalName: "Test Pasal",
                status: "ACTIVE"
            }
        });

        // 3. Try to Create Order
        const items = [{ productId: product.id, quantity: 1 }];

        console.log(`Placing order for ${retailer.pasalName} with wholesaler ${wholesaler.businessName}...`);

        const result = await orderService.createOrderWithInventory(
            retailer.id,
            wholesaler.id,
            items
        );

        console.log('✅ Order Created!', result);

    } catch (e) {
        console.error('❌ Order Creation Failed:', e.message);
        require('fs').writeFileSync('error_full.log', e.stack);
        if (e.message.includes('Foreign key constraint outcome')) {
            console.error('CONFIRMED: Logic error - cannot reserve stock for non-existent Order ID');
        }
    } finally {
        await prisma.$disconnect();
    }
}

test();
