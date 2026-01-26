# Twilio Webhook Testing Guide

## Quick Summary

Your webhook isn't working because **Twilio doesn't know where to send messages**.

### The 3-Step Fix:

1. **Use ngrok to create a public HTTPS tunnel:**
   ```bash
   ngrok http 5000
   ```
   This gives you a URL like: `https://abc123.ngrok.io`

2. **Update your .env file:**
   ```env
   WEBHOOK_URL=https://abc123.ngrok.io/api/v1/whatsapp/webhook
   TWILIO_AUTH_TOKEN=your_real_token_from_twilio_console
   TWILIO_ACCOUNT_SID=ACxxxxxxx...
   ```

3. **Tell Twilio where to send messages:**
   - Go to [Twilio Console](https://www.twilio.com/console)
   - Messaging → Services → WhatsApp Sandbox
   - Set webhook URL to: `https://abc123.ngrok.io/api/v1/whatsapp/webhook`
   - Save changes

---

## Local Testing Scenario

### Prerequisites
- Node.js running backend on port 5000
- ngrok installed
- Twilio account with WhatsApp Sandbox enabled

### Step-by-Step

**Terminal 1 - Start ngrok:**
```bash
ngrok http 5000
```
Copy the HTTPS URL (e.g., `https://abc123def456.ngrok.io`)

**Terminal 2 - Update .env and start backend:**
```bash
cd backend

# Edit .env with your real credentials
# Update WEBHOOK_URL with your ngrok URL
nano .env

# Start backend
npm run dev
```

Expected output:
```
✅ Environment validation passed
✅ Database connection established  
✅ Webhook validation middleware loaded
✅ Server running on port 5000
```

**Browser/Twilio Console:**
1. Go to https://www.twilio.com/console
2. Navigate to Messaging → Services → WhatsApp Sandbox
3. Find "Inbound Settings" or "Webhook Settings"
4. Set POST URL to: `https://abc123def456.ngrok.io/api/v1/whatsapp/webhook`
5. Save

**Test with WhatsApp:**
1. Open your personal WhatsApp
2. Message the sandbox number (usually +14155238886)
3. In backend console, look for logs like:
   ```
   ✅ Webhook received and acknowledged to Twilio
   Processing message: MessageSid=SM...
   ```

If you see these logs → **Webhook is working! ✅**

---

## Production Testing Scenario (Render.com)

### Prerequisites
- Project deployed to Render.com
- Code committed to GitHub
- Environment variables set in Render dashboard

### Step-by-Step

1. **Get your Render backend URL:**
   - Go to https://dashboard.render.com
   - Find your backend service
   - Copy the URL (e.g., `https://whatsapp-backend-abc123.onrender.com`)

2. **Update Twilio Console:**
   ```
   https://whatsapp-backend-abc123.onrender.com/api/v1/whatsapp/webhook
   ```

3. **Verify environment variables in Render:**
   - TWILIO_ACCOUNT_SID ✅
   - TWILIO_AUTH_TOKEN ✅
   - TWILIO_PHONE_NUMBER ✅
   - WEBHOOK_URL ✅

4. **Test with WhatsApp:**
   - Send message to sandbox number
   - Check Render logs: `https://dashboard.render.com/services/...`
   - Should see webhook receipt logs

---

## Error Scenarios & Solutions

### Scenario 1: "403 Forbidden" in Logs

**Cause:** Signature validation failed

**Checklist:**
- [ ] TWILIO_AUTH_TOKEN matches exactly (copy-paste from console)
- [ ] WEBHOOK_URL matches what's in Twilio Console
- [ ] Not using old ngrok URL (ngrok URLs expire)

**Fix:**
```bash
# Restart ngrok
ngrok http 5000

# Copy new URL to .env
WEBHOOK_URL=https://new-ngrok-url.ngrok.io/api/v1/whatsapp/webhook

# Update Twilio Console with new URL
```

### Scenario 2: "500 Server Error"

**Cause:** Missing TWILIO_AUTH_TOKEN in environment

**Check:**
```bash
grep TWILIO_AUTH_TOKEN backend/.env
```

**Fix:**
```env
TWILIO_AUTH_TOKEN=your_real_token_here
```

Then restart backend.

### Scenario 3: "502 Bad Gateway" (from ngrok)

**Cause:** Backend crashed or not listening on port 5000

**Check:**
```bash
# Is backend running?
netstat -ano | findstr :5000  # Windows
lsof -i :5000                  # Mac/Linux

# Are there errors in backend?
npm run dev  # Check console output
```

**Fix:**
```bash
# Kill process on port 5000 (if needed)
# Restart backend
npm run dev
```

### Scenario 4: No Logs Appearing (Backend Not Receiving Requests)

**Causes:**
- Webhook URL not configured in Twilio Console
- Using old ngrok URL (expired)
- Firewall blocking requests
- Backend not actually running

**Diagnostic Steps:**

1. **Test ngrok is working:**
   ```bash
   # In another terminal, while ngrok is running:
   curl https://your-ngrok-url.ngrok.io/health
   
   # Should return: {"status":"ok"}
   ```

2. **Check Twilio Console:**
   - Messaging → Services → WhatsApp Sandbox
   - Scroll to "Inbound Settings"
   - Verify webhook URL is set and shows green checkmark

3. **Test with ngrok GUI:**
   - ngrok shows: http://127.0.0.1:4040
   - Shows all requests tunneled through it
   - If no requests appear → Twilio isn't sending anything

4. **Verify you're using sandbox number:**
   - Don't have WhatsApp premium number set up?
   - Use sandbox number: +14155238886
   - Message it from your personal WhatsApp

---

## Validation Script

Run this to auto-check your configuration:

```bash
cd backend
node validate-webhook.js
```

This will:
- ✅ Check all environment variables are set
- ✅ Validate WEBHOOK_URL format
- ✅ Simulate Twilio signature creation
- ✅ Check if backend is running
- ✅ Show diagnostic errors

---

## Full Testing Workflow

### Complete End-to-End Test

```bash
# Step 1: Start ngrok in Terminal 1
ngrok http 5000

# Step 2: In Terminal 2, update .env with your actual credentials
cd backend
# Edit .env - replace placeholder values with REAL Twilio credentials

# Step 3: Start backend
npm run dev

# Step 4: Verify configuration
node validate-webhook.js

# Step 5: In Twilio Console
# - Go to Messaging → Services → WhatsApp Sandbox
# - Set webhook URL to: https://[your-ngrok-url]/api/v1/whatsapp/webhook
# - Save

# Step 6: Test
# - Send WhatsApp message to sandbox number
# - Check Terminal 2 (backend logs) for webhook receipt
# - Should see: "✅ Webhook received and acknowledged to Twilio"
```

---

## Troubleshooting Decision Tree

```
Is backend running on port 5000?
├─ NO → Start with: npm run dev
└─ YES
   ├─ Is ngrok tunnel active?
   │  ├─ NO → Start with: ngrok http 5000
   │  └─ YES
   │     ├─ Is webhook URL in Twilio Console set to ngrok URL?
   │     │  ├─ NO → Update it (copy URL from ngrok output)
   │     │  └─ YES
   │     │     ├─ Are you getting webhook requests in backend logs?
   │     │     │  ├─ NO → Check ngrok GUI: http://127.0.0.1:4040
   │     │     │  └─ YES
   │     │     │     ├─ Are signatures validating (no 403 errors)?
   │     │     │     │  ├─ NO → Check TWILIO_AUTH_TOKEN is real
   │     │     │     │  └─ YES → ✅ WEBHOOK WORKING!
```

---

## Final Checklist Before Testing

Before sending your first WhatsApp message, verify:

```
Environment Setup:
  ☐ TWILIO_ACCOUNT_SID set in .env (starts with AC)
  ☐ TWILIO_AUTH_TOKEN set in .env (real token, not placeholder)
  ☐ WEBHOOK_URL set in .env (with ngrok URL or Render URL)
  ☐ All other required env vars present

Backend:
  ☐ npm dependencies installed: npm ci
  ☐ Prisma migrations applied: npx prisma migrate deploy
  ☐ Backend running: npm run dev
  ☐ Health check works: curl http://localhost:5000/health

ngrok:
  ☐ ngrok tunnel running: ngrok http 5000
  ☐ HTTPS URL copied (e.g., https://abc123.ngrok.io)
  ☐ URL stable (same URL persists while running)

Twilio Console:
  ☐ Messaging → Services → WhatsApp Sandbox selected
  ☐ Webhook URL field contains your ngrok/Render URL
  ☐ Webhook URL ends with /api/v1/whatsapp/webhook
  ☐ Changes saved (sometimes need to refresh)

WhatsApp:
  ☐ Using official WhatsApp app (not web)
  ☐ Sending to correct sandbox number
  ☐ Sandbox number saved in contacts as instructed by Twilio
```

Once all checked → Send test message and monitor backend logs!
