# 📍 Performance Engineering Suite - Navigation Index

## 🎯 Start Here

**First Time?** → [00_PERFORMANCE_ENGINEERING_SUMMARY.md](../00_PERFORMANCE_ENGINEERING_SUMMARY.md) (2 min read)

**Want to Run Tests?** → [Quick Start](#-quick-start) (below)

**Need Tuning Help?** → [PERFORMANCE_TUNING_IMPLEMENTATION.md](./PERFORMANCE_TUNING_IMPLEMENTATION.md)

**Breaking Point Reference?** → [PERFORMANCE_TESTING_GUIDE.md](./PERFORMANCE_TESTING_GUIDE.md)

---

## 🚀 Quick Start

### 1. Run All Tests (10 minutes)
```bash
cd backend
chmod +x tests/performance/run-performance-tests.sh
./tests/performance/run-performance-tests.sh all
```

### 2. Run Individual Tests
```bash
# Webhook endpoint load test
node tests/performance/webhook-load-test.js moderate

# Vendor race condition detector
node tests/performance/vendor-race-test.js moderate

# Redis failure resilience
node tests/performance/redis-failure-test.js timeout

# Database restart recovery
node tests/performance/db-restart-test.js graceful
```

### 3. View Results
```bash
# Individual test results
cat performance-results/*.json

# Parse with jq
jq '.stats' performance-results/*.json
```

---

## 📚 Documentation Guide

### For Performance Engineers
1. Start: [00_PERFORMANCE_ENGINEERING_SUMMARY.md](../00_PERFORMANCE_ENGINEERING_SUMMARY.md) - Overview
2. Reference: [PERFORMANCE_TESTING_GUIDE.md](./PERFORMANCE_TESTING_GUIDE.md) - Breaking points
3. Deep Dive: [PERFORMANCE_TUNING_IMPLEMENTATION.md](./PERFORMANCE_TUNING_IMPLEMENTATION.md) - Implementation

### For DevOps/SRE
1. [PERFORMANCE_TUNING_IMPLEMENTATION.md](./PERFORMANCE_TUNING_IMPLEMENTATION.md) - Infrastructure changes
2. [PERFORMANCE_TESTING_GUIDE.md](./PERFORMANCE_TESTING_GUIDE.md) - Infrastructure tuning section
3. [run-performance-tests.sh](./tests/performance/run-performance-tests.sh) - Automation

### For Backend Engineers
1. [PERFORMANCE_TESTING_GUIDE.md](./PERFORMANCE_TESTING_GUIDE.md) - Webhook/Race sections
2. [PERFORMANCE_TUNING_IMPLEMENTATION.md](./PERFORMANCE_TUNING_IMPLEMENTATION.md) - Application optimization
3. Individual test source code for deep understanding

### For QA/Testing
1. [PERFORMANCE_TESTING_GUIDE.md](./PERFORMANCE_TESTING_GUIDE.md) - Test scenarios
2. [run-performance-tests.sh](./tests/performance/run-performance-tests.sh) - How to run tests
3. [00_PERFORMANCE_ENGINEERING_DELIVERY.md](../00_PERFORMANCE_ENGINEERING_DELIVERY.md) - Success criteria

---

## 📋 The 4 Tests at a Glance

### Test 1: Webhook Load Test
**File**: `webhook-load-test.js` (350 lines)

**What**: Tests WhatsApp webhook endpoint under concurrent load

**Scenarios**: light (10), moderate (50), heavy (200), stress (500)

**Key Metric**: RPS (requests per second)

**Breaking Point**: RPS < 100 🔴 Critical

**Run**: `node tests/performance/webhook-load-test.js moderate`

---

### Test 2: Vendor Race Simulation
**File**: `vendor-race-test.js` (400 lines)

**What**: Detects race conditions in vendor acceptance logic

**Scenarios**: light (5v), moderate (10v), heavy (25v), stress (50v)

**Key Metric**: Win rate (% of races with single winner)

**Breaking Point**: Race conditions > 0% 🔴 Critical

**Run**: `node tests/performance/vendor-race-test.js moderate`

---

### Test 3: Redis Failure Test
**File**: `redis-failure-test.js` (500 lines)

**What**: Tests system resilience when Redis becomes unavailable

**Scenarios**: connection, timeout, slow, crash, recovery

**Key Metric**: Error rate during outage

**Breaking Point**: Error rate > 20% 🔴 Critical

**Run**: `node tests/performance/redis-failure-test.js timeout`

---

### Test 4: Database Restart Test
**File**: `db-restart-test.js` (450 lines)

**What**: Tests system behavior during PostgreSQL restart/crash

**Scenarios**: graceful, crash, pool, slow, cascade

**Key Metric**: Recovery time

**Breaking Point**: Recovery time > 30s 🔴 Critical

**Run**: `node tests/performance/db-restart-test.js graceful`

---

## 🔍 Breaking Points Reference (At a Glance)

### Webhook Endpoint
| Metric | 🟢 Good | 🟠 Warning | 🔴 Critical |
|--------|---------|-----------|------------|
| RPS | > 500 | 100-500 | < 100 |
| p99 Latency | < 500ms | 500-2000ms | > 2000ms |
| Error Rate | < 0.1% | 0.1-1% | > 1% |

### Vendor Race Conditions
| Metric | 🟢 Good | 🟠 Warning | 🔴 Critical |
|--------|---------|-----------|------------|
| Win Rate | > 99% | 95-99% | < 95% |
| Race Conditions | 0% | 0-1% | > 1% |
| Race Time | < 100ms | 100-1000ms | > 1000ms |

### Redis Failure Resilience
| Metric | 🟢 Good | 🟠 Warning | 🔴 Critical |
|--------|---------|-----------|------------|
| Outage Error Rate | 0% | 1-20% | > 20% |
| Queue Backlog | < 100 | 100-1000 | > 1000 |
| Recovery Time | < 5s | 5-30s | > 30s |

### Database Recovery
| Metric | 🟢 Good | 🟠 Warning | 🔴 Critical |
|--------|---------|-----------|------------|
| Recovery Time | < 5s | 5-30s | > 30s |
| Success Rate | > 99% | 95-99% | < 95% |

---

## 🔧 Tuning Decision Tree

```
START: Do you have a breaking point?

├─ Webhook RPS < 100
│  ├─ Add indexes (+15-25%)
│  ├─ Increase pool (+30-40%)
│  ├─ Add caching (+20-30%)
│  └─ Implement queuing (+40-50%)
│
├─ Race conditions detected
│  ├─ Add UNIQUE constraint
│  ├─ Enable pessimistic locking
│  └─ Increase isolation level
│
├─ Redis failure error rate > 20%
│  ├─ Implement DB fallback queue
│  ├─ Add circuit breaker
│  └─ Scale workers
│
└─ DB recovery time > 30s
   ├─ Implement connection pool warmup
   ├─ Add faster health checks
   └─ Deploy PgBouncer
```

---

## 📊 Performance Targets

### Development
- Webhook RPS: > 100
- Webhook p99: < 2000ms
- Vendor win rate: > 99%
- DB recovery: < 60s

### Staging
- Webhook RPS: > 200
- Webhook p99: < 1000ms
- Vendor win rate: 100%
- DB recovery: < 30s

### Production
- Webhook RPS: > 500
- Webhook p99: < 500ms
- Vendor win rate: 100%
- DB recovery: < 10s

### Enterprise
- Webhook RPS: > 1000
- Webhook p99: < 200ms
- Vendor win rate: 100%
- DB recovery: < 5s (with failover)

---

## 🚨 Breaking Point Response

### If You See These...

**Webhook p99 > 2000ms**
1. Check PERFORMANCE_TESTING_GUIDE.md → Webhook section
2. Run: `psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"`
3. Add indexes to top 3 slow queries
4. Re-test: `node tests/performance/webhook-load-test.js moderate`

**Race conditions > 0%**
1. Check PERFORMANCE_TESTING_GUIDE.md → Vendor Race section
2. Verify: `psql $DATABASE_URL -c "\d vendor_routing_responses" | grep constraint`
3. Add UNIQUE constraint if missing
4. Re-test: `node tests/performance/vendor-race-test.js moderate`

**Redis outage error rate > 20%**
1. Check PERFORMANCE_TUNING_IMPLEMENTATION.md → Redis section
2. Implement database fallback queue
3. Add circuit breaker pattern
4. Re-test: `node tests/performance/redis-failure-test.js crash`

**DB recovery > 30s**
1. Check PERFORMANCE_TUNING_IMPLEMENTATION.md → Database section
2. Implement connection pool warmup
3. Deploy PgBouncer if available
4. Re-test: `node tests/performance/db-restart-test.js graceful`

---

## 📈 CI/CD Integration

### GitHub Actions
```yaml
name: Performance Tests
on: [pull_request]

jobs:
  perf:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
      redis:
        image: redis:7

    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: ./tests/performance/run-performance-tests.sh quick
      - uses: actions/upload-artifact@v3
        with:
          name: perf-results
          path: performance-results/
```

### Pre-deployment
```bash
#!/bin/bash
./tests/performance/run-performance-tests.sh quick

for test in performance-results/*-results.json; do
  error_rate=$(jq '.stats.errorRate' "$test")
  if (( $(echo "$error_rate > 1" | bc -l) )); then
    echo "❌ Error rate too high"
    exit 1
  fi
done

echo "✅ Performance tests passed"
```

---

## 📞 Quick Help

### Test won't run?
```bash
# Check Node version (need v14+)
node --version

# Check dependencies
npm list axios express

# Try with absolute path
node $(pwd)/tests/performance/webhook-load-test.js moderate
```

### Tests too slow?
```bash
# Run light scenarios instead
./tests/performance/run-performance-tests.sh quick

# Or run individual tests with light scenario
node tests/performance/webhook-load-test.js light
```

### Results confusing?
```bash
# Extract just the key metrics
jq '.stats | {rps, latency: .responseTimes.p99, errorRate}' \
  webhook-load-test-results.json

# Compare before/after
diff <(jq '.stats' baseline.json) <(jq '.stats' current.json)
```

### Need more details?
- See [PERFORMANCE_TESTING_GUIDE.md](./PERFORMANCE_TESTING_GUIDE.md) for detailed reference
- See [PERFORMANCE_TUNING_IMPLEMENTATION.md](./PERFORMANCE_TUNING_IMPLEMENTATION.md) for implementation details
- Check individual test source code for advanced customization

---

## ✅ Success Checklist

After implementing the performance suite:

- [ ] All 4 tests run successfully
- [ ] Baseline metrics established
- [ ] Breaking points identified
- [ ] Tuning plan created based on breaking points
- [ ] Phase 1 (database) tuning complete
- [ ] Phase 2 (application) tuning complete
- [ ] Phase 3 (infrastructure) tuning complete
- [ ] Performance targets achieved
- [ ] Tests integrated into CI/CD
- [ ] Team trained on performance monitoring
- [ ] Documentation reviewed and understood

---

## 📚 File Structure

```
backend/
├── tests/performance/                    # Test suite directory
│   ├── webhook-load-test.js             # Test 1: Webhook load
│   ├── vendor-race-test.js              # Test 2: Vendor race
│   ├── redis-failure-test.js            # Test 3: Redis failure
│   ├── db-restart-test.js               # Test 4: DB restart
│   └── run-performance-tests.sh         # Test runner script
│
├── PERFORMANCE_TESTING_GUIDE.md         # Breaking points reference
├── PERFORMANCE_TUNING_IMPLEMENTATION.md # Implementation guide
└── performance-results/                  # Auto-generated results
    └── *.json                            # Test result files

root/
├── 00_PERFORMANCE_ENGINEERING_DELIVERY.md  # Complete delivery
├── 00_PERFORMANCE_ENGINEERING_SUMMARY.md   # Visual summary
└── tests/performance/PERFORMANCE_INDEX.md  # This file
```

---

## 🎯 Next Steps

1. **Understand** - Read [00_PERFORMANCE_ENGINEERING_SUMMARY.md](../00_PERFORMANCE_ENGINEERING_SUMMARY.md)
2. **Test** - Run `./tests/performance/run-performance-tests.sh quick`
3. **Analyze** - Review breaking points in [PERFORMANCE_TESTING_GUIDE.md](./PERFORMANCE_TESTING_GUIDE.md)
4. **Implement** - Follow [PERFORMANCE_TUNING_IMPLEMENTATION.md](./PERFORMANCE_TUNING_IMPLEMENTATION.md)
5. **Monitor** - Set up continuous testing in CI/CD
6. **Iterate** - Retest after each change

---

**Status**: ✅ Production Ready

**Last Updated**: January 22, 2026

**Questions?** See individual documentation files or review test source code
