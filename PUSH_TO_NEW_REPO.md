# Push to New GitHub Repository

## Step 1: Create New GitHub Repository

1. Go to https://github.com/new
2. Create a new repository (e.g., `whatsapp-ordering-production`)
3. **DO NOT** initialize with README, .gitignore, or license
4. Copy the repository URL (e.g., `https://github.com/YOUR_USERNAME/whatsapp-ordering-production.git`)

## Step 2: Push Code to New Repository

### Option A: Using PowerShell Script (Recommended)

```powershell
.\push-to-new-github.ps1 -RepoUrl "https://github.com/YOUR_USERNAME/YOUR_REPO.git"
```

### Option B: Manual Commands

```bash
# Remove old remote (if exists)
git remote remove new-repo

# Add your new repository
git remote add new-repo https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Commit latest changes
git add .
git commit -m "Complete WhatsApp ordering system with launch control"

# Push to new repository
git push new-repo main --force
```

## Step 3: Deploy on Render.com

### Method 1: Using render.yaml (Recommended)

1. Go to https://render.com
2. Click "New +" → "Blueprint"
3. Connect your new GitHub repository
4. Render will automatically detect `render.yaml`
5. Set environment variables:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
   ```
6. Click "Apply" to deploy

### Method 2: Manual Web Service Setup

1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your new GitHub repository
4. Configure:
   - **Name**: whatsapp-ordering-backend
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `npx prisma migrate deploy && node src/app.js`
5. Set environment variables (same as above)
6. Click "Create Web Service"

### Method 3: Docker Deployment

If Render detects the Dockerfile:
1. Select "Docker" as runtime
2. Set environment variables
3. Deploy

## Step 4: Verify Deployment

Once deployed, test these endpoints:

```bash
# Health check
curl https://your-app.onrender.com/health

# Launch control metrics (requires admin auth)
curl https://your-app.onrender.com/api/v1/launch-control/metrics
```

## Step 5: Configure Twilio Webhook

Update your Twilio WhatsApp webhook URL to:
```
https://your-app.onrender.com/api/v1/whatsapp/webhook
```

## Troubleshooting

### Permission Denied Error
- Make sure you have write access to the repository
- Use your own GitHub account's repository
- Check that you're logged in to GitHub

### Build Fails
- Check that `backend/prisma/schema.prisma` exists
- Verify `backend/package.json` is valid
- Review build logs in Render dashboard

### Database Connection Issues
- Ensure DATABASE_URL is set in Render environment variables
- Check that PostgreSQL database is created
- Verify migrations run successfully

## What's Included

✅ **Complete WhatsApp Ordering System**
- WhatsApp bot integration (Twilio)
- Order management system
- Multi-vendor routing
- Credit system with ledger
- Admin dashboard

✅ **Launch Control System**
- Real-time platform controls
- Risk management (MAX_DAILY_ORDERS, MAX_CREDIT_PER_RETAILER, etc.)
- Feature flags (ENABLE_NEW_RETAILER_SIGNUP, ENABLE_VENDOR_BIDDING, etc.)
- Emergency controls (EMERGENCY_STOP, MAINTENANCE_MODE, READ_ONLY_MODE)
- Live metrics dashboard
- Complete audit trail

✅ **Production Ready**
- PostgreSQL database with comprehensive schema
- Redis for caching and queues
- Security middleware (Helmet, CORS, rate limiting)
- Health checks and monitoring
- Error handling and logging
- Background job processing

## Support

For issues or questions:
1. Check Render build logs
2. Review application logs
3. Test API endpoints individually
4. Verify environment variables are set correctly