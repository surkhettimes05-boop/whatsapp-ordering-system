# Environment Variables - Quick Reference Card

## 🚨 CRITICAL (Must Have)

```bash
# Application
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# Cache
REDIS_URL=rediss://user:pass@host:6379
# OR
REDIS_HOST=redis.host
REDIS_PORT=6379
REDIS_PASSWORD=secure_pass

# Security
JWT_SECRET=<generate-strong-32-char-random-string>

# Twilio/WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_FROM=whatsapp:+1234567890

# Webhook
WEBHOOK_URL=https://your-domain.com/api/v1/whatsapp/webhook
FORCE_TWILIO_VERIFY=true
```

## 🔐 SECURITY (Highly Recommended)

```bash
WEBHOOK_IP_ALLOWLIST_ENABLED=true
WEBHOOK_ALLOWED_IPS=54.172.60.0/22,54.244.51.0/24,157.240.0.0/16,31.13.0.0/16
WEBHOOK_STRICT_MODE=true
VALIDATION_STRICT_MODE=true
CORS_ORIGIN=https://your-frontend-domain.com
```

## 📊 MONITORING (Recommended)

```bash
# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Tracing
TRACING_ENABLED=true
METRICS_ENABLED=true

# Alerting
ALERTING_ENABLED=true
ALERT_EMAIL=admin@your-company.com
ALERT_SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

## ✉️ EMAIL (Optional)

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@your-company.com
SMTP_PASS=your_app_password_here
ADMIN_EMAIL=admin@your-company.com
BUSINESS_NAME=Your Company Name
```

## 🤖 AI (Optional)

```bash
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4
```

## ⚙️ ADVANCED (Optional)

```bash
# Alerting Thresholds
ALERT_ERROR_RATE=10
ALERT_RESPONSE_TIME_P95=5000
ALERT_CREDIT_FAILURE_RATE=5
ALERT_VENDOR_RESPONSE_TIME=10000

# Trace Configuration
TRACE_SAMPLING_RATE=0.1
TRACE_INCLUDE_BODIES=false

# Feature Flags
ENABLE_BIDDING=true
ENABLE_CREDIT_SYSTEM=true
ENABLE_AUTO_RECOVERY=true
```

---

## ⚡ Production Deployment Steps

### 1️⃣ Copy Template
```bash
cp .env.production .env
```

### 2️⃣ Fill CRITICAL Variables (Red Section)
```bash
nano .env
# Edit DATABASE_URL, REDIS_URL, JWT_SECRET, TWILIO_*, WEBHOOK_URL
```

### 3️⃣ Add SECURITY Variables (Yellow Section)
```bash
# Ensure these are set to production values
WEBHOOK_IP_ALLOWLIST_ENABLED=true
CORS_ORIGIN=your-actual-frontend-domain
```

### 4️⃣ Configure MONITORING (Blue Section)
```bash
# Set up at least Email or Slack alerts
ALERTING_ENABLED=true
ALERT_EMAIL=your-admin-email@company.com
```

### 5️⃣ Validate & Deploy
```bash
# Test that app starts
npm start

# Check health endpoint
curl http://localhost:5000/health

# If successful, deploy! 🚀
```

---

## 🔍 Variable Lookup by Use Case

### Need to send WhatsApp messages?
✅ TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM

### Need to authenticate users?
✅ JWT_SECRET

### Need database persistence?
✅ DATABASE_URL

### Need job queue (async tasks)?
✅ REDIS_URL (or REDIS_HOST/PORT/PASSWORD)

### Need alerts when errors occur?
✅ ALERTING_ENABLED, ALERT_EMAIL (or ALERT_SLACK_WEBHOOK)

### Need to block unauthorized IPs?
✅ WEBHOOK_IP_ALLOWLIST_ENABLED, WEBHOOK_ALLOWED_IPS, WEBHOOK_STRICT_MODE

### Need to limit frontend access?
✅ CORS_ORIGIN

### Need email notifications?
✅ SMTP_HOST, SMTP_USER, SMTP_PASS, ADMIN_EMAIL

