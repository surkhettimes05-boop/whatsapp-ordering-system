# Twilio WhatsApp Setup Guide

## Overview
Production-ready Twilio WhatsApp integration with:
- ✅ Proper webhook handling
- ✅ Reliable message sending
- ✅ Queue support for scalability
- ✅ Comprehensive error handling
- ✅ Full logging and observability

## Prerequisites

1. **Twilio Account**
   - Sign up at https://www.twilio.com
   - Get Account SID and Auth Token
   - Enable WhatsApp Sandbox or get approved WhatsApp Business number

2. **Environment Variables**
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
   ```

## Setup Steps

### 1. Configure Twilio Webhook

1. Log in to Twilio Console
2. Go to Messaging > Settings > WhatsApp Sandbox (or WhatsApp Senders)
3. Set Webhook URL: `https://yourdomain.com/api/v1/whatsapp/webhook`
4. Set HTTP Method: `POST`
5. Save configuration

### 2. Test Webhook

```bash
# Test webhook endpoint
curl https://yourdomain.com/api/v1/whatsapp/webhook

# Should return: OK
```

### 3. Send Test Message

From your WhatsApp number, send a message to your Twilio WhatsApp number. You should receive a reply.

## Message Flow

### Incoming Messages

1. User sends message to Twilio WhatsApp number
2. Twilio sends POST request to `/api/v1/whatsapp/webhook`
3. System processes message asynchronously
4. System sends reply via Twilio API
5. User receives reply

### Outgoing Messages

1. System calls `whatsappService.sendMessage(phone, message)`
2. Message is queued (in production) or sent immediately
3. Queue worker processes message
4. Twilio API sends message
5. Message logged to database

## Testing

### Test Webhook Locally

1. Use ngrok or similar tool:
   ```bash
   ngrok http 5000
   ```

2. Update Twilio webhook URL to ngrok URL:
   ```
   https://abc123.ngrok.io/api/v1/whatsapp/webhook
   ```

3. Send test message from WhatsApp

### Test Message Sending

```javascript
const whatsappService = require('./src/services/whatsapp.service');

// Send immediate message
await whatsappService.sendMessage('+9779800000000', 'Test message', { immediate: true });

// Send via queue
await whatsappService.sendMessage('+9779800000000', 'Test message');
```

## Troubleshooting

### Messages Not Sending

1. **Check Twilio Credentials**
   ```bash
   # Verify in .env file
   echo $TWILIO_ACCOUNT_SID
   echo $TWILIO_AUTH_TOKEN
   ```

2. **Check Phone Number Format**
   - Must include country code: `+9779800000000`
   - Twilio will add `whatsapp:` prefix automatically

3. **Check Queue Worker**
   ```bash
   # Verify Redis is running
   redis-cli ping
   
   # Check queue metrics
   curl http://localhost:5000/metrics
   ```

4. **Check Logs**
   ```bash
   # Application logs
   tail -f backend/logs/app.log | grep -i whatsapp
   
   # Error logs
   tail -f backend/logs/error.log
   ```

### Webhook Not Receiving Messages

1. **Verify Webhook URL**
   - Check Twilio console
   - URL must be publicly accessible
   - Must use HTTPS in production

2. **Check IP Allowlist**
   - If enabled, add Twilio IPs to allowlist
   - Twilio IPs: https://www.twilio.com/docs/ip-addresses

3. **Check Rate Limiting**
   - Webhook has rate limiting enabled
   - Check if requests are being blocked

4. **Check Logs**
   ```bash
   # Webhook logs
   tail -f backend/logs/app.log | grep webhook
   ```

### Common Errors

1. **"Invalid phone number"**
   - Ensure phone number includes country code
   - Format: `+[country code][number]`

2. **"Unauthorized"**
   - Check Twilio credentials
   - Verify Account SID and Auth Token

3. **"Message not sent"**
   - Check Twilio account balance
   - Verify WhatsApp number is approved
   - Check if number is in sandbox mode

## Production Checklist

- [ ] Twilio credentials configured
- [ ] Webhook URL set in Twilio console
- [ ] Webhook is publicly accessible (HTTPS)
- [ ] Queue worker is running
- [ ] Redis is connected
- [ ] Error logging is working
- [ ] Message logging to database is working
- [ ] Health checks are passing
- [ ] Monitoring is set up

## Best Practices

1. **Always return 200 OK to Twilio** - Even on errors
2. **Process messages asynchronously** - Don't block webhook
3. **Use queue for non-critical messages** - Better reliability
4. **Use immediate send for user responses** - Better UX
5. **Log all messages** - For debugging and audit
6. **Handle errors gracefully** - Send user-friendly messages
7. **Monitor message delivery** - Track success/failure rates
8. **Set up alerts** - For high failure rates

## Support

For Twilio-specific issues:
- Twilio Documentation: https://www.twilio.com/docs/whatsapp
- Twilio Support: https://support.twilio.com

For application issues:
- Check logs: `backend/logs/`
- Check metrics: `/metrics`
- Review error logs: `backend/logs/error.log`
