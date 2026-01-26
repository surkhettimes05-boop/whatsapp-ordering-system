# 🎯 DEPLOY NOW - COPY-PASTE COMMANDS

**Ready to deploy?** Follow these commands exactly.

---

## Step 1: Commit & Push Code

```bash
cd c:\Users\QCS\Desktop\whatsapp-ordering-system

# Stage all changes
git add .

# Commit with message
git commit -m "Prepare for production deployment to Render"

# Push to GitHub
git push origin main
```

---

## Step 2: Go to Render.com

1. Open https://dashboard.render.com in browser
2. Sign in or create account
3. Continue with "Step 3" below

---

## Step 3: Create New Web Service

Click **"New +"** button → Select **"Web Service"**

**Select Repository**: `whatsapp-ordering-system`

**Fill Form**:
- **Name**: `whatsapp-backend`
- **Runtime**: `Node`
- **Build Command**: `npm ci && npx prisma generate && npx prisma migrate deploy`
- **Start Command**: `node backend/src/app.js`

---

## Step 4: Create PostgreSQL Database

Click **"New +"** → **"PostgreSQL"**

**Configuration**:
- **Name**: `whatsapp-db`
- **Database**: `whatsapp_ordering`
- **User**: `postgres`
- **Region**: Oregon (or near you)

**After creation**: Copy "Internal Database URL"

---

## Step 5: Create Redis Cache

Click **"New +"** → **"Redis"**

**Configuration**:
- **Name**: `whatsapp-redis`
- **Region**: Same as backend
- **Eviction Policy**: `noeviction`

**After creation**: Note the hostname (e.g., `whatsapp-redis`)

---

## Step 6: Configure Environment Variables

Go to your **Web Service** → **Environment** tab

**Add these variables**:

```
DATABASE_URL=<paste the PostgreSQL Internal URL here>
REDIS_HOST=whatsapp-redis
REDIS_PASSWORD=<leave blank>
REDIS_PORT=6379
NODE_ENV=production
PORT=5000
DOMAIN=whatsapp-backend-xxx.onrender.com
JWT_SECRET=deab97f3a1af4057214585aad630ca4df5804f9059774e87432448e95473ef00
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_API_KEY=EAAWCwdiAyG8BQl8QiH5111vy0hpTcgeYUZAAhy3ALt6uuED9mkLSr6qYY8QVCkEsjnekCxf3sPLGvaQe13TxgQkAEqxkw3PMQBQjztED4Q7cPeZAenWkxJmYxvvWaL2ZCDLQZCVqHtZBAg3bPKi41k4r0uD1J9SeMqP1VZAkGIZBRBHZCX4y0pciHhH34gd3BZAuoVtYvSqmtQ1HwF8Wgo7AGH46ITx8hJNUfvObRofrUK7n22y0HNAegJeJx6Kn8jRAqkgZBmVZBWAEAX3prct4nGT
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+14155238886
WEBHOOK_URL=https://whatsapp-backend-xxx.onrender.com/api/v1/whatsapp/webhook
```

**Replace**:
- `whatsapp-backend-xxx.onrender.com` with your actual Render URL (shown in Render Dashboard)
- `TWILIO_ACCOUNT_SID` with real value from Twilio Console
- `TWILIO_AUTH_TOKEN` with real value from Twilio Console

---

## Step 7: Click Deploy!

Click **"Create Web Service"** button

**Wait for logs** to show:
```
✅ Build successful
✅ Prisma migrations complete
✅ Server running on port 5000
```

---

## Step 8: Update Twilio Console

1. Go to https://www.twilio.com/console
2. Messaging → Services → WhatsApp Sandbox
3. Find "When a message comes in" webhook field
4. Enter: `https://whatsapp-backend-xxx.onrender.com/api/v1/whatsapp/webhook`
5. Change to POST method
6. Click Save

---

## ✅ Verify Deployment

Send a test WhatsApp message from your phone to Twilio sandbox number.

Expected result in Render logs:
```
POST /api/v1/whatsapp/webhook 200 OK
✅ Webhook received and acknowledged to Twilio
✅ Message processed successfully
```

---

## 🎉 You're Live!

Your WhatsApp API is now running on Render production! 🚀

**Your backend URL**: `https://whatsapp-backend-xxx.onrender.com`

---

## 🆘 Troubleshooting

### Build Failed
- Check Render logs for specific error
- Ensure `npm ci` works locally: `cd backend && npm ci`
- Ensure Prisma schema is valid: `npx prisma validate`

### Can't Connect to Database
- Verify `DATABASE_URL` env var is set
- Check PostgreSQL service status (should be green)
- Wait 30 seconds after creating database

### Webhook Not Receiving Messages
- Verify Twilio webhook URL exactly matches
- Check backend logs for 403/500 errors
- Ensure `TWILIO_AUTH_TOKEN` is correct

---

**Questions?** See:
- [RENDER_DEPLOYMENT_QUICK_START.md](RENDER_DEPLOYMENT_QUICK_START.md)
- [TWILIO_WEBHOOK_SETUP_FIX.md](TWILIO_WEBHOOK_SETUP_FIX.md)

---

**Status**: ✅ Ready to deploy
**Last Updated**: January 26, 2026
