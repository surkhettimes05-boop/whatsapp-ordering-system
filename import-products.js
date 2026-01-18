const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function importProducts() {
    console.log('📦 Starting bulk product import...\n');

    // Read and parse CSV
    const csvContent = fs.readFileSync('./products-import.csv', 'utf-8');
    const lines = csvContent.trim().split('\n');
    const header = lines[0];

    // Get or create categories first
    console.log('Creating categories...\n');
    const categoryMap = {};
    const categories = [
        'Grains & Rice',
        'Oils & Ghee',
        'Spices & Masala',
        'Noodles & Snacks'
    ];

    for (const catName of categories) {
        const category = await prisma.category.upsert({
            where: { name: catName },
            update: {},
            create: { name: catName }
        });
        categoryMap[catName] = category.id;
        console.log(`✓ ${catName}`);
    }

    console.log('\n📋 Importing products...\n');

    let imported = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV parsing
        const parts = line.split('",');
        const name = parts[0].replace(/^"/, '');
        const rest = parts[1].split(',');
        const categoryRaw = rest[0].replace(/^"/, '');
        const fixedPrice = parseFloat(rest[1]);
        const unit = rest[2];

        try {
            await prisma.product.create({
                data: {
                    name,
                    categoryId: categoryMap[categoryRaw],
                    fixedPrice,
                    unit,
                    isActive: true
                }
            });
            console.log(`✓ ${name} - ₹${fixedPrice}/${unit}`);
            imported++;
        } catch (error) {
            console.log(`✗ ${name}: ${error.message}`);
            skipped++;
        }
    }

    console.log(`\n🎉 Import complete!`);
    console.log(`   Imported: ${imported} products`);
    console.log(`   Skipped: ${skipped} products`);
}

importProducts()
    .catch(e => {
        console.error('❌ Failed:', e.message);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
