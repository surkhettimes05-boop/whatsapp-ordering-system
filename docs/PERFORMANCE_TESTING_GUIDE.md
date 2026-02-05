# ⚙️ Performance Testing & Tuning Guide

## 📋 Overview

Comprehensive performance testing suite for the WhatsApp Ordering System. Four major test scenarios identify system breaking points and provide tuning recommendations.

---

## 🏁 Test Suite Overview

### 1. **Webhook Load Test** - `webhook-load-test.js`
Tests the WhatsApp webhook endpoint under sustained load.

**Scenarios:**
- `light` - 10 concurrent requests
- `moderate` - 50 concurrent requests (default)
- `heavy` - 200 concurrent requests
- `stress` - 500 concurrent requests

**Usage:**
```bash
node tests/performance/webhook-load-test.js moderate
```

**Key Metrics:**
- Requests per second (RPS)
- Response time distribution (p50, p95, p99)
- Error rate
- Memory usage

---

### 2. **Vendor Race Simulation** - `vendor-race-test.js`
Tests race conditions in vendor acceptance logic.

**Scenarios:**
- `light` - 5 vendors competing 10 times
- `moderate` - 10 vendors competing 50 times (default)
- `heavy` - 25 vendors competing 100 times
- `stress` - 50 vendors competing 100 times

**Usage:**
```bash
node tests/performance/vendor-race-test.js moderate
```

**Key Metrics:**
- First vendor win rate (should be ~100%)
- Race conditions detected (should be 0)
- Average race resolution time

---

### 3. **Redis Failure Test** - `redis-failure-test.js`
Tests system resilience when Redis becomes unavailable.

**Scenarios:**
- `connection` - Simulate connection refused (30s)
- `timeout` - Simulate high latency (60s)
- `slow` - Slow Redis responses (45s)
- `crash` - Redis crashes and recovers (60s)
- `recovery` - Full restart and recovery (120s)

**Usage:**
```bash
node tests/performance/redis-failure-test.js crash
```

**Key Metrics:**
- Error rate during outage
- Queue backlog growth
- Recovery time
- Message loss

---

### 4. **Database Restart Test** - `db-restart-test.js`
Tests system behavior during PostgreSQL restart.

**Scenarios:**
- `graceful` - Graceful restart (systemctl stop/start)
- `crash` - Abrupt crash (SIGKILL)
- `pool` - Connection pool exhaustion
- `slow` - Slow queries blocking connections
- `cascade` - Cascading failures

**Usage:**
```bash
node tests/performance/db-restart-test.js graceful
```

**Key Metrics:**
- Success rate before/during/after failure
- Recovery time
- Transaction rollbacks

---

## 🚨 Breaking Points Reference

### Webhook Endpoint Breaking Points

| Metric | Threshold | Status | Action |
|--------|-----------|--------|--------|
| **RPS** | > 1000 | 🟢 Excellent | N/A |
| **RPS** | 500-1000 | 🟢 Good | Monitor |
| **RPS** | 100-500 | 🟠 Warning | Optimize |
| **RPS** | < 100 | 🔴 Critical | Immediate action |
| **p99 Latency** | < 500ms | 🟢 Good | N/A |
| **p99 Latency** | 500-2000ms | 🟠 Warning | Database bottleneck |
| **p99 Latency** | > 2000ms | 🔴 Critical | Severe bottleneck |
| **p99 Latency** | > 5000ms | 🔴 Critical | Queue saturation |
| **Error Rate** | < 0.1% | 🟢 Good | N/A |
| **Error Rate** | 0.1-1% | 🟠 Warning | Investigate |
| **Error Rate** | 1-5% | 🔴 Critical | Immediate action |
| **Error Rate** | > 5% | 🔴 Critical | System instability |

### Vendor Race Condition Breaking Points

| Metric | Threshold | Status | Action |
|--------|-----------|--------|--------|
| **Win Rate** | > 99% | 🟢 Excellent | N/A |
| **Win Rate** | 95-99% | 🟢 Good | Monitor |
| **Win Rate** | 80-95% | 🟠 Warning | Review constraints |
| **Win Rate** | < 80% | 🔴 Critical | Fix locking strategy |
| **Race Conditions** | 0% | 🟢 Excellent | N/A |
| **Race Conditions** | 0-1% | 🟠 Warning | Investigate |
| **Race Conditions** | > 1% | 🔴 Critical | Data integrity risk |
| **Race Time** | < 100ms | 🟢 Excellent | N/A |
| **Race Time** | 100-500ms | 🟢 Good | N/A |
| **Race Time** | 500-1000ms | 🟠 Warning | Check DB latency |
| **Race Time** | > 1000ms | 🔴 Critical | Transaction log review |

### Redis Failure Breaking Points

