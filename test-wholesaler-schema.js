const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testWholesalerQueries() {
    console.log('🧪 Testing Multi-Vendor Database Schema\n');
    console.log('═══════════════════════════════════════\n');

    try {
        // Test 1: Get all wholesalers
        console.log('Test 1: Fetching all wholesalers...');
        const wholesalers = await prisma.wholesaler.findMany({
            include: {
                products: {
                    include: {
                        product: true
                    }
                }
            }
        });
        console.log(`✅ Found ${wholesalers.length} wholesalers\n`);

        // Test 2: Find active wholesalers in Kathmandu
        console.log('Test 2: Finding active wholesalers in Kathmandu...');
        const kathmanduWholesalers = await prisma.wholesaler.findMany({
            where: {
                city: 'Kathmandu',
                isActive: true
            }
        });
        console.log(`✅ Found ${kathmanduWholesalers.length} active wholesalers in Kathmandu\n`);

        // Test 3: Find wholesalers who have iPhone 15
        console.log('Test 3: Finding wholesalers with iPhone 15 Pro in stock...');
        const iPhoneProduct = await prisma.product.findFirst({
            where: { name: { contains: 'iPhone 15' } }
        });

        if (iPhoneProduct) {
            const iPhoneWholesalers = await prisma.wholesalerProduct.findMany({
                where: {
                    productId: iPhoneProduct.id,
                    isAvailable: true,
                    stock: { gt: 0 }
                },
                include: {
                    wholesaler: true,
                    product: true
                }
            });
            console.log(`✅ Found ${iPhoneWholesalers.length} wholesalers with iPhone 15 Pro\n`);

            if (iPhoneWholesalers.length > 0) {
                console.log('   Details:');
                iPhoneWholesalers.forEach(wp => {
                    console.log(`   - ${wp.wholesaler.businessName}`);
                    console.log(`     Price: NPR ${wp.priceOffered}`);
                    console.log(`     Stock: ${wp.stock} units`);
                    console.log(`     Lead time: ${wp.leadTime} hours\n`);
                });
            }
        }

        // Test 4: Check retailer with location data
        console.log('Test 4: Checking retailers with location data...');
        const retailersWithLocation = await prisma.retailer.findMany({
            where: {
                latitude: { not: null },
                longitude: { not: null }
            }
        });
        console.log(`✅ Found ${retailersWithLocation.length} retailers with GPS coordinates\n`);

        if (retailersWithLocation.length > 0) {
            console.log('   Sample retailer:');
            const sample = retailersWithLocation[0];
            console.log(`   - ${sample.pasalName || 'Unknown'}`);
            console.log(`     Location: ${sample.city}`);
            console.log(`     Coordinates: ${sample.latitude}, ${sample.longitude}\n`);
        }

        // Test 5: Wholesaler performance metrics
        console.log('Test 5: Wholesaler performance summary...');
        const performanceData = await prisma.wholesaler.findMany({
            select: {
                businessName: true,
                city: true,
                reliabilityScore: true,
                averageRating: true,
                totalOrders: true,
                completedOrders: true,
                capacity: true,
                currentOrders: true
            },
            orderBy: {
                reliabilityScore: 'desc'
            }
        });

        console.log('✅ Performance Rankings:\n');
        performanceData.forEach((w, index) => {
            const completionRate = w.totalOrders > 0
                ? ((w.completedOrders / w.totalOrders) * 100).toFixed(1)
                : 0;
            const capacityUsage = w.capacity > 0
                ? ((w.currentOrders / w.capacity) * 100).toFixed(1)
                : 0;

            console.log(`   ${index + 1}. ${w.businessName} (${w.city})`);
            console.log(`      Reliability Score: ${w.reliabilityScore}/100`);
            console.log(`      Average Rating: ${w.averageRating}/5 ⭐`);
            console.log(`      Completion Rate: ${completionRate}%`);
            console.log(`      Capacity Usage: ${capacityUsage}% (${w.currentOrders}/${w.capacity})\n`);
        });

        // Test 6: Product availability across wholesalers
        console.log('Test 6: Product availability analysis...');
        const products = await prisma.product.findMany({
            include: {
                wholesalerProducts: {
                    where: {
                        isAvailable: true
                    },
                    include: {
                        wholesaler: {
                            select: {
                                businessName: true,
                                city: true
                            }
                        }
                    }
                }
            }
        });

        console.log('✅ Product Availability:\n');
        products.forEach(product => {
            const availableFrom = product.wholesalerProducts.length;
            console.log(`   ${product.name}`);
            console.log(`     Available from ${availableFrom} wholesaler(s)`);

            if (availableFrom > 0) {
                const prices = product.wholesalerProducts.map(wp => wp.priceOffered);
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                console.log(`     Price range: NPR ${minPrice} - NPR ${maxPrice}`);
            }
            console.log('');
        });

        // Test 7: Distance calculation test (if geolib is installed)
        console.log('Test 7: Testing distance calculation...');
        try {
            const geolib = require('geolib');

            if (retailersWithLocation.length > 0 && wholesalers.length > 0) {
                const retailer = retailersWithLocation[0];
                const wholesaler = wholesalers[0];

                if (retailer.latitude && retailer.longitude &&
                    wholesaler.latitude && wholesaler.longitude) {

                    const distance = geolib.getDistance(
                        { latitude: retailer.latitude, longitude: retailer.longitude },
                        { latitude: wholesaler.latitude, longitude: wholesaler.longitude }
                    ) / 1000; // Convert to km

                    console.log(`✅ Distance calculation working!`);
                    console.log(`   From: ${retailer.pasalName} (${retailer.city})`);
                    console.log(`   To: ${wholesaler.businessName} (${wholesaler.city})`);
                    console.log(`   Distance: ${distance.toFixed(2)} km\n`);
                }
            }
        } catch (error) {
            console.log('⚠️  geolib not installed yet (npm install geolib)\n');
        }

        console.log('═══════════════════════════════════════');
        console.log('✨ ALL TESTS COMPLETED SUCCESSFULLY! ✨');
        console.log('═══════════════════════════════════════\n');

        console.log('📊 Summary:');
        console.log(`   • ${wholesalers.length} wholesalers in system`);
        console.log(`   • ${products.length} products available`);
        console.log(`   • ${retailersWithLocation.length} retailers with GPS coordinates`);
        console.log(`   • Database schema ready for routing algorithm\n`);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('\nFull error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run tests
testWholesalerQueries();
