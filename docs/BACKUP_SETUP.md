# PostgreSQL Backup Infrastructure Guide

## Overview

This backup infrastructure provides:
- **Automated daily backups** with compression
- **Off-server storage** on AWS S3 with versioning
- **Point-in-time recovery** capabilities
- **Backup verification** and integrity checks
- **Cron-based scheduling** with monitoring
- **Pre-restore safety backups** to prevent data loss

## Architecture

```
┌─────────────────────────────────────────────────┐
│     PostgreSQL Database                         │
│     (whatsapp-ordering system production DB)    │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  backup-postgres.sh    │
        │  (Daily @ 2:00 AM)     │
        └────────┬───────────────┘
                 │
        ┌────────▼──────────────────────┐
        │ Local Backup Storage          │
        │ /backups/postgres/            │
        │ (7-day retention)             │
        └────────┬──────────────────────┘
                 │
        ┌────────▼──────────────────────┐
        │  backup-sync-s3.sh            │
        │  (Sync @ 2:30 AM)             │
        └────────┬──────────────────────┘
                 │
        ┌────────▼──────────────────────┐
        │ AWS S3 Backup Storage         │
        │ (30-day retention)            │
        │ Versioning enabled            │
        │ AES256 encryption             │
        └───────────────────────────────┘
```

## Quick Start

### 1. Configure Environment

Set up backup environment variables in `.env`:

```bash
# PostgreSQL Connection
DATABASE_URL="postgresql://user:password@localhost:5432/ordering_system"
DB_NAME="ordering_system"
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="postgres"

# Backup Configuration
BACKUP_DIR="/backups/postgres"
BACKUP_RETENTION_DAYS=7

# AWS S3 Configuration
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"
S3_BUCKET="your-backup-bucket"
S3_PREFIX="database-backups"
REMOTE_RETENTION_DAYS=30
```

### 2. Create Backup Directory

```bash
sudo mkdir -p /backups/postgres
sudo mkdir -p /var/log/backups
sudo chown postgres:postgres /backups/postgres
sudo chmod 750 /backups/postgres
```

### 3. Test Backup Scripts

```bash
# Test PostgreSQL backup
sudo -u postgres /backend/scripts/backup-postgres.sh

# Test S3 sync
sudo -u postgres /backend/scripts/backup-sync-s3.sh

# Verify integrity
sudo -u postgres /backend/scripts/verify-backups.sh
```

### 4. Set Up Cron Scheduling

```bash
# Run setup script (requires sudo)
sudo /backend/scripts/setup-backup-cron.sh

# Verify cron jobs
sudo crontab -l
```

## Scripts Reference

### backup-postgres.sh

Daily backup creation with automatic compression and verification.

**Features:**
- PostgreSQL dump with `pg_dump`
- gzip compression (~90% size reduction)
- Metadata file generation
- Integrity verification
- Automatic cleanup of old backups
- Success indicators for monitoring

**Usage:**
```bash
./backup-postgres.sh                    # Run backup
./backup-postgres.sh --cleanup-old      # Cleanup retained backups
./backup-postgres.sh --dry-run          # Test without creating backup
```

**Output:**
```
Backup file: postgres_database_20260122_020000.sql.gz
Metadata: postgres_database_20260122_020000.meta
Log: /var/log/backups/backup.log
```

**Example Output:**
```
[2026-01-22 02:00:15] Starting PostgreSQL backup...
[2026-01-22 02:00:15] Database: ordering_system
[2026-01-22 02:00:15] Backup directory: /backups/postgres
[2026-01-22 02:02:45] Backup file: postgres_ordering_system_20260122_020000.sql.gz
[2026-01-22 02:02:45] File size: 245M (compressed from 2.1G)
[2026-01-22 02:02:46] Metadata file created
[2026-01-22 02:02:47] Integrity verification passed ✓
[2026-01-22 02:02:47] Backup completed successfully ✓
```

### backup-sync-s3.sh

Synchronize local backups to AWS S3 with versioning.

**Features:**
- AWS credentials validation
- Incremental sync (only uploads new files)
- Server-side encryption (AES256)
- STANDARD_IA storage class for cost savings
- Automatic version cleanup (30+ day retention)
- Detailed sync statistics

