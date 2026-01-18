const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
    console.log('🌱 Seeding financial correctness test data...');

    try {
        // Clean up existing test data (optional, but good for repeatability)
        // We use a prefix or specific IDs to avoid deleting everything if possible,
        // but for a dedicated test seed, deleting related models is safer.

        await prisma.ledgerEntry.deleteMany();
        await prisma.retailerWholesalerCredit.deleteMany();
        await prisma.orderItem.deleteMany();
        await prisma.order.deleteMany();
        await prisma.vendorOffer.deleteMany();
        await prisma.wholesalerProduct.deleteMany();
        await prisma.product.deleteMany();
        await prisma.category.deleteMany();
        await prisma.retailer.deleteMany();
        await prisma.wholesaler.deleteMany();
        await prisma.user.deleteMany();

        // 1. Create Category
        const category = await prisma.category.create({
            data: { name: 'Test Category' }
        });

        // 2. Create Product
        const product = await prisma.product.create({
            data: {
                name: 'Test Product',
                categoryId: category.id,
                fixedPrice: 100,
                unit: 'kg'
            }
        });

        // 3. Create Retailer
        const retailer = await prisma.retailer.create({
            data: {
                pasalName: 'Financial Test Retailer',
                phoneNumber: '9800000001',
                status: 'ACTIVE'
            }
        });

        // 4. Create Wholesaler
        const wholesaler = await prisma.wholesaler.create({
            data: {
                businessName: 'Financial Test Wholesaler',
                ownerName: 'Test Owner',
                phoneNumber: '9800000002',
                whatsappNumber: '9800000002',
                businessAddress: 'Test Address',
                city: 'Kathmandu',
                state: 'Bagmati',
                pincode: '44600',
                latitude: 27.7172,
                longitude: 85.3240,
                categories: 'Test Category'
            }
        });

        // 5. Create Wholesaler Product (Stock)
        await prisma.wholesalerProduct.create({
            data: {
                wholesalerId: wholesaler.id,
                productId: product.id,
                priceOffered: 95,
                stock: 1000,
                isAvailable: true
            }
        });

        // 6. Setup Credit Limit
        await prisma.retailerWholesalerCredit.create({
            data: {
                retailerId: retailer.id,
                wholesalerId: wholesaler.id,
                creditLimit: 5000,
                isActive: true
            }
        });

        console.log('✅ Seeding complete!');
        console.log({
            retailerId: retailer.id,
            wholesalerId: wholesaler.id,
            productId: product.id
        });

    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

seed();
