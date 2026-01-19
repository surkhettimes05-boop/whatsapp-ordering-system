## Message Deduplication - Quick Start

**Time to Deploy:** 10 minutes  
**Difficulty:** Easy  
**Impact:** Prevents duplicate WhatsApp orders

---

## 🎯 What It Does

Prevents duplicate order creation when:
- User resends message (network timeout)
- Twilio retries webhook delivery
- User accidentally sends twice

---

## 🚀 Quick Setup (3 Steps)

### Step 1: Create Database Migration

```bash
cd backend
npx prisma migrate dev --name add_processed_messages
```

This creates the `processed_messages` table for tracking message SIDs.

### Step 2: Deploy Code

Code is already updated:
- ✅ Deduplication service created
- ✅ Middleware integrated
- ✅ Routes updated
- ✅ Controller updated

Just deploy:
```bash
git add .
git commit -m "feat: Add message deduplication"
git push
```

### Step 3: Test

Send test message twice:
```bash
# Send message #1
→ Order created ✓

# Send same message #2 (within 30 seconds)
→ Duplicate detected, skipped ✓
```

Check logs:
```bash
grep "Duplicate message" logs/webhooks.log
```

---

## 📊 How It Works

```
Message 1 (MessageSid: SM123)
  ├─ Check: Not in database
  ├─ Action: Mark as pending
  ├─ Process: Create order
  └─ Mark: success

Message 1 resend (Same MessageSid: SM123)
  ├─ Check: Found in database
  ├─ Action: Skip
  └─ Mark: skipped
```

---

## ✨ Features

| Feature | Status |
|---------|--------|
| Duplicate Detection | ✅ |
| Twilio Retry Handling | ✅ |
| Order Duplicate Prevention | ✅ |
| Message Tracking | ✅ |
| Analytics | ✅ |
| Auto-Cleanup | ✅ |

---

## 📈 Usage

### In Your Code

Deduplication is automatic! Just use the middleware:

```javascript
router.post(
  '/webhook',
  deduplicationMiddleware(),  // ← Added
  async (req, res) => {
    // Your handler
  }
);
```

### Check Stats

```javascript
const dedupService = require('./src/services/message-dedup.service');

// Get last 7 days stats
const stats = await dedupService.getDedupStats(7);
console.log(stats);
// Output:
// {
//   totalRetries: 45,
//   totalDuplicates: 12,
//   averageDuplicateRate: "3.5%"
// }
```

---

## 🔍 Monitoring

### Check if Working

```bash
# Look for these logs:
"Duplicate message skipped"         ← Good
"Duplicate message attempt detected" ← Detected retry
```

### Get User's Message History

```javascript
const messages = await dedupService.getProcessedMessagesForUser('+9779800000000');
console.log(messages.length, 'messages processed');
```

---

## ⚙️ Configuration

### Retry Behavior

By default, Twilio automatic retries (within 5 seconds) are allowed to reprocess.

Change this:
```javascript
deduplicationMiddleware({
  allowRetries: false,     // Don't allow any retries
  retryTimeWindow: 10000   // Change window to 10 seconds
})
```

---

## 🧪 Manual Testing

### Test 1: Simple Duplicate

```bash
# Send message with MessageSid: test-123
# Response: Order created

# Send again with same MessageSid
# Response: Duplicate skipped
```

### Test 2: User History

```javascript
const messages = await dedupService.getProcessedMessagesForUser('+1234567890');
console.log('Messages:', messages.length);
messages.forEach(m => console.log(m.messageSid, m.status));
```

---

## 📊 Database Schema

New table `processed_messages`:

```sql
CREATE TABLE processed_messages (
  id SERIAL PRIMARY KEY,
  messageSid VARCHAR(50) UNIQUE,
  phoneNumber VARCHAR(20),
  status VARCHAR(20),           -- pending, processing, success, failed, skipped
  orderId VARCHAR(50),
  retailerId VARCHAR(50),
  retryCount INT DEFAULT 0,
  processedAt TIMESTAMP,
  lastRetryAt TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🎯 Success Criteria

Deduplication works when:

1. ✅ First message creates order
2. ✅ Duplicate message is skipped
3. ✅ Logs show duplicate detection
4. ✅ Message SID in database
5. ✅ No duplicate orders created

---

## 🆘 Troubleshooting

### Problem: Duplicates Still Creating Orders

**Check:**
1. Middleware is applied: `deduplicationMiddleware()`
2. Migration ran: `npx prisma migrate status`
3. Database has `processed_messages` table

**Fix:**
```bash
npx prisma migrate reset  # Reset and re-run migrations
```

### Problem: "Table doesn't exist" Error

**Fix:**
```bash
npx prisma migrate dev --name add_processed_messages
```

### Problem: Can't Find Message in Database

**Check:**
```javascript
const msg = await dedupService.getProcessingDetails('SM123');
console.log(msg); // Should show message or null
```

---

## 📚 Files Changed

| File | Change |
|------|--------|
| `src/services/message-dedup.service.js` | NEW |
| `src/middleware/message-dedup.middleware.js` | NEW |
| `src/routes/whatsapp.routes.js` | Updated |
| `src/controllers/whatsapp.controller.js` | Updated |
| `prisma/schema.prisma` | Added ProcessedMessage model |

---

## 🔄 Maintenance

### Weekly

```javascript
// Check dedup stats
const stats = await dedupService.getDedupStats(7);
console.log('Duplicate rate:', stats.averageDuplicateRate);
```

### Monthly

```javascript
// Clean up old records (>90 days)
await dedupService.cleanupOldRecords(90);
```

---

## ✅ Checklist

Before using in production:

- [ ] Ran: `npx prisma migrate dev --name add_processed_messages`
- [ ] Code deployed
- [ ] Tested duplicate detection (send message twice)
- [ ] Checked logs for "Duplicate message skipped"
- [ ] Verified no duplicate orders created
- [ ] Set up monitoring (optional)

---

## 🚀 You're Ready!

Your WhatsApp backend is now protected against duplicate orders.

**Next:** Deploy and start receiving orders!

---

**Questions?** See MESSAGE_DEDUPLICATION_COMPLETE.md for full documentation.

