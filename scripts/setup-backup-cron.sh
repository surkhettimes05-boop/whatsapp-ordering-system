#!/bin/bash

################################################################################
# Backup Cron Setup Script
# 
# Purpose: Configure automated backup scheduling with cron
# Usage: sudo ./setup-backup-cron.sh
# 
# Schedules:
#   - Daily backup at 2:00 AM
#   - S3 sync at 2:30 AM
#   - Verification at 3:00 AM
#   - Weekly full cleanup at 1:00 AM Sunday
################################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_USER="${BACKUP_USER:-postgres}"
BACKUP_LOG="/var/log/backups"
CRON_DIR="/etc/cron.d"
CRON_FILE="$CRON_DIR/postgres-backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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
    error "This script must be run as root (use: sudo ./setup-backup-cron.sh)"
fi

log "PostgreSQL Backup Cron Setup"
log "=============================="

# Create log directory
log "Creating log directory..."
mkdir -p "$BACKUP_LOG"
chown "$BACKUP_USER:$BACKUP_USER" "$BACKUP_LOG"
chmod 750 "$BACKUP_LOG"

# Make scripts executable
log "Setting script permissions..."
chmod +x "$SCRIPT_DIR/backup-postgres.sh"
chmod +x "$SCRIPT_DIR/backup-sync-s3.sh"
chmod +x "$SCRIPT_DIR/restore-postgres.sh"
chmod +x "$SCRIPT_DIR/verify-backups.sh"

# Create cron jobs
log "Creating cron jobs..."

# Read environment variables from .env if available
ENV_FILE="${SCRIPT_DIR}/../../.env"
ENV_VARS=""

if [ -f "$ENV_FILE" ]; then
    log "Loading environment variables from $ENV_FILE"
    # Extract DATABASE_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET
    ENV_VARS=$(cat "$ENV_FILE" | grep -E "^(DATABASE_URL|DB_|AWS_|S3_)" | sed 's/^/export /' || true)
fi

# Create cron file
cat > "$CRON_FILE" << 'EOF'
# PostgreSQL Automated Backup Schedule
# Edit this file with: sudo crontab -e
# View cron logs: sudo journalctl -u cron

# Load environment
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
MAILTO=root

# Daily PostgreSQL Backup at 2:00 AM
0 2 * * * postgres /backend/scripts/backup-postgres.sh >> /var/log/backups/backup.log 2>&1

# Sync backups to S3 at 2:30 AM
30 2 * * * postgres /backend/scripts/backup-sync-s3.sh >> /var/log/backups/sync.log 2>&1

# Verify backups at 3:00 AM
0 3 * * * postgres /backend/scripts/verify-backups.sh >> /var/log/backups/verify.log 2>&1

# Weekly cleanup at 1:00 AM on Sunday
0 1 * * 0 postgres /backend/scripts/backup-postgres.sh --cleanup-old >> /var/log/backups/cleanup.log 2>&1
EOF

# Add environment variables if found
if [ -n "$ENV_VARS" ]; then
    sed -i "/^PATH=/a\\$ENV_VARS" "$CRON_FILE"
fi

chmod 644 "$CRON_FILE"
log "Cron file created: $CRON_FILE"

# Create systemd timer as alternative
log "Creating systemd timer units (alternative to cron)..."

# Timer for backup
cat > /etc/systemd/system/postgres-backup.timer << 'EOF'
[Unit]
Description=PostgreSQL Daily Backup Timer
Documentation=file:///backend/docs/BACKUP_SETUP.md

[Timer]
OnCalendar=*-*-* 02:00:00
OnCalendar=*-*-* 02:30:00
OnCalendar=*-*-* 03:00:00
Persistent=true
RandomizedDelaySec=60

[Install]
WantedBy=timers.target
EOF

chmod 644 /etc/systemd/system/postgres-backup.timer
log "Systemd timer created: postgres-backup.timer"

# Create systemd service
cat > /etc/systemd/system/postgres-backup.service << 'EOF'
[Unit]
Description=PostgreSQL Backup Service
After=network.target postgresql.service

