# TWILIO WEBHOOK FIX - QUICK REFERENCE CARD

**Print This Page and Keep Handy**

---

## ⚡ The 3 Commands You Need

```bash
# Terminal 1: Start ngrok tunnel
ngrok http 5000
# Copy the HTTPS URL shown (e.g., https://abc123.ngrok.io)

# Terminal 2: Start backend
cd backend && npm run dev

# Terminal 3: Validate configuration
cd backend && node validate-webhook.js
```

---

## 🔧 The 3 Environment Variables You Need

Edit `backend/.env`:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_real_auth_token_here
WEBHOOK_URL=https://abc123.ngrok.io/api/v1/whatsapp/webhook
```

**Get values from:**
- Account SID: https://www.twilio.com/console (Dashboard)
- Auth Token: https://www.twilio.com/console/account/settings
- Webhook URL: From ngrok output (Terminal 1)

---

## 🎯 The 1 Configuration Change

**Go to Twilio Console:**
1. Messaging → Services → WhatsApp Sandbox
2. Find "When a message comes in" field
3. Paste: `https://abc123.ngrok.io/api/v1/whatsapp/webhook`
4. Click Save

---

## ✅ Quick Validation

After setup, you should see:

| What | Where | What to Look For |
|------|-------|------------------|
| ngrok running | Terminal 1 | `Forwarding https://... → http://localhost:5000` |
| Backend running | Terminal 2 | `✅ Server running on port 5000` |
| Validation passes | Terminal 3 | `✅ TWILIO_ACCOUNT_SID: ACxxxxxxx` |
| Webhook works | Terminal 2 logs | `✅ Webhook received and acknowledged` |
| ngrok shows traffic | http://127.0.0.1:4040 | `POST /api/v1/whatsapp/webhook 200` |

---

## 🆘 Quick Fixes (In Order)

| Problem | Fix |
|---------|-----|
| No requests in logs | Check Twilio Console webhook URL is set |
| 403 Forbidden | Verify TWILIO_AUTH_TOKEN is real (not placeholder) |
| 500 Error | Check .env has TWILIO_AUTH_TOKEN line |
| 502 Bad Gateway | Backend crashed - check Terminal 2 for errors |
| Can't connect ngrok | Check `netstat -ano \| findstr :5000` |

---

## 📋 8-Step Setup Summary

```
1. Install ngrok         → ngrok.com/download
2. Get credentials       → twilio.com/console
3. Start ngrok tunnel    → ngrok http 5000
4. Update .env file      → Add Twilio vars
5. Start backend         → npm run dev
6. Configure Twilio      → Set webhook URL
7. Validate setup        → node validate-webhook.js
8. Test webhook          → Send WhatsApp message
```

---

## 🔗 Important URLs

- Twilio Console: https://www.twilio.com/console
- ngrok Dashboard: http://127.0.0.1:4040
- Backend Health: http://localhost:5000/health
- Render Dashboard: https://dashboard.render.com

---

## 📱 Test Message

1. Open WhatsApp on your phone
2. Find sandbox number (from Twilio docs)
3. Send: "hello"
4. Check Terminal 2 for: `✅ Webhook received`

---

## 🐛 Error Decoder

```
403 Forbidden
→ TWILIO_AUTH_TOKEN wrong or WEBHOOK_URL mismatch
→ Fix: Verify both in .env, restart backend

500 Server Error  
→ TWILIO_AUTH_TOKEN missing
→ Fix: Add to .env, restart backend

502 Bad Gateway
→ Backend not running on :5000
→ Fix: Start backend with: npm run dev

No logs appearing
→ Twilio Console webhook URL not set or wrong
→ Fix: Update Twilio Console, wait 30 sec
```

---

## 💾 .env Template

```env
# Twilio (from console)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_real_auth_token_here
TWILIO_PHONE_NUMBER=+14155238886
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# ngrok URL (from ngrok output)
WEBHOOK_URL=https://abc123def456.ngrok.io/api/v1/whatsapp/webhook

# Database
DATABASE_URL=postgresql://...

# Other
NODE_ENV=development
PORT=5000
```

---

## 🚀 After Webhook Works

1. Update WEBHOOK_URL to Render URL
2. Push to GitHub
3. Set Render environment variables
4. Update Twilio Console with Render URL
5. Test production

---

## 📚 Quick Links to Docs

- **Quick Start**: [TWILIO_WEBHOOK_QUICK_START.md](TWILIO_WEBHOOK_QUICK_START.md)
- **Checklist**: [TWILIO_WEBHOOK_CHECKLIST.md](TWILIO_WEBHOOK_CHECKLIST.md)
- **Complete Guide**: [TWILIO_WEBHOOK_SETUP_FIX.md](TWILIO_WEBHOOK_SETUP_FIX.md)
- **Diagrams**: [TWILIO_WEBHOOK_VISUAL_DIAGRAMS.md](TWILIO_WEBHOOK_VISUAL_DIAGRAMS.md)
- **Start Here**: [TWILIO_WEBHOOK_FIX_START_HERE.md](TWILIO_WEBHOOK_FIX_START_HERE.md)

---

## ⏱️ Timeline

| What | Time |
|------|------|
| Install ngrok | 2 min |
| Get credentials | 3 min |
| Update .env | 2 min |
| Start services | 2 min |
| Test webhook | 5 min |
| **Total** | **15 min** |

---

## ✨ Success Indicators

✅ See these = Webhook is working

```
[POST] /api/v1/whatsapp/webhook 200
✅ Webhook received and acknowledged to Twilio
Processing message: MessageSid=SM...
✅ Message processed successfully
```

---

## 🔐 Security Reminders

- ❌ Never share TWILIO_AUTH_TOKEN
- ❌ Never commit .env with real tokens
- ❌ Use .env.example for templates
- ✅ Rotate tokens periodically
- ✅ Use environment variables in production

---

**Ready?** Start with [TWILIO_WEBHOOK_CHECKLIST.md](TWILIO_WEBHOOK_CHECKLIST.md)

**Questions?** See [TWILIO_WEBHOOK_INDEX.md](TWILIO_WEBHOOK_INDEX.md)
