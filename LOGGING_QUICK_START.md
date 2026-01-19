# Production Logging System - Quick Links & Navigation

## 🎯 Start Here

**New to the logging system?** Start with one of these:

### ⚡ Super Quick (5 minutes)
👉 [LOGGING_QUICK_REFERENCE.md](../LOGGING_QUICK_REFERENCE.md)
- One-page cheat sheet
- Copy-paste examples
- Common commands

### 🚀 Quick Start (15 minutes)  
👉 [PRODUCTION_LOGGING_GUIDE.md](./PRODUCTION_LOGGING_GUIDE.md)
- Complete usage guide
- All features explained
- Examples for each category

### 📖 Full Integration (30 minutes)
👉 [LOGGING_IMPLEMENTATION.md](./LOGGING_IMPLEMENTATION.md)
- Step-by-step integration
- Service examples
- Deployment checklist

---

## 📚 Documentation

| File | Purpose | Best For |
|------|---------|----------|
| [LOGGING_QUICK_REFERENCE.md](../LOGGING_QUICK_REFERENCE.md) | One-page reference | Quick lookup |
| [PRODUCTION_LOGGING_GUIDE.md](./PRODUCTION_LOGGING_GUIDE.md) | Complete guide | Learning & examples |
| [LOGGING_IMPLEMENTATION.md](./LOGGING_IMPLEMENTATION.md) | Integration guide | Implementation |
| [LOGGING_SYSTEM_SUMMARY.md](../LOGGING_SYSTEM_SUMMARY.md) | Executive summary | Overview & status |
| [LOGGING_COMPLETE.md](../LOGGING_COMPLETE.md) | Final summary | Completion status |

---

## 💻 Code Files

| File | Purpose |
|------|---------|
| `src/config/winston-logger.js` | Main implementation (400 lines) |
| `test-logger-simple.js` | Quick test |
| `test-production-logging.js` | Comprehensive test |
| `LOGGER_MIGRATION_BRIDGE.js` | Optional backward-compatibility wrapper |

---

## 🚀 Getting Started

### 1. Update your imports (1-2 minutes)
```javascript
// In app.js
const { requestLogger } = require('./config/winston-logger');

// In your services
const { logger } = require('../config/winston-logger');
```

### 2. Start logging (immediately)
```javascript
// General
logger.info('Application event', { userId: '123' });

// Orders
logger.orders.info('Order created', { orderId: 'ORD-001', total: 2500 });

// Credit
logger.credit.info('Credit deducted', { userId: 'USER-001', amount: 500 });

// Webhooks
logger.webhooks.info('Webhook received', { webhookId: 'WH-001' });

// Errors
logger.errors.error('Error occurred', { error: 'timeout' });
```

### 3. Deploy and monitor
```bash
# Development
npm run dev

# Production
export NODE_ENV=production
node src/app.js

# Monitor logs
tail -f logs/app.log-$(date +%Y-%m-%d).log
```

---

## 🔍 Log File Structure

```
/backend/logs/
├── app.log-2024-01-15.log              (General logs, 14 days)
├── orders.log-2024-01-15.log           (Orders, 14 days)
├── errors-orders.log-2024-01-15.log    (Order errors, 30 days)
├── credit.log-2024-01-15.log           (Credit, 14 days)
├── errors-credit.log-2024-01-15.log    (Credit errors, 30 days)
├── webhooks.log-2024-01-15.log         (Webhooks, 14 days)
├── errors-webhooks.log-2024-01-15.log  (Webhook errors, 30 days)
└── errors.log-2024-01-15.log           (All errors, 30 days)
```

**Rotation**: Daily (new files each day)
**Format**: JSON
**Retention**: 14-30 days (auto-cleanup)

---

## 📋 Features

✅ **Winston-based** - Production-grade, battle-tested
✅ **Daily rotation** - Automatic date-based filenames
✅ **5 categories** - app, orders, credit, webhooks, errors
✅ **Sensitive data** - 12 fields automatically redacted
✅ **Structured JSON** - Easy to parse
✅ **Auto cleanup** - Respects retention policies
✅ **Async writes** - Non-blocking, optimized
✅ **Dev & prod** - Console in dev, files only in prod

---

## 🧪 Testing

```bash
# Quick test (loads logger)
node test-logger-simple.js

# Comprehensive test (10 tests)
node test-production-logging.js

# Check logs created
ls -lh logs/
```

---

## 🔐 Security

**Automatically Redacted (12 fields):**
- Passwords & hashes
- Tokens (access, JWT, bearer, etc)
- API keys & secrets
- Credit card numbers
- Email, phone, SSN
- Account numbers

