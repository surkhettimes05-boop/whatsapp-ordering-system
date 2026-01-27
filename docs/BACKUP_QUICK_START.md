# PostgreSQL Backup Infrastructure - Quick Start Guide

## 5-Minute Setup

### 1. Create Backup Directory
```bash
sudo mkdir -p /backups/postgres
sudo mkdir -p /var/log/backups
sudo chown postgres:postgres /backups/postgres /var/log/backups
sudo chmod 750 /backups/postgres /var/log/backups
```

### 2. Configure Environment
```bash
# Copy example configuration
cp backend/config/backup.env.example backend/config/backup.env

# Edit with your settings
nano backend/config/backup.env

# Important: Set these minimum values:
# - DATABASE_URL or DB_* variables
# - AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
# - S3_BUCKET name
```

### 3. Make Scripts Executable
```bash
chmod +x backend/scripts/backup-postgres.sh
chmod +x backend/scripts/backup-sync-s3.sh
chmod +x backend/scripts/restore-postgres.sh
chmod +x backend/scripts/verify-backups.sh
chmod +x backend/scripts/setup-backup-cron.sh
chmod +x backend/scripts/send-alert.sh
```

### 4. Test Backup
```bash
# Source environment
source backend/config/backup.env

# Run backup as postgres user
sudo -u postgres backend/scripts/backup-postgres.sh

# Check result
ls -lh /backups/postgres/
cat /var/log/backups/backup.log
```

### 5. Setup Cron
```bash
# Run setup as root
sudo backend/scripts/setup-backup-cron.sh

# Verify cron jobs
sudo crontab -l
```

Done! Your backups are now automated.

---

## One-Command Deployment

```bash
# Run this for complete automated setup:
#!/bin/bash
set -e

# Create directories
sudo mkdir -p /backups/postgres /var/log/backups

# Set permissions
sudo chown postgres:postgres /backups/postgres /var/log/backups
sudo chmod 750 /backups/postgres /var/log/backups

# Copy configuration
cp backend/config/backup.env.example backend/config/backup.env

# Make scripts executable
chmod +x backend/scripts/{backup,restore,verify,sync,setup,send-alert}*.sh

# Run setup
sudo backend/scripts/setup-backup-cron.sh

echo "✓ PostgreSQL backup infrastructure ready!"
```

---

## Verify Setup

### Check Cron Jobs
```bash
# View configured jobs
sudo crontab -l

# Expected output:
# 0 2 * * * postgres /backend/scripts/backup-postgres.sh
# 30 2 * * * postgres /backend/scripts/backup-sync-s3.sh
# 0 3 * * * postgres /backend/scripts/verify-backups.sh
```

### Check Backup Status
```bash
# View last backup
ls -lh /backups/postgres/ | tail -5

# View backup logs
tail -20 /var/log/backups/backup.log

# Test restore capability
./backend/scripts/restore-postgres.sh --list-backups
```

### Manual Test Run
```bash
# Run backup manually
sudo -u postgres /backend/scripts/backup-postgres.sh

# Run S3 sync
sudo -u postgres /backend/scripts/backup-sync-s3.sh

# Run verification
sudo -u postgres /backend/scripts/verify-backups.sh
```

---

## Daily Operations

### Check Backup Status
```bash
# Quick status check
/backend/scripts/backup-status.sh

# Full verification
sudo -u postgres /backend/scripts/verify-backups.sh --full
```

### Restore from Backup
```bash
# List available backups
./backend/scripts/restore-postgres.sh --list-backups

# Restore latest
sudo -u postgres ./backend/scripts/restore-postgres.sh

# Restore specific backup
sudo -u postgres ./backend/scripts/restore-postgres.sh postgres_database_20260120_020000.sql.gz
```

### Monitor Backup Logs
```bash
# View real-time logs
tail -f /var/log/backups/backup.log

# View all backup logs
ls -lh /var/log/backups/

# Search for errors
grep ERROR /var/log/backups/*.log
```

---

## Troubleshooting

### Backup Not Running
```bash
# Check cron is enabled
sudo service cron status

# Check cron logs
sudo journalctl -u cron --follow

# Run backup manually
sudo -u postgres /backend/scripts/backup-postgres.sh

# Check for errors
tail -50 /var/log/backups/backup.log
```

### S3 Sync Failing
```bash
# Test AWS credentials
aws sts get-caller-identity

# Test S3 bucket access
aws s3 ls s3://your-backup-bucket/

# Re-configure AWS
aws configure

# Test sync manually
sudo -u postgres /backend/scripts/backup-sync-s3.sh --dry-run
```

### Low Disk Space
```bash
# Check usage
du -sh /backups/postgres/

# List old backups
ls -lhS /backups/postgres/ | tail -10

# Clean up manually (or wait for auto-cleanup)
rm /backups/postgres/postgres_database_20260101_*.sql.gz

# Cleanup via script
sudo -u postgres /backend/scripts/backup-postgres.sh --cleanup-old
```

---

## Monitoring Setup

### Add to Monitoring System

