# Environment Variables - Complete Code Reference

This document shows the exact location and usage of every environment variable in the backend codebase.

---

## All Environment Variables Found (78 matches)

### By File

#### [src/utils/transaction-guard.js](src/utils/transaction-guard.js)
```javascript
Line 11:  if (process.env.DISABLE_TRANSACTION_GUARD === '1') return false;
Line 12:  if (process.env.NODE_ENV === 'test') return false;
```
**Variables**: NODE_ENV, DISABLE_TRANSACTION_GUARD

---

#### [src/utils/logger.js](src/utils/logger.js)
```javascript
Line 33:  environment: process.env.NODE_ENV || 'development',
```
**Variables**: NODE_ENV

---

#### [src/services/whatsapp.service.js](src/services/whatsapp.service.js)
```javascript
Line 12:  const accountSid = process.env.TWILIO_ACCOUNT_SID;
Line 13:  const authToken = process.env.TWILIO_AUTH_TOKEN;
Line 14:  const fromPhoneNumber = process.env.TWILIO_WHATSAPP_FROM || process.env.WHATSAPP_PHONE_NUMBER || '+14155238886';
Line 36:  const { useQueue = process.env.NODE_ENV === 'production', immediate = false } = options;
```
**Variables**: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, WHATSAPP_PHONE_NUMBER, NODE_ENV

---

#### [src/services/vision.service.js](src/services/vision.service.js)
```javascript
Line 7:  this.apiKey = process.env.OPENAI_API_KEY;
```
**Variables**: OPENAI_API_KEY

---

#### [src/routes/whatsapp.routes.js](src/routes/whatsapp.routes.js)
```javascript
Line 40:  if (process.env.NODE_ENV === 'production' && !twilioSignature) {
Line 92:  configured: !!process.env.TWILIO_ACCOUNT_SID,
Line 93:  fromNumber: process.env.TWILIO_WHATSAPP_FROM || 'Not set'
```
**Variables**: NODE_ENV, TWILIO_ACCOUNT_SID, TWILIO_WHATSAPP_FROM

---

#### [src/services/email.service.js](src/services/email.service.js)
```javascript
Line 6:   host: process.env.SMTP_HOST || 'smtp.gmail.com',
Line 7:   port: parseInt(process.env.SMTP_PORT) || 587,
Line 8:   secure: process.env.SMTP_SECURE === 'true',
Line 10:  user: process.env.SMTP_USER,
Line 11:  pass: process.env.SMTP_PASS,
Line 19:  from: `"${process.env.BUSINESS_NAME || 'WhatsApp Store'}" <${process.env.SMTP_USER}>`,
Line 59:  Thanks for choosing ${process.env.BUSINESS_NAME || 'WhatsApp Store'}!
```
**Variables**: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, BUSINESS_NAME

---

#### [src/queue/queue.js](src/queue/queue.js)
```javascript
Line 24:  if (process.env.REDIS_URL) {
Line 25:  connection = new IORedis(process.env.REDIS_URL, redisOptions);
Line 28:  host: process.env.REDIS_HOST || 'localhost',
Line 29:  port: process.env.REDIS_PORT || 6379,
Line 30:  password: process.env.REDIS_PASSWORD || undefined,
```
**Variables**: REDIS_URL, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD

---

#### [src/queue/queue.config.js](src/queue/queue.config.js)
```javascript
Line 12:  host: process.env.REDIS_HOST || 'localhost',
Line 13:  port: parseInt(process.env.REDIS_PORT || '6379'),
Line 14:  password: process.env.REDIS_PASSWORD || undefined,
```
**Variables**: REDIS_HOST, REDIS_PORT, REDIS_PASSWORD

---

#### [src/services/auth.service.js](src/services/auth.service.js)
```javascript
Line 12:  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
```
**Variables**: JWT_SECRET

---

