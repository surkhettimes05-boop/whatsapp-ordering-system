# 🚀 WhatsApp Ordering System - Complete Quick Start

A production-ready B2B WhatsApp ordering system for Nepal's wholesale market.

## ⚡ One-Command Setup

```powershell
# Run this single command to set up everything
.\start-demo.ps1
```

This will:
- ✅ Check prerequisites (Node.js, Docker)
- ✅ Install all dependencies
- ✅ Start PostgreSQL & Redis in Docker
- ✅ Run database migrations
- ✅ Seed sample data (15 orders, 10 products, 3 retailers, 3 wholesalers)
- ✅ Start all services (Frontend, API, WhatsApp Bot)
- ✅ Open admin dashboard in browser

## 🌐 Access Points

After setup completes, access these URLs:

| Service | URL | Description |
|---------|-----|-------------|
| **Admin Dashboard** | http://localhost:3001 | React-based admin interface |
| **API Server** | http://localhost:3002 | REST API with real database |
| **WhatsApp Bot** | http://localhost:3003 | WhatsApp message processor |
| **Health Check** | http://localhost:3002/health | System status |
| **API Docs** | http://localhost:3002/api/v1 | API endpoints |

## 👤 Admin Login

- **Email**: `admin@whatsapporder.com`
- **Password**: `admin123`

## 🧪 Test the System

### 1. Test API Health
```bash
curl http://localhost:3002/health
```

### 2. Test WhatsApp Bot
```powershell
curl -Method POST -Uri "http://localhost:3003/test/message" -Body '{"message": "order"}' -ContentType "application/json"
```

### 3. Test Order Flow
```powershell
# Start order
curl -Method POST -Uri "http://localhost:3003/test/message" -Body '{"message": "order"}' -ContentType "application/json"

# Add items (2kg rice, 1L oil)
curl -Method POST -Uri "http://localhost:3003/test/message" -Body '{"message": "1x2, 3x1"}' -ContentType "application/json"

# Confirm order
curl -Method POST -Uri "http://localhost:3003/test/message" -Body '{"message": "CONFIRM"}' -ContentType "application/json"
```

## 📊 What's Included

### ✅ **Complete Features**
- **Multi-vendor Routing**: Race-safe vendor selection
- **Credit Management**: Automated credit checks and limits
- **Order State Machine**: 8 states, 15 valid transitions
- **Inventory Management**: Real-time stock tracking
- **Financial Reporting**: Revenue, analytics, reconciliation
- **WhatsApp Integration**: Full conversation flow
- **Admin Dashboard**: React-based management interface
- **Production Security**: Rate limiting, CORS, validation

### 📦 **Sample Data**
- **10 Products**: Rice, Dal, Oil, Sugar, Tea, Flour, Salt, Onion, Potato
- **5 Categories**: Grains, Pulses, Cooking, Beverages, Vegetables
- **3 Wholesalers**: Kathmandu, Pokhara, Valley traders
- **3 Retailers**: Active stores with credit accounts
- **15 Orders**: Various statuses (delivered, processing, shipped)
- **1 Admin User**: Full system access

### 🔧 **Technical Stack**
- **Backend**: Node.js, Express, Prisma ORM
- **Database**: PostgreSQL with full schema
- **Cache**: Redis for queues and sessions
- **Frontend**: React, Vite, Axios
- **WhatsApp**: Twilio integration (mock mode included)
- **Security**: Helmet, CORS, rate limiting
- **Monitoring**: Health checks, logging, analytics

## 🌍 Production Deployment

### 1. Configure Environment
```bash
# Copy production template
cp backend/.env.production.complete backend/.env.production

# Edit with your actual values:
# - Database URL (Render, Railway, Supabase, Neon)
# - Redis URL (Render, Railway, Upstash)
# - Twilio credentials
# - Domain and CORS settings
```

### 2. Deploy Options

