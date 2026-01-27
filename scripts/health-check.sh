#!/bin/bash

################################################################################
# System Health Monitoring Script
# 
# Purpose: Monitor system health and alert on critical issues
# Runs: Every 5 minutes via cron
# 
# Monitors:
#   - Uptime/downtime tracking
#   - Disk space usage
#   - Database connections
#   - Queue backlog status
#   - System resources
################################################################################

set -euo pipefail

# Configuration
MONITORING_DIR="${MONITORING_DIR:-/var/monitoring/health}"
LOG_DIR="${LOG_DIR:-/var/log/monitoring}"
CONFIG_DIR="${CONFIG_DIR:-/etc/monitoring}"
STATE_DIR="/var/lib/monitoring"

# Default Thresholds (can be overridden in config)
DISK_SPACE_THRESHOLD=${DISK_SPACE_THRESHOLD:-85}          # Percent
DISK_INODE_THRESHOLD=${DISK_INODE_THRESHOLD:-90}          # Percent
DB_CONNECTION_WARNING=${DB_CONNECTION_WARNING:-80}         # Percent of max
DB_CONNECTION_CRITICAL=${DB_CONNECTION_CRITICAL:-95}       # Percent of max
QUEUE_BACKLOG_WARNING=${QUEUE_BACKLOG_WARNING:-100}        # Messages
QUEUE_BACKLOG_CRITICAL=${QUEUE_BACKLOG_CRITICAL:-500}      # Messages
CPU_LOAD_THRESHOLD=${CPU_LOAD_THRESHOLD:-80}               # Percent
MEMORY_THRESHOLD=${MEMORY_THRESHOLD:-85}                   # Percent

# Monitoring state
ALERTS_SENT=()
ISSUES_FOUND=0

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_DIR}/health-check.log"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "${LOG_DIR}/health-check.log"
}

alert() {
    local level=$1
    local message=$2
    local metric=$3
    
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    ALERTS_SENT+=("[$level] $message")
    
    log "⚠️  [$level] $message"
    
    # Send alert via alert system
    /backend/scripts/send-alert.sh "$level" "$message" 2>/dev/null || true
    
    # Store alert
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $metric: $message" >> "${LOG_DIR}/alerts.log"
}

# Initialize
mkdir -p "$MONITORING_DIR" "$LOG_DIR" "$STATE_DIR"

# Load configuration if exists
if [ -f "$CONFIG_DIR/health-monitoring.conf" ]; then
    source "$CONFIG_DIR/health-monitoring.conf"
fi

log "=========================================="
log "System Health Check"
log "=========================================="

# ============================================================================
# UPTIME MONITORING
# ============================================================================

check_uptime() {
    log "Checking uptime..."
    
    local uptime_seconds=$(cat /proc/uptime | awk '{print int($1)}')
    local uptime_hours=$((uptime_seconds / 3600))
    local uptime_days=$((uptime_hours / 24))
    
    if [ $uptime_seconds -lt 300 ]; then
        alert "WARNING" "System recently rebooted (${uptime_seconds}s uptime)" "uptime"
    fi
    
    echo "$uptime_seconds" > "${STATE_DIR}/uptime.txt"
    log "Uptime: ${uptime_days} days, $((uptime_hours % 24)) hours"
}

# ============================================================================
# DISK SPACE MONITORING
# ============================================================================

check_disk_space() {
    log "Checking disk space..."
    
    # Root filesystem
    local disk_usage=$(df / | awk 'NR==2 {print int($5)}')
    local disk_inodes=$(df -i / | awk 'NR==2 {print int($5)}')
    
    if [ "$disk_usage" -ge "$DISK_SPACE_THRESHOLD" ]; then
        alert "CRITICAL" "Disk space critical: ${disk_usage}% used" "disk_space"
    elif [ "$disk_usage" -ge "$((DISK_SPACE_THRESHOLD - 5))" ]; then
        alert "WARNING" "Disk space high: ${disk_usage}% used" "disk_space"
    fi
    
    if [ "$disk_inodes" -ge "$DISK_INODE_THRESHOLD" ]; then
        alert "CRITICAL" "Inode usage critical: ${disk_inodes}% used" "disk_inodes"
    fi
    
    echo "$disk_usage" > "${STATE_DIR}/disk_usage.txt"
    log "Disk usage: ${disk_usage}%"
    
    # PostgreSQL backup directory
    if [ -d "/backups/postgres" ]; then
        local backup_usage=$(du -s /backups/postgres 2>/dev/null | awk '{print $1}')
        local backup_usage_gb=$((backup_usage / 1024 / 1024))
        echo "$backup_usage_gb" > "${STATE_DIR}/backup_size.txt"
        log "Backup storage: ${backup_usage_gb}GB"
    fi
}

# ============================================================================
# DATABASE CONNECTION MONITORING
# ============================================================================

check_db_connections() {
    log "Checking database connections..."
    
    local db_name="${DB_NAME:-ordering_system}"
    local db_host="${DB_HOST:-localhost}"
    local db_port="${DB_PORT:-5432}"
    local db_user="${DB_USER:-postgres}"
    
    # Get current connections
    if command -v psql &> /dev/null; then
        local current_conns=$(PGPASSWORD="$DB_PASSWORD" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null || echo "0")
        
        # Get max connections
        local max_conns=$(PGPASSWORD="$DB_PASSWORD" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -t -c "SHOW max_connections;" 2>/dev/null | tr -d ' ' || echo "100")
        
        # Calculate percentage
        local conn_percent=$((current_conns * 100 / max_conns))
        
        if [ "$conn_percent" -ge "$DB_CONNECTION_CRITICAL" ]; then
            alert "CRITICAL" "DB connections critical: ${current_conns}/${max_conns} (${conn_percent}%)" "db_connections"
        elif [ "$conn_percent" -ge "$DB_CONNECTION_WARNING" ]; then
            alert "WARNING" "DB connections high: ${current_conns}/${max_conns} (${conn_percent}%)" "db_connections"
        fi
        
        echo "$current_conns" > "${STATE_DIR}/db_connections.txt"
        log "Database connections: ${current_conns}/${max_conns} (${conn_percent}%)"
    else
        log "PostgreSQL client tools not available"
    fi
}