| Metric | Threshold | Status | Action |
|--------|-----------|--------|--------|
| **Error Rate** | 0% | 🟢 Excellent | Fallback working |
| **Error Rate** | 1-20% | 🟠 Warning | Partial fallback |
| **Error Rate** | 20-50% | 🔴 Critical | No fallback |
| **Error Rate** | > 50% | 🔴 Critical | System unusable |
| **Queue Backlog** | < 100 | 🟢 Good | N/A |
| **Queue Backlog** | 100-1000 | 🟠 Warning | Increase workers |
| **Queue Backlog** | > 1000 | 🔴 Critical | Scale workers |
| **Recovery Time** | < 5s | 🟢 Excellent | N/A |
| **Recovery Time** | 5-30s | 🟢 Good | Acceptable |
| **Recovery Time** | > 30s | 🔴 Critical | Optimize startup |

### Database Restart Breaking Points

| Metric | Threshold | Status | Action |
|--------|-----------|--------|--------|
| **During Failure** | 0% success | 🔴 Critical | Implement failover |
| **During Failure** | 1-10% success | 🟠 Warning | Add caching |
| **During Failure** | > 10% success | 🟡 Good | Fallback working |
| **Recovery Success** | > 99% | 🟢 Excellent | N/A |
| **Recovery Success** | 95-99% | 🟢 Good | Monitor connections |
| **Recovery Success** | < 95% | 🔴 Critical | Connection pool issue |
| **Recovery Time** | < 5s | 🟢 Excellent | N/A |
| **Recovery Time** | 5-10s | 🟢 Good | Acceptable |
| **Recovery Time** | 10-30s | 🟠 Warning | Optimize warmup |
| **Recovery Time** | > 30s | 🔴 Critical | Add failover |

---

## 🔧 Tuning Recommendations by Breaking Point

### Webhook Endpoint Performance Issues

#### Issue: RPS < 100 (Critical)
**Symptoms:**
- p99 latency > 5 seconds
- Consistent queueing
- Memory pressure

**Root Causes:**
1. Database connection pool exhausted
2. Node.js event loop blocked
3. Memory leaks in webhook handler

**Solutions (Priority Order):**
1. **Increase DB connection pool:**
   ```bash
   # .env
   DATABASE_POOL_SIZE=30        # Increase from default 10
   DATABASE_POOL_MAX=50         # Max connections
   ```
   Expected improvement: +30-40% RPS

2. **Enable webhook response caching:**
   ```bash
   # Implement Redis cache for idempotency responses
   # Cache TTL: 300 seconds
   ```
   Expected improvement: +20-30% RPS

3. **Add webhook queue batching:**
   ```bash
   # Process multiple webhooks in batch
   WEBHOOK_BATCH_SIZE=10
   WEBHOOK_BATCH_TIMEOUT=100
   ```
   Expected improvement: +40-50% RPS

4. **Enable compression:**
   ```bash
   # Already enabled, verify in production.middleware.js
   NODE_ENV=production
   ```

#### Issue: p99 Latency > 2000ms
**Symptoms:**
- Some requests very slow
- Inconsistent performance
- Database disk I/O high

**Solutions:**
1. **Add query indexing:**
   ```sql
   -- For webhook_idempotency lookups
   CREATE INDEX IF NOT EXISTS 
     idx_webhook_idempotency_message_sid 
     ON webhook_idempotency(message_sid);
   
   -- For routing lookups
   CREATE INDEX IF NOT EXISTS 
     idx_vendor_routing_responses_routing_id 
     ON vendor_routing_responses(routing_id);
   ```

2. **Add read replicas:**
   ```bash
   # Configure read-only PostgreSQL replica
   DATABASE_READ_REPLICA_URL=postgresql://...
   ```

3. **Enable query result caching:**
   ```bash
   CACHE_STRATEGY=redis
   CACHE_TTL=3600
   ```

#### Issue: Error Rate > 1%
**Symptoms:**
- Intermittent 503 errors
- Timeout errors
- Connection refused errors

**Solutions:**
1. **Implement circuit breaker:**
   ```bash
   CIRCUIT_BREAKER_THRESHOLD=5
   CIRCUIT_BREAKER_TIMEOUT=30000
   ```

2. **Add retry logic with exponential backoff:**
   ```bash
   RETRY_ATTEMPTS=3
   RETRY_DELAY=100
   RETRY_MAX_DELAY=5000
   ```

3. **Increase webhook timeout:**
   ```bash
   WEBHOOK_TIMEOUT=10000  # Increased from 5000ms
   ```

---

### Vendor Race Condition Issues

#### Issue: Win Rate < 95% (Race Conditions)
**Symptoms:**
- Multiple vendors accepting same order
- Data integrity violations
- Duplicate order assignments

