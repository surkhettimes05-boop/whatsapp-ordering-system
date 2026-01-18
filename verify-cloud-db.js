const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const products = await prisma.product.count();
        const wholesalers = await prisma.wholesaler.count();
        console.log(`Cloud DB check: ${products} products, ${wholesalers} wholesalers`);
    } catch (e) {
        console.error('Error connecting to cloud DB:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
check();
