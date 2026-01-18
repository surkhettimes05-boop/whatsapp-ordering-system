# WhatsApp Business API Setup Guide

## Step 1: Get WhatsApp Business API Credentials

1. **Go to Meta for Developers**
   - Visit: https://developers.facebook.com/
   - Create a Facebook Business Account (if you don't have one)

2. **Create a Meta App**
   - Click "My Apps" → "Create App"
   - Choose "Business" type
   - Fill in app details

3. **Add WhatsApp Product**
   - In your app dashboard, click "Add Product"
   - Find "WhatsApp" and click "Set Up"
   - Follow the setup wizard

4. **Get Your Credentials**
   - **Phone Number ID**: Found in WhatsApp → API Setup
   - **Access Token**: Click "Generate Token" (temporary) or set up permanent token
   - **Verify Token**: Create your own (e.g., "my_secure_verify_token_123")

## Step 2: Configure Environment Variables

Edit your `backend/.env` file:

```env
# WhatsApp Business API Configuration
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_ACCESS_TOKEN=your_access_token_here
WHATSAPP_VERIFY_TOKEN=my_secure_verify_token_123
```

## Step 3: Set Up Webhook

### For Local Development (using ngrok):

1. **Install ngrok**: https://ngrok.com/download
2. **Start your backend server**: `npm run dev`
3. **Expose your local server**:
   ```bash
   ngrok http 5000
   ```
4. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

### Configure Webhook in Meta:

1. Go to WhatsApp → Configuration → Webhook
2. Click "Edit" or "Add Callback URL"
3. Enter:
   - **Callback URL**: `https://your-domain.com/api/v1/whatsapp/webhook`
   - **Verify Token**: `my_secure_verify_token_123` (same as in .env)
4. Click "Verify and Save"
5. Subscribe to `messages` field

## Step 4: Test Webhook

### Test Verification (GET):
```bash
curl "http://localhost:5000/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=my_secure_verify_token_123&hub.challenge=test123"
```

Should return: `test123`

### Test Sending Message:
```bash
curl -X POST http://localhost:5000/api/v1/whatsapp/send \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "message": "Hello from API!"
  }'
```

## Step 5: Test with Real WhatsApp

1. Send a message to your WhatsApp Business number
2. Check server logs for incoming message
3. You should receive an automated response

## Troubleshooting

### Webhook Verification Fails
- Check `WHATSAPP_VERIFY_TOKEN` matches exactly
- Ensure webhook URL is accessible (use ngrok for local)
- Check server logs for errors

### Messages Not Received
- Verify webhook is subscribed to `messages` field
- Check access token is valid
- Ensure phone number is registered with WhatsApp Business API

### Cannot Send Messages
- Verify access token has `whatsapp_business_messaging` permission
- Check phone number ID is correct
- Ensure recipient number is registered with WhatsApp

## Production Setup

1. **Use Permanent Access Token**
   - Set up System User in Business Settings
   - Generate permanent token with proper permissions

2. **Use Production Domain**
   - Deploy backend to production server
   - Update webhook URL to production domain
   - Use HTTPS (required by Meta)

3. **Security**
   - Keep access token secure
   - Use environment variables (never commit to git)
   - Rotate tokens regularly

## Quick Test Script

See `test-whatsapp.js` for automated testing.