**Root Causes:**
1. Missing UNIQUE constraint on vendor response
2. Transaction isolation level too low
3. Optimistic locking without version check

**Solutions (Critical):**
1. **Enforce database constraint:**
   ```sql
   -- Ensure only one vendor can accept per routing
   ALTER TABLE vendor_routing_responses 
   ADD CONSTRAINT unique_routing_acceptance 
   UNIQUE (routing_id) 
   WHERE response = 'ACCEPTED';
   ```

2. **Use pessimistic locking:**
   ```javascript
   // In vendorRouting.service.js
   const routing = await prisma.vendorRouting.findUnique({
     where: { id: routingId }
   });
   
   // Lock the row
   await prisma.$executeRaw`
     SELECT * FROM vendor_routing WHERE id = ${routingId} FOR UPDATE;
   `;
   ```

3. **Increase transaction isolation:**
   ```bash
   # .env
   DATABASE_TRANSACTION_ISOLATION=SERIALIZABLE
   ```

#### Issue: Race Time > 1000ms
**Symptoms:**
- Long time to determine winner
- Slow vendor response processing
- Database lock contention

**Solutions:**
1. **Optimize vendor response query:**
   ```sql
   CREATE INDEX IF NOT EXISTS 
     idx_vendor_routing_responses_routing_response 
     ON vendor_routing_responses(routing_id, response);
   ```

2. **Add Redis cache for routing state:**
   ```bash
   CACHE_ROUTING_STATE=true
   ROUTING_CACHE_TTL=300
   ```

3. **Implement fast-path for first acceptance:**
   ```javascript
   // Use atomic Redis INCR for fast counting
   const acceptCount = await redis.incr(`routing:${routingId}:accepts`);
   if (acceptCount === 1) {
     // This vendor won
   }
   ```

---

### Redis Failure Resilience Issues

#### Issue: Error Rate > 20% During Outage
**Symptoms:**
- Queue operations fail immediately
- No message queuing
- Complete service degradation

**Root Causes:**
1. No Redis fallback mechanism
2. Synchronous Redis dependencies
3. Missing circuit breaker

**Solutions:**
1. **Implement Redis fallback to database:**
   ```javascript
   // In queue.js
   if (redisUnavailable) {
     // Fall back to database job queue
     await Job.create({ type, payload });
   }
   ```

2. **Make Redis operations async with timeout:**
   ```javascript
   const result = await Promise.race([
     redisOperation(),
     new Promise((_, reject) => 
       setTimeout(() => reject(new Error('timeout')), 1000)
     )
   ]).catch(() => null);
   ```

3. **Add circuit breaker pattern:**
   ```bash
   # .env
   REDIS_CIRCUIT_BREAKER=true
   REDIS_FAILURE_THRESHOLD=5
   REDIS_FAILURE_TIMEOUT=60000
   ```

#### Issue: Queue Backlog > 1000 During Outage
**Symptoms:**
- Long message queues
- Processing delays
- Memory buildup

**Solutions:**
1. **Increase worker count:**
   ```bash
   # docker-compose.yml
   environment:
     WORKER_CONCURRENCY=10  # Increased from default
   ```

2. **Add queue batching:**
   ```bash
   QUEUE_BATCH_SIZE=50
   QUEUE_BATCH_TIMEOUT=500
   ```

3. **Implement priority queues:**
   ```bash
   HIGH_PRIORITY_QUEUE_WORKERS=5
   NORMAL_PRIORITY_QUEUE_WORKERS=3
   LOW_PRIORITY_QUEUE_WORKERS=1
   ```

---

### Database Restart Issues

#### Issue: Recovery Time > 30s
**Symptoms:**
- Long downtime after restart
- Stuck connections
- Slow application startup

**Root Causes:**
1. Large connection pool not recovering
2. Long-running transactions not rolling back
3. Database warmup time

**Solutions:**
1. **Implement connection pool warmup:**
   ```javascript
   // In database.js startup
   async function warmupConnectionPool() {
     const promises = [];
     for (let i = 0; i < poolSize / 2; i++) {
       promises.push(
         prisma.$queryRaw`SELECT 1`
       );
     }
     await Promise.allSettled(promises);
   }
   ```

2. **Add faster health check:**
   ```bash
   HEALTH_CHECK_TIMEOUT=3000  # Reduced from 5000ms
   HEALTH_CHECK_QUERY="SELECT 1"
   ```

3. **Enable connection pooling with PgBouncer:**
   ```bash
   # docker-compose.yml
   services:
     pgbouncer:
       image: edoburu/pgbouncer
       environment:
         DATABASE_URL: postgresql://...
         POOL_MODE: transaction
         MAX_CLIENT_CONN: 1000
         DEFAULT_POOL_SIZE: 25
   ```

