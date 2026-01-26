# Twilio Webhook Setup - Complete Fix Guide

## Problem
You're not getting replies from Twilio webhook because the webhook URL doesn't match what Twilio is configured to use.

## Root Cause
When Twilio sends a message to your webhook, it must:
1. Use the URL configured in Twilio Console
2. Calculate an HMAC-SHA1 signature of the request
3. Include the signature in `X-Twilio-Signature` header
4. Your backend must validate the signature using the exact URL

**If URLs don't match → signature validation fails → 403 error**

---

## Solution: 3-Step Setup

### Step 1: Get Your Twilio Credentials
Go to [Twilio Console](https://www.twilio.com/console)

1. Find your **Account SID** (looks like `ACxxxxxxxxxxxxxxxxxxxxxxxx`)
2. Find your **Auth Token** (looks like a random string)
3. Find your **WhatsApp Number** in the Sandbox (e.g., `+14155238886`)

### Step 2: Update .env with Real Credentials

Edit `backend/.env`:

```env
# Your ACTUAL Twilio credentials from console
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_real_auth_token_here
TWILIO_PHONE_NUMBER=+14155238886
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# For local testing - CRITICAL: Use ngrok URL
WEBHOOK_URL=https://your-ngrok-url.ngrok.io/api/v1/whatsapp/webhook

# Other required vars
NODE_ENV=development
DOMAIN=localhost
REDIS_HOST=localhost
DATABASE_URL=postgresql://user:password@localhost:5432/whatsapp_db
```

### Step 3: Set Up ngrok for Local Testing

**Install ngrok** (if not already installed):
```bash
# Windows - using chocolatey
choco install ngrok

# Or download from https://ngrok.com/download
```

**Start ngrok tunnel**:
```bash
ngrok http 5000
```

You'll see output like:
```
ngrok by @inconshreveable                                       (Ctrl+C to quit)

Session Status                online
Account                       your-email@example.com (Plan: Free)
Version                       3.0.0
Region                        United States (us)
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123def456.ngrok.io -> http://localhost:5000

Connections                   ttl     opn     rt1     rt5     p50     p95
                              0       0       0.00    0.00    0.00    0.00
```

**Copy the HTTPS URL**: `https://abc123def456.ngrok.io`

### Step 4: Configure Twilio Console

1. Go to [Twilio Console](https://www.twilio.com/console)
2. Navigate to: **Messaging → Services → WhatsApp Sandbox**
3. Find "Inbound Settings" or "Webhook Settings"
4. Set **When a message comes in** URL to:
   ```
   https://abc123def456.ngrok.io/api/v1/whatsapp/webhook
   ```
5. **Save**

### Step 5: Start Your Backend

```bash
cd backend
npm run dev
```

You should see logs:
```
✅ Environment validation passed
✅ Database connection established
✅ Server running on port 5000
```

### Step 6: Test the Webhook

Send a test message from WhatsApp to your Twilio WhatsApp Sandbox number.

**Expected flow:**
1. Twilio sends POST request to your ngrok URL
2. Backend receives it
3. validateTwilioWebhook() checks signature:
   - Reads `X-Twilio-Signature` header
   - Validates using TWILIO_AUTH_TOKEN + webhook URL
   - ✅ If valid → Continues to handler
   - ❌ If invalid → Returns 403 error
4. Handler returns 200 OK immediately
5. Message is processed async
6. Check logs for: `✅ Webhook received and acknowledged to Twilio`

---

## Debugging: If You Still Don't Get Replies

### Check 1: Verify Backend is Receiving Requests
Look in backend logs for `POST /api/v1/whatsapp/webhook` requests.

**If no requests appear:**
- ❌ Webhook URL in Twilio Console is wrong
- ❌ ngrok tunnel crashed
- ❌ Backend not running on port 5000

**Fix:**
- Restart ngrok: `ngrok http 5000`
- Copy new HTTPS URL
- Update Twilio Console webhook URL

### Check 2: Signature Validation Errors
Look for logs like:
```
Invalid Twilio signature
```

**Causes:**
- ❌ TWILIO_AUTH_TOKEN is wrong
- ❌ Webhook URL in .env doesn't match Twilio Console
- ❌ Request body was modified in transit

**Fix:**
- Double-check .env WEBHOOK_URL matches Twilio Console exactly
- Verify TWILIO_AUTH_TOKEN is the real one (not placeholder)

### Check 3: 500 Server Error
If you see `Server configuration error`:
- ❌ TWILIO_AUTH_TOKEN is not set in .env
- ❌ Other required env vars missing

**Fix:**
```bash
# Check .env has all required vars
grep TWILIO backend/.env
```

### Check 4: Missing X-Twilio-Signature Header
If logs show `Missing X-Twilio-Signature header`:
- ❌ Not a real Twilio request
- ❌ Twilio webhook not configured correctly

**Fix:**
- Verify webhook URL in Twilio Console is set to POST method
- Try sending test message again

---

## Production Deployment (Render.com)

After webhook works locally:

1. **Update .env in code**:
   ```env
   WEBHOOK_URL=https://whatsapp-backend-xxx.onrender.com/api/v1/whatsapp/webhook
   ```

2. **Push to GitHub** (Render auto-deploys)

3. **Set environment variables in Render dashboard:**
   - TWILIO_ACCOUNT_SID
   - TWILIO_AUTH_TOKEN
   - TWILIO_PHONE_NUMBER
   - TWILIO_WHATSAPP_FROM
   - WEBHOOK_URL (with your Render URL)

4. **Update Twilio Console webhook URL:**
   ```
   https://whatsapp-backend-xxx.onrender.com/api/v1/whatsapp/webhook
   ```

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| 403 Forbidden | Signature validation failed | Check WEBHOOK_URL matches exactly, verify TWILIO_AUTH_TOKEN |
| 500 Error | Server config error | Add TWILIO_AUTH_TOKEN to .env |
| No requests received | Webhook URL wrong in Twilio | Copy URL from ngrok, update Twilio Console |
| ngrok shows 502 Bad Gateway | Backend crashed | Check backend logs, restart with `npm run dev` |
| "Missing X-Twilio-Signature" | Not a Twilio request | Verify webhook is set to POST in Twilio |
| HTTPS certificate error | Local ngrok certificate issue | This is normal with ngrok - Twilio validates the URL, not cert |

---

## Validation Checklist

Before testing, verify:

- [ ] .env has real TWILIO_ACCOUNT_SID (starts with AC)
- [ ] .env has real TWILIO_AUTH_TOKEN (not placeholder)
- [ ] .env has WEBHOOK_URL matching ngrok + path
- [ ] ngrok tunnel is running: `ngrok http 5000`
- [ ] Twilio Console webhook URL matches ngrok URL
- [ ] Backend is running: `npm run dev` in backend folder
- [ ] Port 5000 is not blocked by firewall
- [ ] WhatsApp message sent to correct sandbox number

---

## Next Steps

1. Get real Twilio credentials ✅
2. Update .env ✅
3. Install and start ngrok
4. Configure Twilio Console
5. Start backend
6. Send test WhatsApp message
7. Check logs for `✅ Webhook received`
8. Verify message processed correctly

Once webhook works locally → Deploy to Render → Update Twilio webhook URL to Render
