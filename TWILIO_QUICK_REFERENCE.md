# Twilio Webhook Security - Quick Reference Card

## 🎯 At a Glance

**Status**: ✅ Production Ready  
**Security Level**: HIGH ⭐⭐⭐⭐⭐  
**Implementation**: Complete & Tested  

---

## ⚡ Quick Setup (5 minutes)

### 1. Configure `.env`
```env
TWILIO_AUTH_TOKEN=your_token_from_twilio_console
WEBHOOK_URL=https://your-exact-domain.com/api/v1/whatsapp/webhook
```

### 2. Verify WEBHOOK_URL
- Go to Twilio console
- Copy webhook URL
- Paste into `.env` (must be exact match!)

### 3. Start Server
```bash
npm start
```

### 4. Test
Send a WhatsApp message. It should arrive!

---

## 🔐 Security Layers

| Layer | Check | Rejects |
|-------|-------|---------|
| 1️⃣ Rate Limit | >60 req/min? | 429 |
| 2️⃣ Replay | Duplicate request? | 409 |
| 3️⃣ Timestamp | Valid freshness? | 400 |
| 4️⃣ Signature | Valid signature? | 403 |

---

## 📊 Response Codes

```
200 OK           ✅ Request accepted & processing
400 Bad Request  ❌ Timestamp invalid
403 Forbidden    ❌ Invalid/missing signature
409 Conflict     ❌ Duplicate request (replay)
429 Too Many     ❌ Rate limit exceeded
500 Error        ❌ Server config issue
```

---

## 📍 File Locations

```
Middleware:  src/middleware/twilio-webhook.middleware.js
Routes:      src/routes/whatsapp.routes.js
Config:      .env
```

---

## 🛠️ Configuration

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `TWILIO_AUTH_TOKEN` | ✅ Yes | `abc123xyz...` | From Twilio console |
| `WEBHOOK_URL` | ✅ Yes | `https://api.example.com/api/v1/whatsapp/webhook` | Must match Twilio config |
| `TWILIO_CLOCK_SKEW_MS` | ⚪ Optional | `30000` | Default: 30 seconds |
| `TWILIO_NONCE_WINDOW_MS` | ⚪ Optional | `300000` | Default: 5 minutes |

---

## ✅ What Gets Accepted

```
✅ Requests WITH valid X-Twilio-Signature
✅ Signature matches calculated HMAC-SHA1
✅ Request is NOT a duplicate
✅ Timestamp is recent (< 5 minutes old)
✅ Rate limit NOT exceeded
```

---

## ❌ What Gets Rejected

```
❌ Missing X-Twilio-Signature header          → 403
❌ Invalid signature                           → 403
❌ Duplicate request (replay)                  → 409
❌ Timestamp too old (> 5 min)                 → 400
❌ Timestamp too far future (> 30s)            → 400
❌ Rate limit exceeded (> 60/min)              → 429
❌ Configuration missing (no AUTH_TOKEN)       → 500
```

---

## 🧪 Quick Test

### Test Valid Signature
```bash
# Get valid signature for your webhook
node -e "
const twilio = require('twilio');
const sig = twilio.validateRequest('YOUR_TOKEN', '', 'https://api.example.com/api/v1/whatsapp/webhook', {});
console.log('Signature:', sig);
"

# Use it in request
curl -X POST https://your-domain.com/api/v1/whatsapp/webhook \
  -H "X-Twilio-Signature: <paste_signature_here>" \
  -d "From=whatsapp:%2B97798..." 
```

### Test Invalid Signature
```bash
curl -X POST https://your-domain.com/api/v1/whatsapp/webhook \
  -H "X-Twilio-Signature: invalid" \
  -d "From=whatsapp:%2B97798..."

# Response: 403 Invalid Twilio signature
```

### Test Replay Attack
```bash
# Send same request twice
curl ... [first time]   # 200 OK
curl ... [second time]  # 409 Conflict (replay detected)
```

---

## 🐛 Troubleshooting

