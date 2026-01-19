## Admin Dashboard - Quick Reference Card

**One-page reference for admin dashboard endpoints**

---

## 🚀 Quick Start

```bash
# 1. Generate API key
curl -X POST "/api/v1/admin/api-keys/generate" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"scope":"admin","expirationDays":90}'

# 2. Test endpoint
curl "http://localhost:3000/api/v1/admin/retailer-dashboard" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"

# 3. Run test suite
node test-admin-dashboard.js --api-key admin_xxxxxxxxxxxxx
```

---

## 📋 5 Endpoints at a Glance

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/retailer-dashboard` | GET | Dashboard summary all retailers |
| `/retailers/overview` | GET | List all retailers |
| `/retailers/:id/credit` | GET | Credit balance details |
| `/retailers/:id/orders` | GET | Outstanding orders |
| `/retailers/:id/payments` | GET | Payment history |

---

## 🔗 URL Patterns

```
Base: http://localhost:3000/api/v1/admin

Dashboard:
  GET /retailer-dashboard

Retailers:
  GET /retailers/overview?creditStatus=ACTIVE&limit=50
  GET /retailers/overview?search=shop&city=Kathmandu

Retailer Details:
  GET /retailers/ret_001/credit
  GET /retailers/ret_001/orders?status=CONFIRMED
  GET /retailers/ret_001/payments?status=PENDING&startDate=2026-01-01
```

---

## 🔑 Authentication

**Header:**
```
X-API-Key: admin_xxxxxxxxxxxxx
```

**Or:**
```
Authorization: Bearer admin_xxxxxxxxxxxxx
```

---

## 📊 Response Examples

### Dashboard
```json
{
  "totals": {
    "totalRetailers": 45,
    "activeRetailers": 42,
    "totalCreditBalance": 22500000,
    "totalOutstandingOrders": 128,
    "totalOutstandingAmount": 8750000
  }
}
```

### Retailers
```json
{
  "totals": {
    "totalRetailers": 45,
    "activeRetailers": 42
  },
  "retailers": [
    {
      "pasalName": "Shop A",
      "creditStatus": "ACTIVE",
      "utilizationRate": "75.00",
      "availableCredit": 125000
    }
  ]
}
```

### Credit
```json
{
  "mainAccount": {
    "creditLimit": 500000,
    "usedCredit": 375000,
    "availableCredit": 125000,
    "utilizationRate": "75.00"
  },
  "wholesalerCredits": [
    {
      "wholesalerId": "whl_001",
      "creditLimit": 250000,
      "isActive": true
    }
  ]
}
```

### Orders
```json
{
  "stats": {
    "total": 8,
    "totalAmount": 425000,
    "byStatus": { "CREATED": 2, "CONFIRMED": 5, "IN_TRANSIT": 1 },
    "averageOrderAge": 3
  },
  "orders": [
    {
      "orderNumber": "ORD-001",
      "totalAmount": "50000",
      "status": "CONFIRMED",
      "age": "0d 5h"
    }
  ]
}
```

### Payments
```json
{
  "summary": {
    "total": 15,
    "totalAmount": 1500000,
    "byStatus": { "PENDING": 5, "CLEARED": 9, "FAILED": 1 },
    "pendingAmount": 500000
  },
  "payments": [
    {
      "amount": "100000",
      "status": "PENDING",
      "paymentMode": "CHEQUE",
      "clearancePending": "14 days"
    }
  ]
}
```

---

## ⚡ Common Queries

### Get all active retailers
```bash
curl "http://localhost:3000/api/v1/admin/retailers/overview?creditStatus=ACTIVE" \
  -H "X-API-Key: admin_key"
```

### Search retailer by name
```bash
curl "http://localhost:3000/api/v1/admin/retailers/overview?search=Shop" \
  -H "X-API-Key: admin_key"
```

### Get pending orders
```bash
curl "http://localhost:3000/api/v1/admin/retailers/ret_001/orders?status=CONFIRMED" \
  -H "X-API-Key: admin_key"
```

### Get pending payments
```bash
curl "http://localhost:3000/api/v1/admin/retailers/ret_001/payments?status=PENDING" \
  -H "X-API-Key: admin_key"
