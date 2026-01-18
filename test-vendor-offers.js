require('dotenv').config();
const prisma = require('./src/config/database');
const messageParser = require('./src/services/messageParser.service');
const vendorOfferService = require('./src/services/vendorOffer.service');
const broadcastService = require('./src/services/broadcast.service');

async function testVendorOfferFlow() {
    console.log('🧪 Testing Vendor Offer Flow\n');
    console.log('='.repeat(70));

    try {
        // STEP 1: Setup Test Data
        console.log('\n📦 STEP 1: Setting up test data...');

        const category = await prisma.category.upsert({
            where: { name: 'Electronics' },
            update: {},
            create: { name: 'Electronics' }
        });

        const product = await prisma.product.create({
            data: {
                name: 'Test Product ' + Date.now(),
                categoryId: category.id,
                fixedPrice: 1000,
                unit: 'pcs'
            }
        });

        const retailer = await prisma.retailer.create({
            data: {
                phoneNumber: '+97798' + Math.floor(Math.random() * 100000000),
                pasalName: 'Test Retailer Shop',
                latitude: 27.7172,
                longitude: 85.3240, // Kathmandu
            }
        });

        const wholesaler1 = await prisma.wholesaler.create({
            data: {
                businessName: 'Wholesaler A ' + Date.now(),
                ownerName: 'Owner A',
                phoneNumber: '+97798' + Math.floor(Math.random() * 100000000),
                whatsappNumber: '+97798' + Math.floor(Math.random() * 100000000),
                businessAddress: 'Kathmandu',
                city: 'Kathmandu',
                state: 'Bagmati',
                pincode: '44600',
                latitude: 27.7180,
                longitude: 85.3250,
                deliveryRadius: 10,
                isActive: true,
                categories: JSON.stringify(['Electronics'])
            }
        });

        const wholesaler2 = await prisma.wholesaler.create({
            data: {
                businessName: 'Wholesaler B ' + Date.now(),
                ownerName: 'Owner B',
                phoneNumber: '+97798' + Math.floor(Math.random() * 100000000),
                whatsappNumber: '+97798' + Math.floor(Math.random() * 100000000),
                businessAddress: 'Kathmandu',
                city: 'Kathmandu',
                state: 'Bagmati',
                pincode: '44600',
                latitude: 27.7175,
                longitude: 85.3245,
                deliveryRadius: 10,
                isActive: true,
                categories: JSON.stringify(['Electronics'])
            }
        });

        await prisma.wholesalerProduct.createMany({
            data: [
                {
                    wholesalerId: wholesaler1.id,
                    productId: product.id,
                    stock: 100,
                    priceOffered: 950,
                    isAvailable: true
                },
                {
                    wholesalerId: wholesaler2.id,
                    productId: product.id,
                    stock: 100,
                    priceOffered: 980,
                    isAvailable: true
                }
            ]
        });

        const order = await prisma.order.create({
            data: {
                retailerId: retailer.id,
                totalAmount: 1000,
                paymentMode: 'CREDIT',
                status: 'PLACED',
                items: {
                    create: [
                        {
                            productId: product.id,
                            quantity: 1,
                            priceAtOrder: 1000
                        }
                    ]
                }
            }
        });

        console.log('✅ Test data created');
        console.log(`   Order ID: ${order.id}`);
        console.log(`   Wholesaler 1: ${wholesaler1.businessName}`);
        console.log(`   Wholesaler 2: ${wholesaler2.businessName}`);

        // STEP 2: Test Message Parser
        console.log('\n📝 STEP 2: Testing message parser...');

        const testMessages = [
            'PRICE 2450 ETA 2H',
            'price 1500.50 eta 3 hours',
            'Price 999 Eta Tomorrow',
            'invalid message',
            'PRICE abc ETA 2H', // Invalid price
            'PRICE 100', // Missing ETA
        ];

        testMessages.forEach(msg => {
            const parsed = messageParser.parseVendorBid(msg);
            if (parsed) {
                console.log(`   ✅ "${msg}" → Price: ${parsed.price}, ETA: ${parsed.eta}`);
            } else {
                console.log(`   ❌ "${msg}" → Invalid`);
            }
        });

        // STEP 3: Broadcast Order
        console.log('\n📡 STEP 3: Broadcasting order to wholesalers...');

        const broadcastResult = await broadcastService.broadcastOrder(order.id);
        console.log(`   ✅ Broadcast sent to ${broadcastResult.sentCount} wholesalers`);
        console.log(`   Expiration: ${broadcastResult.expires_at}`);

        // Verify order was updated
        const updatedOrder = await prisma.order.findUnique({
            where: { id: order.id }
        });
        console.log(`   Order status: ${updatedOrder.status}`);
        console.log(`   Order expires at: ${updatedOrder.expires_at}`);

        // STEP 4: Simulate Wholesaler Bids
        console.log('\n💰 STEP 4: Simulating wholesaler bids...');

        // Wholesaler 1 submits bid
        const bid1 = await vendorOfferService.processIncomingBid(
            wholesaler1.id,
            'PRICE 2450 ETA 2H'
        );
        console.log(`   Wholesaler 1: ${bid1.success ? '✅' : '❌'} ${bid1.message.split('\n')[0]}`);

        // Wholesaler 2 submits bid
        const bid2 = await vendorOfferService.processIncomingBid(
            wholesaler2.id,
            'PRICE 2300 ETA 3H'
        );
        console.log(`   Wholesaler 2: ${bid2.success ? '✅' : '❌'} ${bid2.message.split('\n')[0]}`);

        // Wholesaler 1 updates bid (lower price)
        const bid1Updated = await vendorOfferService.processIncomingBid(
            wholesaler1.id,
            'PRICE 2200 ETA 2H'
        );
        console.log(`   Wholesaler 1 (updated): ${bid1Updated.success ? '✅' : '❌'} ${bid1Updated.message.split('\n')[0]}`);

        // STEP 5: Validation Tests
        console.log('\n🔒 STEP 5: Testing validation logic...');

        // Test invalid wholesaler
        const invalidWholesaler = await vendorOfferService.processIncomingBid(
            'invalid-id',
            'PRICE 1000 ETA 1H'
        );
        console.log(`   Invalid wholesaler: ${invalidWholesaler.success ? '❌ FAIL' : '✅ PASS'} - ${invalidWholesaler.message}`);

        // Test invalid message format
        const invalidFormat = await vendorOfferService.processIncomingBid(
            wholesaler1.id,
            'invalid message'
        );
        console.log(`   Invalid format: ${invalidFormat.success ? '❌ FAIL' : '✅ PASS'} - ${invalidFormat.message.split('\n')[0]}`);

        // STEP 6: Retrieve Offers
        console.log('\n📊 STEP 6: Retrieving offers...');

        const allOffers = await vendorOfferService.getOffersForOrder(order.id);
        console.log(`   Total offers: ${allOffers.length}`);
        allOffers.forEach((offer, idx) => {
            console.log(`   ${idx + 1}. ${offer.wholesaler.businessName}: Rs. ${offer.price_quote}, ETA: ${offer.delivery_eta}`);
        });

        const bestOffer = await vendorOfferService.getBestOffer(order.id);
        console.log(`\n   🏆 Best Offer: ${bestOffer.wholesaler.businessName} - Rs. ${bestOffer.price_quote}`);

        // STEP 7: Test Duplicate Prevention
        console.log('\n🚫 STEP 7: Testing duplicate prevention...');

        const hasBid = await vendorOfferService.hasSubmittedBid(order.id, wholesaler1.id);
        console.log(`   Wholesaler 1 has bid: ${hasBid ? '✅ YES' : '❌ NO'}`);

        // STEP 8: Test Expired Order
        console.log('\n⏰ STEP 8: Testing expired order handling...');

        // Create an expired order
        const expiredOrder = await prisma.order.create({
            data: {
                retailerId: retailer.id,
                totalAmount: 500,
                paymentMode: 'CREDIT',
                status: 'PENDING_BIDS',
                expires_at: new Date(Date.now() - 1000), // Already expired
                items: {
                    create: [
                        {
                            productId: product.id,
                            quantity: 1,
                            priceAtOrder: 500
                        }
                    ]
                }
            }
        });

        // Create routing entry for expired order
        await prisma.orderRouting.create({
            data: {
                orderId: expiredOrder.id,
                retailerId: retailer.id,
                productRequested: JSON.stringify([{ productId: product.id }]),
                candidateWholesalers: JSON.stringify([wholesaler1.id]),
                routingReason: 'Test',
                routingScore: 50
            }
        });

        const expiredBid = await vendorOfferService.processIncomingBid(
            wholesaler1.id,
            'PRICE 500 ETA 1H'
        );
        console.log(`   Bid on expired order: ${expiredBid.success ? '❌ FAIL' : '✅ PASS'} - ${expiredBid.message}`);

        // Summary
        console.log('\n' + '='.repeat(70));
        console.log('✅ ALL TESTS COMPLETED SUCCESSFULLY!');
        console.log('='.repeat(70));

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
        console.log('\n🏁 Test finished.');
    }
}

testVendorOfferFlow();
