# Deployment & Migration Checklist

Complete this checklist before deploying to production.

---

## Pre-Deployment (Development Testing)

### 1. Database Schema & Migrations
- [ ] Run schema migration: `npx prisma migrate dev --name "add_credit_operations_system"`
- [ ] Verify new tables created:
  - `AuditLog`
  - `PendingOrder`
  - `RetailerInsight`
- [ ] Verify new fields added to existing tables:
  - `Retailer`: creditStatus, creditPausedAt, creditPauseReason, auditLogs
  - `CreditAccount`: maxOrderValue, maxOutstandingDays
  - `CreditTransaction`: reminderSentAt, reminderCount, clearedAt, clearedAmount, notes
  - `Order`: failedAt, failureReason

### 2. Service Layer Testing
- [ ] `credit.service.js`:
  - [ ] `getSystemCreditRisk()` returns correct aging buckets
  - [ ] `getRetailerCreditProfile()` shows detailed profile
  - [ ] `pauseCredit()` sets correct fields
  - [ ] `unpauseCredit()` resets fields
  - [ ] `recordPayment()` updates credit correctly
  - [ ] `createAdjustment()` works for both debit/credit
  - [ ] `logAudit()` creates audit records

- [ ] `guardrails.service.js`:
  - [ ] `validateOrderPlacement()` rejects invalid CREDIT orders
  - [ ] `validateOrderPlacement()` allows COD when credit paused
  - [ ] `evaluateAndApplyGuardrails()` auto-pauses overdue accounts
  - [ ] `getAtRiskRetailers()` identifies at-risk accounts

- [ ] `orderRecovery.service.js`:
  - [ ] `createPendingOrder()` creates record with 24h expiry
  - [ ] `expirePendingOrders()` marks old ones as expired
  - [ ] `sendFollowUpMessages()` sends recovery messages
  - [ ] `handleOrderFailure()` reverses credit and notifies

- [ ] `retailerInsights.service.js`:
  - [ ] `generateRetailerInsights()` calculates stats correctly
  - [ ] `getInsightMessage()` generates friendly message
  - [ ] `regenerateAllInsights()` processes all retailers

### 3. Endpoint Testing
Test all endpoints in `credit.controller.js`:

```bash
# Feature 1: Risk Dashboard
curl http://localhost:5000/api/v1/admin/credit/risk-dashboard

# Feature 3: Pause/Unpause
curl -X POST http://localhost:5000/api/v1/admin/credit/ret_123/pause \
  -d '{"reason":"test"}'

# Feature 4: Payment Recording
curl -X POST http://localhost:5000/api/v1/admin/payment/record \
  -d '{"transactionId":"txn_123","amountPaid":1000,"adminId":"admin_001"}'

# Feature 5: Order Recovery
curl http://localhost:5000/api/v1/admin/orders/failed/ret_123

# Feature 6: Insights
curl http://localhost:5000/api/v1/admin/insights/ret_123/message

# Feature 8: Guardrails
curl -X POST http://localhost:5000/api/v1/admin/guardrails/validate-order \
  -d '{"retailerId":"ret_123","orderAmount":5000,"paymentMode":"CREDIT"}'
```

### 4. Job Testing
- [ ] Start the application: `npm run dev`
- [ ] Check console logs for: `✅ Background Jobs initiated`
- [ ] Verify jobs are scheduled:
  - [ ] Payment Reminders (10:00 AM)
  - [ ] Auto-Pause (11:00 AM)
  - [ ] Order Recovery Expiry (every 6 hours)
  - [ ] Order Recovery Follow-up (2:00 PM)
  - [ ] Insights Regeneration (3:00 AM)
  - [ ] Guardrails Evaluation (4:00 AM)

**Manual Job Testing:**
```javascript
// In Node console or test file
const creditService = require('./src/services/credit.service');
const guardrailsService = require('./src/services/guardrails.service');
const orderRecoveryService = require('./src/services/orderRecovery.service');
const retailerInsightsService = require('./src/services/retailerInsights.service');

// Test credit risk
await creditService.getSystemCreditRisk();

// Test guardrails
await guardrailsService.evaluateAndApplyGuardrails();

// Test order recovery
await orderRecoveryService.expirePendingOrders();
await orderRecoveryService.sendFollowUpMessages();

// Test insights
await retailerInsightsService.regenerateAllInsights();
```

### 5. WhatsApp Message Testing
- [ ] Test payment reminder message format
- [ ] Test auto-pause notification message
- [ ] Test credit status message
- [ ] Test insights message
- [ ] Test failure notification message
- [ ] Test recovery/follow-up message

