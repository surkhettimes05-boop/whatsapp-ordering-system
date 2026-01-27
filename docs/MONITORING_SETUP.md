# SRE Monitoring System - Complete Setup Guide

## Overview

Production-ready SRE monitoring with:
- **Uptime Monitoring** - Track system availability
- **Disk Space Alerts** - Monitor storage usage
- **DB Connection Alerts** - Track database health
- **Queue Backlog Alerts** - Monitor message queues
- **Daily Health Reports** - Email or WhatsApp summaries
- **Comprehensive Thresholds** - All configurable

---

## Quick Start (5 minutes)

### 1. Create Monitoring Directories
```bash
sudo mkdir -p /var/monitoring/health
sudo mkdir -p /var/lib/monitoring
sudo mkdir -p /var/log/monitoring
sudo mkdir -p /etc/monitoring
sudo chmod -R 755 /var/monitoring /var/lib/monitoring /var/log/monitoring /etc/monitoring
```

### 2. Copy Configuration
```bash
sudo cp backend/config/health-monitoring.conf /etc/monitoring/
sudo chmod 644 /etc/monitoring/health-monitoring.conf
```

### 3. Update Configuration (Optional)
```bash
# Edit thresholds if needed
sudo nano /etc/monitoring/health-monitoring.conf
```

### 4. Setup Cron/Systemd
```bash
sudo backend/scripts/setup-monitoring-cron.sh
```

### 5. Verify Setup
```bash
sudo systemctl list-timers --all
sudo crontab -l | grep monitoring
```

Done! Monitoring starts immediately.

---

## Monitoring Components

### 1. Health Check Script (`health-check.sh`)

Runs every 5 minutes to check system health.

**Monitors:**
- Uptime and recent reboots
- Disk space and inode usage
- Database connections
- Queue backlog
- CPU and memory usage
- Service status
- Application health
- Backup status

**Thresholds:**
```
DISK_SPACE: 75% (ok) → 80% (warning) → 85% (critical)
DB_CONNECTIONS: 60% → 80% (warning) → 95% (critical)
QUEUE_BACKLOG: 50 → 100 (warning) → 500 (critical)
CPU_USAGE: 60% → 80% (warning) → 95% (critical)
MEMORY_USAGE: 75% → 85% (warning) → 95% (critical)
BACKUP_AGE: 24h (ok) → 26h (warning) → 48h (critical)
UPTIME: < 5 min (critical)
```

### 2. Daily Health Report (`generate-health-report.sh`)

Generates comprehensive daily report at 6:00 AM.

**Report Contents:**
- Overall system status
- Uptime summary
- Disk space usage
- Database connection count
- Queue backlog summary
- CPU and memory usage
- Backup status
- Alert summary (24h)
- Service availability

**Distribution:**
- Email (configurable recipient)
- WhatsApp (optional)

### 3. Configuration File (`health-monitoring.conf`)

Central configuration with all thresholds.

**Sections:**
- General configuration
- Disk space thresholds
- Database thresholds
- Queue thresholds
- CPU/Memory thresholds
- Service monitoring
- Alert channels
- Report settings

---

## Threshold Reference

### Disk Space
```
OK Status:       0% - 75% used
WARNING Alert:   >= 80% used
CRITICAL Alert:  >= 85% used
```

**Example:**
- 100GB disk, 60GB used = 60% = OK ✓
- 100GB disk, 82GB used = 82% = WARNING ⚠️
- 100GB disk, 86GB used = 86% = CRITICAL 🔴

### Database Connections
```
OK Status:       0% - 60% of max
WARNING Alert:   >= 80% of max
CRITICAL Alert:  >= 95% of max
```

**Example (max_connections = 100):**
- 50 active connections = 50% = OK ✓
- 82 active connections = 82% = WARNING ⚠️
- 96 active connections = 96% = CRITICAL 🔴

### Queue Backlog
```
OK Status:       0 - 50 messages
WARNING Alert:   >= 100 messages
CRITICAL Alert:  >= 500 messages
```

**Monitored Queues:**
- `whatsapp-messages` - WhatsApp processing
- `webhook-events` - Webhook handling
- `order-processing` - Order pipeline
- `notifications` - System notifications

### CPU & Memory Usage
```
CPU:
  OK Status:       0% - 60%
  WARNING Alert:   >= 80%
  CRITICAL Alert:  >= 95%

Memory:
  OK Status:       0% - 75%
  WARNING Alert:   >= 85%
  CRITICAL Alert:  >= 95%
```

### Backup Status
```
OK Status:       <= 24 hours old
WARNING Alert:   >= 26 hours old
CRITICAL Alert:  >= 48 hours old
```

