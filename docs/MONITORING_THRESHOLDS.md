# SRE Monitoring - Threshold Documentation

## Critical Thresholds Reference

### Overview
All monitoring thresholds documented with rationale and adjustment guidance.

---

## 📊 Disk Space Monitoring

### Thresholds
```
OK Status:      0% - 75% used
WARNING:        >= 80% used
CRITICAL:       >= 85% used
```

### Rationale
- **75% (OK):** Leaves comfortable buffer for peak usage
- **80% (WARNING):** Alerts operations before critical
- **85% (CRITICAL):** Immediate action required

### Adjustment Guide
```bash
# For high-activity systems
DISK_SPACE_THRESHOLD=90
DISK_SPACE_WARNING=85

# For conservative systems
DISK_SPACE_THRESHOLD=80
DISK_SPACE_WARNING=75

# Enterprise (aggressive)
DISK_SPACE_THRESHOLD=95
DISK_SPACE_WARNING=90
```

### Typical Capacity
- Ordering system DB: ~2-5 GB
- Backups (7-day): ~1.7 GB
- Logs (30-day): ~0.5 GB
- **Total:** ~4-7 GB recommended minimum

### Action Plan
- **80% WARNING:** Review log retention, consider archival
- **85% CRITICAL:** Delete old logs, archive backups, expand disk

---

## 🗄️ Database Connection Monitoring

### Thresholds
```
OK Status:      0% - 60% of max
WARNING:        >= 80% of max
CRITICAL:       >= 95% of max
```

### Defaults
- PostgreSQL `max_connections`: 100 (default)
- Recommended: 200-300 for production

### Examples (max_connections = 100)
```
50 active  = 50%  = OK ✓
80 active  = 80%  = WARNING ⚠️
95 active  = 95%  = CRITICAL 🔴
100 active = 100% = Connection limit reached (new connections fail)
```

### Rationale
- **60%:** Normal operating range
- **80%:** Starting to saturate pool
- **95%:** Critical - connections being refused

### Adjustment Guide
```bash
# High-traffic system
DB_CONNECTION_WARNING=70
DB_CONNECTION_CRITICAL=90

# Moderate traffic
DB_CONNECTION_WARNING=80
DB_CONNECTION_CRITICAL=95

# Conservative (dev/testing)
DB_CONNECTION_WARNING=90
DB_CONNECTION_CRITICAL=98
```

### PostgreSQL Tuning
```sql
-- Check current setting
SHOW max_connections;

-- Update for more connections
ALTER SYSTEM SET max_connections = 300;

-- Reload PostgreSQL
pg_ctl reload

-- Verify
SHOW max_connections;
```

### Action Plan
- **80% WARNING:** Investigate long-running queries, consider connection pooling
- **95% CRITICAL:** Kill idle connections, review application connection handling

---

## 📨 Queue Backlog Monitoring

### Thresholds
```
OK Status:      0 - 50 messages
WARNING:        >= 100 messages
CRITICAL:       >= 500 messages
```

### Monitored Queues
1. **whatsapp-messages** - WhatsApp API messages
2. **webhook-events** - Incoming webhooks
3. **order-processing** - Order pipeline
4. **notifications** - System notifications

### Rationale
- **50:** Processed within 1-2 minutes (normal load)
- **100:** Accumulating faster than processing
- **500:** Significant backlog, processing stalled

### Processing Rates (Typical)
```
whatsapp-messages:   50-100 msgs/min
webhook-events:      200-500 msgs/min
order-processing:    10-50 orders/min
notifications:       100-200 msgs/min
```

### Adjustment Guide
```bash
# High-traffic periods
QUEUE_BACKLOG_WARNING=200
QUEUE_BACKLOG_CRITICAL=1000

# Normal operations
QUEUE_BACKLOG_WARNING=100
QUEUE_BACKLOG_CRITICAL=500

# Conservative (ensure immediate processing)
QUEUE_BACKLOG_WARNING=50
QUEUE_BACKLOG_CRITICAL=200
```

### Action Plan
- **100 WARNING:** Monitor processing workers, check for slow operations
- **500 CRITICAL:** Restart workers, check for stuck jobs, scale up processing

---

## ⚙️ CPU & Memory Monitoring