**Nagios/Icinga:**
```bash
# Place in /usr/lib/nagios/plugins/
cat > check_postgres_backup << 'EOF'
#!/bin/bash
LAST_BACKUP_FILE="/var/log/backups/.last_backup_time"
if [ ! -f "$LAST_BACKUP_FILE" ]; then
    echo "CRITICAL: No backup indicator file"
    exit 2
fi
LAST_BACKUP_EPOCH=$(cat "$LAST_BACKUP_FILE")
NOW=$(date +%s)
HOURS_AGO=$(( ($NOW - $LAST_BACKUP_EPOCH) / 3600 ))
if [ $HOURS_AGO -gt 26 ]; then
    echo "CRITICAL: Backup is ${HOURS_AGO}h old"
    exit 2
elif [ $HOURS_AGO -gt 24 ]; then
    echo "WARNING: Backup is ${HOURS_AGO}h old"
    exit 1
fi
echo "OK: Backup age is ${HOURS_AGO}h"
exit 0
EOF
chmod +x check_postgres_backup
```

**Prometheus/Grafana:**
```bash
# Create metrics exporter
cat > /usr/local/bin/postgres-backup-metrics << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/postgres"
LAST_BACKUP=$(ls -t "${BACKUP_DIR}"/postgres_*.sql.gz 2>/dev/null | head -1)
if [ -n "$LAST_BACKUP" ]; then
    SIZE=$(stat -c%s "$LAST_BACKUP")
    EPOCH=$(stat -c%Y "$LAST_BACKUP")
    echo "postgres_backup_size_bytes $SIZE $EPOCH"
    echo "postgres_backup_timestamp_seconds $EPOCH"
fi
EOF
chmod +x /usr/local/bin/postgres-backup-metrics
```

---

## Backup Schedule Summary

| Component | Time | Frequency |
|-----------|------|-----------|
| Daily Backup | 2:00 AM | Every day |
| S3 Sync | 2:30 AM | Every day |
| Verification | 3:00 AM | Every day |
| Local Cleanup | 1:00 AM | Every Sunday |

**Total Time:** ~60 minutes for backup window (2:00-3:00 AM)

---

## File Locations

```
/backups/postgres/                          # Local backup directory
  ├── postgres_database_20260122_020000.sql.gz
  ├── postgres_database_20260122_020000.meta
  ├── .last_backup_success
  └── .last_backup_time

/var/log/backups/                           # Log directory
  ├── backup.log                            # Daily backup logs
  ├── sync.log                              # S3 sync logs
  ├── verify.log                            # Verification logs
  ├── restore.log                           # Restore operations
  ├── alerts.log                            # Alert history
  ├── .last_verify_status                   # Verification status
  └── *.txt                                 # Verification reports

backend/scripts/                            # Backup scripts
  ├── backup-postgres.sh                    # Create backup
  ├── backup-sync-s3.sh                     # Sync to S3
  ├── restore-postgres.sh                   # Restore backup
  ├── verify-backups.sh                     # Verify integrity
  ├── setup-backup-cron.sh                  # Setup cron
  ├── send-alert.sh                         # Send alerts
  └── backup-status.sh                      # Check status

backend/config/                             # Configuration
  └── backup.env.example                    # Configuration template

/etc/cron.d/                                # System cron
  └── postgres-backups                      # Backup cron jobs

/etc/systemd/system/                        # Systemd units
  ├── postgres-backup.timer
  └── postgres-backup.service
```

---

## Next Steps

1. ✅ Run 5-minute setup above
2. ⏳ Wait for first backup (2:00 AM)
3. ⏳ Wait for S3 sync (2:30 AM)
4. ⏳ Wait for verification (3:00 AM)
5. ✅ Check `/var/log/backups/` for logs
6. ✅ Set up monitoring/alerts
7. ✅ Test restore process (via `--dry-run`)
8. ✅ Schedule monthly disaster recovery drill

---

## Additional Resources

- [Full Documentation](./BACKUP_SETUP.md)
- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [AWS S3 Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/BestPractices.html)
- [Disaster Recovery Plan](./DISASTER_RECOVERY.md)

---

## Emergency Restore

If you need to restore immediately without waiting for the 2:00 AM backup:

```bash
# 1. List available backups
./backend/scripts/restore-postgres.sh --list-backups

# 2. Restore from latest backup
sudo -u postgres ./backend/scripts/restore-postgres.sh

# 3. Or restore from specific backup
sudo -u postgres ./backend/scripts/restore-postgres.sh postgres_database_20260120_020000.sql.gz

# 4. Verify restored data
psql -U postgres -d ordering_system -c "SELECT COUNT(*) FROM information_schema.tables;"
```

For S3-only restore (if local backups unavailable):
```bash
sudo -u postgres ./backend/scripts/restore-postgres.sh postgres_database_20260120_020000.sql.gz --from-s3
```

---

## Support

For issues or questions:
1. Check log files: `/var/log/backups/*.log`
2. Run verification: `./backend/scripts/verify-backups.sh --full`
3. Review documentation: `./backend/docs/BACKUP_SETUP.md`
4. Test connectivity: `./backend/scripts/restore-postgres.sh --list-backups`