### Uptime
```
OK Status:       > 5 minutes
CRITICAL Alert:  < 5 minutes (recent reboot)
```

---

## Configuration Guide

### 1. Edit Configuration File
```bash
sudo nano /etc/monitoring/health-monitoring.conf
```

### 2. Update Thresholds

**Example: Increase disk threshold**
```bash
# Change from:
DISK_SPACE_THRESHOLD=85

# To:
DISK_SPACE_THRESHOLD=90
```

**Example: Configure email recipient**
```bash
EMAIL_REPORT_RECIPIENT="your-email@company.com"
```

**Example: Enable WhatsApp reports**
```bash
ENABLE_WHATSAPP_REPORT=true
WHATSAPP_REPORT_NUMBER="+1234567890"
```

### 3. Reload Configuration
```bash
# Cron picks up changes within 5 minutes
# Or restart systemd timers:
sudo systemctl restart health-check.timer
sudo systemctl restart health-report.timer
```

---

## Monitoring Schedule

### Default Schedule
```
Every 5 minutes  → Health check (all metrics)
6:00 AM UTC      → Daily health report (email)
Every Sunday 2AM → Archive old logs
1st of month 3AM → Cleanup old reports
```

### Customize Schedule

Edit `/etc/cron.d/system-monitoring`:
```bash
sudo nano /etc/cron.d/system-monitoring

# Change health check from 5 minutes to 10 minutes:
*/10 * * * * root /backend/scripts/health-check.sh

# Change report time from 6:00 AM to 8:00 AM:
0 8 * * * root /backend/scripts/generate-health-report.sh
```

Or edit systemd timers:
```bash
sudo nano /etc/systemd/system/health-check.timer

# Then reload:
sudo systemctl daemon-reload
sudo systemctl restart health-check.timer
```

---

## Alert Channels

### Email Alerts

**Configuration:**
```bash
ENABLE_EMAIL=true
ALERT_EMAIL="ops-team@company.com"
EMAIL_REPORT_RECIPIENT="ops-team@company.com"
```

**Requirements:**
- `mail` or `sendmail` installed
- SMTP configured

**Test:**
```bash
echo "Test alert" | mail -s "Test" ops-team@company.com
```

### Slack Alerts

**Configuration:**
```bash
ENABLE_SLACK=true
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
SLACK_CHANNEL="#system-alerts"
```

**Get Webhook URL:**
1. Create Slack app
2. Enable Incoming Webhooks
3. Create new webhook
4. Copy URL to config

### PagerDuty Alerts

**Configuration:**
```bash
ENABLE_PAGERDUTY=true
PAGERDUTY_KEY="your-integration-key"
```

### WhatsApp Reports

**Configuration:**
```bash
ENABLE_WHATSAPP_REPORT=true
WHATSAPP_REPORT_NUMBER="+1234567890"
```

---

## Daily Reports

### Email Report Format
```
HTML report with:
- Overall status indicator
- System metrics (uptime, CPU, memory)
- Disk space with visual progress bar
- Database connection count
- Queue backlog status
- Backup age
- Alert summary (critical/warning counts)
```

### Report Location
```
/var/log/monitoring/daily-reports/health-report-YYYY-MM-DD.html
```

### View Recent Reports
```bash
ls -lh /var/log/monitoring/daily-reports/
cat /var/log/monitoring/daily-reports/health-report-2026-01-22.html
```

---

## Operations & Troubleshooting

### Check Monitoring Status
```bash
# View health check logs
tail -50 /var/log/monitoring/health-check.log

# View daily report logs
tail -50 /var/log/monitoring/health-report.log

# View all alerts
tail -50 /var/log/monitoring/alerts.log

# View current health status
cat /var/lib/monitoring/health_status.json
```

### View Current Metrics
```bash
# Current metrics files
ls -la /var/lib/monitoring/

# View specific metrics
cat /var/lib/monitoring/disk_usage.txt
cat /var/lib/monitoring/db_connections.txt
cat /var/lib/monitoring/queue_*.txt
```

### Manually Run Health Check
```bash
sudo /backend/scripts/health-check.sh
```

### Manually Generate Report
```bash
sudo /backend/scripts/generate-health-report.sh
```

### Check Cron Jobs
```bash
# View cron configuration
sudo crontab -l
cat /etc/cron.d/system-monitoring

# View cron execution logs
sudo journalctl -u cron --follow
tail -f /var/log/monitoring/cron.log
```

### Check Systemd Timers
```bash
# List all timers
sudo systemctl list-timers --all

# Check specific timer status
sudo systemctl status health-check.timer
sudo systemctl status health-report.timer

# View systemd journal for timer
sudo journalctl -u health-check.service --follow
```

---

