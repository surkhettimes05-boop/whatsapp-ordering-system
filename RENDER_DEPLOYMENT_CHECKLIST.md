# 📋 Render Deployment Checklist

## Pre-Deployment (Local Testing)

### Code Quality ✅
- [ ] All `console.log()` replaced with `logger`
- [ ] No hardcoded secrets in code
- [ ] `.env` in `.gitignore`
- [ ] No `node_modules/` in git
- [ ] Tests passing: `npm test`
- [ ] Linter passing: `npm run lint`
- [ ] No security warnings: `npm audit`

### Local Validation ✅
- [ ] Run `npm install` in backend and frontend
- [ ] Database migrations run: `npm run db:migrate`
- [ ] Backend starts: `npm run dev` (backend)
- [ ] Frontend builds: `npm run build` (frontend)
- [ ] Health check works: `curl http://localhost:5000/health`
- [ ] WhatsApp test works: `curl http://localhost:5000/api/v1/whatsapp/test`
- [ ] No errors in logs

### Files Verification ✅
- [ ] `render.yaml` present and valid
- [ ] `backend/package.json` has `render-build` and `render-start`
- [ ] `backend/src/config/db-init.js` exists
- [ ] `backend/src/app.js` imports db-init
- [ ] `backend/src/routes/whatsapp.routes.js` uses setImmediate
- [ ] `backend/start.sh` executable (chmod +x)
- [ ] All docs in place:
  - [ ] RENDER_PRODUCTION_GUIDE.md
  - [ ] RENDER_QUICK_START.md
  - [ ] RENDER_ANALYSIS_REPORT.md
  - [ ] RENDER_ENV_TEMPLATE.env
  - [ ] RENDER_DEPLOYMENT_READY.md

---

## Credentials Preparation

### Twilio Setup ✅
- [ ] Account created: https://www.twilio.com
- [ ] WhatsApp sandbox enabled
- [ ] Account SID noted: `AC...`
- [ ] Auth Token noted: `...`
- [ ] WhatsApp number obtained: `+1...`
- [ ] Phone number verified for testing

### Database & Cache ✅
- [ ] PostgreSQL schema finalized
- [ ] All migrations created: `backend/prisma/migrations/`
- [ ] Schema tested locally
- [ ] No data loss issues identified

### Security ✅
- [ ] JWT secret generated: `openssl rand -base64 32`
- [ ] Admin email decided
- [ ] Admin password created (12+ chars, mixed case, numbers, symbols)
- [ ] No credentials in code
- [ ] `.env` file not committed

---

## GitHub Preparation

### Repository Setup ✅
- [ ] Repository created on GitHub
- [ ] All code pushed to main branch
- [ ] Branch protection enabled (optional)
- [ ] README.md updated
- [ ] `.gitignore` includes `.env` and `node_modules/`

### Commit History ✅
- [ ] Final commit message meaningful
- [ ] All changes committed: `git status` shows clean
- [ ] No uncommitted changes remain
- [ ] Recent commits contain deployment changes

---

## Render.com Account Setup

### Account Preparation ✅
- [ ] Render account created
- [ ] Email verified
- [ ] GitHub connected via OAuth
- [ ] Payment method added (if scaling beyond free tier)
- [ ] Team members invited (optional)

---

## Deployment Process

### Blueprint Deployment ✅
- [ ] Go to: https://dashboard.render.com/blueprints
- [ ] Click "New Blueprint" → "Public Git Repository"
- [ ] Repository URL pasted correctly
- [ ] Blueprint created successfully
- [ ] Services visible:
  - [ ] whatsapp-postgres
  - [ ] whatsapp-redis
  - [ ] whatsapp-backend
  - [ ] whatsapp-frontend

### Build Process ✅
- [ ] Build started (check "Events" tab)
- [ ] Dependencies installed (30-40s)
- [ ] Prisma Client generated (5-10s)
- [ ] Database migrations run (2-5s)
- [ ] Build completed: "Build succeeded"

