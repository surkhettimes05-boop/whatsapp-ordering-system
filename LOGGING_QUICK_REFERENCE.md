# Production Logging System - Quick Reference Card

## 🚀 One-Minute Setup

```javascript
// 1. Import logger in your file
const { logger } = require('../config/winston-logger');

// 2. Start logging
logger.info('General message');
logger.orders.info('Order message');
logger.credit.info('Credit message');
logger.webhooks.info('Webhook message');
logger.errors.error('Error message');
```

---

## 📝 Logging Patterns

### General Logging (app.log)
```javascript
logger.info('Application event', { userId: '123', action: 'login' });
logger.warn('Warning event', { severity: 'medium' });
logger.error('Error event', { code: 'ERR_001' });
logger.debug('Debug info', { details: 'troubleshooting' });
```

### Order Logging (orders.log)
```javascript
logger.orders.info('Order created', { orderId: 'ORD-001', total: 2500 });
logger.orders.warn('Order delayed', { orderId: 'ORD-001', reason: 'payment' });
logger.orders.error('Order failed', { orderId: 'ORD-001', error: 'timeout' });
```

### Credit Logging (credit.log)
```javascript
logger.credit.info('Credit deducted', { userId: 'USER-001', amount: 500 });
logger.credit.warn('Low balance', { userId: 'USER-001', balance: 100 });
logger.credit.error('Deduction failed', { userId: 'USER-001', amount: 500 });
```

### Webhook Logging (webhooks.log)
```javascript
logger.webhooks.info('Webhook received', { webhookId: 'WH-001', event: 'msg' });
logger.webhooks.warn('Retry attempt', { webhookId: 'WH-001', attempt: 2 });
logger.webhooks.error('Processing failed', { webhookId: 'WH-001', error: 'sig' });
```

### Error Logging (errors.log)
```javascript
logger.errors.error('DB error', { error: 'ECONNREFUSED', host: 'db' });
logger.errors.error('API timeout', { service: 'payment', duration: 5000 });
```

---

## 📂 Log File Locations

| Log Type | File Name | Purpose |
|----------|-----------|---------|
| General | `app.log-YYYY-MM-DD` | All app events |
| Orders | `orders.log-YYYY-MM-DD` | Order operations |
| Credit | `credit.log-YYYY-MM-DD` | Credit transactions |
| Webhooks | `webhooks.log-YYYY-MM-DD` | Webhook events |
| Errors | `errors.log-YYYY-MM-DD` | Error tracking |
| | `errors-orders.log-YYYY-MM-DD` | Order errors |
| | `errors-credit.log-YYYY-MM-DD` | Credit errors |
| | `errors-webhooks.log-YYYY-MM-DD` | Webhook errors |

All files in: `/backend/logs/`

---

## 🔍 Viewing Logs

### Real-Time (Live Tail)
```bash
tail -f logs/app.log-$(date +%Y-%m-%d).log
tail -f logs/orders.log-$(date +%Y-%m-%d).log
tail -f logs/errors.log-$(date +%Y-%m-%d).log
```

### Search Errors
```bash
grep "ERROR" logs/orders.log-*
grep "WARN" logs/credit.log-*
```

### Count Occurrences
```bash
grep "Order created" logs/orders.log-* | wc -l
```

### Parse JSON (with jq)
```bash
cat logs/app.log-* | jq '.'
cat logs/orders.log-* | jq '.orderId, .total'
```

---

## 🔐 Automatic Data Protection

**These fields are automatically redacted:**

✅ password, passwordHash
✅ token, accessToken, refreshToken, jwt
✅ secret, apiKey, apiSecret, authToken
✅ creditCardNumber, ssn
✅ email, phone, accountNumber, dateOfBirth

**Example:**
```javascript
logger.info('Login attempt', {
  email: 'user@example.com',      // → [REDACTED]
  password: 'secure123',           // → [REDACTED]
  token: 'eyJhbGci...'            // → [REDACTED]
});
```

---

## 📊 Log Format

**Each log entry is JSON:**
```json
{
  "timestamp": "2024-01-15 10:30:45",
  "level": "INFO",
  "message": "Order created",
  "category": "orders",
  "orderId": "ORD-123",
  "total": 2500,
  "nodeEnv": "production",
  "pid": 1234
}
```

---

## ⏰ Log Rotation & Retention