**Usage:**
```bash
./backup-sync-s3.sh                     # Standard sync
./backup-sync-s3.sh --full              # Full resync
./backup-sync-s3.sh --delete-versions   # Clean old versions
./backup-sync-s3.sh --dry-run           # Test without uploading
```

**S3 Bucket Setup (automatic or manual):**

The script auto-creates and configures the S3 bucket:
- Enables versioning for recovery capability
- Enables AES256 encryption
- Sets STANDARD_IA storage class
- Configures lifecycle policies

Manual setup (if needed):
```bash
# Create bucket
aws s3 mb s3://your-backup-bucket --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
    --bucket your-backup-bucket \
    --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
    --bucket your-backup-bucket \
    --server-side-encryption-configuration '{
        "Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            }
        }]
    }'
```

### restore-postgres.sh

Restore database from backup with safety measures.

**Features:**
- List available backups (local and S3)
- Automatic latest backup selection
- Pre-restore safety backup creation
- Integrity verification before restore
- Dry-run mode for testing
- Post-restore verification
- Automatic rollback capability

**Usage:**
```bash
# List available backups
./restore-postgres.sh --list-backups

# Restore from latest local backup
./restore-postgres.sh

# Restore from specific backup
./restore-postgres.sh postgres_database_20260122_020000.sql.gz

# Restore from S3
./restore-postgres.sh postgres_database_20260122_020000.sql.gz --from-s3

# Dry run (test without restoring)
./restore-postgres.sh --dry-run

# Skip confirmation prompts
./restore-postgres.sh --force
```

**Example Restore Process:**
```
[2026-01-22 14:30:00] PostgreSQL Database Restore
[2026-01-22 14:30:00] Database: ordering_system
[2026-01-22 14:30:00] Backup file: postgres_database_20260120_020000.sql.gz
[2026-01-22 14:30:01] File size: 245M
[2026-01-22 14:30:02] Verifying backup integrity...
[2026-01-22 14:30:03] Backup integrity check passed ✓
[2026-01-22 14:30:04] Testing database connection...
[2026-01-22 14:30:04] Database connection verified ✓
[2026-01-22 14:30:05] ⚠️  WARNING: This will restore database from backup!
[2026-01-22 14:30:05] ⚠️  All data since the backup was created will be LOST!
[2026-01-22 14:30:10] Creating pre-restore backup as safety measure...
[2026-01-22 14:30:35] Pre-restore backup created: pre_restore_20260122_143010.sql.gz
[2026-01-22 14:30:36] Starting restore...
[2026-01-22 14:31:45] Restore completed successfully ✓
[2026-01-22 14:31:46] Verifying restore...
[2026-01-22 14:31:47] Restored tables: 42
[2026-01-22 14:31:47] Restore complete!
```

### verify-backups.sh

Daily backup integrity verification and test restore (optional).

**Features:**
- Backup metadata validation
- gzip compression integrity checks
- Backup age monitoring
- S3 backup verification
- Test restore capability (full verification mode)
- Automatic corruption repair
- Alert generation for monitoring

**Usage:**
```bash
./verify-backups.sh                     # Quick integrity check
./verify-backups.sh --full              # Full verification with test restore
./verify-backups.sh --repair            # Repair corrupted backups
./verify-backups.sh --no-alerts         # Verify without sending alerts
```

**Verification Checks:**
1. Backup directory exists
2. Backup count verification
3. Metadata file validation
4. gzip compression integrity
5. Backup recency (age in hours)
6. S3 bucket accessibility
7. S3 versioning enabled
8. Test restore (optional)

**Example Output:**
```
[2026-01-22 03:00:00] PostgreSQL Backup Verification Report
[2026-01-22 03:00:00] Database: ordering_system
[2026-01-22 03:00:01] ✓ Backup directory exists
[2026-01-22 03:00:01] Found 7 backups
[2026-01-22 03:00:01] Checking metadata files...
[2026-01-22 03:00:02] ✓ Metadata valid: postgres_ordering_system_20260122_020000.sql.gz
[2026-01-22 03:00:02] Checking backup integrity...
[2026-01-22 03:00:15] ✓ Integrity OK: postgres_ordering_system_20260122_020000.sql.gz
[2026-01-22 03:00:16] ✓ Backup is recent (1h old)
[2026-01-22 03:00:16] S3 backups: 7
[2026-01-22 03:00:17] ✓ S3 versioning enabled
[2026-01-22 03:00:17] ✓ All verification checks passed!
```

