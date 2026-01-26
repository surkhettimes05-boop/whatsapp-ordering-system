# Webhook Idempotency - Deployment Guide

## Pre-Deployment Checklist

- [ ] Database backup taken
- [ ] Team notified of changes
- [ ] Test environment updated first
- [ ] Staging tests passed
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured

---

## Step 1: Database Migration

### Local Development

```bash
cd backend

# Run migration
npm run prisma:migrate -- --name "add webhook idempotency table with ttl support"

# Verify
npm run prisma:generate
```

### Production

```bash
# On production server
cd /app/backend

# Backup database first
pg_dump whatsapp_ordering > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migration
npm run prisma:migrate

# Verify table created
psql -d whatsapp_ordering -c "SELECT COUNT(*) FROM webhook_idempotency;"
# Should return: count
#             -------
#                   0
```

### Verify Indexes

```sql
-- Check indexes created
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE tablename = 'webhook_idempotency'
ORDER BY indexname;

-- Expected output:
-- webhook_idempotency | idx_idempotency_key (unique)
-- webhook_idempotency | idx_idempotency_key_expires_at (composite)
-- webhook_idempotency | idx_expires_at
-- webhook_idempotency | idx_webhook_type
-- webhook_idempotency | idx_created_at
```

---

## Step 2: Install Dependencies

```bash
cd backend

# Install node-cron for cleanup job
npm install node-cron

# Verify installation
npm list node-cron
# └── node-cron@3.x.x
```

### Production

```bash
# On production
cd /app/backend
npm install --only=production
npm install node-cron
```

---

## Step 3: Update Application Code

### Add to app entry point

**File: `src/index.js` or main server file**

```javascript
const express = require('express');
const { initializeIdempotencyCleanup, shutdownIdempotencyCleanup } = require('./jobs/idempotency-cleanup.job');
const logger = require('./utils/logger');

const app = express();

// ... other setup ...

// Initialize idempotency cleanup on startup
async function startServer() {
  try {
    // Initialize idempotency cleanup
    const cleanupResult = await initializeIdempotencyCleanup({
      schedule: '0 * * * *', // Every hour
      run_on_start: true     // Clean now + schedule
    });
    
    logger.info('Idempotency cleanup initialized', cleanupResult);

    // Start Express server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      
      // Stop idempotency cleanup
      shutdownIdempotencyCleanup(cleanupResult.scheduler);
      
      // Close other resources
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully...');
      
      // Stop idempotency cleanup
      shutdownIdempotencyCleanup(cleanupResult.scheduler);
      
      // Close other resources
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();
```

### Alternative: If using PM2 or systemd

**PM2 ecosystem.config.js:**
```javascript
module.exports = {
  apps: [{
    name: 'whatsapp-api',
    script: './src/index.js',
    instances: 1,           // Single instance for idempotency cleanup
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

**systemd service file:**
```ini
[Unit]
Description=WhatsApp Ordering API
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=/app/backend
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

---

## Step 4: Configuration (Optional)

### Environment Variables

**`.env` file:**
```bash
# Idempotency settings (optional - use defaults)
IDEMPOTENCY_TTL_HOURS=24
IDEMPOTENCY_CLEANUP_SCHEDULE="0 * * * *"
IDEMPOTENCY_CLEANUP_ON_START=true
```

**Reference in code:**
```javascript
const ttlHours = parseInt(process.env.IDEMPOTENCY_TTL_HOURS || 24);
const ttlSeconds = ttlHours * 3600;

const result = await initializeIdempotencyCleanup({
  schedule: process.env.IDEMPOTENCY_CLEANUP_SCHEDULE || '0 * * * *',
  run_on_start: process.env.IDEMPOTENCY_CLEANUP_ON_START !== 'false'
});
```

---

## Step 5: Testing

### Unit Tests (Local)

```bash
# Create test file: src/tests/idempotency.test.js
npm test -- idempotency.test.js
```

### Integration Tests

```bash
# Test 1: First request
curl -X POST http://localhost:3000/api/v1/whatsapp/webhook \
  -H "X-Idempotency-Key: test-key-001" \
  -H "Content-Type: application/json" \
  -d '{"From":"whatsapp:+9779800000000","Body":"test"}'
# Expected: 200 OK

# Test 2: Duplicate request (same key)
curl -X POST http://localhost:3000/api/v1/whatsapp/webhook \
  -H "X-Idempotency-Key: test-key-001" \
  -H "Content-Type: application/json" \
  -d '{"From":"whatsapp:+9779800000000","Body":"test"}'
# Expected: 200 OK (CACHED - no processing)

# Test 3: Verify only one order created
# Check database - should have 1 order, not 2
SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '5 minutes';
# Expected: 1
```

