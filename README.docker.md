# Karnali Digital Trade Platform - Docker Staging Environment

Complete production-like staging environment with all services, test data, and mock integrations.

## Quick Start

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Start all services
docker-compose up -d

# 3. Run migrations
docker-compose exec backend npx prisma migrate deploy

# 4. Seed database
docker-compose exec backend node scripts/seed-staging.js
```

## Services

| Service | URL | Purpose |
|---------|-----|---------|
| Backend API | http://localhost:3000 | Main application |
| Fake Twilio | http://localhost:3001 | WhatsApp mock server |
| Adminer | http://localhost:8080 | Database UI |
| Redis Commander | http://localhost:8081 | Redis monitoring |

## Test Credentials

**Admin Login:**
- Email: `admin@karnali.com`
- Password: `Admin@123`

**Database (Adminer):**
- Server: `postgres`
- User: `karnali`
- Password: `karnali_dev_password`
- Database: `karnali_trade`

## Test Data

The seed script creates:
- 1 Admin user
- 10 Retailers
- 5 Wholesalers
- 50 Products
- 20 Orders (with bids)
- Credit accounts & ledger entries

## Useful Commands

```bash
# View logs
docker-compose logs -f backend

# Stop services
docker-compose down

# Reset database
docker-compose exec backend npx prisma migrate reset

# Access backend shell
docker-compose exec backend sh
```

## Testing Fake Twilio

1. Visit http://localhost:3001
2. Use the form to simulate incoming WhatsApp messages
3. View message log in the dashboard

## Next Steps

1. Test API health: `curl http://localhost:3000/api/v1/health`
2. Login as admin and get JWT token
3. Test metrics endpoint: `GET /api/v1/metrics`
4. Create test orders via API
5. Monitor logs and metrics

For detailed setup guide, see `STAGING_SETUP.md` in the brain directory.
