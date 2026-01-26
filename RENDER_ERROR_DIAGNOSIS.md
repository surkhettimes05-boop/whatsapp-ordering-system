# 🔍 RENDER DEPLOYMENT ERROR DIAGNOSIS

**Tell me what error you see and I'll help fix it**

---

## Common Render Deployment Errors

### ❌ Error: "getaddrinfo ENOTFOUND prod-redis.host"

**Cause**: Redis hostname is wrong or not set

**Fix**:
1. Go to Render Dashboard → Web Service → Environment
2. Check `REDIS_HOST` value
3. Should be: `whatsapp-redis` (not `prod-redis.host`)
4. Save and redeploy

---

### ❌ Error: "connection refused" or "ECONNREFUSED"

**Cause**: PostgreSQL or Redis not ready yet

**Fix**:
1. Check PostgreSQL service is green/running
2. Check Redis service is green/running
3. Wait 3-5 minutes for services to initialize
4. Manually trigger redeploy in Render

---

### ❌ Error: "ENOTFOUND postgresql"

**Cause**: DATABASE_URL not set or invalid format

**Fix**:
1. Go to Render → PostgreSQL service
2. Copy "Internal Database URL"
3. Paste into Web Service → Environment → `DATABASE_URL`
4. Save and redeploy

**Expected format**:
```
postgresql://postgres:password@whatsapp-db.internal:5432/whatsapp_ordering
```

---

### ❌ Error: "FATAL: password authentication failed"

**Cause**: Wrong database password in CONNECTION URL

**Fix**:
1. Go to Render → PostgreSQL service → "Connection" tab
2. Copy exact "Internal Database URL"
3. Paste into `DATABASE_URL` env var
4. Don't modify the URL

---

### ❌ Error: "Prisma migration failed" or "Schema validation"

**Cause**: Database schema issue

**Fix**:
1. Check Render logs for detailed Prisma error
2. Run locally: `cd backend && npx prisma migrate status`
3. Common cause: Invalid schema definition (typo, syntax error)
4. Fix schema, commit, push, and Render redeploys automatically

---

### ❌ Error: "node: command not found"

**Cause**: Start command is wrong or Node not installed

**Fix**:
1. Check Start Command: `node backend/src/app.js`
2. Should NOT be: `npm start` (npm might not be available)
3. Update in Render Web Service settings
4. Manually redeploy

---

### ❌ Error: "npm ERR! code 404"

**Cause**: npm package not found (missing dependency)

**Fix**:
1. Run locally: `cd backend && npm ci`
2. Check if error occurs locally
3. If yes, fix package.json or add missing package
4. Commit, push, Render auto-redeploys

---

### ❌ Error: "Cannot find module '@prisma/client'"

**Cause**: Prisma client not generated

**Fix**:
1. Build Command should include: `npx prisma generate`
2. Your command: `npm ci && npx prisma generate && npx prisma migrate deploy`
3. This should already be correct
4. If error persists, delete `node_modules` locally and `npm ci` again

---

### ❌ Error: "Invalid environment variable"

**Cause**: Missing required env var (e.g., TWILIO_ACCOUNT_SID)

**Fix**:
1. Check app startup logs for which var is missing
2. Go to Environment tab
3. Add the missing variable
4. Redeploy

---

### ❌ Error: "Build failed" or "Build error" (no details)

**Cause**: Generic build error

**Fix**:
1. Click "Build Log" in Render to see full error
2. Look for specific error message
3. Match against errors in this guide
4. Fix and commit to GitHub

---

### ❌ Error: "GitHub connection refused"

**Cause**: Render can't access GitHub repository

**Fix**:
1. Go to Render → Account Settings
2. Reconnect GitHub
3. Authorize permissions
4. Try deploying again

---

### ❌ Error: "Permission denied" during build

**Cause**: File permissions issue or npm permission issue

**Fix**:
1. Unlikely on Render (they handle this)
2. Check if issue is in your code (file permissions in git)
3. Ensure all files are committed (not gitignored)
4. Run locally: `git status` to check

---

### ❌ Webhook not receiving messages (After deployment succeeds)

**Cause**: Twilio webhook URL not configured correctly

**Fix**:
1. Go to https://www.twilio.com/console
2. Messaging → Services → WhatsApp Sandbox
3. Check "When a message comes in" field
4. Should be: `https://your-render-url.onrender.com/api/v1/whatsapp/webhook`
5. Exact match required (including `/api/v1/whatsapp/webhook` path)
6. Change method to POST
7. Save

---

## 🔧 How to Check Render Logs

1. Go to https://dashboard.render.com
2. Click on your **Web Service** (the Node app)
3. Click **"Logs"** tab
4. Watch real-time logs
5. Look for error messages (red/pink text)
6. Copy the error and find it in this guide

---

## ✅ Success Indicators

In logs, you should see:

```
✅ Build successful
✅ Prisma migrations applied
✅ Database connected
✅ Redis connected
✅ Server running on port 5000
```

If you see these → Deployment succeeded! 🎉

---

## 📋 What to Tell Me

If you still need help, tell me:

1. **What error do you see?** (Copy exact text from Render logs)
2. **In which tab?** (Logs, Build, Deployments, etc.)
3. **When does it fail?** (During build, after start, during webhook test)
4. **What's your Render URL?** (e.g., whatsapp-backend-abc123.onrender.com)

---

**Next Action**: Check your Render logs and find your error in this guide
