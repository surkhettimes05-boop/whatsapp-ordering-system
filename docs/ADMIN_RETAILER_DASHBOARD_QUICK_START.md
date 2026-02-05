## Admin Retailer Dashboard - Quick Start

**Get started with admin dashboard endpoints in 5 minutes**

---

## ⚡ Quick Setup

### Step 1: Generate API Key

```bash
# In admin panel or use your existing admin API key
# Format: X-API-Key header
```

### Step 2: Test Connection

```bash
curl -X GET "http://localhost:3000/api/v1/admin/retailer-dashboard" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

If successful, you'll see dashboard data!

---

## 🎯 Common Tasks

### View All Retailers

```bash
curl "http://localhost:3000/api/v1/admin/retailers/overview" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

**Shows:**
- Retailer names, phone, location
- Credit status (ACTIVE/PAUSED)
- Credit utilization percentage
- Total allocated credit across all retailers

---

### Check Retailer Credit Balance

```bash
curl "http://localhost:3000/api/v1/admin/retailers/ret_001/credit" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

**Returns:**
- Credit limit (main account + per-wholesaler)
- Used credit
- Available credit
- Wholesaler-specific credit details

---

### Get Outstanding Orders

```bash
curl "http://localhost:3000/api/v1/admin/retailers/ret_001/orders" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

**Shows:**
- All pending/confirmed/in-transit orders
- Order age (days/hours)
- Item count and total amount
- Wholesaler assigned
- Statistics (average age, oldest order)

---

### View Payment History

```bash
curl "http://localhost:3000/api/v1/admin/retailers/ret_001/payments" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

**Displays:**
- All payments (PENDING, CLEARED, FAILED)
- Payment method (cheque, cash, etc.)
- Days old / clearance pending
- Cheque details
- Payment summary

---

## 🔍 Filtering Examples

### Search Retailers by Name

```bash
curl "http://localhost:3000/api/v1/admin/retailers/overview?search=Shop" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

### Get Only Active Retailers

```bash
curl "http://localhost:3000/api/v1/admin/retailers/overview?creditStatus=ACTIVE" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

### Get Orders by Status

```bash
curl "http://localhost:3000/api/v1/admin/retailers/ret_001/orders?status=CONFIRMED" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

### Get Pending Payments

```bash
curl "http://localhost:3000/api/v1/admin/retailers/ret_001/payments?status=PENDING" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

### Filter by Date Range

```bash
curl "http://localhost:3000/api/v1/admin/retailers/ret_001/payments?startDate=2026-01-01&endDate=2026-01-31" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

---

## 📊 Dashboard Overview Endpoint

**Best for:** Getting complete summary of all retailers at once

```bash
curl "http://localhost:3000/api/v1/admin/retailer-dashboard" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

**Returns in one call:**
- Total retailers (active/paused)
- Total credit balance across all
- Total outstanding orders and amount
- Recent payments
- Individual retailer details

**Use for:**
- Executive dashboards
- System monitoring
- Quick status checks

---

## 💻 JavaScript Example

```javascript
const API_KEY = process.env.ADMIN_API_KEY;
const BASE_URL = 'http://localhost:3000/api/v1/admin';

// Get all retailers
async function getAllRetailers() {
  const res = await fetch(`${BASE_URL}/retailers/overview`, {
    headers: { 'X-API-Key': API_KEY }
  });
  return res.json();
}

// Get specific retailer details
async function getRetailerDetails(retailerId) {
  const [credit, orders, payments] = await Promise.all([
    fetch(`${BASE_URL}/retailers/${retailerId}/credit`, {
      headers: { 'X-API-Key': API_KEY }
    }).then(r => r.json()),
    
    fetch(`${BASE_URL}/retailers/${retailerId}/orders`, {
      headers: { 'X-API-Key': API_KEY }
    }).then(r => r.json()),
    
    fetch(`${BASE_URL}/retailers/${retailerId}/payments`, {
      headers: { 'X-API-Key': API_KEY }
    }).then(r => r.json())
  ]);
  
  return { credit, orders, payments };
}

// Usage
const retailers = await getAllRetailers();
console.log(`Found ${retailers.totals.totalRetailers} retailers`);

