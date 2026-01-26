# 🚀 DEPLOY TO RENDER - QUICK START

**Status**: Code ready for Render deployment  
**Time**: 10 minutes  
**Result**: Live WhatsApp API running on production

---

## ⚡ 3 Steps to Deploy

### Step 1: Connect GitHub Repository

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Select **"Deploy an existing repository"**
4. Connect your GitHub account (authorize if needed)
5. Select your `whatsapp-ordering-system` repository
6. Click **"Connect"**

**Branch**: `main` (or your active branch)

---

### Step 2: Configure Render Service

Fill in the form:

| Field | Value |
|-------|-------|
| **Name** | `whatsapp-backend` |
| **Environment** | `Node` |
| **Region** | `Oregon` (or closest to you) |
| **Branch** | `main` |
| **Build Command** | `npm ci && npx prisma generate && npx prisma migrate deploy` |
| **Start Command** | `node backend/src/app.js` |
| **Instance Type** | `Starter` (free tier) |

---

### Step 3: Add Environment Variables

Click **"Environment"** tab, then add these variables:

```
DATABASE_URL=
REDIS_HOST=
REDIS_PASSWORD=
REDIS_PORT=6379
NODE_ENV=production
PORT=5000
DOMAIN=your-backend-url.onrender.com
JWT_SECRET=deab97f3a1af4057214585aad630ca4df5804f9059774e87432448e95473ef00
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+14155238886
WEBHOOK_URL=https://your-backend-url.onrender.com/api/v1/whatsapp/webhook
```

**Leave blank for now**:
- `DATABASE_URL` (we'll add PostgreSQL service)
- `REDIS_HOST` (we'll add Redis service)

---

### Step 4: Add PostgreSQL Database

1. In Render Dashboard, click **"New +"** → **"PostgreSQL"**
2. Fill in:
   - **Name**: `whatsapp-db`
   - **Database**: `whatsapp_ordering`
   - **User**: `postgres`
   - **Region**: Same as backend

3. Click **"Create Database"**

4. Copy the **Internal Database URL**

5. Go back to your Web Service → **"Environment"**

6. Update `DATABASE_URL` with the URL you copied

---

### Step 5: Add Redis Cache

1. Click **"New +"** → **"Redis"**
2. Fill in:
   - **Name**: `whatsapp-redis`
   - **Region**: Same as backend
   - **Eviction Policy**: `noeviction`

3. Click **"Create Redis"**

4. Copy the **Internal Redis URL**

5. Go back to Web Service → **"Environment"**

6. Update `REDIS_HOST` with the hostname from URL (e.g., `whatsapp-redis`)

---

### Step 6: Deploy

1. Click **"Create Web Service"**
2. Render auto-deploys from GitHub
3. Watch logs in Render Dashboard for:
   ```
   ✅ Prisma migrations complete
   ✅ Database connection established
   ✅ Server running on port 5000
   ```

4. Your backend is now live at: `https://whatsapp-backend-xxx.onrender.com`

---

## 🔧 Configure Twilio Webhook

Once deployed, update your Twilio Console:

1. Go to https://www.twilio.com/console
2. Messaging → Services → WhatsApp Sandbox
3. Set webhook URL to:
   ```
   https://whatsapp-backend-xxx.onrender.com/api/v1/whatsapp/webhook
   ```
4. Save

---

## ✅ Test Production

Send a WhatsApp test message to your Twilio sandbox number.

Check Render logs:
```
POST /api/v1/whatsapp/webhook 200
✅ Webhook received and acknowledged to Twilio
✅ Message processed successfully
```

---

## 📚 Additional Resources

- [Render Docs](https://render.com/docs)
- [Prisma on Render](https://render.com/docs/databases)
- [Environment Variables](https://render.com/docs/environment-variables)

---

**That's it! Your WhatsApp API is now production-ready on Render.**

---

## 🆘 If Something Goes Wrong

### Deploy fails

1. Check **"Logs"** tab in Render Dashboard
2. Common issues:
   - Missing `DATABASE_URL` env var
   - Build command failed (check Prisma errors)
   - Port conflict (should be 5000)

### No webhook response

1. Verify `WEBHOOK_URL` env var matches Twilio Console
2. Check Twilio webhook URL has `/api/v1/whatsapp/webhook` path
3. Monitor logs for 403 or 500 errors

### Database connection error

1. Ensure `DATABASE_URL` env var is set
2. Check PostgreSQL service is running (green in Render)
3. Verify database name is `whatsapp_ordering`

---

**Ready?** Push to GitHub and watch Render deploy! 🚀