## Cron Schedule

Default schedule configured by `setup-backup-cron.sh`:

| Time  | Task | Script | Purpose |
|-------|------|--------|---------|
| 2:00 AM | Daily Backup | `backup-postgres.sh` | Create compressed backup |
| 2:30 AM | S3 Sync | `backup-sync-s3.sh` | Upload to S3 |
| 3:00 AM | Verification | `verify-backups.sh` | Verify integrity |
| 1:00 AM (Sun) | Cleanup | `backup-postgres.sh --cleanup-old` | Remove old local backups |

**View cron logs:**
```bash
# View all cron executions
sudo journalctl -u cron --follow

# View specific service logs
tail -f /var/log/backups/backup.log
tail -f /var/log/backups/sync.log
tail -f /var/log/backups/verify.log

# Check backup status
/backend/scripts/backup-status.sh
```

## Monitoring

### Success Indicators

The backup scripts create indicator files for monitoring:

```bash
# Last successful backup
ls -la /var/log/backups/.last_backup_success

# Last backup time
cat /var/log/backups/.last_backup_time

# Last verification status
cat /var/log/backups/.last_verify_status
```

### Nagios/Prometheus Integration

```bash
#!/bin/bash
# check_backup_status.sh - Nagios plugin

LAST_BACKUP="/var/log/backups/.last_backup_time"
MAX_AGE_HOURS=26

if [ ! -f "$LAST_BACKUP" ]; then
    echo "CRITICAL: No backup indicator file"
    exit 2
fi

BACKUP_TIME=$(cat "$LAST_BACKUP")
CURRENT_TIME=$(date +%s)
BACKUP_AGE=$(( ($CURRENT_TIME - $BACKUP_TIME) / 3600 ))

if [ $BACKUP_AGE -gt $MAX_AGE_HOURS ]; then
    echo "CRITICAL: Backup is ${BACKUP_AGE}h old (max: ${MAX_AGE_HOURS}h)"
    exit 2
elif [ $BACKUP_AGE -gt 24 ]; then
    echo "WARNING: Backup is ${BACKUP_AGE}h old"
    exit 1
else
    echo "OK: Backup age is ${BACKUP_AGE}h"
    exit 0
fi
```

### Manual Status Check

```bash
# Check if backup ran today
ls -la /backups/postgres/postgres_*_$(date +%Y%m%d)*.sql.gz

# Check backup file sizes
du -h /backups/postgres/ | sort -h

# Verify S3 backups
aws s3 ls s3://your-backup-bucket/database-backups/ --recursive

# Check backup log
tail -50 /var/log/backups/backup.log
```

## Disaster Recovery

### Scenario 1: Restore from Local Backup

```bash
# 1. List available backups
./restore-postgres.sh --list-backups

# 2. Restore from specific backup
sudo -u postgres ./restore-postgres.sh postgres_database_20260120_020000.sql.gz

# 3. Verify restore
psql -U postgres -d ordering_system -c "SELECT COUNT(*) FROM information_schema.tables;"
```

### Scenario 2: Restore from S3 (Server Lost)

```bash
# 1. New server with AWS CLI configured
aws configure

# 2. Download backup from S3
aws s3 cp s3://your-backup-bucket/database-backups/postgres_database_20260120_020000.sql.gz /tmp/

# 3. Restore to new PostgreSQL instance
./restore-postgres.sh /tmp/postgres_database_20260120_020000.sql.gz

# 4. Verify data integrity
psql -U postgres -d ordering_system -c "SELECT * FROM orders LIMIT 5;"
```

### Scenario 3: Accidental Data Deletion

```bash
# 1. Restore to point-in-time before deletion
./restore-postgres.sh --list-backups

# 2. Use backup immediately before deletion
./restore-postgres.sh postgres_database_20260121_020000.sql.gz

# 3. Export specific tables needed
pg_dump -U postgres ordering_system -t orders | gzip > orders_backup.sql.gz

# 4. Restore original database
./restore-postgres.sh postgres_database_20260122_020000.sql.gz

# 5. Restore specific tables
gunzip < orders_backup.sql.gz | psql -U postgres ordering_system
```