```

### Get payments in date range
```bash
curl "http://localhost:3000/api/v1/admin/retailers/ret_001/payments?startDate=2026-01-01&endDate=2026-01-31" \
  -H "X-API-Key: admin_key"
```

---

## 🔍 Query Parameters

### Pagination
```
limit=50    # Max results (default: 50-100)
skip=0      # Offset (default: 0)
```

### Filtering
```
status=CONFIRMED          # Order/payment status
creditStatus=ACTIVE       # Retailer credit status
search=shop              # Search query
city=Kathmandu           # City filter
```

### Date Range
```
startDate=2026-01-01     # ISO format
endDate=2026-12-31       # ISO format
```

---

## 🛠️ Code Snippets

### JavaScript Fetch
```javascript
const API_KEY = 'admin_xxxxxxxxxxxxx';

async function getRetailerCredit(retailerId) {
  const res = await fetch(
    `/api/v1/admin/retailers/${retailerId}/credit`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  return res.json();
}
```

### Axios
```javascript
const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1/admin',
  headers: { 'X-API-Key': API_KEY }
});

const dashboard = await api.get('/retailer-dashboard');
console.log(dashboard.data.totals);
```

### cURL
```bash
#!/bin/bash
API_KEY="admin_xxxxxxxxxxxxx"

# Get dashboard
curl -H "X-API-Key: $API_KEY" \
  http://localhost:3000/api/v1/admin/retailer-dashboard | jq
```

---

## ❌ Error Responses

| Status | Error |
|--------|-------|
| 401 | API key required / Invalid key |
| 403 | Insufficient scope |
| 404 | Retailer not found |
| 500 | Server error |

### Example Error
```json
{
  "success": false,
  "error": "Retailer not found"
}
```

---

## ✅ Common Tasks

**Monitor credit usage:**
```bash
curl /retailers/overview | jq '.retailers[] | select(.utilizationRate > "80")'
```

**Find high-value orders:**
```bash
curl /retailers/ret_001/orders | jq '.orders[] | select(.totalAmount > 100000)'
```

**Check pending payments:**
```bash
curl /retailers/ret_001/payments?status=PENDING | jq '.summary.pendingAmount'
```

**Get dashboard summary:**
```bash
curl /retailer-dashboard | jq '.totals'
```

---

## 🔐 Security Tips

✅ Never commit API key to git  
✅ Store in .env file  
✅ Use environment variables in production  
✅ Rotate keys regularly  
✅ Use HTTPS only  
✅ Include in gitignore  

```bash
# .gitignore
.env
.env.local
config/admin-keys.js
```

---

## 📞 Documentation Links

| Document | Purpose |
|----------|---------|
| `ADMIN_RETAILER_DASHBOARD_API.md` | Complete reference |
| `ADMIN_RETAILER_DASHBOARD_QUICK_START.md` | Getting started |
| `ADMIN_DASHBOARD_SETUP_GUIDE.md` | Deployment |
| `test-admin-dashboard.js` | Test utility |

---

## 🧪 Testing Command

```bash
# Run all tests
node test-admin-dashboard.js --api-key admin_xxxxxxxxxxxxx

# With verbose output
node test-admin-dashboard.js --api-key admin_xxxxxxxxxxxxx --verbose

# Against specific URL
node test-admin-dashboard.js --api-key admin_key --url https://api.example.com
```

---

## 🚀 Deployment

```bash
# 1. Set environment variable
export ADMIN_API_KEY=admin_xxxxxxxxxxxxx

# 2. Deploy code
npm run deploy

# 3. Test health
curl -H "X-API-Key: $ADMIN_API_KEY" \
  https://api.yourdomain.com/api/v1/admin/retailer-dashboard
```

---

## 📊 Files

| File | Lines | Purpose |
|------|-------|---------|
| Controller | 650+ | Business logic |
| Routes | 180+ | Endpoint definitions |
| API Docs | 2000+ | Complete reference |
| Quick Start | 300+ | Getting started |
| Setup Guide | 500+ | Deployment |
| Test Utility | 500+ | Testing |

---

## 🎯 Next Steps

1. ✅ Generate API key
2. ✅ Test endpoints
3. ✅ Build dashboard UI
4. ✅ Integrate in app
5. ✅ Set up monitoring

---

**Print this card for quick reference!**

For full documentation, see `ADMIN_RETAILER_DASHBOARD_API.md`
