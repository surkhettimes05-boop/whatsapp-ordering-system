## HTTPS Implementation Complete ✅

This document summarizes the HTTPS support added to your backend for production-grade security.

---

## 🔒 What Was Added

### 1. HTTPS Enforcer Middleware (`src/middleware/https-enforcer.middleware.js`)

**Features:**
- ✅ Enforces HTTPS in production (redirects HTTP → HTTPS)
- ✅ Allows HTTP in development for local testing
- ✅ Works with all platforms (Railway, Render, VPS, custom proxies)
- ✅ Detects multiple proxy headers (X-Forwarded-Proto, CF-Visitor, ALB-Proto, etc.)
- ✅ Adds security headers (HSTS, CSP, etc.)
- ✅ Provides HTTPS-only mode for webhooks

**Key Functions:**
- `enforceHttps` - App-level HTTPS enforcement (auto-redirect)
- `httpsOnly` - Webhook-specific HTTPS enforcement (403 rejection)
- `httpsSecurityHeaders` - Security headers (HSTS, CSP, etc.)
- `validateWebhookUrl()` - Validates webhook URLs are HTTPS
- `isHttps()` - Detects HTTPS from request

### 2. HTTPS Server Configuration (`src/config/https-server.js`)

**Features:**
- ✅ Auto-detects platform (Railway, Render, Heroku, Vercel)
- ✅ Loads Let's Encrypt certificates for VPS
- ✅ Falls back to self-signed certs for development
- ✅ Graceful server startup/shutdown
- ✅ Error handling for SSL-related issues

**Supported Scenarios:**
1. **Managed Platforms (Railway/Render)** → HTTP server (platform handles SSL)
2. **VPS with Let's Encrypt** → HTTPS server with certificates
3. **Development** → Self-signed HTTPS certificates

### 3. Updated Routes (`src/routes/whatsapp.routes.js`)

**Changes:**
- ✅ Added `httpsOnly` middleware to webhook endpoints
- ✅ GET and POST `/api/v1/whatsapp/webhook` now require HTTPS
- ✅ Non-HTTPS requests return 403 Forbidden
- ✅ Added detailed logging for HTTPS validation

### 4. Updated App Entry Point (`src/app.js`)

**Changes:**
- ✅ Import HTTPS enforcement middleware
- ✅ Apply `enforceHttps` globally
- ✅ Apply `httpsSecurityHeaders` for security

---

## 🚀 Using HTTPS in Your Backend

### Option 1: Managed Platforms (Railway/Render/Heroku)

**No additional setup needed!**

- Platforms automatically provide SSL certificates
- Backend detects platform and runs HTTP server
- Platform terminates SSL connections
- Your domain is automatically HTTPS

```javascript
// Your backend receives:
req.protocol = 'http'  // (from platform's internal connection)
req.get('x-forwarded-proto') = 'https'  // (from platform)

// Our middleware detects this as HTTPS ✅
```

### Option 2: VPS with Let's Encrypt