| Problem | Check |
|---------|-------|
| "Invalid signature" every time | 1. WEBHOOK_URL matches Twilio? 2. AUTH_TOKEN correct? |
| "Missing signature" | 1. Firewall stripping headers? 2. Proxy issue? |
| "Request too old" | 1. Server clock synced? 2. Network delay? |
| "Duplicate rejected" | 1. That's normal (replay prevention working) 2. Return 200 OK faster |
| "Rate limited" | 1. Check volume 2. Spread out requests |

---

## 📋 Middleware Stack

```javascript
router.post('/webhook',
  webhookRateLimiter,           // 1. Rate limit
  replayProtectionMiddleware(), // 2. Replay detection
  validateTwilioWebhook(url),   // 3. Signature validation
  handler                        // 4. Process message
);
```

**Order matters!** Always security → validation → processing

---

## 🔑 Key Concepts

### Signature
- HMAC-SHA1(AUTH_TOKEN, URL + Body)
- Proves request from Twilio
- In header: `X-Twilio-Signature`

### Nonce
- SHA256(Signature + Timestamp)
- Unique per request
- Cached for 5 minutes
- Detects replays

### Replay Attack
- Same request sent twice
- Caught by nonce cache
- Returns 409 Conflict

### Clock Skew
- Difference between server & Twilio time
- Tolerance: 30 seconds
- If > 30s: Reject request

---

## 📊 Monitoring

### Check Logs
```bash
# Security events
tail -f logs/security.log | grep -i "signature\|replay"

# Rejections
grep "403\|409\|400" logs/security.log

# Rate limit hits
grep "429" logs/security.log
```

### Health Check
```bash
# Get cache status
curl http://localhost:5000/api/v1/whatsapp/webhook/status
```

---

## 🚀 Production Checklist

- [ ] AUTH_TOKEN configured
- [ ] WEBHOOK_URL matches Twilio
- [ ] SERVER TIME SYNCED (NTP)
- [ ] Webhook uses HTTPS
- [ ] Returns 200 OK < 5 seconds
- [ ] Long ops use background jobs
- [ ] Logs are monitored
- [ ] Alerts configured
- [ ] Tested with real WhatsApp

---

## 📚 Documentation

| Doc | Purpose |
|-----|---------|
| TWILIO_QUICK_START.md | Start here (5 min) |
| TWILIO_WEBHOOK_SECURITY.md | Deep dive |
| TWILIO_CODE_COMPLETE_REFERENCE.md | Code examples |
| TWILIO_SECURITY_VISUAL_GUIDE.md | Diagrams |
| TWILIO_MOUNT_POINTS.md | Middleware placement |
| TWILIO_SECURITY_SUMMARY.md | Everything |

---

## 🎯 Request Flow

```
Twilio
  ↓ POST with X-Twilio-Signature header
Server
  ↓ Rate limit check
Pass?
  ↓ Replay check (nonce)
Pass?
  ↓ Signature validation (HMAC-SHA1)
Pass?
  ↓ Return 200 OK immediately
  ↓ Process message asynchronously
Message received & queued
```

---

## 🔗 Links

- [Twilio Docs](https://www.twilio.com/docs/usage/webhooks/webhooks-security)
- [Request Validation](https://www.twilio.com/docs/usage/webhooks/webhooks-security#validating-requests)
- [Twilio Console](https://www.twilio.com/console)

---

## 💾 Environment Template

```env
# Required
TWILIO_AUTH_TOKEN=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WEBHOOK_URL=https://your-domain.com/api/v1/whatsapp/webhook

# Optional (defaults work fine)
TWILIO_CLOCK_SKEW_MS=30000
TWILIO_NONCE_WINDOW_MS=300000

# Basic
NODE_ENV=production
PORT=5000
```

---

## 📞 Support

**Questions?** Check these in order:
1. Troubleshooting section above
2. TWILIO_QUICK_START.md
3. TWILIO_WEBHOOK_SECURITY.md
4. Twilio documentation

---

**Status**: ✅ Production Ready  
**Version**: 1.0  
**Updated**: January 2025  
**Security**: HIGH ⭐⭐⭐⭐⭐
