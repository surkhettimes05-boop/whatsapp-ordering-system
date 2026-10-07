# Pasalho WhatsApp Ordering — Nepal COD Pilot

Start with [PRODUCTION_LAUNCH.md](PRODUCTION_LAUNCH.md). The app is in the **repository root**. Deploy `render.yaml` for production; `render.free.yaml` is a disposable test environment only.

Customers order in WhatsApp through the signed Meta webhook. Administrators use `/commerce-admin`. Public REST account registration, electronic payments and legacy wholesale/credit routes are disabled for this pilot.

Checkout reserves the configured fulfillment location's inventory. Cancellation releases it. Delivery requires confirmation of the exact COD cash received and records one cash receipt plus one stock deduction. Inbound webhook processing and outbound replies are persisted in PostgreSQL for retries after restart.

Validation: `npm run test:customer` with `NODE_ENV=test USE_REAL_DATABASE=true` and a disposable migrated PostgreSQL database. Never run test fixtures on a customer database.

The older documents below are historical; use the launch runbook for the active deployment contract.

---

# WhatsApp Ordering System - Backend

A comprehensive backend system for WhatsApp-based ordering for Retailers and Wholesalers.

---

## 📦 **NEW: Inventory Truth Layer**

**Complete stock reservation system with zero overselling guarantee!**

A production-ready inventory management system with atomic stock operations, comprehensive error handling, and full audit trails.

### 🚀 **START HERE:** [→ START_HERE_INVENTORY.md](./START_HERE_INVENTORY.md)

This single document will guide you to exactly what you need.

### Quick Links - All Documentation
- **📖 Get Started Guide** → [START_HERE_INVENTORY.md](./START_HERE_INVENTORY.md) ⭐ **START HERE**
- **🎯 Quick Reference Card** → [INVENTORY_MASTER_REFERENCE.md](./INVENTORY_MASTER_REFERENCE.md)
- **🚀 Pick Your Path** → [INVENTORY_GET_STARTED.md](./INVENTORY_GET_STARTED.md)
- **👨‍💻 Find Anything** → [INVENTORY_DOCUMENTATION_INDEX.md](./INVENTORY_DOCUMENTATION_INDEX.md)
- **🗺️ Visual Map** → [INVENTORY_DOCUMENTATION_MAP.md](./INVENTORY_DOCUMENTATION_MAP.md)
- **⚡ 5-min Integration** → [INVENTORY_IMPLEMENTATION_GUIDE.md](./INVENTORY_IMPLEMENTATION_GUIDE.md)
- **🔧 Technical Details** → [INVENTORY_TRUTH_LAYER.md](./INVENTORY_TRUTH_LAYER.md)
- **✅ Checklist** → [INVENTORY_CHECKLIST.md](./INVENTORY_CHECKLIST.md)
- **📊 Business Summary** → [INVENTORY_SUMMARY.md](./INVENTORY_SUMMARY.md)
- **📋 Delivery Report** → [INVENTORY_DELIVERY_REPORT.md](./INVENTORY_DELIVERY_REPORT.md)
- **📦 Status Summary** → [INVENTORY_FINAL_SUMMARY.md](./INVENTORY_FINAL_SUMMARY.md)
- **✔️ Requirements Map** → [INVENTORY_DELIVERABLES.md](./INVENTORY_DELIVERABLES.md)

### What's Included
- ✅ Stock reservation (atomic all-or-nothing)
- ✅ Stock release (on cancellation)
- ✅ Stock deduction (on delivery)
- ✅ Partial fulfillment support
- ✅ Zero negative stock guarantee
- ✅ Complete audit trails
- ✅ 9 comprehensive tests
- ✅ Full API documentation
- ✅ Error handling & diagnostics

### Files Created
- 5 core implementation files (800+ lines)
- 5 documentation files (2000+ lines)
- 1 test suite (400+ lines)

**[Start here →](./INVENTORY_DOCUMENTATION_INDEX.md)**

---

## Features

- ✅ **WhatsApp Business API Integration** - Receive and send messages, images, voice
- ✅ **Order Management** - Complete order lifecycle management
- ✅ **User Management** - Retailers, Wholesalers, Admin roles
- ✅ **Pricing Module** - Dynamic pricing, discounts, bulk pricing
- ✅ **Delivery Module** - Tracking, delivery management, status updates
- ✅ **Support Module** - Ticket system, customer support
- ✅ **Admin Dashboard API** - Complete admin endpoints
- ✅ **File Storage** - Media file management
- ✅ **Database** - PostgreSQL with Prisma ORM

## Architecture

```
WhatsApp Business API
        |
Backend API (Core Brain)
        |
------------------------------------------------
| Orders | Users | Pricing | Delivery | Support |
------------------------------------------------
        |
Admin Dashboard (Web)
        |
Database + Storage
```

## Setup

### Prerequisites

- Node.js 16+ 
- PostgreSQL 12+
- WhatsApp Business API Account

