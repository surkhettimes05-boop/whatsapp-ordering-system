# 🔧 Render Deployment - Command Reference

## Quick Commands

### Local Testing

```bash
# Install dependencies
cd backend && npm install && cd ../frontend && npm install && cd ..

# Test backend
cd backend
npm run dev                    # Start dev server

# In another terminal, test endpoints
curl http://localhost:5000/health
curl http://localhost:5000/api/v1/whatsapp/test

# Test database
npm run db:migrate             # Run migrations
npm test                       # Run tests
```

### Pre-Deployment

```bash
# Check for issues
npm audit                      # Security audit
npm run lint                   # Linting (if configured)

# Final build test
npm run render-build          # Test render build locally
npm run render-start          # Test render start script

# Verify files
git status                     # Check all changes
git diff                       # Review changes
```

### Git Push to Trigger Deploy

```bash
# Commit all changes
git add .
git commit -m "Production deployment: Render optimization

- Added db-init.js for Prisma safety
- Optimized webhook handler (fire-and-forget)
- Enhanced startup logging and graceful shutdown
- Updated render.yaml with production settings
- Added comprehensive documentation"

# Push to main branch
git push origin main          # Triggers Render deployment
```

---

## Render Dashboard URLs

| Service | URL |
|---------|-----|
| Dashboard | https://dashboard.render.com |
| Blueprints | https://dashboard.render.com/blueprints |
| Services | https://dashboard.render.com/services |
| Databases | https://dashboard.render.com/databases |
| Settings | https://dashboard.render.com/account/settings |

---

## Environment Variables - Copy/Paste

### Set in Render Dashboard → Backend Service → Environment

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+14155238886
TWILIO_WHATSAPP_NUMBER=+14155238886
WEBHOOK_URL=https://whatsapp-backend-xxx.onrender.com/api/v1/whatsapp/webhook
DOMAIN=your-domain.com
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=YourSecurePassword123!
```

### Generate Secrets

```bash
# Generate JWT secret
openssl rand -base64 32

# Generate strong password
openssl rand -base64 24 | tr '+/' '-_' | head -c 32
```

---

## Service URLs After Deployment

| Service | URL Pattern | Example |
|---------|------------|---------|
| Backend | `https://whatsapp-backend-xxx.onrender.com` | `https://whatsapp-backend-abc123.onrender.com` |
| Frontend | `https://whatsapp-frontend-xxx.onrender.com` | `https://whatsapp-frontend-abc123.onrender.com` |
| Health Check | `/health` | `https://whatsapp-backend-abc123.onrender.com/health` |
| Webhook | `/api/v1/whatsapp/webhook` | `https://whatsapp-backend-abc123.onrender.com/api/v1/whatsapp/webhook` |

---

## Testing Endpoints

### Health Checks

```bash
# Basic health
curl https://whatsapp-backend-xxx.onrender.com/health

# Readiness (tests database)
curl https://whatsapp-backend-xxx.onrender.com/health/ready

# Liveness
curl https://whatsapp-backend-xxx.onrender.com/health/live

# Detailed diagnostics
curl https://whatsapp-backend-xxx.onrender.com/health/detailed
```

### WhatsApp Test

```bash
# Test webhook endpoint
curl https://whatsapp-backend-xxx.onrender.com/api/v1/whatsapp/test

# Response should include:
# {
#   "success": true,
#   "message": "WhatsApp webhook is ready! 🚀",
#   "twilio": { "configured": true, ... }
# }
```

### Dashboard

```bash
# Open frontend
https://whatsapp-frontend-xxx.onrender.com

# Login with:
# Email: admin@example.com
# Password: (from environment variables)
```

---

## Monitoring Commands

### View Service Logs (via Shell)

```bash
# Access Render shell
# (Dashboard → Service → Shell tab)

# View recent logs
tail -n 100 /var/log/app.log

# Search logs
grep ERROR /var/log/app.log
grep WEBHOOK /var/log/app.log
grep "database" /var/log/app.log

# Monitor in real-time
tail -f /var/log/app.log
```

