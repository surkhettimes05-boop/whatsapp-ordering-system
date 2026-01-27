#!/bin/bash

################################################################################
# Backup Alert/Notification Script
# 
# Purpose: Send alerts for backup failures and critical issues
# Integration: Slack, PagerDuty, Sentry, Email
# 
# Usage:
#   send-alert.sh ERROR "Backup failed"
#   send-alert.sh WARNING "Backup is 2 days old"
#   send-alert.sh SUCCESS "Daily backup completed"
################################################################################

set -euo pipefail

ALERT_LEVEL="${1:-INFO}"
ALERT_MESSAGE="${2:-No message provided}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
HOSTNAME=$(hostname)

# Configuration - Set via environment variables
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
PAGERDUTY_KEY="${PAGERDUTY_KEY:-}"
SENTRY_DSN="${SENTRY_DSN:-}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
ENABLE_SLACK="${ENABLE_SLACK:-0}"
ENABLE_PAGERDUTY="${ENABLE_PAGERDUTY:-0}"
ENABLE_SENTRY="${ENABLE_SENTRY:-0}"
ENABLE_EMAIL="${ENABLE_EMAIL:-0}"

# Log alert
log_alert() {
    echo "[${TIMESTAMP}] [${ALERT_LEVEL}] ${ALERT_MESSAGE}" >> /var/log/backups/alerts.log 2>/dev/null || true
}

# Send Slack notification
send_slack_alert() {
    if [ -z "$SLACK_WEBHOOK" ]; then
        return
    fi
    
    # Color coding
    COLOR="36a64f"  # Green
    if [ "$ALERT_LEVEL" = "ERROR" ]; then
        COLOR="ff0000"  # Red
    elif [ "$ALERT_LEVEL" = "WARNING" ]; then
        COLOR="ffa500"  # Orange
    fi
    
    PAYLOAD=$(cat <<EOF
{
    "attachments": [
        {
            "fallback": "PostgreSQL Backup Alert",
            "color": "$COLOR",
            "title": "PostgreSQL Backup Alert",
            "title_link": "https://console.example.com/backups",
            "text": "$ALERT_MESSAGE",
            "fields": [
                {
                    "title": "Level",
                    "value": "$ALERT_LEVEL",
                    "short": true
                },
                {
                    "title": "Host",
                    "value": "$HOSTNAME",
                    "short": true
                },
                {
                    "title": "Time",
                    "value": "$TIMESTAMP",
                    "short": true
                },
                {
                    "title": "Database",
                    "value": "${DB_NAME:-ordering_system}",
                    "short": true
                }
            ],
            "footer": "PostgreSQL Backup Monitor",
            "ts": $(date +%s)
        }
    ]
}
EOF
)
    
    curl -X POST \
        -H 'Content-type: application/json' \
        --data "$PAYLOAD" \
        "$SLACK_WEBHOOK" \
        2>/dev/null || true
}

# Send PagerDuty alert
send_pagerduty_alert() {
    if [ -z "$PAGERDUTY_KEY" ]; then
        return
    fi
    
    # Determine severity
    SEVERITY="info"
    if [ "$ALERT_LEVEL" = "ERROR" ]; then
        SEVERITY="critical"
    elif [ "$ALERT_LEVEL" = "WARNING" ]; then
        SEVERITY="warning"
    fi
    
    PAYLOAD=$(cat <<EOF
{
    "routing_key": "$PAGERDUTY_KEY",
    "event_action": "trigger",
    "dedup_key": "backup-${HOSTNAME}-${ALERT_LEVEL}",
    "payload": {
        "summary": "PostgreSQL Backup: $ALERT_MESSAGE",
        "severity": "$SEVERITY",
        "source": "$HOSTNAME",
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "custom_details": {
            "database": "${DB_NAME:-ordering_system}",
            "level": "$ALERT_LEVEL",
            "message": "$ALERT_MESSAGE"
        }
    }
}
EOF
)
    
    curl -X POST \
        -H 'Content-Type: application/json' \
        -d "$PAYLOAD" \
        'https://events.pagerduty.com/v2/enqueue' \
        2>/dev/null || true
}

# Send Sentry alert
send_sentry_alert() {
    if [ -z "$SENTRY_DSN" ]; then
        return
    fi
    
    # Extract project ID from DSN
    PROJECT_ID=$(echo "$SENTRY_DSN" | grep -oP '(?<=/)\d+(?=@)' || echo "0")
    
    LEVEL="info"
    if [ "$ALERT_LEVEL" = "ERROR" ]; then
        LEVEL="error"
    elif [ "$ALERT_LEVEL" = "WARNING" ]; then
        LEVEL="warning"
    fi
    
    PAYLOAD=$(cat <<EOF
{
    "event_id": "$(uuidgen | tr -d '-')",
    "message": "$ALERT_MESSAGE",
    "level": "$LEVEL",
    "timestamp": $(date +%s),
    "platform": "bash",
    "environment": "production",
    "server_name": "$HOSTNAME",
    "tags": {
        "alert_type": "backup",
        "database": "${DB_NAME:-ordering_system}"
    },
    "extra": {
        "alert_level": "$ALERT_LEVEL"
    }
}
EOF
)
    
    curl -X POST \
        -H 'Content-Type: application/json' \
        -d "$PAYLOAD" \
        "${SENTRY_DSN%@*}@sentry.io/${PROJECT_ID}" \
        2>/dev/null || true
}

# Send email alert
send_email_alert() {
    if [ -z "$ALERT_EMAIL" ]; then
        return
    fi
    
    if ! command -v mail &> /dev/null && ! command -v sendmail &> /dev/null; then
        return
    fi
    
    SUBJECT="[PostgreSQL] Backup Alert - $ALERT_LEVEL"
    
    BODY=$(cat <<EOF
PostgreSQL Backup Alert

Level: $ALERT_LEVEL
Message: $ALERT_MESSAGE
Host: $HOSTNAME
Database: ${DB_NAME:-ordering_system}
Time: $TIMESTAMP

---
PostgreSQL Backup Monitor
Sent from: $(hostname -f)
EOF
)
    
    if command -v mail &> /dev/null; then
        echo "$BODY" | mail -s "$SUBJECT" "$ALERT_EMAIL"
    elif command -v sendmail &> /dev/null; then
        (
            echo "To: $ALERT_EMAIL"
            echo "Subject: $SUBJECT"
            echo ""
            echo "$BODY"
        ) | sendmail -t
    fi
}

# Main execution
log_alert

if [ $ENABLE_SLACK -eq 1 ]; then
    send_slack_alert
fi

if [ $ENABLE_PAGERDUTY -eq 1 ]; then
    send_pagerduty_alert
fi

if [ $ENABLE_SENTRY -eq 1 ]; then
    send_sentry_alert
fi

if [ $ENABLE_EMAIL -eq 1 ]; then
    send_email_alert
fi

exit 0
