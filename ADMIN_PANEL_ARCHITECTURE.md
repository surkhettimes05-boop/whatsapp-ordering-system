# 🏗️ Admin Panel Architecture & Integration

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     ADMIN CONTROL PANEL                         │
│  https://whatsapp-ordering-system.onrender.com/admin            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend (React)                   Backend (Node.js/Express)  │
│  ─────────────────                  ─────────────────────────  │
│  • AdminPanel.jsx                   • adminDashboard.service   │
│  • AddProductForm.jsx               • adminDashboard.controller│
│  • SharedInbox.jsx                  • adminDashboard.routes    │
│  • TeamManagement.jsx               • adminDashboard.service   │
│  • AdminDashboard.jsx               • prisma migrations        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
           ↓                                         ↓
   ┌──────────────────┐           ┌──────────────────────────────┐
   │   WhatsApp API   │           │   PostgreSQL Database        │
   │   (Twilio)       │           │                              │
   │                  │           │  • Conversation              │
   │ +1 (415) 523-88  │           │  • ConversationMessage       │
   │ 86               │           │  • AdminActionLog            │
   └──────────────────┘           │  • Product (existing)        │
           ↑                       │  • User (existing + roles)   │
           │                       │  • Order (existing)          │
           │                       │  • Retailer (existing)       │
    ┌──────────────┐               │  • Wholesaler (existing)     │
    │   Webhook    │               └──────────────────────────────┘
    │   /webhook   │
    └──────────────┘
           ↑
    Retailer sends message
    to +1 (415) 523-8886
```

---

## Data Flow: Incoming Message

```
1. Retailer sends WhatsApp message
   └─→ "Hi, I need tomatoes"

2. Twilio receives message
   └─→ Sends POST to webhook: /api/v1/whatsapp/webhook

3. System processes message
   └─→ whatsapp.controller.handleIncomingMessage()
   └─→ Creates Conversation (if new)
   └─→ Creates ConversationMessage

4. Admin sees in Shared Inbox
   └─→ GET /api/v1/admin-dashboard/inbox
   └─→ Shows unread badge on conversation

5. Admin assigns to team member
   └─→ POST /api/v1/admin-dashboard/inbox/:id/assign
   └─→ Updates Conversation.assignedToUserId

6. Team member responds
   └─→ Clicks reply button in inbox
   └─→ Backend sends via Twilio WhatsApp API
   └─→ Creates outgoing ConversationMessage

7. Retailer receives reply
   └─→ WhatsApp notification with response
   └─→ System tracks response time
```

---

## Data Flow: Add Product

```
1. Admin clicks "Add Product"
   └─→ AdminPanel.jsx opens form

2. Admin fills form
   └─→ Name: "Tomato"
   └─→ Category: "Vegetables"
   └─→ Price: "₹50"

3. Submit
   └─→ AddProductForm.jsx calls API
   └─→ POST /api/v1/admin-dashboard/products
   └─→ Body: { name, categoryId, basePrice, ... }

4. Backend creates product
   └─→ adminDashboard.controller.createProduct()
   └─→ adminDashboard.service.createProduct()
   └─→ Creates in database
   └─→ Logs audit action

5. Admin sees in table
   └─→ Product appears immediately
   └─→ Can be ordered by retailers now
```

---

## Data Flow: Team Assignment

```
1. Message arrives from retailer
   └─→ Conversation created with assignedToUserId = null

2. Admin views Shared Inbox
   └─→ GET /api/v1/admin-dashboard/inbox
   └─→ Sees conversation with unread messages

3. Admin clicks "Assign to Team Member"
   └─→ SharedInbox.jsx renders dropdown
   └─→ Shows all team members

4. Admin selects team member
   └─→ POST /api/v1/admin-dashboard/inbox/:id/assign
   └─→ Body: { userId: "team-member-id" }

5. Conversation assigned
   └─→ Conversation.assignedToUserId = userId
   └─→ Conversation.assignedAt = now()
   └─→ AdminActionLog created

6. Team member sees assignment
   └─→ Next time they open inbox
   └─→ Conversation shows in their list
   └─→ They know it's waiting for them

7. Team member responds
   └─→ Clicks on conversation
   └─→ Sees all messages
   └─→ Can view customer details
   └─→ Sends reply via API
   └─→ Response time tracked
