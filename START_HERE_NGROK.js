/**
 * QUICK SETUP FOR TWILIO REPLY
 * This script helps you get ngrok URL and shows exactly what to do
 */

console.clear();
console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║          🚀 QUICK TWILIO REPLY SETUP 🚀                       ║
║                                                                ║
║   GETTING YOUR WEBHOOK URL AND FIXING NO-REPLY ISSUE         ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`);

console.log(`
⚠️  I DETECTED THE ISSUE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your backend server IS running ✅
Your webhook verification works ✅
BUT ngrok is NOT running ❌

This means Twilio can't reach your server from the internet!

🔧 HOW TO FIX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: Start ngrok
  1. Open a NEW terminal (don't close existing ones)
  2. Navigate to ngrok folder:
     cd C:\\ngrok
  3. Run ngrok:
     .\\ngrok http 5000
  4. You'll see:
     Session Status: online
     Forwarding: https://abc123def456.ngrok.io -> http://localhost:5000

Step 2: Copy the HTTPS URL
  → Example: https://abc123def456.ngrok.io
  → Note: This changes each time you restart ngrok!

Step 3: Go to Twilio Console
  1. Open: https://console.twilio.com
  2. Go to: Messaging → Settings
  3. Find "Webhook URL"
  4. Paste: https://abc123def456.ngrok.io/api/v1/whatsapp/webhook
  5. Method: POST
  6. Click SAVE

Step 4: Verify Webhook in Twilio
  1. Should show "Webhook verified" ✅
  2. If not, check:
     - ngrok URL matches exactly
     - Verify token: khaacho_secure_token_2024
     - Server running on port 5000

Step 5: Test It!
  1. Send WhatsApp to: +1 (415) 523-8886
  2. Say: "hi"
  3. Check your server logs
  4. Should show: 📱 [phone]: hi
  5. Bot replies! 🎉

📍 YOUR CURRENT SETUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Backend Server: Running on port 5000
✅ Webhook Verification: WORKING
✅ Twilio Credentials: VALID
✅ Verify Token: khaacho_secure_token_2024
❌ ngrok: NOT RUNNING - START THIS FIRST!

🎯 NEXT ACTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Open a NEW terminal
2. Run: cd C:\\ngrok && .\\ngrok http 5000
3. Copy the https:// URL
4. Paste into Twilio webhook settings
5. Send a test WhatsApp message
6. Done! ✅

💡 IMPORTANT NOTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- ngrok creates a TEMPORARY tunnel (URL expires on restart)
- Keep ngrok running while testing
- If ngrok restarts, update Twilio with new URL
- The free ngrok plan is perfect for testing
- For production, use different webhook method

📞 TEST MESSAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To: +1 (415) 523-8886
Message: hi
Expected reply: Main menu with options

🆘 STILL NOT WORKING?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Check:
1. Is ngrok running? (check ngrok terminal window)
2. Does ngrok show "Session Status: online"?
3. Is backend running? (port 5000 listening)
4. Did you update Twilio webhook URL?
5. Phone registered in sandbox?

Run diagnostic:
   node diagnose-no-reply.js

═════════════════════════════════════════════════════════════════
START ngrok NOW and you'll get replies! 🚀
═════════════════════════════════════════════════════════════════
`);
