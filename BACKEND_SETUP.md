# Backend Setup & Environment Guide

## Quick Start

### 1. Prerequisites
- Node.js v16+ (check with `node -v`)
- PostgreSQL (local or cloud instance)
- Twilio account with WhatsApp enabled
- Git

### 2. Installation

```bash
# Clone repository
git clone https://github.com/your-org/whatsapp-ordering-system.git
cd whatsapp-ordering-system/backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit with your values
nano .env  # or open in your editor
```

### 3. Configure Environment

Copy `.env.example` to `.env` and fill in:

**Critical Variables**:
```bash
NODE_ENV=development                    # development|staging|production
DATABASE_URL=postgresql://...           # Your database connection
JWT_SECRET=your-secret-key-min-32-char  # Generate one (see below)
TWILIO_ACCOUNT_SID=ACxxx...            # Your Twilio SID
TWILIO_AUTH_TOKEN=your_auth_token      # Your Twilio token
TWILIO_WHATSAPP_FROM=+14155238886      # Your WhatsApp number
WHATSAPP_VERIFY_TOKEN=webhook-token    # Generate one (see below)
```

**Generate Secure Keys**:
```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate WHATSAPP_VERIFY_TOKEN
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Database Setup

```bash
# Create database tables
npx prisma migrate dev --name init

# Seed with sample data (optional)
npm run seed

# View database in browser
npx prisma studio
```

### 5. Start Development Server

```bash
npm run dev        # Development mode (hot reload)
npm run dev:watch  # With auto-restart on file changes
npm start          # Production mode
```

Server runs at: `http://localhost:5000`

Health check: `http://localhost:5000/health`

---

## Environment Variables

### Server Config
```bash
NODE_ENV=development              # Environment mode
PORT=5000                        # Server port
FRONTEND_URL=http://localhost:3000  # Frontend domain
```

### Database
```bash
DATABASE_URL=postgresql://user:password@host:5432/db
```

### Authentication
```bash
JWT_SECRET=your_secret_key       # Min 32 characters
JWT_EXPIRE=7d                    # Token expiration
CORS_ORIGIN=http://localhost:3000  # Allowed domains
```

### Twilio/WhatsApp
```bash
TWILIO_ACCOUNT_SID=ACxxx...
TWILIO_AUTH_TOKEN=your_token
TWILIO_WHATSAPP_FROM=+14155238886
WHATSAPP_VERIFY_TOKEN=webhook_token
```

### Optional Services
```bash
# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_password

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx

# AWS S3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=bucket-name
```

---

## Project Structure

```
backend/
├── src/
│   ├── app.js                    # Express app setup
│   ├── start-server.js           # Server entry point
│   │
│   ├── config/
│   │   ├── database.js           # Prisma client
│   │   └── logger.js             # Logging setup
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js    # JWT verification
│   │   └── errorHandler.middleware.js  # Error handling
│   │
│   ├── controllers/              # Route handlers
│   │   ├── auth.controller.js
│   │   ├── product.controller.js
│   │   ├── order.controller.js
│   │   ├── whatsapp.controller.js
│   │   └── ...
│   │
│   ├── routes/                   # API routes
│   │   ├── auth.routes.js
│   │   ├── product.routes.js
│   │   ├── order.routes.js
│   │   ├── whatsapp.routes.js
│   │   └── ...
│   │
│   ├── services/                 # Business logic
│   │   ├── auth.service.js
│   │   ├── product.service.js
│   │   ├── order.service.js
│   │   ├── whatsapp.service.js
│   │   ├── whatsapp-credit-*.service.js
│   │   └── ...
│   │
│   ├── jobs/                     # Background jobs
│   │   ├── orderRecovery.job.js
│   │   ├── paymentReminders.job.js
│   │   └── ...
│   │
│   └── utils/                    # Utilities
│       ├── validation.js
│       ├── constants.js
│       └── ...
│
├── prisma/
│   ├── schema.prisma            # Database schema
│   └── migrations/              # Migration files
│
├── logs/                        # Log files (created at runtime)
│   ├── app.log
│   ├── error.log
│   └── debug.log
│
├── .env                         # Environment variables (NOT in git)
├── .env.example                 # Template (in git)
├── .gitignore                   # Git ignore rules
├── package.json                 # Dependencies
├── package-lock.json            # Locked versions
├── README.md                    # Project README
└── PRODUCTION_DEPLOYMENT.md     # Deployment guide
```

---

## Available Scripts

```bash
# Development
npm run dev              # Start with hot reload
npm run dev:watch       # Auto-restart on changes

# Production
npm start               # Start server
NODE_ENV=production npm start

# Database
npm run seed            # Seed sample data
npm run migrate         # Run migrations
npx prisma studio      # View database GUI

# Utilities
npm run lint            # Check code quality
npm run format          # Format code
npm test                # Run tests (if configured)

# Diagnostics
npm run check-setup     # Verify setup
curl http://localhost:5000/health  # Health check
```

---

## API Endpoints

### Health & Status
```
GET /health              # Server health check
```

### Authentication
```
POST /api/v1/auth/register    # Register user
POST /api/v1/auth/login       # Login
POST /api/v1/auth/refresh     # Refresh token
POST /api/v1/auth/logout      # Logout
```

### Products
```
GET /api/v1/products         # List products
GET /api/v1/products/:id     # Get product
POST /api/v1/products        # Create (admin)
PUT /api/v1/products/:id     # Update (admin)
DELETE /api/v1/products/:id  # Delete (admin)
```

