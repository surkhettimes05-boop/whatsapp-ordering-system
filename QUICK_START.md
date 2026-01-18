# Quick Start Guide

## Fix Connection Refused Error

If you're getting `ERR_CONNECTION_REFUSED` on `localhost:5000`, follow these steps:

### 1. Check if Server is Running

```bash
# Navigate to backend directory
cd backend

# Start the server
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

### 2. If Database Connection Fails

**Check PostgreSQL:**
- Make sure PostgreSQL is installed and running
- Check if service is running: `pg_isready` (Linux/Mac) or check Services (Windows)

**Check Environment Variables:**
```bash
# Make sure .env file exists
cp .env.example .env

# Edit .env and set DATABASE_URL
DATABASE_URL="postgresql://user:password@localhost:5432/whatsapp_ordering?schema=public"
```

**Run Database Migrations:**
```bash
# Create database first (if it doesn't exist)
createdb whatsapp_ordering

# Run migrations
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate
```

### 3. If Port 5000 is Already in Use

**Option 1: Change Port**
```bash
# In .env file, set:
PORT=3000
```

**Option 2: Kill Process Using Port 5000**
```bash
# Windows PowerShell
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5000 | xargs kill
```

### 4. Test Server

Once server is running, test:
- Health check: http://localhost:5000/health
- Should return: `{"status":"ok","database":"connected",...}`

## Pagination - Show More Entries

Default pagination has been increased:
- **Default page size**: 50 entries (was 20)
- **Maximum page size**: 500 entries (was 100)

You can still override in API calls:
```
GET /api/v1/products?limit=100&page=1
GET /api/v1/orders?limit=200
```

## Common Issues

### Issue: "Cannot find module"
```bash
npm install
```

### Issue: "Prisma Client not generated"
```bash
npx prisma generate
```

### Issue: "Migration needed"
```bash
npx prisma migrate dev
```

### Issue: "Database doesn't exist"
```bash
# Create database first
createdb whatsapp_ordering  # PostgreSQL command
# Then run migrations
npx prisma migrate dev
```

## Verify Everything Works

1. **Start server**: `npm run dev`
2. **Check health**: Open http://localhost:5000/health
3. **Test API**: Try http://localhost:5000/api/v1/products

If all works, you should see JSON responses!

