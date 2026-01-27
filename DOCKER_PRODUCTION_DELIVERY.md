# Production Docker Setup - Complete Delivery

## 📦 What Was Delivered

A **production-grade Docker setup** for WhatsApp Ordering System with automatic health checks, persistent volumes, resource limits, and comprehensive documentation.

### Files Created (9 Total)

#### 1. **Dockerfile.prod** (85 lines)
Multi-stage optimized production image:
- ✅ Alpine Linux (small ~200MB)
- ✅ Non-root user (security)
- ✅ dumb-init (signal handling)
- ✅ Health check built-in
- ✅ Proper logging setup

#### 2. **docker-compose.prod.yml** (300+ lines)
Production orchestration with:
- **PostgreSQL 16-alpine** (optimized)
  - Performance tuning enabled
  - Persistent volume `postgres_data`
  - Health check (connectivity + SELECT 1)
  - Resource limits: 2 CPU / 2GB RAM
  - Backup volume: `postgres_backups`
  
- **Redis 7-alpine** (optimized)
  - AOF persistence + RDB snapshots
  - Persistent volume `redis_data`
  - Health check (redis-cli ping)
  - Resource limits: 1 CPU / 1GB RAM
  - LRU eviction policy enabled
  
- **Node.js App** (production)
  - Multi-stage built image
  - Health check (HTTP /health)
  - Resource limits: 2 CPU / 2GB RAM
  - Environment variables configured
  - Logging to json-file with rotation (50MB/5 files)

#### 3. **.env.production.example** (60+ lines)
Template for production secrets:
- Database credentials
- Redis password
- JWT secret
- Twilio configuration
- Email/Slack integration points
- Clear instructions

#### 4. **DOCKER_PRODUCTION_SETUP.md** (600+ lines)
Comprehensive documentation:
- Quick start guide (5 minutes)
- Configuration reference
- Health checks explanation
- Data persistence strategy
- Backup procedures
- Scaling guidelines
- Monitoring setup
- Security hardening
- Troubleshooting guide
- Production checklist
- Complete command reference

#### 5. **DOCKER_QUICK_REFERENCE.md** (150+ lines)
Quick reference guide:
- One-page setup
- Common commands
- Monitoring essentials
- Troubleshooting table
- Key environment variables
- Backup/recovery procedures

#### 6. **scripts/deploy-prod.sh** (300+ lines)
Automated deployment script:
- Pre-flight checks (Docker, dependencies)
- Environment validation
- Directory creation
- Docker image build
- Service startup with health checks
- Database migration execution
- Post-deployment verification
- Comprehensive logging

#### 7. **scripts/backup-db.sh** (200+ lines)
Automated backup script:
- Point-in-time backups
- Automatic compression (gzip)
- Metadata file generation
- 7-day retention policy
- Integrity verification
- Comprehensive logging

#### 8. **scripts/init-db.sql** (80+ lines)
PostgreSQL initialization:
- Required extensions (uuid-ossp, pg_trgm, pgcrypto)
- Utility functions for timestamps
- Short ID generation function
- Proper permissions setup

#### 9. **scripts/start-prod.ps1** (150+ lines)
Windows PowerShell startup script:
- Cross-platform startup
- Multiple actions: up, down, restart, status, logs
- Automatic directory creation
- Health check validation
- Color-coded output

---

## 🚀 Quick Start

### 1. **Five-Minute Setup**

```bash
# Copy and configure
cp .env.production.example .env.production
nano .env.production

# Generate secrets
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('REDIS_PASSWORD=' + require('crypto').randomBytes(32).toString('hex'))"

# Start
docker compose -f docker-compose.prod.yml up -d

# Verify
curl http://localhost:5000/health
```

### 2. **Using Deployment Script**

```bash
# Make executable
chmod +x scripts/deploy-prod.sh

# Run automated deployment
./scripts/deploy-prod.sh
```

### 3. **On Windows (PowerShell)**

```powershell
# Start production services
.\scripts\start-prod.ps1 -Action up -Detached

# View logs
.\scripts\start-prod.ps1 -Action logs
```

---

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Production Environment - docker-compose.prod.yml       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  PostgreSQL  │  │    Redis     │  │  Node.js     │  │
│  │              │  │              │  │  App         │  │
│  │ Port: 5432   │  │ Port: 6379   │  │ Port: 5000   │  │
│  │ Health: ✓    │  │ Health: ✓    │  │ Health: ✓    │  │
│  │ Volume: 2GB+ │  │ Volume: 512MB│  │              │  │
│  │ CPU: 2       │  │ CPU: 1       │  │ CPU: 2       │  │
│  │ RAM: 2GB     │  │ RAM: 1GB     │  │ RAM: 2GB     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  Network: app-network (172.28.0.0/16)                   │
│  Logging: json-file driver with rotation                │
└─────────────────────────────────────────────────────────┘

