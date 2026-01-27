# Production Docker Setup

## Overview

Production-grade Docker Compose configuration for WhatsApp Ordering System with:
- **PostgreSQL 16** - Database with persistence and performance tuning
- **Redis 7** - Caching and BullMQ job queue
- **Node.js Backend** - Multi-stage optimized production image
- **Health Checks** - All services monitored
- **Resource Limits** - CPU and memory constraints
- **Persistent Volumes** - Data survives container restarts
- **Signal Handling** - Graceful shutdown with dumb-init
- **Logging** - Structured JSON logs with rotation

---

## Quick Start

### 1. Prepare Environment

```bash
# Copy and configure production environment
cp .env.production.example .env.production

# Edit with actual production values
nano .env.production  # or use your editor

# Generate strong JWT secret
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate strong Redis password  
node -e "console.log('REDIS_PASSWORD=' + require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Create Data Directories

```bash
# Create persistent volume directories
mkdir -p data/postgres data/redis data/backups
chmod 755 data/postgres data/redis data/backups

# On Linux with SELinux
chcon -R svirt_sandbox_db_t data/postgres
```

### 3. Start Services

```bash
# Build and start all services
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f app

# Check service status
docker compose -f docker-compose.prod.yml ps
```

### 4. Verify Health

```bash
# Check all services are healthy
docker compose -f docker-compose.prod.yml ps

# Test database
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -d whatsapp_ordering -c "SELECT 1"

# Test Redis
docker compose -f docker-compose.prod.yml exec redis \
  redis-cli -a redis_password ping

# Test app
curl http://localhost:5000/health
```

---

## Configuration

### Environment Variables

**Database:**
```env
DB_USER=postgres              # PostgreSQL username
DB_PASSWORD=secure_password   # Strong password (32+ chars recommended)
DB_NAME=whatsapp_ordering     # Database name
POSTGRES_DATA_PATH=./data/postgres
POSTGRES_BACKUPS_PATH=./data/backups
```

**Redis:**
```env
REDIS_PASSWORD=secure_password  # Strong password
REDIS_DATA_PATH=./data/redis
```

**Application:**
```env
NODE_ENV=production
PORT=5000
JWT_SECRET=long_random_string  # Generated as shown above
```

**Twilio:**
```env
TWILIO_ACCOUNT_SID=ACxxxxxxx
TWILIO_AUTH_TOKEN=auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+1234567890
TWILIO_PHONE_NUMBER=+1234567890
```

### Resource Limits

Configure in `docker-compose.prod.yml` under `deploy.resources`:

```yaml
# PostgreSQL
resources:
  limits:
    cpus: '2'
    memory: 2G
  reservations:
    cpus: '1'
    memory: 1G

# Redis
resources:
  limits:
    cpus: '1'
    memory: 1G
  reservations:
    cpus: '0.5'
    memory: 512M

# App
resources:
  limits:
    cpus: '2'
    memory: 2G
  reservations:
    cpus: '1'
    memory: 1G
```

Adjust based on your infrastructure:
- **Reservations:** Guaranteed resources
- **Limits:** Maximum resources container can use

---

## Health Checks

All services include health checks (30-60 second intervals):

### PostgreSQL
```bash
pg_isready -U postgres && psql -U postgres -d whatsapp_ordering -c "SELECT 1"
```
- Checks connectivity
- Verifies database responsive
- Status: `healthy` when passing

### Redis
```bash
redis-cli -a password ping
```
- Responds with PONG
- Status: `healthy` when responsive

### Node.js App
```bash
curl -f http://localhost:5000/health
```
- Expects HTTP 200
- Checks database connectivity
- Status: `healthy` when all systems OK

**View Status:**
```bash
docker compose -f docker-compose.prod.yml ps
# STATUS column shows: Up X seconds (health: starting|healthy|unhealthy)
```

---

## Data Persistence

### Volumes

**postgres_data:**
- Location: `./data/postgres`
- Contains: All database tables, indexes, WAL files
- Backup: Point-in-time recovery available via WAL archive

**redis_data:**
- Location: `./data/redis`
- Contains: AOF (append-only file) and RDB snapshots
- Persistence: AOF enabled + RDB daily

**postgres_backups:**
- Location: `./data/backups`
- Contains: Manual pg_dump backups
- Retention: Manual management

### Backup Strategy

**Automated (via PostgreSQL):**
```bash
# WAL archiving enabled by default
# Point-in-time recovery available up to:
# - Last 7 days (or until max_wal_size=4GB exceeded)
```

**Manual Backup:**
```bash
# Create backup
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U postgres -d whatsapp_ordering > ./data/backups/backup_$(date +%Y%m%d_%H%M%S).sql

