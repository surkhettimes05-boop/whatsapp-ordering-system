# System Architecture

## Overview

Complete WhatsApp Ordering System Backend for Retailers and Wholesalers with integrated Admin Dashboard.

## System Flow

```
WhatsApp Business API
        |
        | (messages, images, voice)
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

## Core Modules

### 1. WhatsApp Integration (`/api/v1/whatsapp`)
- **Webhook Handler**: Receives messages from WhatsApp Business API
- **Message Processing**: Auto-registers users, processes commands
- **Response System**: Sends automated responses, order confirmations
- **Media Support**: Handles images, audio, video, documents
- **Message History**: Stores all incoming/outgoing messages

**Key Features:**
- Auto-user registration from WhatsApp
- Command processing (menu, cart, orders, help)
- Order notifications via WhatsApp
- Media file handling

### 2. Order Management (`/api/v1/orders`)
- **Order Creation**: From cart or direct
- **Order Tracking**: Status updates, history
- **Stock Management**: Automatic stock deduction
- **Order Lifecycle**: PENDING → CONFIRMED → PROCESSING → PACKED → SHIPPED → DELIVERED

**Key Features:**
- Automatic stock management
- Order number generation
- Tax and delivery charge calculation
- Order cancellation with stock restoration

### 3. Pricing Module (`/api/v1/pricing`)
- **Dynamic Pricing**: User-specific, category-based, bulk pricing
- **Discount Rules**: Percentage, fixed amount, fixed price
- **Pricing Rules**: BULK, DISCOUNT, USER_SPECIFIC, CATEGORY
- **Price Calculation**: Real-time price calculation based on rules

**Key Features:**
- Multiple pricing rule types
- Priority-based rule application
- Quantity-based discounts
- Time-bound pricing rules

### 4. Delivery Module (`/api/v1/delivery`)
- **Delivery Creation**: Automatic on order confirmation
- **Tracking System**: Real-time tracking with history
- **Status Updates**: PENDING → ASSIGNED → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
- **Agent Management**: Assign delivery agents
- **Location Tracking**: GPS coordinates, location updates

**Key Features:**
- Unique tracking numbers
- Delivery history/updates
- Agent assignment
- Location tracking
- Public tracking endpoint

### 5. Support Module (`/api/v1/support`)
- **Ticket System**: Create, manage support tickets
- **Message Threading**: Conversation history
- **Ticket Categories**: ORDER, PRODUCT, PAYMENT, DELIVERY, OTHER
- **Priority Levels**: LOW, MEDIUM, HIGH, URGENT
- **Agent Assignment**: Assign tickets to support agents
- **Internal Notes**: Private notes for support team

**Key Features:**
- Ticket lifecycle management
- File attachments
- Internal/external messages
- Ticket assignment
- Resolution tracking

### 6. Admin Dashboard (`/api/v1/admin`)
- **Dashboard Stats**: Users, orders, revenue, pending items
- **User Management**: View, update, activate/deactivate users
- **Order Management**: View all orders, update status
- **Delivery Management**: View all deliveries, update status
- **Support Management**: View all tickets, assign agents

**Key Features:**
- Comprehensive statistics
- User management
- Order oversight
- System monitoring

### 7. User Management (`/api/v1/auth`)
- **Authentication**: JWT-based authentication
- **User Roles**: ADMIN, WHOLESALER, RETAILER, SUPPORT
- **Profile Management**: Update profile, change password
- **Auto-registration**: From WhatsApp messages

### 8. Product Management (`/api/v1/products`)
- **Product Catalog**: List, search, filter products
- **Product CRUD**: Create, update, delete products
- **Stock Management**: Update stock levels
- **Featured Products**: Highlight featured items
- **Category Management**: Organize by categories

### 9. Cart Management (`/api/v1/cart`)
- **Add to Cart**: Add products with quantities
- **Update Cart**: Modify quantities
- **View Cart**: Get cart with product details
- **Clear Cart**: Remove all items

### 10. Address Management (`/api/v1/addresses`)
- **Address CRUD**: Create, read, update, delete addresses
- **Default Address**: Set default delivery address
- **Multiple Addresses**: Support multiple addresses per user

## Database Schema

### Core Models
- **User**: Retailers, Wholesalers, Admin, Support
- **Product**: Product catalog with pricing
- **Category**: Product categories
- **Order**: Order management
- **OrderItem**: Order line items
- **CartItem**: Shopping cart items
- **Address**: Delivery addresses

### Extended Models
- **PricingRule**: Dynamic pricing rules
- **Delivery**: Delivery tracking
- **DeliveryUpdate**: Delivery status history
- **SupportTicket**: Support tickets
- **SupportMessage**: Ticket messages
- **SupportAttachment**: File attachments
- **WhatsAppMessage**: Message history
- **MediaFile**: File storage metadata

## API Structure

### Authentication
- JWT tokens in Authorization header
- Role-based access control
- Admin middleware for protected routes

### Response Format
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "pagination": { ... }
}
```

### Error Format
```json
{
  "success": false,
  "error": "Error message",
  "errors": [ ... ]
}
```

## File Storage

### Local Storage (Default)
- Files stored in `backend/uploads/`
- Organized by entity type (products, users, orders, support, whatsapp)
- Served as static files at `/uploads/*`

### Cloud Storage (Optional)
- Support for S3, Cloudinary
- Configure in `fileStorage.service.js`
- Set credentials in `.env`

## Security

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **JWT**: Secure token-based authentication
- **Input Validation**: Express-validator
- **Role-based Access**: Admin/User separation
- **SQL Injection Protection**: Prisma ORM

## WhatsApp Commands

Users can interact via WhatsApp:

- `hi`, `hello`, `start` → Welcome message
- `menu`, `products`, `catalog` → Product catalog
- `cart`, `basket` → Cart summary
- `order`, `my orders` → Order history
- `help`, `support` → Help message
- Product numbers → Add to cart
- `checkout` → Place order
- `track [order number]` → Track order

## Integration Points

### WhatsApp Business API
- Webhook URL: `/api/v1/whatsapp/webhook`
- Message processing
- Media handling
- Automated responses

### Admin Dashboard (Frontend)
- RESTful API endpoints
- Real-time statistics
- Management interfaces

### External Services (Optional)
- Payment gateways
- SMS services
- Email services
- Cloud storage

## Scalability Considerations

- **Database Indexing**: Optimized queries
- **Pagination**: All list endpoints
- **File Storage**: Cloud storage ready
- **Caching**: Can add Redis
- **Load Balancing**: Stateless API design
- **Microservices Ready**: Modular architecture

## Monitoring & Logging

- Request logging
- Error logging
- Database query logging (development)
- Health check endpoint: `/health`

## Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Environment Variables
- See `.env.example` for all required variables
- Set `NODE_ENV=production`
- Configure database, WhatsApp API, JWT secret

## Next Steps

1. **Frontend Dashboard**: Build admin web dashboard
2. **Payment Integration**: Add payment gateways
3. **Notifications**: Email/SMS notifications
4. **Analytics**: Order analytics, reports
5. **Inventory Management**: Advanced stock management
6. **Multi-warehouse**: Support multiple warehouses
7. **Reports**: Generate business reports

