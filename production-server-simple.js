const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = 3005;

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'whatsapp_ordering',
  password: 'postgres',
  port: 5432,
  ssl: false
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check with database
app.get('/health', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'WhatsApp Ordering System API is running',
      database: 'connected',
      dbTime: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// Get products from database
app.get('/api/v1/products', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p."categoryId" = c.id 
      ORDER BY p.name
    `);
    client.release();
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get orders from database
app.get('/api/v1/orders', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT o.*, r."pasalName" as retailer_name, r."phoneNumber" as retailer_phone
      FROM orders o 
      LEFT JOIN retailers r ON o."retailerId" = r.id 
      ORDER BY o."createdAt" DESC
      LIMIT 50
    `);
    client.release();
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get retailers from database
app.get('/api/v1/retailers', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT r.*, 
        (SELECT COUNT(*) FROM orders WHERE "retailerId" = r.id) as total_orders,
        (SELECT MAX("createdAt") FROM orders WHERE "retailerId" = r.id) as last_order_at
      FROM retailers r 
      ORDER BY r."pasalName"
    `);
    client.release();
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Analytics dashboard
app.get('/api/v1/analytics/dashboard', async (req, res) => {
  try {
    const client = await pool.connect();
    
    // Get summary stats
    const summaryResult = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM orders) as total_orders,
        (SELECT COUNT(*) FROM retailers WHERE status = 'ACTIVE') as active_retailers,
        (SELECT COUNT(*) FROM orders WHERE status IN ('CREATED', 'PENDING_BIDS', 'CREDIT_APPROVED')) as pending_orders,
        (SELECT COALESCE(SUM("totalAmount"), 0) FROM orders WHERE status = 'DELIVERED') as total_revenue
    `);
    
    // Get recent orders
    const recentOrdersResult = await client.query(`
      SELECT o.id, o."orderNumber", r."pasalName" as retailer, o."totalAmount" as amount, o.status
      FROM orders o 
      LEFT JOIN retailers r ON o."retailerId" = r.id 
      ORDER BY o."createdAt" DESC 
      LIMIT 10
    `);
    
    // Get sales chart data (last 7 days)
    const salesChartResult = await client.query(`
      SELECT 
        DATE(o."createdAt") as date,
        COALESCE(SUM(o."totalAmount"), 0) as sales
      FROM orders o 
      WHERE o."createdAt" >= CURRENT_DATE - INTERVAL '7 days'
        AND o.status = 'DELIVERED'
      GROUP BY DATE(o."createdAt")
      ORDER BY date
    `);
    
    client.release();
    
    res.json({
      success: true,
      data: {
        summary: summaryResult.rows[0],
        recentOrders: recentOrdersResult.rows,
        salesChart: salesChartResult.rows
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// WhatsApp webhook
app.post('/api/v1/whatsapp/webhook', (req, res) => {
  console.log('📱 WhatsApp webhook received:', req.body);
  res.json({ success: true, message: 'Webhook processed' });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 WhatsApp Ordering System - Production API');
  console.log('==========================================');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/health`);
  console.log(`📍 Products: http://localhost:${PORT}/api/v1/products`);
  console.log(`📍 Orders: http://localhost:${PORT}/api/v1/orders`);
  console.log(`📍 Analytics: http://localhost:${PORT}/api/v1/analytics/dashboard`);
  console.log('==========================================');
  console.log('✅ Production API with real database connection');
  console.log('✅ Ready for frontend integration');
});