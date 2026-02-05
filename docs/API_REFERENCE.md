# Quick Reference: API Endpoints

## Authentication
All endpoints require: `Authorization: Bearer <JWT_TOKEN>`

---

## Feature 1: Risk Dashboard

### Get System-Wide Risk
```
GET /api/v1/admin/credit/risk-dashboard

Response:
{
  "summary": {
    "0-7": 25000,
    "8-14": 12000,
    "15-30": 8000,
    "30+": 45000,
    "totalOutstanding": 90000,
    "retailerCount": 150,
    "highRiskCount": 8
  },
  "retailerRisks": [ ... ],
  "atRiskRetailers": [ ... ]
}
```

### Get Retailer Profile
```
GET /api/v1/admin/credit/retailer/:retailerId

Response:
{
  "retailerId": "ret_123",
  "pasalName": "Kumar Shop",
  "creditLimit": 100000,
  "usedCredit": 45000,
  "availableCredit": 55000,
  "outstandingSummary": { "0-7": 0, "8-14": 5000, ... },
  "totalOutstandingDays": 12,
  "transactionHistory": [ ... ]
}
```

---

## Feature 3: Credit Pause/Unpause

### Pause Credit
```
POST /api/v1/admin/credit/:retailerId/pause
Content-Type: application/json

{
  "reason": "Overdue payment"
}

Response:
{
  "success": true,
  "message": "Credit paused for Kumar Shop",
  "reason": "Overdue payment"
}
```

### Unpause Credit
```
POST /api/v1/admin/credit/:retailerId/unpause
Content-Type: application/json

{
  "reason": "Payment cleared"
}

Response:
{
  "success": true,
  "message": "Credit reactivated for Kumar Shop"
}
```

### Check if Should Pause
```
GET /api/v1/admin/credit/:retailerId/evaluate

Response:
{
  "shouldPause": true,
  "reason": "Outstanding credit exceeds 30 days (45 days old)",
  "oldestTransactionAmount": 25000,
  "daysOverdue": 15
}
```

---

## Feature 4: Payments & Adjustments

### Record Full/Partial Payment
```
POST /api/v1/admin/payment/record
Content-Type: application/json

{
  "transactionId": "txn_123",
  "amountPaid": 5000,
  "adminId": "admin_001"
}

Response:
{
  "success": true,
  "transactionId": "txn_123",
  "amountPaid": 5000,
  "remaining": 0,
  "status": "FULLY_CLEARED"  // or "PARTIAL_CLEARED"
}
```

### Create Adjustment
```
POST /api/v1/admin/adjustment/create
Content-Type: application/json

{
  "retailerId": "ret_123",
  "adjustmentAmount": -2000,  // Negative = credit back
  "reason": "Product returned - defective",
  "adminId": "admin_001"
}

Response:
{
  "success": true,
  "adjustmentId": "adj_456",
  "type": "CREDIT",
  "amount": 2000,
  "newUsedCredit": 43000
}
```

---

## Feature 5: Order Recovery

### Get Pending Orders
```
GET /api/v1/admin/orders/pending/:retailerId

Response:
[
  {
    "id": "pend_123",
    "retailerId": "ret_123",
    "totalAmount": 5000,
    "status": "EXPIRED",
    "expiresAt": "2026-01-15T10:30:00Z",
    "followUpSentAt": "2026-01-14T14:00:00Z"
  }
]
```

### Get Failed Orders
```
GET /api/v1/admin/orders/failed/:retailerId

Response:
[
  {
    "id": "ord_789",
    "retailerId": "ret_123",
    "totalAmount": 3000,
    "status": "FAILED",
    "failureReason": "Insufficient credit",
    "failedAt": "2026-01-14T09:15:00Z"
  }
]
```

### Retry Failed Order
```
POST /api/v1/admin/orders/:orderId/retry

Response:
{
  "success": true,
  "orderId": "ord_789",
  "message": "Order has been retried",
  "status": "PLACED"
}
```

### Manually Expire Pending Orders
```
POST /api/v1/admin/orders/expire-pending

Response:
{
  "count": 23,
  "message": "23 orders expired"
}
```

---

## Feature 6: Insights

### Get Retailer Stats
```
GET /api/v1/admin/insights/:retailerId

Response:
{
  "retailerId": "ret_123",
  "ordersThisWeek": 2,
  "ordersLastWeek": 1,
  "ordersThisMonth": 8,
  "avgOrderValue": 2450,
  "totalSpent": 29400,
  "daysActive": 18,
  "lastCalculatedAt": "2026-01-14T03:00:00Z"
}
```

### Get Insights as WhatsApp Message
```
GET /api/v1/admin/insights/:retailerId/message

Response:
{
  "message": "📊 Your Trading Stats\n\n📅 This Week\nOrders: 2\n... (formatted for WhatsApp)"
}
```

### Get System Overview
```
GET /api/v1/admin/insights/system/overview

Response:
{
  "activeRetailers": 145,
  "totalOrders": 1250,
  "avgOrdersPerRetailer": 8,
  "topRetailers": [ ... ],
  "insight": "Average retailer places 8 orders..."
}
```

### Regenerate All Insights
```
POST /api/v1/admin/insights/regenerate-all

Response:
{
  "total": 145,
  "success": 144,
  "failed": 1,
  "timestamp": "2026-01-14T03:00:00Z"
}
```

---

## Feature 8: Guardrails

