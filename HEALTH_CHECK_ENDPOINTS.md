# Health Check Endpoints - Complete Documentation

## Overview

A comprehensive health monitoring system for your WhatsApp ordering backend with multiple endpoints tailored for different monitoring scenarios.

## Endpoints

### 1. `/health` - Basic Health Check
**Purpose:** Quick status check  
**Method:** GET  
**Status Code:** 200 (ok) or 503 (error)

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-19T10:30:45.123Z",
  "uptime": 3600.45,
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

**Use Case:** Quick liveness check, basic monitoring

---

### 2. `/health/detailed` - Full System Diagnostics
**Purpose:** Comprehensive system health with detailed metrics  
**Method:** GET  
**Status Code:** 200 or 503

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-19T10:30:45.123Z",
  "uptime": 3600.45,
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "database": {
      "status": "connected",
      "latency": "2ms"
    },
    "redis": {
      "status": "connected",
      "latency": "1ms"
    }
  },
  "system": {
    "memory": {
      "total": "16.00 GB",
      "used": "4.23 GB",
      "free": "11.77 GB",
      "usage": "26.44%"
    },
    "cpu": {
      "loadAverage": [0.5, 0.3, 0.2],
      "cores": 4
    },
    "uptime": "1.00 hours",
    "disk": {
      "status": "ok"
    }
  },
  "checks": {
    "database": "pass",
    "redis": "pass"
  }
}
```

**Use Case:** System diagnostics, detailed monitoring dashboards

---

### 3. `/health/status` - Comprehensive Service Status (NEW)
**Purpose:** Complete health check including **database**, **Twilio API**, and **queue system**  
**Method:** GET  
**Status Code:** 200 (ok), 200 (degraded), or 503 (error)

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-19T10:30:45.123Z",
  "uptime": 3600.45,
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "database": {
      "status": "connected",
      "latency": "2ms"
    },
    "redis": {
      "status": "connected",
      "latency": "1ms"
    },
    "twilio": {
      "status": "connected",
      "latency": "145ms",
      "accountName": "My Business",
      "accountStatus": "active"
    },
    "queue": {
      "status": "operational",
      "latency": "1ms",
      "redis": {
        "version": "7.0.0",
        "uptime": "86400s",
        "memory": "2.5M",
        "connectedClients": "5",
        "commandsProcessed": "1000000"
      },
      "queues": {
        "count": 3,
        "totalKeys": 9
      }
    }
  },
  "checks": {
    "database": "pass",
    "redis": "pass",
    "twilio": "pass",
    "queue": "pass"
  }
}
```

**Status Values:**
- `ok` - All services operational
- `degraded` - Some services down (but system running)
- `error` - Critical services down

**Use Case:** **Production monitoring** - checks all external dependencies

---

