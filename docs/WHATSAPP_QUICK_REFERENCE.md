# WhatsApp Production Setup - Quick Reference

**Last Updated**: January 22, 2026

---

## 🚀 Quick Start (30 minutes)

### 1. Get Credentials from Twilio

```
Twilio Console (https://www.twilio.com/console)
├── Account Info
│   ├── Copy: TWILIO_ACCOUNT_SID
│   ├── Copy: TWILIO_AUTH_TOKEN
│   └── Note: Auth Token (keep it secret!)
├── Messaging → WhatsApp Senders
│   └── Your Business Number (whatsapp:+1234567890)
```

### 2. Update Environment (.env)

```bash
# Backend directory
cd backend

# Add to .env:
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_token_here
TWILIO_WHATSAPP_FROM=whatsapp:+1234567890
WEBHOOK_URL=https://api.yourdomain.com/api/v1/whatsapp/webhook
STATUS_CALLBACK_URL=https://api.yourdomain.com/api/v1/whatsapp/status
NODE_ENV=production
FORCE_TWILIO_VERIFY=true
```

### 3. Configure Webhook in Twilio

```
Twilio Console
→ Messaging → WhatsApp Senders → Your Number
→ Click Edit/Configure
→ Set these fields:

When a message comes in:
  URL: https://api.yourdomain.com/api/v1/whatsapp/webhook
  Method: POST
  ✅ Click Save

Status Callback:
  URL: https://api.yourdomain.com/api/v1/whatsapp/status
  Method: POST
  ✅ Click Save
```

### 4. Deploy & Restart

```bash
# Deploy code with new .env
git pull origin main
npm ci --production
npm run build
npx prisma migrate deploy
npm restart

# Verify webhook is working
curl https://api.yourdomain.com/api/v1/health
# Expected: 200 OK
```

### 5. Test Message Sending

```bash
# Get JWT token
curl -X POST https://api.yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com","password":"..."}'

# Copy the token from response

# Send test message
curl -X POST https://api.yourdomain.com/api/v1/whatsapp/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+your_verified_number",
    "message": "Production test!"
  }'

# Expected response:
# { "success": true, "messageSid": "SM...", "status": "queued" }
```

✅ **Done!** Your WhatsApp production is live.

---

## 📋 Configuration Reference

### Environment Variables (Required)

| Variable | Example | Notes |
|----------|---------|-------|
| `TWILIO_ACCOUNT_SID` | `ACxxxxxxxx` | From Twilio Console |
| `TWILIO_AUTH_TOKEN` | `abc123...` | ⚠️ Keep secret! 64 chars |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+1234567890` | Verified business number |
| `WEBHOOK_URL` | `https://api.yourdomain.com/api/v1/whatsapp/webhook` | MUST match Twilio exactly |
| `STATUS_CALLBACK_URL` | `https://api.yourdomain.com/api/v1/whatsapp/status` | For delivery receipts |
| `NODE_ENV` | `production` | For security checks |

### Twilio Error Codes (Common)

| Code | Meaning | Solution |
|------|---------|----------|
| `30003` | Invalid recipient | Check phone number format (include country code) |
| `30004` | Rate limit exceeded | Slow down message sending |
| `30005` | SMS throughput limit | Upgrade Twilio account |
| `21614` | Invalid phone number | Verify number format |
| `21612` | Invalid From number | Check TWILIO_WHATSAPP_FROM |

### Message Status Values

```
queued     → accepted     → sending     → sent     → delivered     → read
                                          ↓
                                        failed (with errorCode)
                                        undelivered (with errorCode)
```

---

## 🔧 Common Tasks

### Send Message Programmatically

```javascript
const whatsappService = require('./src/services/whatsapp.service');

const result = await whatsappService.sendWhatsAppMessage(
  '+1234567890',
  'Hello from production!',
  { immediate: false } // Use queue
);

console.log(result.messageSid); // Track this message
```

### Check Message Status

```bash
curl https://api.yourdomain.com/api/v1/whatsapp/delivery-status/SM1234567890 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response:
# {
#   "messageSid": "SM1234567890",
#   "status": "delivered",
#   "timestamps": {
#     "sent": "2026-01-22T10:00:00Z",
#     "delivered": "2026-01-22T10:00:05Z"
#   },
#   "metrics": {
#     "deliveryTimeMs": 5000
#   }
# }
```

### Get Delivery Metrics

```bash
curl https://api.yourdomain.com/api/v1/whatsapp/delivery-metrics \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response shows:
# - Total messages sent
# - Delivery rate (%)
# - Read rate (%)
# - Failure rate (%)
# - Average delivery time
```

### Rotate Secrets

**Schedule: Quarterly (every 90 days)**

```bash
# 1. Generate new token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. In Twilio Console:
#    Account Info → Generate New Auth Token

# 3. Update .env:
#    TWILIO_AUTH_TOKEN=new_token_here

# 4. Restart application:
#    npm restart

# 5. Test:
#    curl https://api.yourdomain.com/api/v1/health

# 6. In Twilio Console:
#    Account Info → Revoke old token
```

### Retry Failed Messages

```bash
# Check failed messages
psql $DATABASE_URL
SELECT * FROM "WhatsAppMessage" 
WHERE status = 'failed' 
ORDER BY "createdAt" DESC 
LIMIT 10;

# Retry them
curl -X POST https://api.yourdomain.com/api/v1/whatsapp/retry \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response shows retry count
```

---

## 🐛 Troubleshooting

### "Invalid Signature" Error