### Need application monitoring?
✅ LOG_FORMAT=json, TRACING_ENABLED, METRICS_ENABLED

---

## 🚨 Common Mistakes to Avoid

❌ Don't: Use weak JWT_SECRET
✅ Do: Generate strong 32+ character random string
```bash
openssl rand -base64 32
```

❌ Don't: Commit .env to Git
✅ Do: Commit .env.example, use vault for secrets

❌ Don't: Use HTTP webhooks in production
✅ Do: Use HTTPS with WEBHOOK_STRICT_MODE=true

❌ Don't: Allow all CORS origins
✅ Do: Set CORS_ORIGIN to specific frontend domain

❌ Don't: Skip WEBHOOK_IP_ALLOWLIST in production
✅ Do: Enable WEBHOOK_IP_ALLOWLIST_ENABLED=true

❌ Don't: Use localhost for DATABASE_URL/REDIS_URL
✅ Do: Use cloud endpoints with SSL

❌ Don't: Leave LOG_FORMAT as 'pretty' in production
✅ Do: Set LOG_FORMAT=json for easier parsing

❌ Don't: Disable FORCE_TWILIO_VERIFY in production
✅ Do: Always keep FORCE_TWILIO_VERIFY=true

---

## 📋 Pre-Deployment Checklist

- [ ] NODE_ENV=production
- [ ] DATABASE_URL set with SSL (sslmode=require)
- [ ] REDIS_URL set with SSL (rediss://)
- [ ] JWT_SECRET is strong (32+ random chars)
- [ ] TWILIO_ACCOUNT_SID not empty
- [ ] TWILIO_AUTH_TOKEN not empty
- [ ] TWILIO_WHATSAPP_FROM is valid number
- [ ] WEBHOOK_URL is public HTTPS
- [ ] FORCE_TWILIO_VERIFY=true
- [ ] WEBHOOK_IP_ALLOWLIST_ENABLED=true
- [ ] WEBHOOK_ALLOWED_IPS includes Twilio ranges
- [ ] CORS_ORIGIN set to your domain
- [ ] LOG_FORMAT=json
- [ ] LOG_LEVEL=info
- [ ] ALERTING_ENABLED=true
- [ ] ALERT_EMAIL or ALERT_SLACK_WEBHOOK set
- [ ] Secrets stored safely (not in Git)
- [ ] .env file not committed

---

## 📚 Full Documentation

| Document | Purpose | Read Time |
|----------|---------|-----------|
| [ENV_PRODUCTION_SUMMARY.md](ENV_PRODUCTION_SUMMARY.md) | Quick overview & checklist | 5 min ⭐ |
| [.env.production](.env.production) | Template to use | 3 min |
| [ENV_VARIABLES_REFERENCE.md](ENV_VARIABLES_REFERENCE.md) | Detailed reference | 10 min |
| [ENV_CODE_REFERENCE.md](ENV_CODE_REFERENCE.md) | Where in code each is used | 8 min |
| [ENV_INDEX.md](ENV_INDEX.md) | Navigation & organization | 5 min |
| [ENV_ANALYSIS_COMPLETE.md](ENV_ANALYSIS_COMPLETE.md) | Full analysis report | 10 min |
| **This File** | Quick cards (you are here!) | 2 min ✅ |

---

## 🆘 Troubleshooting

**App won't start?**
→ Check CRITICAL section - likely missing DATABASE_URL or REDIS_URL

**WhatsApp not working?**
→ Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, WEBHOOK_URL

**Webhook validation failing?**
→ Check FORCE_TWILIO_VERIFY=true and WEBHOOK_URL is correct

**Can't connect to database?**
→ Verify DATABASE_URL is correct, PostgreSQL is running, SSL enabled

**Alerts not sending?**
→ Verify ALERTING_ENABLED=true and ALERT_EMAIL is valid

**Frontend can't reach API?**
→ Check CORS_ORIGIN matches frontend domain

---

**Last Updated**: January 19, 2026
**Status**: ✅ Production Ready
**Variables**: 42 total | 7 critical | 8 security | 12 recommended | 15 optional