### Service Startup ✅
- [ ] Backend service started
- [ ] Logs show startup sequence:
  - [ ] "Initializing Database Connection"
  - [ ] "Database ready"
  - [ ] "Starting Express Server"
  - [ ] "All systems online"
- [ ] Frontend service built
- [ ] All services show "Live" status

---

## Environment Configuration (Dashboard)

### Backend Environment Variables ✅
Add in Render dashboard → whatsapp-backend → Environment:

```
TWILIO_ACCOUNT_SID = ___________________
TWILIO_AUTH_TOKEN = ___________________
TWILIO_PHONE_NUMBER = +14155238886
TWILIO_WHATSAPP_NUMBER = +14155238886
WEBHOOK_URL = https://whatsapp-backend-xxx.onrender.com/api/v1/whatsapp/webhook
DOMAIN = your-domain.com
ADMIN_EMAIL = admin@example.com
ADMIN_PASSWORD = SecurePassword123!
```

- [ ] All variables entered (no typos)
- [ ] "Save" clicked
- [ ] Service redeployed

### Frontend Environment (Optional) ✅
- [ ] Add `VITE_API_BASE_URL` (auto-filled from backend URL)
- [ ] Build successful with new env

---

## Post-Deployment Verification

### Service Status ✅
- [ ] PostgreSQL: Running ✓
- [ ] Redis: Running ✓
- [ ] Backend: Live ✓
- [ ] Frontend: Live ✓

### Health Checks ✅
Test each endpoint:

```bash
# Basic health
curl https://whatsapp-backend-xxx.onrender.com/health
# Expected: { "status": "ok", "services": { "database": "connected", ... } }

# WhatsApp test
curl https://whatsapp-backend-xxx.onrender.com/api/v1/whatsapp/test
# Expected: { "success": true, ... }

# Frontend
https://whatsapp-frontend-xxx.onrender.com
# Expected: Dashboard loads, no errors
```

- [ ] All endpoints respond with 200 OK
- [ ] Database shows "connected"
- [ ] Redis shows "connected"
- [ ] No 500 errors in logs

### Logging ✅
- [ ] Go to whatsapp-backend → "Logs" tab
- [ ] No ERROR or FATAL messages
- [ ] Startup sequence visible
- [ ] Recent log entries show health checks passing

---

## Twilio Configuration

### Webhook Setup ✅
1. [ ] Log into Twilio Console: https://www.twilio.com/console
2. [ ] Go to Messaging → Webhooks
3. [ ] Set webhook URL:
   ```
   https://whatsapp-backend-xxx.onrender.com/api/v1/whatsapp/webhook
   ```
4. [ ] Set HTTP Method: POST
5. [ ] Click Save
6. [ ] Test webhook in console:
   - [ ] Webhook responds with 200 OK
   - [ ] No timeout errors
   - [ ] Render logs show webhook received

### Sandbox Testing ✅
- [ ] Send test message via WhatsApp
- [ ] Check Render logs for message receipt:
  - [ ] "✅ Webhook received and acknowledged to Twilio"
  - [ ] "🔄 Starting async message processing"
  - [ ] "✅ Message processing completed"
- [ ] Verify response in system (order created, etc.)

---

## Monitoring Setup

### Render Monitoring ✅
- [ ] Go to backend service → "Metrics"
- [ ] Verify CPU usage < 50%
- [ ] Verify Memory < 400MB
- [ ] Check response times < 500ms
- [ ] Set up alerts (optional):
  - [ ] Email on health check failure
  - [ ] Slack integration (if using)

### Log Monitoring ✅
- [ ] Backend → "Logs" tab bookmarked
- [ ] Check logs daily for first week
- [ ] Monitor for:
  - [ ] Slow queries (> 5000ms)
  - [ ] Connection errors
  - [ ] Memory leaks
  - [ ] Unhandled exceptions

### Uptime Monitoring (Optional) ✅
- [ ] Create account at Uptimerobot.com (free)
- [ ] Add health check: `https://whatsapp-backend-xxx.onrender.com/health`
- [ ] Set alert frequency: Every 5 minutes
- [ ] Enable email/Slack notifications

