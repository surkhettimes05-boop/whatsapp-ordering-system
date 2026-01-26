# Webhook Idempotency - API Reference

## Endpoint: POST /api/v1/whatsapp/webhook

### Overview
Handle incoming WhatsApp messages from Twilio with **automatic deduplication** and **idempotency** support.

**Features:**
- ✅ HTTPS enforced
- ✅ Rate limiting (60 req/min)
- ✅ Replay attack detection
- ✅ Twilio signature validation
- ✅ **Idempotency key support** ← NEW
- ✅ Message deduplication

---

## Request Format

### Headers (Required)

| Header | Value | Required | Purpose |
|--------|-------|----------|---------|
| `Content-Type` | `application/json` | Yes | Request content type |
| `X-Idempotency-Key` | UUID or unique string | **No (Recommended)** | Idempotency key |

### Headers (Twilio Automatically Adds)

| Header | Example | Purpose |
|--------|---------|---------|
| `X-Twilio-Signature` | `abc123...` | Webhook signature (auto-validated) |
| `User-Agent` | `TwilioProxy/...` | Twilio user agent |

### Body (JSON)

```json
{
  "From": "whatsapp:+9779800000000",
  "To": "whatsapp:+14155238886",
  "Body": "I want to order",
  "MessageSid": "SMxxxxxxxxxxxxxxxxxxxxxxx",
  "AccountSid": "ACxxxxxxxxxxxxxxxxxxxxxxx",
  "ProfileName": "User Name"
}
```

---

## Request Examples

### Example 1: Basic Request (Without Idempotency)

```bash
curl -X POST https://your-domain.com/api/v1/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "From": "whatsapp:+9779800000000",
    "To": "whatsapp:+14155238886",
    "Body": "I want to order 10 apples",
    "MessageSid": "SMxxxxxxxxxxxxxxxxxxxxxxx",
    "AccountSid": "ACxxxxxxxxxxxxxxxxxxxxxxx",
    "ProfileName": "John Doe"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Message received",
  "processed": true
}
```

**Side Effects:**
- Order created in database
- User receives response

---

### Example 2: Request With Idempotency Key (RECOMMENDED)

**First Request:**
```bash
IDEMPOTENCY_KEY="550e8400-e29b-41d4-a716-446655440000"

curl -X POST https://your-domain.com/api/v1/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "From": "whatsapp:+9779800000000",
    "Body": "I want to order 10 apples",
    "MessageSid": "SMxxxxxxxxxxxxxxxxxxxxxxx"
  }'
```

**Response:** (200 OK - First time)
```json
{
  "success": true,
  "message": "Message received",
  "processed": true
}
```

**Side Effects:**
- ✅ Order created (NEW)
- ✅ Response cached with key
- ✅ User receives order confirmation

**Second Request (Duplicate - Same Idempotency Key):**
```bash
# Same request, same IDEMPOTENCY_KEY
curl -X POST https://your-domain.com/api/v1/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "From": "whatsapp:+9779800000000",
    "Body": "I want to order 10 apples",
    "MessageSid": "SMxxxxxxxxxxxxxxxxxxxxxxx"
  }'
```

**Response:** (200 OK - CACHED, < 5ms)
```json
{
  "success": true,
  "message": "Message received",
  "processed": true
}
```

**Side Effects:**
- ❌ NO new order created (CACHED)
- ✅ Original response returned
- ✅ Same confirmation sent

**Key Difference:**
- ⏱️ First request: ~200ms (processing)
- ⏱️ Retry: ~5ms (cache hit)

---

### Example 3: Different Idempotency Key (New Request)

```bash
# Different key = new request processing
curl -X POST https://your-domain.com/api/v1/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: 660e8400-e29b-41d4-a716-446655440111" \
  -d '{
    "From": "whatsapp:+9779800000000",
    "Body": "I want to order 10 apples"
  }'
```

**Result:**
- ✅ Treated as NEW request
- ✅ Order created again (different key)
- ✅ Response cached with new key

---

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "WhatsApp message processed",
  "processed_at": "2024-01-15T10:30:45.123Z"
}
```

**Status Code:** 200 OK
**Reason:** Request processed successfully

---

### Error Response (400 Bad Request)

```json
{
  "success": false,
  "error": "Invalid idempotency key format. Must be alphanumeric, hyphen, or underscore (max 255 chars)"
}
```

**Reasons:**
- Idempotency key contains invalid characters
- Idempotency key exceeds 255 characters
- Idempotency key is empty

---

### Error Response (403 Forbidden)

```json
{
  "error": "HTTPS required"
}
```

**Reasons:**
- Request sent over HTTP (not HTTPS)
- Security requirement

---

### Error Response (429 Too Many Requests)

```json
{
  "error": "Rate limit exceeded"
}
```

**Reasons:**
- More than 60 requests per minute
- Rate limiter activated

---

## HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | OK | Message processed or cached |
| 400 | Bad Request | Invalid idempotency key or format |
| 403 | Forbidden | HTTPS required |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal error (retry with same key) |

---

## Idempotency Key Format

### Valid Formats

✅ **UUID v4** (Recommended)
```
550e8400-e29b-41d4-a716-446655440000
f47ac10b-58cc-4372-a567-0e02b2c3d479
```

✅ **Timestamp-based**
```
1705326645123456789
2024-01-15T10-30-45-123Z
```

✅ **Alphanumeric with separators**
```
webhook_request_001
webhook-key-abc-123
client_request_uuid_456
```

### Invalid Formats

❌ **Contains spaces**
```
"webhook key 123"
```

❌ **Contains special characters**
```
"webhook;key;123"
"webhook@key#123"
```

❌ **Too long (> 255 chars)**
```
"a" * 256  # Over 255 characters
```

### Generation Examples

**JavaScript (UUID v4):**
```javascript
const idempotencyKey = crypto.randomUUID();
// "550e8400-e29b-41d4-a716-446655440000"

