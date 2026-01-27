#!/bin/bash

################################################################################
# Database Restore Script
# 
# Purpose: Restore PostgreSQL database from backup
# Safety: Creates backup before restore, validates integrity first
# 
# Usage:
#   ./restore-postgres.sh /path/to/backup.sql.gz
#   ./restore-postgres.sh postgres_database_20260122_020000.sql.gz
# 
# Options:
#   --list-backups          List available backups
#   --from-s3               Restore from S3 backup
#   --dry-run               Simulate restore without making changes
#   --force                 Skip safety confirmations
################################################################################

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"
DB_NAME="${DB_NAME:-$(echo $DATABASE_URL | grep -oP '(?<=/)[^?]+$')}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
LOG_DIR="${LOG_DIR:-/var/log/backups}"
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-database-backups}"
DRY_RUN=0
FORCE=0
FROM_S3=0
LIST_BACKUPS=0

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_DIR}/restore.log"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "${LOG_DIR}/restore.log"
    exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --list-backups)
            LIST_BACKUPS=1
            shift
            ;;
        --from-s3)
            FROM_S3=1
            shift
            ;;
        --dry-run)
            DRY_RUN=1
            shift
            ;;
        --force)
            FORCE=1
            shift
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

mkdir -p "$BACKUP_DIR" "$LOG_DIR"

# List available backups
if [ $LIST_BACKUPS -eq 1 ]; then
    log "=========================================="
    log "Available local backups:"
    log "=========================================="
    ls -lh "${BACKUP_DIR}"/postgres_${DB_NAME}_*.sql.gz 2>/dev/null | awk '{print $9, "(" $5 ")"}' || log "No backups found"
    
    if [ -n "$S3_BUCKET" ]; then
        log ""
        log "Available S3 backups:"
        log "=========================================="
        if command -v aws &> /dev/null; then
            aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --recursive | grep "postgres_${DB_NAME}" | awk '{print $4, "(" $3 " bytes)"}' || log "No S3 backups found"
        else
            log "AWS CLI not installed, cannot list S3 backups"
        fi
    fi
    exit 0
fi

# Default to latest backup if not specified
if [ -z "${BACKUP_FILE:-}" ]; then
    log "No backup specified, using latest..."
    BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/postgres_${DB_NAME}_*.sql.gz 2>/dev/null | head -1)
    
    if [ -z "$BACKUP_FILE" ]; then
        error "No backups found in $BACKUP_DIR"
    fi
fi

# Handle S3 restore
if [ $FROM_S3 -eq 1 ]; then
    if [ -z "$S3_BUCKET" ]; then
        error "S3_BUCKET not configured"
    fi
    
    if ! command -v aws &> /dev/null; then
        error "AWS CLI not installed"
    fi
    
    log "Downloading backup from S3: $BACKUP_FILE"
    TEMP_BACKUP="${BACKUP_DIR}/temp_$(basename $BACKUP_FILE)"
    
    if ! aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}" "$TEMP_BACKUP"; then
        error "Failed to download backup from S3"
    fi
    
    BACKUP_FILE="$TEMP_BACKUP"
    CLEANUP_TEMP=1
else
    # Make path absolute if relative
    if [[ ! "$BACKUP_FILE" = /* ]]; then
        BACKUP_FILE="${BACKUP_DIR}/${BACKUP_FILE}"
    fi
fi

# Verify backup exists
if [ ! -f "$BACKUP_FILE" ]; then
    error "Backup file not found: $BACKUP_FILE"
fi

log "=========================================="
log "PostgreSQL Database Restore"
log "=========================================="
log "Database: $DB_NAME"
log "Backup file: $BACKUP_FILE"
log "File size: $(du -h "$BACKUP_FILE" | cut -f1)"
log "=========================================="

# Verify backup integrity
log "Verifying backup integrity..."
if ! gunzip -t "$BACKUP_FILE" > /dev/null 2>&1; then
    error "Backup integrity check failed! The backup file may be corrupted."
fi
log "Backup integrity check passed ✓"

# Connection test
log "Testing database connection..."
if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
    error "Cannot connect to database: $DB_HOST:$DB_PORT/$DB_NAME"
fi
log "Database connection verified ✓"

# Safety confirmation
if [ $FORCE -eq 0 ]; then
    log ""
    log "⚠️  WARNING: This will restore database from backup!"
    log "⚠️  All data since the backup was created will be LOST!"
    log ""
    read -p "Are you sure you want to restore? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        log "Restore cancelled by user"
        exit 0
    fi
fi

# Create pre-restore backup
log "Creating pre-restore backup as safety measure..."
PRE_RESTORE_BACKUP="${BACKUP_DIR}/pre_restore_$(date +%Y%m%d_%H%M%S).sql.gz"

if ! PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$PRE_RESTORE_BACKUP"; then
    log "WARNING: Failed to create pre-restore backup"
else
    log "Pre-restore backup created: $PRE_RESTORE_BACKUP"
fi

if [ $DRY_RUN -eq 1 ]; then
    log "DRY RUN: Would restore from $BACKUP_FILE"
    log "DRY RUN: Exiting without making changes"
    exit 0
fi

# Perform restore
log "Starting restore..."
RESTORE_LOG="${LOG_DIR}/restore_$(date +%Y%m%d_%H%M%S).log"

if PGPASSWORD="$DB_PASSWORD" gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 \
    > "$RESTORE_LOG" 2>&1; then
    
    log "Restore completed successfully ✓"
    log "Restore log saved to: $RESTORE_LOG"
    
    # Verify restore
    log "Verifying restore..."
    RESTORED_ROWS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
    log "Restored tables: $RESTORED_ROWS"
    
else
    log "ERROR: Restore failed!"
    log "Error details saved to: $RESTORE_LOG"
    tail -30 "$RESTORE_LOG"
    
    # Suggest rollback
    log ""
    log "⚠️  Restore failed! To rollback, use:"
    log "    ./restore-postgres.sh $PRE_RESTORE_BACKUP --force"
    
    exit 1
fi

# Cleanup temp file if from S3
if [ "${CLEANUP_TEMP:-0}" -eq 1 ]; then
    rm -f "$BACKUP_FILE"
    log "Cleaned up temporary S3 download"
fi

log "=========================================="
log "Restore complete!"
log "=========================================="

exit 0
