# 🚀 Performance Tuning & Implementation Guide

## Quick Start

### Run All Tests
```bash
cd backend
chmod +x tests/performance/run-performance-tests.sh
./tests/performance/run-performance-tests.sh all
```

### Run Individual Tests
```bash
# Webhook endpoint stress test
node tests/performance/webhook-load-test.js stress

# Vendor race condition detection
node tests/performance/vendor-race-test.js moderate

# Redis failure simulation
node tests/performance/redis-failure-test.js crash

# Database restart recovery
node tests/performance/db-restart-test.js graceful
```

---

## 🎯 Performance Tuning Checklist

### Phase 1: Baseline Testing (Week 1)

- [ ] **Run baseline tests** to establish current performance
  ```bash
  # Record baseline metrics
  ./tests/performance/run-performance-tests.sh baseline
  ```
  
- [ ] **Document current state:**
  - [ ] Webhook RPS: _____ (target: >500)
  - [ ] Webhook p99: _____ ms (target: <500ms)
  - [ ] Webhook errors: ____% (target: <0.1%)
  - [ ] Vendor win rate: ____% (target: 100%)
  - [ ] Redis failure error rate: ____% (target: <1%)
  - [ ] DB recovery time: _____ s (target: <10s)

- [ ] **Identify critical bottlenecks** (use color codes from PERFORMANCE_TESTING_GUIDE.md)

- [ ] **Schedule tuning work** based on severity

### Phase 2: Database Optimization (Week 2)

#### Step 1: Add Critical Indexes
```bash
cd backend
psql $DATABASE_URL < scripts/performance/add-indexes.sql
```

**File: `scripts/performance/add-indexes.sql`**
```sql
-- Webhook performance
CREATE INDEX IF NOT EXISTS idx_webhook_idempotency_message_sid 
  ON webhook_idempotency(message_sid);

CREATE INDEX IF NOT EXISTS idx_webhook_idempotency_account_sid_timestamp 
  ON webhook_idempotency(account_sid, created_at DESC);

-- Vendor routing performance  
CREATE INDEX IF NOT EXISTS idx_vendor_routing_responses_routing_id 
  ON vendor_routing_responses(routing_id);

CREATE INDEX IF NOT EXISTS idx_vendor_routing_responses_routing_response 
  ON vendor_routing_responses(routing_id, response) 
  WHERE response = 'ACCEPTED';

-- Order queries
CREATE INDEX IF NOT EXISTS idx_orders_retailer_created 
  ON orders(retailer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status_created 
  ON orders(status, created_at DESC);

-- Queue performance
CREATE INDEX IF NOT EXISTS idx_jobs_state_priority 
  ON jobs(state, priority DESC, created_at);

ANALYZE;
```

- [ ] **Verify indexes created:**
  ```bash
  psql $DATABASE_URL -c "\di" | grep "idx_"
  ```

- [ ] **Run webhook test again:**
  ```bash
  node tests/performance/webhook-load-test.js moderate
  # Expected improvement: +15-25% RPS
  ```

#### Step 2: Optimize Connection Pool
```bash
# Update .env.production
DATABASE_POOL_SIZE=30          # From 10
DATABASE_POOL_MAX=50           # From 20
DATABASE_IDLE_TIMEOUT=30000    # New: Release idle connections
DATABASE_CONNECTION_TIMEOUT=5000  # New: Timeout on pool exhaustion
```

- [ ] **Verify pool settings in logs:**
  ```bash
  curl http://localhost:3000/health/detailed | jq '.data.database'
  ```

- [ ] **Run webhook test:**
  ```bash
  node tests/performance/webhook-load-test.js heavy
  # Expected improvement: +30-40% RPS
  ```

#### Step 3: Enable Query Caching
```bash
# Update .env.production
CACHE_STRATEGY=redis
CACHE_TTL=300              # 5 minutes
CACHE_KEY_PREFIX=app:
CACHE_QUERY_RESULTS=true
```

- [ ] **Implement Redis caching layer** (if not already present)

- [ ] **Run webhook test:**
  ```bash
  node tests/performance/webhook-load-test.js heavy
  # Expected improvement: +20-30% RPS with cache hits
  ```

### Phase 3: Application Optimization (Week 3)

#### Step 1: Enable Webhook Response Caching
```bash
# .env.production
WEBHOOK_CACHE_RESPONSES=true
WEBHOOK_CACHE_TTL=60  # Cache webhook responses
```

