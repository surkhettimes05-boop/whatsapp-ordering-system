#!/bin/bash

################################################################################
# Daily Health Report Generator
# 
# Purpose: Generate comprehensive daily health report
# Runs: Daily at 6:00 AM via cron
# Output: Email or WhatsApp message
# 
# Report Contents:
#   - System uptime/downtime
#   - Disk space summary
#   - Database health
#   - Queue status
#   - Backup status
#   - Service availability
#   - Performance metrics
#   - Alert summary
################################################################################

set -euo pipefail

# Configuration
STATE_DIR="/var/lib/monitoring"
LOG_DIR="/var/log/monitoring"
REPORT_DIR="${LOG_DIR}/daily-reports"
MONITORING_CONFIG="/etc/monitoring/health-monitoring.conf"

# Thresholds
BACKUP_AGE_WARN=26      # hours
DISK_SPACE_OK=75        # percent
DISK_SPACE_WARN=85      # percent

# Report date
REPORT_DATE=$(date +"%Y-%m-%d")
REPORT_TIME=$(date +"%Y-%m-%d %H:%M:%S")
YESTERDAY=$(date -d "1 day ago" +%Y-%m-%d)

# Initialize
mkdir -p "$REPORT_DIR"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_DIR}/health-report.log"
}

# Load configuration
if [ -f "$MONITORING_CONFIG" ]; then
    source "$MONITORING_CONFIG"
fi

# ============================================================================
# DATA COLLECTION
# ============================================================================

collect_metrics() {
    local uptime=$(cat "${STATE_DIR}/uptime.txt" 2>/dev/null || echo "0")
    local uptime_hours=$((uptime / 3600))
    local uptime_days=$((uptime_hours / 24))
    
    local disk_usage=$(cat "${STATE_DIR}/disk_usage.txt" 2>/dev/null || echo "0")
    local backup_size=$(cat "${STATE_DIR}/backup_size.txt" 2>/dev/null || echo "0")
    local backup_age=$(cat "${STATE_DIR}/backup_age.txt" 2>/dev/null || echo "999")
    
    local db_connections=$(cat "${STATE_DIR}/db_connections.txt" 2>/dev/null || echo "0")
    local cpu_usage=$(cat "${STATE_DIR}/cpu_usage.txt" 2>/dev/null || echo "0")
    local memory_usage=$(cat "${STATE_DIR}/memory_usage.txt" 2>/dev/null || echo "0")
    
    local queue_messages=$(find "${STATE_DIR}" -name "queue_*.txt" -exec cat {} \; 2>/dev/null | awk '{sum += $1} END {print sum}')
    queue_messages=${queue_messages:-0}
    
    # Count alerts from yesterday
    local alert_count=$(grep "$YESTERDAY" "${LOG_DIR}/alerts.log" 2>/dev/null | wc -l)
    local critical_alerts=$(grep "$YESTERDAY.*CRITICAL" "${LOG_DIR}/alerts.log" 2>/dev/null | wc -l)
    local warning_alerts=$(grep "$YESTERDAY.*WARNING" "${LOG_DIR}/alerts.log" 2>/dev/null | wc -l)
    
    echo "uptime_days=$uptime_days"
    echo "uptime_hours=$uptime_hours"
    echo "disk_usage=$disk_usage"
    echo "backup_size=$backup_size"
    echo "backup_age=$backup_age"
    echo "db_connections=$db_connections"
    echo "cpu_usage=$cpu_usage"
    echo "memory_usage=$memory_usage"
    echo "queue_messages=$queue_messages"
    echo "alert_count=$alert_count"
    echo "critical_alerts=$critical_alerts"
    echo "warning_alerts=$warning_alerts"
}

# ============================================================================
# REPORT GENERATION
# ============================================================================