```

---

## Database Relationships

### New Tables

#### Conversation
```
id (PK)
↓
retailerId (FK → Retailer)
assignedToUserId (FK → User)
status: OPEN|CLOSED|PENDING
unreadCount
createdAt, updatedAt
├─ hasMany: ConversationMessage
└─ belongsTo: Retailer, User
```

#### ConversationMessage
```
id (PK)
↓
conversationId (FK → Conversation)
body (text)
isFromRetailer (boolean)
isRead (boolean)
senderUserId (FK → User, optional)
timestamp
```

#### AdminActionLog
```
id (PK)
↓
action: CONVERSATION_ASSIGNED|PRODUCT_CREATED|etc.
performedBy (user id)
reference: "conversation:123" or "product:456"
details (optional)
timestamp
```

### Updated Tables

#### User Model
**Before:**
```
id, phoneNumber, name, email, passwordHash, role, createdAt
```

**After:**
```
id, phoneNumber, name, email, passwordHash, role, createdAt
├─ hasMany: Conversation (new relation)
└─ hasMany: ConversationMessage (new relation)
```

---

## API Endpoints Summary

### Product Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/products` | List all products |
| GET | `/products/:id` | Get specific product |
| POST | `/products` | Create product |
| PUT | `/products/:id` | Update product |
| DELETE | `/products/:id` | Delete product |
| PATCH | `/products/:id/stock` | Update inventory |

### Conversation Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/inbox` | Get all conversations |
| GET | `/inbox/:id` | Get conversation with messages |
| POST | `/inbox/:id/assign` | Assign to team member |
| POST | `/inbox/:id/unassign` | Unassign |
| POST | `/inbox/:id/resolve` | Mark resolved |
| POST | `/inbox/:id/reopen` | Reopen |

### Team Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/team` | Get all team members |
| POST | `/team` | Create team member |
| GET | `/team/:userId/stats` | Get member stats |

### Dashboard Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/dashboard` | Get dashboard stats |
| GET | `/activity-log` | Get audit log |

---

## File Structure

```
backend/
├─ src/
│  ├─ services/
│  │  └─ adminDashboard.service.js       (NEW - Service logic)
│  ├─ controllers/
│  │  └─ adminDashboard.controller.js    (NEW - API handlers)
│  └─ routes/
│     └─ adminDashboard.routes.js        (NEW - Route definitions)
├─ prisma/
│  ├─ schema.prisma                      (UPDATED - New models)
│  └─ migrations/
│     └─ [timestamp]_add_shared_inbox/   (NEW - DB migration)
├─ ADMIN_PANEL_GUIDE.md                  (NEW - Full docs)
└─ ADMIN_PANEL_QUICK_START.md            (NEW - Quick setup)

frontend/
├─ src/
│  ├─ pages/
│  │  ├─ AdminPanel.jsx                  (NEW - Main page)
│  │  └─ AdminPanel.css                  (NEW - Styles)
│  └─ components/
│     ├─ AddProductForm.jsx              (NEW - Product form)
│     ├─ SharedInbox.jsx                 (NEW - Inbox view)
│     ├─ TeamManagement.jsx              (NEW - Team UI)
│     └─ AdminDashboard.jsx              (NEW - Dashboard)
```

---

## Service Layer Breakdown

### AdminDashboardService Methods

**Product Management:**
- `getAllProducts(filters)` - Query with pagination
- `getProductById(id)` - Single product fetch
- `createProduct(data)` - Insert with validation
- `updateProduct(id, data)` - Modify existing
- `deleteProduct(id)` - Soft delete
- `updateProductStock(productId, wholesalerId, stock)`
- `getBulkProductStats()` - Low stock, top sellers, etc.

**Shared Inbox:**
- `getSharedInbox(filters)` - All conversations
- `getConversation(id)` - Full chat history
- `assignConversationToTeamMember(convId, userId)`
- `unassignConversation(id)`
- `markConversationAsResolved(id, notes)`
- `reopenConversation(id)`

**Team Management:**
- `createTeamMember(data)` - Add new staff
- `getTeamMembers()` - List all
- `getTeamMemberStats(userId)` - Performance metrics

**Analytics:**
- `getDashboardStats()` - Orders, revenue, messages
- `getConversationStats()` - OPEN/CLOSED/PENDING counts
- `getAdminActivityLog(filters)` - Audit trail

**Audit:**
- `logAdminAction(data)` - Record action
- `getAdminActivityLog(filters)` - Query actions

---

## Frontend Component Hierarchy

```
AdminPanel.jsx
├─ State: activeTab, user
├─ Tabs Navigation
│  ├─ Dashboard
│  ├─ Products
│  ├─ Inbox
│  └─ Team
│
├─ AdminDashboard.jsx (Tab 1)
│  ├─ Fetches dashboard stats
│  ├─ Displays stat cards
│  └─ Quick action buttons
│
├─ AddProductForm.jsx (Tab 2)
│  ├─ Product list table
│  ├─ Add product form
│  ├─ Edit/Delete buttons
│  └─ Stock management
│
├─ SharedInbox.jsx (Tab 3)
│  ├─ Conversation list (left)
│  ├─ Messages display (right)
│  ├─ Team assignment dropdown
│  ├─ Resolve/Reopen buttons
│  └─ Message preview
│
└─ TeamManagement.jsx (Tab 4)
   ├─ Team member cards
   ├─ Stats per member
   ├─ Add member form
   └─ Performance metrics
```

