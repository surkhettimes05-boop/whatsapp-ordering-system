# Production Docker - Quick Reference

## Setup (5 minutes)

```bash
# 1. Configure environment
cp .env.production.example .env.production
nano .env.production  # Fill in credentials

# 2. Generate secrets
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('REDIS_PASSWORD=' + require('crypto').randomBytes(32).toString('hex'))"

# 3. Create data directories
mkdir -p data/{postgres,redis,backups} logs uploads

# 4. Deploy (make script executable first)
chmod +x scripts/deploy-prod.sh
./scripts/deploy-prod.sh
```

## Verification

```bash
# Status: All should show "healthy"
docker compose -f docker-compose.prod.yml ps

# API Health
curl http://localhost:5000/health

# Database
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -d whatsapp_ordering -c "SELECT 1"

# Redis
docker compose -f docker-compose.prod.yml exec redis \
  redis-cli ping
```

## Daily Operations

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f app

# Backup database
./scripts/backup-db.sh

# Run migrations
docker compose -f docker-compose.prod.yml exec app npm run db:migrate

# Restart service
docker compose -f docker-compose.prod.yml restart app

# Stop all (graceful)
docker compose -f docker-compose.prod.yml stop

# Start services
docker compose -f docker-compose.prod.yml up -d
```

## Monitoring

```bash
# Container stats (CPU, Memory, Network)
docker compose -f docker-compose.prod.yml stats

# Database size
docker compose -f docker-compose.prod.yml exec postgres \
  du -sh /var/lib/postgresql/data

# Redis memory
docker compose -f docker-compose.prod.yml exec redis \
  redis-cli info memory

# App process info
docker compose -f docker-compose.prod.yml exec app ps aux
```

## Troubleshooting

| Issue | Command |
|-------|---------|
| App crashes | `docker compose -f docker-compose.prod.yml logs app` |
| DB connection fail | `docker compose -f docker-compose.prod.yml logs postgres` |
| Port in use | `sudo lsof -i :5000` |
| Out of disk | `docker system df` |
| Clear cache | `docker compose -f docker-compose.prod.yml exec redis redis-cli FLUSHALL` |

## Key Files

- **Configuration:** `.env.production`
- **Compose File:** `docker-compose.prod.yml`
- **Dockerfile:** `Dockerfile.prod`
- **Deployment:** `scripts/deploy-prod.sh`
- **Backup:** `scripts/backup-db.sh`
- **Documentation:** `DOCKER_PRODUCTION_SETUP.md`

## Environment Variables

| Variable | Default | Notes |
|----------|---------|-------|
| `DB_USER` | postgres | Database user |
| `DB_PASSWORD` | - | **CHANGE THIS** |
| `DB_NAME` | whatsapp_ordering | Database name |
| `REDIS_PASSWORD` | - | **CHANGE THIS** |
| `JWT_SECRET` | - | **GENERATE NEW** |
| `NODE_ENV` | production | Don't change |
| `PORT` | 5000 | App port |

## Health Checks

All services monitored automatically:
- **PostgreSQL:** Checks connectivity + SELECT 1
- **Redis:** Checks PING response  
- **App:** Checks /health endpoint

Unhealthy containers auto-restart.

## Performance Tuning

**PostgreSQL** (already optimized):
- max_connections: 200
- shared_buffers: 256MB
- work_mem: 4MB

**Redis** (already optimized):
- maxmemory: 512MB
- maxmemory-policy: allkeys-lru

**App:**
- NODE_OPTIONS: `--max-old-space-size=512`
- Adjust for more traffic

## Scaling (Advanced)

To add more app instances:

```yaml
# docker-compose.prod.yml
services:
  app:
    deploy:
      replicas: 3  # 3 instances

# Add load balancer (nginx)
# Listen on port 80
# Route to app_1, app_2, app_3
```

## Backup & Recovery

```bash
# Automatic: Daily at 2 AM (set in cron)
# Manual backup
./scripts/backup-db.sh

# List backups
ls -lh data/backups/

# Restore from backup
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres -d whatsapp_ordering < data/backups/backup_20240122_020000.sql.gz
```

## Security

✅ **Already configured:**
- Non-root user runs app
- Network isolation (only app exposes ports)
- Signal handling (dumb-init)
- Health checks enabled
- Resource limits set

✅ **You should:**
- Change all credentials in `.env.production`
- Enable SSL/TLS in reverse proxy
- Set up firewall rules
- Monitor logs for errors
- Rotate credentials quarterly

## Contact

See `DOCKER_PRODUCTION_SETUP.md` for detailed documentation.

---

**Status:** ✅ Production Ready
**Last Updated:** 2024
