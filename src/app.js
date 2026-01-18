const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

// Import middleware
const { requestLogger, logger } = require('./config/logger');
const { errorHandler } = require('./middleware/errorHandler.middleware');
const { securityHeaders, compress, apiLimiter, whatsappLimiter, httpLogger } = require('./middleware/production.middleware');

const app = express();

// Observability fallbacks (no-op) for test and minimal environments
let tracingMiddleware = (req, res, next) => next();
let metricsMiddleware = (req, res, next) => next();
let startAlertMonitoring = null;

try {
  const observability = require('./observability');
  tracingMiddleware = observability.tracingMiddleware || tracingMiddleware;
  metricsMiddleware = observability.metricsMiddleware || metricsMiddleware;
  startAlertMonitoring = observability.startAlertMonitoring || startAlertMonitoring;
} catch (e) {
  // Observability not present — continue with no-op middleware
}

app.use(securityHeaders);
app.use(cors());
app.use(compress);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(httpLogger);

// Observability: Tracing middleware (BEFORE other middleware)
app.use(tracingMiddleware);

// Observability: Metrics middleware
app.use(metricsMiddleware);

// Security: Add request ID and IP tracking
app.use((req, res, next) => {
  if (!req.requestId) {
    req.requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  req.clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.connection?.remoteAddress
    || req.ip
    || 'unknown';
  next();
});

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoints
const healthController = require('./controllers/health.controller');
app.get('/health', healthController.getHealth);
app.get('/health/detailed', healthController.getDetailedHealth);
app.get('/health/ready', healthController.getReadiness);
app.get('/health/live', healthController.getLiveness);

// --- API ROUTES ---

try {
  console.log('⏳ Loading Auth routes...');
  app.use('/api/v1/auth', require('./routes/auth.routes'));

  console.log('⏳ Loading Product, Category, Cart routes...');
  app.use('/api/v1/products', require('./routes/product.routes'));
  app.use('/api/v1/categories', require('./routes/category.routes'));
  app.use('/api/v1/cart', require('./routes/cart.routes'));

  console.log('⏳ Loading Address and Order routes...');
  app.use('/api/v1/addresses', require('./routes/address.routes'));
  app.use('/api/v1/orders', require('./routes/order.routes'));

  console.log('⏳ Loading WhatsApp routes...');
  app.use('/api/v1/whatsapp', require('./routes/whatsapp.routes'));

  console.log('⏳ Loading other system routes...');
  app.use('/api/v1/pricing', require('./routes/pricing.routes'));
  app.use('/api/v1/delivery', require('./routes/delivery.routes'));
  app.use('/api/v1/support', require('./routes/support.routes'));
  app.use('/api/v1/admin', apiLimiter, require('./routes/admin.routes'));
  app.use('/api/v1/admin-dashboard', require('./routes/adminDashboard.routes'));
  app.use('/api/v1/wholesalers', require('./routes/wholesaler.routes'));
  app.use('/api/v1/vendor-offers', require('./routes/vendorOffer.routes'));
  app.use('/api/v1/credit', require('./routes/credit.routes'));
  app.use('/api/v1/bidding', require('./routes/bidding.routes'));
  app.use('/api/v1/reports', require('./routes/reporting.routes'));
  app.use('/metrics', require('./routes/metrics.routes'));

  console.log('✅ All API routes loaded successfully');
} catch (e) {
  console.error('❌ Error loading API routes:', e.message);
  // Log full stack in dev
  if (process.env.NODE_ENV !== 'production') console.error(e.stack);
}

// Start alert monitoring
if (process.env.NODE_ENV !== 'test' && startAlertMonitoring) {
  try {
    startAlertMonitoring();
    logger.info('Alert monitoring initialized');
  } catch (e) {
    logger.error('Failed to start alert monitoring', { error: e.message });
  }
}

// --- QUEUE SYSTEM INITIALIZATION ---

function fallbackToLegacyJobs() {
  try {
    require('./jobs/routingTimeout.job');
    require('./jobs/paymentReminders.job');
    require('./jobs/orderRecovery.job');
    require('./jobs/guardrails.job');
    require('./jobs/expiredOrders.job');
    require('./jobs/wholesalerConfirmationTimeout.job');
    require('./jobs/biddingTimeout.job');
    console.log('✅ Legacy Background Jobs initiated');
  } catch (legacyError) {
    console.log('❌ Legacy jobs failed:', legacyError.message);
  }
}

if (process.env.NODE_ENV !== 'test') {
  const isRedisConfigured = process.env.REDIS_HOST || process.env.REDIS_URL || process.env.NODE_ENV === 'production';

  if (isRedisConfigured) {
    try {
      const { initializeQueues } = require('./queue/queue');
      const { initializeWorkers } = require('./queue/worker');
      const { initializeScheduledJobs } = require('./queue/scheduler');

      initializeQueues();
      initializeWorkers();
      initializeScheduledJobs();
      console.log('✅ BullMQ queue system initialized');
    } catch (e) {
      console.log('⚠️ Queue system initialization failed:', e.message);
      fallbackToLegacyJobs();
    }
  } else {
    console.log('ℹ️ Redis not configured — skipping BullMQ and using legacy jobs');
    fallbackToLegacyJobs();
  }
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Error handler (MUST be last!)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Start server with error handling
if (require.main === module && process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log('================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 API Base: http://localhost:${PORT}/api/v1`);
    console.log('================================');
  });

  // Handle server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Please use a different port.`);
      process.exit(1);
    } else {
      console.error('❌ Server error:', error);
      process.exit(1);
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      const prisma = require('./config/database');
      prisma.$disconnect().catch(() => { });
    });
  });
}

module.exports = app;