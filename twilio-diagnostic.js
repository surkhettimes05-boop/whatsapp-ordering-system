/**
 * Twilio WhatsApp Diagnostic Script
 * Checks all Twilio configurations and connection
 */

require('dotenv').config();
const twilio = require('twilio');

console.log('\n🔍 TWILIO WHATSAPP DIAGNOSTIC REPORT\n');
console.log('═'.repeat(50));

// 1. Check Environment Variables
console.log('\n1️⃣  ENVIRONMENT VARIABLES');
console.log('─'.repeat(50));

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

console.log(`Account SID:  ${accountSid ? '✅ ' + accountSid.substring(0, 5) + '***' : '❌ NOT SET'}`);
console.log(`Auth Token:   ${authToken ? '✅ ' + authToken.substring(0, 5) + '***' : '❌ NOT SET'}`);
console.log(`WhatsApp From: ${whatsappFrom ? '✅ ' + whatsappFrom : '❌ NOT SET'}`);

if (!accountSid || !authToken || !whatsappFrom) {
  console.log('\n❌ CRITICAL: Missing Twilio credentials in .env file');
  console.log('\nTo fix:');
  console.log('1. Get credentials from: https://console.twilio.com');
  console.log('2. Update backend/.env with:');
  console.log('   TWILIO_ACCOUNT_SID=your_sid');
  console.log('   TWILIO_AUTH_TOKEN=your_token');
  console.log('   TWILIO_WHATSAPP_FROM=+1234567890 (from sandbox)');
  process.exit(1);
}

// 2. Test Twilio Client Connection
console.log('\n2️⃣  TWILIO CLIENT CONNECTION');
console.log('─'.repeat(50));

try {
  const client = twilio(accountSid, authToken);
  console.log('✅ Twilio client initialized successfully');
} catch (error) {
  console.log('❌ Failed to initialize Twilio client:', error.message);
  process.exit(1);
}

// 3. Test API Credentials
console.log('\n3️⃣  API CREDENTIALS VALIDATION');
console.log('─'.repeat(50));

const client = twilio(accountSid, authToken);

client.api.accounts(accountSid).fetch()
  .then(account => {
    console.log('✅ Credentials are valid');
    console.log(`   Account Status: ${account.status}`);
    console.log(`   Account Type: ${account.type}`);
    console.log(`   Auth Token: ${account.authTokenUpdatedDate ? 'Recently updated' : 'Not recently updated'}`);
    
    // 4. Check WhatsApp Service Status
    console.log('\n4️⃣  WHATSAPP SERVICE STATUS');
    console.log('─'.repeat(50));
    
    return client.messaging.services.list({ limit: 10 });
  })
  .then(services => {
    const whatsappServices = services.filter(s => s.friendlyName.toLowerCase().includes('whatsapp'));
    if (whatsappServices.length > 0) {
      console.log(`✅ Found ${whatsappServices.length} WhatsApp service(s)`);
      whatsappServices.forEach(service => {
        console.log(`   - ${service.friendlyName}: ${service.status}`);
      });
    } else {
      console.log('⚠️  No WhatsApp services found');
      console.log('   You may need to set up WhatsApp Business API');
    }
    
    // 5. Test Webhook Configuration
    console.log('\n5️⃣  WEBHOOK CONFIGURATION');
    console.log('─'.repeat(50));
    console.log('📝 For local development:');
    console.log('   1. Install ngrok: https://ngrok.com');
    console.log('   2. Run: ngrok http 5000');
    console.log('   3. Copy HTTPS URL (e.g., https://abc123.ngrok.io)');
    console.log('   4. Add webhook endpoint: {URL}/api/v1/whatsapp/webhook');
    console.log('   5. Set verify token in .env: WHATSAPP_VERIFY_TOKEN=your_token');
    console.log('   6. Configure in Meta Business for Developers');
    
    // 6. Test Message Sending
    console.log('\n6️⃣  MESSAGE SENDING TEST');
    console.log('─'.repeat(50));
    console.log('✅ To send a test message:');
    console.log(`   From: ${whatsappFrom}`);
    console.log('   To: Your WhatsApp number (must be registered in sandbox)');
    console.log('   Example:');
    console.log('   client.messages.create({');
    console.log(`     from: '${whatsappFrom}',`);
    console.log("     to: 'whatsapp:+1234567890',");
    console.log("     body: 'Hello from Khaacho!'");
    console.log('   })');
    
    console.log('\n═'.repeat(50));
    console.log('\n✅ TWILIO SETUP LOOKS GOOD!');
    console.log('\nNext Steps:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Test webhook: node test-whatsapp.js');
    console.log('3. Send a WhatsApp message to your number');
    console.log('4. Check the server logs for incoming messages\n');
    
  })
  .catch(error => {
    console.log('❌ API Validation Failed');
    console.log('   Error:', error.message);
    
    if (error.code === 20003) {
      console.log('\n💡 Issue: Invalid credentials');
      console.log('   Solution: Check your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
    }
    
    console.log('\nTo fix:');
    console.log('1. Go to: https://console.twilio.com');
    console.log('2. Copy your Account SID and Auth Token');
    console.log('3. Update backend/.env with correct values');
    console.log('4. Restart the server');
    
    process.exit(1);
  });
