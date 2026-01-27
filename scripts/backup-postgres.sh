#!/bin/bash

################################################################################
# PostgreSQL Daily Backup Script
# 
# Purpose: Create daily backups of PostgreSQL database
# Compression: gzip for space efficiency
# Retention: 7 days local, 30 days remote (configurable)
# 
# Usage: ./backup-postgres.sh
# Cron: 0 2 * * * /path/to/backup-postgres.sh >> /var/log/backups/postgres.log 2>&1
################################################################################

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"
DB_NAME="${DB_NAME:-$(echo $DATABASE_URL | grep -oP '(?<=/)[^?]+$')}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
LOG_DIR="${LOG_DIR:-/var/log/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/postgres_${DB_NAME}_${TIMESTAMP}.sql.gz"
METADATA_FILE="${BACKUP_DIR}/postgres_${DB_NAME}_${TIMESTAMP}.meta"

# Create directories if they don't exist
mkdir -p "$BACKUP_DIR" "$LOG_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_DIR}/postgres.log"
}

log "=========================================="
log "Starting PostgreSQL backup for database: $DB_NAME"
log "=========================================="

# Check if database exists
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; then
    log "ERROR: Cannot connect to PostgreSQL at $DB_HOST:$DB_PORT"
    exit 1
fi

log "Database connection verified ✓"

# Perform backup
log "Backing up database to: $BACKUP_FILE"

if PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -F p \
    --verbose \
    --no-password \
    "$DB_NAME" | gzip > "$BACKUP_FILE"; then
    
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "Backup successful! Size: $BACKUP_SIZE ✓"
    
    # Create metadata file
    {
        echo "timestamp=${TIMESTAMP}"
        echo "database=${DB_NAME}"
        echo "hostname=${DB_HOST}"
        echo "port=${DB_PORT}"
        echo "file_path=${BACKUP_FILE}"
        echo "file_size=$(stat --format=%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE" 2>/dev/null || echo 'unknown')"
        echo "backup_date=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        echo "status=success"
        echo "backup_type=full"
        echo "compression=gzip"
    } > "$METADATA_FILE"
    
    log "Metadata saved to: $METADATA_FILE"
else
    log "ERROR: Backup failed!"
    echo "status=failed" > "$METADATA_FILE"
    exit 1
fi

# Verify backup integrity
log "Verifying backup integrity..."
if gunzip -t "$BACKUP_FILE" 2>&1 | head -20; then
    log "Backup integrity check passed ✓"
    echo "integrity_check=passed" >> "$METADATA_FILE"
else
    log "WARNING: Backup integrity check failed!"
    echo "integrity_check=failed" >> "$METADATA_FILE"
    exit 1
fi

# Cleanup old backups (local rotation)
log "Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "postgres_${DB_NAME}_*.sql.gz" -mtime +${BACKUP_RETENTION_DAYS} -exec rm -v {} \; | while read file; do
    log "Deleted old backup: $(basename $file)"
done

# Also cleanup corresponding metadata files
find "$BACKUP_DIR" -name "postgres_${DB_NAME}_*.meta" -mtime +${BACKUP_RETENTION_DAYS} -delete

log "Backup complete!"
log "=========================================="

# Create success indicator file (for monitoring)
touch "${BACKUP_DIR}/.last_backup_success"
echo "$TIMESTAMP" > "${BACKUP_DIR}/.last_backup_time"

exit 0
