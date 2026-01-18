const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MY_PHONE_NUMBER = '9779800000000'; // REPLACE THIS WITH YOUR NUMBER

async function makeMeWholesaler() {
    const args = process.argv.slice(2);
    const phoneInput = args[0] || MY_PHONE_NUMBER;

    // Format: ensure it has standard format if possible, but basic string is fine for now
    // Using the input directly.

    console.log(`🚀 Promoting ${phoneInput} to Wholesaler...`);

    try {
        // 1. Create/Update Wholesaler
        const wholesaler = await prisma.wholesaler.upsert({
            where: { whatsappNumber: phoneInput },
            update: {
                isActive: true, // Ensure active
                capacity: 100,  // High capacity
                reliabilityScore: 100, // High score to win routing
            },
            create: {
                businessName: "My Test Wholesale Store",
                phoneNumber: phoneInput,
                whatsappNumber: phoneInput, // This receives the alerts
                email: `test.${phoneInput}@example.com`,
                gstNumber: `TEST-${phoneInput}`,
                city: "Kathmandu",
                address: "Test Location",
                latitude: 27.7172, // Kathmandu default
                longitude: 85.3240,
                categories: JSON.stringify(["Electronics", "Groceries"]),
                operatingHours: JSON.stringify({ open: "09:00", close: "18:00" }),
                isActive: true,
                isVerified: true,
                deliveryRadius: 50, // Wide radius
                capacity: 100,
                reliabilityScore: 100
            }
        });

        console.log(`✅ Wholesaler Profile Created: ${wholesaler.businessName}`);

        // 2. Assign ALL Products to this Wholesaler (So you can receive ANY order)
        const allProducts = await prisma.product.findMany();

        console.log(`📦 Assigning ${allProducts.length} products to your inventory...`);

        for (const product of allProducts) {
            await prisma.wholesalerProduct.upsert({
                where: {
                    wholesalerId_productId: {
                        wholesalerId: wholesaler.id,
                        productId: product.id
                    }
                },
                update: {
                    stock: 999,
                    priceOffered: product.fixedPrice, // Match standard price
                    isAvailable: true
                },
                create: {
                    wholesalerId: wholesaler.id,
                    productId: product.id,
                    stock: 999,
                    priceOffered: product.fixedPrice,
                    minOrderQuantity: 1,
                    leadTime: 1, // Fast delivery
                    isAvailable: true
                }
            });
        }

        console.log('✅ Inventory Updated! You are now the "Best Wholesaler" for all products.');
        console.log('---------------------------------------------------------');
        console.log('👉 ACTION REQUIRED: Restart your backend server if it caches data.');
        console.log('👉 NEXT STEP: Run "node simulate-full-flow.js" and check your WhatsApp!');
        console.log('---------------------------------------------------------');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

makeMeWholesaler();
