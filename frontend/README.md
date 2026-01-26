# Admin Dashboard Frontend

Modern React-based admin dashboard for WhatsApp Ordering System.

## Features

- ✅ **Dashboard** - Overview with statistics and recent orders
- ✅ **Orders Management** - View and update order status
- ✅ **Products Management** - Manage product catalog
- ✅ **Users Management** - Manage users and permissions
- ✅ **Deliveries** - Track deliveries
- ✅ **Support Tickets** - Manage customer support
- ✅ **WhatsApp** - Send messages and view history
- ✅ **Pricing** - Manage pricing rules

## Setup

1. **Install dependencies:**
```bash
cd frontend
npm install
```

2. **Start development server:**
```bash
npm run dev
```

3. **Access dashboard:**
- Open http://localhost:3000
- Login with admin credentials

## Build for Production

```bash
npm run build
```

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool
- **React Router** - Routing
- **Axios** - HTTP client
- **Recharts** - Charts
- **Lucide React** - Icons
- **Tailwind CSS** - Styling (via CDN in index.html)

## Project Structure

```
frontend/
├── src/
│   ├── components/     # Reusable components
│   ├── contexts/       # React contexts (Auth)
│   ├── pages/         # Page components
│   ├── services/      # API services
│   └── App.jsx        # Main app component
├── index.html
└── package.json
```

## API Integration

The frontend connects to the backend API at `http://localhost:5000/api/v1`.

All API calls are handled through `src/services/api.js` with automatic token management.

## Authentication

- JWT token stored in localStorage
- Automatic token refresh
- Protected routes
- Auto-redirect to login on 401

