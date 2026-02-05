## Admin Retailer Dashboard - API Reference

**Complete guide for accessing retailer data via secure admin API**

---

## 🔐 Authentication

All endpoints require **API Key authentication** via `X-API-Key` header.

### Get API Key

```bash
# Generate API key (admin only)
POST /api/v1/admin/api-keys/generate
Headers: Authorization: Bearer <admin-jwt-token>
Body: {
  "scope": "admin",
  "expirationDays": 90
}

Response:
{
  "id": "key_123",
  "apiKey": "admin_xxxxxxxxxxxxx",  // Store securely!
  "scope": "admin",
  "expiresAt": "2026-04-20T00:00:00Z"
}
```

### Using API Key

```bash
# In request header
X-API-Key: admin_xxxxxxxxxxxxx

# Or as Bearer token
Authorization: Bearer admin_xxxxxxxxxxxxx
```

---

## 📊 Endpoints

### 1. Dashboard Summary

**GET** `/api/v1/admin/retailer-dashboard`

Get comprehensive dashboard for all or specific retailer(s).

**Query Parameters:**
```
retailerId    (optional) - Filter to specific retailer
startDate     (optional) - ISO format date (e.g., 2024-01-01)
endDate       (optional) - ISO format date (e.g., 2024-12-31)
```

**Example Request:**

```bash
curl -X GET "http://localhost:3000/api/v1/admin/retailer-dashboard" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

**Example Response:**

```json
{
  "success": true,
  "timestamp": "2026-01-19T10:30:00Z",
  "totals": {
    "totalRetailers": 45,
    "totalCreditBalance": 5250000,
    "totalOutstandingOrders": 128,
    "totalOutstandingAmount": 8750000,
    "totalPaymentsProcessed": 342,
    "activeRetailers": 42,
    "pausedRetailers": 3
  },
  "retailers": [
    {
      "retailer": {
        "id": "ret_001",
        "pasalName": "Shop A",
        "ownerName": "Ram Kumar",
        "phoneNumber": "+9779800000001",
        "email": "ram@shop.com",
        "city": "Kathmandu",
        "district": "Kathmandu",
        "creditStatus": "ACTIVE",
        "createdAt": "2025-06-01T00:00:00Z"
      },
      "creditBalance": 125000,
      "creditAccount": {
        "creditLimit": 500000,
        "usedCredit": 375000
      },
      "outstandingOrders": [
        {
          "id": "ord_001",
          "orderNumber": "ORD-001",
          "totalAmount": "50000",
          "status": "CONFIRMED",
          "createdAt": "2026-01-19T05:30:00Z"
        }
      ],
      "outstandingAmount": 125000,
      "paymentHistory": [
        {
          "id": "pmt_001",
          "amount": "100000",
          "status": "CLEARED",
          "createdAt": "2026-01-15T00:00:00Z"
        }
      ]
    }
  ]
}
```

---

### 2. All Retailers Overview

**GET** `/api/v1/admin/retailers/overview`

Get list of all retailers with credit status and utilization.

**Query Parameters:**
```
search        (optional) - Search by name, phone, email
creditStatus  (optional) - ACTIVE, PAUSED, INACTIVE
city          (optional) - Filter by city
limit         (optional) - Max results (default: 100)
skip          (optional) - Pagination offset (default: 0)
```

**Example Request:**

```bash
curl -X GET "http://localhost:3000/api/v1/admin/retailers/overview?creditStatus=ACTIVE&limit=50" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

**Example Response:**

