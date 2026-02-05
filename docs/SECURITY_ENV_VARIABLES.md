# 🔐 Security Environment Variables Reference

## Overview
Complete list of environment variables required for security hardening of the WhatsApp ordering platform.

---

## 🛡️ Core Security Variables

### JWT Authentication
```bash
# JWT signing secret (REQUIRED)
# Must be at least 32 characters, use strong random string
JWT_SECRET=your_super_secure_jwt_secret_key_here_minimum_32_chars

# JWT token expiration (default: 7d)
JWT_EXPIRES_IN=7d

# JWT refresh token expiration (default: 30d)
JWT_REFRESH_EXPIRES_IN=30d
```

### Database Security
```bash
# PostgreSQL connection with SSL (REQUIRED)
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"

# Database connection pool settings
DATABASE_MAX_CONNECTIONS=20
DATABASE_CONNECTION_TIMEOUT=30000
DATABASE_IDLE_TIMEOUT=600000
```

### Redis Security
```bash
# Redis connection (choose one method)
# Method 1: Full URL with password
REDIS_URL="rediss://username:password@host:port/database"

# Method 2: Individual components
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_redis_password
REDIS_DB=0

# Redis connection security
REDIS_TLS_ENABLED=true
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=1000
```

---

## 🔒 Webhook Security

### Twilio Webhook Security
```bash
# Twilio credentials (REQUIRED)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Webhook signature verification (REQUIRED in production)
WEBHOOK_SIGNATURE_VERIFICATION=true
FORCE_TWILIO_VERIFY=true

# Webhook URL for Twilio callbacks (REQUIRED in production)
WEBHOOK_URL=https://your-domain.com/api/v1/whatsapp/webhook

# Webhook timeout settings
WEBHOOK_TIMEOUT=5000
WEBHOOK_MAX_PAYLOAD_SIZE=1048576
```

### Generic Webhook Security
```bash
# Generic webhook signature secret
WEBHOOK_SECRET_KEY=your_webhook_secret_key_for_other_services

# Webhook retry configuration
WEBHOOK_MAX_RETRIES=3
WEBHOOK_RETRY_DELAY=2000
WEBHOOK_RETRY_BACKOFF=exponential
```

---

## ⚡ Rate Limiting Configuration

### API Rate Limiting
```bash
# General API rate limiting
RATE_LIMIT_WINDOW_MS=900000          # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100          # Max requests per window
RATE_LIMIT_SKIP_SUCCESS=false        # Don't skip successful requests

# Authentication rate limiting (stricter)
AUTH_RATE_LIMIT_WINDOW_MS=900000     # 15 minutes
AUTH_RATE_LIMIT_MAX_REQUESTS=5       # Max auth attempts per window

# Admin dashboard rate limiting
ADMIN_RATE_LIMIT_WINDOW_MS=300000    # 5 minutes
ADMIN_RATE_LIMIT_MAX_REQUESTS=200    # Higher limit for admin operations

# Webhook rate limiting
WEBHOOK_RATE_LIMIT_WINDOW=60000      # 1 minute
WEBHOOK_RATE_LIMIT_MAX=100           # Max webhook requests per minute
WEBHOOK_RATE_LIMIT_SKIP_SUCCESS=true # Skip rate limiting for successful webhooks
```

### Advanced Rate Limiting
```bash
# Rate limiting storage backend
RATE_LIMIT_STORE=redis               # redis, memory, or database
RATE_LIMIT_PREFIX=rl:                # Redis key prefix

# Rate limiting headers
RATE_LIMIT_HEADERS=true              # Include rate limit headers in response
RATE_LIMIT_DRAFT_SPEC=true           # Use draft spec headers

# Skip rate limiting for certain IPs
RATE_LIMIT_SKIP_IPS=127.0.0.1,::1   # Comma-separated list
```

---

## 🛡️ Input Sanitization & Validation

