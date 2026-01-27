# Production Docker Setup - Index & Navigation

## 📍 What Was Delivered

Complete production Docker infrastructure for WhatsApp Ordering System. Start immediately with:

```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## 📂 File Structure

### Core Docker Files

| File | Purpose | Size |
|------|---------|------|
| [Dockerfile.prod](Dockerfile.prod) | Production image (multi-stage, optimized) | 85 lines |
| [docker-compose.prod.yml](docker-compose.prod.yml) | Orchestration (3 services + volumes) | 300+ lines |
| [.env.production.example](.env.production.example) | Configuration template | 60+ lines |
| [.dockerignore](.dockerignore) | Build optimizations | 20 lines |

### Deployment Scripts

| File | Purpose | Usage |
|------|---------|-------|
| [scripts/deploy-prod.sh](scripts/deploy-prod.sh) | Automated deployment | `chmod +x && ./scripts/deploy-prod.sh` |
| [scripts/backup-db.sh](scripts/backup-db.sh) | Database backups | `./scripts/backup-db.sh` or cron |
| [scripts/validate-prod-env.sh](scripts/validate-prod-env.sh) | Environment validation | `./scripts/validate-prod-env.sh` |
| [scripts/start-prod.ps1](scripts/start-prod.ps1) | Windows startup | `.\scripts\start-prod.ps1 -Action up` |
| [scripts/init-db.sql](scripts/init-db.sql) | DB initialization | Runs on first start |

### Documentation Files

| Document | Best For | Read Time |
|----------|----------|-----------|
| **[DOCKER_PRODUCTION_SETUP.md](DOCKER_PRODUCTION_SETUP.md)** | Complete reference guide | 30 min |
| **[DOCKER_QUICK_REFERENCE.md](DOCKER_QUICK_REFERENCE.md)** | Quick lookup & commands | 5 min |
| **[DOCKER_PRODUCTION_DELIVERY.md](DOCKER_PRODUCTION_DELIVERY.md)** | Delivery summary & overview | 15 min |
| **[This file](DOCKER_PRODUCTION_INDEX.md)** | Navigation & structure | 5 min |

---

## 🚀 Getting Started (Choose Your Path)

### Path 1: Quick Start (5 minutes)
1. Copy `.env.production.example` → `.env.production`
2. Generate secrets (see commands below)
3. Run: `docker compose -f docker-compose.prod.yml up -d`
4. Verify: `curl http://localhost:5000/health`

