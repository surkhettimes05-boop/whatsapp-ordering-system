# Twilio Webhook Security Architecture - Visual Guide

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TWILIO WHATSAPP                             │
│                      (Message Incoming)                             │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ↓
        ┌─────────────────────────────────────────┐
        │  STEP 1: TWILIO SIGNS REQUEST            │
        │  ───────────────────────────────────     │
        │  Data to sign:                            │
        │    • URL: https://api.example.com/...    │
        │    • Body: From, To, Body, MessageSid    │
        │    • Secret: TWILIO_AUTH_TOKEN           │
        │                                           │
        │  Result:                                  │
        │    X-Twilio-Signature: jW/J9ztEW...      │
        └─────────────────────┬───────────────────┘
                              │
                              ↓
        ┌─────────────────────────────────────────┐
        │  POST /api/v1/whatsapp/webhook           │
        │  Headers:                                 │
        │    X-Twilio-Signature: jW/J9ztEW...      │
        │  Body:                                    │
        │    From: whatsapp:+97798...              │
        │    To: whatsapp:+141552...               │
        │    Body: "Hello"                          │
        │    MessageSid: SMxxxxxxxx                 │
        └─────────────────────┬───────────────────┘
                              │
                              ↓ (arrives at server)
        
┌─────────────────────────────────────────────────────────────────────┐
│                      YOUR SERVER (app.js)                            │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ↓
╔══════════════════════════════════════════════════════════════════════╗
║                 MIDDLEWARE CHAIN (Security Layer)                     ║
╚══════════════════════════════════════════════════════════════════════╝

    REQUEST ARRIVES
         │
         ↓
    ┌─────────────────────────────────────────┐
    │  MIDDLEWARE 1: Rate Limiter              │
    │  ──────────────────────────────────────  │
    │  Check: Have we seen >60 requests/min    │
    │         from this IP?                    │
    │                                           │
    │  If YES → REJECT (429 Too Many Requests) │
    │  If NO  → PASS TO NEXT MIDDLEWARE        │
    └─────────────┬───────────────────────────┘
                  │
                  ↓ (if rate limit OK)
    ┌─────────────────────────────────────────┐
    │  MIDDLEWARE 2: Replay Protection         │
    │  ──────────────────────────────────────  │
    │  Extract: X-Twilio-Signature header      │
    │  Generate: nonce = SHA256(signature)    │
    │                                           │
    │  Check #1: Is nonce in cache? (replay?)  │
    │    If YES → REJECT (409 Conflict)        │
    │    If NO  → Continue                     │
    │                                           │
    │  Check #2: Is timestamp too old?         │
    │    (older than 5 minutes)                 │
    │    If YES → REJECT (400 Bad Request)     │
    │    If NO  → Continue                     │
    │                                           │
    │  Check #3: Is timestamp in future?       │
    │    (more than 30 seconds ahead)          │
    │    If YES → REJECT (400 Bad Request)     │
    │    If NO  → Continue                     │
    │                                           │
    │  Action: Cache nonce for future replay   │
    │          detection                       │
    └─────────────┬───────────────────────────┘
                  │
                  ↓ (if replay checks pass)
    ┌─────────────────────────────────────────┐
    │  MIDDLEWARE 3: Signature Validation      │
    │  ──────────────────────────────────────  │
    │  Get: X-Twilio-Signature header          │
    │  Get: TWILIO_AUTH_TOKEN from .env        │
    │  Get: All POST parameters                │
    │                                           │
    │  Calculate:                               │
    │    our_signature = HMAC-SHA1(            │
    │      TWILIO_AUTH_TOKEN,                  │
    │      WEBHOOK_URL + POST_PARAMS           │
    │    )                                      │
    │                                           │
    │  Compare:                                 │
    │    our_signature == X-Twilio-Signature?  │
    │                                           │
    │  If NO  → REJECT (403 Forbidden)         │
    │           "Invalid Twilio signature"     │
    │                                           │
    │  If YES → PASS TO HANDLER ✓              │
    │           Attach req.twilio = {...}      │
    └─────────────┬───────────────────────────┘
                  │
                  ↓ (if signature valid)
    ┌─────────────────────────────────────────┐
    │  HANDLER: Process Message                │
    │  ──────────────────────────────────────  │
    │  1. Return 200 OK immediately to Twilio  │
    │     (prevents Twilio retry timeout)      │
    │                                           │
    │  2. Process message asynchronously:      │
    │     • Parse content                       │
    │     • Look up user                        │
    │     • Create order                        │
    │     • Send confirmation                  │
    │     • Update order status                 │
    │                                           │
    │  3. Don't await processing (non-blocking)│
    │     (server can handle next request)     │
    └─────────────┬───────────────────────────┘
                  │
                  ↓
    ┌─────────────────────────────────────────┐
    │  HTTP 200 OK ← SENT TO TWILIO            │
    │                                           │
    │  Twilio receives:                        │
    │  • Status: 200 OK                        │
    │  • Body: "OK"                            │
    │                                           │
    │  Twilio behavior:                        │
    │  • Marks delivery as successful          │
    │  • Won't retry request                   │
    └─────────────────────────────────────────┘