### Input Sanitization
```bash
# Input sanitization settings
INPUT_SANITIZATION_ENABLED=true
INPUT_MAX_STRING_LENGTH=10000
INPUT_MAX_ARRAY_LENGTH=1000
INPUT_MAX_OBJECT_DEPTH=10

# XSS protection
XSS_PROTECTION_ENABLED=true
XSS_FILTER_MODE=strict               # strict, moderate, or permissive

# HTML sanitization
HTML_SANITIZATION_ENABLED=true
ALLOWED_HTML_TAGS=b,i,em,strong,p,br # Comma-separated allowed tags
```

### Validation Configuration
```bash
# Validation strict mode
VALIDATION_STRICT_MODE=true
VALIDATION_FAIL_FAST=true           # Stop on first validation error
VALIDATION_LOG_FAILURES=true       # Log validation failures

# Field-specific validation
EMAIL_VALIDATION_STRICT=true
PHONE_VALIDATION_STRICT=true
URL_VALIDATION_REQUIRE_HTTPS=true  # Require HTTPS URLs in production
```

---

## 🔐 Admin Authentication & 2FA

### Admin Authentication
```bash
# Admin session configuration
ADMIN_SESSION_TIMEOUT=3600000        # 1 hour in milliseconds
ADMIN_SESSION_ABSOLUTE_TIMEOUT=28800000 # 8 hours absolute timeout
ADMIN_CONCURRENT_SESSIONS=3          # Max concurrent sessions per admin

# Account lockout settings
ADMIN_MAX_LOGIN_ATTEMPTS=5
ADMIN_LOCKOUT_DURATION=1800000       # 30 minutes in milliseconds
ADMIN_LOCKOUT_INCREMENT=true         # Increase lockout time with repeated failures

# Password requirements
ADMIN_PASSWORD_MIN_LENGTH=12
ADMIN_PASSWORD_REQUIRE_UPPERCASE=true
ADMIN_PASSWORD_REQUIRE_LOWERCASE=true
ADMIN_PASSWORD_REQUIRE_NUMBERS=true
ADMIN_PASSWORD_REQUIRE_SYMBOLS=true
ADMIN_PASSWORD_HISTORY=5             # Remember last 5 passwords
```

### Two-Factor Authentication (2FA)
```bash
# 2FA configuration
TOTP_ENABLED=true
TOTP_ISSUER="WhatsApp Ordering System"
TOTP_WINDOW=2                        # Time window tolerance (30-second steps)
TOTP_STEP=30                         # Time step in seconds

# 2FA enforcement
REQUIRE_2FA_FOR_ADMINS=true
REQUIRE_2FA_FOR_CRITICAL_ACTIONS=true
TOTP_BACKUP_CODES_COUNT=10           # Number of backup codes to generate

# 2FA grace period for new users
TOTP_GRACE_PERIOD=86400000           # 24 hours to set up 2FA
```

---

## 🌐 IP Allowlist Configuration

### Admin IP Allowlist
```bash
# Enable IP allowlist for admin endpoints
ADMIN_IP_ALLOWLIST_ENABLED=true

# Comma-separated list of allowed IPs/CIDR ranges for admin access
ADMIN_ALLOWED_IPS=192.168.1.0/24,10.0.0.0/8,172.16.0.0/12,127.0.0.1

# Strict mode (reject all non-allowlisted IPs)
ADMIN_IP_STRICT_MODE=true

# Log IP allowlist violations
ADMIN_IP_LOG_VIOLATIONS=true
```

### Webhook IP Allowlist
```bash
# Enable IP allowlist for webhook endpoints
WEBHOOK_IP_ALLOWLIST_ENABLED=true

# Twilio IP ranges (update as needed)
WEBHOOK_ALLOWED_IPS=54.172.60.0/22,54.244.51.0/24,157.240.0.0/16,31.13.0.0/16,18.232.0.0/14,3.0.0.0/8

# Webhook IP strict mode
WEBHOOK_IP_STRICT_MODE=true
```

