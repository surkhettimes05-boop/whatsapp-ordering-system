# Environment Variables Reference - Backend Code Usage Map

## Overview
Complete mapping of all environment variables used in production code with their locations and purposes.

---

## CORE APPLICATION

### NODE_ENV
- **Purpose**: Application environment (production/development/test)
- **Used in**:
  - [src/utils/transaction-guard.js](src/utils/transaction-guard.js#L12) - Disable transaction guard in test
  - [src/app.js](src/app.js#L99) - Error logging behavior
  - [src/app.js](src/app.js#L103) - Alert monitoring
  - [src/app.js](src/app.js#L129) - Redis configuration
  - [src/app.js](src/app.js#L163) - Server startup
  - [src/middleware/production.middleware.js](src/middleware/production.middleware.js#L7) - Security headers
  - [src/config/database.js](src/config/database.js#L1) - Test mode detection
  - [src/services/whatsapp.service.js](src/services/whatsapp.service.js#L36) - Queue usage
  - [src/config/observability.config.js](src/config/observability.config.js#L14) - Log format selection

### PORT
- **Purpose**: Server listening port
- **Default**: 5000
- **Used in**: [src/app.js](src/app.js#L160) - Server startup

### APP_VERSION
- **Purpose**: Application version display
- **Used in**: [src/controllers/health.controller.js](src/controllers/health.controller.js#L66) - Health check endpoint

---

## DATABASE

### DATABASE_URL
- **Purpose**: PostgreSQL connection string
- **Format**: `postgresql://user:password@host:5432/db?sslmode=require`
- **Used in**: 
  - [prisma/schema.prisma](prisma/schema.prisma) - Prisma datasource
  - [src/config/database.js](src/config/database.js#L343) - Production connection setup

---

## REDIS (Job Queue & Caching)

### REDIS_URL
- **Purpose**: Full Redis connection string (for managed services)
- **Priority**: Used if available, overrides individual components
- **Used in**: [src/queue/queue.js](src/queue/queue.js#L24-L25) - Primary connection method

### REDIS_HOST
- **Purpose**: Redis server hostname
- **Default**: localhost
- **Used in**: 
  - [src/queue/queue.js](src/queue/queue.js#L28)
  - [src/queue/queue.config.js](src/queue/queue.config.js#L12)

### REDIS_PORT
- **Purpose**: Redis server port
- **Default**: 6379
- **Used in**: 
  - [src/queue/queue.js](src/queue/queue.js#L29)
  - [src/queue/queue.config.js](src/queue/queue.config.js#L13)

### REDIS_PASSWORD
- **Purpose**: Redis authentication password
- **Used in**: 
  - [src/queue/queue.js](src/queue/queue.js#L30)
  - [src/queue/queue.config.js](src/queue/queue.config.js#L14)

---

## AUTHENTICATION & SECURITY

### JWT_SECRET
- **Purpose**: Secret key for JWT token signing/verification
- **Requirement**: Strong random string (32+ characters)
- **Used in**: 
  - [src/services/auth.service.js](src/services/auth.service.js#L12) - Token signing
  - [src/middleware/auth.middleware.js](src/middleware/auth.middleware.js#L13) - Token verification

### DISABLE_TRANSACTION_GUARD
- **Purpose**: Disable database transaction safety checks
- **Default**: false (enabled)
- **Used in**: [src/utils/transaction-guard.js](src/utils/transaction-guard.js#L11) - Transaction validation

---

## TWILIO (WhatsApp Integration)

### TWILIO_ACCOUNT_SID
- **Purpose**: Twilio account identifier
- **Get from**: https://www.twilio.com/console
- **Used in**: [src/services/whatsapp.service.js](src/services/whatsapp.service.js#L12)

### TWILIO_AUTH_TOKEN
- **Purpose**: Twilio authentication token
- **Security**: Keep secret
- **Used in**: 
  - [src/services/whatsapp.service.js](src/services/whatsapp.service.js#L13)
  - [src/middleware/production.middleware.js](src/middleware/production.middleware.js#L58) - Webhook signature verification

### TWILIO_WHATSAPP_FROM
- **Purpose**: WhatsApp number sender (Twilio format)
- **Format**: `whatsapp:+1234567890`
- **Used in**: [src/services/whatsapp.service.js](src/services/whatsapp.service.js#L14)

### WHATSAPP_PHONE_NUMBER
- **Purpose**: Fallback WhatsApp number (if TWILIO_WHATSAPP_FROM not set)
- **Used in**: [src/services/whatsapp.service.js](src/services/whatsapp.service.js#L14)

### WEBHOOK_URL
- **Purpose**: Public webhook URL for Twilio callbacks
- **Format**: `https://domain.com/api/v1/whatsapp/webhook`
- **Used in**: [src/middleware/production.middleware.js](src/middleware/production.middleware.js#L57) - Signature verification

### FORCE_TWILIO_VERIFY
- **Purpose**: Force Twilio signature verification (enable in production)
- **Used in**: [src/middleware/production.middleware.js](src/middleware/production.middleware.js#L49) - Webhook validation

---

## SECURITY CONFIGURATION

### WEBHOOK_IP_ALLOWLIST_ENABLED
- **Purpose**: Enable IP-based webhook filtering
- **Used in**: [src/config/security.config.js](src/config/security.config.js#L80)

### WEBHOOK_ALLOWED_IPS
- **Purpose**: Comma-separated IP addresses/CIDR blocks allowed for webhooks
- **Example**: `54.172.60.0/22,54.244.51.0/24`
- **Used in**: [src/config/security.config.js](src/config/security.config.js#L83-L84)

### WEBHOOK_STRICT_MODE
- **Purpose**: Reject requests from non-allowlisted IPs
- **Used in**: [src/config/security.config.js](src/config/security.config.js#L133)

### VALIDATION_STRICT_MODE
- **Purpose**: Enforce strict request validation
- **Used in**: [src/config/security.config.js](src/config/security.config.js#L149)

### CORS_ORIGIN
- **Purpose**: Comma-separated list of allowed frontend domains
- **Example**: `https://frontend.com,https://admin.frontend.com`
- **Used in**: [src/config/security.config.js](src/config/security.config.js#L159)

---

## EMAIL NOTIFICATIONS

### SMTP_HOST
- **Purpose**: Email server hostname
- **Default**: smtp.gmail.com
- **Used in**: [src/services/email.service.js](src/services/email.service.js#L6)

### SMTP_PORT
- **Purpose**: Email server port
- **Default**: 587
- **Used in**: [src/services/email.service.js](src/services/email.service.js#L7)

### SMTP_SECURE
- **Purpose**: Use TLS for email connection
- **Used in**: [src/services/email.service.js](src/services/email.service.js#L8)

### SMTP_USER
- **Purpose**: Email account username
- **Used in**: [src/services/email.service.js](src/services/email.service.js#L10) & [L19]

### SMTP_PASS
- **Purpose**: Email account password or app password
- **Used in**: [src/services/email.service.js](src/services/email.service.js#L11)

### ADMIN_EMAIL
- **Purpose**: Primary admin email for alerts
- **Used in**: [src/services/email.service.js](src/services/email.service.js#L19)

### BUSINESS_NAME
- **Purpose**: Company name for email signatures
- **Default**: 'WhatsApp Store'
- **Used in**: [src/services/email.service.js](src/services/email.service.js#L19) & [L59]

---

## AI & VISION

### OPENAI_API_KEY
- **Purpose**: OpenAI API key for AI features
- **Get from**: https://platform.openai.com/account/api-keys
- **Used in**: [src/services/vision.service.js](src/services/vision.service.js#L7)

### OPENAI_MODEL
- **Purpose**: OpenAI model to use
- **Default**: gpt-4
- **Used in**: Vision service configuration

---

## LOGGING & OBSERVABILITY

### LOG_LEVEL
- **Purpose**: Logging verbosity level
- **Values**: error, warn, info, debug, trace
- **Default**: info
- **Used in**: [src/config/observability.config.js](src/config/observability.config.js#L11)

### LOG_FORMAT
- **Purpose**: Log output format
- **Values**: pretty (development) | json (production)
- **Used in**: [src/config/observability.config.js](src/config/observability.config.js#L14)

### LOG_FILE_PATH
- **Purpose**: Directory for log files
- **Used in**: [src/config/logger.js](src/config/logger.js#L103)

### TRACING_ENABLED
- **Purpose**: Enable distributed tracing
- **Default**: true
- **Used in**: [src/config/observability.config.js](src/config/observability.config.js#L44)

### TRACE_SAMPLING_RATE
- **Purpose**: Percentage of traces to capture (0-1)
- **Default**: 1.0 (100%)
- **Used in**: [src/config/observability.config.js](src/config/observability.config.js#L53)

### TRACE_INCLUDE_BODIES
- **Purpose**: Include request/response bodies in traces
- **Used in**: [src/config/observability.config.js](src/config/observability.config.js#L56)

### METRICS_ENABLED
- **Purpose**: Enable metrics collection
- **Default**: true
- **Used in**: [src/config/observability.config.js](src/config/observability.config.js#L62)

---

## ALERTING & MONITORING

### ALERTING_ENABLED
- **Purpose**: Enable automated alerting system
- **Used in**: [src/config/observability.config.js](src/config/observability.config.js#L80)

### ALERT_ERROR_RATE
- **Purpose**: Error rate threshold (%) for alerts
- **Default**: 10%
- **Used in**: [src/config/observability.config.js](src/config/observability.config.js#L85)

### ALERT_RESPONSE_TIME_P95
- **Purpose**: P95 response time threshold (ms)
- **Default**: 5000ms
- **Used in**: [src/config/observability.config.js](src/config/observability.config.js#L88)

### ALERT_CREDIT_FAILURE_RATE
- **Purpose**: Credit check failure rate threshold (%)
- **Default**: 5%
- **Used in**: [src/config/observability.config.js](src/config/observability.config.js#L91)

### ALERT_VENDOR_RESPONSE_TIME
- **Purpose**: Vendor response time threshold (ms)
- **Default**: 10000ms
- **Used in**: [src/config/observability.config.js](src/config/observability.config.js#L94)

### ALERT_ORDER_LIFECYCLE_TIME
- **Purpose**: Order lifecycle duration threshold (ms)
- **Default**: 300000ms (5 minutes)
- **Used in**: [src/config/observability.config.js](src/config/observability.config.js#L97)

### ALERT_WEBHOOK_URL
- **Purpose**: Generic webhook for alert notifications
- **Used in**: [src/config/observability.config.js](src/config/observability.config.js#L103)

### ALERT_EMAIL
- **Purpose**: Email address for alert notifications
- **Used in**: [src/config/observability.config.js](src/config/observability.config.js#L106)

### ALERT_SLACK_WEBHOOK
- **Purpose**: Slack webhook for alert notifications
- **Get from**: Slack App integration settings
- **Used in**: [src/config/observability.config.js](src/config/observability.config.js#L109)

### ALERT_PAGERDUTY_KEY
- **Purpose**: PagerDuty integration key for alerts
- **Used in**: [src/config/observability.config.js](src/config/observability.config.js#L112)

### ALERT_COOLDOWN
- **Purpose**: Minimum time between duplicate alerts (ms)
- **Default**: 300000ms (5 minutes)
- **Used in**: [src/config/observability.config.js](src/config/observability.config.js#L116)

---

## RATE LIMITING

### RATE_LIMIT_WINDOW_MS
- **Purpose**: Time window for rate limit calculation (ms)
- **Default**: 900000ms (15 minutes)

### RATE_LIMIT_MAX_REQUESTS
- **Purpose**: Maximum requests allowed per window
- **Default**: 100

---

## FEATURE FLAGS

### ENABLE_BIDDING
- **Purpose**: Enable bidding system
- **Used in**: Feature flag checks

### ENABLE_CREDIT_SYSTEM
- **Purpose**: Enable credit system
- **Used in**: Feature flag checks

### ENABLE_AUTO_RECOVERY
- **Purpose**: Enable automatic error recovery
- **Used in**: Feature flag checks

### ENABLE_DAILY_REPORTS
- **Purpose**: Enable daily report generation
- **Used in**: Feature flag checks

---

## DEVELOPMENT/TESTING ONLY

### USE_MOCK_TWILIO
- **Purpose**: Use mock Twilio in development
- **Never use**: In production
- **Used in**: Test environments

### AUTO_SEED
- **Purpose**: Automatically seed database on startup
- **Never use**: In production
- **Used in**: Development setup

### ADMIN_PHONE
- **Purpose**: Initial admin phone number (for first setup)
- **Warning**: Change immediately after initial setup
- **Used in**: Database seeding

### ADMIN_PASSWORD
- **Purpose**: Initial admin password (for first setup)
- **Warning**: Change immediately after initial setup
- **Used in**: Database seeding

---

## Production Setup Checklist

- [x] NODE_ENV=production
- [x] DATABASE_URL with SSL mode enabled
- [x] REDIS_URL or Redis credentials
- [x] Strong JWT_SECRET (32+ characters)
- [x] TWILIO credentials and WEBHOOK_URL
- [x] FORCE_TWILIO_VERIFY=true
- [x] WEBHOOK_IP_ALLOWLIST_ENABLED=true
- [x] WEBHOOK_ALLOWED_IPS configured with Twilio ranges
- [x] WEBHOOK_STRICT_MODE=true
- [x] CORS_ORIGIN set to production frontend domain
- [x] SMTP configuration for email
- [x] Alerting configured (at least ALERT_EMAIL or ALERT_SLACK_WEBHOOK)
- [x] LOG_LEVEL=info (not debug)
- [x] LOG_FORMAT=json
- [x] OPENAI_API_KEY if using AI features