```

## Security Validation Flow (Detailed)

```
                    INCOMING REQUEST
                         │
                         ↓
        ┌─────────────────────────────────┐
        │ Has X-Twilio-Signature header?   │
        └─────────────────────────────────┘
               YES │           │ NO
                   ↓           ↓
            [Continue]    [403 REJECTED]
                              "Missing signature"
                   │
                   ↓
        ┌─────────────────────────────────┐
        │ Is TWILIO_AUTH_TOKEN configured? │
        └─────────────────────────────────┘
               YES │           │ NO
                   ↓           ↓
            [Continue]    [500 ERROR]
                              "Config error"
                   │
                   ↓
        ┌─────────────────────────────────┐
        │ Generate nonce = SHA256         │
        │   (signature + timestamp)        │
        └─────────────────────────────────┘
                   │
                   ↓
        ┌─────────────────────────────────┐
        │ Is nonce in cache?               │
        │ (Have we seen this before?)      │
        └─────────────────────────────────┘
           YES │           │ NO
               ↓           ↓
        [409 REJECTED]  [Continue]
        "Replay attack"  (first time)
               │
               ↓
        ┌─────────────────────────────────┐
        │ Calculate expected signature:    │
        │   HMAC-SHA1(                     │
        │     TWILIO_AUTH_TOKEN,           │
        │     WEBHOOK_URL + POST_PARAMS    │
        │   )                              │
        └─────────────────────────────────┘
                   │
                   ↓
        ┌─────────────────────────────────┐
        │ Does it match X-Twilio-Signature?│
        └─────────────────────────────────┘
           YES │           │ NO
               ↓           ↓
        [200 ACCEPTED]  [403 REJECTED]
        "Signature OK"     "Invalid signature"
               │
               ↓
        ┌─────────────────────────────────┐
        │ Add nonce to cache               │
        │ (Expires after 5 minutes)        │
        │ (For future replay detection)    │
        └─────────────────────────────────┘
                   │
                   ↓
        ┌─────────────────────────────────┐
        │ ✓ ALL CHECKS PASSED              │
        │ Attach req.twilio metadata       │
        │ Process message handler          │
        └─────────────────────────────────┘
```

## Nonce Cache (Replay Attack Prevention)

```
                    TIME FLOWS →

First Message Arrives at t=0
┌─────────────────────────────────────────────────┐
│ Signature: jW/J9ztEWCxd8UVHt7FQlCKJcew=         │
│ MessageSid: SM1234567890abcdef                  │
│ Body: "Hello"                                   │
└─────────────────────────────────────────────────┘
         ↓
    Generate Nonce: abc123def456...
         ↓
    Cache Entry Created:
    {
      nonce: "abc123def456...",
      timestamp: 1705689200000,
      expiresAt: 1705689500000  (5 min later)
    }
         ↓
    Process message ✓


Second Request at t=2min (SAME MESSAGE)
┌─────────────────────────────────────────────────┐
│ Signature: jW/J9ztEWCxd8UVHt7FQlCKJcew=         │ (SAME!)
│ MessageSid: SM1234567890abcdef                  │ (SAME!)
│ Body: "Hello"                                   │ (SAME!)
└─────────────────────────────────────────────────┘
         ↓
    Generate Nonce: abc123def456...  (SAME NONCE!)
         ↓
    Check Cache: FOUND! (REPLAY DETECTED!)
         ↓
    REJECT with 409 ✗


