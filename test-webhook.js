/**
 * WhatsApp Webhook Test Script
 * Tests if your webhook is properly configured
 */

require('dotenv').config();
const http = require('http');

console.log('\n🧪 WHATSAPP WEBHOOK TEST\n');
console.log('═'.repeat(60));

const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
const PORT = process.env.PORT || 5000;

console.log('\n📋 Configuration Check:');
console.log('─'.repeat(60));
console.log(`Verify Token: ${verifyToken ? '✅ ' + verifyToken : '❌ NOT SET'}`);
console.log(`Server Port: ${PORT}`);
console.log(`Server URL: http://localhost:${PORT}`);
console.log(`Webhook Endpoint: http://localhost:${PORT}/api/v1/whatsapp/webhook`);

console.log('\n🔍 Testing Webhook Verification:\n');

// Test 1: Correct verification
console.log('Test 1: Valid webhook verification');
console.log('─'.repeat(60));

const options = {
  hostname: 'localhost',
  port: PORT,
  path: `/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=test_challenge_123`,
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200 && data === 'test_challenge_123') {
      console.log(`✅ SUCCESS: Webhook verified!`);
      console.log(`   Status Code: ${res.statusCode}`);
      console.log(`   Response: ${data}`);
    } else {
      console.log(`❌ FAILED`);
      console.log(`   Status Code: ${res.statusCode}`);
      console.log(`   Response: ${data}`);
    }
    
    // Test 2: Wrong token
    console.log('\nTest 2: Invalid token (should fail)');
    console.log('─'.repeat(60));
    
    const options2 = {
      hostname: 'localhost',
      port: PORT,
      path: `/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test_challenge_123`,
      method: 'GET'
    };
    
    const req2 = http.request(options2, (res) => {
      if (res.statusCode === 403) {
        console.log(`✅ Correctly rejected invalid token`);
        console.log(`   Status Code: ${res.statusCode}`);
      } else {
        console.log(`⚠️  Unexpected response`);
        console.log(`   Status Code: ${res.statusCode}`);
      }
      
      console.log('\n' + '═'.repeat(60));
      console.log('\n✅ WEBHOOK TESTS COMPLETE!\n');
      console.log('If both tests passed:');
      console.log('1. Configure this URL in Twilio Console:');
      console.log(`   https://your-ngrok-url/api/v1/whatsapp/webhook`);
      console.log('2. Set verify token: ' + verifyToken);
      console.log('3. Send a test message to your WhatsApp number\n');
    });
    
    req2.on('error', (error) => {
      console.log(`❌ Error: ${error.message}`);
      console.log('Is the server running? Try: npm run dev');
    });
    
    req2.end();
  });
});

req.on('error', (error) => {
  console.log(`❌ Cannot connect to server`);
  console.log(`Error: ${error.message}`);
  console.log(`\nMake sure:`);
  console.log('1. Server is running: npm run dev');
  console.log('2. Port is correct: ' + PORT);
  console.log('3. WhatsApp routes are loaded');
});

req.end();