### Database Maintenance

```bash
# Connect to PostgreSQL
# (Render dashboard → PostgreSQL → Connection string)

# Run SQL query
psql "postgresql://postgres:PASSWORD@whatsapp-postgres:5432/whatsapp_ordering" \
  -c "SELECT COUNT(*) FROM orders;"

# Backup database
pg_dump "postgresql://postgres:PASSWORD@whatsapp-postgres:5432/whatsapp_ordering" > backup.sql

# Restore database
psql "postgresql://postgres:PASSWORD@whatsapp-postgres:5432/whatsapp_ordering" < backup.sql
```

### Check Performance

```bash
# In Render dashboard:
# 1. Service → Metrics tab
# 2. View:
#    - CPU Usage (%)
#    - Memory Usage (MB)
#    - Request Count
#    - Error Rate
#    - Response Time (ms)
```

---

## Troubleshooting Commands

### Check Build Logs

```bash
# Dashboard → Service → Logs tab
# Filter by: "Build"
# Look for errors in:
# - npm install
# - prisma generate
# - prisma migrate deploy
```

### Check Runtime Logs

```bash
# Dashboard → Service → Logs tab
# Filter by: "Runtime"
# Look for:
# - Startup errors
# - Connection errors
# - HTTP errors
# - Database errors
```

### Verify Environment Variables

```bash
# In Render shell:
env | grep -i "TWILIO\|DATABASE\|JWT\|ADMIN"

# Should see:
# TWILIO_ACCOUNT_SID=...
# TWILIO_AUTH_TOKEN=...
# DATABASE_URL=...
# JWT_SECRET=...
# ADMIN_EMAIL=...
```

### Test Database Connection

```bash
# In Render shell (backend service):

# Test Prisma connection
cd backend && node -e "const p = require('@prisma/client'); const c = new p.PrismaClient(); c.\$queryRaw\`SELECT 1\`.then(r => console.log('✅ Connected')).catch(e => console.log('❌', e.message))"

# List tables
psql $DATABASE_URL -c "\\dt"
```

### Restart Service

```bash
# Dashboard → Service → More (3 dots) → Restart
# Or use API (if enabled):
curl -X POST https://api.render.com/v1/services/{id}/restart \
  -H "Authorization: Bearer {api-key}"
```

---

## Deployment Process

### Step 1: Create Blueprint

```bash
1. https://dashboard.render.com/blueprints
2. Click "New Blueprint" → "Public Git Repository"
3. Enter: https://github.com/YOUR_USERNAME/whatsapp-ordering-system
4. Click "Connect"
5. Review services
6. Click "Deploy"
```

### Step 2: Monitor Build

```bash
# Dashboard shows:
# 🟡 Building... (3-5 min)
# ✅ Build succeeded
# 🟡 Deploying... (2-3 min)
# ✅ Live
```

### Step 3: Add Environment Variables

```bash
# Dashboard → whatsapp-backend → Environment
# Add all variables from RENDER_ENV_TEMPLATE.env
# Click "Save"
# Service auto-redeploys
```

### Step 4: Verify Deployment

```bash
# Test health
curl https://whatsapp-backend-xxx.onrender.com/health

# Check logs
# Dashboard → Logs tab
# Look for: "All systems online - Ready for requests!"

# Test frontend
# https://whatsapp-frontend-xxx.onrender.com
# Should load dashboard
```

---

## Rollback Commands

### Rollback to Previous Deploy

```bash
# Dashboard → Service → Deploys tab
1. Find previous working deploy
2. Click "Redeploy"
3. Confirm
# Takes 2-3 minutes
```

### Disable Webhook (Emergency)

```bash
# Twilio Console → Messaging → Webhooks
1. Clear webhook URL
2. Click Save
# Messages still received but not processed
# Re-enable by setting URL again
```

### Scale Down (Cost Reduction)