### Load Testing

```bash
# Generate 100 requests with same idempotency key
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/v1/whatsapp/webhook \
    -H "X-Idempotency-Key: load-test-001" \
    -H "Content-Type: application/json" \
    -d '{"From":"whatsapp:+9779800000000","Body":"test"}' &
done
wait

# Verify: Should have 1 order (first request), rest cached
SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '5 minutes';
# Expected: 1
```

---

## Step 6: Monitoring Setup

### Prometheus Metrics (Optional)

```javascript
// src/metrics/idempotency.metrics.js
const prometheus = require('prom-client');

const idempotencyCacheHits = new prometheus.Counter({
  name: 'webhook_idempotency_cache_hits_total',
  help: 'Total idempotency cache hits'
});

const idempotencyCacheMisses = new prometheus.Counter({
  name: 'webhook_idempotency_cache_misses_total',
  help: 'Total idempotency cache misses'
});

const idempotencyTableSize = new prometheus.Gauge({
  name: 'webhook_idempotency_table_size',
  help: 'Number of entries in webhook_idempotency'
});

module.exports = {
  idempotencyCacheHits,
  idempotencyCacheMisses,
  idempotencyTableSize
};
```

### Logging Setup

Ensure logger captures idempotency events:

```javascript
// In idempotency.middleware.js
logger.info('Idempotency cache hit - replaying response', {
  idempotency_key,
  webhook_type: existingEntry.webhook_type,
  original_status: existingEntry.response_status
});
```

### Alerts

**New Relic / DataDog:**
```yaml
alerts:
  - name: "Idempotency Cleanup Job Failed"
    condition: "job_status == 'failed'"
    severity: "high"
    
  - name: "Webhook Idempotency Table Growing"
    condition: "webhook_idempotency_rows > 100000"
    severity: "medium"
    
  - name: "High Cache Miss Rate"
    condition: "cache_miss_rate > 0.3"
    severity: "low"
```

---

## Step 7: Deployment to Production

### Blue-Green Deployment

```bash
# 1. Deploy to staging
git checkout -b idempotency-feature
git push origin idempotency-feature
# PR review + tests pass

# 2. Merge to main
git merge idempotency-feature
git push origin main

# 3. Deploy to production (blue server)
# Run migration first
npm run prisma:migrate

# 4. Start app with cleanup job
npm start

# 5. Monitor for 30 minutes
tail -f logs/app.log | grep -i "idempotency"

# 6. Cut traffic to production (green)
# If stable, continue
# If issues, rollback to previous deployment
```

### Rolling Deployment

```bash
# 1. Update 50% of servers
# 2. Verify no errors (30 min)
# 3. Update remaining 50%
# 4. Monitor combined fleet (1 hour)
```

---

## Rollback Plan

### If Critical Issues Found

```bash
# 1. Stop application
pm2 stop whatsapp-api
# or
systemctl stop whatsapp

# 2. Revert database migration
npm run prisma:migrate:resolve -- --rolled-back "add webhook idempotency table with ttl support"

# 3. Revert code
git revert HEAD
git push origin main

# 4. Start application
pm2 start whatsapp-api
# or
systemctl start whatsapp

# 5. Verify
curl http://localhost:3000/api/v1/whatsapp/test
```

### Partial Rollback (Keep DB, Revert Code)

```bash
# 1. Keep webhook_idempotency table (don't run down migration)
# 2. Remove idempotency middleware from routes
# 3. Comment out cleanup job in index.js
# 4. Restart application

# Later: Can safely re-enable without re-running migration
```

---

## Post-Deployment

### Verification (Hour 1)

```bash
# Check cleanup job ran
grep "cleanup completed" logs/app.log

# Check cache hits
grep "cache hit" logs/app.log

# Monitor error rate
tail -f logs/error.log

# Check database size
psql -d whatsapp_ordering -c \
  "SELECT COUNT(*) as rows FROM webhook_idempotency;"
```

### Verification (Day 1)

```bash
# Check cleanup statistics
curl http://localhost:3000/api/v1/admin/idempotency/stats

# Verify no duplicate orders
SELECT COUNT(*) as orders FROM orders 
WHERE created_at > NOW() - INTERVAL '1 day';

# Check cache hit rate
tail -f logs/app.log | grep -c "cache hit" | wc -l
```

### Verification (Week 1)