Messages to test are in:
- `paymentReminders.job.js` - reminder messages
- `orderRecovery.service.js` - failure and recovery messages
- `retailerInsights.service.js` - insights message

### 6. Audit Logging Testing
- [ ] Perform credit operation (payment, adjustment, pause)
- [ ] Check `AuditLog` table for entry
- [ ] Verify fields: action, reference, newValue, performedBy, reason

---

## Staging Deployment

### 1. Database Backup
- [ ] Back up production database before applying migrations
- [ ] Test restore procedure

### 2. Apply Migrations
```bash
# In production environment
npx prisma migrate deploy
```

### 3. Verify Tables Exist
```sql
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('AuditLog', 'PendingOrder', 'RetailerInsight');
```

### 4. Create Indexes
```sql
CREATE INDEX idx_credit_transaction_status 
  ON CreditTransaction(status, type);
CREATE INDEX idx_credit_transaction_created 
  ON CreditTransaction(createdAt DESC);
CREATE INDEX idx_credit_transaction_retailer 
  ON CreditTransaction(retailerId);
CREATE INDEX idx_retailer_credit_status 
  ON Retailer(creditStatus);
CREATE INDEX idx_audit_log_retailer 
  ON AuditLog(retailerId);
CREATE INDEX idx_pending_order_status 
  ON PendingOrder(status, expiresAt);
```

### 5. Deploy Code
- [ ] Merge PR to main
- [ ] Deploy to staging
- [ ] Verify logs show: `✅ Background Jobs initiated`

### 6. Smoke Test
- [ ] Test risk dashboard loads
- [ ] Test order validation works
- [ ] Test payment recording works
- [ ] Check audit logs appear
- [ ] Manually trigger a job

---

## Production Deployment

### 1. Pre-Production Checklist
- [ ] All staging tests passed
- [ ] No errors in staging logs
- [ ] Database backup created
- [ ] Rollback plan documented (below)
- [ ] Stakeholders notified
- [ ] Communication channel open (Slack/Email)

### 2. Deployment Steps
```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies (if needed)
npm install

# 3. Generate Prisma client
npx prisma generate

# 4. Apply migrations (zero-downtime)
npx prisma migrate deploy

# 5. Start application
npm start
```

### 3. Post-Deployment Verification
- [ ] Application starts without errors
- [ ] Health check passes: `GET /health` returns 200
- [ ] Jobs show in logs at scheduled times
- [ ] Risk dashboard loads
- [ ] Create test transaction and verify audit log
- [ ] Monitor error logs for 30 minutes

### 4. Rollback Plan
**If critical error occurs:**

```bash
# 1. Stop application
kill -TERM <pid>

# 2. Rollback migration (careful - data loss possible)
npx prisma migrate resolve --rolled-back "add_credit_operations_system"

# 3. Deploy previous version of code
git checkout <previous_commit>
npm install
npm start

# 4. Verify application runs
curl http://localhost:5000/health

# 5. Restore database from backup if needed
# Contact DBA
```

**Better approach:** Keep old code running, revert gradually
- Deploy with feature flags
- Keep old endpoints functional
- Migrate data in background

---

## Post-Deployment (First Week)

### Daily Checks
- [ ] Application logs clean (no ERROR messages)
- [ ] Jobs running at scheduled times
- [ ] No memory leaks (monitor process memory)
- [ ] Response times normal
- [ ] Database connection stable

### First Week Monitoring
- [ ] Risk dashboard showing correct data
- [ ] Payment reminders sending (10 AM)
- [ ] Auto-pause working (11 AM)
- [ ] No false positives in at-risk detection
- [ ] Audit logs growing as expected
- [ ] No duplicate records (check for race conditions)

### Sample Monitoring Queries
```sql
-- Check if audit logs are being created
SELECT COUNT(*) FROM AuditLog WHERE createdAt > NOW() - INTERVAL '24 hours';

-- Check if reminders are being tracked
SELECT COUNT(*) FROM CreditTransaction 
WHERE reminderSentAt IS NOT NULL 
AND createdAt > NOW() - INTERVAL '7 days';

-- Check if any jobs failed
SELECT * FROM AuditLog 
WHERE action LIKE '%ERROR%' 
AND createdAt > NOW() - INTERVAL '24 hours';

-- Check pending orders
SELECT COUNT(*) FROM PendingOrder 
WHERE status IN ('PENDING', 'EXPIRED')
AND createdAt > NOW() - INTERVAL '24 hours';
```

---

## Configuration Validation

