# Production Deployment Guide

## Overview
Complete production deployment setup with:
- ✅ **Docker** - Containerized services
- ✅ **CI/CD** - GitHub Actions pipeline
- ✅ **Database Backups** - Automated backup system
- ✅ **Rollback Plan** - Zero-downtime rollback
- ✅ **Secrets Management** - Secure secret handling
- ✅ **Health Checks** - Comprehensive monitoring

## Prerequisites

1. **Server Requirements**
   - Ubuntu 20.04+ or similar Linux distribution
   - Docker 20.10+
   - Docker Compose 2.0+
   - 4GB+ RAM
   - 50GB+ disk space
   - SSH access

2. **Required Secrets**
   - Database credentials
   - JWT secret
   - Redis password
   - WhatsApp API credentials
   - SSL certificates (for HTTPS)

## Quick Start

### 1. Server Setup

```bash
# Clone repository
git clone <repository-url>
cd whatsapp-ordering-system

# Setup secrets
./scripts/setup-secrets.sh

# Edit .env file with production values
nano .env
```

### 2. Deploy with Docker Compose

```bash
# Build and start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f backend
```

### 3. Run Database Migrations

```bash
# Run migrations
docker-compose exec backend npx prisma migrate deploy

# Generate Prisma Client
docker-compose exec backend npx prisma generate
```

## Docker Setup

### Services

1. **PostgreSQL** - Database
2. **Redis** - Queue and caching
3. **Backend** - API server (scalable)
4. **Nginx** - Reverse proxy and load balancer
5. **Backup** - Automated backup service

### Zero-Downtime Deployment

The setup uses rolling updates:

```bash
# Scale backend to 2 instances
docker-compose up -d --scale backend=2

# Update with zero downtime
docker-compose pull backend
docker-compose up -d --no-deps --scale backend=2 backend
```

## CI/CD Pipeline

### GitHub Actions Workflow

The workflow (`/.github/workflows/deploy.yml`) includes:

1. **Test** - Run tests before deployment
2. **Build** - Build and push Docker image
3. **Deploy** - Deploy to production server
4. **Rollback** - Automatic rollback on failure

### Setup GitHub Secrets

Required secrets:
- `SSH_PRIVATE_KEY` - SSH key for server access
- `SSH_USER` - SSH username
- `SSH_HOST` - Server hostname/IP
- `SLACK_WEBHOOK_URL` - For deployment notifications

### Deployment Process

1. Push to `main` branch triggers deployment
2. Tests run automatically
3. Docker image is built and pushed
4. Server pulls latest image
5. Database migrations run
6. Health checks verify deployment
7. Old containers are removed

## Database Backups

### Automated Backups

Backups run daily via the `backup` service:

```bash
# Manual backup
docker-compose exec backup /backup.sh

# List backups
ls -lh backups/
```

### Backup Retention

- Default: 30 days
- Configurable via `RETENTION_DAYS` environment variable
- Backups are compressed (gzip)
- Stored in `./backups/` directory

### Restore from Backup

```bash
# List available backups
ls -lh backups/

# Restore specific backup
./scripts/restore.sh backups/backup_whatsapp_ordering_20240101_120000.sql.gz
```

## Rollback Plan

### Automatic Rollback

The CI/CD pipeline automatically rolls back on:
- Health check failures
- Deployment errors
- Test failures

### Manual Rollback

```bash
# Rollback to previous version
./scripts/rollback.sh

# Rollback to specific version
./scripts/rollback.sh <commit-hash>
```

### Rollback Process

1. Stop current containers
2. Checkout previous code version
3. Pull previous Docker image
4. Start previous version
5. Verify health
6. Restore database if needed

## Secrets Management

### Environment Variables

All secrets are stored in `.env` file:

```env
# Database
DB_USER=postgres
DB_PASSWORD=<generated>
DB_NAME=whatsapp_ordering

# JWT
JWT_SECRET=<generated>

# Redis
REDIS_PASSWORD=<generated>

# WhatsApp
WHATSAPP_API_KEY=<your-key>
WHATSAPP_VERIFY_TOKEN=<your-token>
```

### Security Best Practices

1. **Never commit `.env` to git**
2. **Use strong, randomly generated secrets**
3. **Rotate secrets regularly**
4. **Use Docker secrets in production**
5. **Restrict file permissions (600)**

### Generate Secrets

```bash
# Run setup script
./scripts/setup-secrets.sh

# Or manually generate
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 24  # For passwords
```

## Health Checks

### Endpoints

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health status
- `GET /health/ready` - Readiness probe (Kubernetes)
- `GET /health/live` - Liveness probe (Kubernetes)

### Health Check Script

```bash
# Run comprehensive health check
./scripts/health-check.sh
```

### Monitoring

Health checks verify:
- Database connectivity
- Redis connectivity
- API responsiveness
- System resources (memory, disk)
- Service uptime

## Nginx Configuration

### SSL Setup

1. Place SSL certificates in `nginx/ssl/`:
   - `cert.pem` - SSL certificate
   - `key.pem` - Private key

2. Update `nginx/nginx.conf` if needed

3. Restart nginx:
```bash
docker-compose restart nginx
```

### Load Balancing

Nginx automatically load balances between backend instances:
- Least connections algorithm
- Health check integration
- Automatic failover

## Backup Policy

### Schedule

- **Daily backups** at 2 AM
- **Retention**: 30 days
- **Location**: `./backups/`
- **Format**: Compressed SQL dumps

### Backup Verification

Backups are automatically verified:
- Integrity check (gzip test)
- Size validation
- Manifest generation

### Backup Restoration

1. Identify backup file
2. Stop application
3. Run restore script
4. Verify restoration
5. Restart application

## Monitoring

### Metrics

Prometheus metrics available at:
- `/metrics` - Prometheus format
- `/metrics/json` - JSON format

### Logs

Logs are stored in:
- `backend/logs/app.log` - Application logs
- `backend/logs/error.log` - Error logs
- `backend/logs/access.log` - Access logs

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs backend

# Check health
curl http://localhost:5000/health

# Restart service
docker-compose restart backend
```

### Database Connection Issues

```bash
# Check database status
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres psql -U postgres -d whatsapp_ordering
```

### High Memory Usage

```bash
# Check memory usage
docker stats

# Restart services
docker-compose restart

# Scale down if needed
docker-compose up -d --scale backend=1
```

## Production Checklist

- [ ] Secrets configured and secured
- [ ] SSL certificates installed
- [ ] Database migrations run
- [ ] Health checks passing
- [ ] Backups configured and tested
- [ ] Monitoring set up
- [ ] Logs being collected
- [ ] Firewall rules configured
- [ ] Rate limiting configured
- [ ] CORS configured
- [ ] Error alerting configured

## Maintenance

### Regular Tasks

1. **Weekly**: Review logs and metrics
2. **Monthly**: Rotate secrets
3. **Quarterly**: Review and update dependencies
4. **As needed**: Database maintenance

### Updates

```bash
# Pull latest code
git pull origin main

# Pull latest images
docker-compose pull

# Update services
docker-compose up -d

# Run migrations
docker-compose exec backend npx prisma migrate deploy
```

## Support

For issues or questions:
1. Check logs: `docker-compose logs`
2. Check health: `./scripts/health-check.sh`
3. Review documentation
4. Contact DevOps team