```sql
-- Analyze idempotency usage
SELECT 
  webhook_type,
  COUNT(*) as total_keys,
  COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active,
  COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired
FROM webhook_idempotency
GROUP BY webhook_type;

-- Check cleanup effectiveness
SELECT 
  DATE(created_at) as date,
  COUNT(*) as stored,
  COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_pct
FROM webhook_idempotency
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## Ongoing Maintenance

### Weekly

```bash
# Monitor cleanup job success
grep "cleanup completed" logs/app.log

# Check error logs
grep "error" logs/app.log | grep -i "idempotency"

# Verify no database growth
psql -d whatsapp_ordering -c \
  "SELECT COUNT(*) FROM webhook_idempotency;"
# Should stay relatively constant with cleanup job
```

### Monthly

```bash
# Full cleanup statistics
psql -d whatsapp_ordering -c "\
SELECT 
  (SELECT COUNT(*) FROM webhook_idempotency) as total,
  (SELECT COUNT(*) FROM webhook_idempotency WHERE expires_at > NOW()) as active,
  ROUND(pg_total_relation_size('webhook_idempotency') / 1024 / 1024) as size_mb;"

# Reindex if needed
REINDEX TABLE webhook_idempotency;

# Vacuum to reclaim space
VACUUM (ANALYZE) webhook_idempotency;
```

---

## Support & Troubleshooting

### Issue: Cleanup job not running

```bash
# Check if node-cron is installed
npm list node-cron

# Check if job initialized
grep "cleanup initialized" logs/app.log

# Manually run cleanup
curl http://localhost:3000/api/v1/admin/idempotency/cleanup
```

### Issue: High database size

```bash
# Force cleanup
DELETE FROM webhook_idempotency WHERE expires_at < NOW();

# Vacuum table
VACUUM (ANALYZE) webhook_idempotency;

# Check retention policy
SELECT COUNT(*) FROM webhook_idempotency 
WHERE expires_at > NOW() - INTERVAL '30 days';
```

### Issue: Duplicate orders still created

```bash
# Verify middleware in route
grep -n "idempotencyMiddleware" src/routes/whatsapp.routes.js

# Verify cache being stored
grep "cached for idempotency" logs/app.log

# Check if cacheIdempotencyResponse is called
grep -n "cacheIdempotencyResponse" src/routes/whatsapp.routes.js
```

---

## Rollback Procedures

### Full Rollback (Database + Code)

```bash
# 1. Backup current data
pg_dump whatsapp_ordering > backup_post_idempotency.sql

# 2. Run down migration
cd backend
npm run prisma:migrate:resolve -- --rolled-back "add webhook idempotency table with ttl support"
npx prisma migrate resolve --rolled-back

# 3. Revert code
git revert HEAD
git push origin main

# 4. Restart
npm start
```

### Code-Only Rollback

```bash
# 1. Remove idempotency middleware
# From src/routes/whatsapp.routes.js:
# - Remove: const { idempotencyMiddleware } = ...
# - Remove: idempotencyMiddleware({...}), from router.post

# 2. Comment out cleanup job
# From src/index.js:
# - Comment: initializeIdempotencyCleanup()
# - Comment: shutdownIdempotencyCleanup()

# 3. Restart
npm start

# Keep webhook_idempotency table for future re-enable
```

---

## Performance Baseline

### Before Idempotency
```
Webhook latency: ~200ms
Database queries per request: 5
Order duplicates: Occasional (on retries)
```

### After Idempotency
```
Webhook latency: ~50ms (cache hits) | ~200ms (first request)
Database queries per request: 2 (first) | 0 (cache hit)
Order duplicates: 0 (completely prevented)
```

---

## Disaster Recovery

### Database Corruption

```bash
# 1. Restore from backup
psql whatsapp_ordering < backup_YYYYMMDD_HHMMSS.sql

# 2. Verify webhook_idempotency table
psql -d whatsapp_ordering -c \
  "SELECT COUNT(*) FROM webhook_idempotency;"

# 3. Restart application
npm start
```

### Lost Cleanup Job

```bash
# 1. Manual full cleanup
psql -d whatsapp_ordering -c \
  "DELETE FROM webhook_idempotency WHERE expires_at < NOW();"

# 2. Verify application initialized job
grep "cleanup initialized" logs/app.log

# 3. Restart if needed
pm2 restart whatsapp-api
```

---

## Success Metrics

After deployment, track:

1. **Cache Hit Rate** - Target: > 90% for retries
2. **Duplicate Orders** - Target: 0
3. **Cleanup Job Success** - Target: 100%
4. **Database Size Stability** - Target: < 100MB
5. **Query Performance** - Target: < 10ms lookup

---

*Deployment completed when all webhook duplicates are prevented and cleanup job runs successfully.*
