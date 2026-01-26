# TWILIO WEBHOOK FIX - STEP-BY-STEP CHECKLIST

Print this page and follow step by step. Estimated time: 15 minutes.

---

## STEP 1: Install ngrok ✓
- [ ] Visit https://ngrok.com/download
- [ ] Download for Windows (Chocolatey or direct download)
- [ ] Install ngrok
- [ ] Verify: Run `ngrok --version` in terminal

**If stuck**: See TWILIO_WEBHOOK_SETUP_FIX.md > Prerequisites

---

## STEP 2: Get Twilio Credentials ✓
- [ ] Go to https://www.twilio.com/console
- [ ] Look for "Account SID" → Copy it (starts with AC)
- [ ] Look for "Auth Token" → Copy it (long random string)
- [ ] Write them down or keep tab open

**Location in Console:**
```
Dashboard (main page)
  ↓
Look for "Account Settings" or scroll down to see:
- Account SID = ACxxxxxxxxxxxxxxxxxxxxxxxx
- Auth Token = xxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## STEP 3: Start ngrok tunnel ✓

**Terminal 1** (keep this running):
```bash
ngrok http 5000
```

You should see output like:
```
Forwarding    https://abc123def456.ngrok.io -> http://localhost:5000
```

- [ ] Copy the HTTPS URL (write it down or keep visible)
- [ ] Keep this terminal open (don't close)

**Example**: `https://abc123def456.ngrok.io`

---

## STEP 4: Update .env file ✓

Edit `backend/.env`:

```env
# Credentials from Twilio Console (STEP 2)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_real_auth_token_here

# Your Twilio WhatsApp number
TWILIO_PHONE_NUMBER=+14155238886
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# URL from ngrok (STEP 3) - CRITICAL
WEBHOOK_URL=https://abc123def456.ngrok.io/api/v1/whatsapp/webhook

# Leave these as-is
NODE_ENV=development
DOMAIN=localhost
DATABASE_URL=postgresql://user:password@localhost:5432/whatsapp_db
REDIS_HOST=localhost
```

- [ ] Replace `ACxxxxxxx...` with your TWILIO_ACCOUNT_SID
- [ ] Replace `your_real_auth_token_here` with your TWILIO_AUTH_TOKEN
- [ ] Replace `https://abc123def456.ngrok.io` with URL from ngrok
- [ ] Keep everything else as-is
- [ ] Save the file

**Verify**: `cat backend/.env | grep WEBHOOK_URL` should show your ngrok URL

---

## STEP 5: Start backend ✓

**Terminal 2** (new terminal):
```bash
cd backend
npm run dev
```

Wait for output like:
```
✅ Environment validation passed
✅ Database connection established
✅ Server running on port 5000
```

- [ ] No error messages
- [ ] Server running message appears
- [ ] Keep terminal open

---

## STEP 6: Configure Twilio Console ✓

1. Go to https://www.twilio.com/console
2. Look for **"Messaging"** in left sidebar
3. Click **"Services"**
4. Select **"WhatsApp Sandbox"**
5. Scroll down to find **"Inbound Settings"** or **"When a message comes in"**
6. Paste your ngrok URL with `/api/v1/whatsapp/webhook`:
   ```
   https://abc123def456.ngrok.io/api/v1/whatsapp/webhook
   ```
7. Click **"Save"**

- [ ] Found Messaging → Services → WhatsApp Sandbox
- [ ] Found "Inbound Settings" or webhook URL field
- [ ] Pasted complete webhook URL
- [ ] Clicked Save (may see green checkmark)

**Result**: Twilio now knows where to send messages

---

## STEP 7: Verify Configuration ✓

**Terminal 3** (new terminal):
```bash
cd backend
node validate-webhook.js
```

This should show:
```
✅ TWILIO_ACCOUNT_SID: ACxxxxxxx...
✅ TWILIO_AUTH_TOKEN: xxxx...****
✅ WEBHOOK_URL: https://...
✅ Backend is running on http://localhost:5000
```

- [ ] All checkmarks appear (no red X)
- [ ] No error messages

If something shows ❌, see "TROUBLESHOOTING" section below.

---

## STEP 8: Test the Webhook ✓

1. Open your personal WhatsApp
2. Find the sandbox number (usually in Twilio docs or email from Twilio)
3. Send a test message (e.g., "hello")
4. Check **Terminal 2** (backend logs)

Look for output like:
```
POST /api/v1/whatsapp/webhook 200
✅ Webhook received and acknowledged to Twilio
Processing message: MessageSid=SM...
✅ Message processed successfully
```

- [ ] Message appears in backend logs
- [ ] Status code is 200
- [ ] No 403 or 500 errors
- [ ] See "Webhook received" message

---

## ✅ COMPLETE - Webhook is working!

If you see the logs in STEP 8, your webhook is now receiving messages from Twilio.

**Next**: Deploy to Render.com by updating WEBHOOK_URL to your Render backend URL.

---

# TROUBLESHOOTING

## ❌ Problem: "No logs in Terminal 2"

**Possible causes:**
1. Webhook URL not set in Twilio Console
2. Using wrong ngrok URL
3. Sent message to wrong number

**Fixes to try** (in order):

