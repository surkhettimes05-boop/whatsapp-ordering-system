# Health Endpoints - Quick Reference

## Endpoints at a Glance

| Endpoint | Response Time | Use Case |
|----------|--------------|----------|
| `GET /health` | 5-10ms | Basic liveness check |
| `GET /health/detailed` | 10-50ms | System diagnostics |
| **`GET /health/status`** | **150-300ms** | **Production monitoring (DB + Twilio + Queue)** ⭐ |
| **`GET /health/monitor`** | **10-50ms** | **Simple alert systems** ⭐ |
| `GET /health/ready` | 5-10ms | Kubernetes readiness |
| `GET /health/live` | 1-2ms | Kubernetes liveness |

## What's Checked

### `/health/status` (Recommended for Production)
```
✓ Database connectivity (latency)
✓ Twilio API reachability (account status)
✓ Queue system (Redis status + queues)
✓ System metrics (memory, CPU)
```

### `/health/monitor` (Recommended for Alerts)
```
✓ Database: true/false
✓ Twilio: true/false
✓ Queue: true/false
→ Returns 200 if any service is up, 503 if all down
```

## Test It

```bash
# Basic check
curl http://localhost:3000/health

# Full check (includes Twilio + Queue)
curl http://localhost:3000/health/status

# Simple monitoring
curl http://localhost:3000/health/monitor

# Pretty print
curl http://localhost:3000/health/status | jq '.'
```

## Expected Responses

### Health/Status (All Good)
```json
{
  "status": "ok",
  "services": {
    "database": { "status": "connected", "latency": "2ms" },
    "redis": { "status": "connected", "latency": "1ms" },
    "twilio": { "status": "connected", "latency": "145ms" },
    "queue": { "status": "operational", "latency": "1ms" }
  },
  "checks": {
    "database": "pass",
    "redis": "pass",
    "twilio": "pass",
    "queue": "pass"
  }
}
```

### Health/Monitor (All Good)
```json
{
  "status": "healthy",
  "checks": {
    "database": true,
    "twilio": true,
    "queue": true
  }
}
```

## Setup for Monitoring

### Prometheus
```yaml
# Add to prometheus.yml
scrape_configs:
  - job_name: 'backend-health'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/health/status'
    scrape_interval: 30s
```

### Kubernetes
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  periodSeconds: 5
```

### Simple Monitoring Script
```bash
# Monitor every 30 seconds
while true; do
  STATUS=$(curl -s http://localhost:3000/health/monitor | jq -r '.status')
  echo "[$(date)] System: $STATUS"
  sleep 30
done
```

## Key Features

✅ **Database Check** - Connection + latency  
✅ **Twilio API Check** - Account status + authentication  
✅ **Queue System Check** - Redis + BullMQ status + queue stats  
✅ **System Metrics** - Memory, CPU, disk usage  
✅ **Status Codes** - 200 (ok/degraded) or 503 (error)  
✅ **JSON Format** - Ready for monitoring tools  
✅ **Latency Tracking** - Performance monitoring  

## Requirements

Set these environment variables for full checks:

```
# Database (required)
DATABASE_URL=postgresql://...

# Twilio (optional, for Twilio checks)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=token...

# Redis (optional, for queue checks)
REDIS_URL=redis://localhost:6379
# or
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Common Scenarios

### Scenario 1: Database Connection Lost
- `/health/status` returns: `status: "degraded"`, database check: `"fail"`
- Response code: 200 (but marked degraded)
- Action: Check database connectivity

### Scenario 2: Twilio API Unreachable
- `/health/status` returns: `status: "degraded"`, twilio check: `"fail"`
- Response code: 200 (but marked degraded)
- Action: Check Twilio credentials, network, API status

### Scenario 3: Queue System Down
- `/health/status` returns: `status: "degraded"`, queue check: `"fail"`
- Response code: 200 (but marked degraded)
- Action: Check Redis connectivity

### Scenario 4: All Services Down
- `/health/status` returns: `status: "error"`
- Response code: 503
- Action: Critical - check all services

## For Dashboards

Use `/health/status` endpoint which returns:
```json
{
  "status": "ok|degraded|error",
  "services": { /* detailed info for each service */ },
  "checks": { /* pass/fail/skip for each */ },
  "system": { /* memory, CPU, disk usage */ }
}
```

Perfect for:
- Status dashboards
- Alert systems
- Performance tracking
- SLA monitoring

## For Simple Alerts

Use `/health/monitor` endpoint which returns:
```json
{
  "status": "healthy|unhealthy",
  "checks": { "database": true/false, "twilio": true/false, "queue": true/false }
}
```

Status code: 200 (healthy) or 503 (unhealthy)

Perfect for:
- Basic alerting
- Uptime monitoring
- Simple dashboards

---

**Need more details?** See [HEALTH_CHECK_ENDPOINTS.md](HEALTH_CHECK_ENDPOINTS.md)

