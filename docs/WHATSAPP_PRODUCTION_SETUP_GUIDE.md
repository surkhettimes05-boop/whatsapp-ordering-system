# WhatsApp Production Setup Guide - Complete Implementation

**Date Created**: January 22, 2026  
**Status**: Complete Production Setup  
**Target**: Twilio WhatsApp Business API (Production Mode)

---

## 📋 Table of Contents

1. [Phase 1: Live Mode Transition](#phase-1-live-mode-transition)
2. [Phase 2: Production Webhook Configuration](#phase-2-production-webhook-configuration)
3. [Phase 3: Secret Rotation](#phase-3-secret-rotation)
4. [Phase 4: Message Status Callbacks](#phase-4-message-status-callbacks)
5. [Phase 5: Delivery Receipts](#phase-5-delivery-receipts)
6. [Environment Configuration](#environment-configuration)
7. [Verification Checklist](#verification-checklist)
8. [Troubleshooting](#troubleshooting)

---

## Phase 1: Live Mode Transition

### Step 1.1: Access Twilio Console

```
1. Go to: https://www.twilio.com/console
2. Log in with your account
3. Navigate to: Messaging → WhatsApp
```

### Step 1.2: Switch from Sandbox to Production

**SANDBOX MODE (Current)**
```
Location: Messaging → Settings → Sandbox
Phone Number: +14155238886 (shared test number)
Status: ⚠️ Restricted to approved test numbers only
```

**PRODUCTION MODE (Target)**
```
Location: Messaging → WhatsApp Senders
Status: ✅ Full access to real WhatsApp users
```

### Step 1.3: Upgrade to Business API

**Prerequisites:**
- ✅ Business Account (verified)
- ✅ Phone Number (dedicated for your business)
- ✅ Domain verification (if required)

**Action Steps:**

1. **Click "Add WhatsApp Number"** (in Messaging → WhatsApp Senders)
2. **Choose: "Use your own phone number"**
3. **Enter your business phone number** (verified phone)
4. **Twilio will send verification code** to that number
5. **Enter verification code**
6. **Configure number details:**
   ```
   Display Name: Your Business Name
   Category: Business
   Business Description: Brief description of your service
   Privacy Policy URL: https://yourdomain.com/privacy
   Terms of Service URL: https://yourdomain.com/terms
   Website: https://yourdomain.com
   ```
7. **Click "Activate"**

### Step 1.4: Get Production API Credentials

Once activated, you'll receive:

```
TWILIO_ACCOUNT_SID      = ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN       = your_full_auth_token_here (64 chars)
TWILIO_WHATSAPP_FROM    = whatsapp:+your_verified_number
WEBHOOK_URL             = https://yourdomain.com/api/v1/whatsapp/webhook
```

**⚠️ CRITICAL: Save these securely. Do NOT commit to Git.**

---

## Phase 2: Production Webhook Configuration

### Step 2.1: Prepare Webhook URL

Your production webhook must:
- ✅ Use HTTPS (required by Twilio)
- ✅ Be publicly accessible
- ✅ Match exactly what you configure in Twilio
- ✅ Point to: `/api/v1/whatsapp/webhook`

**Examples:**
```
✅ https://api.yourbusiness.com/api/v1/whatsapp/webhook
✅ https://yourbusiness.com/api/v1/whatsapp/webhook
❌ http://yourbusiness.com/... (HTTP not allowed)
❌ https://yourbusiness.com:8080/... (custom ports may fail)
```

### Step 2.2: Configure in Twilio Console

1. **Go to:** Messaging → WhatsApp Senders → Your Number
2. **Find:** "Messaging Configuration"
3. **Click:** "Edit" or "Configure"

**Update these fields:**

| Field | Value | Example |
|-------|-------|---------|
| **Webhook URL** | Your HTTPS URL | `https://api.yourbusiness.com/api/v1/whatsapp/webhook` |
| **HTTP Method** | POST | POST |
| **Status Callback URL** | (see Phase 4) | `https://api.yourbusiness.com/api/v1/whatsapp/status` |

### Step 2.3: Test Webhook Connection

```bash
# Test 1: Verify webhook is accessible
curl -X GET https://api.yourdomain.com/api/v1/whatsapp/webhook
# Expected: 200 OK

# Test 2: Verify HTTPS is working
curl -v https://api.yourdomain.com/api/v1/whatsapp/webhook
# Check for: HTTP/1.1 200 OK or 403 Forbidden (normal - no signature)

# Test 3: Check Twilio signature validation (from Twilio side)
# Twilio will test automatically after you save
# Status should show: ✅ Verified
```

### Step 2.4: Verify in Twilio

After configuring:
1. **Twilio will automatically test** your webhook URL
2. **Status indicator should show:** ✅ Green checkmark
3. **If red ❌:** Check error logs, HTTPS certificate, IP allowlist

---

## Phase 3: Secret Rotation

### Step 3.1: Current Secrets in Use

```
Current Secrets:
├── TWILIO_AUTH_TOKEN       (authentication)
├── JWT_SECRET              (API authentication)
├── WEBHOOK_URL             (validation)
└── API_KEYS                (optional - for 3rd party)
```

### Step 3.2: Rotate Twilio Auth Token

**⚠️ WARNING: This will invalidate current connections. Plan accordingly.**

**Steps:**

1. **Generate NEW auth token in Twilio:**
   ```
   Go to: Twilio Console → Account Info
   Click: Generate New Auth Token
   Copy: New token (32 character string)
   Save: To secure vault (1Password, HashiCorp Vault, etc.)
   ```

2. **Update environment variables (rolling deployment):**
   ```bash
   # On your deployment server:
   export TWILIO_AUTH_TOKEN=new_token_value_here
   
   # Redeploy application WITHOUT restarting
   # (Use blue-green deployment if possible)
   ```

3. **Verify new token works:**
   ```bash
   # Test sending message with new token
   curl -X POST https://api.yourdomain.com/api/v1/whatsapp/send \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"to": "+your_test_number", "message": "Test"}'
   ```

4. **Monitor for errors** (15-30 minutes):
   - Check application logs for authentication failures
   - Verify no spike in failed webhooks
   - Monitor queue for stuck messages

5. **Revoke OLD token in Twilio:**
   ```
   Go to: Twilio Console → Account Info
   Find: Old Auth Token
   Click: Revoke (cannot be undone!)
   ```

### Step 3.3: Rotate JWT Secret (for API)

**For API authentication (if used):**

```bash
# 1. Generate NEW JWT Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Create transition period (dual-key support)
# Update JWT middleware to accept both old and new keys

# 3. After transition (24-48 hours), remove old key
# Update .env: JWT_SECRET=new_value

# 4. Redeploy and restart application
npm run build && npm restart
```

### Step 3.4: Document Rotation

Create a rotation schedule:

```
📅 Secret Rotation Schedule
┌─────────────────────────────────────────────────────┐
│ Secret                 │ Rotation Frequency │ Last   │
├─────────────────────────────────────────────────────┤
│ TWILIO_AUTH_TOKEN      │ Quarterly (90d)   │ Jan 22 │
│ JWT_SECRET             │ Quarterly (90d)   │ Jan 22 │
│ Database Password      │ Quarterly (90d)   │ Jan 22 │
│ Redis Password         │ Quarterly (90d)   │ Jan 22 │
└─────────────────────────────────────────────────────┘
```

---

## Phase 4: Message Status Callbacks

### Step 4.1: Understanding Message Statuses

Twilio provides these statuses:

```
┌──────────────┬─────────────────────────────────┐
│ Status       │ Meaning                         │
├──────────────┼─────────────────────────────────┤
│ queued       │ Message in system queue         │
│ sending      │ Being delivered to carrier      │
│ sent         │ Delivered to WhatsApp server    │
│ delivered    │ Received by WhatsApp client     │
│ read         │ User read the message           │
│ failed       │ Delivery failed                 │
│ undelivered  │ Could not deliver               │
└──────────────┴─────────────────────────────────┘
```

### Step 4.2: Enable Status Callbacks in Twilio

**In Twilio Console:**

1. **Navigate:** Messaging → WhatsApp Senders → Your Number
2. **Find:** "Status Callback URL" field
3. **Enter:** `https://api.yourdomain.com/api/v1/whatsapp/status`
4. **HTTP Method:** POST
5. **Click:** Save

### Step 4.3: Create Status Callback Endpoint

**Backend Route:** `src/routes/whatsapp.routes.js`

```javascript
/**
 * POST /api/v1/whatsapp/status
 * Receive message status updates from Twilio
 * 
 * Webhook format from Twilio:
 * {
 *   "MessageSid": "SM...",
 *   "MessageStatus": "delivered|failed|read|sent|queued|sending|undelivered",
 *   "MessageStatusCallbackUrl": "...",
 *   "From": "whatsapp:+1234567890",
 *   "To": "whatsapp:+your_number",
 *   "ErrorCode": "30003" (only if failed/undelivered)
 * }
 */
router.post(
  '/status',
  httpsOnly,
  webhookRateLimiter,
  validateTwilioWebhook(webhookUrl),
  idempotencyMiddleware,
  async (req, res) => {
    try {
      const { MessageSid, MessageStatus, ErrorCode, From, To } = req.body;

      logger.info('WhatsApp message status update received', {
        messageSid: MessageSid,
        status: MessageStatus,
        errorCode: ErrorCode,
        from: From,
        to: To,
      });

      // Return 200 OK immediately to Twilio
      if (!res.headersSent) res.status(200).send('OK');

      // Process status asynchronously
      await whatsappController.handleMessageStatus({
        messageSid: MessageSid,
        status: MessageStatus,
        errorCode: ErrorCode,
        from: From,
        to: To,
      });
    } catch (error) {
      logger.error('Error processing message status', {
        error: error.message,
        body: req.body,
      });
      if (!res.headersSent) res.status(200).send('OK'); // Always return 200
    }
  }
);
```

### Step 4.4: Update Prisma Schema

Add status tracking to database:

```prisma
model WhatsAppMessage {
  id              String    @id @default(cuid())
  messageSid      String    @unique
  from            String
  to              String
  body            String
  status          String    @default("queued") // queued, sent, delivered, read, failed
  direction       String    // INCOMING, OUTGOING
  errorCode       String?   // Twilio error code if failed
  lastStatusAt    DateTime  @updatedAt
  createdAt       DateTime  @default(now())

  @@index([messageSid])
  @@index([status])
  @@index([createdAt])
}

model MessageStatusLog {
  id              String    @id @default(cuid())
  messageSid      String    @index
  previousStatus  String
  newStatus       String
  statusChangedAt DateTime  @default(now())
  errorCode       String?

  @@index([messageSid, statusChangedAt])
}
```

**Run migration:**

```bash
npx prisma migrate dev --name add_message_status_tracking
```

### Step 4.5: Update WhatsApp Controller

**File:** `src/controllers/whatsapp.controller.js`

```javascript
async function handleMessageStatus(statusUpdate) {
  const { messageSid, status, errorCode, from, to } = statusUpdate;

  try {
    // 1. Get existing message
    const message = await prisma.whatsAppMessage.findUnique({
      where: { messageSid },
    });

    if (!message) {
      logger.warn('Status update for unknown message', { messageSid });
      return;
    }

    // 2. Log status transition
    if (message.status !== status) {
      await prisma.messageStatusLog.create({
        data: {
          messageSid,
          previousStatus: message.status,
          newStatus: status,
          errorCode,
        },
      });
    }

    // 3. Update message status
    await prisma.whatsAppMessage.update({
      where: { messageSid },
      data: {
        status,
        errorCode,
        lastStatusAt: new Date(),
      },
    });

    // 4. Handle based on status
    switch (status) {
      case 'delivered':
        await handleDelivered(message);
        break;
      case 'read':
        await handleRead(message);
        break;
      case 'failed':
      case 'undelivered':
        await handleFailed(message, errorCode);
        break;
    }

    logger.info('Message status updated', { messageSid, status });
  } catch (error) {
    logger.error('Error handling message status', {
      messageSid,
      error: error.message,
    });
  }
}

async function handleDelivered(message) {
  // Example: Update order tracking
  logger.info('Message delivered', {
    messageSid: message.messageSid,
    to: message.to,
  });
  
  // Emit event for order system, if needed
  // eventEmitter.emit('message:delivered', { messageSid, to: message.to });
}

async function handleRead(message) {
  // Example: Notify that user read order confirmation
  logger.info('Message read', {
    messageSid: message.messageSid,
    to: message.to,
  });
}

async function handleFailed(message, errorCode) {
  logger.error('Message delivery failed', {
    messageSid: message.messageSid,
    to: message.to,
    errorCode,
  });

  // Map Twilio error codes
  const errorMap = {
    '30003': 'Invalid recipient',
    '30004': 'Generic rate limit exceeded',
    '30005': 'SMS throughput limit exceeded',
    '21614': 'Invalid recipient phone number',
  };

  const errorDesc = errorMap[errorCode] || 'Unknown error';
  
  // Retry logic
  const retryCount = message.retryCount || 0;
  if (retryCount < 3) {
    logger.info('Scheduling message retry', { messageSid: message.messageSid });
    // Queue retry (implement based on your queue system)
  }
}

module.exports = {
  handleMessageStatus,
  handleDelivered,
  handleRead,
  handleFailed,
};
```

---

## Phase 5: Delivery Receipts

### Step 5.1: Understanding Delivery Receipts

**Delivery Receipt Flow:**

```
Your App → Twilio → WhatsApp Server → User's Phone
   ↓
   ← Status Update ← WhatsApp → Twilio ← Status Callback
```

### Step 5.2: Enable Receipt Tracking

**Update WhatsApp Service:** `src/services/whatsapp.service.js`

```javascript
/**
 * Send message with receipt tracking
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @param {object} options - Options including receipt tracking
 * @returns {Promise<object>} - Message data with tracking ID
 */
async function sendWhatsAppMessageWithReceipts(to, message, options = {}) {
  const { 
    trackReceipts = true, 
    trackReads = true, 
    priority = 5 
  } = options;

  const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const formattedFrom = fromPhoneNumber.startsWith('whatsapp:') 
    ? fromPhoneNumber 
    : `whatsapp:${fromPhoneNumber}`;

  if (!client) {
    throw new Error('Twilio client not initialized');
  }

  try {
    // Send message with status callback enabled
    const result = await client.messages.create({
      body: message,
      from: formattedFrom,
      to: formattedTo,
      // Note: Status callbacks are configured globally in Twilio
      // No per-message configuration needed
    });

    // Log to database with receipt tracking enabled
    const dbMessage = await prisma.whatsAppMessage.create({
      data: {
        messageSid: result.sid,
        from: 'SYSTEM',
        to: to.replace('whatsapp:', ''),
        body: message,
        direction: 'OUTGOING',
        status: result.status,
        trackReceipts,
        trackReads,
        deliveredAt: null,
        readAt: null,
        failedAt: null,
      },
    });

    logger.info('WhatsApp message sent with receipt tracking', {
      messageSid: result.sid,
      to: formattedTo,
      status: result.status,
      trackReceipts,
      trackReads,
    });

    return {
      success: true,
      messageSid: result.sid,
      status: result.status,
      trackingEnabled: true,
    };
  } catch (error) {
    logger.error('Failed to send WhatsApp message', {
      to: formattedTo,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get delivery status for a message
 * @param {string} messageSid - Twilio message SID
 * @returns {Promise<object>} - Status info
 */
async function getMessageDeliveryStatus(messageSid) {
  try {
    const message = await client.messages(messageSid).fetch();
    
    const dbMessage = await prisma.whatsAppMessage.findUnique({
      where: { messageSid },
      include: {
        statusLogs: {
          orderBy: { statusChangedAt: 'desc' },
          take: 5, // Get last 5 status changes
        },
      },
    });

    return {
      messageSid,
      currentStatus: message.status,
      databaseStatus: dbMessage?.status,
      deliveredAt: dbMessage?.deliveredAt,
      readAt: dbMessage?.readAt,
      failedAt: dbMessage?.failedAt,
      statusHistory: dbMessage?.statusLogs || [],
    };
  } catch (error) {
    logger.error('Error fetching message status', {
      messageSid,
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  sendWhatsAppMessageWithReceipts,
  getMessageDeliveryStatus,
  // ... existing exports
};
```

### Step 5.3: Add Delivery Receipt Timestamps

**Update Prisma Schema:**

```prisma
model WhatsAppMessage {
  id              String    @id @default(cuid())
  messageSid      String    @unique
  from            String
  to              String
  body            String
  status          String    @default("queued")
  direction       String    // INCOMING, OUTGOING
  errorCode       String?
  
  // Receipt tracking
  trackReceipts   Boolean   @default(true)
  trackReads      Boolean   @default(false)
  deliveredAt     DateTime?
  readAt          DateTime?
  failedAt        DateTime?
  
  lastStatusAt    DateTime  @updatedAt
  createdAt       DateTime  @default(now())

  statusLogs      MessageStatusLog[]

  @@index([messageSid])
  @@index([status])
  @@index([deliveredAt])
  @@index([readAt])
  @@index([createdAt])
}
```

### Step 5.4: Implement Delivery Dashboard

**Create endpoint:** `src/routes/whatsapp.routes.js`

```javascript
/**
 * GET /api/v1/whatsapp/delivery-status/:messageSid
 * Get delivery status for a specific message
 */
router.get(
  '/delivery-status/:messageSid',
  authenticate,
  async (req, res) => {
    try {
      const { messageSid } = req.params;

      const message = await prisma.whatsAppMessage.findUnique({
        where: { messageSid },
        include: {
          statusLogs: {
            orderBy: { statusChangedAt: 'desc' },
          },
        },
      });

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      return res.json({
        messageSid,
        status: message.status,
        to: message.to,
        timestamps: {
          sent: message.createdAt,
          delivered: message.deliveredAt,
          read: message.readAt,
          failed: message.failedAt,
        },
        statusHistory: message.statusLogs,
        deliveryMetrics: {
          timeSent: message.createdAt.toISOString(),
          timeToDeliver: message.deliveredAt 
            ? Math.round((message.deliveredAt - message.createdAt) / 1000) + 's'
            : null,
          timeToRead: message.readAt
            ? Math.round((message.readAt - message.createdAt) / 1000) + 's'
            : null,
        },
      });
    } catch (error) {
      logger.error('Error fetching delivery status', {
        error: error.message,
      });
      res.status(500).json({ error: 'Failed to fetch status' });
    }
  }
);

/**
 * GET /api/v1/whatsapp/delivery-metrics
 * Get delivery metrics and statistics
 */
router.get(
  '/delivery-metrics',
  authenticate,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = new Date(startDate || Date.now() - 24 * 60 * 60 * 1000);
      const end = new Date(endDate || Date.now());

      const messages = await prisma.whatsAppMessage.findMany({
        where: {
          createdAt: {
            gte: start,
            lte: end,
          },
          direction: 'OUTGOING',
        },
      });

      const metrics = {
        totalSent: messages.length,
        delivered: messages.filter(m => m.status === 'delivered').length,
        read: messages.filter(m => m.status === 'read').length,
        failed: messages.filter(m => m.status === 'failed').length,
        pending: messages.filter(m => ['queued', 'sending'].includes(m.status)).length,
        
        deliveryRate: (messages.filter(m => m.status === 'delivered').length / messages.length * 100).toFixed(2) + '%',
        readRate: (messages.filter(m => m.status === 'read').length / messages.length * 100).toFixed(2) + '%',
        failureRate: (messages.filter(m => m.status === 'failed').length / messages.length * 100).toFixed(2) + '%',
        
        averageDeliveryTime: Math.round(
          messages
            .filter(m => m.deliveredAt)
            .reduce((sum, m) => sum + (m.deliveredAt - m.createdAt), 0) / 
          messages.filter(m => m.deliveredAt).length / 1000
        ) + 's',
      };

      res.json(metrics);
    } catch (error) {
      logger.error('Error calculating delivery metrics', {
        error: error.message,
      });
      res.status(500).json({ error: 'Failed to calculate metrics' });
    }
  }
);
```

---

## Environment Configuration

### Complete Production .env

Create/update `backend/.env`:

```env
# =============================================================================
# SERVER CONFIGURATION
# =============================================================================
NODE_ENV=production
PORT=5000
DOMAIN=yourdomain.com

# =============================================================================
# DATABASE
# =============================================================================
DATABASE_URL=postgresql://user:password@db-host:5432/whatsapp_ordering

# =============================================================================
# REDIS (for queue and caching)
# =============================================================================
REDIS_HOST=redis-host.internal
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here

# =============================================================================
# JWT CONFIGURATION
# =============================================================================
JWT_SECRET=your_jwt_secret_here_generate_with_crypto.randomBytes(32).toString('hex')
JWT_ACCESS_EXPIRATION_MINUTES=30
JWT_REFRESH_EXPIRATION_DAYS=30

# =============================================================================
# TWILIO WHATSAPP CONFIGURATION (PRODUCTION)
# =============================================================================

# Get from: Twilio Console → Account Info
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_full_auth_token_here

# Your verified business WhatsApp number
TWILIO_WHATSAPP_FROM=whatsapp:+1234567890

# CRITICAL: Must match EXACTLY what you configured in Twilio
WEBHOOK_URL=https://api.yourdomain.com/api/v1/whatsapp/webhook
STATUS_CALLBACK_URL=https://api.yourdomain.com/api/v1/whatsapp/status

# Twilio security parameters
TWILIO_CLOCK_SKEW_MS=30000
TWILIO_NONCE_WINDOW_MS=300000

# Force webhook verification in production
FORCE_TWILIO_VERIFY=true

# =============================================================================
# ADMIN CONFIGURATION
# =============================================================================
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=strong_password_here

# =============================================================================
# SECURITY
# =============================================================================
API_KEY_PREFIX=sk_live_
HTTPS_ONLY=true

# IP Allowlist (optional, for extra security)
ALLOWED_IPS=1.1.1.1,2.2.2.2

# =============================================================================
# LOGGING
# =============================================================================
LOG_LEVEL=info
LOG_FORMAT=json

# =============================================================================
# MONITORING (Optional)
# =============================================================================
SENTRY_DSN=your_sentry_dsn_for_error_tracking
DATADOG_API_KEY=your_datadog_key_if_using_datadog
```

### Secrets Management Best Practices

**Use environment-specific secret management:**

**Option 1: Docker Secrets (Swarm)**
```bash
# Store secrets securely
docker secret create twilio_auth_token -
docker secret create jwt_secret -
```

**Option 2: Kubernetes Secrets**
```bash
kubectl create secret generic whatsapp-secrets \
  --from-literal=twilio-auth-token=value \
  --from-literal=jwt-secret=value
```

**Option 3: HashiCorp Vault**
```bash
vault kv put secret/whatsapp \
  twilio_auth_token=value \
  jwt_secret=value
```

**Option 4: AWS Secrets Manager**
```bash
aws secretsmanager create-secret \
  --name whatsapp/production \
  --secret-string '{"twilio_auth_token":"value","jwt_secret":"value"}'
```

---

## Verification Checklist

### ✅ Pre-Production Verification

- [ ] Twilio account upgraded to production
- [ ] Business phone number verified and activated
- [ ] HTTPS certificate valid (not self-signed)
- [ ] Domain properly configured with DNS
- [ ] SSL/TLS certificate from trusted CA

### ✅ Webhook Configuration

- [ ] Webhook URL accessible from internet
- [ ] Returns 200 OK on GET request
- [ ] Twilio status shows ✅ Verified
- [ ] Message status callback URL configured
- [ ] Both POST and GET methods supported

### ✅ Secrets & Security

- [ ] TWILIO_AUTH_TOKEN stored securely
- [ ] JWT_SECRET not hardcoded
- [ ] API keys generated with crypto (32+ chars)
- [ ] Secrets rotated quarterly
- [ ] No credentials in Git repository

### ✅ Database

- [ ] Prisma migrations applied
- [ ] Message status tables created
- [ ] Status logs table created
- [ ] Indexes created for performance
- [ ] Database backups configured

### ✅ Message Features

- [ ] Message sending tested with real number
- [ ] Status callbacks received and processed
- [ ] Delivery timestamps recorded
- [ ] Read receipts tracked (if enabled)
- [ ] Error handling for failed messages

### ✅ Monitoring

- [ ] Logs configured (json format)
- [ ] Error tracking enabled (Sentry/Datadog)
- [ ] Message delivery metrics collecting
- [ ] Alerts set up for failures
- [ ] Dashboard displays real-time stats

### ✅ Testing Commands

```bash
# Test 1: Webhook accessibility
curl -I https://api.yourdomain.com/api/v1/whatsapp/webhook

# Test 2: Send test message (requires JWT token)
curl -X POST https://api.yourdomain.com/api/v1/whatsapp/send \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+your_test_number",
    "message": "Production test message"
  }'

# Test 3: Check message status
curl https://api.yourdomain.com/api/v1/whatsapp/delivery-metrics \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test 4: Verify Twilio connection
node backend/twilio-diagnostic.js
```

---

## Troubleshooting

### Issue: "Invalid Signature" Error

**Cause:** WEBHOOK_URL doesn't match Twilio configuration

**Solution:**
```bash
# 1. Get EXACT URL from Twilio Console
# 2. Update .env: WEBHOOK_URL=exact_url_here
# 3. Restart application: npm restart

# 4. Verify with:
echo $WEBHOOK_URL
```

### Issue: Webhook Not Receiving Messages

**Cause:** Webhook not configured in Twilio

**Solution:**
1. Go to Twilio Console
2. Messaging → WhatsApp Senders → Your Number
3. Verify "When a message comes in" field has your URL
4. Click "Save" to confirm
5. Wait 30 seconds and test

### Issue: Messages Not Delivered (Failed Status)

**Cause:** Invalid phone number or service restrictions

**Solution:**
```bash
# 1. Check phone number format
# Should be: +1234567890 (with country code)

# 2. Check recipient is in allowed country
# WhatsApp Business API has regional restrictions

# 3. Check error code
SELECT * FROM "WhatsAppMessage" 
WHERE status = 'failed' 
ORDER BY "createdAt" DESC 
LIMIT 5;

# 4. Check Twilio error documentation for specific code
```

### Issue: Status Callbacks Not Working

**Cause:** Status callback URL not configured

**Solution:**
```bash
# 1. Configure in Twilio
# Messaging → WhatsApp Senders → Your Number
# Find: "Status Callback URL"
# Enter: https://api.yourdomain.com/api/v1/whatsapp/status

# 2. Verify endpoint exists:
curl -I https://api.yourdomain.com/api/v1/whatsapp/status

# 3. Check logs:
tail -f logs/whatsapp.log | grep status
```

### Issue: High Latency in Delivery

**Cause:** Queue processing delays or network issues

**Solution:**
```bash
# 1. Check queue system
# For Bull/Redis queue:
redis-cli

> LLEN bull:whatsapp:queued
> LRANGE bull:whatsapp:queued 0 10

# 2. Check database performance
EXPLAIN ANALYZE 
SELECT * FROM "WhatsAppMessage" 
WHERE status = 'queued' 
ORDER BY "createdAt" ASC;

# 3. Increase workers if needed
# Update .env: WHATSAPP_WORKERS=5 (default 1)
```

### Emergency: Auth Token Compromise

**Immediate Actions:**

```bash
# 1. Revoke compromised token immediately
# Twilio Console → Account Info → Revoke Token

# 2. Generate new token
# Twilio Console → Account Info → Generate New Token

# 3. Update application
export TWILIO_AUTH_TOKEN=new_token_here
npm restart

# 4. Monitor logs for suspicious activity
grep -i "unauthorized\|invalid\|error" logs/app.log | tail -50

# 5. Rotate other secrets
# JWT_SECRET, API_KEYS, Database passwords
```

---

## Support & Resources

- **Twilio Docs:** https://www.twilio.com/docs/whatsapp
- **Twilio Console:** https://www.twilio.com/console
- **Status Codes:** https://www.twilio.com/docs/sms/api/message-resource#message-status-values
- **Error Codes:** https://www.twilio.com/docs/api/errors

---

**Last Updated:** January 22, 2026  
**Maintained By:** WhatsApp Integration Team  
**Version:** 1.0.0