- [ ] **Verify webhook deduplication is working:**
  ```bash
  tail -f logs/webhook.log | grep -i "deduplicated"
  ```

#### Step 2: Implement Webhook Queuing
```bash
# .env.production
WEBHOOK_QUEUE_ENABLED=true
WEBHOOK_BATCH_SIZE=10
WEBHOOK_BATCH_TIMEOUT=100  # ms
WEBHOOK_WORKERS=5
```

- [ ] **Run webhook test:**
  ```bash
  node tests/performance/webhook-load-test.js stress
  # Expected improvement: +40-50% RPS
  ```

#### Step 3: Add Circuit Breaker
```bash
# .env.production
CIRCUIT_BREAKER_ENABLED=true
CIRCUIT_BREAKER_THRESHOLD=5    # Fail after 5 errors
CIRCUIT_BREAKER_TIMEOUT=30000  # 30 seconds
CIRCUIT_BREAKER_HALF_OPEN_REQUESTS=3
```

- [ ] **Verify circuit breaker behavior:**
  ```bash
  node tests/performance/redis-failure-test.js crash
  # Error rate should decrease significantly
  ```

### Phase 4: Infrastructure Optimization (Week 4)

#### Step 1: Implement Connection Pooling Proxy
```bash
# Add PgBouncer to docker-compose.yml
services:
  pgbouncer:
    image: edoburu/pgbouncer
    ports:
      - "6432:6432"
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/whatsapp
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 1000
      DEFAULT_POOL_SIZE: 50
      MIN_POOL_SIZE: 20
      RESERVE_POOL_SIZE: 5
      RESERVE_POOL_TIMEOUT: 3
```

- [ ] **Update application connection string:**
  ```bash
  DATABASE_URL=postgresql://user:pass@pgbouncer:6432/whatsapp
  ```

- [ ] **Run webhook test:**
  ```bash
  node tests/performance/webhook-load-test.js stress
  # Expected improvement: +20-30% RPS
  ```

#### Step 2: Add Read Replicas
```bash
# .env.production
DATABASE_READ_REPLICA_URL=postgresql://...
READ_REPLICA_WEIGHT=0.3  # Route 30% of reads to replica
```

- [ ] **Configure read-heavy queries** to use replica

- [ ] **Monitor replication lag:**
  ```bash
  psql $DATABASE_READ_REPLICA_URL -c "SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;"
  ```

#### Step 3: Enable HTTP Compression
```bash
# Already enabled in production.middleware.js
# Verify it's working:
curl -H "Accept-Encoding: gzip" http://localhost:3000/api/v1/products -I
# Look for "Content-Encoding: gzip"
```

### Phase 5: Validation & Monitoring (Week 5)

#### Step 1: Re-run All Tests
```bash
./tests/performance/run-performance-tests.sh full
```

- [ ] **Compare with baseline:**
  - [ ] Webhook RPS: _____ (target: >500, improve by ____%)
  - [ ] Webhook p99: _____ ms (target: <500ms)
  - [ ] Webhook errors: ____% (target: <0.1%)
  - [ ] Vendor win rate: ____% (target: 100%)
  - [ ] Redis failure rate: ____% (target: <1%)
  - [ ] DB recovery time: _____ s (target: <10s)

#### Step 2: Set Up Monitoring
```bash
# Deploy prometheus metrics collection
cd backend
cp deployment/prometheus.yml /etc/prometheus/

# Deploy Grafana dashboards
# See: backend/deployment/grafana-dashboards/

# Start monitoring
docker-compose -f docker-compose.prod.yml up -d prometheus grafana
```

#### Step 3: Configure Alerts
```bash
# Update prometheus alert rules
cp deployment/alerting-rules.yml /etc/prometheus/rules/

# Configure Grafana alert notifications
# Go to: Alerting → Notification channels
```

- [ ] **Test alert triggers:**
  ```bash
  # Simulate high latency
  node tests/performance/redis-failure-test.js timeout
  
  # Verify alerts fire within 2 minutes
  ```

---

## 🔍 Breaking Point Resolution Guide

### Webhook RPS Issues

#### Symptom: RPS < 100 after tuning phases 1-3

