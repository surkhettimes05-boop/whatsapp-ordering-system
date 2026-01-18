require('dotenv').config();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_FROM;
const toNumber = 'whatsapp:+9779822403262';

console.log('--- Twilio Debug ---');
console.log('SID:', accountSid ? accountSid.slice(0, 6) + '...' : 'MISSING');
console.log('Token:', authToken ? 'PRESENT' : 'MISSING');
console.log('From:', fromNumber);
console.log('To:', toNumber);

const client = twilio(accountSid, authToken);

async function test() {
    try {
        console.log('Sending message...');
        const message = await client.messages.create({
            body: '🔔 This is a direct test message from your backend. If you see this, Twilio is working!',
            from: 'whatsapp:' + fromNumber,
            to: toNumber
        });
        console.log('✅ Success! SID:', message.sid);
    } catch (error) {
        console.error('❌ Failed:', error.message);
        console.error('Code:', error.code);
        console.error('More Info:', error.moreInfo);
    }
}

test();