```json
{
  "success": true,
  "pagination": {
    "skip": 0,
    "limit": 50,
    "total": 45,
    "hasMore": false
  },
  "totals": {
    "totalRetailers": 45,
    "activeRetailers": 42,
    "pausedRetailers": 3,
    "totalCreditAllocated": 22500000,
    "totalCreditUsed": 17250000
  },
  "retailers": [
    {
      "id": "ret_001",
      "pasalName": "Shop A",
      "ownerName": "Ram Kumar",
      "phoneNumber": "+9779800000001",
      "city": "Kathmandu",
      "creditStatus": "ACTIVE",
      "creditPausedAt": null,
      "createdAt": "2025-06-01T00:00:00Z",
      "credit": {
        "creditLimit": 500000,
        "usedCredit": 375000
      },
      "availableCredit": 125000,
      "utilizationRate": "75.00"
    }
  ]
}
```

---

### 3. Retailer Credit Balance

**GET** `/api/v1/admin/retailers/:retailerId/credit`

Get detailed credit account information for a retailer.

**Path Parameters:**
```
retailerId - Retailer ID (required)
```

**Example Request:**

```bash
curl -X GET "http://localhost:3000/api/v1/admin/retailers/ret_001/credit" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

**Example Response:**

```json
{
  "success": true,
  "retailer": {
    "id": "ret_001",
    "pasalName": "Shop A",
    "phoneNumber": "+9779800000001",
    "creditStatus": "ACTIVE",
    "creditPausedAt": null,
    "creditPauseReason": null
  },
  "mainAccount": {
    "creditLimit": 500000,
    "usedCredit": 375000,
    "availableCredit": 125000,
    "utilizationRate": "75.00",
    "maxOrderValue": 50000,
    "maxOutstandingDays": 30,
    "updatedAt": "2026-01-15T10:00:00Z"
  },
  "wholesalerCredits": [
    {
      "id": "rwc_001",
      "wholesalerId": "whl_001",
      "wholesaler": {
        "companyName": "Wholesaler ABC",
        "phoneNumber": "+9771234567"
      },
      "creditLimit": 250000,
      "creditTerms": 30,
      "interestRate": "0.00",
      "isActive": true,
      "blockedReason": null,
      "blockedAt": null,
      "updatedAt": "2026-01-15T10:00:00Z",
      "availableCredit": 175000
    },
    {
      "id": "rwc_002",
      "wholesalerId": "whl_002",
      "wholesaler": {
        "companyName": "Wholesaler XYZ",
        "phoneNumber": "+9779876543"
      },
      "creditLimit": 250000,
      "creditTerms": 30,
      "interestRate": "0.00",
      "isActive": true,
      "blockedReason": null,
      "blockedAt": null,
      "updatedAt": "2026-01-15T10:00:00Z",
      "availableCredit": 200000
    }
  ],
  "creditStatus": "ACTIVE",
  "creditPausedAt": null,
  "creditPauseReason": null
}
```

---

### 4. Outstanding Orders

**GET** `/api/v1/admin/retailers/:retailerId/orders`

Get all outstanding orders for a retailer.

**Path Parameters:**
```
retailerId - Retailer ID (required)
```

**Query Parameters:**
```
status    (optional) - CREATED, CONFIRMED, IN_TRANSIT, DELIVERED, FAILED
limit     (optional) - Max results (default: 50)
skip      (optional) - Pagination offset (default: 0)
```

**Example Request:**

```bash
curl -X GET "http://localhost:3000/api/v1/admin/retailers/ret_001/orders?status=CONFIRMED&limit=20" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

**Example Response:**

```json
{
  "success": true,
  "retailer": {
    "id": "ret_001",
    "pasalName": "Shop A"
  },
  "pagination": {
    "skip": 0,
    "limit": 20,
    "total": 8,
    "hasMore": false
  },
  "stats": {
    "total": 8,
    "byStatus": {
      "CREATED": 2,
      "CONFIRMED": 5,
      "IN_TRANSIT": 1
    },
    "totalAmount": 425000,
    "averageOrderAge": 3,
    "oldestOrderDays": 7
  },
  "orders": [
    {
      "id": "ord_001",
      "orderNumber": "ORD-001",
      "totalAmount": "50000",
      "paymentMode": "COD",
      "status": "CONFIRMED",
      "createdAt": "2026-01-19T05:30:00Z",
      "confirmedAt": "2026-01-19T06:00:00Z",
      "deliveredAt": null,
      "wholesaler": {
        "id": "whl_001",
        "companyName": "Wholesaler ABC",
        "phoneNumber": "+9771234567"
      },
      "itemCount": 3,
      "ageInDays": 0,
      "ageInHours": 5,
      "age": "0d 5h",
      "items": [
        {
          "id": "item_001",
          "productName": "Product A",
          "quantity": 10,
          "unitPrice": 5000
        }
      ]
    }
  ]
}
```

