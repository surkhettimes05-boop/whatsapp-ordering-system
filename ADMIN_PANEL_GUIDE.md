# 🎛️ Admin Panel & Shared Inbox System

## Overview

This is a complete admin dashboard system that allows you to:
1. **Manage Products** - Add, edit, delete products from a web interface
2. **Shared Inbox** - Multiple team members can handle customer messages from one WhatsApp number
3. **Team Management** - Create team members and track their performance
4. **Analytics Dashboard** - Real-time business metrics

---

## 📦 Features

### 1. Product Management
- Add products with name, description, price, category, image
- View all products in a table
- Edit product details
- Delete (deactivate) products
- Track product inventory across wholesalers
- Bulk product statistics (low stock alerts, top sellers)

### 2. Shared Inbox System
- All customer messages come to one central inbox
- Assign conversations to specific team members
- Mark conversations as resolved
- Reopen closed conversations
- Track unread messages
- See message history with each retailer

### 3. Team Management
- Create admin staff members
- Assign roles: ADMIN, STAFF, SUPPORT
- Track individual team member stats:
  - Total conversations handled
  - Unread messages
  - Active conversations
  - Average response time
- Performance analytics

### 4. Dashboard
- Real-time metrics:
  - Orders today/this month
  - Revenue today/this month
  - Active conversations
  - Pending messages
  - Total retailers/wholesalers
  - Team size
- Quick action buttons
- System tips and guidance

---

## 🚀 How to Access

### 1. Login to Admin Panel
```
URL: https://whatsapp-ordering-system.onrender.com/admin
```

You need:
- Phone number
- Password (set in database)
- Role must be "ADMIN"

### 2. Once Logged In
You'll see tabs for:
- 📊 Dashboard
- 📦 Products
- 💬 Shared Inbox
- 👥 Team

---

## 📖 Step-by-Step Usage

### Adding a Product

1. Click **"📦 Products"** tab
2. Click **"➕ Add New Product"**
3. Fill in:
   - **Product Name** (required) - e.g., "Tomato"
   - **Category** (required) - Vegetables, Fruits, etc.
   - **Base Price** (required) - e.g., 50
   - **Unit** - piece, kg, liter, dozen
   - **Min Order Quantity** - minimum order
   - **Image URL** - link to product image
   - **Description** - optional details
4. Click **"✅ Add Product"**
5. Product appears in the table below

### Managing Shared Inbox

#### View All Messages
1. Click **"💬 Shared Inbox"** tab
2. Left side shows list of conversations
3. Click any conversation to see full chat history

#### Assign a Message to Team Member
1. Select a conversation
2. In the right panel, choose "Assign to Team Member"
3. Select a team member from dropdown
4. They'll be notified of the assignment

#### Mark Conversation as Resolved
1. Open the conversation
2. Click **"✅ Mark as Resolved"**
3. Add resolution notes (optional)
4. Conversation moves to CLOSED status

#### Reopen a Conversation
1. Open closed conversation
2. Click **"↩️ Reopen"** button
3. Conversation back to OPEN status

### Managing Team Members

#### Add a Team Member
1. Click **"👥 Team"** tab
2. Click **"➕ Add Team Member"**
3. Fill in:
   - **Name** (required)
   - **Phone Number** (required)
   - **Email** (optional)
   - **Role** - STAFF, SUPPORT, or ADMIN
4. Click **"✅ Add Member"**

#### View Team Performance
1. Team members appear as cards
2. Each card shows:
   - Name and contact
   - Role badge
   - Conversations handled
   - Unread count
   - Active conversations
   - Average response time

---

## 🔄 How Shared Inbox Works

### Customer Flow
```
Customer sends WhatsApp → Message arrives at +1 (415) 523-8886
                        ↓
                  System creates "Conversation"
                        ↓
                   Message appears in Inbox
                        ↓
        Admin can view and assign to team member
                        ↓
         Team member responds via WhatsApp API
                        ↓
            Customer receives reply automatically
```

