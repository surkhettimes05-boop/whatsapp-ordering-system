const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMessages() {
    try {
        const messages = await prisma.whatsAppMessage.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        console.log('Last 10 messages:');
        messages.forEach(m => {
            console.log(`[${m.createdAt.toISOString()}] From: ${m.from} Body: ${m.body} Direction: ${m.direction}`);
        });

        await prisma.$disconnect();
    } catch (error) {
        console.error('Error fetching messages:', error);
        process.exit(1);
    }
}

checkMessages();