### Fix 1: Check ngrok URL matches
```bash
# In Terminal 3, print current ngrok URL
echo $WEBHOOK_URL  # Should match URL from Terminal 1 ngrok
```

If they don't match:
- Stop backend (Ctrl+C in Terminal 2)
- Update .env with current ngrok URL
- Restart backend: `npm run dev`

### Fix 2: Check Twilio Console
1. Go to https://www.twilio.com/console
2. Messaging → Services → WhatsApp Sandbox
3. Look at webhook URL field
4. Should match your ngrok URL exactly
5. If not, update it and Save

### Fix 3: Check ngrok is running
- Look at Terminal 1
- Should show `Forwarding https://...`
- If not, restart: `ngrok http 5000`

### Fix 4: Use ngrok GUI to inspect
1. Open http://127.0.0.1:4040 in browser
2. Send WhatsApp message
3. Should see POST request appear
4. If it does → Check backend logs for errors
5. If it doesn't → Twilio isn't sending (check config)

---

## ❌ Problem: "403 Forbidden" error

**Cause**: Signature validation failed

**Fixes**:
1. Verify TWILIO_AUTH_TOKEN is real (not placeholder):
   ```bash
   grep TWILIO_AUTH_TOKEN backend/.env
   # Should NOT contain: "your_real_auth_token_here"
   ```

2. Verify WEBHOOK_URL matches in .env:
   ```bash
   grep WEBHOOK_URL backend/.env
   # Should match ngrok URL exactly
   ```

3. Restart backend:
   ```bash
   npm run dev
   ```

4. Try again

---

## ❌ Problem: "500 Server Error"

**Cause**: TWILIO_AUTH_TOKEN is missing or undefined

**Fix**:
```bash
# Check if token is set
grep TWILIO_AUTH_TOKEN backend/.env

# If empty or missing, add it:
# TWILIO_AUTH_TOKEN=your_real_token_here

# Restart backend
npm run dev
```

---

## ❌ Problem: "502 Bad Gateway" from ngrok

**Cause**: Backend crashed or not running

**Fix**:
1. Check Terminal 2 for errors
2. Stop backend: Ctrl+C
3. Restart: `npm run dev`
4. Look for error messages
5. If persistent, check:
   ```bash
   # Is port 5000 already in use?
   netstat -ano | findstr :5000
   # If yes, close that process or use different port
   ```

---

## ❌ Problem: "Never got ngrok URL"

**Cause**: ngrok didn't start properly

**Fix**:
```bash
# Restart ngrok
ngrok http 5000

# Should immediately show:
# Forwarding    https://xxx.ngrok.io -> http://localhost:5000
```

---

## ❌ Problem: "Validate script shows ❌ MISSING TWILIO_AUTH_TOKEN"

**Fix**:
```bash
# Edit .env file with actual token from Twilio Console
# Make sure line exists (not just commented out)
TWILIO_AUTH_TOKEN=your_real_token_here

# Restart validation
node validate-webhook.js
```

---

# WHAT TO DO IF STILL STUCK

1. **Check all terminals are still running:**
   - Terminal 1: ngrok (`ngrok http 5000`)
   - Terminal 2: Backend (`npm run dev`)
   - If any crashed, restart it

2. **Run validation script again:**
   ```bash
   cd backend
   node validate-webhook.js
   ```
   - Look for ✅ marks
   - If ❌ marks, fix that issue first

3. **Check ngrok GUI:**
   - Open http://127.0.0.1:4040
   - Send WhatsApp message
   - Should see POST request appear
   - If not → Twilio isn't configured correctly

4. **Read full guides:**
   - TWILIO_WEBHOOK_SETUP_FIX.md (complete details)
   - TWILIO_WEBHOOK_TESTING.md (debugging scenarios)

5. **Double-check Twilio Console:**
   - Is webhook URL set? (Should show in "When a message comes in")
   - Is it showing green checkmark?
   - Is it the complete URL with `/api/v1/whatsapp/webhook`?

---

# WHEN WEBHOOK IS WORKING

✅ Congratulations! Your webhook is now receiving messages from Twilio.

**Next steps:**

1. Test with multiple messages to make sure it's stable
2. Check that messages are being saved to database
3. Test Render deployment with same webhook setup
4. Update webhook URL to your Render backend URL
5. Deploy code to Render
6. Update Twilio Console with Render webhook URL

See [TWILIO_WEBHOOK_SETUP_FIX.md](TWILIO_WEBHOOK_SETUP_FIX.md#production-deployment-rendercom) for production deployment guide.

---

## Quick Reference

| What | Where | Value |
|------|-------|-------|
| Account SID | Twilio Console Dashboard | ACxxxxxxx... |
| Auth Token | Twilio Console > Account Settings | random string |
| ngrok URL | Terminal 1 (ngrok output) | https://abc123.ngrok.io |
| Webhook URL | .env WEBHOOK_URL | https://abc123.ngrok.io/api/v1/whatsapp/webhook |
| Twilio Config | https://www.twilio.com/console | Same as Webhook URL |
| Backend | Terminal 2 | npm run dev |
| Validation | Terminal 3 | node validate-webhook.js |

---

**Estimated time: 15 minutes**  
**Status after completing: Webhook receiving messages from Twilio ✅**