### Orders
```
GET /api/v1/orders           # List user's orders
POST /api/v1/orders          # Create order
GET /api/v1/orders/:id       # Get order details
PUT /api/v1/orders/:id       # Update order
```

### WhatsApp
```
GET /api/v1/whatsapp/webhook   # Webhook (GET for verification)
POST /api/v1/whatsapp/webhook  # Webhook (POST for messages)
```

---

## Logging

### Log Files
- **app.log**: General application logs
- **error.log**: Error-level logs only
- **debug.log**: Debug-level logs (development only)

### View Logs
```bash
# Recent logs
tail -100 logs/app.log

# Real-time logs
tail -f logs/app.log

# Errors only
grep ERROR logs/error.log

# Specific time period
grep "2026-01-15T10:" logs/app.log

# User activity
grep "userId: 123" logs/app.log
```

### Log Format
```json
{
  "timestamp": "2026-01-15T10:30:45.123Z",
  "level": "INFO",
  "message": "Request completed: POST /api/v1/orders",
  "requestId": "unique-id",
  "method": "POST",
  "path": "/api/v1/orders",
  "statusCode": 201,
  "duration": "45ms"
}
```

### Sensitive Data Protection
The logger automatically redacts:
- Passwords
- Tokens (JWT, auth tokens)
- API keys
- Credit cards
- SSN
- Personal data

---

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": "User-friendly error message",
  "statusCode": 400,
  "timestamp": "2026-01-15T10:30:45.123Z",
  "requestId": "unique-request-id"
}
```

### Common Status Codes
- **200**: Success
- **201**: Created
- **400**: Bad request
- **401**: Unauthorized
- **403**: Forbidden
- **404**: Not found
- **500**: Server error
- **503**: Service unavailable

### Error Examples

**Missing required field**:
```json
{
  "success": false,
  "error": "Invalid data format",
  "statusCode": 400,
  "details": {
    "validationErrors": {
      "email": "Email is required"
    }
  }
}
```

**Unauthorized access**:
```json
{
  "success": false,
  "error": "Invalid or expired token",
  "statusCode": 401
}
```

**Server error**:
```json
{
  "success": false,
  "error": "Internal Server Error",
  "statusCode": 500
}
```

---

## Database

### Connect to Database

**Using psql**:
```bash
psql "postgresql://user:password@localhost:5432/dbname"
```

**Using Prisma Studio**:
```bash
npx prisma studio
# Opens GUI at http://localhost:5555
```

### Common Database Queries

```sql
-- List tables
\dt

-- View table structure
\d users

-- Run query
SELECT * FROM users;

-- Count records
SELECT COUNT(*) FROM orders;

-- Recent orders
SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;
```

### Backup & Restore

```bash
# Backup database
pg_dump "postgresql://user:pass@host:5432/db" > backup.sql

# Restore database
psql "postgresql://user:pass@host:5432/db" < backup.sql
```

---

## Troubleshooting

### Issue: "Cannot find module 'dotenv'"
```bash
# Solution: Install dependencies
npm install
```

### Issue: "Database connection failed"
```bash
# Check .env DATABASE_URL
cat .env | grep DATABASE_URL

# Test connection
psql "postgresql://user:password@host:5432/db"

# Verify PostgreSQL is running
psql --version
```

### Issue: "Port 5000 is already in use"
```bash
# Find process using port
lsof -i :5000

# Kill the process
kill -9 <PID>

# Use different port
PORT=5001 npm start
```

### Issue: "Twilio webhook not working"
```bash
# 1. Verify WHATSAPP_VERIFY_TOKEN in .env
# 2. Ensure webhook URL is correct
# 3. Check firewall allows webhooks
# 4. Review Twilio webhook logs
```

### Issue: "Prisma database schema out of sync"
```bash
# Reset database (⚠️ deletes all data)
npm run migrate:reset

# Or apply pending migrations
npx prisma migrate deploy
```

---

## Performance Tips

### Database
- Use indexes on frequently queried columns
- Avoid N+1 queries (use includes in Prisma)
- Monitor slow queries in logs
- Regular backups

### API
- Cache responses when possible
- Implement pagination for large datasets
- Use request IDs for tracing
- Monitor response times (in logs)

### Monitoring
```bash
# Slow requests (>1000ms)
grep '"duration":"[0-9]\{4,\}ms"' logs/app.log

# Error rate
grep ERROR logs/error.log | wc -l

# Average response time
grep '"duration"' logs/app.log | sed 's/.*"\([0-9]*\)ms".*/\1/' | awk '{s+=$1;c++} END {print s/c}'
```

---

## Security Checklist

- [ ] .env file is in .gitignore
- [ ] No sensitive data committed to git
- [ ] JWT_SECRET is strong (32+ chars)
- [ ] WHATSAPP_VERIFY_TOKEN is strong
- [ ] Database password is strong
- [ ] CORS_ORIGIN whitelisted
- [ ] All inputs validated
- [ ] Helmet.js enabled (automatic)
- [ ] HTTPS used in production
- [ ] Logs don't contain sensitive data

---

## Production Deployment

See [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) for:
- Full deployment checklist
- Environment configuration
- Error handling
- Request logging
- Security hardening
- Monitoring & logs

---

## Support & Resources

- **API Documentation**: See README.md in each route folder
- **Twilio Docs**: https://www.twilio.com/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **Express Docs**: https://expressjs.com
- **PostgreSQL Docs**: https://www.postgresql.org/docs

---

## Contributing

1. Create a feature branch
2. Make changes
3. Test thoroughly
4. Update documentation
5. Create pull request

---

## License

MIT License - See LICENSE file for details
