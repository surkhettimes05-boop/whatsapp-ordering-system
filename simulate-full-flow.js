const axios = require('axios');

const API_URL = 'http://localhost:5000/api/v1/whatsapp/webhook';
const CUSTOMER_PHONE = 'whatsapp:+9779801234567'; // Matches seeded retailer

async function sendMessage(body) {
    try {
        console.log(`\n📱 Customer sends: "${body}"`);
        const response = await axios.post(API_URL, {
            From: CUSTOMER_PHONE,
            Body: body,
            ProfileName: 'Test Retailer'
        });
        // The real response is sent asynchronously via Twilio API, 
        // but our local logs will show the "sendMessage" calls.
        console.log('   (Server processed message)');
    } catch (error) {
        console.error('❌ Error sending message:', error.message);
    }
}

async function runSimulation() {
    console.log('🤖 STARTING WHATSAPP FLOW SIMULATION');
    console.log('------------------------------------');

    // 1. Start Conversation
    await sendMessage('Hi');
    await delay(2000);

    // 2. Select First Category (Electronics)
    await sendMessage('1');
    await delay(2000);

    // 3. Select First Product (iPhone 15)
    await sendMessage('1');
    await delay(2000);

    // 4. Confirm Quantity (1)
    await sendMessage('1');
    await delay(2000);

    // 5. Place Order
    await sendMessage('Place Order');
    await delay(2000);

    // 6. Confirm Order (Yes)
    // The bot asks for confirmation before routing
    await sendMessage('Yes');

    console.log('\n------------------------------------');
    console.log('✅ Simulation Request Sent.');
    console.log('👉 CHECK YOUR SERVER LOGS ABOVE TO SEE THE REPLIES!');
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

runSimulation();
