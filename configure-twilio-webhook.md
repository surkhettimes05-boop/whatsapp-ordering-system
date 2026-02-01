# 🔧 Configure Twilio WhatsApp Webhook

## ✅ Your Tunnel is Active!

**Public URL**: https://few-things-stare.loca.lt
**Webhook URL**: https://few-things-stare.loca.lt/api/v1/whatsapp/webhook

## 📱 Step-by-Step Twilio Configuration

### 1. Open Twilio Console
Go to: https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox

### 2. Configure Webhook
- **Webhook URL for Incoming Messages**: `https://few-things-stare.loca.lt/api/v1/whatsapp/webhook`
- **HTTP Method**: `POST`
- Click **"Save Configuration"**

### 3. Join WhatsApp Sandbox
On the same page, you'll see:
- **WhatsApp Number**: Usually `+1 415 523 8886`
- **Join Code**: Something like `join abc-def`

**From your phone:**
1. Send the join code to the WhatsApp number
2. Wait for confirmation message

### 4. Test Your Integration! 🧪

Send these messages to the WhatsApp sandbox number:

| Message | Expected Response |
|---------|-------------------|
| `hello` | Welcome message with commands |
| `menu` | Product catalog with prices |
| `order` | Order interface with product list |
| `1x2, 3x1` | Order confirmation for 2kg rice + 1L oil |
| `status` | Current order status |

## 🔍 Verify Everything is Working

### Check Server Status
Your server should show incoming webhook requests in the logs.

### Test Webhook Directly
```bash
curl -X POST https://rich-poems-reply.loca.lt/api/v1/whatsapp/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+1234567890&Body=hello&MessageSid=test123&NumMedia=0"
```

## ⚠️ Important Notes

1. **Keep Both Terminals Open**:
   - Terminal 1: Your server (`node whatsapp-simple-server.js`)
   - Terminal 2: Localtunnel (`lt --port 3010`)

2. **Tunnel URL Changes**: If you restart localtunnel, you'll get a new URL and need to update Twilio

3. **Server Logs**: Watch your server terminal for incoming webhook requests

## 🎯 What Happens Next

1. **Configure Twilio** (5 minutes)
2. **Join WhatsApp Sandbox** (2 minutes)  
3. **Send test message** (instant)
4. **See your bot respond** (instant)
5. **Start taking real orders!** 🚀

---

## 🆘 Troubleshooting

**If webhook doesn't work:**
- Verify tunnel URL is accessible: https://few-things-stare.loca.lt/health
- Check both server and tunnel are running
- Ensure webhook URL in Twilio is exactly: `https://few-things-stare.loca.lt/api/v1/whatsapp/webhook`

**If messages don't process:**
- Check server logs for errors
- Test locally first: `curl http://localhost:3010/health`
- Verify Twilio credentials in .env file

---

🎉 **You're almost there!** Just configure the webhook URL in Twilio and start testing!