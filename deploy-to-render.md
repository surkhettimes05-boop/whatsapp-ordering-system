# Deploy to Render.com - Step by Step Guide

## Prerequisites
1. GitHub repository: https://github.com/surkhettimes05-boop/whatsapp-ordering-system
2. Render.com account
3. All files committed to GitHub

## Step 1: Commit All Changes to GitHub

```bash
# Add all files
git add .

# Commit with message
git commit -m "Add launch control system and fix deployment configuration"

# Push to GitHub
git push origin main
```

## Step 2: Deploy on Render.com

1. **Login to Render.com**
   - Go to https://render.com
   - Login with your account

2. **Create New Service**
   - Click "New +"
   - Select "Blueprint"
   - Connect your GitHub repository: `surkhettimes05-boop/whatsapp-ordering-system`

3. **Configure Environment Variables**
   Set these environment variables in Render dashboard:
   
   **Required:**
   - `TWILIO_ACCOUNT_SID`: Your Twilio Account SID
   - `TWILIO_AUTH_TOKEN`: Your Twilio Auth Token  
   - `TWILIO_WHATSAPP_FROM`: Your Twilio WhatsApp number (e.g., whatsapp:+14155238886)

   **Optional (for production features):**
   - `ALERT_EMAIL_TO`: admin@yourdomain.com
   - `ALERT_SLACK_WEBHOOK`: Your Slack webhook URL

## Step 3: Verify Deployment

1. **Check Build Logs**
   - Monitor the build process in Render dashboard
   - Ensure no errors during npm install and prisma generate

2. **Test API Endpoints**
   ```bash
   # Health check
   curl https://your-app-name.onrender.com/health
   
   # Launch control metrics (requires admin auth)
   curl https://your-app-name.onrender.com/api/v1/launch-control/metrics
   ```

3. **Access Admin Dashboard**
   - Frontend URL: https://your-frontend-name.onrender.com
   - Login with admin credentials
   - Navigate to Launch Control section

## Step 4: Configure Twilio Webhook

Update your Twilio WhatsApp webhook URL to:
```
https://your-backend-name.onrender.com/api/v1/whatsapp/webhook
```

## Launch Control Features Available

✅ **Platform Controls:**
- MAX_DAILY_ORDERS: Limit daily order volume
- MAX_ACTIVE_RETAILERS: Control retailer capacity
- MAX_ACTIVE_VENDORS: Control vendor capacity
- MAX_CREDIT_PER_RETAILER: Risk management

✅ **Feature Flags:**
- ENABLE_NEW_RETAILER_SIGNUP: Control new registrations
- ENABLE_VENDOR_BIDDING: Toggle bidding system
- ENABLE_CREDIT_SYSTEM: Control credit features
- ADMIN_APPROVAL_REQUIRED: Manual approval workflow

✅ **Emergency Controls:**
- EMERGENCY_STOP: Halt all operations
- MAINTENANCE_MODE: Maintenance window
- READ_ONLY_MODE: Prevent data changes

✅ **Real-time Dashboard:**
- Live metrics and monitoring
- Control adjustment interface
- Preset configurations (Soft Launch, Beta, Full Launch)
- Audit trail and change history

## Troubleshooting

**Build Fails:**
- Check that package-lock.json exists in backend directory
- Verify all dependencies are properly listed in package.json

**Database Issues:**
- Ensure DATABASE_URL is properly set
- Check that migrations run successfully during deployment

**WhatsApp Not Working:**
- Verify Twilio credentials are correct
- Check webhook URL is properly configured
- Ensure FORCE_TWILIO_VERIFY is set to false for production

## Support

If you encounter issues:
1. Check Render build logs
2. Monitor application logs in Render dashboard
3. Test individual API endpoints
4. Verify environment variables are set correctly