---

### 5. Payment History

**GET** `/api/v1/admin/retailers/:retailerId/payments`

Get payment history for a retailer.

**Path Parameters:**
```
retailerId - Retailer ID (required)
```

**Query Parameters:**
```
status    (optional) - PENDING, CLEARED, FAILED
startDate (optional) - ISO format date (e.g., 2024-01-01)
endDate   (optional) - ISO format date (e.g., 2024-12-31)
limit     (optional) - Max results (default: 50)
skip      (optional) - Pagination offset (default: 0)
```

**Example Request:**

```bash
curl -X GET "http://localhost:3000/api/v1/admin/retailers/ret_001/payments?status=PENDING" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

**Example Response:**

```json
{
  "success": true,
  "retailer": {
    "id": "ret_001",
    "pasalName": "Shop A"
  },
  "pagination": {
    "skip": 0,
    "limit": 50,
    "total": 15,
    "hasMore": false
  },
  "summary": {
    "total": 15,
    "totalAmount": 1500000,
    "byStatus": {
      "PENDING": 5,
      "CLEARED": 9,
      "FAILED": 1
    },
    "pendingAmount": 500000,
    "clearedAmount": 950000
  },
  "payments": [
    {
      "id": "pmt_001",
      "amount": "100000",
      "paymentMode": "CHEQUE",
      "status": "PENDING",
      "chequeNumber": "CHK123456",
      "chequeDate": "2026-01-20T00:00:00Z",
      "bankName": "Bank of Nepal",
      "clearedDate": null,
      "notes": "Payment for Jan orders",
      "recordedAt": "2026-01-19T10:30:00Z",
      "createdAt": "2026-01-19T10:30:00Z",
      "wholesaler": {
        "id": "whl_001",
        "companyName": "Wholesaler ABC",
        "phoneNumber": "+9771234567"
      },
      "ledgerEntry": {
        "entryType": "CREDIT",
        "orderId": "ord_001"
      },
      "daysOld": 0,
      "isPending": true,
      "isCleared": false,
      "isFailed": false,
      "clearancePending": "14 days"
    }
  ]
}
```

---

## 🔄 Example Workflows

### Workflow 1: Get Complete Retailer Status

```bash
# 1. Get retailer overview
curl -X GET "http://localhost:3000/api/v1/admin/retailers/overview?search=Shop" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"

# 2. Get specific retailer credit
curl -X GET "http://localhost:3000/api/v1/admin/retailers/ret_001/credit" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"

# 3. Get outstanding orders
curl -X GET "http://localhost:3000/api/v1/admin/retailers/ret_001/orders" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"

# 4. Get payment history
curl -X GET "http://localhost:3000/api/v1/admin/retailers/ret_001/payments" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

### Workflow 2: Monitor Credit Usage

```bash
# Get all retailers with high credit utilization
curl -X GET "http://localhost:3000/api/v1/admin/retailers/overview" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"

# Then check individual retailer credits
curl -X GET "http://localhost:3000/api/v1/admin/retailers/ret_001/credit" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

### Workflow 3: Track Pending Payments

```bash
# Get payments by status
curl -X GET "http://localhost:3000/api/v1/admin/retailers/ret_001/payments?status=PENDING" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"