Volumes:
  postgres_data ──> ./data/postgres (persistent)
  postgres_backups -> ./data/backups (backups)
  redis_data ──────> ./data/redis (persistent)

Services depend on health checks:
  app ──depends on──> postgres (healthy)
                  └──> redis (healthy)
```

---

## ✅ Health Checks

All services monitored with automatic restart on failure:

| Service | Check | Interval | Timeout | Retries |
|---------|-------|----------|---------|---------|
| PostgreSQL | pg_isready + SELECT 1 | 10s | 5s | 5 |
| Redis | redis-cli ping | 10s | 5s | 5 |
| Node.js | curl /health | 30s | 10s | 3 |

**View Status:**
```bash
docker compose -f docker-compose.prod.yml ps
# STATUS column: Up 5 minutes (health: healthy)
```

---

## 💾 Data Persistence

### Volumes Created

```
data/
├── postgres/              # Database files (grows with data)
│   ├── base/             # Actual tables
│   ├── pg_wal/           # Write-ahead logs (recovery)
│   └── postgresql.conf   # Config
├── redis/                # Redis snapshots & AOF
│   ├── dump.rdb         # RDB snapshot (daily)
│   └── appendonly.aof   # AOF log (per-operation)
└── backups/             # Manual pg_dump backups
    ├── backup_20240122_020000.sql.gz
    └── backup_20240122_020000.sql.metadata
```

### Backup Automation

```bash
# Automated: Add to crontab
0 2 * * * cd /app && ./scripts/backup-db.sh

# Manual: Run anytime
./scripts/backup-db.sh

# Retention: Keeps 7 days automatically
```

### Restore from Backup

```bash
# List available backups
ls -lh data/backups/

# Restore
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres -d whatsapp_ordering < data/backups/backup_20240122_020000.sql.gz
```

---

## 🔒 Security Features

✅ **Already Implemented:**
- Non-root user runs Node.js (UID 1001)
- Network isolation (only app exposes port)
- Signal handling (SIGTERM/SIGKILL)
- Resource limits (prevent denial of service)
- Health checks (detect compromised services)
- Password authentication on Redis
- Database user/password

✅ **You Should Configure:**
- Change all credentials in `.env.production`
- Enable SSL/TLS in reverse proxy
- Firewall rules (allow only needed ports)
- Regular security audits
- Log monitoring for suspicious activity
- Rotate credentials quarterly

---

## 📈 Performance Tuning

### PostgreSQL (Already Optimized)

```yaml
# Current settings optimize for 8GB+ systems
max_connections: 200        # Concurrent users
shared_buffers: 256MB      # Cache layer
effective_cache_size: 1GB  # Query planning
work_mem: 4MB              # Per-operation memory
wal_compression: ON        # Smaller WAL files
```

For higher traffic, adjust in `docker-compose.prod.yml`:
```yaml
POSTGRES_INITDB_ARGS: >-
  -c max_connections=500
  -c shared_buffers=1GB
  -c effective_cache_size=8GB
```

### Redis (Already Optimized)

```yaml
# Current settings
maxmemory: 512MB
maxmemory-policy: allkeys-lru  # Evict old entries
appendonly: yes                # Persistence
```

Change policy for different workloads:
```bash
redis-cli CONFIG SET maxmemory-policy allkeys-lfu
```

### Node.js App

Memory management:
```yaml
NODE_OPTIONS: "--max-old-space-size=512"
# Adjust for your needs (512MB currently)
```

---

## 📋 Operations Guide

### Daily Tasks

```bash
# Start services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f app

# Backup database
./scripts/backup-db.sh
```

### Weekly Tasks

```bash
# Review health status
docker compose -f docker-compose.prod.yml ps

# Check disk usage
docker compose -f docker-compose.prod.yml exec postgres \
  du -sh /var/lib/postgresql/data

# Check Redis memory
docker compose -f docker-compose.prod.yml exec redis \
  redis-cli INFO memory
```

### Monthly Tasks

```bash
# Cleanup old backups (automatic via script)
# Manual: find data/backups -name "*.sql.gz" -mtime +30 -delete

# Review and optimize slow queries
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -d whatsapp_ordering \
  -c "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Rotate credentials (if not automated)
# Update .env.production
# docker compose -f docker-compose.prod.yml restart
```

---

## 🔧 Common Commands

```bash
# Lifecycle
docker compose -f docker-compose.prod.yml up -d        # Start
docker compose -f docker-compose.prod.yml stop         # Stop gracefully
docker compose -f docker-compose.prod.yml restart      # Restart
docker compose -f docker-compose.prod.yml down         # Down (remove containers)

# Monitoring
docker compose -f docker-compose.prod.yml ps           # Status
docker compose -f docker-compose.prod.yml logs -f app  # Follow logs
docker compose -f docker-compose.prod.yml stats        # Resource usage

# Database
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -d whatsapp_ordering               # Connect to DB

docker compose -f docker-compose.prod.yml exec app \
  npm run db:migrate                                   # Run migrations

