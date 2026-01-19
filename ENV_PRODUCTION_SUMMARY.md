# Production Environment Variables Summary

## Quick Reference Table

| Category | Variable | Required | Type | Source | Production Value |
|----------|----------|----------|------|--------|-------------------|
| **CORE** | NODE_ENV | ✅ | enum | Config | `production` |
| **CORE** | PORT | ✅ | number | Config | `5000` |
| **DATABASE** | DATABASE_URL | ✅ | string | PostgreSQL | `postgresql://...?sslmode=require` |
| **CACHE** | REDIS_URL | ✅ | string | Redis | `rediss://user:pass@host:6379` |
| **AUTH** | JWT_SECRET | ✅ | string | Generate | Strong 32+ char string |
| **TWILIO** | TWILIO_ACCOUNT_SID | ✅ | string | Twilio | `AC...` |
| **TWILIO** | TWILIO_AUTH_TOKEN | ✅ | string | Twilio | API token |
| **TWILIO** | TWILIO_WHATSAPP_FROM | ✅ | string | Twilio | `whatsapp:+1234567890` |
| **TWILIO** | WEBHOOK_URL | ✅ | string | Config | `https://domain.com/api/v1/whatsapp/webhook` |
| **TWILIO** | FORCE_TWILIO_VERIFY | ✅ | boolean | Config | `true` |
| **SECURITY** | WEBHOOK_IP_ALLOWLIST_ENABLED | ✅ | boolean | Config | `true` |
| **SECURITY** | WEBHOOK_ALLOWED_IPS | ✅ | string | Config | Twilio IP ranges |
| **SECURITY** | WEBHOOK_STRICT_MODE | ✅ | boolean | Config | `true` |
| **SECURITY** | CORS_ORIGIN | ✅ | string | Config | `https://frontend.com` |
| **EMAIL** | SMTP_HOST | ⚠️ | string | Config | `smtp.gmail.com` |
| **EMAIL** | SMTP_PORT | ⚠️ | number | Config | `587` |
| **EMAIL** | SMTP_USER | ⚠️ | string | Config | Email address |
| **EMAIL** | SMTP_PASS | ⚠️ | string | Config | App password |
| **LOGGING** | LOG_LEVEL | ⚠️ | enum | Config | `info` |
| **LOGGING** | LOG_FORMAT | ⚠️ | enum | Config | `json` |
| **ALERTING** | ALERTING_ENABLED | ⚠️ | boolean | Config | `true` |
| **ALERTING** | ALERT_EMAIL | ⚠️ | string | Config | Admin email |
| **AI** | OPENAI_API_KEY | ❌ | string | OpenAI | If using AI features |

**Legend**: ✅ = Required | ⚠️ = Highly Recommended | ❌ = Optional

---

## Production Deployment Checklist

### Tier 1: Critical (Application Won't Start)
- [ ] NODE_ENV = `production`
- [ ] DATABASE_URL = Valid PostgreSQL connection with SSL
- [ ] REDIS_URL or REDIS_HOST + REDIS_PORT + REDIS_PASSWORD
- [ ] JWT_SECRET = Strong random string (32+ characters)
- [ ] TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
- [ ] WEBHOOK_URL = Public endpoint for Twilio
- [ ] FORCE_TWILIO_VERIFY = `true`

### Tier 2: Security (Necessary for Production)
- [ ] WEBHOOK_IP_ALLOWLIST_ENABLED = `true`
- [ ] WEBHOOK_ALLOWED_IPS = Twilio IP ranges configured
- [ ] WEBHOOK_STRICT_MODE = `true`
- [ ] CORS_ORIGIN = Your frontend domain only
- [ ] VALIDATION_STRICT_MODE = `true`

### Tier 3: Operational (For Monitoring & Alerts)
- [ ] LOG_LEVEL = `info`
- [ ] LOG_FORMAT = `json`
- [ ] ALERTING_ENABLED = `true`
- [ ] ALERT_EMAIL or ALERT_SLACK_WEBHOOK configured
- [ ] TRACING_ENABLED = `true`
- [ ] METRICS_ENABLED = `true`

### Tier 4: Optional (Nice to Have)
- [ ] SMTP_* configured for email notifications
- [ ] OPENAI_API_KEY if using AI features
- [ ] ALERT_* thresholds tuned to your needs

---

## Variable Categories by Usage

### 1. Database & Cache Layer
Used for: Data persistence and job queue
```
DATABASE_URL
REDIS_URL (or REDIS_HOST + REDIS_PORT + REDIS_PASSWORD)
```

**Impact if missing**: Application cannot start

---

### 2. Authentication Layer
Used for: JWT token generation and verification
```
JWT_SECRET
```

**Impact if missing**: All authenticated requests fail

---

