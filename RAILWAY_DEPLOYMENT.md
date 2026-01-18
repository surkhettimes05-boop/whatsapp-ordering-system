# 🚂 Railway Deployment Guide

Follow these steps to make your WhatsApp Ordering System live 24/7 on Railway.

## 1. Create a Railway Project
1. Go to [Railway.app](https://railway.app/) and sign in with GitHub.
2. Click **+ New Project** > **Deploy from GitHub repo**.
3. Select your repository: `surkhet/whatsapp-ordering-system`.
4. Select the `backend` folder (if it asks for the root directory, specify `./backend`).

## 2. Add a Database
1. Inside your Railway project, click **+ Add Service** > **Database** > **Add PostgreSQL**.
2. Railway will automatically create a database for you.

## 3. Set Environment Variables
Copy these from your local `.env` file to the **Variables** tab in your Railway service:

- `DATABASE_URL`: (Railway automatically sets this for the Postgres service, but make sure it's linked to your backend).
- `TWILIO_ACCOUNT_SID`: Your Twilio SID.
- `TWILIO_AUTH_TOKEN`: Your Twilio Token.
- `TWILIO_FROM_NUMBER`: Your Twilio WhatsApp number (e.g., `whatsapp:+14155238886`).
- `JWT_SECRET`: A long random string.
- `PORT`: `5000` (Railway usually handles this, but good to have).

## 4. Build & Start Commands
Railway should detect the project automatically, but ensure these settings are correct:
- **Build Command**: `npm install && npx prisma generate`
- **Start Command**: `npm start`
- **Post-Deploy**: Run `npx prisma migrate deploy` in the Railway terminal (or add it to your start script).

## 5. Update Twilio Webhook
Once deployed, Railway will give you a public URL (e.g., `https://your-app-production.up.railway.app`).

1. Go to [Twilio Console > Messaging > Sandbox Settings](https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox).
2. Update the "When a message comes in" URL:
   `https://your-app-production.up.railway.app/api/v1/whatsapp/webhook`
3. Click **Save**.

---
**Your bot is now live and running in the cloud!** No more tunnels needed.