# Redis
docker compose -f docker-compose.prod.yml exec redis \
  redis-cli -a password ping                           # Test connection

docker compose -f docker-compose.prod.yml exec redis \
  redis-cli -a password FLUSHALL                       # Clear cache

# Rebuild & restart
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml up -d app

# Remove everything (WARNING: deletes data!)
docker compose -f docker-compose.prod.yml down -v
```

---

## 🐛 Troubleshooting

### App Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs app

# Common causes:
# 1. PORT already in use
lsof -i :5000

# 2. Database not ready
docker compose -f docker-compose.prod.yml logs postgres

# 3. Missing environment variables
grep -E "^DATABASE_URL|^REDIS_URL|^JWT_SECRET" .env.production
```

### High Memory Usage

```bash
# Check container stats
docker compose -f docker-compose.prod.yml stats

# PostgreSQL: Check slow queries
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -d whatsapp_ordering \
  -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 5;"

# Redis: Check key distribution
docker compose -f docker-compose.prod.yml exec redis \
  redis-cli --bigkeys

# Node.js: Check heap usage
docker compose -f docker-compose.prod.yml exec app \
  node -e "console.log(process.memoryUsage())"
```

### Disk Space Issues

```bash
# Check disk usage
docker system df

# Database size
docker compose -f docker-compose.prod.yml exec postgres \
  du -sh /var/lib/postgresql/data

# Delete old backups
find data/backups -name "backup_*.sql.gz" -mtime +30 -delete

# Prune docker (WARNING: removes unused images/volumes)
docker system prune -a --volumes
```

---

## 📚 Documentation Files

| File | Purpose | Lines |
|------|---------|-------|
| `Dockerfile.prod` | Production image definition | 85 |
| `docker-compose.prod.yml` | Container orchestration | 300+ |
| `.env.production.example` | Configuration template | 60+ |
| `DOCKER_PRODUCTION_SETUP.md` | Complete guide | 600+ |
| `DOCKER_QUICK_REFERENCE.md` | Quick reference | 150+ |
| `scripts/deploy-prod.sh` | Auto deployment | 300+ |
| `scripts/backup-db.sh` | Auto backup | 200+ |
| `scripts/init-db.sql` | DB initialization | 80+ |
| `scripts/start-prod.ps1` | Windows startup | 150+ |

---

## ✨ Key Features

### 🏥 Health Checks
- All services monitored
- Automatic restart on failure
- Real-time status in `docker compose ps`

### 💪 Resource Management
- CPU limits prevent runaway processes
- Memory limits prevent OOM crashes
- Reservation ensures minimum guaranteed resources

### 📦 Persistence
- PostgreSQL data survives restarts
- Redis AOF + RDB persistence
- Automatic backup script with retention

### 📊 Observability
- JSON-structured logging
- Log rotation (prevent disk fill)
- Real-time stats: `docker compose stats`

### 🔐 Security
- Non-root user execution
- Network isolation
- Environment variable secrets
- Password-protected Redis

### 🚀 Scalability
- Multi-container architecture
- Horizontal scaling ready (multiple app instances)
- Load balancer friendly

---

## 🎯 Deployment Checklist

- [ ] Copy `.env.production.example` to `.env.production`
- [ ] Generate and fill credentials (DB, Redis, JWT)
- [ ] Create data directories: `mkdir -p data/{postgres,redis,backups}`
- [ ] Make scripts executable: `chmod +x scripts/*.sh`
- [ ] Test locally: `docker compose -f docker-compose.prod.yml up`
- [ ] Verify health: `curl http://localhost:5000/health`
- [ ] Test backup: `./scripts/backup-db.sh`
- [ ] Setup backup cron: `0 2 * * * cd /app && ./scripts/backup-db.sh`
- [ ] Configure monitoring/alerts
- [ ] Setup SSL/TLS reverse proxy
- [ ] Document any customizations
- [ ] Create runbook for incidents
- [ ] Test restore from backup
- [ ] Load test (if applicable)
- [ ] Security audit
- [ ] Production deployment

---

## 🎓 Next Steps

1. **Immediate:** Follow "Quick Start" section above
2. **Verification:** Run all health checks
3. **Documentation:** Read `DOCKER_PRODUCTION_SETUP.md`
4. **Operations:** Review "Operations Guide" above
5. **Monitoring:** Setup alerts for unhealthy services
6. **Backup:** Configure cron job for auto backups
7. **Security:** Change credentials + firewall rules
8. **Scaling:** Monitor metrics, adjust resources as needed

---

## 📞 Support

For detailed information, see:
- **Complete Setup:** `DOCKER_PRODUCTION_SETUP.md`
- **Quick Reference:** `DOCKER_QUICK_REFERENCE.md`
- **Docker Docs:** https://docs.docker.com/

---

**Status:** ✅ Production Ready
**Docker Compose Version:** 3.9
**Tested With:** Docker 24.x, docker-compose 2.x
**Last Updated:** January 2024
