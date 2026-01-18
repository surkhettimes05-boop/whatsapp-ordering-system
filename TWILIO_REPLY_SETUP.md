/**
 * COMPLETE TWILIO WHATSAPP REPLY SETUP GUIDE
 * ============================================
 */

console.clear();
console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🚀 TWILIO WHATSAPP REPLY - COMPLETE SETUP GUIDE 🚀         ║
║                                                                ║
║        Making Your WhatsApp Bot Reply to Messages             ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`);

console.log(`
📋 WHAT'S THE PROBLEM?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✗ You're sending WhatsApp messages, but Twilio isn't replying
✗ Your bot doesn't respond to incoming messages
✗ The webhook isn't connecting

ROOT CAUSES:
  1. Webhook not registered/verified in Twilio console
  2. Verify token mismatch
  3. Phone number not registered in sandbox
  4. Server not exposed (localhost ≠ internet)


🎯 THE SOLUTION - 5 EASY STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


═══════════════════════════════════════════════════════════════
STEP 1: Expose Your Local Server to the Internet (ngrok)
═══════════════════════════════════════════════════════════════

Why? Twilio is on the internet. Your computer is on your local network.
Twilio needs an internet URL to send webhook messages to.

HOW TO DO IT:

a) Download ngrok
   → Go to https://ngrok.com/download
   → Download version for Windows
   → Extract it to a folder (e.g., C:\\ngrok\\)

b) Open a NEW terminal/PowerShell and run:
   
   cd C:\\ngrok
   .\\ngrok http 5000

c) You'll see output like:
   
   Session Status: online
   Forwarding: https://abc123def456.ngrok.io -> http://localhost:5000

d) ✅ COPY THIS URL: https://abc123def456.ngrok.io
   (It's different each time you restart ngrok)


═══════════════════════════════════════════════════════════════
STEP 2: Start Your Backend Server
═══════════════════════════════════════════════════════════════

In your backend folder, run:

   npm run dev

You should see:
   ✅ Auth routes loaded
   ✅ Product routes loaded
   ...
   ✅ WhatsApp routes loaded
   🚀 Server running on port 5000


═══════════════════════════════════════════════════════════════
STEP 3: Test the Webhook Verification Locally
═══════════════════════════════════════════════════════════════

Open another terminal and test:

   curl "http://localhost:5000/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=khaacho_secure_token_2024&hub.challenge=test123"

Expected response: test123 (should echo back the challenge)


═══════════════════════════════════════════════════════════════
STEP 4: Configure the Webhook in Twilio Console
═══════════════════════════════════════════════════════════════

a) Go to https://console.twilio.com

b) Login with your account

c) Navigate to:
   Messaging → Settings → Webhook URL Configuration
   
   OR if using WhatsApp Business API:
   WhatsApp → Configuration → Webhook

d) Enter these values:

   Webhook URL (POST):
   https://abc123def456.ngrok.io/api/v1/whatsapp/webhook
   
   Verify Token:
   khaacho_secure_token_2024
   
   Webhook Method: POST

e) Click SAVE

f) If it asks to verify, click VERIFY WEBHOOK


═══════════════════════════════════════════════════════════════
STEP 5: Register Your WhatsApp Number in Sandbox
═══════════════════════════════════════════════════════════════

Twilio uses a SANDBOX for WhatsApp. Your personal number must be 
registered to receive/send messages.

a) Go to Twilio Console → Messaging → Try it out → Send a WhatsApp Message

b) You'll see a sandbox code (e.g., join khaacho-123456)

c) Send this message to: +1 (415) 523-8886
   Example: "join khaacho-123456"

d) You'll get a confirmation reply

e) ✅ Now you can send/receive WhatsApp messages!


═══════════════════════════════════════════════════════════════
STEP 6: Test Your Bot
═══════════════════════════════════════════════════════════════

a) Send a WhatsApp message to: +1 (415) 523-8886

b) Say: "hi" or "hello"

c) Check your backend server logs - you should see:
   📱 [+977XXXXXXXXXX]: hi
   ✅ Message sent to +977XXXXXXXXXX

d) You'll receive a reply on WhatsApp! 🎉


═══════════════════════════════════════════════════════════════
COMMON ISSUES & FIXES
═══════════════════════════════════════════════════════════════

❌ "Webhook verification failed"
   → Check verify token matches exactly in .env and Twilio
   → Our token: khaacho_secure_token_2024

❌ "Request to webhook was not successful"
   → Your ngrok URL expired? Restart ngrok and update Twilio
   → Server not running? Start with: npm run dev
   → Wrong URL in Twilio? Double-check https://abc123...

❌ "Phone number is not registered for WhatsApp"
   → Follow STEP 5 above to register your number
   → Send "join <sandbox-code>" message

❌ "Messages sent but no webhook received"
   → ngrok URL wrong in Twilio
   → Verify token mismatch
   → Check server is running

❌ "Server runs but no incoming messages"
   → Is ngrok running? (separate terminal)
   → Is webhook URL in Twilio up-to-date?
   → Is verify token correct?


═══════════════════════════════════════════════════════════════
YOUR CONFIGURATION (ALREADY SET UP)
═══════════════════════════════════════════════════════════════

✅ TWILIO_ACCOUNT_SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
✅ TWILIO_AUTH_TOKEN: [REDACTED]
✅ TWILIO_WHATSAPP_FROM: +14155238886
✅ WHATSAPP_VERIFY_TOKEN: khaacho_secure_token_2024
✅ Webhook GET endpoint: /api/v1/whatsapp/webhook (VERIFICATION)
✅ Webhook POST endpoint: /api/v1/whatsapp/webhook (MESSAGES)


═══════════════════════════════════════════════════════════════
NGROK + TWILIO = SUCCESS ✅
═══════════════════════════════════════════════════════════════

ngrok URL (changes each restart)
    ↓
    https://abc123def456.ngrok.io/api/v1/whatsapp/webhook
    ↓
    Your Backend Server (Port 5000)
    ↓
    WhatsApp Controller handles message
    ↓
    Sends reply back via Twilio
    ↓
    Message appears on customer's phone


═══════════════════════════════════════════════════════════════
QUICK REFERENCE
═══════════════════════════════════════════════════════════════

Terminal 1 (ngrok):
   cd C:\\ngrok && .\\ngrok http 5000

Terminal 2 (Backend):
   cd backend && npm run dev

Terminal 3 (Testing):
   curl "http://localhost:5000/api/v1/whatsapp/test"

WhatsApp:
   Send message to: +1 (415) 523-8886
   
Twilio Console:
   https://console.twilio.com

Environment variables:
   .env file in backend folder


═══════════════════════════════════════════════════════════════
NEXT: Try it out! Follow the 6 steps above. 🚀
═══════════════════════════════════════════════════════════════
`);