const response = await fetch('/api/v1/whatsapp/webhook', {
  method: 'POST',
  headers: {
    'X-Idempotency-Key': idempotencyKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({...})
});
```

**Python (UUID v4):**
```python
import uuid
import requests

idempotency_key = str(uuid.uuid4())
# "550e8400-e29b-41d4-a716-446655440000"

response = requests.post(
  'https://your-domain.com/api/v1/whatsapp/webhook',
  headers={
    'X-Idempotency-Key': idempotency_key,
    'Content-Type': 'application/json'
  },
  json={...}
)
```

**Bash (OpenSSL):**
```bash
IDEMPOTENCY_KEY=$(uuidgen)
# "550e8400-E29B-41D4-A716-446655440000"

curl -X POST https://your-domain.com/api/v1/whatsapp/webhook \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '...'
```

---

## Retry Logic

### Scenario 1: Network Timeout (First Request Failed)

```
Request 1 (timeout)
  ↓
Client retries with SAME idempotency key
  ↓
Server: Not found in cache
  ↓
Process as new request
  ↓
Return 200 OK
```

**Result:** Processed once (correct)

---

### Scenario 2: Twilio Retry (Provider Retry)

```
Request 1 (successful)
  ↓
Twilio retries with same idempotency key
  ↓
Server: Found in cache
  ↓
Return cached response (200 OK)
  ↓
No duplicate processing
```

**Result:** Processed once (duplicate prevented)

---

### Scenario 3: Lost Response

```
Request 1 (processed, response lost)
  ↓
Client retries with same idempotency key
  ↓
Server: Found in cache
  ↓
Return original response
```

**Result:** Client gets original response

---

## Monitoring & Debugging

### Check Idempotency Status

```bash
# Test endpoint shows idempotency info
curl https://your-domain.com/api/v1/whatsapp/test

# Response:
# {
#   "idempotency": {
#     "enabled": true,
#     "header": "X-Idempotency-Key",
#     "ttl_hours": 24
#   }
# }
```

### Log Entries

**First Request (New Key):**
```
[INFO] Idempotency key is new (path=/webhook, idempotency_key=550e8400-...)
[INFO] Webhook response cached for idempotency (webhook_type=whatsapp_message)
```

**Duplicate Request (Cache Hit):**
```
[INFO] Idempotency cache hit - replaying response (webhook_type=whatsapp_message)
[INFO] Webhook replay completed (original_request_time=...)
```

---

## Compliance & Standards

### RFC 7231
This implementation follows RFC 7231 recommendations for HTTP methods and caching.

### Stripe API Compatibility
Uses Stripe's idempotency pattern with `X-Idempotency-Key` header.

### Documentation
- Stripe: https://stripe.com/docs/api/idempotent_requests
- RFC 7231: https://tools.ietf.org/html/rfc7231#section-4.2.2

---

## Common Questions

### Q: Can I use the same key for different webhooks?
**A:** No. Each webhook request should have a unique key. If you retry the exact same request (same URL, body, headers) within 24 hours, it will be deduplicated.

### Q: What if I don't send an idempotency key?
**A:** The request is processed normally without caching. Header is optional but recommended.

### Q: How long is the key cached?
**A:** Default 24 hours. After that, even the same key will be processed as a new request.

### Q: Can I customize the TTL?
**A:** Yes, in middleware options:
```javascript
idempotencyMiddleware({
  ttl_seconds: 86400 // Change this (default: 24 hours)
})
```

### Q: Does caching affect security?
**A:** No. Caching happens after Twilio signature validation, so replayed responses are still verified.

### Q: What if the database is down?
**A:** Idempotency is disabled gracefully. Requests are still processed normally.

---

## Integration Examples

### Python Requests

```python
import uuid
import requests

def send_webhook(data):
    idempotency_key = str(uuid.uuid4())
    
    response = requests.post(
        'https://your-domain.com/api/v1/whatsapp/webhook',
        headers={
            'X-Idempotency-Key': idempotency_key,
            'Content-Type': 'application/json'
        },
        json=data
    )
    
    return response.json()
```

### JavaScript Fetch

```javascript
async function sendWebhook(data) {
  const idempotencyKey = crypto.randomUUID();
  
  const response = await fetch(
    'https://your-domain.com/api/v1/whatsapp/webhook',
    {
      method: 'POST',
      headers: {
        'X-Idempotency-Key': idempotencyKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }
  );
  
  return response.json();
}
```

### cURL with Retry

```bash
#!/bin/bash

IDEMPOTENCY_KEY=$(uuidgen)
RETRY_COUNT=0
MAX_RETRIES=3

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  curl -X POST https://your-domain.com/api/v1/whatsapp/webhook \
    -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
    -H "Content-Type: application/json" \
    -d '{...}' && break
  
  RETRY_COUNT=$((RETRY_COUNT + 1))
  sleep 2
done
```

---

## Performance Tips

1. **Generate key once per request** - Reuse same key for retries
2. **Use UUID v4** - Cryptographically random and unique
3. **Send immediately** - Don't wait to include the header
4. **Implement retry** - Exponential backoff with same key

---

*This API prevents duplicate orders when webhooks are retried due to failures or timeouts. Always include X-Idempotency-Key for production reliability.*