**Setup:**
1. [Follow Let's Encrypt/Certbot guide](./CUSTOM_DOMAIN_SETUP.md#vps-setup)
2. Backend auto-loads certificates from:
   - `/etc/letsencrypt/live/yourdomain.com/fullchain.pem`
   - `/etc/letsencrypt/live/yourdomain.com/privkey.pem`
3. Server starts HTTPS automatically

**Certificate Renewal:**
- Certbot auto-renews 30 days before expiry
- Our graceful shutdown ensures zero-downtime reloads

```bash
# Check certificate status
certbot certificates

# Manual renewal (if needed)
certbot renew --force-renewal
```

### Option 3: Development with Self-Signed Certs

**Automatic:**
1. Server generates self-signed certificate on first run
2. Stored in `/backend/certs/self-signed/`
3. Reused for subsequent runs

```bash
# Generated files:
/backend/certs/self-signed/cert.pem   # Self-signed certificate
/backend/certs/self-signed/key.pem    # Private key

# Test with:
curl --insecure https://localhost:5000/health
```

---

## 🔐 Security Features Implemented

### 1. HTTPS Enforcement

**Production:**
```
HTTP request to /api/v1/orders
        ↓
HTTP → HTTPS redirect (301)
        ↓
https://yourdomain.com/api/v1/orders
```

**Development:**
```
HTTP allowed for local testing ✓
HTTPS also supported ✓
```

### 2. Webhook Protection

**Twilio Webhooks (REQUIRED HTTPS):**
```
Non-HTTPS POST to /api/v1/whatsapp/webhook
        ↓
403 Forbidden response
        ↓
Error logged: "Non-HTTPS webhook request rejected"
```

**Why?**
- Twilio only sends webhooks to HTTPS endpoints
- Prevents man-in-the-middle attacks on messages
- Ensures message authenticity

### 3. Security Headers

Applied to all responses:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  → Forces browser to always use HTTPS
  → Valid for 1 year
  → Preload in browser HSTS list

Upgrade-Insecure-Requests: 1
  → Browser automatically upgrades HTTP → HTTPS
  → For older clients

Content-Security-Policy: upgrade-insecure-requests; default-src 'self' https:
  → Only allows HTTPS and self-hosted resources
  → Prevents mixed content warnings
```

### 4. Proxy Detection

Automatically detects headers from:
- ✅ Railway (`RAILWAY_ENVIRONMENT`)
- ✅ Render (`RENDER=true`)
- ✅ Heroku (`DYNO`)
- ✅ Cloudflare (`CF-Visitor`)
- ✅ AWS ALB (`X-ALB-Proto`)
- ✅ Nginx reverse proxy (`X-Proto`, `X-Forwarded-Proto`)
- ✅ Generic reverse proxy (`X-Forwarded-Proto`)

---

## 📊 Architecture

### Data Flow

**Managed Platforms (Railway/Render):**
```
Twilio HTTPS Request
    ↓
Platform SSL Termination
    ↓
HTTP (internal) → Backend
    ↓
Middleware detects X-Forwarded-Proto: https
    ↓
Request processed as HTTPS-verified ✅
```

**VPS with Let's Encrypt:**
```
Twilio HTTPS Request
    ↓
Nginx SSL Termination (optional)
    ↓
HTTPS → Backend (direct)
    ↓
Middleware detects protocol = https
    ↓
Request processed ✅
```

### File Structure

```
backend/
├── src/
│   ├── middleware/
│   │   ├── https-enforcer.middleware.js       ← HTTPS enforcement
│   │   ├── twilio-webhook.middleware.js       ← Signature validation
│   │   └── ...
│   ├── config/
│   │   ├── https-server.js                    ← Server init
│   │   ├── logger.js
│   │   └── ...
│   ├── routes/
│   │   ├── whatsapp.routes.js                 ← httpsOnly added
│   │   └── ...
│   └── app.js                                 ← enforceHttps added
├── certs/
│   └── self-signed/                           ← Dev certificates
│       ├── cert.pem
│       └── key.pem
└── ...
```

---

## ⚙️ Configuration

### Environment Variables

```bash
# Platform (auto-detected, but can be set)
RAILWAY_ENVIRONMENT=    # Set by Railway
RENDER=true             # Set by Render
DYNO=                   # Set by Heroku

# Domain (for Let's Encrypt on VPS)
DOMAIN=api.yourdomain.com
CERTBOT_DOMAIN=api.yourdomain.com
CERT_PATH=/etc/letsencrypt/live

# Webhook URL (set in production)
WEBHOOK_URL=https://api.yourdomain.com/api/v1/whatsapp/webhook

# Server
PORT=5000
HOST=0.0.0.0
NODE_ENV=production

# Optional: Certificate pinning (advanced)
ENABLE_HPKP=false
PUBLIC_KEY_PINS=    # Format: pin-sha256="..."; max-age=...
```

### Testing HTTPS Configuration

```bash
# Check if HTTPS is enforced
curl -I http://api.yourdomain.com/health
# Should redirect to HTTPS (301)

# Test HTTPS endpoint
curl https://api.yourdomain.com/health
# Should return 200 OK

# Test webhook (HTTPS required)
curl https://api.yourdomain.com/api/v1/whatsapp/webhook
# Should work (405 Method Not Allowed for GET is OK)

# Test webhook with HTTP (should fail)
curl http://api.yourdomain.com/api/v1/whatsapp/webhook
# Should return 403 Forbidden

# Check SSL certificate
openssl s_client -connect api.yourdomain.com:443
# Should show valid certificate details

# Check HTTPS headers
curl -I https://api.yourdomain.com/health
# Should include:
# Strict-Transport-Security: max-age=31536000...
# Content-Security-Policy: ...
```

---

## 🔍 Troubleshooting HTTPS Issues

### Issue: "Protocol Mismatch" Errors

**Cause:** Middleware can't detect HTTPS from proxy

**Fix:**
1. Check proxy is setting `X-Forwarded-Proto: https`
2. Verify `req.protocol` in logs shows correct protocol
3. Update Nginx config if using custom reverse proxy

```nginx
# Nginx configuration
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

### Issue: SSL Certificate Not Found

**Cause:** Let's Encrypt certificate missing or wrong path

**Fix:**
```bash
# Check certificate exists
ls -la /etc/letsencrypt/live/yourdomain.com/

# Should show:
# fullchain.pem
# privkey.pem
# cert.pem
# chain.pem

# If missing, run Certbot
certbot certonly -d yourdomain.com
```

### Issue: Self-Signed Certificate Warning

**In Development Only:**
- This is expected! Self-signed certs are for testing
- Browser warning is normal
- Add `--insecure` flag to curl: `curl --insecure https://localhost:5000`

**Production:**
- Should never see self-signed certs
- Use Let's Encrypt (free) on VPS
- Use managed platform SSL (Railway/Render)

### Issue: Webhook Returns 403 Forbidden

**Cause:** Webhook accessed over HTTP

**Check:**
```bash
# This should work:
curl https://api.yourdomain.com/api/v1/whatsapp/webhook

# This should return 403:
curl http://api.yourdomain.com/api/v1/whatsapp/webhook
```

**Twilio Configuration:**
1. Webhook URL must start with `https://`
2. Check in Twilio Console → Messaging → Settings
3. Update if using old ngrok/local URL

---

## 📋 Deployment Checklist

### Before Deploying to Production

- [ ] HTTPS middleware integrated in `src/app.js`
- [ ] Webhook routes have `httpsOnly` middleware
- [ ] Environment variable `WEBHOOK_URL` set to HTTPS URL
- [ ] Environment variable `DOMAIN` set (for VPS)
- [ ] SSL certificate obtained:
  - [ ] Platform SSL (Railway/Render) - automatic
  - [ ] Let's Encrypt (VPS) - certbot configured
- [ ] `NODE_ENV=production` set
- [ ] HTTPS redirects working (test with curl)
- [ ] Twilio webhook URL updated to HTTPS
- [ ] Test message sent via WhatsApp succeeds

### For Managed Platforms (Railway/Render)

```bash
# 1. Deploy backend
git push railway main  # or similar

# 2. Set environment variables
WEBHOOK_URL=https://your-api-domain/api/v1/whatsapp/webhook

# 3. Verify HTTPS works
curl https://your-api-domain/health

# 4. Update Twilio webhook URL
# Dashboard → Messaging → Settings
# "When a message comes in": https://your-api-domain/api/v1/whatsapp/webhook

# 5. Test
# Send message to WhatsApp number
# Check backend logs for message receipt
```

### For VPS with Let's Encrypt

```bash
# 1. Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# 2. Get certificate
sudo certbot certonly -d api.yourdomain.com

# 3. Configure Nginx reverse proxy
# See CUSTOM_DOMAIN_SETUP.md for full config

# 4. Set environment variables
export DOMAIN=api.yourdomain.com
export WEBHOOK_URL=https://api.yourdomain.com/api/v1/whatsapp/webhook

# 5. Start backend
NODE_ENV=production node src/app.js

# 6. Set up auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# 7. Update Twilio webhook URL
# Same as managed platform above
```

---

## 📊 HTTPS Status Dashboard

Check HTTPS configuration with:

```javascript
// In backend route or health check:
const { checkHttpsSupport } = require('./middleware/https-enforcer.middleware');

// Returns:
{
  isHttps: true,
  protocol: 'https',
  headers: {
    'x-forwarded-proto': 'https',
    'cf-visitor': false,
    host: 'api.yourdomain.com'
  },
  environment: 'production',
  platform: 'Railway'  // or 'Render', 'VPS', etc.
}
```

---

## 🎯 Next Steps

1. **Deploy Code:** Push changes to your platform
2. **Configure Domain:** Follow [CUSTOM_DOMAIN_SETUP.md](./CUSTOM_DOMAIN_SETUP.md)
3. **Test Webhooks:** Send test WhatsApp message
4. **Monitor Logs:** Watch for any HTTPS-related errors
5. **Update Twilio:** Point webhooks to HTTPS endpoint

---

## 📚 Related Documentation

- [Custom Domain Setup](./CUSTOM_DOMAIN_SETUP.md) - Domain + SSL configuration
- [Twilio Webhook Security](./TWILIO_WEBHOOK_SECURITY.md) - Webhook validation
- [Production Hardening](./PRODUCTION_HARDENING_COMPLETE.md) - Security best practices
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Platform-specific deployment

---

## ✅ Verification

**HTTPS is working correctly when:**

1. ✅ HTTP requests redirect to HTTPS
2. ✅ HTTPS requests succeed (200 OK)
3. ✅ Webhook requires HTTPS (403 on HTTP)
4. ✅ Security headers present (HSTS, CSP, etc.)
5. ✅ Twilio webhooks trigger messages
6. ✅ No SSL certificate warnings (production)
7. ✅ Logs show "HTTPS verified" for webhooks

**Next verification:**
```bash
# Test all aspects:
./scripts/test-https-setup.sh  # (if available)

# Or manually:
curl -v https://api.yourdomain.com/health
curl -v https://api.yourdomain.com/api/v1/whatsapp/webhook
curl -I http://api.yourdomain.com/health  # Should redirect
```

---

## 🎉 Summary

Your backend now has **production-grade HTTPS support**:

- ✅ Enforced HTTPS on all routes
- ✅ Webhook requires HTTPS (Twilio compatible)
- ✅ Works on all platforms (Railway, Render, VPS)
- ✅ Auto-detects platform SSL setup
- ✅ Supports Let's Encrypt on VPS
- ✅ Security headers configured
- ✅ Graceful error handling

**You're ready to deploy to production with confidence!** 🚀