---

## Team Communication

### Notify Stakeholders ✅
- [ ] Deployment completed email sent
- [ ] System URL shared: `https://whatsapp-frontend-xxx.onrender.com`
- [ ] Admin credentials shared securely (NOT in email)
- [ ] First-time setup instructions provided

### Documentation ✅
- [ ] RENDER_PRODUCTION_GUIDE.md shared with team
- [ ] Emergency contacts listed
- [ ] Rollback procedure documented
- [ ] Escalation procedures clear

---

## Scaling (After Launch)

### Monitor Performance ✅
- [ ] Track CPU usage for 1 week
- [ ] Track memory usage for 1 week
- [ ] Monitor webhook response times
- [ ] Document peak load patterns

### Scale if Needed ✅
- [ ] If CPU > 80% consistently: Upgrade instance type
- [ ] If memory > 80% consistently: Check for leaks, then upgrade
- [ ] If database slow: Add indexes, then upgrade
- [ ] Document all scaling changes

---

## Backup & Disaster Recovery

### Database Backups ✅
- [ ] Render automatic backups enabled (default)
- [ ] Backup retention: 1 week
- [ ] Test restore procedure (optional):
  - [ ] Create backup snapshot
  - [ ] Document restore time
  - [ ] Verify data integrity

### Code Backup ✅
- [ ] GitHub has full code history
- [ ] Important configs documented:
  - [ ] Environment variables noted (not passwords)
  - [ ] Custom domain settings
  - [ ] Twilio configuration

### Disaster Plan ✅
- [ ] Rollback procedure tested
- [ ] Database restore procedure tested
- [ ] Team knows escalation contacts
- [ ] Communication template prepared

---

## 30-Day Post-Launch Checklist

### Week 1: Monitoring ✅
- [ ] Daily log review
- [ ] Check metrics dashboard
- [ ] Monitor error rates (should be < 0.1%)
- [ ] Document any issues

### Week 2: Optimization ✅
- [ ] Review slow query logs
- [ ] Optimize if needed
- [ ] Monitor user feedback
- [ ] Document improvement opportunities

### Week 3: Scaling ✅
- [ ] Review resource utilization
- [ ] Adjust scaling thresholds if needed
- [ ] Plan for peak load
- [ ] Test auto-scaling behavior

### Week 4: Review ✅
- [ ] Generate performance report
- [ ] Review incident log
- [ ] Plan improvements
- [ ] Update documentation
- [ ] Schedule next review

---

## Success Criteria ✅

Before considering deployment complete:

- [ ] All services running (no crashes for 24h)
- [ ] Health checks passing consistently
- [ ] No error messages in logs
- [ ] Webhook response time < 200ms
- [ ] Database queries < 100ms average
- [ ] CPU usage < 50%
- [ ] Memory usage < 50%
- [ ] WhatsApp messages processed successfully
- [ ] Dashboard accessible and functional
- [ ] Team trained on system
- [ ] Documentation complete
- [ ] Monitoring in place
- [ ] Backup tested
- [ ] Disaster recovery plan ready

---

## Contact & Escalation

| Issue | Contact | Time |
|-------|---------|------|
| Website Down | DevOps Team | 5 min |
| Database Error | DBA / DevOps | 15 min |
| Webhook Failing | Backend Dev | 10 min |
| Performance Issue | DevOps / Backend Dev | 30 min |
| Security Issue | Security Team | Immediate |

---

## Sign-Off

- [ ] Deployment Lead: _________________ Date: _______
- [ ] QA Lead: _________________ Date: _______
- [ ] DevOps Lead: _________________ Date: _______
- [ ] Product Owner: _________________ Date: _______

---

**Deployment Status**: ✅ READY TO DEPLOY

All checklist items completed? → **Proceed to production!** 🚀

For issues, refer to **RENDER_PRODUCTION_GUIDE.md** troubleshooting section.

---

**Last Updated**: January 24, 2026
**Deployment Date**: _______________
**Launch Owner**: _______________
