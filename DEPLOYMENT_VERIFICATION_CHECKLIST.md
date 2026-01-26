# ✅ RENDER DEPLOYMENT CHECKLIST

**Use this to verify everything is set up correctly**

---

## 📋 Pre-Deployment Checklist

### GitHub Repository
- [ ] Code committed: `git push origin main`
- [ ] All files pushed (backend/, frontend/, docker-compose.yml, etc.)
- [ ] No uncommitted changes

### Render Dashboard Setup

#### Web Service (Node Backend)
- [ ] Created new Web Service
- [ ] Repository connected: `whatsapp-ordering-system`
- [ ] Branch: `main`
- [ ] Build Command: `npm ci && npx prisma generate && npx prisma migrate deploy`
- [ ] Start Command: `node backend/src/app.js`
- [ ] Region: Selected (e.g., Oregon)

#### PostgreSQL Database
- [ ] Created new PostgreSQL service
- [ ] Name: `whatsapp-db`
- [ ] Database: `whatsapp_ordering`
- [ ] Region: Same as Web Service
- [ ] Status: Green/Running
- [ ] **Internal Database URL copied**

#### Redis Cache
- [ ] Created new Redis service
- [ ] Name: `whatsapp-redis`
- [ ] Region: Same as Web Service
- [ ] Status: Green/Running
- [ ] Hostname noted (e.g., `whatsapp-redis`)

### Environment Variables in Render

Go to **Web Service** → **Environment** tab and verify:

- [ ] `DATABASE_URL` = PostgreSQL Internal URL (starts with `postgresql://`)
- [ ] `REDIS_HOST` = Redis hostname (e.g., `whatsapp-redis`)
- [ ] `REDIS_PORT` = `6379`
- [ ] `REDIS_PASSWORD` = (blank)
- [ ] `NODE_ENV` = `production`
- [ ] `PORT` = `5000`
- [ ] `DOMAIN` = Your Render backend URL (e.g., `whatsapp-backend-xxx.onrender.com`)
- [ ] `JWT_SECRET` = Set (long random string)
- [ ] `TWILIO_ACCOUNT_SID` = Your Twilio Account SID
- [ ] `TWILIO_AUTH_TOKEN` = Your Twilio Auth Token
- [ ] `TWILIO_PHONE_NUMBER` = `+14155238886`
- [ ] `TWILIO_WHATSAPP_NUMBER` = `+14155238886`
- [ ] `WEBHOOK_URL` = `https://your-render-url.onrender.com/api/v1/whatsapp/webhook`

---

## 🚀 Deployment Status

### Check Render Logs

Go to **Web Service** → **Logs** tab:

**Look for these success messages**:

```
✅ Build successful
✅ Database connection established
✅ Prisma migrations complete
✅ Redis connection established
✅ Server running on port 5000
✅ All API routes loaded
✅ BullMQ queues initialized
```

**Common errors to look for**:

| Error | Fix |
|-------|-----|
| `ENOTFOUND postgresql` | Set `DATABASE_URL` env var |
| `ENOTFOUND redis` | Set `REDIS_HOST` env var |
| `connection refused` | Wait 2-3 min for services to start |
| `EACCES permission denied` | Check GitHub permissions in Render |
| `Prisma migration failed` | Database schema issue - check logs |

---

## ✅ Post-Deployment Verification

- [ ] Backend logs show no errors
- [ ] Get your **Render backend URL** from dashboard
- [ ] **Update Twilio Console** webhook URL:
  ```
  https://your-render-url.onrender.com/api/v1/whatsapp/webhook
  ```
- [ ] Send test WhatsApp message from personal phone
- [ ] Check Render logs for:
  ```
  POST /api/v1/whatsapp/webhook 200
  ✅ Webhook received and acknowledged to Twilio
  ```

---

## 🆘 Troubleshooting

### Deployment keeps failing

1. **Check Render build logs** (most important!)
2. Look for specific error message
3. Common causes:
   - Missing env var (see Environment Variables section)
   - Prisma migration error (database schema issue)
   - npm install failure (missing dependency)

### Services not connecting

1. Check PostgreSQL service is **green/running**
2. Check Redis service is **green/running**
3. Check env vars match service names
4. Wait 3-5 minutes for services to fully initialize

### Webhook not receiving messages

1. Verify `WEBHOOK_URL` in env var matches Twilio Console
2. Verify Twilio webhook URL ends with `/api/v1/whatsapp/webhook`
3. Check backend logs for 403 or 500 errors
4. Verify `TWILIO_AUTH_TOKEN` is correct (copy from Twilio Console)

---

## 📞 Support Resources

- **Render Docs**: https://render.com/docs
- **Twilio Console**: https://www.twilio.com/console
- **Check Render Logs**: Web Service → Logs tab

---

**Status**: Follow this checklist to verify complete deployment