### General IP Configuration
```bash
# Trust proxy headers for IP detection
TRUST_PROXY=true
PROXY_TRUST_HOPS=1                   # Number of proxy hops to trust

# IP header priority (comma-separated, in order of preference)
IP_HEADERS=x-forwarded-for,x-real-ip,x-client-ip,cf-connecting-ip

# Geolocation blocking (optional)
BLOCK_COUNTRIES=CN,RU,KP             # ISO country codes to block
ALLOW_COUNTRIES_ONLY=false           # If true, only allow specific countries
ALLOWED_COUNTRIES=US,CA,GB,AU        # Allowed countries (if ALLOW_COUNTRIES_ONLY=true)
```

---

## 🛡️ SQL Injection Prevention

### SQL Injection Detection
```bash
# SQL injection prevention
SQL_INJECTION_PREVENTION_ENABLED=true
SQL_INJECTION_STRICT_MODE=true       # Block requests with SQL injection patterns
SQL_INJECTION_LOG_ONLY=false         # Set to true to only log, not block

# SQL injection detection sensitivity
SQL_INJECTION_SENSITIVITY=high       # low, medium, high
SQL_INJECTION_MAX_STRING_LENGTH=10000

# SQL injection response
SQL_INJECTION_BLOCK_RESPONSE=true
SQL_INJECTION_SANITIZE_INPUT=true    # Sanitize input if not in strict mode
```

### Database Query Security
```bash
# Parameterized query enforcement
REQUIRE_PARAMETERIZED_QUERIES=true
LOG_NON_PARAMETERIZED_QUERIES=true

# Query timeout settings
DATABASE_QUERY_TIMEOUT=30000         # 30 seconds
DATABASE_SLOW_QUERY_THRESHOLD=5000   # Log queries slower than 5 seconds

# Database connection security
DATABASE_SSL_MODE=require
DATABASE_SSL_CERT_PATH=/path/to/client-cert.pem
DATABASE_SSL_KEY_PATH=/path/to/client-key.pem
DATABASE_SSL_CA_PATH=/path/to/ca-cert.pem
```

---

## 🔒 Encryption & Secrets

### Encryption Configuration
```bash
# Application encryption key (for sensitive data at rest)
ENCRYPTION_KEY=your_32_character_encryption_key_here

# Encryption algorithm
ENCRYPTION_ALGORITHM=aes-256-gcm
ENCRYPTION_IV_LENGTH=16

# Password hashing
PASSWORD_HASH_ALGORITHM=bcrypt
PASSWORD_HASH_ROUNDS=12              # bcrypt rounds (10-15 recommended)

# Sensitive data encryption
ENCRYPT_PII=true                     # Encrypt personally identifiable information
ENCRYPT_FINANCIAL_DATA=true          # Encrypt financial data
```

### Secrets Management
```bash
# Secrets validation on startup
VALIDATE_SECRETS_ON_STARTUP=true
SECRETS_VALIDATION_STRICT=true       # Exit if critical secrets are missing/invalid

# Secret rotation
SECRET_ROTATION_ENABLED=true
SECRET_ROTATION_INTERVAL=2592000000  # 30 days in milliseconds
SECRET_ROTATION_WARNING_DAYS=7       # Warn N days before rotation needed

# External secrets management (optional)
USE_EXTERNAL_SECRETS=false
SECRETS_PROVIDER=aws-secrets-manager  # aws-secrets-manager, azure-key-vault, etc.
SECRETS_REGION=us-east-1
```

---

## 🔐 HTTPS & TLS Configuration

