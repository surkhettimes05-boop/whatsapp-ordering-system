#!/bin/bash

# Database Restore Script
# Restores database from backup file

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_HOST="${PGHOST:-postgres}"
DB_PORT="${PGPORT:-5432}"
DB_USER="${PGUSER:-postgres}"
DB_NAME="${PGDATABASE:-whatsapp_ordering}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check if backup file is provided
if [ -z "${1:-}" ]; then
    error "Usage: $0 <backup_file>"
    error "Available backups:"
    ls -lh "${BACKUP_DIR}"/backup_${DB_NAME}_*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    error "Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Confirm restore
warn "WARNING: This will restore database ${DB_NAME} from ${BACKUP_FILE}"
warn "This will REPLACE all current data!"
read -p "Are you sure? (yes/no): " confirm

if [ "${confirm}" != "yes" ]; then
    log "Restore cancelled"
    exit 0
fi

# Create pre-restore backup
PRE_RESTORE_BACKUP="${BACKUP_DIR}/pre_restore_${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql.gz"
log "Creating pre-restore backup: ${PRE_RESTORE_BACKUP}"
pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    --no-owner --no-acl | gzip > "${PRE_RESTORE_BACKUP}"

# Drop and recreate database
log "Dropping existing database..."
PGPASSWORD="${PGPASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres \
    -c "DROP DATABASE IF EXISTS ${DB_NAME};"

log "Creating new database..."
PGPASSWORD="${PGPASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres \
    -c "CREATE DATABASE ${DB_NAME};"

# Restore from backup
log "Restoring from backup: ${BACKUP_FILE}"
if gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${PGPASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}"; then
    log "Restore completed successfully"
    
    # Run migrations to ensure schema is up to date
    log "Running migrations..."
    # This would be done via docker-compose exec in production
    # docker-compose exec -T backend npx prisma migrate deploy
else
    error "Restore failed!"
    error "You can restore the pre-restore backup: ${PRE_RESTORE_BACKUP}"
    exit 1
fi

log "Database restore process completed"