# Filter by date range
curl -X GET "http://localhost:3000/api/v1/admin/retailers/ret_001/payments?startDate=2026-01-01&endDate=2026-01-31" \
  -H "X-API-Key: admin_xxxxxxxxxxxxx"
```

---

## 📱 Using in Node.js

```javascript
const axios = require('axios');

const API_KEY = 'admin_xxxxxxxxxxxxx';
const BASE_URL = 'http://localhost:3000/api/v1/admin';

// Initialize client
const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-API-Key': API_KEY
  }
});

// Get dashboard
async function getDashboard() {
  try {
    const response = await client.get('/retailer-dashboard');
    console.log('Dashboard:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}

// Get retailer credit
async function getRetailerCredit(retailerId) {
  try {
    const response = await client.get(`/retailers/${retailerId}/credit`);
    console.log('Credit:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}

// Get outstanding orders
async function getOutstandingOrders(retailerId) {
  try {
    const response = await client.get(`/retailers/${retailerId}/orders?status=CONFIRMED`);
    console.log('Orders:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}

// Get payment history
async function getPaymentHistory(retailerId) {
  try {
    const response = await client.get(`/retailers/${retailerId}/payments?status=PENDING`);
    console.log('Payments:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}
```

---

## 🛡️ Security Features

✅ **API Key Authentication** - X-API-Key header required  
✅ **Scope-Based Access** - Admin scope required for all endpoints  
✅ **Rate Limiting** - Requests are rate-limited  
✅ **Audit Logging** - All API requests logged  
✅ **Key Expiration** - Optional expiration dates  
✅ **Key Revocation** - Revoke compromised keys instantly  

---

## ❌ Error Responses

### 401 Unauthorized

```json
{
  "success": false,
  "error": "API key required"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "error": "Insufficient scope",
  "required": ["admin"],
  "current": "read_only"
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": "Retailer not found"
}
```

### 500 Server Error

```json
{
  "success": false,
  "error": "Failed to fetch dashboard"
}
```

---

## 📋 Response Fields Reference

### Retailer Object
```javascript
{
  id: string,           // Unique retailer ID
  pasalName: string,    // Shop name
  ownerName: string,    // Owner name
  phoneNumber: string,  // Primary phone
  email: string,        // Email address
  city: string,         // City name
  district: string,     // District (Nepal)
  creditStatus: enum,   // ACTIVE | PAUSED | INACTIVE
  createdAt: timestamp  // Registration date
}
```

### Order Object
```javascript
{
  id: string,
  orderNumber: string,
  totalAmount: decimal,
  paymentMode: enum,
  status: enum,
  ageInDays: number,
  itemCount: number,
  wholesaler: object,
  items: array
}
```

### Payment Object
```javascript
{
  id: string,
  amount: decimal,
  paymentMode: enum,
  status: enum,
  chequeNumber: string,
  clearedDate: timestamp,
  daysOld: number,
  clearancePending: string
}
```

---

## 🚀 Deployment

1. **Generate API Key:**
   ```bash
   # Via admin panel or API
   POST /api/v1/admin/api-keys/generate
   ```

2. **Store Securely:**
   ```bash
   # In environment variables
   ADMIN_API_KEY=admin_xxxxxxxxxxxxx
   ```

3. **Use in Requests:**
   ```bash
   curl -H "X-API-Key: $ADMIN_API_KEY" \
     http://your-domain.com/api/v1/admin/retailer-dashboard
   ```

---

## 📊 Use Cases

✅ **Daily Dashboard Review** - Check all retailer statuses  
✅ **Credit Monitoring** - Track credit utilization  
✅ **Order Management** - Monitor pending orders  
✅ **Payment Tracking** - Follow payment status  
✅ **Analytics** - Generate reports for management  
✅ **Integrations** - Build dashboards in external systems  

---

**Last Updated:** January 19, 2026  
**Version:** 1.0.0