| Item | Behavior |
|------|----------|
| **Daily Rotation** | Automatic at midnight (new file each day) |
| **File Naming** | `{category}.log-{YYYY-MM-DD}.log` |
| **Regular Logs** | Kept for 14 days |
| **Error Logs** | Kept for 30 days |
| **Max File Size** | 10MB (rotates if exceeded) |
| **Cleanup** | Automatic daily |

---

## 🎯 Integration Checklist

- [ ] Import logger in your file
- [ ] Use appropriate category logger
- [ ] Include relevant context data
- [ ] Don't log passwords/tokens (auto-redacted anyway)
- [ ] Keep logs concise and descriptive
- [ ] Use consistent message format

---

## 💡 Best Practices

✅ **DO:**
- Use category-specific loggers
- Include important context data
- Log at appropriate levels (info, warn, error)
- Use consistent message format
- Include IDs for tracing (orderId, userId, etc.)

❌ **DON'T:**
- Log passwords, tokens, or sensitive data (auto-redacted)
- Include PII unnecessarily
- Log at debug level in production
- Use console.log() directly
- Forget to include context

---

## 📈 Log Levels

| Level | When to Use | Output |
|-------|------------|--------|
| **debug** | Development troubleshooting | Console only (dev mode) |
| **info** | Normal operations | Console (dev) + File (all) |
| **warn** | Warning conditions | Console (dev) + File (all) |
| **error** | Error conditions | Console (dev) + File (all) + Error logs |

---

## 🚨 Error Tracking

Always include error context:
```javascript
try {
  // operation
} catch (error) {
  logger.errors.error('Operation failed', {
    error: error.message,
    code: error.code,
    operation: 'order_creation',
    userId: req.user?.id
  });
}
```

---

## 🔧 Common Tasks

### Find All Orders for User
```bash
grep "USER-789" logs/orders.log-* | jq '.orderId'
```

### Check Credit Transactions Today
```bash
grep "Credit" logs/credit.log-$(date +%Y-%m-%d).log | wc -l
```

### Find Failed Webhooks
```bash
grep "ERROR" logs/errors-webhooks.log-* | jq '.error'
```

### Monitor Disk Usage
```bash
du -sh logs/
```

---

## 🆘 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Logs not appearing | Check `/logs` directory exists and is writable |
| Sensitive data visible | Check SENSITIVE_FIELDS in winston-logger.js |
| No daily rotation | Verify system date/time is correct |
| Disk growing fast | Run cleanup: `node -e "require('./src/config/winston-logger').cleanupOldLogs()"` |
| Import errors | Ensure winston-logger.js is deployed |

---

## 📚 Full Documentation

- **Complete Guide**: `PRODUCTION_LOGGING_GUIDE.md`
- **Integration Guide**: `LOGGING_IMPLEMENTATION.md`
- **Summary**: `LOGGING_SYSTEM_SUMMARY.md`
- **Implementation**: `src/config/winston-logger.js`

---

## 🎓 Example: Complete Order Flow Logging

```javascript
const { logger } = require('../config/winston-logger');

// 1. Order Creation
logger.orders.info('Order creation started', {
  customerId: 'CUST-001',
  itemCount: 5,
  estimatedTotal: 2500
});

try {
  // 2. Create order
  const order = await createOrder(orderData);
  
  logger.orders.info('Order created successfully', {
    orderId: order.id,
    customerId: order.customerId,
    total: order.total
  });
  
  // 3. Deduct credit
  logger.credit.info('Credit deduction started', {
    userId: order.customerId,
    amount: order.total,
    orderId: order.id
  });
  
  await deductCredit(order.customerId, order.total);
  
  logger.credit.info('Credit deducted successfully', {
    userId: order.customerId,
    amount: order.total,
    orderId: order.id
  });
  
  // 4. Send notification
  logger.webhooks.info('Webhook triggered', {
    orderId: order.id,
    event: 'order.created'
  });
  
  return order;
  
} catch (error) {
  // 5. Log errors
  logger.orders.error('Order creation failed', {
    customerId: orderData.customerId,
    error: error.message
  });
  
  logger.errors.error('Order processing error', {
    error: error.message,
    stack: error.stack,
    orderId: order?.id
  });
  
  throw error;
}
```

---

## ✅ Ready to Start?

1. **Import**: `const { logger } = require('../config/winston-logger');`
2. **Log**: `logger.category.level('message', { data });`
3. **Monitor**: `tail -f logs/category.log-*.log`
4. **Deploy**: Set `NODE_ENV=production`

**That's it! Your production logging is ready.**