# List backups
ls -lh ./data/backups/

# Restore from backup
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres -d whatsapp_ordering < ./data/backups/backup_20240122_120000.sql
```

**Backup Script (cron job):**
```bash
#!/bin/bash
# File: scripts/backup-db.sh
set -e

BACKUP_DIR="./data/backups"
DB_CONTAINER="whatsapp-postgres-prod"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "Starting database backup..."
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U postgres -d whatsapp_ordering \
  > "$BACKUP_DIR/backup_${TIMESTAMP}.sql"

echo "Compressing backup..."
gzip "$BACKUP_DIR/backup_${TIMESTAMP}.sql"

echo "Backup complete: $BACKUP_DIR/backup_${TIMESTAMP}.sql.gz"

# Keep only last 7 days
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +7 -delete
```

Add to crontab:
```bash
# Daily 2 AM backup
0 2 * * * cd /path/to/app && ./scripts/backup-db.sh >> logs/backup.log 2>&1
```

---

## Scaling & Performance

### PostgreSQL Tuning

Already configured in `docker-compose.prod.yml`:
- **max_connections:** 200 (increase for higher concurrency)
- **shared_buffers:** 256MB (increase for large databases)
- **effective_cache_size:** 1GB (match available RAM)
- **work_mem:** 4MB (per operation memory)
- **wal_compression:** ON (reduces WAL size)

Adjust for your workload:
```yaml
# High-traffic environment (more memory available)
POSTGRES_INITDB_ARGS: >-
  -c max_connections=500
  -c shared_buffers=1GB
  -c effective_cache_size=8GB
  -c work_mem=16MB
```

### Redis Optimization

Currently configured:
- **maxmemory:** 512MB
- **maxmemory-policy:** allkeys-lru (evict least recently used)
- **appendonly:** yes (persistence)
- **appendfsync:** everysec (balance performance/durability)

For higher throughput:
```bash
# Increase max memory
redis-cli -a password CONFIG SET maxmemory 2gb

# Change eviction policy
redis-cli -a password CONFIG SET maxmemory-policy allkeys-lfu
```

### App Scaling

**Horizontal Scaling (multiple app instances):**
```yaml
# docker-compose.prod.yml
services:
  app:
    # ... existing config ...
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
```

Use load balancer (nginx/haproxy) in front:
```nginx
upstream app_backend {
    server app_1:5000;
    server app_2:5000;
    server app_3:5000;
}

server {
    listen 80;
    location / {
        proxy_pass http://app_backend;
    }
}
```

---

## Monitoring & Logging

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs

# Specific service
docker compose -f docker-compose.prod.yml logs app
docker compose -f docker-compose.prod.yml logs postgres

# Follow logs
docker compose -f docker-compose.prod.yml logs -f app

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100 app

# Since timestamp
docker compose -f docker-compose.prod.yml logs --since 2024-01-22T10:00:00 app
```

### Log Locations

**Host Machine:**
- PostgreSQL: `docker logs whatsapp-postgres-prod`
- Redis: `docker logs whatsapp-redis-prod`
- App: `./logs/app.log` and `docker logs whatsapp-app-prod`

**Application Logs:**
- JSON format for structured logging
- Logs rotate: max 50MB per file, keep 5 files
- Storage: `./logs/` directory

### Monitoring Stack (Optional)

Add to `docker-compose.prod.yml`:

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana

volumes:
  prometheus_data:
  grafana_data:
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs app

# Common issues:
# 1. Port already in use
docker ps | grep 5000  # Kill existing container
docker compose -f docker-compose.prod.yml down

# 2. Database not ready
docker compose -f docker-compose.prod.yml logs postgres
# Wait for "ready to accept connections"

# 3. Missing environment variables
grep "is not set" /dev/null  # Check .env.production filled
```

### Database Connection Errors

```bash
# Test connection
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -d whatsapp_ordering -c "SELECT 1"

