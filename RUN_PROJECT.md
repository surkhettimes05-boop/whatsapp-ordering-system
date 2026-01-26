# 🚀 How to Run the Project

## Quick Start (Both Servers)

### Option 1: Run Both Servers (Recommended)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Backend will run on: **http://localhost:5000**

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install  # First time only
npm run dev
```
Frontend will run on: **http://localhost:3000**

---

## Step-by-Step Instructions

### Step 1: Start Backend Server

1. Open a terminal/command prompt
2. Navigate to backend directory:
   ```bash
   cd backend
   ```
3. Install dependencies (if not already done):
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm run dev
   ```

You should see:
```
✅ Database connected successfully
================================
🚀 Server running on port 5000
📍 Health check: http://localhost:5000/health
📍 API Base: http://localhost:5000/api/v1
================================
```

### Step 2: Start Frontend Dashboard

1. Open a **NEW** terminal/command prompt
2. Navigate to frontend directory:
   ```bash
   cd frontend
   ```
3. Install dependencies (first time only):
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

You should see:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
```

### Step 3: Access the Dashboard

1. Open your browser
2. Go to: **http://localhost:3000**
3. Login with your admin credentials

---

## Verify Everything is Working

### Test Backend:
- Health Check: http://localhost:5000/health
- API Products: http://localhost:5000/api/v1/products

### Test Frontend:
- Dashboard: http://localhost:3000
- Login Page: http://localhost:3000/login

---

## Troubleshooting

### Backend won't start?

1. **Check if port 5000 is in use:**
   ```bash
   # Windows
   netstat -ano | findstr :5000
   
   # Change port in backend/.env:
   PORT=3001
   ```

2. **Database connection failed?**
   - Make sure PostgreSQL is running
   - Check `DATABASE_URL` in `backend/.env`
   - Run: `npx prisma migrate dev`

3. **Dependencies missing?**
   ```bash
   cd backend
   npm install
   ```

### Frontend won't start?

1. **Dependencies not installed?**
   ```bash
   cd frontend
   npm install
   ```

2. **Port 3000 in use?**
   - Vite will automatically use next available port
   - Or change in `frontend/vite.config.js`

3. **Can't connect to backend?**
   - Make sure backend is running on port 5000
   - Check `frontend/vite.config.js` proxy settings

---

## Production Build

### Build Frontend:
```bash
cd frontend
npm run build
```

### Start Backend (Production):
```bash
cd backend
npm start
```

---

## Default URLs

- **Backend API**: http://localhost:5000
- **Frontend Dashboard**: http://localhost:3000
- **Health Check**: http://localhost:5000/health
- **API Base**: http://localhost:5000/api/v1

---

## What's Running?

✅ **Backend Server** - Node.js/Express API
✅ **Frontend Dashboard** - React Admin Panel
✅ **Database** - PostgreSQL (via Prisma)
✅ **File Storage** - Local uploads directory

---

## Need Help?

- Check `backend/README.md` for API documentation
- Check `frontend/README.md` for frontend details
- Check `backend/QUICK_START.md` for troubleshooting

