## Admin Dashboard - Environment & Setup Guide

**Configure and deploy the admin dashboard endpoints**

---

## 🔑 API Key Setup

### Generate Admin API Key

The dashboard endpoints require an API key. Generate one using the API:

```bash
# Using curl
curl -X POST "http://localhost:3000/api/v1/admin/api-keys/generate" \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "admin",
    "expirationDays": 90
  }'

# Response:
{
  "id": "key_abc123xyz",
  "apiKey": "admin_xxxxxxxxxxxx",
  "scope": "admin",
  "expiresAt": "2026-04-20T00:00:00Z",
  "createdAt": "2026-01-19T00:00:00Z"
}
```

### Store Securely

Save the API key in your environment:

**Option 1: Environment Variable**
```bash
# .env
ADMIN_API_KEY=admin_xxxxxxxxxxxx
```

**Option 2: Secrets Manager (Production)**
```bash
# AWS Secrets Manager
aws secretsmanager create-secret \
  --name admin/api-key \
  --secret-string admin_xxxxxxxxxxxx

# Google Secret Manager
gcloud secrets create admin-api-key \
  --data-file=- <<< "admin_xxxxxxxxxxxx"

# HashiCorp Vault
vault kv put secret/admin api_key=admin_xxxxxxxxxxxx
```

**Option 3: Configuration File**
```javascript
// config/admin-keys.js
module.exports = {
  apiKey: process.env.ADMIN_API_KEY,
  baseUrl: process.env.API_BASE_URL || 'http://localhost:3000'
};
```

---

## 🚀 Local Development Setup

### 1. Start Backend

```bash
cd backend
npm install
npm run dev
```

### 2. Generate API Key

```bash
# Via admin panel or API (as shown above)
# Store in .env
ADMIN_API_KEY=admin_xxxxxxxxxxxx
```

### 3. Test Endpoints

```bash
# Test dashboard
curl "http://localhost:3000/api/v1/admin/retailer-dashboard" \
  -H "X-API-Key: admin_xxxxxxxxxxxx"

# Or run test suite
node test-admin-dashboard.js --api-key admin_xxxxxxxxxxxx
```

### 4. Build Frontend Dashboard

**Option 1: React Dashboard**
```javascript
// src/pages/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const apiKey = process.env.REACT_APP_ADMIN_API_KEY;

  useEffect(() => {
    fetch('/api/v1/admin/retailer-dashboard', {
      headers: { 'X-API-Key': apiKey }
    })
    .then(r => r.json())
    .then(data => setDashboard(data));
  }, []);

  if (!dashboard) return <div>Loading...</div>;

  return (
    <div className="dashboard">
      <h1>Admin Dashboard</h1>
      <div className="stats">
        <div className="card">
          <h3>Total Retailers</h3>
          <p className="number">{dashboard.totals.totalRetailers}</p>
        </div>
        <div className="card">
          <h3>Active</h3>
          <p className="number">{dashboard.totals.activeRetailers}</p>
        </div>
        <div className="card">
          <h3>Credit Balance</h3>
          <p className="number">Rs. {dashboard.totals.totalCreditBalance}</p>
        </div>
        <div className="card">
          <h3>Outstanding Orders</h3>
          <p className="number">{dashboard.totals.totalOutstandingOrders}</p>
        </div>
      </div>
    </div>
  );
}
```

**Option 2: Vue.js Dashboard**
```javascript
// src/components/AdminDashboard.vue
<template>
  <div class="dashboard">
    <h1>Admin Dashboard</h1>
    <div v-if="dashboard" class="stats">
      <div class="card">
        <h3>Total Retailers</h3>
        <p class="number">{{ dashboard.totals.totalRetailers }}</p>
      </div>
      <div class="card">
        <h3>Active</h3>
        <p class="number">{{ dashboard.totals.activeRetailers }}</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return { dashboard: null };
  },
  mounted() {
    const apiKey = process.env.VUE_APP_ADMIN_API_KEY;
    fetch('/api/v1/admin/retailer-dashboard', {
      headers: { 'X-API-Key': apiKey }
    })
    .then(r => r.json())
    .then(data => this.dashboard = data);
  }
};
</script>
```

---

## 🌐 Production Deployment

### 1. Set Up Environment Variables

