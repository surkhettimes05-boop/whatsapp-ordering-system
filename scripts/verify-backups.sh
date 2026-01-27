#!/bin/bash

################################################################################
# Backup Verification Script
# 
# Purpose: Verify database backups are healthy and recoverable
# Runs: Daily integrity checks, optional test restores
# 
# Usage:
#   ./verify-backups.sh                    # Quick integrity check
#   ./verify-backups.sh --full             # Full verification with test restore
#   ./verify-backups.sh --repair           # Attempt to repair corrupted backups
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
BACKUP_AGE_WARNING_HOURS="${BACKUP_AGE_WARNING_HOURS:-26}"
TEST_RESTORE=0
REPAIR=0
SEND_ALERTS=1

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_DIR}/verify.log"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "${LOG_DIR}/verify.log"
}

success() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ $*" | tee -a "${LOG_DIR}/verify.log"
}

warning() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  WARNING: $*" | tee -a "${LOG_DIR}/verify.log"
}

# Alert function
alert() {
    local level=$1
    local message=$2
    
    if [ $SEND_ALERTS -eq 0 ]; then
        return
    fi
    
    # Check for alert script
    if [ -f "${LOG_DIR}/../send-alert.sh" ]; then
        "${LOG_DIR}/../send-alert.sh" "$level" "Backup Verification: $message" || true
    fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --full)
            TEST_RESTORE=1
            shift
            ;;
        --repair)
            REPAIR=1
            shift
            ;;
        --no-alerts)
            SEND_ALERTS=0
            shift
            ;;
        *)
            shift
            ;;
    esac
done

mkdir -p "$BACKUP_DIR" "$LOG_DIR"

# Initialize report
REPORT_FILE="${LOG_DIR}/verify_report_$(date +%Y%m%d_%H%M%S).txt"
VERIFICATION_PASSED=1
ISSUES=0