Cache Cleanup at t=5min+
┌─────────────────────────────────────────────────┐
│ Check all cache entries                         │
│ For each entry:                                 │
│   if (now > expiresAt) → DELETE                 │
└─────────────────────────────────────────────────┘
         ↓
    Cache entry for first message REMOVED
    (Now we could accept it again if needed)
```

## Configuration Flow

```
.env File
┌──────────────────────────────────────────────┐
│ TWILIO_AUTH_TOKEN=abc123xyz789               │
│ WEBHOOK_URL=https://api.example.com/webhook  │
│ TWILIO_CLOCK_SKEW_MS=30000                   │
│ TWILIO_NONCE_WINDOW_MS=300000                │
└──────────────────────────────────────────────┘
                    │
                    ↓
    ┌───────────────────────────────────────────┐
    │ app.js (Express Server)                   │
    └───────────────────────────────────────────┘
                    │
                    ↓
    ┌───────────────────────────────────────────┐
    │ whatsapp.routes.js                        │
    │                                            │
    │ router.post('/webhook',                   │
    │   webhookRateLimiter,                     │
    │   replayProtectionMiddleware({            │
    │     maxClockSkewMs: 30000,                │
    │     windowMs: 300000                      │
    │   }),                                      │
    │   validateTwilioWebhook(webhookUrl),      │
    │   handler                                  │
    │ )                                          │
    └───────────────────────────────────────────┘
                    │
                    ├─ webhookUrl value comes from
                    │  process.env.WEBHOOK_URL ↓
                    │
                    ├─ maxClockSkewMs default 30s
                    │  can be overridden
                    │
                    └─ windowMs default 5min
                       can be overridden
```

## Error Response Codes

```
SUCCESS:
├─ 200 OK
│  └─ Request passed all security checks
│     Message processing initiated
│
SECURITY REJECTIONS:
├─ 400 Bad Request
│  ├─ Request timestamp too old (>5 min)
│  ├─ Request timestamp in future (>30s)
│  └─ Code: REQUEST_TOO_OLD, INVALID_TIMESTAMP
│
├─ 403 Forbidden
│  ├─ Missing X-Twilio-Signature header
│  ├─ Invalid/wrong signature
│  ├─ Wrong WEBHOOK_URL (signature won't match)
│  └─ Code: MISSING_SIGNATURE, INVALID_SIGNATURE
│
├─ 409 Conflict
│  ├─ Duplicate request detected (REPLAY ATTACK!)
│  └─ Code: REPLAY_DETECTED
│
└─ 500 Internal Server Error
   ├─ TWILIO_AUTH_TOKEN not configured
   ├─ Unexpected validation error
   └─ Code: CONFIG_ERROR, VALIDATION_ERROR
```

## Common Issues & Fixes

```
ISSUE: "Invalid Twilio signature" on every request
┌─────────────────────────────────────────────────┐
│ Likely Causes:                                   │
│ 1. WEBHOOK_URL doesn't match Twilio config      │
│ 2. TWILIO_AUTH_TOKEN is wrong                   │
│ 3. Proxy/firewall is modifying request body     │
│ 4. URL contains query parameters but shouldn't  │
│                                                  │
│ Fix:                                             │
│ • Verify in Twilio console: Exact webhook URL   │
│ • Compare with WEBHOOK_URL in .env              │
│ • Check they're EXACTLY the same (case matters) │
└─────────────────────────────────────────────────┘

ISSUE: "Request too old"
┌─────────────────────────────────────────────────┐
│ Likely Causes:                                   │
│ 1. Server clock is out of sync                  │
│ 2. Network/proxy is delaying the request        │
│                                                  │
│ Fix:                                             │
│ • Sync server time: ntpdate -s time.nist.gov    │
│ • Increase tolerance: TWILIO_CLOCK_SKEW_MS      │
│ • Check proxy delays                            │
└─────────────────────────────────────────────────┘

ISSUE: Duplicate requests rejected
┌─────────────────────────────────────────────────┐
│ Likely Causes:                                   │
│ ✓ This is working correctly!                    │
│ • Twilio retries on timeout                     │
│ • Or it's an actual replay attack               │
│                                                  │
│ Fix:                                             │
│ • Return 200 OK within 5 seconds                │
│ • Use async jobs for long operations            │
│ • Increase TWILIO_NONCE_WINDOW_MS if needed     │
└─────────────────────────────────────────────────┘
```