[Service]
Type=oneshot
User=postgres
Group=postgres
WorkingDirectory=/backend/scripts
ExecStart=/backend/scripts/backup-postgres.sh
StandardOutput=journal
StandardError=journal
SyslogIdentifier=postgres-backup

[Install]
WantedBy=multi-user.target
EOF

chmod 644 /etc/systemd/system/postgres-backup.service
log "Systemd service created: postgres-backup.service"

# Reload systemd
log "Reloading systemd configuration..."
systemctl daemon-reload

# Create monitoring script
log "Creating backup status monitoring script..."

cat > "$SCRIPT_DIR/backup-status.sh" << 'EOFMON'
#!/bin/bash

# Backup Status Monitoring Script
# Usage: ./backup-status.sh

BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"
LOG_DIR="${LOG_DIR:-/var/log/backups}"

echo "PostgreSQL Backup Status"
echo "========================"
echo ""

# Last backup
LAST_BACKUP=$(ls -t "${BACKUP_DIR}"/postgres_*.sql.gz 2>/dev/null | head -1)
if [ -n "$LAST_BACKUP" ]; then
    BACKUP_TIME=$(stat -c %y "$LAST_BACKUP")
    BACKUP_SIZE=$(du -h "$LAST_BACKUP" | cut -f1)
    echo "Last Backup: $(basename $LAST_BACKUP)"
    echo "Time: $BACKUP_TIME"
    echo "Size: $BACKUP_SIZE"
else
    echo "No backups found!"
fi

echo ""
echo "Recent Backup Activity:"
if [ -f "$LOG_DIR/backup.log" ]; then
    tail -5 "$LOG_DIR/backup.log" | sed 's/^/  /'
else
    echo "  No backup log found"
fi

echo ""
echo "Last Verification Status:"
if [ -f "$LOG_DIR/.last_verify_status" ]; then
    STATUS=$(cat "$LOG_DIR/.last_verify_status")
    echo "  Status: $STATUS"
else
    echo "  No verification data"
fi

echo ""
echo "Storage Usage:"
du -sh "$BACKUP_DIR" 2>/dev/null | awk '{print "  Local: " $1}'

if command -v aws &> /dev/null; then
    S3_BUCKET="${S3_BUCKET:-}"
    if [ -n "$S3_BUCKET" ]; then
        S3_SIZE=$(aws s3 ls "s3://${S3_BUCKET}/" --recursive --summarize | grep "Total Size" | awk '{print $3}')
        if [ -n "$S3_SIZE" ]; then
            echo "  S3: $(numfmt --to=iec $S3_SIZE 2>/dev/null || echo $S3_SIZE bytes)"
        fi
    fi
fi

EOFMON

chmod +x "$SCRIPT_DIR/backup-status.sh"
log "Status monitoring script created"

# Summary
log ""
log "=============================="
log "Setup Complete!"
log "=============================="
log ""
log "Configured Backup Schedule:"
log "  - Daily backup:        2:00 AM"
log "  - S3 sync:             2:30 AM"
log "  - Backup verification: 3:00 AM"
log "  - Weekly cleanup:      1:00 AM Sunday"
log ""
log "To enable cron jobs:"
log "  sudo update-rc.d cron enable"
log "  sudo service cron start"
log ""
log "To enable systemd timers:"
log "  sudo systemctl enable postgres-backup.timer"
log "  sudo systemctl start postgres-backup.timer"
log ""
log "To check cron jobs:"
log "  sudo crontab -l"
log ""
log "To view cron execution logs:"
log "  sudo journalctl -u cron"
log ""
log "To check backup status:"
log "  $SCRIPT_DIR/backup-status.sh"
log ""
log "To manually run backup:"
log "  sudo -u postgres $SCRIPT_DIR/backup-postgres.sh"
log ""
log "To verify backup integrity:"
log "  sudo -u postgres $SCRIPT_DIR/verify-backups.sh --full"
log ""

exit 0