### HTTPS Settings
```bash
# Force HTTPS in production
FORCE_HTTPS=true
HTTPS_PORT=443
HTTP_REDIRECT_TO_HTTPS=true

# HSTS (HTTP Strict Transport Security)
HSTS_ENABLED=true
HSTS_MAX_AGE=31536000                # 1 year in seconds
HSTS_INCLUDE_SUBDOMAINS=true
HSTS_PRELOAD=true

# SSL/TLS certificate paths
SSL_CERT_PATH=/path/to/certificate.pem
SSL_KEY_PATH=/path/to/private-key.pem
SSL_CA_PATH=/path/to/ca-bundle.pem

# TLS configuration
TLS_MIN_VERSION=1.2
TLS_CIPHERS=ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384
TLS_PREFER_SERVER_CIPHERS=true
```

---

## 📊 Security Monitoring & Logging

### Security Logging
```bash
# Security event logging
SECURITY_LOGGING_ENABLED=true
SECURITY_LOG_LEVEL=info              # error, warn, info, debug
SECURITY_LOG_FORMAT=json

# Security log file configuration
SECURITY_LOG_FILE=logs/security.log
SECURITY_LOG_MAX_SIZE=100m
SECURITY_LOG_MAX_FILES=30
SECURITY_LOG_ROTATE_DAILY=true

# Audit logging
AUDIT_LOGGING_ENABLED=true
AUDIT_LOG_ALL_REQUESTS=false         # Log all requests (high volume)
AUDIT_LOG_ADMIN_ACTIONS=true         # Log all admin actions
AUDIT_LOG_SENSITIVE_DATA=false       # Don't log sensitive data
```

### Security Monitoring
```bash
# Real-time security monitoring
SECURITY_MONITORING_ENABLED=true
SECURITY_ALERT_THRESHOLD_HIGH=10     # High-severity events per minute
SECURITY_ALERT_THRESHOLD_MEDIUM=50   # Medium-severity events per minute

# Failed authentication monitoring
AUTH_FAILURE_THRESHOLD=20            # Failed auths per hour before alert
AUTH_FAILURE_IP_THRESHOLD=10         # Failed auths per IP per hour

# Suspicious activity detection
SUSPICIOUS_ACTIVITY_DETECTION=true
SUSPICIOUS_ACTIVITY_THRESHOLD=100    # Suspicious events per hour
```

---

## 🚨 Alerting Configuration

### Alert Channels
```bash
# Email alerts
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_FROM=security@yourcompany.com
ALERT_EMAIL_TO=admin@yourcompany.com,security-team@yourcompany.com
ALERT_EMAIL_SMTP_HOST=smtp.yourcompany.com
ALERT_EMAIL_SMTP_PORT=587
ALERT_EMAIL_SMTP_USER=alerts@yourcompany.com
ALERT_EMAIL_SMTP_PASS=your_smtp_password

# Slack alerts
ALERT_SLACK_ENABLED=true
ALERT_SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
ALERT_SLACK_CHANNEL=#security-alerts
ALERT_SLACK_USERNAME=SecurityBot

# Webhook alerts
ALERT_WEBHOOK_ENABLED=true
ALERT_WEBHOOK_URL=https://your-monitoring-system.com/webhook
ALERT_WEBHOOK_SECRET=your_webhook_secret

# PagerDuty integration
ALERT_PAGERDUTY_ENABLED=false
ALERT_PAGERDUTY_INTEGRATION_KEY=your_pagerduty_key
```

### Alert Thresholds
```bash
# Alert cooldown periods (prevent spam)
ALERT_COOLDOWN_CRITICAL=300000       # 5 minutes for critical alerts
ALERT_COOLDOWN_HIGH=900000           # 15 minutes for high alerts
ALERT_COOLDOWN_MEDIUM=3600000        # 1 hour for medium alerts

# Specific alert thresholds
ALERT_SQL_INJECTION_THRESHOLD=5      # SQL injection attempts per hour
ALERT_XSS_THRESHOLD=10               # XSS attempts per hour
ALERT_RATE_LIMIT_THRESHOLD=100       # Rate limit violations per hour
ALERT_AUTH_FAILURE_THRESHOLD=50      # Auth failures per hour
ALERT_PERMISSION_DENIED_THRESHOLD=100 # Permission denials per hour
```