generate_html_report() {
    local metrics_file=$1
    local output_file=$2
    
    # Source metrics
    source "$metrics_file"
    
    # Health status indicators
    local uptime_status="✓"
    [ "${uptime_hours:-0}" -lt 24 ] && uptime_status="⚠"
    
    local disk_status="✓"
    [ "${disk_usage:-0}" -ge "$DISK_SPACE_WARN" ] && disk_status="🔴"
    [ "${disk_usage:-0}" -ge "$DISK_SPACE_OK" ] && disk_status="🟡"
    
    local backup_status="✓"
    [ "${backup_age:-0}" -gt "$BACKUP_AGE_WARN" ] && backup_status="⚠"
    
    local overall_status="HEALTHY"
    [ "$critical_alerts" -gt 0 ] && overall_status="CRITICAL"
    [ "$warning_alerts" -gt 0 ] && overall_status="WARNING"
    
    cat > "$output_file" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Daily Health Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 900px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #0066cc; padding-bottom: 10px; }
        h2 { color: #0066cc; margin-top: 20px; border-left: 4px solid #0066cc; padding-left: 10px; }
        .status-healthy { background-color: #d4edda; padding: 15px; border-radius: 4px; margin: 10px 0; border-left: 4px solid #28a745; }
        .status-warning { background-color: #fff3cd; padding: 15px; border-radius: 4px; margin: 10px 0; border-left: 4px solid #ffc107; }
        .status-critical { background-color: #f8d7da; padding: 15px; border-radius: 4px; margin: 10px 0; border-left: 4px solid #dc3545; }
        .metric-row { display: grid; grid-template-columns: 200px 1fr; margin: 10px 0; padding: 8px; border-bottom: 1px solid #eee; }
        .metric-label { font-weight: bold; color: #333; }
        .metric-value { color: #666; }
        .progress-bar { width: 100%; height: 20px; background-color: #eee; border-radius: 4px; overflow: hidden; margin: 5px 0; }
        .progress-fill { height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; }
        .progress-fill-ok { background-color: #28a745; }
        .progress-fill-warn { background-color: #ffc107; }
        .progress-fill-crit { background-color: #dc3545; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .timestamp { color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Daily Health Report</h1>
        <p class="timestamp">Generated: <strong>REPORT_TIME</strong></p>
        
        <h2>Overall Status</h2>
        <div class="status-OVERALL_CLASS">
            <strong>Status: OVERALL_STATUS</strong>
            <p>Critical Alerts: CRITICAL_ALERTS | Warning Alerts: WARNING_ALERTS</p>
        </div>
        
        <h2>🖥️ System Health</h2>
        <div class="metric-row">
            <div class="metric-label">Uptime:</div>
            <div class="metric-value">UPTIME_DAYS days, UPTIME_HOURS hours UPTIME_STATUS</div>
        </div>
        
        <div class="metric-row">
            <div class="metric-label">CPU Usage:</div>
            <div class="metric-value">
                CPU_USAGE%
                <div class="progress-bar">
                    <div class="progress-fill CPU_CLASS" style="width: CPU_USAGE%">CPU_USAGE%</div>
                </div>
            </div>
        </div>
        
        <div class="metric-row">
            <div class="metric-label">Memory Usage:</div>
            <div class="metric-value">
                MEMORY_USAGE%
                <div class="progress-bar">
                    <div class="progress-fill MEM_CLASS" style="width: MEMORY_USAGE%">MEMORY_USAGE%</div>
                </div>
            </div>
        </div>
        
        <h2>💾 Disk Space</h2>
        <div class="metric-row">
            <div class="metric-label">Disk Usage:</div>
            <div class="metric-value">
                DISK_USAGE% used DISK_STATUS
                <div class="progress-bar">
                    <div class="progress-fill DISK_CLASS" style="width: DISK_USAGE%">DISK_USAGE%</div>
                </div>
            </div>
        </div>
        
        <h2>📦 Backup Status</h2>
        <div class="metric-row">
            <div class="metric-label">Last Backup:</div>
            <div class="metric-value">BACKUP_AGE hours ago BACKUP_STATUS</div>
        </div>
        
        <div class="metric-row">
            <div class="metric-label">Backup Size:</div>
            <div class="metric-value">BACKUP_SIZE GB</div>
        </div>
        
        <h2>🗄️ Database Health</h2>
        <div class="metric-row">
            <div class="metric-label">Active Connections:</div>
            <div class="metric-value">DB_CONNECTIONS</div>
        </div>
        
        <h2>📨 Queue Status</h2>
        <div class="metric-row">
            <div class="metric-label">Pending Messages:</div>
            <div class="metric-value">QUEUE_MESSAGES messages</div>
        </div>
        
        <h2>⚠️ Alert Summary</h2>
        <div class="metric-row">
            <div class="metric-label">Total Alerts (24h):</div>
            <div class="metric-value">ALERT_COUNT alerts</div>
        </div>
        
        <p style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
            🤖 Automated Report | For detailed information, check monitoring dashboard at https://monitoring.example.com
        </p>
    </div>
</body>
</html>
EOF

    # Replace placeholders
    sed -i "s|REPORT_TIME|$REPORT_TIME|g" "$output_file"
    sed -i "s|OVERALL_STATUS|$overall_status|g" "$output_file"
    sed -i "s|OVERALL_CLASS|$(echo $overall_status | tr '[:upper:]' '[:lower:]')|g" "$output_file"
    sed -i "s|CRITICAL_ALERTS|$critical_alerts|g" "$output_file"
    sed -i "s|WARNING_ALERTS|$warning_alerts|g" "$output_file"
    sed -i "s|UPTIME_DAYS|${uptime_days:-0}|g" "$output_file"
    sed -i "s|UPTIME_HOURS|${uptime_hours:-0}|g" "$output_file"
    sed -i "s|UPTIME_STATUS|$uptime_status|g" "$output_file"
    sed -i "s|CPU_USAGE|${cpu_usage:-0}|g" "$output_file"
    sed -i "s|CPU_CLASS|$([ "${cpu_usage:-0}" -gt 80 ] && echo "progress-fill-crit" || echo "progress-fill-ok")|g" "$output_file"
    sed -i "s|MEMORY_USAGE|${memory_usage:-0}|g" "$output_file"
    sed -i "s|MEM_CLASS|$([ "${memory_usage:-0}" -gt 85 ] && echo "progress-fill-crit" || echo "progress-fill-ok")|g" "$output_file"
    sed -i "s|DISK_USAGE|${disk_usage:-0}|g" "$output_file"
    sed -i "s|DISK_STATUS|$disk_status|g" "$output_file"
    sed -i "s|DISK_CLASS|$([ "${disk_usage:-0}" -ge "$DISK_SPACE_WARN" ] && echo "progress-fill-crit" || echo "progress-fill-ok")|g" "$output_file"
    sed -i "s|BACKUP_AGE|${backup_age:-999}|g" "$output_file"
    sed -i "s|BACKUP_STATUS|$backup_status|g" "$output_file"
    sed -i "s|BACKUP_SIZE|${backup_size:-0}|g" "$output_file"
    sed -i "s|DB_CONNECTIONS|${db_connections:-0}|g" "$output_file"
    sed -i "s|QUEUE_MESSAGES|${queue_messages:-0}|g" "$output_file"
    sed -i "s|ALERT_COUNT|${alert_count:-0}|g" "$output_file"
}

# ============================================================================
# REPORT DISTRIBUTION
# ============================================================================

send_email_report() {
    local html_file=$1
    local recipient=${2:-"ops-team@company.com"}
    
    log "Sending email report to $recipient"
    
    if command -v mail &> /dev/null; then
        (
            echo "MIME-Version: 1.0"
            echo "Content-Type: text/html; charset=UTF-8"
            echo "Subject: Daily Health Report - $REPORT_DATE"
            echo "To: $recipient"
            echo ""
            cat "$html_file"
        ) | sendmail "$recipient" 2>/dev/null || log "Failed to send email"
    else
        log "Mail command not available"
    fi
}

send_whatsapp_report() {
    local summary=$1
    local whatsapp_number=${2:-""}
    
    if [ -z "$whatsapp_number" ]; then
        log "WhatsApp number not configured, skipping WhatsApp message"
        return
    fi
    
    log "Sending WhatsApp report to $whatsapp_number"
    
    /backend/scripts/send-alert.sh "INFO" "$summary" 2>/dev/null || true
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

log "=========================================="
log "Generating Daily Health Report"
log "=========================================="

# Collect current metrics
METRICS_FILE=$(mktemp)
collect_metrics > "$METRICS_FILE"

# Generate HTML report
HTML_REPORT="${REPORT_DIR}/health-report-${REPORT_DATE}.html"
generate_html_report "$METRICS_FILE" "$HTML_REPORT"

log "HTML report generated: $HTML_REPORT"

# Send via email
if [ "${ENABLE_EMAIL_REPORT:-true}" = "true" ]; then
    send_email_report "$HTML_REPORT" "${EMAIL_REPORT_RECIPIENT:-ops-team@company.com}"
fi

# Send via WhatsApp
if [ "${ENABLE_WHATSAPP_REPORT:-false}" = "true" ]; then
    # Create summary for WhatsApp
    source "$METRICS_FILE"
    SUMMARY="📊 Daily Health Report ($REPORT_DATE):
    
✓ Uptime: ${uptime_days}d ${uptime_hours}h
$([ "$disk_usage" -ge 85 ] && echo "⚠️ Disk: ${disk_usage}% (High)" || echo "✓ Disk: ${disk_usage}%")
$([ "$backup_age" -gt 26 ] && echo "⚠️ Backup: ${backup_age}h old" || echo "✓ Backup: ${backup_age}h old")
CPU: ${cpu_usage}% | Memory: ${memory_usage}%
🚨 Alerts: ${critical_alerts} critical, ${warning_alerts} warnings

$([ "$critical_alerts" -gt 0 ] && echo "🔴 ACTION REQUIRED" || echo "🟢 HEALTHY")"
    
    send_whatsapp_report "$SUMMARY" "${WHATSAPP_REPORT_NUMBER}"
fi

# Archive metrics
cp "$METRICS_FILE" "${REPORT_DIR}/metrics-${REPORT_DATE}.txt"

# Cleanup
rm -f "$METRICS_FILE"

log "Daily report generation complete"
log "=========================================="

exit 0
