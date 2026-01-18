/**
 * WHATSAPP REPLY DIAGNOSTIC
 * Identifies why Twilio isn't replying
 */

require('dotenv').config();
const twilio = require('twilio');

console.log('\n🔍 WHATSAPP REPLY ISSUE DIAGNOSTIC\n');
console.log('═'.repeat(70));

const issues = [];
const solutions = [];

// 1. Check Credentials
console.log('\n✅ STEP 1: CHECKING CREDENTIALS');
console.log('─'.repeat(70));

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

if (!accountSid || !authToken || !whatsappFrom) {
  console.log('❌ Missing Twilio credentials');
  issues.push('Credentials missing');
} else {
  console.log('✅ Twilio credentials present');
}

if (!verifyToken) {
  console.log('⚠️  WHATSAPP_VERIFY_TOKEN missing (but not critical)');
} else {
  console.log('✅ Verify token set: ' + verifyToken);
}

// 2. Check Twilio Account
console.log('\n✅ STEP 2: CHECKING TWILIO ACCOUNT');
console.log('─'.repeat(70));

const client = twilio(accountSid, authToken);

client.api.accounts(accountSid).fetch()
  .then(account => {
    console.log(`✅ Account Status: ${account.status}`);
    console.log(`✅ Account Type: ${account.type}`);
    
    if (account.status !== 'active') {
      issues.push(`Account is ${account.status}, not active`);
      solutions.push('Go to Twilio Console and activate your account');
    }
    
    if (account.type === 'Trial') {
      console.log('⚠️  TRIAL ACCOUNT - Can only send to verified numbers');
      solutions.push('Verify your WhatsApp number in Twilio Console');
    }
    
    return client.messaging.v1.services.list({ limit: 20 });
  })
  .then(services => {
    console.log(`\n✅ STEP 3: CHECKING SERVICES`);
    console.log('─'.repeat(70));
    
    console.log(`Found ${services.length} messaging services`);
    
    if (services.length === 0) {
      console.log('⚠️  No messaging services found');
      solutions.push('Create a Messaging Service in Twilio Console');
    }
    
    services.forEach(service => {
      console.log(`  - ${service.friendlyName}: ${service.status}`);
    });
    
    // 4. Most Important: Check Webhook Configuration
    console.log(`\n⚠️  STEP 4: CRITICAL - WEBHOOK CONFIGURATION`);
    console.log('─'.repeat(70));
    
    console.log(`\nWEBHOOK CHECKLIST:\n`);
    
    const checklist = [
      {
        item: '1. Is ngrok running?',
        instruction: 'Open ngrok terminal and run: ngrok http 5000',
        critical: true
      },
      {
        item: '2. Do you have the ngrok URL?',
        instruction: 'Copy from: Session Status: online → Forwarding: https://...',
        critical: true
      },
      {
        item: '3. Is webhook URL set in Twilio?',
        instruction: 'Twilio Console → Messaging → Webhook URL',
        value: 'https://your-ngrok-url/api/v1/whatsapp/webhook',
        critical: true
      },
      {
        item: '4. Does URL match ngrok URL?',
        instruction: 'URLs must match exactly (ngrok URL expires on restart)',
        critical: true
      },
      {
        item: '5. Is verify token correct?',
        instruction: 'Token in Twilio must match: ' + verifyToken,
        critical: true
      },
      {
        item: '6. Is webhook method POST?',
        instruction: 'Twilio Messaging → Webhook Method: POST',
        critical: true
      }
    ];
    
    let allConfigured = true;
    checklist.forEach((check, i) => {
      console.log(`\n${check.item}`);
      console.log(`  → ${check.instruction}`);
      if (check.value) {
        console.log(`  → ${check.value}`);
      }
      console.log(`  ${check.critical ? '🔴 CRITICAL' : '🟡 Important'}`);
      allConfigured = false;
    });
    
    // 5. Common Issues
    console.log(`\n\n❌ COMMON REASONS FOR NO REPLY:\n`);
    console.log('─'.repeat(70));
    
    const commonIssues = [
      {
        problem: 'ngrok not running',
        fix: 'Start ngrok in a new terminal: ngrok http 5000'
      },
      {
        problem: 'ngrok URL expired',
        fix: 'Restart ngrok and update webhook URL in Twilio'
      },
      {
        problem: 'Webhook URL doesn\'t match ngrok URL',
        fix: 'Copy exact ngrok URL to Twilio webhook settings'
      },
      {
        problem: 'Webhook not verified in Twilio',
        fix: 'Go to Twilio → Test webhook → Should see "verified"'
      },
      {
        problem: 'Wrong verify token',
        fix: 'Token must match exactly in both .env and Twilio'
      },
      {
        problem: 'Phone number not registered',
        fix: 'Send "join khaacho-XXXXX" to +1 (415) 523-8886'
      },
      {
        problem: 'Trial account restrictions',
        fix: 'Can only message verified numbers. Add your number in console'
      },
      {
        problem: 'Server not listening on port 5000',
        fix: 'Run: npm run dev (check for "Server running on port 5000")'
      }
    ];
    
    commonIssues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue.problem}`);
      console.log(`   ✓ Fix: ${issue.fix}\n`);
    });
    
    // 6. Quick Verification
    console.log('\n✅ STEP 5: QUICK VERIFICATION TEST\n');
    console.log('─'.repeat(70));
    
    console.log(`
Run these commands in different terminals:

Terminal 1 - Start ngrok:
  cd C:\\ngrok
  .\\ngrok http 5000
  
  Copy the HTTPS URL shown (e.g., https://abc123def456.ngrok.io)

Terminal 2 - Start backend (already running):
  npm run dev
  
  Should show: ✅ WhatsApp routes loaded

Terminal 3 - Test webhook:
  curl "http://localhost:5000/api/v1/whatsapp/test"
  
  Should show: {"success": true, "message": "WhatsApp webhook is ready! 🚀"}

Then:
1. Go to Twilio Console
2. Add webhook: https://abc123def456.ngrok.io/api/v1/whatsapp/webhook
3. Add verify token: khaacho_secure_token_2024
4. Click "VERIFY WEBHOOK"
5. Send WhatsApp to: +1 (415) 523-8886
6. Check backend logs for incoming message
    `);
    
    console.log('\n' + '═'.repeat(70));
    console.log('\n💡 MOST LIKELY ISSUE: Webhook URL not configured in Twilio!\n');
    
  })
  .catch(error => {
    console.log('❌ Error checking account:', error.message);
    solutions.push('Verify your Twilio credentials are correct');
    
    if (error.code === 20003) {
      console.log('\n⚠️  Invalid Twilio credentials!');
      console.log('Go to: https://console.twilio.com');
      console.log('Copy ACCOUNT SID and AUTH TOKEN');
      console.log('Update .env file');
      console.log('Restart server');
    }
  });
