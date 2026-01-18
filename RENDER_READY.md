# 🚀 Final Step: Fix Render Deployment

It looks like Render incorrectly guessed your project is "Elixir" (a different coding language). Let's fix your settings so it runs your Node.js code correctly.

### 1. Change the "Runtime" to Node
1.  On your Render dashboard, click on the **Settings** tab (left sidebar).
2.  Find **Runtime** (it currently says "Elixir").
3.  Change it to **Node**.

### 2. Set the Root Directory
1.  In the same **Settings** tab, find **Root Directory**.
2.  Type: `backend`
    *(This tells Render to look inside the backend folder for the code).*

### 3. Update Build & Start Commands
1.  Find **Build Command** and change it to:
    `npm install && npx prisma generate`
2.  Find **Start Command** and change it to:
    `npm start`

### 4. Add Environment Variables
1.  Go to the **Environment** tab (left sidebar).
2.  Click **Add Environment Variable** and add these from your `.env` file:
    - `DATABASE_URL`: (Use your Render Postgres URL or Neon/Supabase URL)
    - `TWILIO_ACCOUNT_SID`: (From your Twilio console)
    - `TWILIO_AUTH_TOKEN`: (From your Twilio console)
    - `TWILIO_WHATSAPP_FROM`: (e.g., `whatsapp:+14155238886`)
    - `JWT_SECRET`: (Any long random string)
    - `NODE_ENV`: `production`

### 5. Deployment Notice
Once you save, Render will try to build again. **Wait for it to say "Live" (Green dot).**

### 🔗 Your Final Webhook URL
Once it says Live, your URL will be:
**`https://whatsapp-ordering-system.onrender.com/api/v1/whatsapp/webhook`**

👉 Paste that into your **Twilio Sandbox Settings** and you are officially launched!