**Diagnostic Steps:**
```bash
# 1. Check database connection pool usage
curl http://localhost:3000/health/detailed | jq '.data.database'

# 2. Check for database slow queries
psql $DATABASE_URL -c "\l+"

# 3. Monitor Node.js event loop
DEBUG=* node src/app.js 2>&1 | grep -i "event loop"

# 4. Profile CPU usage
node --prof src/app.js
node --prof-process isolate-*.log > profile.txt
```

**Solutions (Priority Order):**
1. **Increase worker count** (if using clustering)
   ```bash
   CLUSTER_WORKERS=4  # Match CPU count
   ```

2. **Enable lazy loading** for routes
   ```javascript
   // Before: const router = require('./routes/...');
   // After:
   const router = () => require('./routes/...');
   ```

3. **Use streaming responses** for large data
   ```javascript
   // Instead of res.json(largeData)
   response.pipe(res);
   ```

### Vendor Race Condition Issues

#### Symptom: Race conditions still detected after Phase 2

**Diagnostic Steps:**
```bash
# 1. Check constraint exists
psql $DATABASE_URL -c "\d vendor_routing_responses" | grep -i constraint

# 2. Check transaction isolation level
psql $DATABASE_URL -c "SHOW transaction_isolation;"

# 3. Review database logs for lock timeouts
tail -f /var/log/postgresql/postgresql.log | grep -i "deadlock"
```

**Solutions:**
1. **Verify UNIQUE constraint:**
   ```sql
   ALTER TABLE vendor_routing_responses 
   ADD CONSTRAINT unique_routing_acceptance 
   UNIQUE (routing_id) 
   WHERE response = 'ACCEPTED';
   ```

2. **Increase lock timeout:**
   ```bash
   # In database.js
   await prisma.$executeRaw`SET lock_timeout TO '30s';`
   ```

3. **Use optimistic locking:**
   ```javascript
   const routing = await prisma.vendorRouting.findUnique({
     where: { id: routingId },
     include: { _version: true }
   });
   
   // Update with version check
   await prisma.vendorRouting.update({
     where: { id: routingId, _version: routing._version },
     data: { acceptedVendorId: vendorId, _version: { increment: 1 } }
   });
   ```

### Redis Failure Issues

#### Symptom: Error rate > 20% during Redis outage

**Diagnostic Steps:**
```bash
# 1. Test with Redis down
docker-compose down redis

# 2. Send webhook
curl -X POST http://localhost:3000/api/v1/whatsapp/webhook \
  -d "From=whatsapp:+1234567890&Body=Test"

# 3. Check error logs
tail -f logs/error.log | grep -i redis

# 4. Restart Redis
docker-compose up -d redis
```

**Solutions:**
1. **Implement database fallback queue:**
   ```javascript
   // In queue.js
   async function enqueue(job) {
     try {
       await redis.lpush(queue, JSON.stringify(job));
     } catch (error) {
       if (!redis.connected) {
         // Fall back to database
         await Job.create({ ...job });
       } else {
         throw error;
       }
     }
   }
   ```

2. **Implement circuit breaker:**
   ```javascript
   const CircuitBreaker = require('opossum');
   
   const redisOps = new CircuitBreaker(async (op) => {
     return await redis.send_command(op);
   }, {
     timeout: 3000,
     errorThresholdPercentage: 50,
     resetTimeout: 30000
   });
   ```

### Database Recovery Issues

#### Symptom: Recovery time > 30 seconds

**Diagnostic Steps:**
```bash
# 1. Simulate database restart
docker-compose restart postgres

# 2. Monitor application startup
DEBUG=* node src/app.js 2>&1 | grep -i "prisma\|database\|connection"

# 3. Check connection pool recovery
watch -n 1 'curl -s http://localhost:3000/health/detailed | jq ".data.database.connections"'

# 4. Review PostgreSQL logs
tail -f /var/lib/postgresql/data/log/postgresql.log | grep -i "starting\|ready"
```

**Solutions:**
1. **Implement connection pool warmup:**
   ```javascript
   // In database.js onConnect
   async function setupConnectionPool() {
     const poolSize = 25;
     for (let i = 0; i < poolSize; i++) {
       await prisma.$queryRaw`SELECT 1`.catch(() => {});
     }
   }
   ```

2. **Add faster health check:**
   ```javascript
   // Use simpler query for faster checks
   app.get('/health/ready', async (req, res) => {
     try {
       await prisma.$executeRaw`SELECT 1`;
       res.json({ status: 'ready' });
     } catch {
       res.status(503).json({ status: 'not-ready' });
     }
   });
   ```

