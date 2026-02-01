# 🚀 Deployment Guide

## 1. Local / VPS Deployment (Docker Compose)
The easiest way to run the full stack (Backend + Database + Redis) is using Docker Compose.

### Prerequisites
- Docker & Docker Compose installed
- Git installed

### Steps
1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd whatsapp-ordering-system
   ```

2. **Configure Environment:**
   Create a `.env` file in the root directory (based on `.env.example`).
   *Note: Docker Compose sets default connection strings, but for production, use secure passwords.*

3. **Run Services:**
   ```bash
   docker-compose up -d --build
   ```

4. **Verify:**
   - Backend: `http://localhost:5000`
   - Health Check: `http://localhost:5000/health`

### Database Management
To run migrations inside the container:
```bash
docker-compose exec backend npx prisma migrate deploy
```

---

## 2. Railway Deployment (PaaS)
Railway is recommended for simplest "Git Push" deployment.

### Steps
1. **Create Project**: Go to Railway.app -> New Project -> Provision PostgreSQL & Redis.
2. **Connect GitHub**: Select this repository.
3. **Configure Settings**:
   - **Root Directory**: `backend` (Important! Since app is in subfolder)
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `npm start`
4. **Environment Variables**:
   Add variables from Railway's Database/Redis views:
   - `DATABASE_URL` matches the PostgreSQL service.
   - `REDIS_URL` matches the Redis service.
   - `TWILIO_AUTH_TOKEN`, etc.

---

## 3. Fly.io Deployment
Fly.io is great for global low-latency.

1. **Install Fly CLI**: `flyctl`
2. **Initialize**:
   ```bash
   cd backend
   fly launch
   ```
3. **Database**:
   ```bash
   fly postgres create
   fly redis create
   ```
4. **Attach**:
   ```bash
   fly postgres attach <db-name>
   ```

---

## 4. Production Checklist
- [ ] **Secrets**: Never commit `.env`. Use Secrets Manager.
- [ ] **SSL**: Ensure HTTPS is enabled (handled by PaaS or Nginx proxy).
- [ ] **Backups**: Enable automatic DB backups in Railway/Fly.
- [ ] **Monitoring**: Check `/health` endpoint is monitored.