---

## API Request/Response Examples

### Create Product
```
POST /api/v1/admin-dashboard/products
Authorization: Bearer <token>

Request Body:
{
  "name": "Tomato",
  "description": "Fresh red tomatoes",
  "categoryId": "vegetables",
  "basePrice": "50",
  "unit": "kg",
  "minOrderQuantity": "5"
}

Response:
{
  "success": true,
  "message": "Product created successfully",
  "product": {
    "id": "prod_123",
    "name": "Tomato",
    "basePrice": "50",
    "isActive": true,
    "createdAt": "2024-01-14T10:30:00Z"
  }
}
```

### Get Shared Inbox
```
GET /api/v1/admin-dashboard/inbox?status=OPEN&take=20
Authorization: Bearer <token>

Response:
{
  "conversations": [
    {
      "id": "conv_123",
      "status": "OPEN",
      "unreadCount": 2,
      "retailer": {
        "phoneNumber": "+977...",
        "pasalName": "John's Shop"
      },
      "assignedToUser": {
        "name": "Sarah",
        "id": "user_456"
      },
      "messages": [
        {
          "body": "Do you have tomatoes?",
          "isFromRetailer": true,
          "timestamp": "2024-01-14T10:30:00Z"
        }
      ],
      "updatedAt": "2024-01-14T10:35:00Z"
    }
  ],
  "stats": {
    "OPEN": 15,
    "CLOSED": 42,
    "PENDING": 3
  }
}
```

### Assign Conversation
```
POST /api/v1/admin-dashboard/inbox/conv_123/assign
Authorization: Bearer <token>

Request Body:
{
  "userId": "user_456"
}

Response:
{
  "success": true,
  "message": "Conversation assigned",
  "conversation": {
    "id": "conv_123",
    "assignedToUserId": "user_456",
    "assignedAt": "2024-01-14T10:40:00Z"
  }
}
```

---

## Security Features

✅ **JWT Authentication**
- All endpoints require `Authorization: Bearer <token>` header
- Token validated before processing

✅ **Role-Based Access Control**
- ADMIN: Full access
- STAFF: Can manage conversations and products
- SUPPORT: Can only manage assigned conversations

✅ **Audit Logging**
- Every action logged in `AdminActionLog`
- Tracks: who, what, when, where
- Immutable history for compliance

✅ **Data Validation**
- Input validation on all endpoints
- Type checking with Prisma
- SQL injection prevention

✅ **Error Handling**
- Graceful error responses
- No sensitive data in errors
- Proper HTTP status codes

---

## Performance Considerations

### Optimizations
- Pagination on conversations (take 20 per page)
- Indexed database queries (createdAt, updatedAt)
- Cached dashboard stats (30-second refresh)
- Lazy loading of team member stats

### Query Examples
```sql
-- Get conversations for admin (with pagination)
SELECT * FROM "Conversation"
WHERE "status" = 'OPEN'
ORDER BY "updatedAt" DESC
LIMIT 20 OFFSET 0;

-- Get unread message count
SELECT COUNT(*) FROM "ConversationMessage"
WHERE "conversationId" = 'conv_123'
AND "isRead" = false;

-- Get team member stats
SELECT COUNT(*) as totalConversations
FROM "Conversation"
WHERE "assignedToUserId" = 'user_456';
```

---

## Deployment Steps

1. **Apply Database Migration**
   ```bash
   npx prisma migrate deploy
   ```

2. **Update Environment Variables**
   ```
   DATABASE_URL=...
   JWT_SECRET=...
   TWILIO_ACCOUNT_SID=...
   ```

3. **Restart Backend**
   ```bash
   npm run dev
   ```

4. **Deploy Frontend**
   ```bash
   npm run build
   # Deploy dist/ folder
   ```

5. **Verify in Production**
   ```
   GET https://whatsapp-ordering-system.onrender.com/health
   GET https://whatsapp-ordering-system.onrender.com/api/v1/admin-dashboard/dashboard
   ```

---

## Related Documentation

- [ADMIN_PANEL_QUICK_START.md](ADMIN_PANEL_QUICK_START.md) - 15-min setup
- [ADMIN_PANEL_GUIDE.md](ADMIN_PANEL_GUIDE.md) - Complete guide
- [WHATSAPP_WEBHOOK_FIX.md](WHATSAPP_WEBHOOK_FIX.md) - Webhook setup
- [API_REFERENCE.md](API_REFERENCE.md) - All endpoints

---
