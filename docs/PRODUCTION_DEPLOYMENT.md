# Production Deployment Guide

## 🔒 Security Hardening Checklist

This guide covers the security measures implemented for production deployment.

---

## 1. Environment Configuration

### Setup .env File

1. **Copy the template**:
   ```bash
   cp .env.example .env
   ```

2. **Edit with your values**:
   ```bash
   nano .env  # or your preferred editor
   ```

3. **Required variables** (MUST be set):
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = Your PostgreSQL connection string
   - `JWT_SECRET` = Secure random string (min 32 chars)
   - `TWILIO_ACCOUNT_SID` = Your Twilio SID
   - `TWILIO_AUTH_TOKEN` = Your Twilio token
   - `TWILIO_WHATSAPP_FROM` = Your WhatsApp number
   - `WHATSAPP_VERIFY_TOKEN` = Secure random webhook token
   - `FRONTEND_URL` = Your frontend domain

### Generate Secure Keys

```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate WHATSAPP_VERIFY_TOKEN
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### ⚠️ CRITICAL: Environment Security

```bash
# NEVER commit .env to git
git status  # Should NOT show .env

# Verify .env is in .gitignore
grep "^.env$" .gitignore

# Check .env is not tracked
git ls-files | grep .env  # Should return nothing
```

---

## 2. Node Modules Management

### Before Deployment

```bash
# Remove node_modules from git history (if accidentally committed)
git rm --cached -r node_modules/
git commit -m "Remove node_modules from git"

# Install dependencies
npm ci --production  # Use 'ci' for production, not 'install'

# Verify .gitignore
grep "^node_modules" .gitignore  # Should return node_modules/
```

### On Server

```bash
# Install dependencies
npm ci --production

# Verify lock file is present
ls -la package-lock.json  # Must exist

# DO NOT use package-lock.json if not present
# Always commit package-lock.json to git
```

### Correct .gitignore Setup

```
# node_modules/ ✅ Present in .gitignore
# .env ✅ Present in .gitignore
# .env.local ✅ Present in .gitignore
# .env.*.local ✅ Present in .gitignore
```

---

## 3. Error Handling

### Production Error Handler

The application now includes centralized error handling:

```javascript
// src/middleware/errorHandler.middleware.js
- Catches all errors
- Sanitizes sensitive data
- Returns user-friendly messages
- Logs detailed information server-side
```

### Error Response Format

**Development Response** (detailed):
```json
{
  "success": false,
  "error": "Detailed error message",
  "statusCode": 500,
  "timestamp": "2026-01-15T...",
  "requestId": "123456-abc",
  "details": { "validationErrors": {...} }
}
```

**Production Response** (sanitized):
```json
{
  "success": false,
  "error": "Internal Server Error",
  "statusCode": 500,
  "timestamp": "2026-01-15T...",
  "requestId": "123456-abc"
}
```

### Environment-Specific Behavior

```javascript
// In app.js and middleware/errorHandler.middleware.js

if (process.env.NODE_ENV === 'development') {
  // Full error details and stack traces
  // Detailed logging to console
}

if (process.env.NODE_ENV === 'production') {
  // Minimal error details to client
  // Server-side logging only (file-based)
  // No sensitive data exposed
}
```

---

## 4. Request Logging

### What Gets Logged

Each request logs:
- Request ID (unique per request)
- Method (GET, POST, etc.)
- Path (/api/v1/...)
- Status code (200, 404, 500, etc.)
- Response time (milliseconds)
- User ID (if authenticated)
- IP address

### What DOES NOT Get Logged

The logger automatically sanitizes:
- Passwords
- Tokens (JWT, auth tokens, etc.)
- API keys
- Secrets
- Credit card numbers
- Social security numbers
- Email addresses (if marked sensitive)
- Phone numbers (if marked sensitive)
- Personal identification data

### Log Files

```
logs/
├── app.log          # Standard application logs
├── error.log        # Error-level logs only
└── debug.log        # Debug-level logs (development)
```

### Reading Logs

```bash
# View recent logs
tail -100 logs/app.log

# Watch logs in real-time
tail -f logs/app.log

# Find specific errors
grep "ERROR" logs/error.log