### Validate Order Before Placement
```
POST /api/v1/admin/guardrails/validate-order
Content-Type: application/json

{
  "retailerId": "ret_123",
  "orderAmount": 5000,
  "paymentMode": "CREDIT"  // or "COD"
}

Response (Success):
{
  "allowed": true,
  "reason": "OK",
  "message": "Order is valid"
}

Response (Failure):
{
  "allowed": false,
  "reason": "CREDIT_PAUSED",
  "message": "Your credit is paused. Reason: Auto-paused: Credit 12 days overdue..."
}

Possible reasons:
- OK
- INSUFFICIENT_CREDIT
- CREDIT_PAUSED
- CREDIT_BLOCKED
- NO_CREDIT_ACCOUNT
- MAX_ORDER_EXCEEDED
- RETAILER_NOT_ACTIVE
- RETAILER_NOT_FOUND
- OVERDUE_WARNING
```

### Get Guardrails Config
```
GET /api/v1/admin/guardrails/:retailerId

Response:
{
  "retailerId": "ret_123",
  "creditLimit": 100000,
  "maxOrderValue": 50000,
  "maxOutstandingDays": 30,
  "currentStatus": "ACTIVE",
  "pausedAt": null,
  "pauseReason": null
}
```

### Update Guardrails
```
PUT /api/v1/admin/guardrails/:retailerId
Content-Type: application/json

{
  "maxOrderValue": 75000,
  "maxOutstandingDays": 45
}

Response:
{
  "success": true,
  "retailerId": "ret_123",
  "newConfig": {
    "creditLimit": 100000,
    "maxOrderValue": 75000,
    "maxOutstandingDays": 45
  }
}
```

### Get At-Risk Retailers
```
GET /api/v1/admin/guardrails/at-risk

Response:
[
  {
    "retailerId": "ret_123",
    "pasalName": "Kumar Shop",
    "riskType": "HIGH_CREDIT_USAGE",
    "severity": "HIGH",
    "detail": "87% of credit limit used",
    "availableCredit": 6500
  },
  {
    "retailerId": "ret_456",
    "pasalName": "Patel Supplies",
    "riskType": "OVERDUE_CREDIT",
    "severity": "CRITICAL",
    "detail": "42 days outstanding (12 days overdue)",
    "amount": 45000
  }
]
```

### Evaluate All Guardrails
```
POST /api/v1/admin/guardrails/evaluate-all

Response:
{
  "evaluated": 145,
  "paused": 8,
  "details": [
    {
      "retailerId": "ret_789",
      "pasalName": "Singh Wholesale",
      "reason": "45 days outstanding (limit: 30)"
    }
  ],
  "timestamp": "2026-01-14T04:00:00Z"
}
```

---

## Feature 7: Audit Logs

### Get Retailer's Audit Logs
```
GET /api/v1/admin/audit/:retailerId?limit=50

Response:
[
  {
    "id": "audit_123",
    "retailerId": "ret_123",
    "action": "CREDIT_CLEARED",
    "reference": "txn_456",
    "oldValue": null,
    "newValue": { "amount": 5000, "type": "FULL_PAYMENT" },
    "performedBy": "admin_001",
    "reason": "Payment received via bank",
    "createdAt": "2026-01-14T10:30:00Z"
  }
]

Action types:
- CREDIT_ADDED
- CREDIT_CLEARED
- PAUSE_CREDIT
- UNPAUSE_CREDIT
- ADJUSTMENT
- ORDER_CREATED
- ORDER_FAILED
- REMINDER_SENT
```

### Get All Credit Audit Logs
```
GET /api/v1/admin/audit/credit/all?limit=100

Response: [array of audit logs from system]
```

---

## Error Responses

All endpoints return error responses in this format:

```
{
  "success": false,
  "error": "Error message describing what went wrong"
}

HTTP Status Codes:
- 200: Success
- 201: Created
- 400: Bad request (validation error)
- 401: Unauthorized (no token)
- 403: Forbidden (not admin)
- 404: Not found
- 500: Server error
```

---

## Batch Operations (Admin)

These are typically called manually:

```
# Manually trigger daily jobs
POST /api/v1/admin/payment/reminders
POST /api/v1/admin/orders/expire-pending
POST /api/v1/admin/insights/regenerate-all
POST /api/v1/admin/guardrails/evaluate-all
```

---

## Request/Response Examples

### Full Example: Check Credit and Place Order

```javascript
// 1. Validate order
const validation = await fetch('/api/v1/admin/guardrails/validate-order', {
  method: 'POST',
  headers: { Authorization: 'Bearer jwt...' },
  body: JSON.stringify({
    retailerId: 'ret_123',
    orderAmount: 5000,
    paymentMode: 'CREDIT'
  })
});

if (validation.allowed === false) {
  console.log('Cannot place order:', validation.message);
  return;
}

// 2. Check insights
const insights = await fetch('/api/v1/admin/insights/ret_123/message', {
  headers: { Authorization: 'Bearer jwt...' }
});

// 3. Place order (in conversation service)
// ... order placement logic with credit deduction
```

---

## Pagination

Most endpoints support `?limit=N`:
- Default: 50 records
- Max: 1000 records
- Example: `GET /api/v1/admin/audit/ret_123?limit=100`

---

## Rate Limiting

No rate limiting implemented yet. Consider adding:
- 1000 req/min per IP
- 100 req/sec per endpoint

---

## Webhooks (Not Yet Implemented)

Could be added for:
- Payment received
- Order failed
- Credit paused
- Reminder sent

---

**Full API documentation complete. See CREDIT_OPERATIONS_GUIDE.md for detailed examples.**