### Team Member Flow
```
New message arrives → System creates conversation
                        ↓
              Admin sees in shared inbox
                        ↓
         Admin assigns to team member (or team member claims)
                        ↓
       Team member sees in their assigned conversations
                        ↓
       Team member sends reply (backend sends WhatsApp message)
                        ↓
        All conversations are tracked for performance metrics
```

---

## 🔌 Backend API Endpoints

### Products
```
GET    /api/v1/admin-dashboard/products              - Get all products
GET    /api/v1/admin-dashboard/products/:id          - Get specific product
POST   /api/v1/admin-dashboard/products              - Create product
PUT    /api/v1/admin-dashboard/products/:id          - Update product
DELETE /api/v1/admin-dashboard/products/:id          - Delete product
PATCH  /api/v1/admin-dashboard/products/:id/stock    - Update stock
GET    /api/v1/admin-dashboard/products/stats/bulk   - Product statistics
```

### Shared Inbox
```
GET    /api/v1/admin-dashboard/inbox                         - Get conversations
GET    /api/v1/admin-dashboard/inbox/:id                     - Get specific conversation
POST   /api/v1/admin-dashboard/inbox/:conversationId/assign  - Assign to member
POST   /api/v1/admin-dashboard/inbox/:id/unassign           - Unassign
POST   /api/v1/admin-dashboard/inbox/:id/resolve            - Mark resolved
POST   /api/v1/admin-dashboard/inbox/:id/reopen             - Reopen
```

### Team Management
```
GET    /api/v1/admin-dashboard/team                 - Get all team members
POST   /api/v1/admin-dashboard/team                 - Create team member
GET    /api/v1/admin-dashboard/team/:userId/stats   - Get member stats
```

### Dashboard
```
GET    /api/v1/admin-dashboard/dashboard   - Get dashboard stats
GET    /api/v1/admin-dashboard/activity-log - Get activity log
```

---

## 🗄️ Database Schema

### Conversation Model
```prisma
model Conversation {
  id                  String   @id @default(cuid())
  retailerId          String   // Customer
  assignedToUserId    String?  // Team member assigned
  assignedAt          DateTime?
  status              String   // OPEN, CLOSED, PENDING
  unreadCount         Int      // Unread messages
  messages            ConversationMessage[]
  closedAt            DateTime?
  resolvedNotes       String?
  updatedAt           DateTime @updatedAt
  createdAt           DateTime @default(now())
}
```

### ConversationMessage Model
```prisma
model ConversationMessage {
  id                  String   @id @default(cuid())
  conversationId      String
  body                String
  isFromRetailer      Boolean  // true = customer, false = admin
  isRead              Boolean
  readAt              DateTime?
  senderUserId        String?  // Admin who sent it
  timestamp           DateTime @default(now())
}
```

### AdminActionLog Model
```prisma
model AdminActionLog {
  id                  String   @id @default(cuid())
  action              String   // CONVERSATION_ASSIGNED, PRODUCT_CREATED, etc.
  performedBy         String?
  reference           String?  // conversation:123
  details             String?
  timestamp           DateTime @default(now())
}
```

---

## 🔐 Authentication & Permissions

### User Roles
- **ADMIN** - Full access to all features
- **STAFF** - Can handle conversations, view products
- **SUPPORT** - Can only handle their assigned conversations

### Token-Based Auth
All requests require JWT token:
```
Authorization: Bearer <your-jwt-token>
```

Token should be stored in `localStorage` as `token` after login.

---

## 🐛 Troubleshooting

### "Not seeing messages in shared inbox"
1. Check if Twilio webhook is correctly configured
2. Go to WhatsApp Webhook FIX guide
3. Ensure backend is receiving webhook POST requests

### "Can't add products"
1. Check if you have ADMIN role
2. Verify all required fields are filled
3. Check browser console for API errors
4. Verify API URL is correct

### "Team member can't see assigned conversations"
1. Refresh the page
2. Clear browser cache
3. Check if conversation status is OPEN (not CLOSED)
4. Verify team member has correct role

