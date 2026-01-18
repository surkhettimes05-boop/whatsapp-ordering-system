const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAdd() {
    // Get first category
    const category = await prisma.category.findFirst();
    console.log('Category:', category);

    // Try to create product
    const product = await prisma.product.create({
        data: {
            name: "Test Rice (25kg)",
            categoryId: category.id,
            fixedPrice: 2100,
            unit: "bag",
            isActive: true
        }
    });

    console.log('✓ Product created:', product);
}

testAdd()
    .catch(e => console.error('Error:', e.message))
    .finally(async () => await prisma.$disconnect());
