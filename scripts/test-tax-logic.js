const prisma = require('../config/database');
const orderService = require('../src/services/order.service');

async function testTaxLogic() {
    console.log('🧪 Testing Tax Logic (13% VAT)...');

    try {
        // 1. Setup Test Data
        console.log('Creating dummy retailer and product...');
        const retailer = await prisma.retailer.findFirst();
        if (!retailer) throw new Error('No retailer found. Seed db first.');

        const product = await prisma.product.findFirst();
        if (!product) throw new Error('No product found. Seed db first.');

        // 2. Create Order
        console.log(`Creating order for product: ${product.name} (Price: ${product.fixedPrice})`);
        const quantity = 2;
        const items = [{ productId: product.id, quantity }];

        const order = await orderService.createOrder(retailer.id, items);

        // 3. Verify Calculations
        const expectedSubtotal = Number(product.fixedPrice) * quantity;
        const expectedTax = expectedSubtotal * 0.13;
        const expectedTotal = expectedSubtotal + expectedTax;

        console.log('--------------------------------');
        console.log('Order Details:', {
            id: order.id,
            subtotal: Number(order.subtotal),
            taxRate: Number(order.taxRate),
            taxAmount: Number(order.taxAmount),
            totalAmount: Number(order.totalAmount)
        });

        console.log('Expected:', {
            subtotal: expectedSubtotal,
            taxAmount: expectedTax,
            totalAmount: expectedTotal
        });

        // Allow small float precision difference
        const isClose = (a, b) => Math.abs(a - b) < 0.01;

        if (
            isClose(Number(order.subtotal), expectedSubtotal) &&
            isClose(Number(order.taxAmount), expectedTax) &&
            isClose(Number(order.totalAmount), expectedTotal)
        ) {
            console.log('✅ PASS: Tax logic verified correctly.');
        } else {
            console.error('❌ FAIL: Mismatch in calculations.');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Test Failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

testTaxLogic();