#### Option A: Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway init
railway up
```

#### Option B: Render
1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically

#### Option C: Docker
```bash
# Build and run
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Configure Twilio
1. Get Twilio account: https://www.twilio.com/console
2. Enable WhatsApp sandbox
3. Set webhook URL: `https://your-domain.com/api/v1/whatsapp/webhook`
4. Update environment variables

## 📱 WhatsApp Bot Commands

| Command | Description | Example |
|---------|-------------|---------|
| `order` | Start new order | "I want to order" |
| `menu` | View products | "show menu" |
| `status` | Check orders | "order status" |
| `help` | Show help | "help me" |
| **Nepali** | | |
| `मागना` | Start order | "मलाई सामान मागना छ" |
| `मेनु` | View products | "मेनु देखाउनुस्" |
| `स्थिति` | Check status | "अर्डर स्थिति" |

### Order Format
```
# Product format: number x quantity
1x2, 3x1    # 2kg rice, 1L oil
4x5         # 5kg sugar
```

## 🔍 API Endpoints

### Core APIs
```bash
GET  /health                     # System health
GET  /health/detailed           # Detailed system info
GET  /api/v1/products           # Product catalog
GET  /api/v1/orders             # Order management
GET  /api/v1/retailers          # Retailer management
GET  /api/v1/analytics/dashboard # Business analytics
POST /api/v1/orders             # Create new order
POST /api/v1/whatsapp/webhook   # WhatsApp messages
```

### Query Parameters
```bash
# Pagination
?page=1&limit=50

# Filtering
?status=DELIVERED&retailer=RET-001

# Search
?search=rice&category=grains
```

## 🛠️ Development

### Manual Setup (if script fails)
```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Start database
docker-compose up -d postgres redis

# 3. Setup database
cd backend
npx prisma migrate deploy
node seed-complete-data.js

# 4. Start services
npm run dev                    # Backend
cd ../frontend && npm run dev  # Frontend
cd ../backend && node whatsapp-demo.js  # WhatsApp Bot
```

### Environment Files
- `backend/.env` - Development settings
- `backend/.env.production` - Production settings
- `backend/.env.test` - Test settings

### Database Management
```bash
# View database
npx prisma studio

# Reset database
npx prisma migrate reset

# Generate client
npx prisma generate
```

## 🚨 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

#### Database Connection Failed
```bash
# Check Docker containers
docker ps
docker logs whatsapp_postgres

# Restart database
docker-compose restart postgres
```

#### Frontend Not Loading
```bash
# Check if API is running
curl http://localhost:3002/health

# Restart frontend
cd frontend
npm run dev
```

### Logs Location
- **Backend**: Console output + `backend/logs/`
- **Frontend**: Browser console + terminal
- **Database**: `docker logs whatsapp_postgres`
- **Redis**: `docker logs whatsapp_redis`

## 📞 Support

### Documentation
- **API Reference**: Check `/api/v1` endpoints
- **Database Schema**: `backend/prisma/schema.prisma`
- **Environment Variables**: `backend/.env.example`

### Architecture Files
- **Order State Machine**: `backend/ORDER_STATE_MACHINE_GUIDE.md`
- **Vendor Routing**: `backend/VENDOR_ROUTING_COMPLETE.md`
- **Credit System**: `backend/CREDIT_SYSTEM_ARCHITECTURE.md`
- **WhatsApp Integration**: `backend/WHATSAPP_IMPLEMENTATION_SUMMARY.md`

## 🎯 Next Steps

1. **Configure Twilio** for real WhatsApp integration
2. **Set up production database** (Render, Railway, Supabase)
3. **Deploy to cloud** platform of choice
4. **Configure custom domain** and SSL
5. **Set up monitoring** and alerts
6. **Train users** on admin dashboard
7. **Onboard retailers** and wholesalers

---

## 🎉 You're Ready!

Your WhatsApp Ordering System is now running with:
- ✅ Complete B2B ordering workflow
- ✅ Real-time inventory management
- ✅ Multi-vendor routing system
- ✅ Credit management with limits
- ✅ Financial reporting & analytics
- ✅ Production-ready security
- ✅ Scalable architecture

**Happy ordering! 🛒📱**