# Check connection string
grep DATABASE_URL .env.production

# Common format:
# postgresql://user:password@postgres:5432/database
```

### Redis Connection Errors

```bash
# Test Redis
docker compose -f docker-compose.prod.yml exec redis \
  redis-cli -a password ping

# Check password in .env.production
grep REDIS_PASSWORD .env.production

# Clear Redis cache (if needed)
docker compose -f docker-compose.prod.yml exec redis \
  redis-cli -a password FLUSHALL
```

### High Memory Usage

```bash
# Check container stats
docker compose -f docker-compose.prod.yml stats

# Reduce limits in docker-compose.prod.yml
# Or increase available RAM

# PostgreSQL: Check slow queries
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -d whatsapp_ordering -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

### Disk Space Issues

```bash
# Check disk usage
docker system df

# Clean up old volumes (WARNING: deletes data)
docker volume prune

# Clean up old logs
find ./logs -name "*.log" -mtime +30 -delete

# Backup and compress old backups
gzip ./data/backups/*.sql
```

---

## Security Hardening

### Change Default Credentials

```bash
# Edit .env.production BEFORE first run
DB_PASSWORD=generate_strong_password     # 32+ characters
REDIS_PASSWORD=generate_strong_password  # 32+ characters
JWT_SECRET=generate_strong_secret        # Use: node -e "..." above
```

### Network Isolation

Only app container exposes ports:
```yaml
# PostgreSQL: Only accessible from app container
# Redis: Only accessible from app container via docker network
# App: Exposed on port 5000
```

### Database Security

```bash
# Change default postgres user password
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'new_password';"

# Create readonly user for backups
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres <<EOF
  CREATE ROLE backup_user WITH LOGIN PASSWORD 'backup_password';
  GRANT CONNECT ON DATABASE whatsapp_ordering TO backup_user;
  GRANT USAGE ON SCHEMA public TO backup_user;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;
EOF
```

### SSL/TLS

For production, use reverse proxy (nginx) with SSL:

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;
    
    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.example.com;
    return 301 https://$server_name$request_uri;
}
```

---

## Production Deployment Checklist

- [ ] Copy `.env.production.example` to `.env.production`
- [ ] Generate and fill all credentials in `.env.production`
- [ ] Create `data/postgres`, `data/redis`, `data/backups` directories
- [ ] Review resource limits in `docker-compose.prod.yml`
- [ ] Test locally: `docker compose -f docker-compose.prod.yml up`
- [ ] Verify health: `curl http://localhost:5000/health`
- [ ] Setup backup script and cron job
- [ ] Configure monitoring/alerting
- [ ] Setup SSL/TLS with reverse proxy
- [ ] Create runbook and incident response procedures
- [ ] Test restart: `docker compose -f docker-compose.prod.yml restart`
- [ ] Test recovery from backup
- [ ] Document any customizations
- [ ] Setup log rotation and archival
- [ ] Create database maintenance schedule
- [ ] Setup alerts for disk space, CPU, memory

---

## Commands Reference

```bash
# Start services
docker compose -f docker-compose.prod.yml up -d

# Stop services (graceful shutdown)
docker compose -f docker-compose.prod.yml stop

# Stop all containers and remove them
docker compose -f docker-compose.prod.yml down

# View status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f app

# Execute commands in containers
docker compose -f docker-compose.prod.yml exec app npm run reconcile
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d whatsapp_ordering

# Rebuild and restart specific service
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml up -d app

# Database migration
docker compose -f docker-compose.prod.yml exec app npm run db:migrate

# Get container IP
docker compose -f docker-compose.prod.yml exec app hostname -I

# Restart single service
docker compose -f docker-compose.prod.yml restart postgres

# Prune unused images and volumes
docker system prune -a --volumes
```

---

## Support & Additional Resources

- **Docker Docs:** https://docs.docker.com/
- **PostgreSQL Tuning:** https://wiki.postgresql.org/wiki/Performance_Optimization
- **Redis Persistence:** https://redis.io/topics/persistence
- **Node.js in Docker:** https://nodejs.org/en/docs/guides/nodejs-docker-webapp/
- **docker-compose Reference:** https://docs.docker.com/compose/compose-file/

---

*Production Docker configuration for WhatsApp Ordering System*
*Last Updated: 2024*