**Railway/Render:**
```
ADMIN_API_KEY=admin_xxxxxxxxxxxx
NODE_ENV=production
API_BASE_URL=https://api.yourdomain.com
```

**Docker:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy files
COPY . .

# Install dependencies
RUN npm ci

# Set environment variables
ENV ADMIN_API_KEY=${ADMIN_API_KEY}
ENV NODE_ENV=production

# Start server
CMD ["npm", "start"]
```

### 2. Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Admin dashboard routes
    location /api/v1/admin/retailer-dashboard {
        proxy_pass http://localhost:3000;
        proxy_set_header X-API-Key $http_x_api_key;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        
        # Rate limiting
        limit_req zone=admin burst=10 nodelay;
    }

    location /api/v1/admin/retailers {
        proxy_pass http://localhost:3000;
        proxy_set_header X-API-Key $http_x_api_key;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        
        limit_req zone=admin burst=20 nodelay;
    }
}

# Define rate limiting zones
limit_req_zone $http_x_api_key zone=admin:10m rate=10r/s;
```

### 3. Database Optimization

Ensure database indexes are created:

```bash
# Run migrations (if needed)
npx prisma migrate deploy

# Verify indexes exist
npx prisma db execute << 'EOF'
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('retailers', 'orders', 'retailer_payments', 'credit_accounts')
ORDER BY indexname;
EOF
```

### 4. Monitoring & Logging

**Add monitoring to logs:**
```javascript
// src/middleware/admin-dashboard-logger.middleware.js
const logger = require('../config/winston-logger').getLogger('admin-dashboard');

function logDashboardAccess(req, res, next) {
  const originalJson = res.json;
  
  res.json = function(data) {
    const duration = Date.now() - req.startTime;
    
    logger.info('Admin dashboard request', {
      endpoint: req.path,
      apiKeyId: req.apiKey?.id,
      duration: `${duration}ms`,
      status: res.statusCode,
      resultsCount: data?.retailers?.length || 0
    });
    
    return originalJson.call(this, data);
  };
  
  req.startTime = Date.now();
  next();
}

module.exports = logDashboardAccess;
```

---

## 🔒 Security Best Practices

### API Key Security

✅ **Rotate Keys Regularly**
```bash
# Generate new key
curl -X POST "/api/v1/admin/api-keys/generate" ...

# Revoke old key
curl -X DELETE "/api/v1/admin/api-keys/{keyId}" ...

# Update .env with new key
```

✅ **Never Commit API Keys**
```bash
# .gitignore
.env
.env.local
.env*.local
config/admin-keys.js
```

✅ **Use HTTPS Only**
```javascript
// Enforce HTTPS in production
if (process.env.NODE_ENV === 'production' && !req.secure) {
  return res.redirect(`https://${req.host}${req.url}`);
}
```

✅ **Add Rate Limiting**
```javascript
const rateLimit = require('express-rate-limit');

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max requests per window
  keyGenerator: (req) => req.apiKey?.id || req.ip
});

router.use(adminLimiter);
```

✅ **Log All Access**
```javascript
// Every API call logged with timestamp, key ID, endpoint
logger.info('Admin API access', {
  endpoint: req.path,
  method: req.method,
  apiKeyId: req.apiKey?.id,
  timestamp: new Date(),
  queryParams: req.query,
  responseTime: duration
});
```

---

## 📊 Integration Examples

### Integration with Grafana

```javascript
// src/integrations/grafana.js
const axios = require('axios');

const API_KEY = process.env.ADMIN_API_KEY;
const API_URL = process.env.API_BASE_URL;
const GRAFANA_URL = process.env.GRAFANA_URL;

async function pushMetricsToGrafana() {
  const response = await axios.get(`${API_URL}/api/v1/admin/retailer-dashboard`, {
    headers: { 'X-API-Key': API_KEY }
  });

  const metrics = {
    totalRetailers: response.data.totals.totalRetailers,
    activeRetailers: response.data.totals.activeRetailers,
    totalCreditBalance: response.data.totals.totalCreditBalance,
    outstandingOrders: response.data.totals.totalOutstandingOrders,
    timestamp: Date.now()
  };

  // Push to Grafana Loki
  await axios.post(`${GRAFANA_URL}/loki/api/v1/push`, {
    streams: [{
      stream: { job: 'admin-dashboard' },
      values: [[String(Date.now() * 1000000), JSON.stringify(metrics)]]
    }]
  });
}