#### Issue: Success Rate < 95% After Recovery
**Symptoms:**
- Some queries still failing post-recovery
- Stale connection errors
- Transaction state corruption

**Solutions:**
1. **Implement connection validation:**
   ```javascript
   // In database.js
   prisma.$use(async (params, next) => {
     try {
       return await next(params);
     } catch (error) {
       if (error.code === 'P2002') {
         // Connection error, reconnect
         await prisma.$disconnect();
         await prisma.$connect();
       }
       throw error;
     }
   });
   ```

2. **Add connection reset on failure:**
   ```bash
   DATABASE_AUTO_RECONNECT=true
   DATABASE_RECONNECT_TIMEOUT=5000
   ```

3. **Implement request retry with fresh connection:**
   ```javascript
   if (isConnectionError(error)) {
     // Clear connection pool
     await prisma.$disconnect();
     // Retry with fresh connection
     return retryWithBackoff(() => nextQuery());
   }
   ```

---

## 📊 Performance Benchmarks (Target)

### Production Targets

```
Webhook Endpoint:
  - 500+ RPS sustained
  - p95 latency < 200ms
  - p99 latency < 500ms
  - Error rate < 0.1%

Vendor Race:
  - 100% win rate accuracy
  - < 100ms average race time
  - 0% race conditions

Redis Failure Resilience:
  - < 1% error rate during outage
  - Queue backlog < 100 during outage
  - Recovery time < 5 seconds

Database Restart:
  - > 99% recovery success
  - Recovery time < 10 seconds
  - 0% transaction rollbacks
```

---

## 🚀 Running Tests in CI/CD

### GitHub Actions Example
```yaml
name: Performance Tests

on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
      redis:
        image: redis:7

    steps:
      - uses: actions/checkout@v3
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run webhook load test
        run: node tests/performance/webhook-load-test.js moderate
      
      - name: Run vendor race test
        run: node tests/performance/vendor-race-test.js moderate
      
      - name: Run Redis failure test
        run: node tests/performance/redis-failure-test.js timeout
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: '*-test-results.json'
```

---

## 📈 Monitoring Integration

### Prometheus Metrics to Track
```
# Webhook endpoint
whatsapp_webhook_requests_total
whatsapp_webhook_duration_seconds
whatsapp_webhook_errors_total

# Vendor routing
vendor_routing_races_total
vendor_routing_win_rate
vendor_routing_response_time_seconds

# Redis
redis_connection_errors_total
redis_queue_backlog
redis_recovery_time_seconds

# Database
db_connection_pool_usage
db_recovery_time_seconds
db_transaction_rollbacks_total
```

### Alert Rules (Recommended)
```yaml
groups:
  - name: Performance
    rules:
      - alert: HighWebhookLatency
        expr: whatsapp_webhook_duration_seconds{quantile="0.99"} > 2
        
      - alert: LowWebhookThroughput
        expr: rate(whatsapp_webhook_requests_total[5m]) < 100
        
      - alert: RaceConditionDetected
        expr: vendor_routing_races_total - vendor_routing_win_rate > 0
        
      - alert: RedisOutage
        expr: up{job="redis"} == 0
        
      - alert: DatabaseRecoveryLong
        expr: db_recovery_time_seconds > 30
```

---

## 🎯 Tuning Decision Tree

```
Does webhook RPS < 100?
├─ YES → Increase DB pool size first
│         ├─ If still low → Enable response caching
│         └─ If still low → Implement webhook queuing
│
└─ NO  → Check p99 latency
         ├─ > 2000ms → Add database indexing
         ├─ > 500ms  → Review slow queries
         └─ < 500ms  → OK, monitor only

Does vendor race have conditions?
├─ YES → Add UNIQUE constraint
│         └─ If persists → Enable pessimistic locking
│
└─ NO  → OK, monitor acceptance time

Does Redis failure cause > 20% errors?
├─ YES → Implement fallback queue
│         └─ Monitor backlog and scale workers
│
└─ NO  → OK, system resilient

Does DB recovery take > 30s?
├─ YES → Implement connection pool warmup
│         └─ Monitor recovery logs
│
└─ NO  → OK, acceptable recovery time
```

---

## 📞 Performance Support

**For test failures or questions:**
1. Check test output for specific breaking point
2. Cross-reference with Breaking Points Reference table
3. Follow Tuning Recommendations
4. Verify changes with re-running test
5. Monitor metrics before/after changes

**Performance budgets per feature:**
- New endpoint: Must achieve > 100 RPS
- Database operation: Must be < 100ms p99
- Queue operation: Must be < 50ms p99
- Cache miss penalty: Must be < 200ms p99

---

*Last Updated: January 22, 2026*
*Status: Production Testing Guide*