```bash
# Dashboard → Service → Settings
1. Instance Type: Change from Standard to Starter
2. Save
# Service restarts with new config
# Cost reduced from $7 to $2.50/month
```

---

## Twilio Configuration

### Set Webhook URL

```bash
# Twilio Console → Messaging → Webhooks
Webhook URL: https://whatsapp-backend-xxx.onrender.com/api/v1/whatsapp/webhook
HTTP Method: POST
Enable: Yes
```

### Test Webhook

```bash
# Twilio Console → Messaging → Test webhook
# Send test message
# Check Render logs for:
# ✅ Webhook received and acknowledged to Twilio
# 🔄 Starting async message processing
# ✅ Message processing completed
```

---

## Performance Tuning

### Enable Slow Query Logging

```bash
# In Render shell:
export LOG_LEVEL=debug
# Restart service to apply
# Dashboard → Logs will show all queries > 5000ms
```

### Monitor Response Times

```bash
# Dashboard → Metrics → Response Time graph
# Typical: 50-200ms
# Slow: > 500ms (investigate queries)
# Check for:
# - N+1 queries
# - Missing indexes
# - Large result sets
```

### Scale Up if Needed

```bash
# Dashboard → Service → Settings
# Instance Type: Change to higher tier
# Current: Standard ($7/month)
# Upgrade to: Pro ($12/month) or Premium ($24/month)
# Service restarts automatically
```

---

## Monitoring Setup (Optional)

### Uptimerobot (Free)

```bash
1. Create account: https://uptimerobot.com
2. Add monitor:
   - URL: https://whatsapp-backend-xxx.onrender.com/health
   - Interval: 5 minutes
3. Enable alerts: Email/Slack
```

### Datadog (Paid)

```bash
1. Create account: https://www.datadoghq.com
2. Install Datadog agent
3. Monitor:
   - Application performance
   - Database queries
   - Error tracking
```

---

## CI/CD Integration

### GitHub Actions (Optional)

```bash
# .github/workflows/deploy.yml
name: Deploy to Render
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Trigger Render Deploy
        run: curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK }}
```

---

## Useful Aliases

```bash
# Add to ~/.bashrc or ~/.zshrc

alias render-logs='echo "Go to: https://dashboard.render.com"'
alias render-health='curl https://whatsapp-backend-xxx.onrender.com/health'
alias render-test='curl https://whatsapp-backend-xxx.onrender.com/api/v1/whatsapp/test'
alias render-frontend='open https://whatsapp-frontend-xxx.onrender.com'
```

---

## Emergency Contacts

| Issue | Action | Time |
|-------|--------|------|
| Website down | Check health endpoint | 5 min |
| Webhook not responding | View logs, check Twilio | 10 min |
| Database error | Check connections, restart DB | 15 min |
| Out of memory | Scale up instance | 10 min |
| Security issue | Disable service, investigate | 5 min |

---

## Documentation Links

- Render Docs: https://render.com/docs
- Prisma Docs: https://www.prisma.io/docs
- Twilio WhatsApp: https://www.twilio.com/docs/whatsapp
- Express.js: https://expressjs.com/
- PostgreSQL: https://www.postgresql.org/docs/

---

## Files Location Reference

```
Project Root
├── render.yaml ← Main config
├── backend/
│   ├── package.json ← Scripts
│   ├── src/
│   │   ├── app.js ← Startup
│   │   ├── config/
│   │   │   ├── db-init.js ← NEW
│   │   │   └── env.config.js
│   │   └── routes/
│   │       └── whatsapp.routes.js
│   └── prisma/
│       └── schema.prisma
└── Docs
    ├── RENDER_PRODUCTION_GUIDE.md
    ├── RENDER_QUICK_START.md
    ├── RENDER_DEPLOYMENT_CHECKLIST.md
    └── RENDER_ENV_TEMPLATE.env
```

---

**Last Updated**: January 24, 2026  
**Platform**: Render.com  
**Status**: Production Ready ✅
