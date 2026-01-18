# 🚀 Deployment Guide: Render.com

Follow these steps to put your WhatsApp Ordering System online permanently.

### 1. Push to GitHub
Ensure all your current changes are pushed to your GitHub repository.
```bash
git add .
git commit -m "chore: production hardening and CommonJS fix"
git push origin main
```

### 2. Create a Database on Render
1.  Log in to [Render.com](https://render.com).
2.  Click **New +** > **PostgreSQL**.
3.  Name it `wholesaler-db`.
4.  Once created, copy the **Internal Database URL** (for internal use) or **External Database URL** (for setup).

### 3. Create the Web Service
1.  Click **New +** > **Web Service**.
2.  Connect your GitHub repository.
3.  **Name**: `whatsapp-backend`
4.  **Region**: `Singapore` (closest to Nepal) or `Oregon/Ohio`.
5.  **Runtime**: `Node`
6.  **Root Directory**: `backend` (CRITICAL)
7.  **Build Command**: `npm install && npx prisma generate`
8.  **Start Command**: `npm start`

### 4. Advanced Settings (Environment Variables)
Add these keys in the **Environment** tab:
| Key | Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | *Your Render PostgreSQL URL* |
| `JWT_SECRET` | *Generate a random sequence* |
| `TWILIO_ACCOUNT_SID` | *From Twilio Console* |
| `TWILIO_AUTH_TOKEN` | *From Twilio Console* |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` (or your number) |
| `OPENAI_API_KEY` | *Your OpenAI Key (Required for Image Orders)* |

### 5. Final Webhook Setup
Once Render says **"Live"** ✅:
1.  Copy your service URL (e.g., `https://whatsapp-backend.onrender.com`).
2.  Go to your **Twilio Console** > **Messaging** > **Sandboxes**.
3.  Update the "When a message comes in" URL to:
    `https://your-service-name.onrender.com/api/v1/whatsapp/webhook`
4.  Save.

---

### 💡 Troubleshooting
*   **DB Migrations**: If you see "Table not found", run `npx prisma db push` once from your local machine pointing to the Render DB URL to sync the schema.
*   **Logs**: Check the **Logs** tab in Render to see if the server started correctly.
*   **Port**: Render automatically handles the port, but ensure your code uses `process.env.PORT || 5000`.
