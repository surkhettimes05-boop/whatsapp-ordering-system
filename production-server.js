const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const { initializeTwilio, WhatsAppProcessor, verifyWebhookSignature } = require('./twilio-setup');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();

// Initialize services
const twilioClient = initializeTwilio();
const whatsappProcessor = new WhatsAppProcessor();

// =============================================================================
// MIDDLEWARE SETUP
// =============================================================================

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Compression
app.use(compression());

// CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// =============================================================================
// HEALTH CHECK ENDPOINTS
// =============================================================================

app.get('/health', async (req, res) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION || '1.0.0',
    services: {}
  };

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    healthCheck.services.database = 'connected';
  } catch (error) {
    healthCheck.services.database = 'disconnected';
    healthCheck.status = 'degraded';
  }

  // Check Redis (if configured)
  healthCheck.services.redis = 'mock'; // TODO: Add Redis health check

  // Check Twilio
  healthCheck.services.twilio = twilioClient ? 'connected' : 'mock';

  res.status(healthCheck.status === 'ok' ? 200 : 503).json(healthCheck);
});

app.get('/health/detailed', async (req, res) => {
  const detailed = {
    timestamp: new Date().toISOString(),
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    },
    database: {},
    services: {}
  };

  // Database stats
  try {
    const [userCount, orderCount, productCount] = await Promise.all([
      prisma.user.count(),
      prisma.order.count(),
      prisma.product.count()
    ]);
    
    detailed.database = {
      status: 'connected',
      users: userCount,
      orders: orderCount,
      products: productCount
    };
  } catch (error) {
    detailed.database = { status: 'error', error: error.message };
  }

  res.json(detailed);
});

// =============================================================================
// API ROUTES
// =============================================================================

// Products API
app.get('/api/v1/products', async (req, res) => {
  try {
    const { page = 1, limit = 50, category, search } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      isActive: true,
      deletedAt: null,
      ...(category && { category: { slug: category } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      })
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          wholesalerProducts: {
            where: { isAvailable: true },
            include: { wholesaler: true },
            orderBy: { priceOffered: 'asc' },
            take: 3 // Show top 3 cheapest offers
          }
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { name: 'asc' }
      }),
      prisma.product.count({ where })
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Products API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
      message: error.message
    });
  }
});

// Orders API
app.get('/api/v1/orders', async (req, res) => {
  try {
    const { page = 1, limit = 50, status, retailer } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(status && { status }),
      ...(retailer && { retailerId: retailer })
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          retailer: true,
          wholesaler: true,
          items: {
            include: { product: true }
          }
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.order.count({ where })
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Orders API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
      message: error.message
    });
  }
});

// Retailers API
app.get('/api/v1/retailers', async (req, res) => {
  try {
    const { page = 1, limit = 50, city, status } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(city && { city }),
      ...(status && { status })
    };

    const [retailers, total] = await Promise.all([
      prisma.retailer.findMany({
        where,
        include: {
          credit: true,
          _count: {
            select: { orders: true }
          }
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.retailer.count({ where })
    ]);

    res.json({
      success: true,
      data: retailers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Retailers API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch retailers',
      message: error.message
    });
  }
});

// Analytics Dashboard API
app.get('/api/v1/analytics/dashboard', async (req, res) => {
  try {
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalOrders,
      totalRevenue,
      activeRetailers,
      pendingOrders,
      recentOrders,
      dailySales
    ] = await Promise.all([
      prisma.order.count({ where: { deletedAt: null } }),
      prisma.order.aggregate({
        where: { status: 'DELIVERED', deletedAt: null },
        _sum: { totalAmount: true }
      }),
      prisma.retailer.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      prisma.order.count({ where: { status: { in: ['CREATED', 'PROCESSING'] }, deletedAt: null } }),
      prisma.order.findMany({
        where: { deletedAt: null },
        include: { retailer: true },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.order.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: { gte: lastWeek },
          deletedAt: null
        },
        _sum: { totalAmount: true },
        _count: true
      })
    ]);

    // Process daily sales data
    const salesChart = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayData = dailySales.filter(sale => 
        sale.createdAt.toISOString().split('T')[0] === dateStr
      );
      
      const dayTotal = dayData.reduce((sum, sale) => 
        sum + (parseFloat(sale._sum.totalAmount) || 0), 0
      );
      
      salesChart.push({
        date: dateStr,
        sales: dayTotal,
        orders: dayData.reduce((sum, sale) => sum + sale._count, 0)
      });
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalOrders,
          totalRevenue: parseFloat(totalRevenue._sum.totalAmount) || 0,
          activeRetailers,
          pendingOrders
        },
        recentOrders: recentOrders.map(order => ({
          id: order.id,
          orderNumber: order.orderNumber,
          retailer: order.retailer.pasalName,
          amount: parseFloat(order.totalAmount),
          status: order.status,
          createdAt: order.createdAt
        })),
        salesChart
      }
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
      message: error.message
    });
  }
});