### CPU Usage Thresholds
```
OK Status:      0% - 60%
WARNING:        >= 80%
CRITICAL:       >= 95%
```

### Memory Usage Thresholds
```
OK Status:      0% - 75%
WARNING:        >= 85%
CRITICAL:       >= 95%
```

### System Load Examples (4-core CPU)
```
Load 0.5  = 12.5% utilization  = OK
Load 2.0  = 50% utilization    = OK
Load 3.2  = 80% utilization    = WARNING
Load 3.8  = 95% utilization    = CRITICAL
```

### Rationale
- **60/75%:** Comfortable headroom
- **80/85%:** Approaching limits
- **95%:** Saturation, response time degraded

### Adjustment Guide
```bash
# Production (strict)
CPU_LOAD_THRESHOLD=85
MEMORY_THRESHOLD=90

# Normal
CPU_LOAD_THRESHOLD=80
MEMORY_THRESHOLD=85

# Development
CPU_LOAD_THRESHOLD=95
MEMORY_THRESHOLD=95
```

### Action Plan
- **80% CPU WARNING:** Check for long-running processes, consider load balancing
- **95% CPU CRITICAL:** Kill non-essential processes, scale horizontally

---

## 📦 Backup Monitoring

### Thresholds
```
OK Status:      <= 24 hours old
WARNING:        >= 26 hours old
CRITICAL:       >= 48 hours old
```

### Rationale
- **24h:** Backup schedule is 2 AM daily (24h cycle)
- **26h:** Backup missed or delayed
- **48h:** Backup has failed for 2+ days

### Typical Backup Window
```
1:00 AM - Database backup starts
2:00 AM - Backup complete (~2 min)
2:30 AM - S3 sync starts
3:00 AM - Verification starts
4:00 AM - All complete
```

### Adjustment Guide
```bash
# For 24-hour backup window
BACKUP_WARNING_AGE=26
BACKUP_CRITICAL_AGE=48

# For 12-hour backup window (multiple backups/day)
BACKUP_WARNING_AGE=14
BACKUP_CRITICAL_AGE=24

# Conservative (hourly backups)
BACKUP_WARNING_AGE=2
BACKUP_CRITICAL_AGE=4
```

### Action Plan
- **26h WARNING:** Check backup logs, verify S3 sync
- **48h CRITICAL:** Investigate backup failure, check disk space, DB connectivity

---

## ✅ Service Health Monitoring

### Critical Services
```
postgresql      - Database (CRITICAL)
nginx           - Web server (CRITICAL)
redis-server    - Cache/queue (CRITICAL)
docker          - Container runtime (OPTIONAL)
```

### Thresholds
```
Service Down = CRITICAL ALERT
Service Up   = OK
```

### Expected Uptime
```
Database:      99.99% (5 min downtime/month)
Web Server:    99.95% (3 hours downtime/month)
Redis Cache:   99.9% (40 min downtime/month)
Overall SLA:   99.9%
```

### Action Plan
- **Service Down:** Check systemd status, logs, restart if safe
- **Repeated Failures:** Investigate root cause, check system resources

---

## 🆙 Uptime Monitoring

### Thresholds
```
OK:        > 5 minutes
CRITICAL:  < 5 minutes (recent reboot)
```

### Rationale
- **5 minutes:** Detect recent system reboots
- Alerts on reboots to investigate cause

### Typical Uptime Goals
```
Development:   Any uptime acceptable
Staging:       >= 1 week (7 days)
Production:    >= 30 days
Ideal:         >= 90 days
```

### Action Plan
- **Recent Reboot:** Investigate cause (crash, maintenance, updates)
- **Frequent Reboots:** Check system logs, memory/disk issues

---

## 📡 Application Health Monitoring

### Thresholds
```
Health Endpoint Returns 200 OK  = HEALTHY
Health Endpoint Returns 5xx     = UNHEALTHY
Health Endpoint Timeout         = CRITICAL
```

### Health Check Endpoint
```
GET /health → { status: "ok" }
Response time: < 1 second
```

### Rationale
- Quick endpoint check without full load
- Detects: API crash, database disconnect, cache failure

### Action Plan
- **Health Check Failed:** Check application logs, restart if needed
- **Repeated Failures:** Full system investigation required

---

## 🔧 System Resource Monitoring

