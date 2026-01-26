# ⚡ RENDER DEPLOYMENT FAILED - QUICK FIX

**Your deployment failed because environment variables weren't set in Render.**

---

## 🎯 Fix in 5 Minutes

### Action 1: Check Your Render Logs

1. Go to https://dashboard.render.com
2. Click your **Web Service**
3. Click **"Logs"** tab
4. **Copy the error message** you see

---

### Action 2: Find Error in This Guide

Look for your error:
- [RENDER_ERROR_DIAGNOSIS.md](RENDER_ERROR_DIAGNOSIS.md)

---

### Action 3: Set Environment Variables

1. Go to Render Dashboard → **Web Service**
2. Click **"Environment"** tab
3. Add/Update these variables:

```
DATABASE_URL=postgresql://postgres:password@whatsapp-db.internal:5432/whatsapp_ordering
REDIS_HOST=whatsapp-redis
REDIS_PORT=6379
NODE_ENV=production
PORT=5000
DOMAIN=your-render-url.onrender.com
TWILIO_ACCOUNT_SID=YOUR_TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=YOUR_TWILIO_AUTH_TOKEN
WEBHOOK_URL=https://your-render-url.onrender.com/api/v1/whatsapp/webhook
```

4. Click **"Save Changes"**
5. Render auto-redeploys

---

### Action 4: Check Logs Again

Wait 2-3 minutes, then:

1. Logs should show:
   ```
   ✅ Build successful
   ✅ Database connected
   ✅ Server running on port 5000
   ```

2. If still failing, copy exact error and check [RENDER_ERROR_DIAGNOSIS.md](RENDER_ERROR_DIAGNOSIS.md)

---

## 📱 After Deployment Succeeds

1. Get your **Render backend URL** from dashboard
2. Go to https://www.twilio.com/console
3. Update webhook URL:
   ```
   https://your-render-url.onrender.com/api/v1/whatsapp/webhook
   ```
4. Send test WhatsApp message
5. Check Render logs for "✅ Webhook received"

---

## 🆘 Still Failing?

Tell me:
1. **Exact error from Render logs**
2. **Which tab** (Build, Logs, Deployments)
3. **When does it fail** (During build, after start)

Then I can help fix it specifically.

---

**Most likely fixes**:
- ✅ Set `DATABASE_URL` env var
- ✅ Set `REDIS_HOST` env var  
- ✅ Wait for PostgreSQL/Redis services to initialize
- ✅ Update `WEBHOOK_URL` to your Render URL

Start with these and let me know!
