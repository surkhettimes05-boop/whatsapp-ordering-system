# 💾 Backup Strategy (3-2-1 Rule)

## The Philosophy: 3-2-1
- **3** Copies of data (Production + Local + Cloud Storage)
- **2** Different media (SSD + Object Storage/Hard Drive)
- **1** Off-site location (e.g., AWS S3 or Google Drive)

---

## 🗄️ Database Backup (PostgreSQL)

### 1. Automated Daily Backups (Cron Job)
**Frequency:** Every night at 2:00 AM.
**Retention:** Keep last 7 days daily, last 4 weeks weekly.

#### Script (`scripts/backup_db.sh`)
```bash
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgres"
FILENAME="db_backup_$TIMESTAMP.sql"

# Create dump
docker exec whatsapp_postgres pg_dump -U postgres whatsapp_ordering > $BACKUP_DIR/$FILENAME

# Gzip it
gzip $BACKUP_DIR/$FILENAME

# (Optional) Upload to S3/Google Drive
# aws s3 cp $BACKUP_DIR/$FILENAME.gz s3://my-backup-bucket/
```

### 2. Manual Backup (Before Migrations)
**Trigger:** Before running `npx prisma migrate deploy`.

```bash
# Run on server
npm run db:backup
# OR
docker-compose exec postgres pg_dump -U postgres whatsapp_ordering > pre_migration_backup.sql
```

---

## 📂 File Storage Backup (Images)
**Content:** Product images, broadcast media.
- Since these are files, sync the `uploads/` volume.
- **Tools:** `rsync` or S3 bucket replication.
- **Tip:** Use Cloudinary or S3 for uploads directly to avoid managing local file backups.

---

## 🔄 Recovery Drill (Monthly)
**"A backup is useless if it cannot be restored."**

1. **Test Restoration:**
   On a local machine (NOT production):
   ```bash
   # 1. Start fresh DB
   docker-compose up -d postgres
   # 2. Restore
   gunzip < backup.sql.gz | docker-compose exec -T postgres psql -U postgres whatsapp_ordering
   # 3. Verify
   npx prisma studio
   ```
2. **Verify Integrity:** Check latest order counts match expectations.