# Find specific user activity
grep "userId: 123" logs/app.log

# Find slow requests (>1000ms)
grep -E '"duration":"[0-9]{4,}ms"' logs/app.log
```

### Log Format

```json
{
  "timestamp": "2026-01-15T10:30:45.123Z",
  "level": "INFO",
  "message": "Request completed: POST /api/v1/orders",
  "requestId": "1737972645123-abc123def",
  "method": "POST",
  "path": "/api/v1/orders",
  "statusCode": 201,
  "duration": "45ms",
  "ip": "192.168.1.100",
  "userId": "user-123",
  "nodeEnv": "production",
  "pid": 12345
}
```

---

## 5. Security Best Practices

### Database Security

```bash
# Use strong PostgreSQL passwords
# Min 16 characters, mix of upper, lower, numbers, special chars

# Example strong password:
# P@ssw0rd#2026!SecureDb

# Set in .env
DATABASE_URL=postgresql://user:P@ssw0rd#2026!SecureDb@host:5432/db
```

### JWT Secret Security

```bash
# Generate strong JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Example:
# 3f8a9b2c1d5e4f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f

# Store in .env
JWT_SECRET=3f8a9b2c1d5e4f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f
```

### Twilio Credentials Security

```bash
# Never log Twilio credentials
# Keep tokens in .env only
# Rotate tokens regularly (monthly recommended)

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=secure_token_here
```

### CORS Configuration

```javascript
// Whitelist only trusted origins
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com

// Never use '*' in production
// This allows any domain to access your API
CORS_ORIGIN=* ❌ NOT RECOMMENDED
```

---

## 6. Deployment Checklist

### Pre-Deployment

- [ ] All environment variables set in .env
- [ ] .env file is in .gitignore
- [ ] Node modules are in .gitignore
- [ ] No sensitive data in git history
- [ ] `.env.example` created and committed
- [ ] Error handler implemented
- [ ] Request logger configured
- [ ] All tests passing
- [ ] Database migrations applied
- [ ] JWT_SECRET is unique and strong

### Deployment Steps

```bash
# 1. Clone repository (without .env)
git clone https://github.com/your-org/repo.git
cd repo/backend

# 2. Install dependencies
npm ci --production

# 3. Create .env from .env.example
cp .env.example .env

# 4. Set environment variables
nano .env
# Fill in all required values

# 5. Create logs directory
mkdir -p logs

# 6. Apply database migrations
npx prisma migrate deploy

# 7. Start the server
NODE_ENV=production npm start

# 8. Verify health check
curl http://localhost:5000/health
```

### Post-Deployment

- [ ] Health check passes
- [ ] Logs directory is writable
- [ ] Error logs are being created
- [ ] Request logs show activity
- [ ] Monitor for errors in first hour
- [ ] Check database connection
- [ ] Verify all routes are accessible

---

## 7. Log Rotation (Production)

For long-running servers, implement log rotation to prevent disk space issues:

```bash
# Install logrotate (Linux/Mac)
npm install winston-daily-rotate-file

# Or use system logrotate (Linux)
cat > /etc/logrotate.d/whatsapp-api <<EOF
/path/to/backend/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    missingok
}
EOF
```

---

## 8. Monitoring & Alerts

### Key Metrics to Monitor

```bash
# Error rate
grep "ERROR" logs/error.log | wc -l

# Request count
grep "INFO" logs/app.log | wc -l

# Average response time
grep '"duration"' logs/app.log | sed 's/.*"duration":"\([0-9]*\)ms".*/\1/' | awk '{sum+=$1; count++} END {print "Average:", sum/count, "ms"}'

# Slow requests (>1000ms)
grep '"duration":"[0-9]\{4,\}ms"' logs/app.log | wc -l
```

### Set Up Alerts

```bash
# Example: Alert if error rate > 10 in 1 hour
watch -n 3600 "if [ $(grep $(date +%Y-%m-%d) logs/error.log | wc -l) -gt 10 ]; then echo 'HIGH ERROR RATE'; fi"
```

---

## 9. Security Headers

The application uses Helmet.js for security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
```

These are automatically applied to all responses.

---

## 10. Rate Limiting (Optional)