### CPU Load Guidelines
```
1 Core:     Load < 1.0      = OK
2 Cores:    Load < 2.0      = OK
4 Cores:    Load < 4.0      = OK
8 Cores:    Load < 8.0      = OK

If Load > (2 * cores) = CRITICAL
```

### Memory Usage Guidelines
```
Available Memory > 25% Total = OK
Available Memory 10-25%      = WARNING
Available Memory < 10%       = CRITICAL
```

### Disk I/O Thresholds
```
Read: < 1000 MB/s  = OK
Write: < 500 MB/s  = OK
Latency: < 50ms    = OK
```

### Network Thresholds
```
Utilization < 80% = OK
Utilization >= 80% = WARNING
Utilization >= 95% = CRITICAL
```

---

## 📈 Threshold Adjustment Process

### 1. Collect Baseline Data
```bash
# Run monitoring for 1 week
# Collect normal operating metrics
# Identify peak and low usage
```

### 2. Calculate Thresholds
```bash
# WARNING = Peak usage + 10%
# CRITICAL = Peak usage + 20%

# Example: If peak disk = 75%
# WARNING = 85% ✓
# CRITICAL = 95% ✓
```

### 3. Test Thresholds
```bash
# Update configuration
sudo nano /etc/monitoring/health-monitoring.conf

# Test with manual run
sudo /backend/scripts/health-check.sh

# Monitor for false positives
```

### 4. Fine-Tune
```bash
# If too many alerts: Increase thresholds
# If too few alerts: Decrease thresholds
# Goal: Actionable alerts only
```

---

## 🎯 Alert Response Matrix

| Metric | Status | Response Time | Action |
|--------|--------|---|---|
| Disk Space | CRITICAL | 30 min | Investigate, expand disk |
| DB Connections | CRITICAL | 15 min | Kill idle connections |
| Queue Backlog | CRITICAL | 30 min | Restart workers, investigate |
| CPU | CRITICAL | 5 min | Scale up, optimize code |
| Memory | CRITICAL | 5 min | Restart service, investigate leak |
| Backup | CRITICAL | 2 hours | Investigate failure, restore manually |
| Service | CRITICAL | 5 min | Restart service |
| Uptime | CRITICAL | 1 hour | Investigate reboot cause |

---

## 💾 Configuration Template

```bash
# Copy to /etc/monitoring/health-monitoring.conf

# DISK SPACE
DISK_SPACE_THRESHOLD=85
DISK_SPACE_WARNING=80
DISK_SPACE_OK=75

# DATABASE
DB_CONNECTION_WARNING=80
DB_CONNECTION_CRITICAL=95

# QUEUE
QUEUE_BACKLOG_WARNING=100
QUEUE_BACKLOG_CRITICAL=500

# CPU & MEMORY
CPU_LOAD_THRESHOLD=80
MEMORY_THRESHOLD=85

# BACKUP
BACKUP_WARNING_AGE=26
BACKUP_CRITICAL_AGE=48

# UPTIME
RECENT_REBOOT_THRESHOLD=300

# ALERTS
ENABLE_EMAIL=true
ENABLE_SLACK=true
ENABLE_PAGERDUTY=false
```

---

## 📞 Threshold Change Request Process

### Change Request
1. Identify metric and current threshold
2. Justify change (capacity growth, performance data, etc.)
3. Test in staging environment
4. Document rationale

### Implementation
1. Update `/etc/monitoring/health-monitoring.conf`
2. Verify with manual test: `sudo /backend/scripts/health-check.sh`
3. Monitor for 1 week for false positives
4. Document final thresholds in runbook

### Example Change Request
```bash
# Change: Increase disk space critical threshold
# Reason: Database growth requires more headroom
# Current: DISK_SPACE_THRESHOLD=85
# Proposed: DISK_SPACE_THRESHOLD=90
# Testing: 1 week in staging, no false alerts
# Approval: DevOps lead sign-off
```

---

## 📚 Additional Resources

- [Monitoring Setup Guide](./MONITORING_SETUP.md)
- [Alert Channels Configuration](#)
- [Runbook Templates](#)
- [Incident Response](./INCIDENT_RESPONSE.md)

---

*SRE Monitoring - Threshold Documentation v1.0*
*Last Updated: January 22, 2026*