### 4. `/health/monitor` - Simple Monitoring Endpoint (NEW)
**Purpose:** Quick health check for monitoring tools  
**Method:** GET  
**Status Code:** 200 (healthy) or 503 (unhealthy)

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-19T10:30:45.123Z",
  "checks": {
    "database": true,
    "twilio": true,
    "queue": true
  },
  "uptime": 3600.45
}
```

**Use Case:** Simple monitoring dashboards, alerting systems, load balancers

---

### 5. `/health/ready` - Readiness Probe (Kubernetes)
**Purpose:** Indicates if system is ready to serve requests  
**Method:** GET  
**Status Code:** 200 (ready) or 503 (not ready)

**Response:**
```json
{
  "status": "ready",
  "timestamp": "2024-01-19T10:30:45.123Z"
}
```

**Use Case:** Kubernetes readiness probes

---

### 6. `/health/live` - Liveness Probe (Kubernetes)
**Purpose:** Indicates if process is running  
**Method:** GET  
**Status Code:** Always 200

**Response:**
```json
{
  "status": "alive",
  "timestamp": "2024-01-19T10:30:45.123Z",
  "uptime": 3600.45
}
```

**Use Case:** Kubernetes liveness probes

---

## Service Checks Explained

### 1. Database Connectivity
- **What it checks:** PostgreSQL/Prisma connection
- **How:** Executes simple query `SELECT 1`
- **Latency:** Typical: 1-5ms
- **Failure indication:** Database is down or unreachable

### 2. Twilio API Reachability
- **What it checks:** Twilio API connectivity and credentials
- **How:** Fetches account information using Twilio SDK
- **Credentials needed:**
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
- **Latency:** Typical: 100-300ms (network dependent)
- **Response includes:**
  - Account friendly name
  - Account status (active/suspended)
  - Response latency
- **Failure indication:** 
  - Invalid credentials
  - Twilio API unreachable
  - Credentials not configured

### 3. Queue System Status
- **What it checks:** Redis connectivity and queue operations
- **How:** Connects to Redis and retrieves system info
- **Latency:** Typical: 1-5ms
- **Response includes:**
  - Redis version
  - Redis uptime
  - Memory usage
  - Connected clients
  - Queue count and statistics
- **Failure indication:**
  - Redis is down
  - Queue system not initialized

---

## Usage Examples

### Example 1: Basic Monitoring Script
```bash
#!/bin/bash