### Installation

1. **Clone and install dependencies:**
```bash
cd backend
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Set up database:**
```bash
# Update DATABASE_URL in .env
# Run migrations
npx prisma migrate dev
```

4. **Generate Prisma Client:**
```bash
npx prisma generate
```

5. **Start the server:**
```bash
# Development
npm run dev

# Production
npm start
```

## Environment Variables

See `.env.example` for all required environment variables.

### Required:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `WHATSAPP_PHONE_NUMBER_ID` - Your WhatsApp Business API phone number ID
- `WHATSAPP_ACCESS_TOKEN` - WhatsApp Business API access token
- `WHATSAPP_VERIFY_TOKEN` - Webhook verification token

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user
- `PUT /api/v1/auth/profile` - Update profile

### Products
- `GET /api/v1/products` - Get all products
- `GET /api/v1/products/:id` - Get product by ID
- `POST /api/v1/products` - Create product (Admin)
- `PUT /api/v1/products/:id` - Update product (Admin)

### Orders
- `POST /api/v1/orders` - Create order
- `GET /api/v1/orders` - Get user's orders
- `GET /api/v1/orders/:id` - Get order by ID
- `PUT /api/v1/orders/:id/cancel` - Cancel order
- `GET /api/v1/orders/admin/all` - Get all orders (Admin)
- `PUT /api/v1/orders/:id/status` - Update order status (Admin)

### WhatsApp
- `GET /api/v1/whatsapp/webhook` - Webhook verification
- `POST /api/v1/whatsapp/webhook` - Webhook handler
- `GET /api/v1/whatsapp/messages` - Get message history (Admin)
- `POST /api/v1/whatsapp/send` - Send message (Admin)

### Pricing
- `POST /api/v1/pricing/calculate` - Calculate price
- `GET /api/v1/pricing` - Get pricing rules (Admin)
- `POST /api/v1/pricing` - Create pricing rule (Admin)
- `PUT /api/v1/pricing/:id` - Update pricing rule (Admin)

### Delivery
- `GET /api/v1/delivery/track/:trackingNumber` - Track delivery (Public)
- `GET /api/v1/delivery/order/:orderId` - Get delivery by order
- `POST /api/v1/delivery/order/:orderId` - Create delivery (Admin)
- `PUT /api/v1/delivery/:id/status` - Update delivery status (Admin)
- `PUT /api/v1/delivery/:id/location` - Update location (Admin)

### Support
- `POST /api/v1/support/tickets` - Create ticket
- `GET /api/v1/support/tickets` - Get user's tickets
- `GET /api/v1/support/tickets/:id` - Get ticket
- `POST /api/v1/support/tickets/:id/messages` - Add message
- `GET /api/v1/support/admin/tickets` - Get all tickets (Admin)
- `PUT /api/v1/support/tickets/:id/status` - Update status (Admin)

### Admin
- `GET /api/v1/admin/dashboard` - Dashboard statistics
- `GET /api/v1/admin/users` - Get all users
- `PUT /api/v1/admin/users/:id/status` - Update user status
- `GET /api/v1/admin/orders` - Get all orders
- `GET /api/v1/admin/deliveries` - Get all deliveries

## Database Schema

The system uses Prisma ORM with PostgreSQL. Key models:

- **User** - Retailers, Wholesalers, Admin
- **Product** - Product catalog
- **Order** - Order management
- **Delivery** - Delivery tracking
- **SupportTicket** - Customer support
- **PricingRule** - Dynamic pricing
- **WhatsAppMessage** - Message history
- **MediaFile** - File storage

## WhatsApp Integration

### Webhook Setup

1. Configure webhook URL in WhatsApp Business API:
   - URL: `https://your-domain.com/api/v1/whatsapp/webhook`
   - Verify Token: Your `WHATSAPP_VERIFY_TOKEN`

2. The webhook will:
   - Verify subscription (GET request)
   - Process incoming messages (POST request)
   - Auto-register users from WhatsApp
   - Process commands and send responses

### Supported Commands

- `hi`, `hello`, `start` - Welcome message
- `menu`, `products`, `catalog` - Product catalog
- `cart`, `basket` - Cart summary
- `order`, `my orders` - Order history
- `help`, `support` - Help message

## Development

### Project Structure

```
backend/
├── src/
│   ├── app.js                 # Main application
│   ├── config/                # Configuration
│   ├── controllers/           # Route controllers
│   ├── services/              # Business logic
│   ├── routes/                # API routes
│   ├── middleware/            # Middleware
│   ├── validators/            # Input validation
│   └── utils/                 # Utilities
├── prisma/
│   └── schema.prisma          # Database schema
└── uploads/                   # File uploads
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET`
3. Configure proper CORS origins
4. Set up SSL/HTTPS
5. Use environment-specific database
6. Configure file storage (S3/Cloudinary)
7. Set up monitoring and logging

## License

ISC

