## HTTPS Quick Setup Guide

**Time:** 5 minutes to verify  
**Difficulty:** Easy  
**Status:** ✅ Already implemented in your backend

---

## What's Already Done ✅

Your backend now includes:

1. ✅ **HTTPS Enforcer Middleware** - Redirects HTTP → HTTPS
2. ✅ **Webhook HTTPS Enforcement** - Twilio webhooks require HTTPS
3. ✅ **Security Headers** - HSTS, CSP, upgrade headers
4. ✅ **SSL Certificate Support** - Let's Encrypt + self-signed
5. ✅ **Platform Detection** - Railway, Render, Heroku, VPS

**No code changes needed.** Everything is integrated! 🎉

---

## Verify It's Working

### Step 1: Check Your Environment

```bash
# See what platform you're using:
echo "Environment: $NODE_ENV"
echo "Platform: $RAILWAY_ENVIRONMENT $RENDER $DYNO"

# Railway:
RAILWAY_ENVIRONMENT=<set>

# Render:
RENDER=true

# Heroku:
DYNO=<set>

# VPS/Custom:
(none of above set)
```

### Step 2: Test HTTPS Enforcement

**Local Testing (development):**
```bash
# Start your server
NODE_ENV=development node src/app.js

# Both HTTP and HTTPS work locally:
curl http://localhost:5000/health          # Works ✅
curl https://localhost:5000/health --insecure  # Works ✅
```

**Production Testing (after deployment):**
```bash
# HTTP redirects to HTTPS:
curl -I https://api.yourdomain.com/health
# Should return: HTTP/1.1 200 OK

# Check redirect header:
curl -i http://api.yourdomain.com/health
# Should show: HTTP/1.1 301 Moved Permanently
# Location: https://api.yourdomain.com/health
```

### Step 3: Test Webhook HTTPS Enforcement

```bash
# This should work (HTTPS):
curl -X POST https://api.yourdomain.com/api/v1/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "X-Twilio-Signature: dummy" \
  -d '{"test": "data"}'
# Returns: 200 OK or webhook validation error (OK!)

# This should be REJECTED (HTTP):
curl -X POST http://api.yourdomain.com/api/v1/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
# Returns: 403 Forbidden ✅ (expected!)
```

---

## For Each Platform

### Railway

**No setup needed!** 🎉

1. Deploy with: `git push railway main`
2. Railway auto-provides HTTPS
3. Backend detects and runs HTTP (Railway terminates SSL)
4. Test: `curl https://your-project.up.railway.app/health`

```bash
# Environment already detects:
RAILWAY_ENVIRONMENT=<set>

# Your backend automatically uses platform SSL ✅
```

### Render

**No setup needed!** 🎉

1. Deploy via Render dashboard
2. Render auto-provides HTTPS
3. Backend detects and runs HTTP (Render terminates SSL)
4. Test: `curl https://your-project.onrender.com/health`

```bash
# Environment already detects:
RENDER=true

# Your backend automatically uses platform SSL ✅
```

### Heroku

**No setup needed!** 🎉

1. Deploy with: `git push heroku main`
2. Heroku auto-provides HTTPS
3. Backend detects and runs HTTP
4. Test: `curl https://your-app.herokuapp.com/health`

```bash
# Environment already detects:
DYNO=<set>

# Your backend automatically uses platform SSL ✅
```

### VPS (Custom Domain + Let's Encrypt)

**5-minute setup:**

1. **Install Certbot:**
   ```bash
   sudo apt-get update
   sudo apt-get install certbot python3-certbot-nginx
   ```

2. **Get Certificate:**
   ```bash
   sudo certbot certonly -d api.yourdomain.com
   # Saves to: /etc/letsencrypt/live/api.yourdomain.com/
   ```

3. **Set Environment Variables:**
   ```bash
   export DOMAIN=api.yourdomain.com
   export WEBHOOK_URL=https://api.yourdomain.com/api/v1/whatsapp/webhook
   export NODE_ENV=production
   ```

4. **Start Backend:**
   ```bash
   node src/app.js
   # Backend auto-loads certificate ✅
   ```

5. **Set Up Auto-Renewal:**
   ```bash
   sudo systemctl enable certbot.timer
   sudo systemctl start certbot.timer
   # Certbot auto-renews 30 days before expiry
   ```

6. **Test:**
   ```bash
   curl https://api.yourdomain.com/health
   # Should return: 200 OK ✅
   ```

---

## Configure Twilio Webhooks

**After HTTPS is working, update Twilio:**

