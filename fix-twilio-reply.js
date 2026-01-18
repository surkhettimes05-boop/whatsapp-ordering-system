/**
 * TWILIO WHATSAPP REPLY FIX
 * Fixes common issues preventing Twilio from replying
 */

require('dotenv').config();
const twilio = require('twilio');

console.log('\n🔧 TWILIO WHATSAPP REPLY FIX\n');
console.log('═'.repeat(60));

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function diagnoseIssue() {
  console.log('\n📋 CHECKING COMMON ISSUES:\n');
  
  // Issue 1: Webhook not registered
  console.log('1️⃣  WEBHOOK REGISTRATION');
  console.log('─'.repeat(60));
  console.log('Problem: Twilio doesn\'t know where to send messages');
  console.log('Solution:');
  console.log('   1. Install ngrok: https://ngrok.com/download');
  console.log('   2. Start ngrok: ngrok http 5000');
  console.log('   3. Add to .env:');
  console.log('      WHATSAPP_VERIFY_TOKEN=khaacho_secure_token_2024');
  console.log('   4. Go to Twilio Console → Messaging → Settings');
  console.log('   5. Set Webhook URL: https://your-ngrok-url/api/v1/whatsapp/webhook');
  console.log('   6. Set Verify Token: khaacho_secure_token_2024\n');
  
  // Issue 2: Wrong format in sending messages
  console.log('2️⃣  MESSAGE FORMAT VALIDATION');
  console.log('─'.repeat(60));
  console.log('Problem: Messages sent with wrong format');
  console.log('Correct format:');
  console.log('   from: "whatsapp:+14155238886"  (Sandbox number)');
  console.log('   to: "whatsapp:+977XXXXXXXXXX"   (Customer WhatsApp)');
  console.log('   body: "Your message text"\n');
  
  // Issue 3: Sandbox setup
  console.log('3️⃣  SANDBOX CONFIGURATION');
  console.log('─'.repeat(60));
  console.log('Problem: Your WhatsApp number not registered in sandbox');
  console.log('Solution:');
  console.log('   1. Go to Twilio Console → Messaging → Try it out → Send a WhatsApp Message');
  console.log('   2. Send message "join <sandbox-code>" to: +1 (415) 523-8886');
  console.log('   3. Wait for confirmation');
  console.log('   4. Now you can receive messages\n');
  
  // Issue 4: Trial account limitations
  console.log('4️⃣  TRIAL ACCOUNT LIMITATIONS');
  console.log('─'.repeat(60));
  console.log('⚠️  Trial accounts can only send to verified phone numbers');
  console.log('Solution:');
  console.log('   Option A: Upgrade to paid account');
  console.log('   Option B: Use Twilio sandbox (simpler for testing)');
  console.log('   Option C: Verify your phone number in console\n');
  
  // Issue 5: Auth token expires
  console.log('5️⃣  AUTHENTICATION CHECK');
  console.log('─'.repeat(60));
  
  try {
    const account = await client.api.accounts(accountSid).fetch();
    console.log('✅ Authentication: VALID');
    console.log(`   Account Status: ${account.status}`);
    console.log(`   Account Type: ${account.type}`);
    
    if (account.status !== 'active') {
      console.log('⚠️  WARNING: Account is not active!');
    }
  } catch (error) {
    console.log('❌ Authentication: FAILED');
    console.log(`   Error: ${error.message}`);
    console.log('   Solution: Refresh your auth token from Twilio Console');
  }
  
  console.log('\n═'.repeat(60));
  console.log('\n🎯 QUICK SETUP STEPS:\n');
  
  console.log('Step 1: Add verify token to .env');
  console.log('─'.repeat(60));
  console.log('Add this line to backend/.env:');
  console.log('   WHATSAPP_VERIFY_TOKEN=khaacho_secure_token_2024\n');
  
  console.log('Step 2: Install and start ngrok');
  console.log('─'.repeat(60));
  console.log('   1. Download from https://ngrok.com/download');
  console.log('   2. Run: ngrok http 5000');
  console.log('   3. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)\n');
  
  console.log('Step 3: Start your backend server');
  console.log('─'.repeat(60));
  console.log('   npm run dev\n');
  
  console.log('Step 4: Test webhook');
  console.log('─'.repeat(60));
  console.log('   curl "https://your-ngrok-url/api/v1/whatsapp/webhook?');
  console.log('        hub.mode=subscribe&');
  console.log('        hub.verify_token=khaacho_secure_token_2024&');
  console.log('        hub.challenge=test123"\n');
  
  console.log('Step 5: Configure in Twilio');
  console.log('─'.repeat(60));
  console.log('   1. Go to console.twilio.com');
  console.log('   2. Messaging → Settings → Webhook URL');
  console.log('   3. Enter: https://your-ngrok-url/api/v1/whatsapp/webhook');
  console.log('   4. Webhook method: POST');
  console.log('   5. Verify token: khaacho_secure_token_2024\n');
  
  console.log('Step 6: Test message');
  console.log('─'.repeat(60));
  console.log('   Send: "hi" or "hello" to the sandbox number\n');
  
  console.log('═'.repeat(60));
  console.log('\n✅ That\'s it! Twilio should now reply with messages!\n');
}

diagnoseIssue();