# ============================================================================
# QUEUE BACKLOG MONITORING
# ============================================================================

check_queue_backlog() {
    log "Checking queue backlog..."
    
    # Check Redis queue if available
    if command -v redis-cli &> /dev/null 2>&1; then
        local redis_host="${REDIS_HOST:-localhost}"
        local redis_port="${REDIS_PORT:-6379}"
        
        # Queue keys to monitor
        local queues=("whatsapp-messages" "webhook-events" "order-processing" "notifications")
        
        for queue in "${queues[@]}"; do
            local backlog=$(redis-cli -h "$redis_host" -p "$redis_port" LLEN "$queue" 2>/dev/null || echo "0")
            
            if [ "$backlog" -ge "$QUEUE_BACKLOG_CRITICAL" ]; then
                alert "CRITICAL" "Queue critical backlog: $queue has ${backlog} messages" "queue_backlog"
            elif [ "$backlog" -ge "$QUEUE_BACKLOG_WARNING" ]; then
                alert "WARNING" "Queue backlog: $queue has ${backlog} messages" "queue_backlog"
            fi
            
            echo "$backlog" > "${STATE_DIR}/queue_${queue}.txt"
            log "Queue ${queue}: ${backlog} messages"
        done
    fi
}

# ============================================================================
# SYSTEM RESOURCES MONITORING
# ============================================================================

check_system_resources() {
    log "Checking system resources..."
    
    # CPU Load
    local cpu_load=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print int(100 - $1)}' 2>/dev/null || echo "0")
    
    if [ "$cpu_load" -ge "$CPU_LOAD_THRESHOLD" ]; then
        alert "WARNING" "CPU usage high: ${cpu_load}%" "cpu_usage"
    fi
    
    echo "$cpu_load" > "${STATE_DIR}/cpu_usage.txt"
    log "CPU usage: ${cpu_load}%"
    
    # Memory
    local memory_usage=$(free | awk '/Mem:/ {printf("%d", $3/$2 * 100)}')
    
    if [ "$memory_usage" -ge "$MEMORY_THRESHOLD" ]; then
        alert "WARNING" "Memory usage high: ${memory_usage}%" "memory_usage"
    fi
    
    echo "$memory_usage" > "${STATE_DIR}/memory_usage.txt"
    log "Memory usage: ${memory_usage}%"
}

# ============================================================================
# SERVICE HEALTH MONITORING
# ============================================================================

check_service_health() {
    log "Checking service health..."
    
    # Check critical services
    local services=("postgresql" "nginx" "redis-server" "docker")
    
    for service in "${services[@]}"; do
        if systemctl is-enabled "$service" &>/dev/null; then
            if ! systemctl is-active --quiet "$service"; then
                alert "CRITICAL" "Service down: $service" "service_health"
            else
                log "✓ Service running: $service"
            fi
        fi
    done
}

# ============================================================================
# APPLICATION HEALTH MONITORING
# ============================================================================

check_app_health() {
    log "Checking application health..."
    
    # Check if main API is responding
    if command -v curl &> /dev/null; then
        local app_url="${APP_URL:-http://localhost:3000}"
        local health_endpoint="${app_url}/health"
        
        if ! curl -sf "$health_endpoint" > /dev/null 2>&1; then
            alert "CRITICAL" "Application health check failed" "app_health"
        else
            log "✓ Application health check passed"
        fi
    fi
}

# ============================================================================
# BACKUP HEALTH MONITORING
# ============================================================================

check_backup_health() {
    log "Checking backup health..."
    
    # Check last backup timestamp
    if [ -f "/var/log/backups/.last_backup_time" ]; then
        local last_backup=$(cat /var/log/backups/.last_backup_time)
        local current_time=$(date +%s)
        local backup_age=$((($current_time - $last_backup) / 3600))
        
        if [ "$backup_age" -gt 26 ]; then
            alert "WARNING" "Last backup is ${backup_age}h old" "backup_health"
        fi
        
        echo "$backup_age" > "${STATE_DIR}/backup_age.txt"
        log "Last backup: ${backup_age}h ago"
    fi
    
    # Check backup verification status
    if [ -f "/var/log/backups/.last_verify_status" ]; then
        local verify_status=$(cat /var/log/backups/.last_verify_status)
        if [ "$verify_status" != "SUCCESS" ]; then
            alert "WARNING" "Backup verification failed: $verify_status" "backup_verify"
        fi
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

check_uptime
check_disk_space
check_db_connections
check_queue_backlog
check_system_resources
check_service_health
check_app_health
check_backup_health

# Generate summary
log "=========================================="
log "Health Check Complete"
log "Issues found: $ISSUES_FOUND"
log "=========================================="

# Store health state
echo "{
  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"issues\": $ISSUES_FOUND,
  \"status\": \"$([ $ISSUES_FOUND -eq 0 ] && echo 'HEALTHY' || echo 'WARNING')\"
}" > "${STATE_DIR}/health_status.json"

exit $([ $ISSUES_FOUND -eq 0 ] && echo 0 || echo 1)