{
    log "=========================================="
    log "PostgreSQL Backup Verification Report"
    log "=========================================="
    log "Date: $(date)"
    log "Database: $DB_NAME"
    log "Backup directory: $BACKUP_DIR"
    log "=========================================="
    
    # Check backup directory exists
    if [ ! -d "$BACKUP_DIR" ]; then
        error "Backup directory does not exist: $BACKUP_DIR"
        VERIFICATION_PASSED=0
        ISSUES=$((ISSUES + 1))
    else
        success "Backup directory exists"
    fi
    
    # Count backups
    BACKUP_COUNT=$(find "$BACKUP_DIR" -name "postgres_${DB_NAME}_*.sql.gz" -type f | wc -l)
    log "Found $BACKUP_COUNT backups"
    
    if [ $BACKUP_COUNT -eq 0 ]; then
        error "No backups found!"
        VERIFICATION_PASSED=0
        ISSUES=$((ISSUES + 1))
    fi
    
    # Check backup metadata files
    log ""
    log "Checking metadata files..."
    MISSING_METADATA=0
    
    find "$BACKUP_DIR" -name "postgres_${DB_NAME}_*.sql.gz" -type f | while read backup; do
        metadata="${backup%.sql.gz}.meta"
        
        if [ ! -f "$metadata" ]; then
            warning "Missing metadata: $backup"
            MISSING_METADATA=$((MISSING_METADATA + 1))
        else
            # Check metadata content
            if grep -q "backup_status.*success" "$metadata"; then
                success "Metadata valid: $(basename $backup)"
            else
                warning "Metadata indicates failed backup: $backup"
                MISSING_METADATA=$((MISSING_METADATA + 1))
            fi
        fi
    done
    
    if [ $MISSING_METADATA -gt 0 ]; then
        ISSUES=$((ISSUES + MISSING_METADATA))
    fi
    
    # Integrity checks
    log ""
    log "Checking backup integrity..."
    CORRUPTED=0
    INTEGRITY_CHECKS=0
    
    find "$BACKUP_DIR" -name "postgres_${DB_NAME}_*.sql.gz" -type f | while read backup; do
        INTEGRITY_CHECKS=$((INTEGRITY_CHECKS + 1))
        
        if gunzip -t "$backup" > /dev/null 2>&1; then
            success "Integrity OK: $(basename $backup)"
        else
            error "Corrupted backup: $backup"
            CORRUPTED=$((CORRUPTED + 1))
        fi
    done
    
    if [ $CORRUPTED -gt 0 ]; then
        ISSUES=$((ISSUES + CORRUPTED))
        warning "$CORRUPTED corrupted backups found"
        alert "ERROR" "$CORRUPTED corrupted backups detected in $BACKUP_DIR"
    fi
    
    # Check backup age
    log ""
    log "Checking backup recency..."
    LATEST_BACKUP=$(find "$BACKUP_DIR" -name "postgres_${DB_NAME}_*.sql.gz" -type f -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2-)
    
    if [ -n "$LATEST_BACKUP" ]; then
        BACKUP_TIME=$(stat -c %Y "$LATEST_BACKUP")
        CURRENT_TIME=$(date +%s)
        BACKUP_AGE_HOURS=$(( ($CURRENT_TIME - $BACKUP_TIME) / 3600 ))
        
        log "Latest backup: $(basename $LATEST_BACKUP)"
        log "Backup age: ${BACKUP_AGE_HOURS} hours"
        
        if [ $BACKUP_AGE_HOURS -gt $BACKUP_AGE_WARNING_HOURS ]; then
            warning "Backup is ${BACKUP_AGE_HOURS} hours old (warning threshold: ${BACKUP_AGE_WARNING_HOURS}h)"
            ISSUES=$((ISSUES + 1))
            alert "WARNING" "Latest backup is ${BACKUP_AGE_HOURS}h old, may have missed scheduled backup"
        else
            success "Backup is recent (${BACKUP_AGE_HOURS}h old)"
        fi
    fi
    
    # Check S3 backups
    if [ -n "$S3_BUCKET" ]; then
        log ""
        log "Checking S3 backups..."
        
        if ! command -v aws &> /dev/null; then
            warning "AWS CLI not installed, skipping S3 verification"
        else
            S3_BACKUP_COUNT=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --recursive | grep "postgres_${DB_NAME}" | wc -l)
            log "S3 backups: $S3_BACKUP_COUNT"
            
            if [ $S3_BACKUP_COUNT -eq 0 ]; then
                warning "No backups found in S3"
                ISSUES=$((ISSUES + 1))
                alert "WARNING" "No backups found in S3 bucket $S3_BUCKET"
            else
                success "S3 backups present"
            fi
            
            # Check S3 bucket versioning
            VERSIONING_STATUS=$(aws s3api get-bucket-versioning --bucket "$S3_BUCKET" --query 'Status' --output text)
            if [ "$VERSIONING_STATUS" = "Enabled" ]; then
                success "S3 versioning enabled"
            else
                warning "S3 versioning not enabled"
            fi
        fi
    fi
    
    # Test restore (if requested)
    if [ $TEST_RESTORE -eq 1 ]; then
        log ""
        log "Running test restore..."
        log "NOTE: This will create a temporary test database"
        
        TEST_DB="${DB_NAME}_restore_test_$(date +%s)"
        
        # Create test database
        if ! PGPASSWORD="$DB_PASSWORD" createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$TEST_DB" > /dev/null 2>&1; then
            warning "Could not create test database for restore verification"
            ISSUES=$((ISSUES + 1))
        else
            # Attempt restore to test database
            if [ -n "$LATEST_BACKUP" ]; then
                if PGPASSWORD="$DB_PASSWORD" gunzip -c "$LATEST_BACKUP" | PGPASSWORD="$DB_PASSWORD" psql \
                    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB" > /dev/null 2>&1; then
                    
                    success "Test restore successful"
                    
                    # Verify data
                    TABLE_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
                    log "Tables in restored database: $TABLE_COUNT"
                    
                else
                    error "Test restore failed"
                    ISSUES=$((ISSUES + 1))
                fi
            fi
            
            # Cleanup test database
            if ! PGPASSWORD="$DB_PASSWORD" dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$TEST_DB" > /dev/null 2>&1; then
                warning "Could not drop test database: $TEST_DB"
            fi
        fi
    fi
    
    # Repair corrupted backups (if requested)
    if [ $REPAIR -eq 1 ] && [ $CORRUPTED -gt 0 ]; then
        log ""
        log "Attempting to repair corrupted backups..."
        
        find "$BACKUP_DIR" -name "postgres_${DB_NAME}_*.sql.gz" -type f | while read backup; do
            if ! gunzip -t "$backup" > /dev/null 2>&1; then
                warning "Attempting to repair: $backup"
                # Try to remove corrupted file
                mv "$backup" "${backup}.corrupted"
                log "Moved corrupted file to: ${backup}.corrupted"
            fi
        done
    fi
    
    # Summary
    log ""
    log "=========================================="
    log "Verification Summary"
    log "=========================================="
    log "Issues found: $ISSUES"
    log "Backups verified: $INTEGRITY_CHECKS"
    log "Corrupted backups: $CORRUPTED"
    log "Missing metadata: $MISSING_METADATA"
    
    if [ $VERIFICATION_PASSED -eq 0 ] || [ $ISSUES -gt 0 ]; then
        warning "Verification completed with issues"
        alert "WARNING" "Backup verification found $ISSUES issues"
        echo "FAILED" > "${LOG_DIR}/.last_verify_status"
    else
        success "All verification checks passed!"
        alert "SUCCESS" "Backup verification completed successfully"
        echo "SUCCESS" > "${LOG_DIR}/.last_verify_status"
    fi
    
    log "=========================================="
    
} | tee -a "$REPORT_FILE"

log "Verification report saved to: $REPORT_FILE"

if [ $VERIFICATION_PASSED -eq 0 ]; then
    exit 1
fi

exit 0
