/**
 * API Endpoints Test Script
 * Run with: node test-api-endpoints.js
 */

require('dotenv').config();
const axios = require('axios');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';
let authToken = '';

async function login() {
  console.log('\n🔐 Testing Login...');
  try {
    const response = await axios.post(`${API_BASE}/api/v1/auth/login`, {
      phoneNumber: process.env.TEST_PHONE || '+1234567890',
      password: process.env.TEST_PASSWORD || 'password123'
    });

    if (response.data.success && response.data.data.token) {
      authToken = response.data.data.token;
      console.log('✅ Login successful');
      return true;
    }
    return false;
  } catch (error) {
    console.log('⚠️  Login failed (this is OK if no test user exists):', error.response?.data?.error || error.message);
    return false;
  }
}

async function testEndpoint(method, path, data = null, requiresAuth = true) {
  try {
    const config = {
      method,
      url: `${API_BASE}${path}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (requiresAuth && authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

async function runTests() {
  console.log('🧪 API Endpoints Test Suite');
  console.log('='.repeat(60));

  // Health check (no auth)
  console.log('\n📡 Testing Public Endpoints...');
  const health = await testEndpoint('GET', '/health', null, false);
  console.log('   Health Check:', health.success ? '✅' : '❌', health.status);

  // Try to login
  await login();

  if (!authToken) {
    console.log('\n⚠️  No auth token - skipping protected endpoints');
    console.log('   Create a test user or set TEST_PHONE and TEST_PASSWORD in .env');
    return;
  }

  console.log('\n📦 Testing Product Endpoints...');
  const products = await testEndpoint('GET', '/api/v1/products', null, false);
  console.log('   GET /products:', products.success ? '✅' : '❌', products.status);
  if (products.success) {
    console.log(`      Found ${products.data.data?.length || 0} products`);
  }

  const categories = await testEndpoint('GET', '/api/v1/categories', null, false);
  console.log('   GET /categories:', categories.success ? '✅' : '❌', categories.status);

  console.log('\n👤 Testing Auth Endpoints...');
  const me = await testEndpoint('GET', '/api/v1/auth/me');
  console.log('   GET /auth/me:', me.success ? '✅' : '❌', me.status);

  console.log('\n📋 Testing Order Endpoints...');
  const orders = await testEndpoint('GET', '/api/v1/orders');
  console.log('   GET /orders:', orders.success ? '✅' : '❌', orders.status);
  if (orders.success) {
    console.log(`      Found ${orders.data.data?.orders?.length || 0} orders`);
  }

  console.log('\n🛒 Testing Cart Endpoints...');
  const cart = await testEndpoint('GET', '/api/v1/cart');
  console.log('   GET /cart:', cart.success ? '✅' : '❌', cart.status);

  console.log('\n📊 Testing Admin Endpoints...');
  const dashboard = await testEndpoint('GET', '/api/v1/admin/dashboard');
  console.log('   GET /admin/dashboard:', dashboard.success ? '✅' : '❌', dashboard.status);
  
  if (dashboard.success) {
    console.log('      Stats:', JSON.stringify(dashboard.data.data?.stats || {}));
  }

  const adminOrders = await testEndpoint('GET', '/api/v1/admin/orders');
  console.log('   GET /admin/orders:', adminOrders.success ? '✅' : '❌', adminOrders.status);

  const adminUsers = await testEndpoint('GET', '/api/v1/admin/users');
  console.log('   GET /admin/users:', adminUsers.success ? '✅' : '❌', adminUsers.status);

  console.log('\n📦 Testing Delivery Endpoints...');
  const deliveries = await testEndpoint('GET', '/api/v1/delivery');
  console.log('   GET /delivery:', deliveries.success ? '✅' : '❌', deliveries.status);

  console.log('\n💬 Testing Support Endpoints...');
  const tickets = await testEndpoint('GET', '/api/v1/support/tickets');
  console.log('   GET /support/tickets:', tickets.success ? '✅' : '❌', tickets.status);

  console.log('\n💰 Testing Pricing Endpoints...');
  const pricingRules = await testEndpoint('GET', '/api/v1/pricing');
  console.log('   GET /pricing:', pricingRules.success ? '✅' : '❌', pricingRules.status);

  console.log('\n✅ Test suite completed!');
}

runTests().catch(console.error);