### "Responses not going back to customer"
1. Check Twilio credentials in `.env`
2. Verify phone number format: +977XXXXXXXXXX
3. Check Twilio logs for sending errors
4. Ensure WhatsApp message text is not too long

---

## 📊 Performance Metrics

### Dashboard Shows
- **Orders**: Count of placed orders (today, this month)
- **Revenue**: Total amount from orders
- **Conversations**: Active customer discussions
- **Messages**: Pending customer messages awaiting reply
- **Users**: Total retailers and wholesalers

### Team Stats Show
- **Conversations**: Total assigned to member
- **Unread**: Messages waiting for response
- **Active**: Currently open conversations
- **Response Time**: Average minutes to first reply

---

## 🚀 Deployment

### Backend Ready
- Service: `adminDashboard.service.js` ✅
- Controller: `adminDashboard.controller.js` ✅
- Routes: `adminDashboard.routes.js` ✅
- Mounted in: `app.js` ✅

### Frontend Ready
- Page: `AdminPanel.jsx` ✅
- Styling: `AdminPanel.css` ✅
- Components:
  - `AddProductForm.jsx` ✅
  - `SharedInbox.jsx` ✅
  - `TeamManagement.jsx` ✅
  - `AdminDashboard.jsx` ✅

### Database Migration
Need to run:
```bash
npx prisma migrate dev --name "add_shared_inbox_system"
```

This will create:
- `Conversation` table
- `ConversationMessage` table
- `AdminActionLog` table
- Add relationships to `User` model

---

## 💾 Running Locally

### 1. Start Backend
```bash
cd backend
npm install
npx prisma migrate dev --name "add_shared_inbox_system"
npm run dev
```

### 2. Start Frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. Access Admin Panel
```
http://localhost:3000/admin
```

---

## 📝 Common Tasks

### Add a New Product Category
Update in `AddProductForm.jsx`:
```javascript
<option value="your-category">Your Category</option>
```

### Change Conversation Statuses
Edit in `AdminDashboardService`:
```javascript
status: String @default("OPEN") // OPEN, CLOSED, PENDING, ARCHIVED
```

### Add More Team Member Roles
Update schema:
```javascript
role: String // ADMIN, STAFF, SUPPORT, QUALITY_CHECKER
```

### Track Custom Metrics
Add to `getDashboardStats()`:
```javascript
return {
  ...existing,
  yourMetric: value
}
```

---

## 🔗 Related Files

- Backend Service: [src/services/adminDashboard.service.js](src/services/adminDashboard.service.js)
- Backend Controller: [src/controllers/adminDashboard.controller.js](src/controllers/adminDashboard.controller.js)
- Backend Routes: [src/routes/adminDashboard.routes.js](src/routes/adminDashboard.routes.js)
- Frontend Page: [frontend/src/pages/AdminPanel.jsx](frontend/src/pages/AdminPanel.jsx)
- Database Schema: [backend/prisma/schema.prisma](backend/prisma/schema.prisma)
- WhatsApp Integration: [WHATSAPP_WEBHOOK_FIX.md](WHATSAPP_WEBHOOK_FIX.md)

---

## ✅ Deployment Checklist

Before going live:

- [ ] Database migration applied successfully
- [ ] Twilio webhook configured correctly
- [ ] Admin user created in database
- [ ] Products added to catalog
- [ ] Team members added and roles assigned
- [ ] Test conversation assignment flow
- [ ] Test product creation from UI
- [ ] Verify JWT tokens working
- [ ] Check API error handling
- [ ] Monitor logs for issues

---

## 📞 Support

If messages aren't working:
1. Check [WHATSAPP_WEBHOOK_FIX.md](WHATSAPP_WEBHOOK_FIX.md)
2. Verify Twilio credentials
3. Check Render deployment logs
4. Ensure webhook URL is correct in Twilio console

If admin panel won't load:
1. Check if logged in
2. Verify user has ADMIN role
3. Check browser console for errors
4. Clear cache and retry
5. Check API Base URL in .env

---
