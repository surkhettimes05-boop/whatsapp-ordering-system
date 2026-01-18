require('dotenv').config();
const { broadcastOrder } = require('./src/services/broadcast.service');
const prisma = require('./src/config/database');

async function verifyBroadcast() {
    console.log('🧪 Starting Broadcast Verification Test');

    try {
        // 1. Setup Test Data
        const category = await prisma.category.upsert({
            where: { name: 'Test Category' },
            update: {},
            create: { name: 'Test Category' }
        });

        const product = await prisma.product.create({
            data: {
                name: 'Test Product ' + Date.now(),
                categoryId: category.id,
                fixedPrice: 100,
                unit: 'kg'
            }
        });

        const retailer = await prisma.retailer.create({
            data: {
                phoneNumber: '+97798' + Math.floor(Math.random() * 100000000),
                pasalName: 'Test Retailer',
                latitude: 27.7172,
                longitude: 85.3240, // Kathmandu
            }
        });

        const wholesaler = await prisma.wholesaler.create({
            data: {
                businessName: 'Nearby Wholesaler ' + Date.now(),
                ownerName: 'Test Owner',
                phoneNumber: '+97798' + Math.floor(Math.random() * 100000000),
                whatsappNumber: '+97798' + Math.floor(Math.random() * 100000000),
                businessAddress: 'Kathmandu',
                city: 'Kathmandu',
                state: 'Bagmati',
                pincode: '44600',
                latitude: 27.7180,
                longitude: 85.3250, // Very close
                deliveryRadius: 10,
                isActive: true,
                categories: JSON.stringify(['Test Category'])
            }
        });

        await prisma.wholesalerProduct.create({
            data: {
                wholesalerId: wholesaler.id,
                productId: product.id,
                stock: 100,
                priceOffered: 90,
                isAvailable: true
            }
        });

        const order = await prisma.order.create({
            data: {
                retailerId: retailer.id,
                totalAmount: 100,
                paymentMode: 'COD',
                status: 'PLACED',
                items: {
                    create: [
                        {
                            productId: product.id,
                            quantity: 1,
                            priceAtOrder: 100
                        }
                    ]
                }
            }
        });

        console.log(`✅ Test data setup complete. Order ID: ${order.id}`);

        // 2. Call broadcastOrder
        console.log('📡 Calling broadcastOrder...');
        const result = await broadcastOrder(order.id);

        console.log('📊 Broadcast Result:', JSON.stringify(result, null, 2));

        // 3. Verify Order Updates
        const updatedOrder = await prisma.order.findUnique({
            where: { id: order.id }
        });

        if (updatedOrder.expires_at) {
            console.log('✅ Order expires_at is set:', updatedOrder.expires_at);
        } else {
            console.error('❌ Order expires_at NOT set');
        }

        if (updatedOrder.status === 'PENDING_BIDS') {
            console.log('✅ Order status updated to PENDING_BIDS');
        } else {
            console.error('❌ Order status NOT updated correctly:', updatedOrder.status);
        }

        if (result.sentCount > 0) {
            console.log(`✅ Message sent to ${result.sentCount} wholesalers`);
        } else {
            console.error('❌ No messages sent. Check eligibility logic.');
            console.log('Checking why no wholesalers were eligible...');
            const debugOrder = await prisma.order.findUnique({
                where: { id: order.id },
                include: { items: true, retailer: true }
            });
            const candidates = await prisma.wholesaler.findMany({
                where: { isActive: true },
                include: { products: true }
            });
            console.log(`Total active wholesalers: ${candidates.length}`);
            candidates.forEach(w => {
                console.log(`Wholesaler: ${w.businessName}`);
                console.log(`- Products: ${w.products.length}`);
                console.log(`- Lat/Lon: ${w.latitude}/${w.longitude}`);
            });
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await prisma.$disconnect();
        console.log('🏁 Test finished.');
    }
}

verifyBroadcast();