# Check health every 30 seconds
while true; do
  STATUS=$(curl -s http://localhost:3000/health/monitor)
  HEALTH=$(echo $STATUS | jq -r '.status')
  
  if [ "$HEALTH" = "healthy" ]; then
    echo "✅ System is healthy"
  else
    echo "❌ System is unhealthy"
    echo $STATUS | jq '.'
  fi
  
  sleep 30
done
```

### Example 2: Monitoring Dashboard Integration
```javascript
// Fetch comprehensive status for dashboard
async function updateDashboard() {
  const response = await fetch('/health/status');
  const health = await response.json();
  
  // Update UI with service status
  updateServiceStatus('Database', health.services.database);
  updateServiceStatus('Twilio', health.services.twilio);
  updateServiceStatus('Queue', health.services.queue);
  
  // Show system metrics
  displayMemoryUsage(health.system.memory.usage);
  displayCPULoad(health.system.cpu.loadAverage);
}
```

### Example 3: Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: whatsapp-backend
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: backend
        image: whatsapp-backend:latest
        
        # Liveness probe - restart if not responding
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
        
        # Readiness probe - remove from load balancer if not ready
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Example 4: Alert Setup (Prometheus/Grafana)
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'whatsapp-backend'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/health/status'

# Alert rules
- alert: DatabaseDown
  expr: health_services_database_status == 0
  for: 2m
  annotations:
    summary: "Database connection lost"

- alert: TwilioUnreachable
  expr: health_services_twilio_status == 0
  for: 5m
  annotations:
    summary: "Twilio API unreachable"

- alert: QueueSystemDown
  expr: health_services_queue_status == 0
  for: 1m
  annotations:
    summary: "Queue system is down"
```

---

## Which Endpoint to Use?

| Use Case | Endpoint | Reason |
|----------|----------|--------|
| Quick liveness check | `/health` | Minimal overhead, fast response |
| Full diagnostics | `/health/detailed` | Includes system metrics |
| Production monitoring | `/health/status` | Checks all external APIs |
| Simple alerts | `/health/monitor` | Boolean status for monitoring tools |
| Kubernetes liveness | `/health/live` | Detects process crashes |
| Kubernetes readiness | `/health/ready` | Graceful deployment rollouts |
| Dashboard display | `/health/status` | Human-readable, detailed |

---

## Status Code Reference

| Code | Status | Meaning |
|------|--------|---------|
| 200 | OK / Degraded | System operational (degraded if not all services available) |
| 503 | Error | Critical services down, not operational |

---

## Response Time Expectations

| Endpoint | Typical Time | Max Time (timeout) |
|----------|--------------|-------------------|
| `/health` | 5-10ms | 1s |
| `/health/detailed` | 10-50ms | 2s |
| `/health/status` | 150-300ms | 5s (Twilio API dominates) |
| `/health/monitor` | 10-50ms | 2s |
| `/health/ready` | 5-10ms | 1s |
| `/health/live` | 1-2ms | 100ms |

---

## Environment Variables Required

For full health checks:

```
# Database (required)
DATABASE_URL=postgresql://...

# Twilio (optional, but recommended for production)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=your_token

# Redis/Queue (optional)
REDIS_URL=redis://...
# or
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## Troubleshooting

### Twilio Check Returns "not_configured"
**Issue:** Credentials missing  
**Solution:** Set `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in `.env`

### Queue Check Returns "not_available"
**Issue:** Redis not connected  
**Solution:** Ensure Redis is running and `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT` are set

### High Latency on `/health/status`
**Issue:** Twilio API is slow  
**Solution:** 
- Normal - Twilio API can take 100-500ms
- If consistently > 300ms, check network/Twilio status
- Use `/health/monitor` for faster checks if Twilio latency is acceptable

### 503 Error on `/health/ready`
**Issue:** Database not accessible  
**Solution:**
- Check database connection string
- Verify database server is running
- Check network connectivity to database

---

## Integration with Monitoring Tools

### DataDog
```python
from datadog import initialize, api
import requests

options = {
    'api_key': 'YOUR_API_KEY',
    'app_key': 'YOUR_APP_KEY'
}

initialize(**options)

# Create monitor
api.Monitor.create(
    type='http_check',
    query='http://your-backend.com/health/status',
    name='WhatsApp Backend Health',
    message='Alert when backend is unhealthy'
)
```

### New Relic
```javascript
const newrelic = require('newrelic');

// Record custom metric
newrelic.recordMetric('health/database_latency', dbLatency);
newrelic.recordMetric('health/twilio_latency', twilioLatency);
```

### CloudWatch (AWS)
```bash
# Create custom dashboard
aws cloudwatch put-metric-alarm \
  --alarm-name backend-health \
  --metric-name HealthStatus \
  --namespace WhatsApp/Backend \
  --statistic Average \
  --period 300 \
  --threshold 1 \
  --comparison-operator LessThanThreshold
```

---

## Production Best Practices

1. **Monitor `/health/status` every 30 seconds** - Catches issues early
2. **Alert on degraded status** - Investigate before error
3. **Track latency trends** - Database/Twilio slowness warning
4. **Use `/health/live` for Kubernetes** - Process-level monitoring
5. **Set up dashboard** - Visualize service health over time
6. **Log health check failures** - Audit trail for incidents
7. **Test all checks in staging** - Ensure configs work
8. **Set reasonable timeouts** - 5-10 second max for all checks

---

## Code Reference

### Adding Custom Service Checks

To add new service checks to the health controller:

```javascript
// In health.controller.js
async checkCustomService() {
  try {
    const startTime = Date.now();
    // Your service check logic
    const latency = Date.now() - startTime;
    
    return {
      status: 'operational',
      latency: `${latency}ms`,
      // Additional info
    };
  } catch (error) {
    return {
      status: 'disconnected',
      error: error.message
    };
  }
}

// In getHealthStatus method
const customStatus = await this.checkCustomService();
health.services.customService = customStatus;
health.checks.customService = customStatus.status === 'operational' ? 'pass' : 'fail';
```

---

## Summary

Your system now has **6 health endpoints** covering:
- ✅ **Database connectivity** - PostgreSQL/Prisma
- ✅ **Twilio API reachability** - WhatsApp integration
- ✅ **Queue system status** - Redis-backed job queue
- ✅ **System metrics** - Memory, CPU, uptime
- ✅ **Kubernetes compatibility** - Liveness/readiness probes
- ✅ **Monitoring tool integration** - JSON responses for dashboards

**Start with:** `/health/status` for comprehensive monitoring, `/health/monitor` for simple checks