To implement rate limiting in production:

```javascript
// Install package
npm install express-rate-limit

// Add to app.js
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP'
});

app.use(limiter);
```

Configure in .env:
```
RATE_LIMIT_WINDOW=900000        # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100    # 100 requests per window
```

---

## 11. Troubleshooting

### Issue: "PORT is already in use"
```bash
# Find process using port
lsof -i :5000
# or
netstat -ano | findstr :5000

# Kill process
kill -9 <PID>
# or on Windows
taskkill /PID <PID> /F
```

### Issue: "Cannot connect to database"
```bash
# Verify DATABASE_URL format
cat .env | grep DATABASE_URL

# Test connection
psql "postgresql://user:password@host:5432/db"
```

### Issue: "Logs directory not writable"
```bash
# Create logs directory
mkdir -p logs

# Set permissions
chmod 755 logs
```

### Issue: "Sensitive data in logs"
The logger automatically sanitizes sensitive fields. To add more fields:

Edit `src/config/logger.js`:
```javascript
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'apiKey',
  // Add custom field names:
  'myCustomSensitiveField'
];
```

---

## 12. Database Backups

```bash
# Backup PostgreSQL
pg_dump "postgresql://user:pass@host:5432/db" > backup.sql

# Restore PostgreSQL
psql "postgresql://user:pass@host:5432/db" < backup.sql

# Schedule daily backups (cron)
0 2 * * * pg_dump "..." > /backups/db_$(date +\%Y\%m\%d).sql
```

---

## 13. Environment-Specific Configuration

### Development (.env)
```
NODE_ENV=development
LOG_LEVEL=debug
LOG_REQUESTS=true
DEBUG=whatsapp-ordering:*
```

### Staging (.env.staging)
```
NODE_ENV=staging
LOG_LEVEL=info
LOG_REQUESTS=true
```

### Production (.env)
```
NODE_ENV=production
LOG_LEVEL=warn
LOG_REQUESTS=false
DEBUG=
```

---

## 14. Continuous Deployment

If using GitHub Actions or similar:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Install dependencies
        run: npm ci --production
      
      - name: Check for .env
        run: |
          if git ls-files | grep "^.env$"; then
            echo "ERROR: .env file is committed!"
            exit 1
          fi
      
      - name: Deploy
        run: npm run deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
          # All other secrets from GitHub Secrets
```

---

## 15. Quick Reference

### File Structure
```
backend/
├── .env                    # ✅ Local config (NOT in git)
├── .env.example           # ✅ Template (in git)
├── .gitignore             # ✅ Excludes sensitive files
├── package.json           # ✅ In git
├── package-lock.json      # ✅ In git
├── logs/                  # Created on first run
│   ├── app.log
│   ├── error.log
│   └── debug.log
└── src/
    ├── app.js            # ✅ Uses error/request middleware
    ├── middleware/
    │   └── errorHandler.middleware.js  # ✅ New
    ├── config/
    │   └── logger.js     # ✅ New
    └── routes/           # ✅ Existing
```

### Important Commands
```bash
npm ci --production      # Install (production)
NODE_ENV=production npm start    # Start server
tail -f logs/app.log    # Watch logs
grep ERROR logs/error.log  # Find errors
curl http://localhost:5000/health  # Health check
```

---

## 16. Support & Issues

### Report Issues
1. Check error logs: `tail logs/error.log`
2. Check request logs: `tail logs/app.log`
3. Verify .env configuration
4. Check database connection
5. Verify all environment variables are set

### Contact
- Technical Support: [your-email@example.com]
- Twilio Support: https://support.twilio.com
- Database Issues: [your-dba@example.com]

---

## Summary

✅ **Environment**: .env created from .env.example, never committed  
✅ **Error Handling**: Centralized middleware with safe logging  
✅ **Request Logging**: Method, path, status, time logged safely  
✅ **Sensitive Data**: Automatically redacted from logs  
✅ **Node Modules**: In .gitignore, installed with `npm ci`  
✅ **Security**: Helmet.js, JWT, database passwords protected  
✅ **Monitoring**: Logs available for analysis and debugging  

**Your backend is now production-ready!** 🚀