## Troubleshooting

### Backup Fails: "Connection refused"

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection parameters
psql -U postgres -h localhost -p 5432 -d ordering_system -c "SELECT 1"

# Update .env with correct connection details
nano .env
```

### S3 Sync Fails: "Access denied"

```bash
# Verify AWS credentials
aws sts get-caller-identity

# Check S3 bucket permissions
aws s3 ls s3://your-backup-bucket/

# Update credentials if needed
aws configure
```

### Restore Fails: "Backup corrupted"

```bash
# Verify backup file
gunzip -t /backups/postgres/postgres_database_*.sql.gz

# Try restore from S3 instead
./restore-postgres.sh postgres_database_20260120_020000.sql.gz --from-s3

# If S3 also corrupted, use pre-restore backup
./restore-postgres.sh pre_restore_20260120_143010.sql.gz
```

### Low Disk Space

```bash
# Check current disk usage
du -sh /backups/postgres/

# Cleanup old backups
./backup-postgres.sh --cleanup-old

# Check S3 version cleanup
./backup-sync-s3.sh --delete-versions

# Verify cleanup
du -sh /backups/postgres/
```

## Performance Tuning

### For Large Databases (>10GB)

```bash
# backup-postgres.sh - Add parallel workers
pg_dump -j 4 --schema-only ...  # 4 parallel jobs

# Adjust backup window to run 1:00 AM instead
# Edit cron file: sudo nano /etc/cron.d/postgres-backups
```

### For S3 Uploads with Limited Bandwidth

```bash
# backup-sync-s3.sh - Reduce concurrency
aws s3 sync --max-concurrent-requests 1 ...

# Increase STANDARD_IA transition to save costs
aws s3api put-bucket-lifecycle-configuration ...
```

## Security Considerations

1. **Database Credentials**: Store in `.env` with restricted permissions
   ```bash
   chmod 600 .env
   ```

2. **AWS Credentials**: Use IAM user with least privilege
   ```bash
   # IAM Policy: S3 bucket access only
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "s3:*",
         "Resource": [
           "arn:aws:s3:::your-backup-bucket",
           "arn:aws:s3:::your-backup-bucket/*"
         ]
       }
     ]
   }
   ```

3. **Backup Encryption**: AES256 enabled on S3
4. **Access Control**: Backups owned by `postgres` user (mode 700)
5. **Log Security**: Restrict backup log access to authorized users

## Cost Optimization

### S3 Storage Tiers
- **STANDARD**: First 30 days for fast access
- **STANDARD_IA**: After 30 days for cold storage
- **GLACIER**: Archive after 90 days

### Estimated Costs (for 250MB daily backup)
- Local storage: $0 (owned server space)
- S3 STANDARD: ~$10/month (7-day backups)
- S3 STANDARD_IA: ~$1/month (30-day retention)
- Total: ~$11/month for backup infrastructure

## Maintenance

### Monthly Tasks
1. Review backup logs for errors
2. Test restore process to new database
3. Verify S3 backup count matches local count
4. Check disk space usage trends

### Quarterly Tasks
1. Update .env credentials if rotated
2. Review backup retention policies
3. Audit S3 access logs
4. Optimize backup window if needed

### Yearly Tasks
1. Full disaster recovery drill
2. Archive old backups to Glacier
3. Review backup strategy for growing database
4. Update documentation

## Files Reference

| File | Purpose | Schedule |
|------|---------|----------|
| `backup-postgres.sh` | Create daily backup | 2:00 AM |
| `backup-sync-s3.sh` | Sync to S3 | 2:30 AM |
| `restore-postgres.sh` | Restore from backup | On-demand |
| `verify-backups.sh` | Verify integrity | 3:00 AM |
| `setup-backup-cron.sh` | Configure scheduling | One-time setup |
| `backup-status.sh` | Check backup status | On-demand |
| `/etc/cron.d/postgres-backups` | Cron jobs | System scheduling |

## Support & Documentation

For detailed information:
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [Bash Script Guide](https://www.gnu.org/software/bash/manual/)

For emergency support:
1. Check `/var/log/backups/*.log` for error details
2. Run `./verify-backups.sh` to identify issues
3. Review this documentation for troubleshooting
4. Consider hiring PostgreSQL DBA for complex issues
