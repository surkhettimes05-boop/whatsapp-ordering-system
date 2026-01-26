# 🔄 Database Migration Process

## ⚠️ Golden Rule
**NEVER edit `schema.prisma` and push to production without testing the migration locally first.**

---

## 1. Development (Local)
1. **Edit Schema:** Modify `prisma/schema.prisma`.
2. **Generate Migration:**
   ```bash
   npx prisma migrate dev --name describe_change
   ```
   *This creates a new SQL file in `prisma/migrations`.*
3. **Verify:** Check the SQL file. Does it drop tables? (**DANGER!**)
4. **Test:** Run API tests to ensure new schema works with code.

## 2. Pre-Deployment Checks
- [ ] Migration SQL reviewed?
- [ ] **Backup created?** (See `BACKUP_STRATEGY.md`)
- [ ] Is the changelog updated?

## 3. Production Deployment
1. **Pull Code:**
   ```bash
   git pull origin main
   ```
2. **Run Migration:**
   *Note: Our `start.sh` script does this automatically on restart, but manual control is safer for big changes.*
   ```bash
   docker-compose exec backend npx prisma migrate deploy
   ```
   *`migrate deploy` applies pending migrations without asking questions. It does NOT reset the DB.*

## 4. Rollback Plan
Prisma does not have a native "down" migration command easily.
- **If migration fails:**
  - Restore from Backup (Pre-migration dump).
  - Fix the SQL locally.
  - Re-deploy.

---

## 🚨 Troubleshooting "Drift"
If production DB says it has drifted:
- **Do NOT run `migrate reset`.** This deletes data.
- Use `prisma migrate resolve` to mark failed migrations as resolved if fixed manually.
