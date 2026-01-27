#!/bin/bash

# ============================================================================
# Production Database Backup Script
# ============================================================================
# Usage: ./scripts/backup-db.sh
# 
# Creates automated PostgreSQL backups with:
# - Timestamp naming
# - Compression
# - Retention policy (keeps last 7 days)
# - Error handling and logging
# ============================================================================

set -e

# Configuration
BACKUP_DIR="./data/backups"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="./logs/backup.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================================
# Functions
# ============================================================================

log_info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

log_info "Starting database backup process..."

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    log_info "Created backup directory: $BACKUP_DIR"
fi

# Check if logs directory exists
if [ ! -d "./logs" ]; then
    mkdir -p "./logs"
fi

# ============================================================================
# Backup Database
# ============================================================================

BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql"

log_info "Starting backup to: $BACKUP_FILE"

if docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U postgres -d whatsapp_ordering \
    > "$BACKUP_FILE"; then
    log_success "Backup created: $BACKUP_FILE"
else
    log_error "Backup failed"
    exit 1
fi

# ============================================================================
# Compress Backup
# ============================================================================

log_info "Compressing backup..."

if gzip "$BACKUP_FILE"; then
    BACKUP_FILE="${BACKUP_FILE}.gz"
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log_success "Backup compressed: ${BACKUP_SIZE}"
else
    log_error "Compression failed"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# ============================================================================
# Create Metadata
# ============================================================================

METADATA_FILE="${BACKUP_FILE}.metadata"

cat > "$METADATA_FILE" <<EOF
Backup Date: $(date)
Database: whatsapp_ordering
Backup File: $BACKUP_FILE
Backup Size: $BACKUP_SIZE
PostgreSQL Version: $(docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -c "SELECT version();" 2>/dev/null | head -1 || echo "N/A")
Backup Type: Full Database Dump
Compression: gzip
Retention: $RETENTION_DAYS days
EOF

log_success "Metadata file created"

# ============================================================================
# Cleanup Old Backups
# ============================================================================

log_info "Cleaning up backups older than $RETENTION_DAYS days..."

DELETED_COUNT=0
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime "+$RETENTION_DAYS" | while read file; do
    log_info "Deleting old backup: $file"
    rm -f "$file"
    rm -f "${file}.metadata"
    DELETED_COUNT=$((DELETED_COUNT + 1))
done

log_success "Cleanup completed"

# ============================================================================
# Verify Backup
# ============================================================================

log_info "Verifying backup integrity..."

if gzip -t "$BACKUP_FILE" 2>/dev/null; then
    log_success "Backup integrity verified"
else
    log_error "Backup integrity check failed"
    rm -f "$BACKUP_FILE" "$METADATA_FILE"
    exit 1
fi

# ============================================================================
# Generate Report
# ============================================================================

log_info "Backup Summary:"
echo "  File:      $BACKUP_FILE" | tee -a "$LOG_FILE"
echo "  Size:      $BACKUP_SIZE" | tee -a "$LOG_FILE"
echo "  Created:   $(date)" | tee -a "$LOG_FILE"
echo "  Retention: $RETENTION_DAYS days" | tee -a "$LOG_FILE"

log_success "Backup process completed successfully"

# ============================================================================
# Optional: Send to Remote Storage
# ============================================================================

# Uncomment and configure for cloud backups (AWS S3, Azure Blob, etc.)
# log_info "Uploading to S3..."
# aws s3 cp "$BACKUP_FILE" "s3://your-bucket/backups/" --region us-east-1
# log_success "Backup uploaded to S3"

exit 0
