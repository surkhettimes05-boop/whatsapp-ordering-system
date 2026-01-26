#!/bin/bash

# Database Backup Script
# Creates timestamped backups and manages retention

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_HOST="${PGHOST:-postgres}"
DB_PORT="${PGPORT:-5432}"
DB_USER="${PGUSER:-postgres}"
DB_NAME="${PGDATABASE:-whatsapp_ordering}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

log "Starting backup for database: ${DB_NAME}"

# Create backup
log "Creating backup: ${BACKUP_FILE}"
if pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    --no-owner --no-acl | gzip > "${BACKUP_FILE}"; then
    log "Backup created successfully: ${BACKUP_FILE}"
    
    # Get backup size
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    log "Backup size: ${BACKUP_SIZE}"
else
    error "Backup failed!"
    exit 1
fi

# Verify backup
log "Verifying backup integrity..."
if gzip -t "${BACKUP_FILE}"; then
    log "Backup integrity verified"
else
    error "Backup integrity check failed!"
    exit 1
fi

# Cleanup old backups
log "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "backup_${DB_NAME}_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete
log "Cleanup completed"

# List current backups
log "Current backups:"
ls -lh "${BACKUP_DIR}"/backup_${DB_NAME}_*.sql.gz 2>/dev/null | tail -5 || warn "No backups found"

# Create backup manifest
MANIFEST_FILE="${BACKUP_DIR}/backup_manifest.json"
cat > "${MANIFEST_FILE}" <<EOF
{
  "last_backup": "${BACKUP_FILE}",
  "timestamp": "${TIMESTAMP}",
  "size": "${BACKUP_SIZE}",
  "database": "${DB_NAME}",
  "retention_days": ${RETENTION_DAYS}
}
EOF

log "Backup process completed successfully"
