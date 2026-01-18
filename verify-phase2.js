const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappController = require('./src/controllers/whatsapp.controller');
const whatsappService = require('./src/services/whatsapp.service');
const conversationService = require('./src/services/conversation.service');

// Mock whatsappService.sendMessage
whatsappService.sendMessage = async (to, msg) => {
    console.log(`\n[WHATSAPP TO ${to}]:\n${msg}\n-------------------`);
};

async function verify() {
    console.log('🧪 Starting Phase 2 Verification...');

    // 1. Setup - Ensure we have a category and product "Rice"
    const category = await prisma.category.upsert({
        where: { id: 'test-category' },
        update: {},
        create: {
            id: 'test-category',
            name: 'Grains'
        }
    });

    const product = await prisma.product.upsert({
        where: { id: 'test-rice' },
        update: { isActive: true },
        create: {
            id: 'test-rice',
            name: 'Rice',
            sku: 'RICE-001',
            categoryId: category.id,
            basePrice: 50,
            stock: 100,
            images: '[]'
        }
    });
    console.log('✅ Category and Product "Rice" ready.');

    const user = await prisma.user.upsert({
        where: { phoneNumber: '977987654321' },
        update: { name: 'Test User' },
        create: {
            phoneNumber: '977987654321',
            name: 'Test User'
        }
    });

    // Clear any existing state for clean test
    await conversationService.clearState(user.id);
    console.log('✅ User state cleared.');

    // --- TEST 1: FUZZY SEARCH ---
    console.log('\n--- TEST 1: FUZZY SEARCH ("10 kg ricce") ---');
    const mockReq1 = {
        body: {
            From: 'whatsapp:977987654321',
            Body: '10 kg ricce',
            ProfileName: 'Test'
        }
    };
    const mockRes = {
        set: () => { },
        status: () => ({ send: () => { } })
    };

    await whatsappController.handleIncomingMessage(mockReq1, mockRes);

    // --- TEST 2: SUPPORT FLOW ---
    console.log('\n--- TEST 2: SUPPORT FLOW ---');
    await conversationService.clearState(user.id); // Clear state from Test 1
    // Step A: Type "support"
    await whatsappController.handleIncomingMessage({
        body: { From: 'whatsapp:977987654321', Body: 'support' }
    }, mockRes);

    // Step B: Send issue details
    await whatsappController.handleIncomingMessage({
        body: { From: 'whatsapp:977987654321', Body: 'My order is late!' }
    }, mockRes);

    // Check if ticket exists in DB
    const ticket = await prisma.supportTicket.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' }
    });

    if (ticket) {
        console.log(`✅ Support Ticket Created: ${ticket.ticketNumber} - ${ticket.description}`);
    } else {
        console.log('❌ Support Ticket NOT found in database!');
    }

    console.log('\n🧪 Verification Complete.');
    await prisma.$disconnect();
}

verify().catch(err => {
    console.error(err);
    process.exit(1);
});
