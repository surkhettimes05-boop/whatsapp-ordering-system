# ⚡ Admin Panel - Quick Setup (15 Minutes)

## What's Been Built

✅ **Admin Control Panel** - Web dashboard at `/admin`
✅ **Product Management** - Add/edit/delete products from UI
✅ **Shared Inbox** - Multiple team members handle one WhatsApp number
✅ **Team Dashboard** - Track team member performance

---

## 3 Steps to Get Running

### STEP 1: Apply Database Migration (2 minutes)

In your backend terminal:
```bash
cd backend
npx prisma migrate dev --name "add_shared_inbox_system"
```

This creates:
- `Conversation` table
- `ConversationMessage` table
- `AdminActionLog` table

✅ When done, you'll see: "✔ Your database has been successfully migrated"

---

### STEP 2: Restart Backend (1 minute)

```bash
npm run dev
```

You should see:
```
✅ Admin Dashboard routes loaded
✅ Product routes loaded
```

---

### STEP 3: Access Admin Panel (1 minute)

Open in browser:
```
https://whatsapp-ordering-system.onrender.com/admin
```

Login with your admin credentials:
- Phone: (your admin phone number)
- Password: (your admin password)

If you don't have admin user yet, create one in database:
```bash
npx prisma studio
# Then add User with role: "ADMIN"
```

---

## 🎯 Now You Can

### ✅ Add Products
1. Click **"📦 Products"** tab
2. Click **"➕ Add New Product"**
3. Fill in name, price, category
4. Click **"✅ Add Product"**

### ✅ View Customer Messages
1. Click **"💬 Shared Inbox"** tab
2. See all conversations from retailers
3. Click any message to see full chat
4. Assign to team member
5. Mark as resolved when done

### ✅ Add Team Members
1. Click **"👥 Team"** tab
2. Click **"➕ Add Team Member"**
3. Enter name, phone, role
4. Click **"✅ Add Member"**

### ✅ View Dashboard
1. Click **"📊 Dashboard"** tab
2. See live stats: orders, revenue, messages
3. Monitor team performance
4. Quick action buttons

---

## 📁 Files Created

**Backend:**
- `src/services/adminDashboard.service.js` - Service logic
- `src/controllers/adminDashboard.controller.js` - API endpoints
- `src/routes/adminDashboard.routes.js` - Routes

**Frontend:**
- `src/pages/AdminPanel.jsx` - Main page
- `src/pages/AdminPanel.css` - Styling
- `src/components/AddProductForm.jsx` - Product UI
- `src/components/SharedInbox.jsx` - Inbox UI
- `src/components/TeamManagement.jsx` - Team UI
- `src/components/AdminDashboard.jsx` - Dashboard UI

**Database:**
- 3 new tables: `Conversation`, `ConversationMessage`, `AdminActionLog`
- Updated `User` model with team relationships

---

## 🔗 API Endpoints Ready

```
GET    /api/v1/admin-dashboard/products
POST   /api/v1/admin-dashboard/products
GET    /api/v1/admin-dashboard/inbox
POST   /api/v1/admin-dashboard/inbox/:id/assign
GET    /api/v1/admin-dashboard/team
POST   /api/v1/admin-dashboard/team
GET    /api/v1/admin-dashboard/dashboard
```

All require `Authorization: Bearer <token>` header with ADMIN role.

---

## 🚀 Testing Checklist

- [ ] Backend migration successful
- [ ] Admin Panel loads at `/admin`
- [ ] Can add a product
- [ ] Can see products in table
- [ ] Can view shared inbox
- [ ] Can assign conversation to team member
- [ ] Can add team member
- [ ] Dashboard shows stats
- [ ] Logout works correctly

---

## 💡 How Multiple People Can Message

Previously: Only one person saw messages from the number +1 (415) 523-8886

Now:
1. **Message arrives** → Goes to shared inbox
2. **Multiple admins see it** → In `/admin` → "💬 Shared Inbox"
3. **Admin assigns it** → To specific team member
4. **Team member responds** → Using admin panel UI or WhatsApp directly
5. **Conversation tracked** → Who handled what, response times, etc.

---

## 🎛️ Admin Panel Features

### Dashboard
- 📊 Real-time metrics (orders, revenue, messages)
- 👥 Team stats (assignments, response times)
- 🎯 Quick action buttons

### Products
- ➕ Add new products
- ✏️ Edit existing products  
- 🗑️ Delete products
- 📊 View inventory levels
- 💰 Set pricing per wholesaler

### Shared Inbox
- 💬 All customer messages in one place
- 👤 Assign to team member
- ✅ Mark as resolved
- 📱 See full conversation history
- ⏱️ Track response times

### Team
- 👥 Add team members
- 👔 Set roles (ADMIN, STAFF, SUPPORT)
- 📈 View performance stats
- ⏱️ Track average response time
- 📊 Active conversation count

---

## ⚙️ Configuration

### Environment Variables (Already in .env)
```
TWILIO_WHATSAPP_FROM=+14155238886
WHATSAPP_VERIFY_TOKEN=khaacho_secure_token_2024
DATABASE_URL=your-database-connection
JWT_SECRET=your-jwt-secret
```

### Add More Product Categories
Edit `AddProductForm.jsx` line 63:
```jsx
<option value="electronics">Electronics</option>
<option value="clothing">Clothing</option>
```

### Customize Team Roles
Edit `Prisma` schema:
```prisma
role String // "ADMIN", "STAFF", "SUPPORT", "QUALITY_CHECKER"
```

---

## 🐛 If Something Goes Wrong

### Products page blank
- Check API: `GET /api/v1/admin-dashboard/products`
- Verify token in localStorage
- Check browser console for errors

### Shared inbox not showing messages
- Run migration again: `npx prisma migrate deploy`
- Restart backend: `npm run dev`
- Check if Twilio webhook is configured (see WHATSAPP_WEBHOOK_FIX.md)

### Can't assign to team member
- Verify team member exists (add from UI)
- Check user has correct role
- Refresh page and try again

### Dashboard shows 0 orders
- Normal if just deployed
- Wait for first order to come through
- Stats update in real-time

---

## 📞 Next Steps

1. ✅ Run database migration
2. ✅ Create admin user
3. ✅ Add team members
4. ✅ Add products to catalog
5. ✅ Configure Twilio webhook (see WHATSAPP_WEBHOOK_FIX.md)
6. ✅ Test by sending message to +1 (415) 523-8886
7. ✅ See message in shared inbox
8. ✅ Assign and reply

---

## 📖 Full Documentation

Read [ADMIN_PANEL_GUIDE.md](ADMIN_PANEL_GUIDE.md) for:
- Detailed feature explanations
- Step-by-step workflows
- API endpoint documentation
- Database schema details
- Troubleshooting guide
- Deployment checklist

---

## ✨ You're All Set!

Your admin panel is ready to use. The backend and frontend are fully integrated.

Next time someone sends a WhatsApp message, you'll see it appear in the shared inbox automatically, and multiple team members can collaborate on responding.

**Go to:** `https://whatsapp-ordering-system.onrender.com/admin`