---

## 🔧 Development vs Production

### Development Environment
```bash
# Development-specific overrides
NODE_ENV=development

# Relaxed security for development (DO NOT USE IN PRODUCTION)
FORCE_TWILIO_VERIFY=false
ADMIN_IP_ALLOWLIST_ENABLED=false
WEBHOOK_IP_ALLOWLIST_ENABLED=false
SQL_INJECTION_STRICT_MODE=false
VALIDATION_STRICT_MODE=false
RATE_LIMIT_ENABLED=false

# Development debugging
SECURITY_DEBUG_MODE=true
LOG_SECURITY_EVENTS=true
```

### Production Environment
```bash
# Production environment
NODE_ENV=production

# Strict security for production
FORCE_TWILIO_VERIFY=true
ADMIN_IP_ALLOWLIST_ENABLED=true
WEBHOOK_IP_ALLOWLIST_ENABLED=true
SQL_INJECTION_STRICT_MODE=true
VALIDATION_STRICT_MODE=true
RATE_LIMIT_ENABLED=true

# Production security
SECURITY_DEBUG_MODE=false
FORCE_HTTPS=true
HSTS_ENABLED=true
TRUST_PROXY=true

# Production monitoring
SECURITY_MONITORING_ENABLED=true
AUDIT_LOGGING_ENABLED=true
ALERT_EMAIL_ENABLED=true
```

---

## 📋 Environment Variables Checklist

### ✅ Required for Basic Security
- [ ] `JWT_SECRET` (32+ characters)
- [ ] `DATABASE_URL` (with SSL)
- [ ] `TWILIO_ACCOUNT_SID`
- [ ] `TWILIO_AUTH_TOKEN`
- [ ] `TWILIO_WHATSAPP_FROM`
- [ ] `WEBHOOK_SIGNATURE_VERIFICATION=true`

### ✅ Required for Production
- [ ] `WEBHOOK_URL` (HTTPS)
- [ ] `FORCE_TWILIO_VERIFY=true`
- [ ] `ADMIN_IP_ALLOWLIST_ENABLED=true`
- [ ] `ADMIN_ALLOWED_IPS` (configured)
- [ ] `WEBHOOK_ALLOWED_IPS` (Twilio IPs)
- [ ] `FORCE_HTTPS=true`
- [ ] `HSTS_ENABLED=true`

### ✅ Recommended for Enhanced Security
- [ ] `TOTP_ENABLED=true`
- [ ] `REQUIRE_2FA_FOR_ADMINS=true`
- [ ] `SQL_INJECTION_STRICT_MODE=true`
- [ ] `VALIDATION_STRICT_MODE=true`
- [ ] `SECURITY_MONITORING_ENABLED=true`
- [ ] `AUDIT_LOGGING_ENABLED=true`
- [ ] `ALERT_EMAIL_ENABLED=true`

---

## 🔐 Security Best Practices

### Secret Management
1. **Never commit secrets to version control**
2. **Use strong, randomly generated secrets**
3. **Rotate secrets regularly**
4. **Use different secrets for different environments**
5. **Store secrets in secure secret management systems**

### Environment Configuration
1. **Use `.env.example` for documentation**
2. **Validate all secrets on startup**
3. **Use strict mode in production**
4. **Enable comprehensive logging and monitoring**
5. **Regularly review and update security configurations**

### Monitoring & Alerting
1. **Monitor all security events**
2. **Set up real-time alerts for critical events**
3. **Regularly review security logs**
4. **Implement automated response to common attacks**
5. **Conduct regular security assessments**

---

**⚠️ Important Security Notes:**
- Always use HTTPS in production
- Keep all dependencies updated
- Regularly rotate secrets and certificates
- Monitor security logs continuously
- Conduct regular security audits
- Test security measures regularly
- Have an incident response plan ready