// =============================================================================
// WHATSAPP WEBHOOK
// =============================================================================

app.post('/api/v1/whatsapp/webhook', async (req, res) => {
  try {
    // Verify webhook signature in production
    if (process.env.NODE_ENV === 'production' && !verifyWebhookSignature(req)) {
      console.error('Invalid webhook signature');
      return res.status(403).json({ error: 'Invalid signature' });
    }

    const { From, Body, MessageSid } = req.body;
    
    if (!From || !Body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`📱 WhatsApp message received from ${From}: ${Body}`);

    // Process message
    const response = await whatsappProcessor.processMessage(From, Body, MessageSid);
    
    // Log the interaction
    console.log(`🤖 Response: ${response.action}`);

    res.json({
      success: true,
      message: 'Message processed',
      action: response.action
    });

  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message',
      message: error.message
    });
  }
});

// WhatsApp status callback
app.post('/api/v1/whatsapp/status', (req, res) => {
  console.log('📊 WhatsApp status update:', req.body);
  res.json({ success: true });
});

// =============================================================================
// ORDER MANAGEMENT
// =============================================================================

// Create order endpoint
app.post('/api/v1/orders', async (req, res) => {
  try {
    const { retailerId, items, paymentMode = 'COD' } = req.body;

    if (!retailerId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: retailerId, items'
      });
    }

    // Calculate totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (!product) {
        return res.status(400).json({
          success: false,
          error: `Product not found: ${item.productId}`
        });
      }

      const itemTotal = parseFloat(product.fixedPrice) * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        priceAtOrder: product.fixedPrice
      });
    }

    const taxAmount = subtotal * 0.13; // 13% VAT
    const totalAmount = subtotal + taxAmount;

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNumber: `WO-${Date.now().toString().slice(-6)}`,
        retailerId,
        subtotal,
        taxRate: 13.0,
        taxAmount,
        totalAmount,
        paymentMode,
        status: 'CREATED',
        items: {
          create: orderItems
        }
      },
      include: {
        items: {
          include: { product: true }
        },
        retailer: true
      }
    });

    console.log(`📋 Order created: ${order.orderNumber} for ${order.retailer.pasalName}`);

    res.status(201).json({
      success: true,
      data: order,
      message: 'Order created successfully'
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      message: error.message
    });
  }
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  res.status(error.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Start server
    const server = app.listen(PORT, () => {
      console.log('🚀 WhatsApp Ordering System - Production Server');
      console.log('================================================');
      console.log(`📍 Server: http://localhost:${PORT}`);
      console.log(`📍 Health: http://localhost:${PORT}/health`);
      console.log(`📍 API: http://localhost:${PORT}/api/v1`);
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
      console.log(`📍 Version: ${process.env.APP_VERSION || '1.0.0'}`);
      console.log('================================================');
      console.log('✅ Server is ready to handle requests');
      
      if (twilioClient) {
        console.log('✅ Twilio WhatsApp integration active');
      } else {
        console.log('⚠️  Running in mock mode - configure Twilio for production');
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('🛑 SIGTERM received, shutting down gracefully');
      server.close(async () => {
        await prisma.$disconnect();
        console.log('✅ Server shut down complete');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('🛑 SIGINT received, shutting down gracefully');
      server.close(async () => {
        await prisma.$disconnect();
        console.log('✅ Server shut down complete');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app;