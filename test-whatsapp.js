/**
 * WhatsApp API Test Script
 * Run with: node test-whatsapp.js
 */

require('dotenv').config();
const axios = require('axios');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';
const JWT_TOKEN = process.env.TEST_JWT_TOKEN || ''; // Set this after logging in

async function testWebhookVerification() {
  console.log('\n📡 Testing Webhook Verification...');
  try {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'whatsapp_verify_token';
    const response = await axios.get(`${API_BASE}/api/v1/whatsapp/webhook`, {
      params: {
        'hub.mode': 'subscribe',
        'hub.verify_token': verifyToken,
        'hub.challenge': 'test_challenge_123'
      }
    });
    
    if (response.data === 'test_challenge_123') {
      console.log('✅ Webhook verification successful');
      return true;
    } else {
      console.log('❌ Webhook verification failed - wrong response');
      return false;
    }
  } catch (error) {
    console.log('❌ Webhook verification failed:', error.message);
    return false;
  }
}

async function testSendMessage() {
  if (!JWT_TOKEN) {
    console.log('\n⚠️  Skipping send message test - JWT_TOKEN not set');
    console.log('   Set TEST_JWT_TOKEN in .env or export it');
    return false;
  }

  console.log('\n📤 Testing Send Message...');
  try {
    const response = await axios.post(
      `${API_BASE}/api/v1/whatsapp/send`,
      {
        phoneNumber: process.env.TEST_PHONE_NUMBER || '+1234567890',
        message: 'Test message from API'
      },
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Message sent successfully');
    console.log('   Response:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Send message failed:', error.response?.data || error.message);
    return false;
  }
}

async function testGetMessages() {
  if (!JWT_TOKEN) {
    console.log('\n⚠️  Skipping get messages test - JWT_TOKEN not set');
    return false;
  }

  console.log('\n📥 Testing Get Message History...');
  try {
    const response = await axios.get(
      `${API_BASE}/api/v1/whatsapp/messages`,
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`
        },
        params: {
          limit: 10
        }
      }
    );

    console.log('✅ Message history retrieved');
    console.log(`   Found ${response.data.data.messages.length} messages`);
    return true;
  } catch (error) {
    console.log('❌ Get messages failed:', error.response?.data || error.message);
    return false;
  }
}

async function testHealthCheck() {
  console.log('\n🏥 Testing Health Check...');
  try {
    const response = await axios.get(`${API_BASE}/health`);
    console.log('✅ Server is healthy');
    console.log('   Status:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 WhatsApp API Test Suite');
  console.log('='.repeat(50));

  const results = {
    health: await testHealthCheck(),
    webhook: await testWebhookVerification(),
    sendMessage: await testSendMessage(),
    getMessages: await testGetMessages()
  };

  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Results:');
  console.log('   Health Check:', results.health ? '✅' : '❌');
  console.log('   Webhook Verification:', results.webhook ? '✅' : '❌');
  console.log('   Send Message:', results.sendMessage ? '✅' : '⚠️');
  console.log('   Get Messages:', results.getMessages ? '✅' : '⚠️');

  const allPassed = Object.values(results).every(r => r !== false);
  if (allPassed) {
    console.log('\n✅ All critical tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed or were skipped');
  }
}

// Run tests
runTests().catch(console.error);

