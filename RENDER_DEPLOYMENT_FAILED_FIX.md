# 🐛 RENDER DEPLOYMENT TROUBLESHOOTING

Your deployment failed because of missing environment variables. This is expected - we need to set them in Render Dashboard.

---

## ⚠️ The Problem

Your `.env` file has empty values:
```env
DATABASE_URL=          # ❌ EMPTY
REDIS_HOST=            # ❌ EMPTY
```

Render needs these to be configured in the Dashboard (not in .env file).

---

## ✅ The Fix - 5 Minutes

### Step 1: Go to Render Dashboard

https://dashboard.render.com

---

### Step 2: Create PostgreSQL Database

1. Click **"New +"** → **"PostgreSQL"**
2. Fill in:
   - **Name**: `whatsapp-db`
   - **Database**: `whatsapp_ordering`
   - **Region**: Same as your backend (or close)
3. Click **"Create Database"**
4. **Wait for it to create** (takes 1-2 minutes)
5. Once green/created, **copy the "Internal Database URL"**

Example URL:
```
postgresql://user:password@whatsapp-db.xxxxx.internal:5432/whatsapp_ordering
```

---

### Step 3: Create Redis Cache

1. Click **"New +"** → **"Redis"**
2. Fill in:
   - **Name**: `whatsapp-redis`
   - **Region**: Same as backend
   - **Eviction Policy**: `noeviction`
3. Click **"Create Redis"**
4. **Wait for it to create** (takes 1-2 minutes)
5. Once created, note the **hostname** (e.g., `whatsapp-redis`)

---

### Step 4: Update Web Service Environment Variables

1. Go to your **Web Service** (not database, the Node app)
2. Click **"Environment"** tab
3. Update these variables:

```
DATABASE_URL=postgresql://user:password@whatsapp-db.xxxxx.internal:5432/whatsapp_ordering
REDIS_HOST=whatsapp-redis
REDIS_PASSWORD=
REDIS_PORT=6379
NODE_ENV=production
PORT=5000
DOMAIN=whatsapp-backend-xxx.onrender.com
JWT_SECRET=deab97f3a1af4057214585aad630ca4df5804f9059774e87432448e95473ef00
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_API_KEY=EAAWCwdiAyG8BQl8QiH5111vy0hpTcgeYUZAAhy3ALt6uuED9mkLSr6qYY8QVCkEsjnekCxf3sPLGvaQe13TxgQkAEqxkw3PMQBQjztED4Q7cPeZAenWkxJmYxvvWaL2ZCDLQZCVqHtZBAg3bPKi41k4r0uD1J9SeMqP1VZAkGIZBRBHZCX4y0pciHhH34gd3BZAuoVtYvSqmtQ1HwF8Wgo7AGH46ITx8hJNUfvObRofrUK7n22y0HNAegJeJx6Kn8jRAqkgZBmVZBWAEAX3prct4nGT
TWILIO_ACCOUNT_SID=YOUR_TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=YOUR_TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER=+14155238886
TWILIO_WHATSAPP_NUMBER=+14155238886
WEBHOOK_URL=https://whatsapp-backend-xxx.onrender.com/api/v1/whatsapp/webhook
```

**Replace these**:
- `whatsapp-db.xxxxx.internal` with your actual PostgreSQL internal URL
- `whatsapp-backend-xxx.onrender.com` with your actual Render URL
- Keep Twilio values as they are

---

### Step 5: Save & Auto-Deploy

1. Click **"Save Changes"**
2. Render auto-deploys with new environment variables
3. Watch logs for:

```
✅ Database connection established
✅ Redis connection established
✅ Prisma migrations complete
✅ Server running on port 5000
```

---

## ✅ Success Indicators

In Render **Logs** tab, you should see:

```
2026-01-26 21:30:00 [info]: 🚀 Starting database initialization..
2026-01-26 21:30:01 [info]: ✅ DATABASE_URL validation passed
2026-01-26 21:30:02 [info]: ✅ Prisma client initialized
2026-01-26 21:30:03 [info]: ✅ Database connection established
2026-01-26 21:30:04 [info]: ✅ Server running on port 5000
```

---

## 🆘 If Still Failing

Check Render logs for specific error:

### Error: "ENOTFOUND prod-redis.host"
- **Cause**: `REDIS_HOST` env var not set or wrong
- **Fix**: Set `REDIS_HOST=whatsapp-redis` (or actual hostname)

### Error: "connection refused"
- **Cause**: Database/Redis not ready yet
- **Fix**: Wait 2-3 minutes for services to fully initialize

### Error: "no such file or directory"
- **Cause**: Build command failed
- **Fix**: Check build logs, ensure `npx prisma migrate deploy` works

### Error: "permission denied"
- **Cause**: Render needs permission to deploy
- **Fix**: Reconnect GitHub in Render Dashboard

---

## 📱 After Deployment Works

1. Get your **Render backend URL** from Dashboard
2. Update **Twilio Console** webhook URL:
   ```
   https://whatsapp-backend-xxx.onrender.com/api/v1/whatsapp/webhook
   ```
3. Send test WhatsApp message
4. Verify logs show "✅ Webhook received"

---

**Next Action**: Set environment variables in Render Dashboard following Step 2-4 above
