# Testing Guide - Twilio WhatsApp Integration

## Quick Test

### 1. Test Webhook Endpoint

```bash
# Test webhook is accessible
curl https://yourdomain.com/api/v1/whatsapp/webhook

# Should return: OK
```

### 2. Test Message Sending

```bash
# Test endpoint (if available)
curl https://yourdomain.com/api/v1/whatsapp/test

# Should return:
# {
#   "success": true,
#   "message": "WhatsApp webhook is ready! 🚀",
#   "twilio": {
#     "configured": true,
#     "fromNumber": "whatsapp:+14155238886"
#   }
# }
```

### 3. Test Full Flow

1. **Send "hi" to your Twilio WhatsApp number**
   - Expected: Receive main menu

2. **Send "1" or "view catalog"**
   - Expected: Receive product list

3. **Send "1 x 10" (Product 1, Quantity 10)**
   - Expected: Item added confirmation

4. **Send "place order"**
   - Expected: Order summary with confirmation prompt

5. **Send "yes"**
   - Expected: Order processing message, then order submitted confirmation

## Troubleshooting

### Messages Not Sending

1. **Check Environment Variables**
   ```bash
   echo $TWILIO_ACCOUNT_SID
   echo $TWILIO_AUTH_TOKEN
   echo $TWILIO_WHATSAPP_FROM
   ```

2. **Check Logs**
   ```bash
   # Application logs
   tail -f backend/logs/app.log | grep -i whatsapp
   
   # Error logs
   tail -f backend/logs/error.log
   ```

3. **Check Queue**
   ```bash
   # If using queue, check Redis
   redis-cli ping
   
   # Check queue metrics
   curl http://localhost:5000/metrics | grep whatsapp
   ```

### Webhook Not Receiving

1. **Verify Webhook URL in Twilio**
   - Must be publicly accessible
   - Must use HTTPS in production

2. **Check IP Allowlist**
   - If enabled, ensure Twilio IPs are allowed
   - Or disable for webhook endpoint

3. **Check Rate Limiting**
   - Webhook has rate limiting
   - May need to adjust limits

### Common Issues

1. **"Invalid phone number"**
   - Ensure format: `+[country code][number]`
   - Example: `+9779800000000`

2. **"Unauthorized"**
   - Check Twilio credentials
   - Verify Account SID and Auth Token

3. **"Message not sent"**
   - Check Twilio account balance
   - Verify WhatsApp number is approved
   - Check if in sandbox mode

## Production Checklist

- [ ] Twilio credentials configured
- [ ] Webhook URL set in Twilio console
- [ ] Webhook is publicly accessible (HTTPS)
- [ ] Test message sent and received
- [ ] Queue worker running (if using queue)
- [ ] Redis connected (if using queue)
- [ ] Error logging working
- [ ] Message logging to database working
- [ ] Health checks passing
