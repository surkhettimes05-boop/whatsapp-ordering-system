# Environment Variables Documentation Index

## 📋 Generated Files

This directory now contains comprehensive documentation for all environment variables required in production.

### 1. **[.env.production](.env.production)** (7.7 KB)
Complete production environment template with all variables, defaults, and descriptions.
- All 42 environment variables listed
- Organized by functional category
- Ready to copy and customize for deployment
- Includes security settings and alerting configuration

### 2. **[ENV_PRODUCTION_SUMMARY.md](ENV_PRODUCTION_SUMMARY.md)** (7.8 KB) ⭐ START HERE
High-level overview for quick reference.
- Quick reference table (Required/Type/Value)
- Production deployment checklist (3 tiers)
- Variables grouped by usage category
- Environment-specific examples (Dev/Staging/Prod)
- Security best practices
- Quick setup commands

### 3. **[ENV_VARIABLES_REFERENCE.md](ENV_VARIABLES_REFERENCE.md)** (12.6 KB)
Detailed mapping of every variable to its code locations.
- Complete variable documentation
- Direct links to source code files
- Usage patterns in each module
- Where and how each variable is used
- Production setup checklist

### 4. **[ENV_CODE_REFERENCE.md](ENV_CODE_REFERENCE.md)** (11 KB)
Complete code reference showing all occurrences.
- All 78 matches found in code
- File-by-file breakdown with line numbers
- 42 unique variables identified
- Usage statistics by module
- Script for validating environment variables

---

## 🚀 Quick Start

### For Production Deployment:
1. Read [ENV_PRODUCTION_SUMMARY.md](ENV_PRODUCTION_SUMMARY.md) - 5 min read
2. Copy [.env.production](.env.production) to `.env`
3. Fill in values for Tier 1 (Critical) variables
4. Review security section in [ENV_PRODUCTION_SUMMARY.md](ENV_PRODUCTION_SUMMARY.md)
5. Validate with provided script

### For Code Integration:
1. Reference [ENV_CODE_REFERENCE.md](ENV_CODE_REFERENCE.md) for exact code locations
2. Search [ENV_VARIABLES_REFERENCE.md](ENV_VARIABLES_REFERENCE.md) for specific variable usage
3. Check [.env.example](.env.example) for development defaults

### For Troubleshooting:
1. Check [ENV_PRODUCTION_SUMMARY.md](ENV_PRODUCTION_SUMMARY.md) deployment checklist
2. Verify Tier 1 variables in [ENV_PRODUCTION_SUMMARY.md](ENV_PRODUCTION_SUMMARY.md)
3. Look up variable source in [ENV_CODE_REFERENCE.md](ENV_CODE_REFERENCE.md)

---

## 📊 Variable Summary

**Total Unique Variables**: 42
**Total Occurrences**: 78 in code

### By Criticality:
- **🔴 Critical (7)**: Application won't start
- **🟠 Important (8)**: Major features fail
- **🟡 Recommended (12)**: Security/observability
- **🟢 Optional (15)**: Nice to have

### By Category:
| Category | Count | Examples |
|----------|-------|----------|
| Core App | 3 | NODE_ENV, PORT, APP_VERSION |
| Database | 5 | DATABASE_URL, REDIS_* |
| Authentication | 1 | JWT_SECRET |
| Twilio/WhatsApp | 5 | TWILIO_*, WEBHOOK_URL |
| Security | 5 | CORS_ORIGIN, IP_ALLOWLIST_* |
| Email | 6 | SMTP_* |
| Logging | 6 | LOG_*, TRACING_* |
| Alerting | 7 | ALERT_* |
| AI | 2 | OPENAI_* |
| Features | 2 | ENABLE_*, DISABLE_* |

---

## ✅ Production Checklist

### Tier 1: Critical (Must Have)
```
✅ NODE_ENV = production
✅ DATABASE_URL (with SSL)
✅ REDIS_URL or Redis credentials
✅ JWT_SECRET (32+ char random string)
✅ TWILIO_ACCOUNT_SID
✅ TWILIO_AUTH_TOKEN
✅ TWILIO_WHATSAPP_FROM
✅ WEBHOOK_URL (public endpoint)
✅ FORCE_TWILIO_VERIFY = true
```

### Tier 2: Security (Strongly Recommended)
```
✅ WEBHOOK_IP_ALLOWLIST_ENABLED = true
✅ WEBHOOK_ALLOWED_IPS (Twilio IPs)
✅ WEBHOOK_STRICT_MODE = true
✅ CORS_ORIGIN (your frontend domain)
✅ VALIDATION_STRICT_MODE = true
```

### Tier 3: Operational (Important)
```
✅ LOG_LEVEL = info
✅ LOG_FORMAT = json
✅ ALERTING_ENABLED = true
✅ ALERT_EMAIL or ALERT_SLACK_WEBHOOK
```

---

## 🔐 Security Best Practices

