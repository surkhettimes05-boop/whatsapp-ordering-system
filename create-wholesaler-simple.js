const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createWholesaler() {
    try {
        console.log('Creating wholesaler...');

        // 1. Create Wholesaler
        const wholesaler = await prisma.wholesaler.upsert({
            where: { whatsappNumber: '9779800000000' },
            update: {
                isActive: true
            },
            create: {
                businessName: "Test Wholesaler",
                ownerName: "Test Owner",
                phoneNumber: "9779800000000",
                whatsappNumber: "9779800000000",
                email: "test@wholesaler.com",
                city: "Kathmandu",
                businessAddress: "Thamel",
                state: "Bagmati",
                pincode: "44600",
                latitude: 27.7,
                longitude: 85.3,
                categories: JSON.stringify(["Groceries"]),
                isActive: true,
                isVerified: true
            }
        });

        console.log(`✅ Wholesaler created: ${wholesaler.id}`);

        // 2. Assign a product
        const product = await prisma.product.findFirst();
        if (product) {
            await prisma.wholesalerProduct.upsert({
                where: {
                    wholesalerId_productId: {
                        wholesalerId: wholesaler.id,
                        productId: product.id
                    }
                },
                update: { stock: 100 },
                create: {
                    wholesalerId: wholesaler.id,
                    productId: product.id,
                    priceOffered: product.fixedPrice,
                    stock: 100
                }
            });
            console.log('✅ Product assigned');
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

createWholesaler();