setInterval(pushMetricsToGrafana, 60000); // Every minute
```

### Integration with Slack

```javascript
// src/integrations/slack.js
const { WebClient } = require('@slack/web-api');
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

async function sendDashboardSummary() {
  const response = await fetch(`${API_URL}/api/v1/admin/retailer-dashboard`, {
    headers: { 'X-API-Key': API_KEY }
  });
  const dashboard = await response.json();

  await slack.chat.postMessage({
    channel: '#admin-alerts',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Daily Dashboard Summary' }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Total Retailers:*\n${dashboard.totals.totalRetailers}`
          },
          {
            type: 'mrkdwn',
            text: `*Active:*\n${dashboard.totals.activeRetailers}`
          },
          {
            type: 'mrkdwn',
            text: `*Credit Balance:*\nRs. ${dashboard.totals.totalCreditBalance}`
          },
          {
            type: 'mrkdwn',
            text: `*Outstanding Orders:*\n${dashboard.totals.totalOutstandingOrders}`
          }
        ]
      }
    ]
  });
}

// Send daily at 9 AM
const schedule = require('node-schedule');
schedule.scheduleJob('0 9 * * *', sendDashboardSummary);
```

### Integration with Google Sheets

```javascript
// src/integrations/google-sheets.js
const { google } = require('googleapis');

const sheets = google.sheets('v4');
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

async function syncToGoogleSheets() {
  const response = await fetch(`${API_URL}/api/v1/admin/retailers/overview`, {
    headers: { 'X-API-Key': API_KEY }
  });
  const data = await response.json();

  const values = data.retailers.map(r => [
    r.pasalName,
    r.phoneNumber,
    r.city,
    r.creditStatus,
    r.availableCredit,
    r.utilizationRate
  ]);

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Retailers!A2',
    valueInputOption: 'RAW',
    resource: { values }
  });
}

// Sync every hour
setInterval(syncToGoogleSheets, 3600000);
```

---

## 🧪 Testing in Production

### Health Check

```bash
curl -X GET "https://api.yourdomain.com/api/v1/admin/retailer-dashboard" \
  -H "X-API-Key: $ADMIN_API_KEY" \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n"
```

### Load Testing

```bash
# Using Apache Bench
ab -n 1000 -c 10 \
  -H "X-API-Key: $ADMIN_API_KEY" \
  https://api.yourdomain.com/api/v1/admin/retailers/overview

# Using wrk
wrk -t12 -c400 -d30s \
  -H "X-API-Key: $ADMIN_API_KEY" \
  https://api.yourdomain.com/api/v1/admin/retailers/overview
```

---

## 📋 Deployment Checklist

**Pre-Deployment:**
- [ ] API key generated and stored securely
- [ ] Environment variables configured
- [ ] HTTPS enabled
- [ ] Rate limiting configured
- [ ] Monitoring set up
- [ ] Logging configured
- [ ] Database indexes verified

**Post-Deployment:**
- [ ] Health check passing
- [ ] API key validated
- [ ] All endpoints tested
- [ ] Performance acceptable
- [ ] Errors monitored
- [ ] Logs appearing
- [ ] Alerts configured

---

## 🆘 Troubleshooting

### API Key Not Working

```bash
# Check key is active
curl -X GET "/api/v1/admin/api-keys/{keyId}" \
  -H "Authorization: Bearer <admin-jwt-token>"

# Regenerate if expired
curl -X POST "/api/v1/admin/api-keys/generate" \
  -H "Authorization: Bearer <admin-jwt-token>"
```

### Slow Queries

```bash
# Check database indexes
EXPLAIN ANALYZE
SELECT * FROM retailers WHERE credit_status = 'ACTIVE';

# Verify indexes exist
\d retailers
```

### Rate Limit Issues

```bash
# Increase rate limit in nginx
limit_req_zone $http_x_api_key zone=admin:10m rate=20r/s;
```

---

## 📞 Support

For issues or questions:
1. Check logs: `tail -f logs/admin-dashboard.log`
2. Review docs: `ADMIN_RETAILER_DASHBOARD_API.md`
3. Run tests: `node test-admin-dashboard.js --api-key $KEY`
4. Debug query: Use verbose flag `--verbose`

---

**Last Updated:** January 19, 2026  
**Version:** 1.0.0