1. **Never commit .env files** - Only commit `.env.example`
2. **Use strong secrets** - JWT_SECRET minimum 32 random characters
3. **Rotate credentials** - Change TWILIO tokens regularly
4. **Use SSL everywhere** - DATABASE_URL & REDIS_URL with SSL
5. **Restrict CORS** - Only your frontend domain
6. **Enable IP filtering** - WEBHOOK_IP_ALLOWLIST_ENABLED=true
7. **Enable strict mode** - WEBHOOK_STRICT_MODE=true, VALIDATION_STRICT_MODE=true
8. **Verify webhooks** - FORCE_TWILIO_VERIFY=true in production
9. **Use vault/secrets manager** - Don't store in version control
10. **Monitor alerts** - Configure ALERT_EMAIL or ALERT_SLACK_WEBHOOK

---

## 📁 File Organization

```
backend/
├── .env                           # Your actual production config (DO NOT COMMIT)
├── .env.example                   # Template for development
├── .env.production                # Template for production (NEW)
├── .env.test                      # Template for testing
├── ENV_PRODUCTION_SUMMARY.md      # ⭐ Quick reference guide (NEW)
├── ENV_VARIABLES_REFERENCE.md     # Detailed variable mapping (NEW)
├── ENV_CODE_REFERENCE.md          # Code occurrence reference (NEW)
├── prisma/
│   └── schema.prisma              # Database schema
├── src/
│   ├── config/
│   │   ├── database.js            # Database connection
│   │   ├── security.config.js     # Security settings
│   │   ├── logger.js              # Logging config
│   │   ├── observability.config.js # Monitoring config
│   │   └── prismaClient.js        # Prisma client
│   ├── middleware/
│   │   ├── production.middleware.js
│   │   ├── auth.middleware.js
│   │   └── apiKey.middleware.js
│   ├── services/
│   │   ├── whatsapp.service.js
│   │   ├── email.service.js
│   │   ├── auth.service.js
│   │   └── vision.service.js
│   ├── queue/
│   │   ├── queue.js
│   │   └── queue.config.js
│   └── app.js                      # Main application file
└── package.json
```

---

## 🔍 Common Variables Lookup

### For WhatsApp Integration
See [ENV_VARIABLES_REFERENCE.md](ENV_VARIABLES_REFERENCE.md#twilio-whatsapp-integration):
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_WHATSAPP_FROM
- WEBHOOK_URL
- FORCE_TWILIO_VERIFY

### For Database Setup
See [ENV_VARIABLES_REFERENCE.md](ENV_VARIABLES_REFERENCE.md#database):
- DATABASE_URL
- REDIS_URL (or REDIS_HOST/PORT/PASSWORD)

### For Security
See [ENV_VARIABLES_REFERENCE.md](ENV_VARIABLES_REFERENCE.md#security-configuration):
- WEBHOOK_IP_ALLOWLIST_ENABLED
- WEBHOOK_ALLOWED_IPS
- WEBHOOK_STRICT_MODE
- CORS_ORIGIN

### For Monitoring/Alerts
See [ENV_VARIABLES_REFERENCE.md](ENV_VARIABLES_REFERENCE.md#alerting--monitoring):
- ALERTING_ENABLED
- ALERT_ERROR_RATE
- ALERT_EMAIL
- ALERT_SLACK_WEBHOOK

---

## 🛠️ Environment Setup Examples

### Development
```bash
NODE_ENV=development
DATABASE_URL=postgresql://localhost/dev_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev_secret_123456789012345678
FORCE_TWILIO_VERIFY=false
LOG_LEVEL=debug
```

### Staging
```bash
NODE_ENV=staging
DATABASE_URL=postgresql://user:pass@staging.db/db?sslmode=require
REDIS_URL=rediss://staging.redis:6379
JWT_SECRET=<strong-random-32-char-string>
FORCE_TWILIO_VERIFY=true
LOG_LEVEL=info
```

### Production
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@prod.db/db?sslmode=require
REDIS_URL=rediss://prod.redis:6379
JWT_SECRET=<strong-random-32-char-string>
WEBHOOK_IP_ALLOWLIST_ENABLED=true
WEBHOOK_STRICT_MODE=true
FORCE_TWILIO_VERIFY=true
ALERTING_ENABLED=true
LOG_LEVEL=info
LOG_FORMAT=json
```

---

## 📞 Support

For questions about specific variables:
1. Check the variable's section in [ENV_VARIABLES_REFERENCE.md](ENV_VARIABLES_REFERENCE.md)
2. Look up the source code in [ENV_CODE_REFERENCE.md](ENV_CODE_REFERENCE.md)
3. Review usage example in [ENV_PRODUCTION_SUMMARY.md](ENV_PRODUCTION_SUMMARY.md)

---

## Last Updated
- **Generated**: January 19, 2026
- **Variables Found**: 42 unique variables across 16 source files
- **Code Occurrences**: 78 total matches
- **Status**: ✅ Production Ready

---

**Quick Navigation**:
- 📖 [Start with Summary](ENV_PRODUCTION_SUMMARY.md)
- 🔍 [Find Variable Usage](ENV_CODE_REFERENCE.md)
- 📚 [Detailed Reference](ENV_VARIABLES_REFERENCE.md)
- 🚀 [Production Template](.env.production)