3. **Pre-warm connections on startup:**
   ```bash
   # In docker-compose.yml
   services:
     app:
       environment:
         DATABASE_WARMUP_CONNECTIONS=true
         DATABASE_WARMUP_COUNT=10
   ```

---

## 📊 Performance Targets by Deployment Size

### Development (Single Server)
```
Webhook RPS:        > 100
Webhook p99:        < 2000ms
Vendor win rate:    > 99%
Redis availability: Not required
DB recovery time:   < 60s
```

### Staging (2-3 Servers)
```
Webhook RPS:        > 200
Webhook p99:        < 1000ms
Vendor win rate:    100%
Redis availability: Required
DB recovery time:   < 30s
```

### Production (5+ Servers)
```
Webhook RPS:        > 500
Webhook p99:        < 500ms
Vendor win rate:    100%
Redis availability: Required + Sentinel
DB recovery time:   < 10s
```

### Enterprise (10+ Servers)
```
Webhook RPS:        > 1000
Webhook p99:        < 200ms
Vendor win rate:    100%
Redis availability: Cluster + Sentinel
DB recovery time:   < 5s (with failover)
```

---

## 🚨 Emergency Performance Troubleshooting

### All tests failing - Complete system down

**5-minute recovery:**
1. Check service health:
   ```bash
   docker-compose ps
   curl http://localhost:3000/health
   ```

2. Restart services:
   ```bash
   docker-compose restart
   ```

3. Check logs:
   ```bash
   docker-compose logs app | tail -100
   ```

4. Rollback recent changes:
   ```bash
   git revert <commit>
   docker-compose rebuild
   docker-compose up -d
   ```

### High error rate during normal operations

**Immediate actions:**
1. Increase resources:
   ```bash
   # Temporarily increase DB pool
   DATABASE_POOL_SIZE=50
   docker-compose restart app
   ```

2. Enable circuit breaker:
   ```bash
   CIRCUIT_BREAKER_ENABLED=true
   docker restart app
   ```

3. Scale workers:
   ```bash
   docker-compose up -d --scale worker=10
   ```

### Memory leak detected

**Investigation:**
```bash
# Capture heap snapshot
curl http://localhost:3001/heap > heap-$(date +%s).heapsnapshot

# Load in Chrome DevTools
# chrome://inspect

# Or use autocannon for memory profiling
npx autocannon -c 10 http://localhost:3000/api/v1/products
```

---

## 📈 Continuous Performance Monitoring

### Weekly Review Checklist
- [ ] Review performance metrics dashboard
- [ ] Check for any P99 latency increases
- [ ] Review error rate trends
- [ ] Check database query performance
- [ ] Review Redis hit/miss ratio
- [ ] Check backup success rates

### Monthly Deep Dive
- [ ] Run full performance test suite
- [ ] Analyze slow query logs
- [ ] Review database query plans
- [ ] Check connection pool efficiency
- [ ] Review cache hit rates
- [ ] Plan capacity for next quarter

### Quarterly Planning
- [ ] Review performance targets vs actual
- [ ] Plan infrastructure upgrades
- [ ] Review and update tuning parameters
- [ ] Plan load testing for new features
- [ ] Review SLA compliance

---

## 🎓 Key Performance Principles

1. **Measure First**: Always establish baseline before tuning
2. **One Change at a Time**: Isolate impact of each optimization
3. **Monitor Continuously**: Use monitoring to catch regressions early
4. **Cache Aggressively**: But invalidate carefully
5. **Scale Horizontally**: Add more servers before adding complexity
6. **Fail Gracefully**: Degradation is better than complete failure
7. **Test Under Load**: Production-like load reveals real bottlenecks
8. **Document Everything**: Record breaking points and solutions

---

## 📞 Performance Support Matrix

| Issue | First Step | If Persists |
|-------|-----------|------------|
| Low RPS | Add DB indexes | Increase pool size |
| High Latency | Check slow queries | Add cache layer |
| Race Conditions | Verify constraints | Enable pessimistic locking |
| Redis Failures | Add circuit breaker | Implement fallback queue |
| DB Recovery Slow | Connection pool warmup | Add database failover |

---

*Last Updated: January 22, 2026*  
*Maintained by: Performance Engineering Team*
