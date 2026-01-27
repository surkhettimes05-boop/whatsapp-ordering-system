#!/bin/bash

################################################################################
# Backup Sync to AWS S3
# 
# Purpose: Sync local backups to S3 for offsite storage
# Features:
#   - Incremental sync (only new/modified files)
#   - Server-side encryption
#   - Versioning support
#   - Automatic cleanup of old versions
# 
# Prerequisites:
#   - AWS CLI installed: apt-get install awscli
#   - AWS credentials configured: aws configure
#   - S3 bucket created
# 
# Usage: ./backup-sync-s3.sh
# Cron: 30 2 * * * /path/to/backup-sync-s3.sh >> /var/log/backups/s3-sync.log 2>&1
################################################################################

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"
S3_BUCKET="${S3_BUCKET:-}"
S3_REGION="${S3_REGION:-us-east-1}"
S3_PREFIX="${S3_PREFIX:-database-backups}"
LOG_DIR="${LOG_DIR:-/var/log/backups}"
REMOTE_RETENTION_DAYS="${REMOTE_RETENTION_DAYS:-30}"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_DIR}/s3-sync.log"
}

log "=========================================="
log "Starting S3 backup sync"
log "=========================================="

# Validate configuration
if [ -z "$S3_BUCKET" ]; then
    log "ERROR: S3_BUCKET not configured"
    exit 1
fi

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    log "ERROR: AWS CLI not installed"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity --region "$S3_REGION" > /dev/null 2>&1; then
    log "ERROR: AWS credentials not configured or invalid"
    exit 1
fi

log "AWS credentials verified ✓"

# Create S3 bucket if it doesn't exist (only if needed)
if ! aws s3 ls "s3://${S3_BUCKET}" --region "$S3_REGION" > /dev/null 2>&1; then
    log "Creating S3 bucket: $S3_BUCKET"
    aws s3 mb "s3://${S3_BUCKET}" --region "$S3_REGION" || log "WARNING: Bucket creation failed or already exists"
    
    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket "$S3_BUCKET" \
        --versioning-configuration Status=Enabled \
        --region "$S3_REGION" || true
    
    # Enable encryption
    aws s3api put-bucket-encryption \
        --bucket "$S3_BUCKET" \
        --server-side-encryption-configuration '{
            "Rules": [{
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }]
        }' \
        --region "$S3_REGION" || true
fi

# Sync backups to S3
log "Syncing backups from $BACKUP_DIR to s3://${S3_BUCKET}/${S3_PREFIX}"

if aws s3 sync \
    "$BACKUP_DIR" \
    "s3://${S3_BUCKET}/${S3_PREFIX}" \
    --region "$S3_REGION" \
    --sse AES256 \
    --storage-class STANDARD_IA \
    --exclude ".*" \
    --delete \
    --verbose; then
    
    log "S3 sync completed successfully ✓"
else
    log "ERROR: S3 sync failed"
    exit 1
fi

# Get sync statistics
TOTAL_SIZE=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}" --region "$S3_REGION" --recursive --summarize | grep "Total Size")
FILE_COUNT=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}" --region "$S3_REGION" --recursive --summarize | grep "Total Objects")

log "Current S3 storage: $TOTAL_SIZE"
log "File count: $FILE_COUNT"

# Optional: Cleanup old versions (keep last 30 days worth)
log "Removing backup versions older than ${REMOTE_RETENTION_DAYS} days..."

CUTOFF_DATE=$(date -d "${REMOTE_RETENTION_DAYS} days ago" +%Y-%m-%d 2>/dev/null || date -v-${REMOTE_RETENTION_DAYS}d +%Y-%m-%d)

# List all versions and delete old ones
aws s3api list-object-versions \
    --bucket "$S3_BUCKET" \
    --prefix "$S3_PREFIX" \
    --region "$S3_REGION" \
    --query "Versions[?LastModified<='${CUTOFF_DATE}'].{Key:Key,VersionId:VersionId}" \
    --output text | while read -r key version_id; do
    
    if [ -n "$key" ] && [ -n "$version_id" ]; then
        log "Deleting old version: $key (VersionId: $version_id)"
        aws s3api delete-object \
            --bucket "$S3_BUCKET" \
            --key "$key" \
            --version-id "$version_id" \
            --region "$S3_REGION" || log "WARNING: Failed to delete version"
    fi
done

log "S3 sync and cleanup complete!"
log "=========================================="

# Create success indicator
touch "${BACKUP_DIR}/.last_s3_sync_success"
echo "$(date +%s)" > "${BACKUP_DIR}/.last_s3_sync_time"

exit 0
