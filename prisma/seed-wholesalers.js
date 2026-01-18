const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...\n');

    // ============================================
    // 1. CREATE WHOLESALERS (Multi-vendor test data)
    // ============================================
    console.log('📦 Creating wholesalers...');

    const wholesaler1 = await prisma.wholesaler.create({
        data: {
            businessName: "Kathmandu Electronics Hub",
            ownerName: "Ramesh Sharma",
            phoneNumber: "9779841234567",
            whatsappNumber: "9779841234567",
            email: "ramesh@kthelectronics.com",
            gstNumber: "27AABCU9603R1ZM",
            businessAddress: "Putalisadak, Kathmandu",
            city: "Kathmandu",
            state: "Bagmati",
            pincode: "44600",
            latitude: 27.7090,
            longitude: 85.3210,

            // Performance metrics (established seller)
            reliabilityScore: 87,
            totalOrders: 145,
            completedOrders: 138,
            cancelledOrders: 7,
            averageRating: 4.5,
            totalRevenue: 2450000,

            isActive: true,
            isVerified: true,

            capacity: 15,
            currentOrders: 5,

            categories: JSON.stringify(["Electronics", "Mobiles", "Accessories"]),
            deliveryRadius: 25,
            minimumOrder: 5000,
            deliveryCharges: 200,

            operatingHours: JSON.stringify({
                monday: { open: "09:00", close: "19:00" },
                tuesday: { open: "09:00", close: "19:00" },
                wednesday: { open: "09:00", close: "19:00" },
                thursday: { open: "09:00", close: "19:00" },
                friday: { open: "09:00", close: "19:00" },
                saturday: { open: "09:00", close: "17:00" },
                sunday: { closed: true }
            })
        }
    });

    const wholesaler2 = await prisma.wholesaler.create({
        data: {
            businessName: "Pokhara Premium Suppliers",
            ownerName: "Sita Gurung",
            phoneNumber: "9779851234567",
            whatsappNumber: "9779851234567",
            email: "sita@pokharapremium.com",
            gstNumber: "27AABCU9604R1ZN",
            businessAddress: "Lakeside, Pokhara",
            city: "Pokhara",
            state: "Gandaki",
            pincode: "33700",
            latitude: 28.2096,
            longitude: 83.9856,

            // Performance metrics (highly reliable)
            reliabilityScore: 95,
            totalOrders: 230,
            completedOrders: 228,
            cancelledOrders: 2,
            averageRating: 4.8,
            totalRevenue: 3850000,

            isActive: true,
            isVerified: true,

            capacity: 20,
            currentOrders: 3,

            categories: JSON.stringify(["Electronics", "Groceries", "Household"]),
            deliveryRadius: 30,
            minimumOrder: 3000,
            deliveryCharges: 150,

            operatingHours: JSON.stringify({
                monday: { open: "08:00", close: "20:00" },
                tuesday: { open: "08:00", close: "20:00" },
                wednesday: { open: "08:00", close: "20:00" },
                thursday: { open: "08:00", close: "20:00" },
                friday: { open: "08:00", close: "20:00" },
                saturday: { open: "08:00", close: "20:00" },
                sunday: { open: "10:00", close: "16:00" }
            })
        }
    });

    const wholesaler3 = await prisma.wholesaler.create({
        data: {
            businessName: "Lalitpur Wholesale Mart",
            ownerName: "Krishna Maharjan",
            phoneNumber: "9779861234567",
            whatsappNumber: "9779861234567",
            email: "krishna@lalitpurmart.com",
            gstNumber: "27AABCU9605R1ZO",
            businessAddress: "Patan Dhoka, Lalitpur",
            city: "Lalitpur",
            state: "Bagmati",
            pincode: "44700",
            latitude: 27.6683,
            longitude: 85.3206,

            // Performance metrics (newer but good)
            reliabilityScore: 72,
            totalOrders: 58,
            completedOrders: 54,
            cancelledOrders: 4,
            averageRating: 4.2,
            totalRevenue: 890000,

            isActive: true,
            isVerified: true,

            capacity: 10,
            currentOrders: 2,

            categories: JSON.stringify(["Groceries", "FMCG", "Beverages"]),
            deliveryRadius: 15,
            minimumOrder: 2000,
            deliveryCharges: 100,

            operatingHours: JSON.stringify({
                monday: { open: "09:00", close: "18:00" },
                tuesday: { open: "09:00", close: "18:00" },
                wednesday: { open: "09:00", close: "18:00" },
                thursday: { open: "09:00", close: "18:00" },
                friday: { open: "09:00", close: "18:00" },
                saturday: { open: "09:00", close: "14:00" },
                sunday: { closed: true }
            })
        }
    });

    const wholesaler4 = await prisma.wholesaler.create({
        data: {
            businessName: "Bhaktapur Tech Solutions",
            ownerName: "Binod Shrestha",
            phoneNumber: "9779871234567",
            whatsappNumber: "9779871234567",
            email: "binod@bhaktapurtech.com",
            businessAddress: "Durbar Square, Bhaktapur",
            city: "Bhaktapur",
            state: "Bagmati",
            pincode: "44800",
            latitude: 27.6722,
            longitude: 85.4285,

            // Performance metrics (over capacity - testing)
            reliabilityScore: 65,
            totalOrders: 82,
            completedOrders: 75,
            cancelledOrders: 7,
            averageRating: 3.9,
            totalRevenue: 1250000,

            isActive: true,
            isVerified: true,

            capacity: 8,
            currentOrders: 8, // At full capacity

            categories: JSON.stringify(["Electronics", "Computers", "Software"]),
            deliveryRadius: 20,
            minimumOrder: 4000,
            deliveryCharges: 180,

            operatingHours: JSON.stringify({
                monday: { open: "10:00", close: "18:00" },
                tuesday: { open: "10:00", close: "18:00" },
                wednesday: { open: "10:00", close: "18:00" },
                thursday: { open: "10:00", close: "18:00" },
                friday: { open: "10:00", close: "18:00" },
                saturday: { closed: true },
                sunday: { closed: true }
            })
        }
    });

    console.log(`✅ Created 4 wholesalers\n`);

    // ============================================
    // 2. CREATE CATEGORIES
    // ============================================
    console.log('📂 Creating categories...');

    const electronics = await prisma.category.upsert({
        where: { name: 'Electronics' },
        update: {},
        create: { name: 'Electronics' }
    });

    const groceries = await prisma.category.upsert({
        where: { name: 'Groceries' },
        update: {},
        create: { name: 'Groceries' }
    });

    const fmcg = await prisma.category.upsert({
        where: { name: 'FMCG' },
        update: {},
        create: { name: 'FMCG' }
    });

    console.log('✅ Created 3 categories\n');

    // ============================================
    // 3. CREATE PRODUCTS
    // ============================================
    console.log('📱 Creating products...');

    const iPhone15 = await prisma.product.create({
        data: {
            name: "iPhone 15 Pro",
            categoryId: electronics.id,
            unit: "pcs",
            fixedPrice: 145000,
            isActive: true
        }
    });

    const samsungS24 = await prisma.product.create({
        data: {
            name: "Samsung Galaxy S24",
            categoryId: electronics.id,
            unit: "pcs",
            fixedPrice: 125000,
            isActive: true
        }
    });

    const laptop = await prisma.product.create({
        data: {
            name: "Dell Inspiron 15 Laptop",
            categoryId: electronics.id,
            unit: "pcs",
            fixedPrice: 85000,
            isActive: true
        }
    });

    const ricePacket = await prisma.product.create({
        data: {
            name: "Basmati Rice 25kg",
            categoryId: groceries.id,
            unit: "bag",
            fixedPrice: 3500,
            isActive: true
        }
    });

    const oil = await prisma.product.create({
        data: {
            name: "Sunflower Oil 5L",
            categoryId: groceries.id,
            unit: "bottle",
            fixedPrice: 850,
            isActive: true
        }
    });

    const detergent = await prisma.product.create({
        data: {
            name: "Tide Detergent 1kg",
            categoryId: fmcg.id,
            unit: "pack",
            fixedPrice: 350,
            isActive: true
        }
    });

    console.log('✅ Created 6 products\n');

    // ============================================
    // 4. CREATE WHOLESALER PRODUCTS (Inventory)
    // ============================================
    console.log('🏪 Linking products to wholesalers...');

    // Wholesaler 1: Kathmandu Electronics Hub (Electronics specialist)
    await prisma.wholesalerProduct.createMany({
        data: [
            {
                wholesalerId: wholesaler1.id,
                productId: iPhone15.id,
                priceOffered: 142000, // Competitive price
                stock: 25,
                minOrderQuantity: 1,
                leadTime: 2, // 2 hours - very fast
                isAvailable: true
            },
            {
                wholesalerId: wholesaler1.id,
                productId: samsungS24.id,
                priceOffered: 123000,
                stock: 30,
                minOrderQuantity: 1,
                leadTime: 2,
                isAvailable: true
            },
            {
                wholesalerId: wholesaler1.id,
                productId: laptop.id,
                priceOffered: 83000,
                stock: 15,
                minOrderQuantity: 1,
                leadTime: 4,
                isAvailable: true
            }
        ]
    });

    // Wholesaler 2: Pokhara Premium (Multi-category)
    await prisma.wholesalerProduct.createMany({
        data: [
            {
                wholesalerId: wholesaler2.id,
                productId: iPhone15.id,
                priceOffered: 144000, // Slightly higher price
                stock: 12,
                minOrderQuantity: 1,
                leadTime: 24, // 1 day
                isAvailable: true
            },
            {
                wholesalerId: wholesaler2.id,
                productId: ricePacket.id,
                priceOffered: 3400, // Best price for rice
                stock: 200,
                minOrderQuantity: 5,
                leadTime: 6,
                isAvailable: true
            },
            {
                wholesalerId: wholesaler2.id,
                productId: oil.id,
                priceOffered: 840,
                stock: 150,
                minOrderQuantity: 10,
                leadTime: 6,
                isAvailable: true
            }
        ]
    });

    // Wholesaler 3: Lalitpur Wholesale (Groceries specialist)
    await prisma.wholesalerProduct.createMany({
        data: [
            {
                wholesalerId: wholesaler3.id,
                productId: ricePacket.id,
                priceOffered: 3450, // Higher price
                stock: 300,
                minOrderQuantity: 10,
                leadTime: 3,
                isAvailable: true
            },
            {
                wholesalerId: wholesaler3.id,
                productId: oil.id,
                priceOffered: 830, // Best price for oil
                stock: 250,
                minOrderQuantity: 10,
                leadTime: 3,
                isAvailable: true
            },
            {
                wholesalerId: wholesaler3.id,
                productId: detergent.id,
                priceOffered: 340,
                stock: 500,
                minOrderQuantity: 20,
                leadTime: 2,
                isAvailable: true
            }
        ]
    });

    // Wholesaler 4: Bhaktapur Tech (Electronics, but at capacity)
    await prisma.wholesalerProduct.createMany({
        data: [
            {
                wholesalerId: wholesaler4.id,
                productId: laptop.id,
                priceOffered: 82000, // Best laptop price
                stock: 8,
                minOrderQuantity: 1,
                leadTime: 8,
                isAvailable: true
            },
            {
                wholesalerId: wholesaler4.id,
                productId: samsungS24.id,
                priceOffered: 122000,
                stock: 10,
                minOrderQuantity: 1,
                leadTime: 8,
                isAvailable: true
            }
        ]
    });

    console.log('✅ Created wholesaler product listings\n');

    // ============================================
    // 5. CREATE TEST RETAILERS (Customers)
    // ============================================
    console.log('👥 Creating test retailers...');

    const retailer1 = await prisma.retailer.create({
        data: {
            pasalName: "Tech Corner Thamel",
            ownerName: "Sunil Tamang",
            phoneNumber: "9779801234567",
            status: "ACTIVE",
            city: "Kathmandu",
            address: "Thamel, Kathmandu",
            latitude: 27.7152,
            longitude: 85.3124
        }
    });

    const retailer2 = await prisma.retailer.create({
        data: {
            pasalName: "Pokhara Mobile Shop",
            ownerName: "Maya Thapa",
            phoneNumber: "9779802234567",
            status: "ACTIVE",
            city: "Pokhara",
            address: "Mahendrapool, Pokhara",
            latitude: 28.2090,
            longitude: 83.9840
        }
    });

    console.log('✅ Created 2 test retailers\n');

    // ============================================
    // 6. CREATE ADMIN USER
    // ============================================
    console.log('👨‍💼 Creating admin user...');

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);

    await prisma.user.upsert({
        where: { phoneNumber: '9779812345678' },
        update: {},
        create: {
            phoneNumber: '9779812345678',
            name: 'System Admin',
            email: 'admin@wholesalesystem.com',
            passwordHash: hashedPassword,
            role: 'ADMIN'
        }
    });

    console.log('✅ Created admin user (Phone: 9779812345678, Password: admin123)\n');

    // ============================================
    // SUMMARY
    // ============================================
    console.log('═══════════════════════════════════════');
    console.log('✨ SEED COMPLETED SUCCESSFULLY! ✨');
    console.log('═══════════════════════════════════════\n');

    console.log('📊 Summary:');
    console.log('  • 4 Wholesalers created (Kathmandu, Pokhara, Lalitpur, Bhaktapur)');
    console.log('  • 3 Categories created');
    console.log('  • 6 Products created');
    console.log('  • Multiple product-wholesaler links established');
    console.log('  • 2 Test retailers with locations');
    console.log('  • 1 Admin user\n');

    console.log('🧪 Test Scenarios Ready:');
    console.log('  ✓ Distance-based routing (different cities)');
    console.log('  ✓ Price-based routing (varying prices)');
    console.log('  ✓ Reliability-based routing (different scores)');
    console.log('  ✓ Capacity-based routing (Bhaktapur at full capacity)');
    console.log('  ✓ Multi-product routing\n');

    console.log('🔑 Admin Login:');
    console.log('  Phone: 9779812345678');
    console.log('  Password: admin123\n');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