## Common Issues

### Health Check Not Running

**Problem:** No entries in `/var/log/monitoring/health-check.log`

**Solution:**
```bash
# Check cron is enabled
sudo service cron status

# Check cron file exists
cat /etc/cron.d/system-monitoring

# Run manually to test
sudo /backend/scripts/health-check.sh

# Check for errors
tail -50 /var/log/monitoring/cron.log
```

### Email Report Not Received

**Problem:** Daily report not arriving in email

**Solution:**
```bash
# Verify mail is configured
which mail
which sendmail

# Test email manually
echo "Test" | mail -s "Test" your-email@company.com

# Check report was generated
ls -la /var/log/monitoring/daily-reports/

# Check report logs
tail -50 /var/log/monitoring/health-report.log
```

### False Alerts

**Problem:** Too many false alerts

**Solution:**
1. Review thresholds in `/etc/monitoring/health-monitoring.conf`
2. Increase thresholds if needed
3. Reload configuration
4. Test with `sudo /backend/scripts/health-check.sh`

**Example:**
```bash
# If disk alerts are too sensitive:
DISK_SPACE_THRESHOLD=90  # Change from 85

# If queue alerts are too frequent:
QUEUE_BACKLOG_WARNING=200  # Change from 100
```

### Missing Metrics

**Problem:** Some metrics not collected

**Solution:**
```bash
# Check required tools are installed
psql --version  # For database metrics
redis-cli --version  # For queue metrics
top -bn1 | head  # For CPU/memory

# Check if services are running
systemctl status postgresql
systemctl status redis-server

# Check configuration
grep -E "REDIS_HOST|DB_HOST" /etc/monitoring/health-monitoring.conf
```

---

## Performance Impact

### Resource Usage
- **Disk:** ~5MB for 30 days of logs
- **Memory:** < 10MB per health check
- **CPU:** < 1% usage
- **Network:** Minimal (only for alerts/reports)

### Optimization
```bash
# Reduce check frequency if needed (from 5 to 10 minutes):
# Edit /etc/cron.d/system-monitoring
*/10 * * * * root /backend/scripts/health-check.sh

# Reduce alert deduplication time
ALERT_DEDUP_TIME=600  # Changed from 300

# Disable unused checks in health-monitoring.conf
ENABLE_PAGERDUTY=false  # Disable if not using
```

---

## Integration Examples

### Prometheus Integration
```bash
# Enable Prometheus metrics export
ENABLE_PROMETHEUS_METRICS=true
PROMETHEUS_EXPORT_PATH="/var/monitoring/metrics"

# Scrape from monitoring system:
# http://localhost:9100/var/monitoring/metrics
```

### Datadog Integration
```bash
# Set monitoring system
MONITORING_SYSTEM="datadog"
MONITORING_API_KEY="your-api-key"

# Metrics automatically sent to Datadog
```

### Status Page Update
```bash
# Enable status page integration
ENABLE_STATUS_PAGE_UPDATE=true
STATUS_PAGE_API="https://status.example.com/api"

# Status automatically updated on incidents
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `health-check.sh` | 5-min health checks |
| `generate-health-report.sh` | Daily report generation |
| `setup-monitoring-cron.sh` | Setup script |
| `health-monitoring.conf` | Configuration |
| `/etc/cron.d/system-monitoring` | Cron jobs |
| `/var/log/monitoring/` | Logs directory |
| `/var/lib/monitoring/` | Metrics state |

---

## Quick Reference

### Commands
```bash
# Check status
tail -f /var/log/monitoring/health-check.log

# View metrics
cat /var/lib/monitoring/health_status.json

# Manual health check
sudo /backend/scripts/health-check.sh

# Manual report
sudo /backend/scripts/generate-health-report.sh

# View last report
ls -lh /var/log/monitoring/daily-reports/ | tail -1

# Check cron
sudo crontab -l

# Check timers
sudo systemctl list-timers
```

### Thresholds Cheat Sheet
```
Disk Space:     80% warn, 85% critical
DB Connections: 80% warn, 95% critical
Queue Messages: 100 warn, 500 critical
CPU Usage:      80% warn, 95% critical
Memory Usage:   85% warn, 95% critical
Backup Age:     26h warn, 48h critical
Uptime:         5 min critical (recent reboot)
```

---

## Support & Next Steps

1. ✅ Review this guide
2. ✅ Run setup script
3. ✅ Verify monitoring starts
4. ✅ Configure alerts (Slack/Email/WhatsApp)
5. ✅ Customize thresholds
6. ✅ Test daily reports
7. ✅ Monitor for 1 week
8. ✅ Fine-tune thresholds based on data

---

*SRE Monitoring System - Production Ready*