**Example:**
```javascript
logger.info('Login', {
  email: 'user@example.com',    // → [REDACTED]
  password: 'secret',            // → [REDACTED]
  token: 'eyJhbGci...'          // → [REDACTED]
});
```

---

## 📊 Monitoring

### View logs in real-time
```bash
tail -f logs/app.log-$(date +%Y-%m-%d).log
tail -f logs/orders.log-$(date +%Y-%m-%d).log
tail -f logs/errors.log-$(date +%Y-%m-%d).log
```

### Search logs
```bash
grep "ERROR" logs/orders.log-*
grep "ORDER-001" logs/orders.log-*
grep "USER-789" logs/credit.log-*
```

### Parse JSON
```bash
cat logs/app.log-* | jq '.message, .level'
cat logs/orders.log-* | jq 'select(.level=="ERROR")'
```

### Check disk usage
```bash
du -sh logs/
du -sh logs/orders.log*
```

---

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| Logs not created | Check `/logs` dir exists, is writable |
| Sensitive data visible | Add to SENSITIVE_FIELDS in winston-logger.js |
| No daily rotation | Verify system date/time, restart app |
| Disk growing fast | Check sizes: `du -sh logs/*`, run cleanup |
| Import errors | Verify winston-logger.js deployed |

---

## ⚙️ Configuration

### Log Retention (customize in winston-logger.js)
```javascript
const FILE_RETENTION = {
  'errors': 30 * 24 * 60 * 60 * 1000,  // 30 days
  'default': 14 * 24 * 60 * 60 * 1000   // 14 days
};
```

### Max File Size
```javascript
maxsize: 10485760  // 10MB (change as needed)
```

---

## 📞 Quick Help

**How to log orders?**
```javascript
logger.orders.info('Order created', { orderId, customerId, total });
```

**How to log credit?**
```javascript
logger.credit.info('Credit deducted', { userId, amount, reason });
```

**How to log webhooks?**
```javascript
logger.webhooks.info('Webhook received', { webhookId, event });
```

**How to log errors?**
```javascript
logger.errors.error('Error occurred', { error, context });
```

---

## ✅ Checklist

- [ ] Read LOGGING_QUICK_REFERENCE.md
- [ ] Update app.js imports
- [ ] Update service files
- [ ] Test locally: `npm run dev`
- [ ] Run verification: `node test-logger-simple.js`
- [ ] Deploy to production
- [ ] Set NODE_ENV=production
- [ ] Verify logs in /logs/ directory
- [ ] Monitor for 24 hours (verify daily rotation)

---

## 🎓 Examples

### Order Service
```javascript
const { logger } = require('../config/winston-logger');

async createOrder(data) {
  logger.orders.info('Creating order', { customerId: data.customerId });
  try {
    const order = await Order.create(data);
    logger.orders.info('Order created', { orderId: order.id });
    return order;
  } catch (error) {
    logger.orders.error('Order creation failed', { error: error.message });
    throw error;
  }
}
```

### Credit Service
```javascript
const { logger } = require('../config/winston-logger');

async deductCredit(userId, amount) {
  logger.credit.info('Deducting credit', { userId, amount });
  try {
    const result = await deductFromBalance(userId, amount);
    logger.credit.info('Credit deducted', { userId, newBalance: result });
    return result;
  } catch (error) {
    logger.credit.error('Deduction failed', { userId, error: error.message });
    throw error;
  }
}
```

---

## 📚 Full Documentation

For complete details, see:
- [PRODUCTION_LOGGING_GUIDE.md](./PRODUCTION_LOGGING_GUIDE.md) - 600+ lines
- [LOGGING_IMPLEMENTATION.md](./LOGGING_IMPLEMENTATION.md) - 500+ lines
- [LOGGING_SYSTEM_SUMMARY.md](../LOGGING_SYSTEM_SUMMARY.md) - 400+ lines

---

## ✨ You're Ready!

**Next Step**: Open [LOGGING_QUICK_REFERENCE.md](../LOGGING_QUICK_REFERENCE.md) and start integrating!

Questions? Check the specific guide:
- **"How do I use X?"** → PRODUCTION_LOGGING_GUIDE.md
- **"How do I integrate?"** → LOGGING_IMPLEMENTATION.md
- **"Show me examples"** → LOGGING_COMPLETE.md
- **"Quick reference"** → LOGGING_QUICK_REFERENCE.md

---

**Production Logging System: ✅ COMPLETE & READY**