1. Go to [twilio.com/console](https://www.twilio.com/console)
2. **Messaging → Settings → WhatsApp Sandbox** (or your number)
3. Find **"When a message comes in"** webhook
4. Update URL to: `https://api.yourdomain.com/api/v1/whatsapp/webhook`
5. Change method to: **POST**
6. Click **Save**

```
Before: http://old-url.ngrok.io/webhook
After:  https://api.yourdomain.com/api/v1/whatsapp/webhook
        ↑ Must be HTTPS! ↑
```

---

## Verify Twilio Webhooks Work

1. **Send Test Message:**
   ```
   Open WhatsApp
   Message your business number (test number provided by Twilio)
   Send: "Hello"
   ```

2. **Check Backend Logs:**
   ```bash
   # Should see:
   "HTTPS verified message from +123456789"
   
   # NOT:
   "Non-HTTPS webhook request rejected"
   ```

3. **Check Database:**
   ```bash
   # Message should be recorded:
   SELECT * FROM Message WHERE from = 'whatsapp:+123456789' ORDER BY createdAt DESC LIMIT 1;
   ```

---

## Common Issues

### Issue: "SSL certificate error" or "mixed content"

**Solution:**
- Clear browser cache (Ctrl+Shift+Delete)
- Ensure webhook URL starts with `https://`
- Wait 5 minutes for DNS propagation

### Issue: Webhook returns 403 Forbidden

**Solution:**
```bash
# Check what you're sending:
curl http://api.yourdomain.com/api/v1/whatsapp/webhook
# Returns: 403 Forbidden ✅ (expected!)

# Must use HTTPS:
curl https://api.yourdomain.com/api/v1/whatsapp/webhook
# Returns: 400 Bad Request (webhook format issue, but HTTPS works!)
```

### Issue: "Certificate not found" error

**VPS only - Solution:**
```bash
# Check certificate exists:
ls -la /etc/letsencrypt/live/api.yourdomain.com/

# If not found, run:
sudo certbot certonly -d api.yourdomain.com

# If still issues, check backend logs:
tail -f logs/error.log | grep -i "certificate"
```

---

## Next Steps

1. ✅ **Verify HTTPS is working:**
   ```bash
   curl https://api.yourdomain.com/health
   ```

2. ✅ **Update Twilio webhook URL:**
   - Go to twilio.com/console
   - Set URL to: `https://api.yourdomain.com/api/v1/whatsapp/webhook`

3. ✅ **Send test message:**
   - Open WhatsApp
   - Message your business number
   - Check logs for message receipt

4. ✅ **Monitor:**
   - Check logs for HTTPS-related errors
   - Monitor webhook delivery success

---

## Testing Commands

Save as `test-https.sh` for easy testing:

```bash
#!/bin/bash

DOMAIN="${1:-api.yourdomain.com}"
echo "Testing HTTPS on: $DOMAIN"
echo ""

# Test 1: Check HTTP redirect
echo "Test 1: HTTP redirect to HTTPS"
curl -i http://$DOMAIN/health 2>&1 | head -5
echo ""

# Test 2: Check HTTPS works
echo "Test 2: HTTPS endpoint"
curl -I https://$DOMAIN/health
echo ""

# Test 3: Check SSL certificate
echo "Test 3: SSL Certificate"
echo | openssl s_client -connect $DOMAIN:443 2>/dev/null | grep -A5 "Subject:"
echo ""

# Test 4: Check security headers
echo "Test 4: Security Headers"
curl -I https://$DOMAIN/health | grep -i "Strict-Transport-Security"
echo ""

# Test 5: Webhook HTTPS required
echo "Test 5: Webhook requires HTTPS"
echo "Testing HTTP (should return 403):"
curl -X POST http://$DOMAIN/api/v1/whatsapp/webhook 2>&1 | head -1
echo "Testing HTTPS (should return 400+ webhook error):"
curl -X POST https://$DOMAIN/api/v1/whatsapp/webhook 2>&1 | head -1
echo ""

echo "✅ All tests complete!"
```

Run it:
```bash
bash test-https.sh api.yourdomain.com
```

---

## Environment Variables Checklist

For production deployment:

```bash
# Required for Twilio webhooks
WEBHOOK_URL=https://api.yourdomain.com/api/v1/whatsapp/webhook

# Required for Let's Encrypt (VPS only)
DOMAIN=api.yourdomain.com

# Recommended
NODE_ENV=production
PORT=5000

# Optional (auto-detected usually)
# RAILWAY_ENVIRONMENT=   (Railway sets this)
# RENDER=true            (Render sets this)
# DYNO=                  (Heroku sets this)
```

---

## Files Updated

- ✅ `src/middleware/https-enforcer.middleware.js` - HTTPS enforcement
- ✅ `src/config/https-server.js` - Server initialization
- ✅ `src/app.js` - Added HTTPS middleware
- ✅ `src/routes/whatsapp.routes.js` - Added `httpsOnly` to webhooks

**No breaking changes.** All updates are backward compatible. ✅

---

## 🎉 You're Done!

Your backend now has:
- ✅ HTTPS enforced on all routes
- ✅ Twilio webhooks require HTTPS
- ✅ Security headers configured
- ✅ Works on all platforms
- ✅ Auto-detects platform SSL setup

**Ready to deploy to production!** 🚀

---

For more details, see:
- [HTTPS_IMPLEMENTATION_COMPLETE.md](./HTTPS_IMPLEMENTATION_COMPLETE.md) - Full documentation
- [CUSTOM_DOMAIN_SETUP.md](../CUSTOM_DOMAIN_SETUP.md) - Domain + SSL setup