### Environment Variables Needed
No new environment variables are needed. System uses existing:
- `DATABASE_URL` - PostgreSQL connection
- `TWILIO_WHATSAPP_FROM` - For WhatsApp messages
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` - For Twilio API

### Optional Tuning (via Admin Endpoints)
```bash
# Adjust max order value for a retailer
curl -X PUT /api/v1/admin/guardrails/ret_123 \
  -d '{"maxOrderValue": 75000}'

# Adjust max outstanding days
curl -X PUT /api/v1/admin/guardrails/ret_123 \
  -d '{"maxOutstandingDays": 45}'
```

---

## Data Validation

### Run These Checks After Migration

```sql
-- 1. Verify no existing transactions lost
SELECT COUNT(*) FROM CreditTransaction;
-- Should show same count as before

-- 2. Verify no orphaned records
SELECT COUNT(*) FROM AuditLog WHERE retailerId NOT IN 
  (SELECT id FROM Retailer);
-- Should be 0

-- 3. Verify credit status defaults
SELECT creditStatus, COUNT(*) FROM Retailer 
GROUP BY creditStatus;
-- Should show: ACTIVE, PAUSED, BLOCKED counts

-- 4. Check for any null values
SELECT COUNT(*) FROM CreditAccount 
WHERE maxOrderValue IS NULL OR maxOutstandingDays IS NULL;
-- Should be 0 (all have defaults)
```

---

## Integration Checklist (Before Live)

These are STILL TODO - not done by this implementation:

- [ ] **Conversation Service**: Add guardrails validation to order placement
- [ ] **Conversation Service**: Create pending order on checkout start
- [ ] **Conversation Service**: Check creditStatus before offering CREDIT option
- [ ] **Order Service**: Deduct credit for CREDIT orders
- [ ] **Order Service**: Create DEBIT transaction with due date
- [ ] **Order Service**: Call handleOrderFailure for failures
- [ ] **WhatsApp Handler**: Send pause notification when credit paused
- [ ] **Admin Endpoint**: Add payment recording UI/API
- [ ] **Admin Endpoint**: Add return/dispute adjustment UI/API

See `INTEGRATION_GUIDE.md` for code examples.

---

## Go/No-Go Checklist

**Go to Production if:**
- [ ] All schema migrations applied successfully
- [ ] All services tested and working
- [ ] All endpoints return 200/201
- [ ] Jobs scheduled and running
- [ ] Audit logs appearing
- [ ] WhatsApp messages sending correctly
- [ ] No critical errors in logs
- [ ] Database query performance acceptable
- [ ] Integration points documented
- [ ] Team trained on new features

**NO-GO if:**
- [ ] Audit logs not appearing
- [ ] Jobs not running
- [ ] Error rate > 1%
- [ ] Response time degradation > 20%
- [ ] WhatsApp integration failing
- [ ] Data loss or corruption detected
- [ ] Critical integration incomplete

---

## Support & Troubleshooting

### Common Issues

**Jobs Not Running**
```bash
# Check if node-schedule is properly installed
npm ls node-schedule

# Check timezone settings (jobs use system timezone)
date

# Check application logs for job startup messages
# Should see: ✅ Background Jobs initiated
```

**Audit Logs Not Appearing**
```javascript
// Test logging manually
const creditService = require('./src/services/credit.service');
await creditService.logAudit(
    'ret_123',
    'TEST',
    null,
    { test: true },
    'SYSTEM'
);
// Check database
```

**WhatsApp Messages Not Sending**
```bash
# Check Twilio credentials in environment
echo $TWILIO_ACCOUNT_SID
echo $TWILIO_AUTH_TOKEN

# Test WhatsApp service directly
curl -X POST http://localhost:5000/api/v1/whatsapp/send \
  -d '{"to": "919876543210", "message": "Test"}'
```

**High Memory Usage**
- Check if jobs are piling up
- Verify Prisma connection pooling
- Monitor background processes

---

## Success Metrics

After 1 week in production:

| Metric | Target | Actual |
|--------|--------|--------|
| Audit logs/day | 500+ | _ |
| Failed requests | <1% | _ |
| Job completion rate | 99%+ | _ |
| P95 response time | <100ms | _ |
| Paused retailers | 5-10% | _ |
| Risk dashboard accuracy | 100% | _ |

---

## Contact & Support

**Questions during deployment?**
- Check `CREDIT_OPERATIONS_GUIDE.md` for feature details
- Check `INTEGRATION_GUIDE.md` for code examples
- Review service files for implementation details

**Issues?**
- Check application logs: `tail -f app.log`
- Check database: Connect and run validation queries
- Test services individually in Node console

---

**Deployment Complete ✅**

This checklist covers safe, zero-downtime deployment of the credit operations system.
Follow each step carefully. Don't skip verification steps.