**Problem**: Webhook signature validation failing

**Solution**:
```bash
# 1. Check WEBHOOK_URL in .env matches Twilio exactly
echo $WEBHOOK_URL

# 2. Verify in Twilio Console - must match character-for-character
# Messaging → WhatsApp Senders → Your Number → Webhook URL

# 3. Restart app
npm restart

# 4. Test webhook
curl https://api.yourdomain.com/api/v1/whatsapp/webhook
```

### No Messages Received

**Problem**: Webhook not receiving incoming messages

**Solution**:
```bash
# 1. Verify webhook URL is set in Twilio
# Twilio Console → Messaging → WhatsApp Senders → Your Number
# "When a message comes in" field should have your URL

# 2. Test webhook accessibility
curl -I https://api.yourdomain.com/api/v1/whatsapp/webhook
# Should return 200 or 403 (not 404 or timeout)

# 3. Check application is running
curl https://api.yourdomain.com/api/v1/health
# Should return 200

# 4. Check logs for errors
tail -100 logs/error.log

# 5. Send test message from WhatsApp
# Wait 30 seconds and check logs:
tail -100 logs/app.log | grep -i "webhook\|message"
```

### Messages Not Delivering

**Problem**: Messages show status "failed"

**Solution**:
```bash
# 1. Check error code
psql $DATABASE_URL
SELECT errorCode, COUNT(*) FROM "WhatsAppMessage" 
WHERE status = 'failed' 
GROUP BY errorCode;

# 2. For error 30003 (invalid recipient):
#    - Verify phone number has country code
#    - Format should be: +1234567890 (not 1234567890)

# 3. For error 30005 (throughput limit):
#    - Upgrade Twilio account for higher limits
#    - Or reduce message rate

# 4. Check Twilio account balance
#    Twilio Console → Billing
```

### High Latency

**Problem**: Messages taking too long to deliver

**Solution**:
```bash
# 1. Check message queue
redis-cli
> LLEN bull:whatsapp:queued
> LRANGE bull:whatsapp:queued 0 5

# 2. Check database performance
EXPLAIN ANALYZE SELECT * FROM "WhatsAppMessage" 
WHERE status = 'queued' 
LIMIT 10;

# 3. Check application server load
top -b -n 1 | head -20
# CPU usage should be < 80%
# Memory usage should be < 80%

# 4. If queue building up, increase workers:
#    Update .env: WHATSAPP_WORKERS=10
#    npm restart

# 5. Check network latency to Twilio
#    ping -c 5 twilio.com
```

### Database Errors

**Problem**: Database connection errors in logs

**Solution**:
```bash
# 1. Check database is running
psql $DATABASE_URL -c "SELECT 1;"
# Should return: 1

# 2. Check connection string
echo $DATABASE_URL

# 3. Check database user permissions
psql $DATABASE_URL -c "\dt"
# Should list tables

# 4. Increase connection pool if under load:
#    Update .env: 
#    DATABASE_POOL_MIN=10
#    DATABASE_POOL_MAX=50

# 5. Restart application
npm restart
```

---

## 📊 Monitoring Dashboard

### Create a Basic Monitoring Script

```javascript
// monitor.js
const axios = require('axios');

async function checkProduction() {
  const checks = {
    health: 'https://api.yourdomain.com/api/v1/health',
    webhook: 'https://api.yourdomain.com/api/v1/whatsapp/webhook',
    metrics: 'https://api.yourdomain.com/api/v1/whatsapp/delivery-metrics',
  };

  console.log('🔍 Production Health Check\n');

  for (const [name, url] of Object.entries(checks)) {
    try {
      const response = await axios.get(url, { timeout: 5000 });
      console.log(`✅ ${name}: ${response.status}`);
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
    }
  }
}

checkProduction();
```

Run: `node monitor.js`

### Alert Thresholds

Set alerts for:
- Error rate > 5%
- Response time > 1000ms
- Failed messages > 10%
- Database connection errors > 0
- Webhook timeout > 3 consecutive

---

## 🔐 Security Checklist

- [ ] HTTPS certificate valid
- [ ] TWILIO_AUTH_TOKEN kept secret
- [ ] .env file not in Git
- [ ] SSH keys configured for server access
- [ ] Database password changed from default
- [ ] Firewall rules configured (port 443 open)
- [ ] Rate limiting enabled
- [ ] IP allowlist configured (if possible)
- [ ] Logs monitored for suspicious activity
- [ ] Backups encrypted and tested
- [ ] Secret rotation scheduled (quarterly)

---

## 📞 Support Contacts

- **Twilio Support**: https://www.twilio.com/console/support
- **API Docs**: https://www.twilio.com/docs/whatsapp
- **Status Page**: https://status.twilio.com
- **Error Codes**: https://www.twilio.com/docs/api/errors
- **Your Team**: [Internal contacts]

---

## 📈 Next Steps

**Week 1**:
- [x] Deploy to production
- [ ] Monitor closely (24/7)
- [ ] Fix any issues
- [ ] Optimize performance

**Week 2-4**:
- [ ] Gather usage data
- [ ] Optimize costs
- [ ] Fine-tune error handling
- [ ] Scale if needed

**Month 2+**:
- [ ] Plan scaling strategy
- [ ] Disaster recovery test
- [ ] Quarterly secret rotation
- [ ] Performance review

---

**Questions?** See [WHATSAPP_PRODUCTION_SETUP_GUIDE.md](WHATSAPP_PRODUCTION_SETUP_GUIDE.md) for detailed information.