const details = await getRetailerDetails('ret_001');
console.log(`Credit balance: ${details.credit.mainAccount.availableCredit}`);
console.log(`Outstanding orders: ${details.orders.stats.total}`);
console.log(`Pending payments: ${details.payments.summary.pendingAmount}`);
```

---

## 🛠️ Postman Collection

**Import in Postman for easy testing:**

```json
{
  "info": {
    "name": "Admin Retailer Dashboard",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Dashboard Summary",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/v1/admin/retailer-dashboard",
        "header": [
          {
            "key": "X-API-Key",
            "value": "{{apiKey}}"
          }
        ]
      }
    },
    {
      "name": "All Retailers",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/v1/admin/retailers/overview?limit=50",
        "header": [
          {
            "key": "X-API-Key",
            "value": "{{apiKey}}"
          }
        ]
      }
    },
    {
      "name": "Retailer Credit",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/v1/admin/retailers/{{retailerId}}/credit",
        "header": [
          {
            "key": "X-API-Key",
            "value": "{{apiKey}}"
          }
        ]
      }
    },
    {
      "name": "Outstanding Orders",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/v1/admin/retailers/{{retailerId}}/orders",
        "header": [
          {
            "key": "X-API-Key",
            "value": "{{apiKey}}"
          }
        ]
      }
    },
    {
      "name": "Payment History",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/v1/admin/retailers/{{retailerId}}/payments",
        "header": [
          {
            "key": "X-API-Key",
            "value": "{{apiKey}}"
          }
        ]
      }
    }
  ]
}
```

---

## ✅ Endpoints Summary

| Endpoint | Purpose |
|----------|---------|
| `GET /retailer-dashboard` | Overall dashboard for all retailers |
| `GET /retailers/overview` | List all retailers with credit status |
| `GET /retailers/:id/credit` | Detailed credit account info |
| `GET /retailers/:id/orders` | Outstanding orders |
| `GET /retailers/:id/payments` | Payment history |

---

## 🔐 Security Checklist

✅ Use HTTPS in production  
✅ Store API key in secure environment variable  
✅ Never commit API key to git  
✅ Rotate API keys periodically  
✅ Use API key scopes (admin scope for these endpoints)  

---

## ⚠️ Common Issues

### "API key required" error

**Solution:** Ensure X-API-Key header is included in request

```bash
# ❌ Wrong
curl http://localhost:3000/api/v1/admin/retailers/overview

# ✅ Correct
curl http://localhost:3000/api/v1/admin/retailers/overview \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

### "Retailer not found"

**Solution:** Use correct retailer ID from overview endpoint

```bash
# First get retailer ID
curl http://localhost:3000/api/v1/admin/retailers/overview \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"

# Then use that ID
curl http://localhost:3000/api/v1/admin/retailers/ret_001/credit \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

### Empty results

**Solution:** Check filters and date ranges

```bash
# Get all (no filters)
curl http://localhost:3000/api/v1/admin/retailers/ret_001/orders \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"

# Or specify status
curl http://localhost:3000/api/v1/admin/retailers/ret_001/orders?status=CONFIRMED \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

---

## 📈 Sample Dashboard Panel

```
┌─ Admin Dashboard ───────────────────────────────┐
│                                                 │
│ Total Retailers: 45                            │
│ ├─ Active: 42                                 │
│ ├─ Paused: 3                                  │
│ └─ Total Credit Allocated: Rs. 22.5M          │
│                                                 │
│ Outstanding Orders: 128                        │
│ ├─ Total Amount: Rs. 8.75M                    │
│ └─ Average Age: 3 days                        │
│                                                 │
│ Payments                                       │
│ ├─ Pending: Rs. 2.5M                          │
│ ├─ Cleared: Rs. 15M                           │
│ └─ Failed: Rs. 0.5M                           │
│                                                 │
│ Top 5 Retailers by Credit Usage                │
│ 1. Shop A - 85% (Rs. 425K / Rs. 500K)        │
│ 2. Shop B - 78% (Rs. 390K / Rs. 500K)        │
│ 3. Shop C - 72% (Rs. 360K / Rs. 500K)        │
│ ...                                            │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🚀 Ready to Use!

1. **Get API Key** (if not already have one)
2. **Test endpoint** with curl command above
3. **Integrate** into your admin dashboard
4. **Monitor** retailers, credit, and payments

---

**For complete documentation, see:** `ADMIN_RETAILER_DASHBOARD_API.md`

**Questions?** Check the full API reference above.
