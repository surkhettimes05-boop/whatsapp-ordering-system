# WhatsApp Ordering System

A production-ready B2B ordering system integrated with WhatsApp, built for wholesalers and retailers in Nepal.

## 🚀 Features

- **WhatsApp Bot**: Automated ordering, catalog browsing, and status tracking.
- **Admin Dashboard**: Manage products, orders, and retailers.
- **Wholesaler Portal**: Bidding system, order fulfillment, and inventory management.
- **Credit System**: Automated credit checks and ledger management.
- **Queue System**: Robust message processing using BullMQ.

## 🛠️ Technology Stack

- **Backend**: Node.js, Express, Prisma (PostgreSQL), BullMQ (Redis)
- **Frontend**: React (Vite)
- **Infrastructure**: Docker, Nginx

## 📋 Prerequisites

- Docker & Docker Compose
- Node.js v18+ (for local development)
- PostgreSQL & Redis (if running locally without Docker)
- Twilio Account (for WhatsApp integration)

## ⚡ Quick Start (Docker)

This is the recommended way to run the application.

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd whatsapp-ordering-system
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your specific credentials
   ```

3. **Start Application**
   ```bash
   docker-compose up -d --build
   ```

4. **Access Services**
   - **Backend API**: `http://localhost:5000`
   - **Frontend**: `http://localhost:3000`
   - **API Health**: `http://localhost:5000/health`

## 👨‍💻 Local Development

1. **Install Dependencies**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Database Setup**
   ```bash
   # Ensure local Postgres is running
   cd backend
   npx prisma migrate dev
   npm run db:seed
   ```

3. **Run Services**
   ```bash
   # Terminal 1: Backend
   cd backend
   npm run dev

   # Terminal 2: Frontend
   cd frontend
   npm run dev
   ```

## 🏗️ Project Structure

```
/
├── backend/          # Node.js API & Workers
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   └── prisma/
├── frontend/         # React Admin Dashboard
├── nginx/            # Reverse Proxy config
├── scripts/          # Utility & Backup scripts
└── docs/             # Detailed documentation
```

## 🔒 Security

- **Secrets**: Never commit `.env` files.
- **SSL**: Production requires SSL certificates mapped to `nginx/ssl/`.
- **Webhooks**: Twilio signature validation is enforced in production.

## 📄 License

Proprietary Software.
