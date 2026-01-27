#!/bin/bash

################################################################################
# Setup Monitoring Cron Jobs
# 
# Purpose: Configure automated monitoring schedule
# Usage: sudo ./setup-monitoring-cron.sh
# 
# Schedules:
#   - Health check every 5 minutes
#   - Daily health report at 6:00 AM
################################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="/etc/monitoring"
CRON_DIR="/etc/cron.d"
CRON_FILE="$CRON_DIR/system-monitoring"
LOG_DIR="/var/log/monitoring"
STATE_DIR="/var/lib/monitoring"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[✓]${NC} $*"
}

error() {
    echo -e "${RED}[✗]${NC} $*"
    exit 1
}

warning() {
    echo -e "${YELLOW}[!]${NC} $*"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "This script must be run as root"
fi

log "Setting up System Monitoring"
log "=============================="

# Create directories
log "Creating monitoring directories..."
mkdir -p "$CONFIG_DIR" "$LOG_DIR" "$STATE_DIR"
chmod 755 "$CONFIG_DIR" "$LOG_DIR" "$STATE_DIR"

# Copy configuration if not present
if [ -f "$SCRIPT_DIR/../config/health-monitoring.conf" ]; then
    log "Copying monitoring configuration..."
    cp "$SCRIPT_DIR/../config/health-monitoring.conf" "$CONFIG_DIR/"
    chmod 644 "$CONFIG_DIR/health-monitoring.conf"
fi

# Make scripts executable
log "Setting script permissions..."
chmod +x "$SCRIPT_DIR/health-check.sh"
chmod +x "$SCRIPT_DIR/generate-health-report.sh"

# Create cron jobs
log "Creating cron jobs..."

cat > "$CRON_FILE" << 'EOF'
# System Health Monitoring
# Monitor system and application health every 5 minutes
# Generate daily reports at 6:00 AM

SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
MAILTO=root

# Load environment variables
MONITORING_DIR=/var/monitoring/health
STATE_DIR=/var/lib/monitoring
LOG_DIR=/var/log/monitoring
CONFIG_DIR=/etc/monitoring

# Health check every 5 minutes (keeps system healthy)
*/5 * * * * root /backend/scripts/health-check.sh >> /var/log/monitoring/cron.log 2>&1

# Generate daily health report at 6:00 AM
0 6 * * * root /backend/scripts/generate-health-report.sh >> /var/log/monitoring/cron.log 2>&1

# Archive old logs weekly (every Sunday at 2:00 AM)
0 2 * * 0 root find /var/log/monitoring -name "*.log" -mtime +30 -delete

# Cleanup old reports monthly (every 1st of month at 3:00 AM)
0 3 1 * * root find /var/log/monitoring/daily-reports -name "*.html" -mtime +30 -delete
EOF

chmod 644 "$CRON_FILE"
log "Cron file created: $CRON_FILE"

# Create systemd timer as alternative
log "Creating systemd timer units..."

mkdir -p /etc/systemd/system

cat > /etc/systemd/system/health-check.timer << 'EOF'
[Unit]
Description=System Health Check Timer
Documentation=file:///backend/docs/MONITORING_SETUP.md

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
EOF

chmod 644 /etc/systemd/system/health-check.timer

cat > /etc/systemd/system/health-check.service << 'EOF'
[Unit]
Description=System Health Check Service
After=network.target

[Service]
Type=oneshot
ExecStart=/backend/scripts/health-check.sh
StandardOutput=journal
StandardError=journal
SyslogIdentifier=health-check

[Install]
WantedBy=multi-user.target
EOF

chmod 644 /etc/systemd/system/health-check.service

cat > /etc/systemd/system/health-report.timer << 'EOF'
[Unit]
Description=Daily Health Report Timer
Documentation=file:///backend/docs/MONITORING_SETUP.md

[Timer]
OnCalendar=*-*-* 06:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

chmod 644 /etc/systemd/system/health-report.timer

cat > /etc/systemd/system/health-report.service << 'EOF'
[Unit]
Description=Daily Health Report Generation
After=network.target

[Service]
Type=oneshot
ExecStart=/backend/scripts/generate-health-report.sh
StandardOutput=journal
StandardError=journal
SyslogIdentifier=health-report

[Install]
WantedBy=multi-user.target
EOF

chmod 644 /etc/systemd/system/health-report.service

log "Systemd timers created"

# Reload systemd
log "Reloading systemd configuration..."
systemctl daemon-reload

# Create status file for health tracking
log "Initializing health status files..."

cat > "$STATE_DIR/health_status.json" << 'EOF'
{
  "timestamp": "2026-01-22T00:00:00Z",
  "issues": 0,
  "status": "INITIALIZING"
}
EOF

# Create monitoring dashboard status page
log "Creating monitoring dashboard..."

cat > "$LOG_DIR/dashboard.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="refresh" content="60">
    <title>System Monitoring Dashboard</title>
    <style>
        body {
            font-family: monospace;
            background-color: #1e1e1e;
            color: #00ff00;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            border-bottom: 2px solid #00ff00;
            padding-bottom: 10px;
        }
        .status-box {
            border: 1px solid #00ff00;
            padding: 15px;
            margin: 10px 0;
            background-color: #0a0a0a;
        }
        .status-ok {
            border-left: 4px solid #00ff00;
        }
        .status-warn {
            border-left: 4px solid #ffff00;
        }
        .status-critical {
            border-left: 4px solid #ff0000;
        }
        .metric {
            margin: 5px 0;
        }
        .refresh {
            font-size: 12px;
            color: #888;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🖥️ System Monitoring Dashboard</h1>
        
        <div class="status-box status-ok">
            <strong>Status:</strong> INITIALIZING
            <div class="metric">Last Update: Loading...</div>
        </div>
        
        <div class="status-box">
            <strong>📊 System Metrics</strong>
            <div class="metric">Uptime: Loading...</div>
            <div class="metric">Disk Usage: Loading...</div>
            <div class="metric">CPU Usage: Loading...</div>
            <div class="metric">Memory Usage: Loading...</div>
        </div>
        
        <div class="status-box">
            <strong>🗄️ Database Health</strong>
            <div class="metric">Connections: Loading...</div>
            <div class="metric">Status: Loading...</div>
        </div>
        
        <div class="status-box">
            <strong>📨 Queue Status</strong>
            <div class="metric">Pending Messages: Loading...</div>
            <div class="metric">Status: Loading...</div>
        </div>
        
        <div class="status-box">
            <strong>📦 Backup Status</strong>
            <div class="metric">Last Backup: Loading...</div>
            <div class="metric">Status: Loading...</div>
        </div>
        
        <div class="refresh">
            🔄 Auto-refreshing every 60 seconds | Last generated: <span id="timestamp">--:--:--</span>
        </div>
    </div>
</body>
</html>
EOF

# Summary
log ""
log "=============================="
log "Setup Complete!"
log "=============================="
log ""
log "Monitoring Schedule:"
log "  - Health check:   Every 5 minutes"
log "  - Daily report:   6:00 AM UTC"
log "  - Log cleanup:    Weekly (Sunday 2:00 AM)"
log "  - Report cleanup: Monthly (1st of month 3:00 AM)"
log ""
log "To enable cron jobs:"
log "  sudo update-rc.d cron enable"
log "  sudo service cron start"
log ""
log "To enable systemd timers:"
log "  sudo systemctl enable health-check.timer"
log "  sudo systemctl enable health-report.timer"
log "  sudo systemctl start health-check.timer"
log "  sudo systemctl start health-report.timer"
log ""
log "To check timer status:"
log "  sudo systemctl list-timers --all"
log ""
log "To view cron logs:"
log "  sudo journalctl -u cron --follow"
log ""
log "To view health check logs:"
log "  tail -f /var/log/monitoring/health-check.log"
log ""
log "To view daily reports:"
log "  ls -lh /var/log/monitoring/daily-reports/"
log ""
log "Configuration file: /etc/monitoring/health-monitoring.conf"
log "Edit to adjust thresholds and alert settings"
log ""

exit 0
