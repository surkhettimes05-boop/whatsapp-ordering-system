# WhatsApp Production Deployment - Implementation Checklist

**Date**: January 22, 2026  
**Status**: Ready for Production Deployment  
**Target**: Twilio WhatsApp Business API - Live Mode

---

## Phase 1: Pre-Deployment Preparation (Week 1)

### 1.1 Account & Credentials Setup

- [ ] **Twilio Business Account Created**
  - Account verified
  - Business information complete
  - Payment method added
  
- [ ] **Phone Number Verified**
  - Business phone number obtained
  - SMS verification completed
  - Number active in Twilio

- [ ] **API Credentials Generated**
  ```bash
  # From Twilio Console:
  - TWILIO_ACCOUNT_SID: AC...
  - TWILIO_AUTH_TOKEN: (64 chars)
  - TWILIO_WHATSAPP_FROM: whatsapp:+1...
  ```
  - Credentials stored in 1Password / Vault
  - NOT committed to Git
  - NOT in local .env (use CI/CD secrets)

- [ ] **Domain & HTTPS Ready**
  - Domain purchased and configured
  - SSL/TLS certificate installed (Let's Encrypt recommended)
  - Certificate valid for 1+ years
  - HTTPS works on all endpoints
  ```bash
  curl -v https://api.yourdomain.com
  # Expected: HTTP/2 200 with valid certificate
  ```

### 1.2 Database Preparation

- [ ] **Production Database Created**
  - PostgreSQL 12+ instance
  - Backups configured (daily minimum)
  - High availability enabled (if available)
  - Connection pooling configured (PgBouncer or built-in)

- [ ] **Prisma Schema Updated**
  - Message delivery tables added
  - Status log tables created
  - Indexes created for performance
  ```bash
  npx prisma migrate dev --name add_whatsapp_delivery_tracking
  npx prisma migrate deploy
  ```

- [ ] **Database Seeded** (if needed)
  - Admin user created
  - Test data loaded
  - Initial configurations set

### 1.3 Redis Setup

- [ ] **Redis Instance Running**
  - Redis 6.0+ deployed
  - Password set (strong, 32+ characters)
  - TLS enabled (if over network)
  - Persistence configured (RDB or AOF)

- [ ] **Queue System Tested**
  ```bash
  redis-cli ping
  # Expected: PONG
  
  redis-cli -p 6379 INFO stats
  # Check memory and connected clients
  ```

### 1.4 Environment Configuration

- [ ] **Production .env Created** (NEVER in Git!)
  ```
  NODE_ENV=production
  TWILIO_ACCOUNT_SID=AC...
  TWILIO_AUTH_TOKEN=...
  WEBHOOK_URL=https://api.yourdomain.com/api/v1/whatsapp/webhook
  ```

- [ ] **Secrets Secured**
  - Stored in CI/CD platform (GitHub Secrets, GitLab, etc.)
  - Stored in Vault (Hashicorp, AWS Secrets Manager)
  - NOT in any Git repository
  - Rotated quarterly scheduled

---

## Phase 2: Backend Code Deployment (Week 1)

### 2.1 Code Updates

- [ ] **WhatsApp Service Updated**
  - Location: `backend/src/services/whatsapp.service.js`
  - Status: ✅ Complete with queue support

- [ ] **Delivery Service Added**
  - Location: `backend/src/services/whatsapp-delivery.service.js`
  - Functions: Status tracking, metrics, retry logic
  - Status: ✅ Created and ready

- [ ] **Routes Updated**
  - POST /api/v1/whatsapp/webhook - Message receiving
  - POST /api/v1/whatsapp/status - Status callbacks
  - GET /api/v1/whatsapp/delivery-status/:messageSid
  - GET /api/v1/whatsapp/delivery-metrics
  - Status: ✅ Ready

- [ ] **Middleware Configured**
  - HTTPS enforcement: ✅
  - Twilio signature validation: ✅
  - Replay attack prevention: ✅
  - Deduplication: ✅
  - Idempotency: ✅
  - Rate limiting: ✅

### 2.2 Tests

- [ ] **Unit Tests Pass**
  ```bash
  npm run test -- src/services/whatsapp*.service.js
  ```

- [ ] **Integration Tests Pass**
  ```bash
  npm run test:integration -- whatsapp
  ```

- [ ] **E2E Tests Pass**
  ```bash
  npm run test:e2e -- --testNamePattern="WhatsApp"
  ```

### 2.3 Build & Compilation

- [ ] **Build Succeeds**
  ```bash
  npm run build
  # Expected: No errors, output in dist/
  ```

- [ ] **TypeScript Checks** (if using TS)
  ```bash
  npm run type-check
  # Expected: No type errors
  ```

- [ ] **Linting Passes**
  ```bash
  npm run lint
  # Expected: No errors, warnings only if acceptable
  ```

---

## Phase 3: Twilio Console Configuration (Day of Deployment)

### 3.1 Update Webhook URL

**Location**: Twilio Console → Messaging → WhatsApp Senders → Your Number

- [ ] **Update "When a message comes in"**
  - URL: `https://api.yourdomain.com/api/v1/whatsapp/webhook`
  - Method: POST
  - Click "Save"
  - Wait for ✅ Verified status (30-60 seconds)

- [ ] **Update Status Callback URL**
  - URL: `https://api.yourdomain.com/api/v1/whatsapp/status`
  - Method: POST
  - Click "Save"

### 3.2 Verify Webhook Configuration

**Testing from terminal:**

```bash
# Test 1: Webhook accessibility
curl -I https://api.yourdomain.com/api/v1/whatsapp/webhook
# Expected: 200 OK or 403 Forbidden (both indicate endpoint exists)

# Test 2: HTTPS certificate
curl -v https://api.yourdomain.com/api/v1/whatsapp/webhook
# Expected: certificate chain valid

# Test 3: Twilio signature validation
curl -X POST https://api.yourdomain.com/api/v1/whatsapp/status \
  -H "Content-Type: application/json" \
  -d '{"MessageSid":"SM123","MessageStatus":"sent"}'
# Expected: 200 OK (should handle gracefully)
```

### 3.3 Verify Status Callbacks

- [ ] **Enable Message Status Callbacks**
  - Messaging → WhatsApp Senders → Your Number
  - Find: "Status Callback" option
  - Enable: ✅
  - Status: Should show "Enabled"

- [ ] **Test Status Callback**
  - Send test message from Twilio Console
  - Check application logs for status updates
  - Verify database has status entries

---

## Phase 4: Application Deployment (Day of Deployment)

### 4.1 Deploy Backend

**Option 1: Docker**
```bash
# Build image
docker build -t whatsapp-backend:latest .

# Push to registry
docker push your-registry/whatsapp-backend:latest

# Deploy to production
docker pull your-registry/whatsapp-backend:latest
docker run -d \
  --name whatsapp-backend \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://... \
  -e TWILIO_ACCOUNT_SID=... \
  -p 5000:5000 \
  your-registry/whatsapp-backend:latest
```

**Option 2: Traditional VPS**
```bash
cd /var/www/whatsapp-backend

# Pull latest code
git pull origin main

# Install dependencies
npm ci --production

# Run migrations
npx prisma migrate deploy

# Start service
pm2 restart whatsapp-backend || pm2 start ecosystem.config.js
```

**Option 3: Kubernetes**
```bash
# Apply deployment
kubectl apply -f k8s/whatsapp-backend-deployment.yaml

# Verify pods running
kubectl get pods -l app=whatsapp-backend
# Expected: 3+ pods in Running state

# Check logs
kubectl logs -f deployment/whatsapp-backend
```

- [ ] **Application Started**
  - Status code check: 200 OK
  - Health endpoint works
  - No errors in logs

- [ ] **Database Connected**
  ```bash
  # Check logs
  tail -f logs/app.log | grep -i "database\|connected"
  # Expected: "Database connected successfully"
  ```

- [ ] **Redis Connected**
  ```bash
  # Check logs
  tail -f logs/app.log | grep -i "redis"
  # Expected: "Redis connected"
  ```

### 4.2 Run Database Migrations

```bash
# Apply pending migrations
npx prisma migrate deploy

# Verify
npx prisma migrate status
# Expected: All migrations "applied"
```

- [ ] **Migrations Applied**
  - No errors
  - All tables created
  - Indexes created

### 4.3 Verify Application

- [ ] **Health Check Passes**
  ```bash
  curl -I https://api.yourdomain.com/api/v1/health
  # Expected: 200 OK
  ```

- [ ] **Webhook Endpoint Responds**
  ```bash
  curl -I https://api.yourdomain.com/api/v1/whatsapp/webhook
  # Expected: 200 OK or 403 (normal if no Twilio signature)
  ```

- [ ] **Status Endpoint Responds**
  ```bash
  curl -I https://api.yourdomain.com/api/v1/whatsapp/status
  # Expected: 200 OK
  ```

- [ ] **No Error Logs**
  ```bash
  tail -f logs/error.log
  # Expected: No recent entries (or only expected warnings)
  ```

---

## Phase 5: Testing & Validation (Day 1-2 of Deployment)

### 5.1 Send Test Messages

**Manual Testing:**

```bash
# Get JWT token first
curl -X POST https://api.yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com","password":"..."}'
# Copy the token

# Send test message
curl -X POST https://api.yourdomain.com/api/v1/whatsapp/send \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+your_verified_test_number",
    "message": "Production test message - delivery receipts tracking enabled"
  }'
```

- [ ] **Message Sent Successfully**
  - Response: `{ success: true, messageSid: "SM..." }`
  - Status: 200 OK

- [ ] **Message Received** (on your WhatsApp)
  - Physical message received on phone
  - Within 2-5 seconds

- [ ] **Status Callbacks Received**
  ```bash
  tail -f logs/app.log | grep "status\|delivery"
  # Expected: "queued" → "sending" → "sent" → "delivered"
  ```

- [ ] **Database Records Created**
  ```bash
  psql $DATABASE_URL
  
  SELECT * FROM "WhatsAppMessage" 
  ORDER BY "createdAt" DESC LIMIT 5;
  
  SELECT * FROM "MessageStatusLog" 
  ORDER BY "statusChangedAt" DESC LIMIT 5;
  ```

### 5.2 Test Error Handling

- [ ] **Invalid Phone Number**
  ```bash
  curl -X POST https://api.yourdomain.com/api/v1/whatsapp/send \
    -H "Authorization: Bearer YOUR_JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "to": "invalid",
      "message": "Test"
    }'
  # Expected: Error response, proper logging
  ```

- [ ] **Missing Authentication**
  ```bash
  curl -X POST https://api.yourdomain.com/api/v1/whatsapp/send
  # Expected: 401 Unauthorized
  ```

- [ ] **Rate Limiting Works**
  ```bash
  # Send 201 requests rapidly
  for i in {1..201}; do
    curl -X POST https://api.yourdomain.com/api/v1/whatsapp/webhook \
      -d '...' &
  done
  # Expected: Some requests get 429 Too Many Requests
  ```

### 5.3 Monitor Logs

- [ ] **Check for Errors**
  ```bash
  tail -100 logs/error.log
  # Expected: No unexpected errors
  ```

- [ ] **Check for Warnings**
  ```bash
  tail -100 logs/app.log | grep "WARN"
  # Expected: Only expected warnings
  ```

- [ ] **Check Response Times**
  ```bash
  tail -100 logs/app.log | grep "ms"
  # Expected: Most requests < 500ms
  ```

---

## Phase 6: Monitoring Setup (Week 1)

### 6.1 Logging

- [ ] **Logs Aggregation Setup**
  - Option 1: ELK Stack (Elasticsearch, Logstash, Kibana)
  - Option 2: CloudWatch (if AWS)
  - Option 3: Datadog
  - Option 4: Papertrail

```bash
# Verify logs are being sent
tail -f logs/app.log
```

### 6.2 Error Tracking

- [ ] **Sentry Configured** (recommended)
  - Account created at sentry.io
  - SENTRY_DSN added to .env
  - Test error sent:
  ```bash
  curl -X POST https://api.yourdomain.com/api/v1/test/error
  # Check Sentry dashboard for error
  ```

### 6.3 Metrics & Monitoring

- [ ] **Metrics Endpoint Available**
  ```bash
  curl https://api.yourdomain.com/metrics
  # Expected: Prometheus format metrics
  ```

- [ ] **Alerting Configured**
  - High error rate (>5% of requests)
  - Database connection failures
  - Redis disconnection
  - Webhook delivery failures

### 6.4 Uptime Monitoring

- [ ] **Uptime Monitor Setup**
  ```bash
  # Monitors.com, StatusPage, Pingdom, or similar
  Ping URL: https://api.yourdomain.com/api/v1/health
  Interval: 5 minutes
  Alert on: Failure or degraded performance
  ```

---

## Phase 7: Documentation & Handoff (Week 1)

### 7.1 Documentation Updated

- [ ] **README Updated**
  - Production setup instructions
  - Webhook configuration steps
  - Testing procedures

- [ ] **API Documentation Updated**
  - New endpoints documented
  - Status codes and responses
  - Error codes and meanings

- [ ] **Runbook Created**
  - Common issues and solutions
  - Emergency procedures
  - Contact information

- [ ] **Architecture Diagram Updated**
  - Shows webhook flow
  - Status callback flow
  - Queue system integration

### 7.2 Team Training

- [ ] **Developers Trained**
  - How to send WhatsApp messages
  - How to check delivery status
  - How to troubleshoot issues
  - How to handle failures

- [ ] **DevOps Trained**
  - How to restart application
  - How to check logs
  - How to scale if needed
  - How to rotate secrets

- [ ] **Support Team Trained**
  - Common user issues
  - How to check message status
  - When to escalate
  - How to communicate delays

### 7.3 Access Control

- [ ] **Production Access Limited**
  - Only authorized team members
  - SSH keys configured
  - MFA enabled
  - Audit logs enabled

- [ ] **Database Access Secured**
  - Connection only from app server
  - Read replicas for backups
  - Regular backups tested

---

## Phase 8: Cutover & Go-Live (Day 1)

### 8.1 Pre-Cutover Checklist

- [ ] **All previous phases complete**
- [ ] **Production database backed up**
- [ ] **Rollback plan documented**
- [ ] **Team members on standby**
- [ ] **Monitoring dashboards open**

### 8.2 Cutover Steps

1. **Gradual Traffic Shift** (if possible)
   - Route 10% of traffic to production
   - Monitor for 30 minutes
   - Route 50% of traffic
   - Monitor for 30 minutes
   - Route 100% of traffic

2. **Monitor Intensively**
   - Check logs every 2 minutes
   - Monitor error rate
   - Monitor response times
   - Monitor database connection pool

3. **Communication**
   - Notify stakeholders: "Going live"
   - Update status page: "Maintenance"
   - Be ready to communicate issues

### 8.3 Post-Cutover (First Hour)

- [ ] **Monitor Closely**
  - Error rate < 1%
  - Response time < 500ms
  - No database errors
  - Webhook status: OK

- [ ] **Run Smoke Tests**
  ```bash
  bash tests/smoke-tests.sh
  ```

- [ ] **Verify Features Work**
  - Send message: ✅
  - Receive status: ✅
  - Check delivery metrics: ✅

### 8.4 Post-Cutover (First Day)

- [ ] **Monitor Metrics**
  - Message delivery rate > 99%
  - Error rate < 1%
  - Average response time stable

- [ ] **Review Logs**
  - No unexpected errors
  - All webhooks processed
  - No security alerts

- [ ] **Communicate Success**
  - Notify team
  - Update documentation
  - Log learnings

---

## Phase 9: Post-Deployment (Week 2+)

### 9.1 Optimization

- [ ] **Performance Tuning**
  - Database query optimization
  - Redis memory optimization
  - Async processing verification
  - Queue throughput monitored

- [ ] **Cost Optimization**
  - Monitor Twilio costs
  - Check database usage
  - Verify queue efficiency

### 9.2 Ongoing Maintenance

- [ ] **Weekly Tasks**
  - Review error logs
  - Check delivery metrics
  - Monitor costs
  - Backup verification

- [ ] **Monthly Tasks**
  - Database maintenance
  - Dependency updates
  - Security reviews
  - Capacity planning

- [ ] **Quarterly Tasks**
  - Secret rotation
  - Disaster recovery test
  - Performance review
  - Compliance audit

### 9.3 Scaling Preparation

- [ ] **Monitor Resource Usage**
  ```bash
  # CPU, Memory, Network I/O
  ```

- [ ] **Identify Bottlenecks**
  - Database queries
  - Queue processing
  - External API calls

- [ ] **Plan for Scaling**
  - Horizontal scaling strategy
  - Database replication
  - Queue worker increase

---

## Emergency Procedures

### If Webhooks Stop Receiving Messages

```bash
# 1. Check application is running
curl https://api.yourdomain.com/api/v1/health

# 2. Check Twilio webhook URL
# Twilio Console → Messaging → WhatsApp Senders → Your Number
# Verify URL is correct and HTTPS works

# 3. Check application logs
tail -50 logs/error.log

# 4. Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# 5. Restart application
pm2 restart whatsapp-backend

# 6. If still failing, contact Twilio support
```

### If Messages Are Not Delivering

```bash
# 1. Check recipient phone number format
# Should be: +1234567890 (with country code)

# 2. Check message status in database
psql $DATABASE_URL
SELECT status, COUNT(*) FROM "WhatsAppMessage" 
GROUP BY status;

# 3. Check for errors
SELECT errorCode, errorMessage, COUNT(*) 
FROM "WhatsAppMessage" 
WHERE status = 'failed' 
GROUP BY errorCode, errorMessage;

# 4. Check Twilio account balance
# Twilio Console → Account Info → Balance

# 5. Contact Twilio support if account issue
```

### If Application Crashes

```bash
# 1. Check logs
tail -100 logs/error.log

# 2. Check system resources
free -h  # Memory
df -h    # Disk
top -b -n 1  # CPU

# 3. Restart application
pm2 restart whatsapp-backend

# 4. Restore from backup if data corruption
# (only if critical)

# 5. Escalate to DevOps team
```

---

## Success Criteria

✅ **Deployment is successful when:**

- [ ] All webhooks processed (no missed messages)
- [ ] Message delivery rate > 99%
- [ ] Status callbacks received for all messages
- [ ] Database records created for all messages
- [ ] Error rate < 1%
- [ ] Average response time < 500ms
- [ ] No data loss or corruption
- [ ] Application stability > 99.9%
- [ ] All monitoring working
- [ ] Team confident in system

---

## Rollback Plan

**If critical issues occur:**

```bash
# 1. Stop new deployments
git checkout main
git pull origin main

# 2. Restore previous version
docker pull your-registry/whatsapp-backend:previous
docker stop whatsapp-backend
docker run ... your-registry/whatsapp-backend:previous

# 3. Restore database if needed
# (from backup taken before deployment)

# 4. Verify restored version working
curl https://api.yourdomain.com/api/v1/health

# 5. Communicate rollback to stakeholders
# 6. Analyze what went wrong
# 7. Fix issues and prepare for re-deployment
```

---

**Last Updated**: January 22, 2026  
**Next Review**: January 29, 2026