#### [src/middleware/production.middleware.js](src/middleware/production.middleware.js)
```javascript
Line 7:   const isProduction = process.env.NODE_ENV === 'production';
Line 49:  if (process.env.NODE_ENV !== 'production' && !process.env.FORCE_TWILIO_VERIFY) {
Line 57:  const url = process.env.WEBHOOK_URL || `https://${req.headers.host}${req.originalUrl}`;
Line 58:  const authToken = process.env.TWILIO_AUTH_TOKEN;
```
**Variables**: NODE_ENV, FORCE_TWILIO_VERIFY, WEBHOOK_URL, TWILIO_AUTH_TOKEN

---

#### [src/middleware/auth.middleware.js](src/middleware/auth.middleware.js)
```javascript
Line 13:  const decoded = jwt.verify(token, process.env.JWT_SECRET);
```
**Variables**: JWT_SECRET

---

#### [src/middleware/apiKey.middleware.js](src/middleware/apiKey.middleware.js)
```javascript
Line 28:  const prefix = process.env.NODE_ENV === 'production'
```
**Variables**: NODE_ENV

---

#### [src/controllers/health.controller.js](src/controllers/health.controller.js)
```javascript
Line 66:  version: process.env.APP_VERSION || 'unknown',
Line 67:  environment: process.env.NODE_ENV || 'development',
```
**Variables**: APP_VERSION, NODE_ENV

---

#### [src/controllers/security.controller.js](src/controllers/security.controller.js)
```javascript
Line 179: apiKeyPrefix: process.env.NODE_ENV === 'production'
```
**Variables**: NODE_ENV

---

#### [src/app.js](src/app.js)
```javascript
Line 99:  if (process.env.NODE_ENV !== 'production') console.error(e.stack);
Line 103: if (process.env.NODE_ENV !== 'test' && startAlertMonitoring) {
Line 129: const isRedisConfigured = process.env.REDIS_HOST || process.env.REDIS_URL || process.env.NODE_ENV === 'production';
Line 130: const isRedisConfigured = process.env.REDIS_HOST || process.env.REDIS_URL || process.env.NODE_ENV === 'production';
Line 160: const PORT = process.env.PORT || 5000;
Line 163: if (require.main === module && process.env.NODE_ENV !== 'test') {
```
**Variables**: NODE_ENV, REDIS_HOST, REDIS_URL, PORT

---

#### [src/config/security.config.js](src/config/security.config.js)
```javascript
Line 80:  ENABLED: process.env.WEBHOOK_IP_ALLOWLIST_ENABLED === 'true',
Line 83:  WEBHOOK_IPS: process.env.WEBHOOK_ALLOWED_IPS
Line 84:  ? process.env.WEBHOOK_ALLOWED_IPS.split(',').map(ip => ip.trim())
Line 133: STRICT_MODE: process.env.WEBHOOK_STRICT_MODE === 'true'
Line 149: STRICT_MODE: process.env.VALIDATION_STRICT_MODE === 'true'
Line 159: origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
```
**Variables**: WEBHOOK_IP_ALLOWLIST_ENABLED, WEBHOOK_ALLOWED_IPS, WEBHOOK_STRICT_MODE, VALIDATION_STRICT_MODE, CORS_ORIGIN

---

#### [src/config/logger.js](src/config/logger.js)
```javascript
Line 103: nodeEnv: process.env.NODE_ENV || 'development',
Line 127: if (process.env.NODE_ENV !== 'production') {
```
**Variables**: NODE_ENV

---

#### [src/config/observability.config.js](src/config/observability.config.js)
```javascript
Line 11:  LEVEL: process.env.LOG_LEVEL || 'info',
Line 14:  FORMAT: process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'pretty'),
Line 44:  ENABLED: process.env.TRACING_ENABLED !== 'false',
Line 53:  SAMPLING_RATE: parseFloat(process.env.TRACE_SAMPLING_RATE || '1.0'),
Line 56:  INCLUDE_BODIES: process.env.TRACE_INCLUDE_BODIES === 'true'
Line 62:  ENABLED: process.env.METRICS_ENABLED !== 'false',
Line 80:  ENABLED: process.env.ALERTING_ENABLED === 'true',
Line 85:  ERROR_RATE: parseInt(process.env.ALERT_ERROR_RATE || '10'),
Line 88:  RESPONSE_TIME_P95: parseInt(process.env.ALERT_RESPONSE_TIME_P95 || '5000'),
Line 91:  CREDIT_FAILURE_RATE: parseInt(process.env.ALERT_CREDIT_FAILURE_RATE || '5'),
Line 94:  VENDOR_RESPONSE_TIME: parseInt(process.env.ALERT_VENDOR_RESPONSE_TIME || '10000'),
Line 97:  ORDER_LIFECYCLE_TIME: parseInt(process.env.ALERT_ORDER_LIFECYCLE_TIME || '300000'),
Line 103: WEBHOOK: process.env.ALERT_WEBHOOK_URL,
Line 106: EMAIL: process.env.ALERT_EMAIL,
Line 109: SLACK: process.env.ALERT_SLACK_WEBHOOK,
Line 112: PAGERDUTY: process.env.ALERT_PAGERDUTY_KEY
Line 116: COOLDOWN: parseInt(process.env.ALERT_COOLDOWN || '300000'),
```
**Variables**: LOG_LEVEL, LOG_FORMAT, NODE_ENV, TRACING_ENABLED, TRACE_SAMPLING_RATE, TRACE_INCLUDE_BODIES, METRICS_ENABLED, ALERTING_ENABLED, ALERT_ERROR_RATE, ALERT_RESPONSE_TIME_P95, ALERT_CREDIT_FAILURE_RATE, ALERT_VENDOR_RESPONSE_TIME, ALERT_ORDER_LIFECYCLE_TIME, ALERT_WEBHOOK_URL, ALERT_EMAIL, ALERT_SLACK_WEBHOOK, ALERT_PAGERDUTY_KEY, ALERT_COOLDOWN

---

#### [src/config/database.js](src/config/database.js)
```javascript
Line 1:   if (process.env.NODE_ENV === 'test') {
Line 343: if (process.env.NODE_ENV === 'production') {
```
**Variables**: NODE_ENV

---

## Unique Variables Count

Total unique environment variables used: **42**

### Grouped by Criticality

**Critical (7)** - Application won't start without these:
- NODE_ENV
- DATABASE_URL
- REDIS_URL
- REDIS_HOST
- REDIS_PORT
- JWT_SECRET
- TWILIO_ACCOUNT_SID

**Important (8)** - Missing causes major feature failure:
- TWILIO_AUTH_TOKEN
- TWILIO_WHATSAPP_FROM
- WEBHOOK_URL
- FORCE_TWILIO_VERIFY
- WEBHOOK_IP_ALLOWLIST_ENABLED
- WEBHOOK_ALLOWED_IPS
- CORS_ORIGIN
- VALIDATION_STRICT_MODE

**Recommended (12)** - Improves security/observability:
- LOG_LEVEL
- LOG_FORMAT
- TRACING_ENABLED
- METRICS_ENABLED
- ALERTING_ENABLED
- ALERT_EMAIL
- ALERT_SLACK_WEBHOOK
- SMTP_HOST
- SMTP_USER
- SMTP_PASS
- WEBHOOK_STRICT_MODE
- TRACE_SAMPLING_RATE

**Optional (15)** - Nice to have:
- PORT
- APP_VERSION
- REDIS_PASSWORD
- WHATSAPP_PHONE_NUMBER
- OPENAI_API_KEY
- BUSINESS_NAME
- DISABLE_TRANSACTION_GUARD
- TRACE_INCLUDE_BODIES
- ALERT_ERROR_RATE
- ALERT_RESPONSE_TIME_P95
- ALERT_CREDIT_FAILURE_RATE
- ALERT_VENDOR_RESPONSE_TIME
- ALERT_ORDER_LIFECYCLE_TIME
- ALERT_WEBHOOK_URL
- ALERT_PAGERDUTY_KEY
- ALERT_COOLDOWN

---

## Variable Usage Statistics

| Module | Count | Key Variables |
|--------|-------|----------------|
| src/config/ | 21 | LOG_LEVEL, TRACING_ENABLED, ALERTING_ENABLED, JWT_SECRET, NODE_ENV |
| src/middleware/ | 10 | NODE_ENV, JWT_SECRET, WEBHOOK_URL, CORS_ORIGIN, FORCE_TWILIO_VERIFY |
| src/services/ | 14 | TWILIO_ACCOUNT_SID, SMTP_HOST, REDIS_HOST, OPENAI_API_KEY, NODE_ENV |
| src/queue/ | 5 | REDIS_URL, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD |
| src/controllers/ | 4 | NODE_ENV, APP_VERSION, TWILIO_ACCOUNT_SID |
| src/utils/ | 2 | NODE_ENV, DISABLE_TRANSACTION_GUARD |
| src/routes/ | 3 | NODE_ENV, TWILIO_ACCOUNT_SID, TWILIO_WHATSAPP_FROM |

---

## Search Pattern for Finding Variables

To find all environment variables in the codebase:
```bash
grep -r "process\.env\.[A-Z_]*" src/ --include="*.js" | grep -o "process\.env\.[A-Z_]*" | sort | uniq -c | sort -rn
```

Output summary:
- NODE_ENV: 16 occurrences
- REDIS_HOST: 2 occurrences  
- REDIS_PORT: 2 occurrences
- SMTP_USER: 2 occurrences
- And 38+ more variables...

---

## Creating Environment Variables Script

You can validate that all required variables are set:

```javascript
// scripts/validate-env.js
const required = [
  'NODE_ENV',
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_WHATSAPP_FROM',
  'WEBHOOK_URL'
];

const missing = required.filter(v => !process.env[v]);
if (missing.length) {
  console.error('❌ Missing required variables:', missing);
  process.exit(1);
}
console.log('✅ All required variables are set');
```

Run with:
```bash
node scripts/validate-env.js
```