**See:** [DOCKER_QUICK_REFERENCE.md](DOCKER_QUICK_REFERENCE.md#setup-5-minutes)

### Path 2: Automated Deployment (10 minutes)
1. Configure `.env.production`
2. Run: `chmod +x scripts/deploy-prod.sh && ./scripts/deploy-prod.sh`
3. Script handles everything: validation, building, health checks, migrations

**See:** [scripts/deploy-prod.sh](scripts/deploy-prod.sh)

### Path 3: Windows PowerShell
1. Configure `.env.production`
2. Run: `.\scripts\start-prod.ps1 -Action up -Detached`
3. Monitor: `.\scripts\start-prod.ps1 -Action logs -FollowLogs`

**See:** [scripts/start-prod.ps1](scripts/start-prod.ps1)

---

## 📋 Setup Steps

### Step 1: Configure Environment

```bash
# Copy template
cp .env.production.example .env.production

# Edit with your values
nano .env.production  # Linux/Mac
# or
notepad .env.production  # Windows
```

### Step 2: Generate Secrets

```bash
# JWT Secret
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Redis Password
node -e "console.log('REDIS_PASSWORD=' + require('crypto').randomBytes(32).toString('hex'))"

# Add both to .env.production
```

### Step 3: Validate Configuration

```bash
# Optional but recommended
chmod +x scripts/validate-prod-env.sh
./scripts/validate-prod-env.sh
```

### Step 4: Start Services

```bash
# Option A: Direct command
docker compose -f docker-compose.prod.yml up -d

# Option B: Automated script
chmod +x scripts/deploy-prod.sh
./scripts/deploy-prod.sh

# Option C: Windows PowerShell
.\scripts\start-prod.ps1 -Action up -Detached
```

### Step 5: Verify

```bash
# Check all services
docker compose -f docker-compose.prod.yml ps
# All should show: Up X seconds (health: healthy)

# Test API
curl http://localhost:5000/health

# Check logs
docker compose -f docker-compose.prod.yml logs -f app
```

---

## 🎯 Common Tasks

### View Service Status
```bash
docker compose -f docker-compose.prod.yml ps
```
→ See: [DOCKER_QUICK_REFERENCE.md#verification](DOCKER_QUICK_REFERENCE.md#verification)

### Check Logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs postgres
docker compose -f docker-compose.prod.yml logs redis
```
→ See: [DOCKER_PRODUCTION_SETUP.md#monitoring--logging](DOCKER_PRODUCTION_SETUP.md#-monitoring--logging)

### Backup Database
```bash
./scripts/backup-db.sh
```
→ See: [scripts/backup-db.sh](scripts/backup-db.sh)

### Run Migrations
```bash
docker compose -f docker-compose.prod.yml exec app npm run db:migrate
```
→ See: [DOCKER_PRODUCTION_SETUP.md#database-migration](DOCKER_PRODUCTION_SETUP.md#database-migration)

### Restart Services
```bash
# Single service
docker compose -f docker-compose.prod.yml restart app

# All services
docker compose -f docker-compose.prod.yml restart
```

### Stop Services
```bash
# Graceful stop
docker compose -f docker-compose.prod.yml stop

# Remove containers (keeps data)
docker compose -f docker-compose.prod.yml down

# Remove everything (WARNING: deletes data!)
docker compose -f docker-compose.prod.yml down -v
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────┐
│  Production Environment                     │
├─────────────────────────────────────────────┤
│                                             │
│  PostgreSQL 16    Redis 7    Node.js App   │
│  Port: 5432       Port: 6379 Port: 5000    │
│  Health: ✓        Health: ✓  Health: ✓     │
│  2 CPU / 2GB      1 CPU / 1GB 2 CPU / 2GB  │
│                                             │
│  ✓ Persistent volumes                       │
│  ✓ Automatic restarts                       │
│  ✓ Health checks enabled                    │
│  ✓ JSON logging configured                  │
│                                             │
└─────────────────────────────────────────────┘

Volumes:
  data/postgres   → PostgreSQL data
  data/redis      → Redis persistence
  data/backups    → Database backups
  logs/           → Application logs
```

---

## 🔧 Configuration Reference

### Environment Variables

**Required (must fill):**
```env
DB_PASSWORD=generate_strong_password     # 32+ chars
REDIS_PASSWORD=generate_strong_password  # 32+ chars
JWT_SECRET=generated_random_secret       # 32+ chars
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+number
TWILIO_PHONE_NUMBER=+number
```

**Optional (for features):**
```env
OPENAI_API_KEY=sk-xxxxx        # AI features
SMTP_HOST=smtp.gmail.com       # Email
SLACK_WEBHOOK_URL=https://...  # Alerts
```

See: [.env.production.example](.env.production.example)

---

## 🏥 Health Checks

All services are monitored and auto-restart on failure:

| Service | Check | Status |
|---------|-------|--------|
| PostgreSQL | `pg_isready + SELECT 1` | Shows in `docker compose ps` |
| Redis | `redis-cli ping` | Shows in `docker compose ps` |
| Node.js | `curl /health` | Shows in `docker compose ps` |

View status:
```bash
docker compose -f docker-compose.prod.yml ps
# STATUS column: "Up X minutes (health: healthy)"
```

---

## 💾 Data & Backups

### Persistent Volumes
```
data/
├── postgres/   → Database files (auto-created)
├── redis/      → Redis snapshots (auto-created)
└── backups/    → Manual backups (auto-created)
```

### Backup Automation
```bash
# Manual backup
./scripts/backup-db.sh

# Automatic (add to cron)
0 2 * * * cd /app && ./scripts/backup-db.sh >> logs/backup.log 2>&1

# List backups
ls -lh data/backups/

# Restore from backup
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres -d whatsapp_ordering < data/backups/backup_20240122_020000.sql.gz
```

See: [DOCKER_PRODUCTION_SETUP.md#data-persistence](DOCKER_PRODUCTION_SETUP.md#data-persistence)

---

## 🔒 Security

### Already Configured ✅
- Non-root user execution
- Network isolation
- Resource limits
- Signal handling
- Health checks

### You Should Configure ✅
- Change credentials in `.env.production`
- Enable SSL/TLS (reverse proxy)
- Firewall rules
- Regular security audits
- Log monitoring

See: [DOCKER_PRODUCTION_SETUP.md#security-hardening](DOCKER_PRODUCTION_SETUP.md#security-hardening)

---

## 📊 Monitoring & Operations

### Daily Checks
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail 100 app
```

### Weekly Checks
```bash
docker compose -f docker-compose.prod.yml stats
docker compose -f docker-compose.prod.yml exec postgres du -sh /var/lib/postgresql/data
./scripts/backup-db.sh
```

### Monthly Maintenance
```bash
# Clean old backups (automatic in script)
# Review performance metrics
# Rotate credentials
# Security audit
```

See: [DOCKER_PRODUCTION_SETUP.md#monitoring--logging](DOCKER_PRODUCTION_SETUP.md#-monitoring--logging)

---

## 🆘 Troubleshooting

### Service Won't Start
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs app

# Common issues:
# 1. Port in use
lsof -i :5000

# 2. Database not ready
docker compose -f docker-compose.prod.yml logs postgres

# 3. Missing env vars
grep DB_PASSWORD .env.production
```

### Connection Errors
```bash
# Test database
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -d whatsapp_ordering -c "SELECT 1"

# Test Redis
docker compose -f docker-compose.prod.yml exec redis \
  redis-cli ping

# Test app health
curl http://localhost:5000/health
```

See: [DOCKER_PRODUCTION_SETUP.md#troubleshooting](DOCKER_PRODUCTION_SETUP.md#troubleshooting)

---

## 📚 Documentation Map

### Quick References
- [DOCKER_QUICK_REFERENCE.md](DOCKER_QUICK_REFERENCE.md) - One-page cheat sheet
- [This file](DOCKER_PRODUCTION_INDEX.md) - Navigation guide

### Complete Guides
- [DOCKER_PRODUCTION_SETUP.md](DOCKER_PRODUCTION_SETUP.md) - Full reference (600+ lines)
- [DOCKER_PRODUCTION_DELIVERY.md](DOCKER_PRODUCTION_DELIVERY.md) - What was delivered

### Scripts
- [scripts/deploy-prod.sh](scripts/deploy-prod.sh) - Automated deployment
- [scripts/backup-db.sh](scripts/backup-db.sh) - Database backups
- [scripts/validate-prod-env.sh](scripts/validate-prod-env.sh) - Configuration validation
- [scripts/start-prod.ps1](scripts/start-prod.ps1) - Windows startup

### Configuration
- [Dockerfile.prod](Dockerfile.prod) - Production image
- [docker-compose.prod.yml](docker-compose.prod.yml) - Orchestration
- [.env.production.example](.env.production.example) - Secrets template

---

## ⏱️ Quick Commands Reference

```bash
# Lifecycle
docker compose -f docker-compose.prod.yml up -d        # Start
docker compose -f docker-compose.prod.yml stop         # Stop
docker compose -f docker-compose.prod.yml restart      # Restart
docker compose -f docker-compose.prod.yml down         # Down

# Monitoring
docker compose -f docker-compose.prod.yml ps           # Status
docker compose -f docker-compose.prod.yml logs -f app  # Logs
docker compose -f docker-compose.prod.yml stats        # Resources

# Database
docker compose -f docker-compose.prod.yml exec app npm run db:migrate
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres

# Backup
./scripts/backup-db.sh                                 # Backup now

# Scripts
./scripts/deploy-prod.sh                               # Deploy all
./scripts/validate-prod-env.sh                         # Validate
.\scripts\start-prod.ps1 -Action up                    # Windows
```

---

## ✅ Pre-Deployment Checklist

- [ ] Configure `.env.production` with actual values
- [ ] Generate strong passwords (32+ characters)
- [ ] Create required directories
- [ ] Validate configuration: `./scripts/validate-prod-env.sh`
- [ ] Test locally: `docker compose -f docker-compose.prod.yml up`
- [ ] Verify health: `curl http://localhost:5000/health`
- [ ] Test backup: `./scripts/backup-db.sh`
- [ ] Setup backup cron job
- [ ] Configure SSL/TLS (reverse proxy)
- [ ] Setup monitoring/alerts
- [ ] Review security settings
- [ ] Test recovery from backup
- [ ] Create runbook/incident procedures

---

## 🎓 Learning Path

1. **Start Here:** Read this file (5 min)
2. **Quick Reference:** [DOCKER_QUICK_REFERENCE.md](DOCKER_QUICK_REFERENCE.md) (5 min)
3. **Setup:** Follow "Setup Steps" section above (10 min)
4. **Deep Dive:** [DOCKER_PRODUCTION_SETUP.md](DOCKER_PRODUCTION_SETUP.md) (30 min)
5. **Deploy:** Run deployment script (5 min)
6. **Operate:** Follow operations guide (ongoing)

---

## 🎯 Success Criteria

After deployment, you should have:

✅ All services running and healthy
```bash
docker compose -f docker-compose.prod.yml ps
# All show: Up X seconds (health: healthy)
```

✅ API responding
```bash
curl http://localhost:5000/health
# Returns: 200 OK with JSON response
```

✅ Database operational
```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -d whatsapp_ordering -c "SELECT 1"
# Returns: (1 row)
```

✅ Backups working
```bash
./scripts/backup-db.sh
# Creates: data/backups/backup_YYYYMMDD_HHMMSS.sql.gz
```

✅ Services restart automatically (optional test)
```bash
docker compose -f docker-compose.prod.yml restart
# Services should be healthy within 30s
```

---

## 📞 Support

**If something doesn't work:**

1. Check logs: `docker compose -f docker-compose.prod.yml logs app`
2. Validate env: `./scripts/validate-prod-env.sh`
3. Read troubleshooting: See [DOCKER_PRODUCTION_SETUP.md#troubleshooting](DOCKER_PRODUCTION_SETUP.md#troubleshooting)
4. Review configuration: Check `.env.production` is filled correctly

---

## 🎉 Status

✅ **Production Ready**

- All files created and tested
- Documentation complete
- Scripts working
- Health checks configured
- Backup system ready
- Ready for immediate deployment

**Start now:**
```bash
docker compose -f docker-compose.prod.yml up -d
```

---

*Production Docker Setup - Complete Navigation Guide*
*Last Updated: January 2024*
