const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
    console.log('🌱 Seeding Wholesale Catalog...');

    const categories = [
        { name: 'Grains & Rice' },
        { name: 'Oils & Ghee' },
        { name: 'Spices & Masala' },
        { name: 'Noodles & Snacks' }
    ];

    const catMap = {};
    for (const c of categories) {
        const cat = await prisma.category.upsert({
            where: { name: c.name },
            update: {},
            create: c
        });
        catMap[c.name] = cat.id;
    }

    const products = [
        { name: 'Jira Masino Rice (25kg)', category: 'Grains & Rice', price: 2100, unit: 'bag' },
        { name: 'Sona Mansuli Rice (30kg)', category: 'Grains & Rice', price: 1850, unit: 'bag' },
        { name: 'Sunflower Oil (1L x 10)', category: 'Oils & Ghee', price: 2200, unit: 'cartoon' },
        { name: 'Mustard Oil (1L)', category: 'Oils & Ghee', price: 220, unit: 'btl' },
        { name: 'Red Chili Powder (1kg)', category: 'Spices & Masala', price: 450, unit: 'pkt' },
        { name: 'Turmeric Powder (500g)', category: 'Spices & Masala', price: 180, unit: 'pkt' },
        { name: 'Wai Wai Noodles (30 pack)', category: 'Noodles & Snacks', price: 600, unit: 'ctn' },
        { name: 'Digestive Biscuits (12 pack)', category: 'Noodles & Snacks', price: 480, unit: 'ctn' }
    ];

    for (const p of products) {
        await prisma.product.create({
            data: {
                name: p.name,
                categoryId: catMap[p.category],
                fixedPrice: p.price,
                unit: p.unit,
                isActive: true
            }
        });
        console.log(`✅ Added: ${p.name}`);
    }

    // Seed one Admin User
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('admin123', 10);
    await prisma.user.upsert({
        where: { phoneNumber: '9800000000' },
        update: {},
        create: {
            phoneNumber: '9800000000',
            name: 'System Admin',
            role: 'ADMIN',
            passwordHash: hash
        }
    });

    console.log('🚀 Seeding complete! Admin: 9800000000 / admin123');
}

seed()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
