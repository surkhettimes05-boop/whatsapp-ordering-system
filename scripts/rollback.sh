#!/bin/bash

# Rollback Script
# Rolls back to previous deployment version

set -euo pipefail

# Configuration
APP_DIR="${APP_DIR:-/opt/whatsapp-ordering-system}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
ROLLBACK_VERSION="${1:-previous}"

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

cd "${APP_DIR}" || exit 1

log "Starting rollback process..."

# Get current version
CURRENT_VERSION=$(docker-compose ps backend --format "{{.Image}}" | cut -d: -f2 || echo "unknown")
log "Current version: ${CURRENT_VERSION}"

# Get previous version from git
if [ "${ROLLBACK_VERSION}" = "previous" ]; then
    log "Finding previous version from git..."
    PREVIOUS_VERSION=$(git log --oneline -2 | tail -1 | cut -d' ' -f1)
else
    PREVIOUS_VERSION="${ROLLBACK_VERSION}"
fi

log "Rolling back to version: ${PREVIOUS_VERSION}"

# Checkout previous version
log "Checking out previous version..."
git checkout "${PREVIOUS_VERSION}" || {
    error "Failed to checkout version ${PREVIOUS_VERSION}"
    exit 1
}

# Pull previous Docker image
log "Pulling previous Docker image..."
docker-compose pull backend || warn "Could not pull previous image, using current"

# Stop current containers gracefully
log "Stopping current containers..."
docker-compose stop backend || true

# Start previous version
log "Starting previous version..."
docker-compose up -d backend

# Wait for health check
log "Waiting for health check..."
sleep 30

# Verify health
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    log "Rollback successful! Service is healthy."
    
    # Restore database if backup exists
    LATEST_BACKUP=$(ls -t "${BACKUP_DIR}"/backup_*.sql.gz 2>/dev/null | head -1)
    if [ -n "${LATEST_BACKUP}" ]; then
        warn "Latest database backup found: ${LATEST_BACKUP}"
        read -p "Restore database from backup? (yes/no): " restore_db
        
        if [ "${restore_db}" = "yes" ]; then
            log "Restoring database from backup..."
            ./scripts/restore.sh "${LATEST_BACKUP}"
        fi
    fi
else
    error "Rollback failed! Service is not healthy."
    error "Attempting to restore from backup..."
    
    # Try to restore from backup
    LATEST_BACKUP=$(ls -t "${BACKUP_DIR}"/backup_*.sql.gz 2>/dev/null | head -1)
    if [ -n "${LATEST_BACKUP}" ]; then
        ./scripts/restore.sh "${LATEST_BACKUP}"
    fi
    
    exit 1
fi

log "Rollback process completed"