### 3. Twilio/WhatsApp Integration
Used for: Receiving and sending WhatsApp messages
```
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM
WEBHOOK_URL
FORCE_TWILIO_VERIFY
```

**Impact if missing**: No message delivery, webhook validation bypassed

---

### 4. Security Configuration
Used for: IP filtering, CORS, request validation
```
WEBHOOK_IP_ALLOWLIST_ENABLED
WEBHOOK_ALLOWED_IPS
WEBHOOK_STRICT_MODE
VALIDATION_STRICT_MODE
CORS_ORIGIN
```

**Impact if missing**: API exposed to unauthorized clients, bypass of security checks

---

### 5. Email Notifications
Used for: Sending alerts and notifications
```
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
ADMIN_EMAIL
BUSINESS_NAME
```

**Impact if missing**: Alert emails won't be sent (non-critical)

---

### 6. Logging & Observability
Used for: Application monitoring and debugging
```
LOG_LEVEL
LOG_FORMAT
LOG_FILE_PATH
TRACING_ENABLED
TRACE_SAMPLING_RATE
METRICS_ENABLED
```

**Impact if missing**: Limited visibility into application health

---

### 7. Alerting System
Used for: Automated incident notifications
```
ALERTING_ENABLED
ALERT_ERROR_RATE
ALERT_RESPONSE_TIME_P95
ALERT_CREDIT_FAILURE_RATE
ALERT_VENDOR_RESPONSE_TIME
ALERT_WEBHOOK_URL
ALERT_EMAIL
ALERT_SLACK_WEBHOOK
ALERT_PAGERDUTY_KEY
ALERT_COOLDOWN
```

**Impact if missing**: No automated incident response

---

### 8. AI Features (Optional)
Used for: Vision and AI-powered features
```
OPENAI_API_KEY
OPENAI_MODEL
```

**Impact if missing**: AI features disabled (non-critical)

---

### 9. Feature Flags
Used for: Enabling/disabling system features
```
ENABLE_BIDDING
ENABLE_CREDIT_SYSTEM
ENABLE_AUTO_RECOVERY
ENABLE_DAILY_REPORTS
DISABLE_TRANSACTION_GUARD
```

---

## Environment-Specific Examples

### Development
```bash
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/db
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev_secret_key_12345678901234567890
FORCE_TWILIO_VERIFY=false
LOG_LEVEL=debug
LOG_FORMAT=pretty
```

### Staging
```bash
NODE_ENV=staging
DATABASE_URL=postgresql://user:pass@staging-db:5432/db?sslmode=require
REDIS_URL=rediss://user:pass@staging-redis:6379
JWT_SECRET=<strong-random-string>
FORCE_TWILIO_VERIFY=true
LOG_LEVEL=info
LOG_FORMAT=json
```

### Production
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@prod-db:5432/db?sslmode=require
REDIS_URL=rediss://user:pass@prod-redis:6379
JWT_SECRET=<strong-random-string>
WEBHOOK_IP_ALLOWLIST_ENABLED=true
WEBHOOK_STRICT_MODE=true
FORCE_TWILIO_VERIFY=true
LOG_LEVEL=info
LOG_FORMAT=json
ALERTING_ENABLED=true
```

---

## Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` for templates
2. **Rotate JWT_SECRET** - Change before production deployment
3. **Use strong JWT_SECRET** - At least 32 random characters
4. **Enable WEBHOOK_STRICT_MODE** - Reject unknown IPs
5. **Always enable FORCE_TWILIO_VERIFY** - Verify webhook signatures
6. **Restrict CORS_ORIGIN** - Only allow your frontend domain
7. **Use SSL for all connections** - DATABASE_URL with `sslmode=require`, REDIS with `rediss://`
8. **Store secrets in vault** - Don't hardcode in configs
9. **Rotate credentials regularly** - Especially Twilio tokens
10. **Monitor alerting channels** - Ensure ALERT_EMAIL or ALERT_SLACK_WEBHOOK works

---

## Files Generated

1. **[.env.production](.env.production)** - Template with all production variables
2. **[ENV_VARIABLES_REFERENCE.md](ENV_VARIABLES_REFERENCE.md)** - Detailed mapping showing where each variable is used in code
3. **[ENV_PRODUCTION_SUMMARY.md](ENV_PRODUCTION_SUMMARY.md)** - This summary document

---

## Quick Setup Commands

### Copy template to .env
```bash
cp .env.example .env
```

### Update for production
```bash
cp .env.production .env
# Edit .env with your production values
```

### Validate all required variables are set
```bash
node scripts/validate-env.js
```

### Check which variables are used in code
```bash
# Search for all process.env references
grep -r "process.env" src/ --include="*.js" | grep -o "process\.env\.[A-Z_]*" | sort -u
```
