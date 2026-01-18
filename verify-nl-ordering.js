const prisma = require('./src/config/database');
const whatsappController = require('./src/controllers/whatsapp.controller');
const conversationService = require('./src/services/conversation.service'); // Include this
const whatsappService = require('./src/services/whatsapp.service');

// Mock response object
const mockRes = {
    status: (code) => ({
        send: (msg) => console.log(`[Response ${code}] ${msg}`)
    })
};

// Mock WhatsApp Service to intercept messages
whatsappService.sendMessage = async (to, message) => {
    console.log(`\n🤖 [Bot -> ${to}]:\n${message}\n-------------------`);
    return { sid: 'mock_sid' };
};

async function runTest() {
    console.log('🧪 Starting Verification Test...');

    // 1. Setup Data
    console.log('Creating test product...');
    const category = await prisma.category.upsert({
        where: { name: 'Test Category' },
        update: {},
        create: { name: 'Test Category' }
    });

    const product = await prisma.product.upsert({
        where: { sku: 'TEST-RICE' },
        update: { stock: 100 },
        create: {
            name: 'Basmati Rice',
            sku: 'TEST-RICE',
            categoryId: category.id,
            basePrice: 150,
            stock: 100,
            images: '[]',
            unit: 'kg'
        }
    });

    // Ensure user exists and has address for seamless order
    const phoneNumber = '1234567890';
    let user = await prisma.user.findUnique({ where: { phoneNumber } });

    // Create user if not exists (simulated by controller, but we need address)
    // Actually, let the controller create the user first.

    // 2. Simulate: "10 kg rice"
    console.log('\n👤 [User]: "10 kg rice"');
    await whatsappController.handleIncomingMessage({
        body: {
            From: `whatsapp:${phoneNumber}`,
            Body: '10 kg rice',
            ProfileName: 'Test User'
        }
    }, mockRes);

    // 3. Simulate: "Yes" (Confirm)
    console.log('\n👤 [User]: "Yes"');
    await whatsappController.handleIncomingMessage({
        body: {
            From: `whatsapp:${phoneNumber}`,
            Body: 'Yes',
            ProfileName: 'Test User'
        }
    }, mockRes);

    // 4. Verify Order Created
    // Wait a bit for async ops (though here they are awaited in controller)
    const order = await prisma.order.findFirst({
        where: {
            user: { phoneNumber }
        },
        orderBy: { createdAt: 'desc' },
        include: { items: true }
    });

    if (order && order.status === 'PENDING') {
        console.log('\n✅ Verification Passed: Order created successfully!');
        console.log(`Order ID: ${order.orderNumber}`);
        console.log(`Amount: ${order.totalAmount}`);
    } else if (!order) {
        console.log('\n⚠️ Verification Partial: Order NOT created (Check if address prompt happened)');

        // If address prompt happened, we should simulate address entry
        // Let's check conversation state
        user = await prisma.user.findUnique({ where: { phoneNumber } });
        const state = user.conversationState ? JSON.parse(user.conversationState) : null;

        if (state && state.step === 'AWAITING_ADDRESS') {
            console.log('Bot is waiting for address. Sending address...');
            console.log('\n👤 [User]: "Kathmandu Checkpost"');
            await whatsappController.handleIncomingMessage({
                body: {
                    From: `whatsapp:${phoneNumber}`,
                    Body: 'Kathmandu Checkpost',
                    ProfileName: 'Test User'
                }
            }, mockRes);

            console.log('\n✅ Responded with address.');
        }
    } else {
        console.log('\n❌ Verification Failed: Order status is ' + order.status);
    }

    // Cleanup (Optional)
    // await prisma.product.delete({ where: { id: product.id } });
}

runTest()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
