#!/usr/bin/env node

/**
 * Admin Retailer Dashboard - API Test Utility
 * 
 * Usage:
 *   node test-admin-dashboard.js --api-key <key> [--retailer <id>]
 * 
 * Examples:
 *   node test-admin-dashboard.js --api-key admin_xxxxx
 *   node test-admin-dashboard.js --api-key admin_xxxxx --retailer ret_001
 *   node test-admin-dashboard.js --help
 */

const http = require('http');
const https = require('https');
const url = require('url');

// Parse command line arguments
const args = process.argv.slice(2);
let apiKey = null;
let retailerId = null;
let baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
let verbose = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--api-key' && i + 1 < args.length) {
    apiKey = args[i + 1];
    i++;
  } else if (args[i] === '--retailer' && i + 1 < args.length) {
    retailerId = args[i + 1];
    i++;
  } else if (args[i] === '--url' && i + 1 < args.length) {
    baseUrl = args[i + 1];
    i++;
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    verbose = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    printHelp();
    process.exit(0);
  }
}

if (!apiKey) {
  console.error('❌ Error: API key required');
  console.error('Usage: node test-admin-dashboard.js --api-key <key>');
  process.exit(1);
}

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function printHelp() {
  console.log(`
Admin Retailer Dashboard - API Test Utility

Usage:
  node test-admin-dashboard.js --api-key <key> [options]

Options:
  --api-key <key>      API key for authentication (required)
  --retailer <id>      Retailer ID (optional, for specific tests)
  --url <url>          Base URL (default: http://localhost:3000)
  --verbose, -v        Verbose output
  --help, -h           Show this help message

Examples:
  # Test all endpoints
  node test-admin-dashboard.js --api-key admin_xxxxxxxxxxxxx

  # Test with specific retailer
  node test-admin-dashboard.js --api-key admin_xxxxxxxxxxxxx --retailer ret_001

  # Test against different server
  node test-admin-dashboard.js --api-key admin_xxxxxxxxxxxxx --url https://api.example.com

  # Verbose output
  node test-admin-dashboard.js --api-key admin_xxxxxxxxxxxxx --verbose
  `);
}

/**
 * Make HTTP request
 */
function makeRequest(pathname, method = 'GET') {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(pathname, baseUrl);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const options = {
      method,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    };

    if (verbose) {
      log(`\n📤 ${method} ${urlObj.pathname}${urlObj.search}`, 'gray');
    }

    const req = protocol.request(urlObj, options, (res) => {
      let data = '';

      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Test dashboard endpoint
 */
async function testDashboard() {
  log('\n📊 Testing Dashboard Endpoint', 'blue');
  log('GET /api/v1/admin/retailer-dashboard', 'cyan');

  try {
    const response = await makeRequest('/api/v1/admin/retailer-dashboard');

    if (response.status === 200 && response.body.success) {
      log('✅ Dashboard endpoint working', 'green');

      if (response.body.totals) {
        log(`   Total Retailers: ${response.body.totals.totalRetailers}`, 'gray');
        log(`   Active: ${response.body.totals.activeRetailers}`, 'gray');
        log(`   Total Credit Balance: ${response.body.totals.totalCreditBalance}`, 'gray');
        log(`   Outstanding Orders: ${response.body.totals.totalOutstandingOrders}`, 'gray');
        log(`   Outstanding Amount: ${response.body.totals.totalOutstandingAmount}`, 'gray');
      }

      return true;
    } else {
      log(`❌ Dashboard endpoint failed: ${response.status}`, 'red');
      if (response.body.error) {
        log(`   Error: ${response.body.error}`, 'red');
      }
      return false;
    }
  } catch (error) {
    log(`❌ Dashboard endpoint error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test retailers overview endpoint
 */
async function testRetailersOverview() {
  log('\n👥 Testing Retailers Overview Endpoint', 'blue');
  log('GET /api/v1/admin/retailers/overview', 'cyan');

  try {
    const response = await makeRequest('/api/v1/admin/retailers/overview?limit=10');

    if (response.status === 200 && response.body.success) {
      log('✅ Retailers overview endpoint working', 'green');

      if (response.body.totals) {
        log(`   Total Retailers: ${response.body.totals.totalRetailers}`, 'gray');
        log(`   Active: ${response.body.totals.activeRetailers}`, 'gray');
        log(`   Total Credit Allocated: ${response.body.totals.totalCreditAllocated}`, 'gray');
        log(`   Total Credit Used: ${response.body.totals.totalCreditUsed}`, 'gray');
      }

      if (response.body.retailers && response.body.retailers.length > 0) {
        log(`   Sample Retailer: ${response.body.retailers[0].pasalName}`, 'gray');
        log(`   Utilization: ${response.body.retailers[0].utilizationRate}%`, 'gray');
        return response.body.retailers[0].id;
      }

      return null;
    } else {
      log(`❌ Retailers overview endpoint failed: ${response.status}`, 'red');
      if (response.body.error) {
        log(`   Error: ${response.body.error}`, 'red');
      }
      return null;
    }
  } catch (error) {
    log(`❌ Retailers overview endpoint error: ${error.message}`, 'red');
    return null;
  }
}

/**
 * Test retailer credit endpoint
 */
async function testRetailerCredit(retailerId) {
  log('\n💳 Testing Retailer Credit Endpoint', 'blue');
  log(`GET /api/v1/admin/retailers/${retailerId}/credit`, 'cyan');

  try {
    const response = await makeRequest(`/api/v1/admin/retailers/${retailerId}/credit`);

    if (response.status === 200 && response.body.success) {
      log('✅ Retailer credit endpoint working', 'green');

      if (response.body.retailer) {
        log(`   Retailer: ${response.body.retailer.pasalName}`, 'gray');
      }

      if (response.body.mainAccount) {
        log(`   Credit Limit: ${response.body.mainAccount.creditLimit}`, 'gray');
        log(`   Used: ${response.body.mainAccount.usedCredit}`, 'gray');
        log(`   Available: ${response.body.mainAccount.availableCredit}`, 'gray');
        log(`   Utilization: ${response.body.mainAccount.utilizationRate}%`, 'gray');
      }

      if (response.body.wholesalerCredits) {
        log(`   Wholesaler Credits: ${response.body.wholesalerCredits.length}`, 'gray');
      }

      return true;
    } else {
      log(`❌ Retailer credit endpoint failed: ${response.status}`, 'red');
      if (response.body.error) {
        log(`   Error: ${response.body.error}`, 'red');
      }
      return false;
    }
  } catch (error) {
    log(`❌ Retailer credit endpoint error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test outstanding orders endpoint
 */
async function testOutstandingOrders(retailerId) {
  log('\n📋 Testing Outstanding Orders Endpoint', 'blue');
  log(`GET /api/v1/admin/retailers/${retailerId}/orders`, 'cyan');

  try {
    const response = await makeRequest(`/api/v1/admin/retailers/${retailerId}/orders`);

    if (response.status === 200 && response.body.success) {
      log('✅ Outstanding orders endpoint working', 'green');

      if (response.body.stats) {
        log(`   Total Orders: ${response.body.stats.total}`, 'gray');
        log(`   Total Amount: ${response.body.stats.totalAmount}`, 'gray');
        log(`   Average Age: ${response.body.stats.averageOrderAge} days`, 'gray');
        log(`   Oldest Order: ${response.body.stats.oldestOrderDays} days`, 'gray');
        log(`   By Status - Created: ${response.body.stats.byStatus.CREATED}`, 'gray');
        log(`   By Status - Confirmed: ${response.body.stats.byStatus.CONFIRMED}`, 'gray');
        log(`   By Status - In Transit: ${response.body.stats.byStatus.IN_TRANSIT}`, 'gray');
      }

      if (response.body.orders && response.body.orders.length > 0) {
        log(`   First Order: ${response.body.orders[0].orderNumber}`, 'gray');
        log(`   Amount: ${response.body.orders[0].totalAmount}`, 'gray');
      }

      return true;
    } else {
      log(`❌ Outstanding orders endpoint failed: ${response.status}`, 'red');
      if (response.body.error) {
        log(`   Error: ${response.body.error}`, 'red');
      }
      return false;
    }
  } catch (error) {
    log(`❌ Outstanding orders endpoint error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test payment history endpoint
 */
async function testPaymentHistory(retailerId) {
  log('\n💰 Testing Payment History Endpoint', 'blue');
  log(`GET /api/v1/admin/retailers/${retailerId}/payments`, 'cyan');

  try {
    const response = await makeRequest(`/api/v1/admin/retailers/${retailerId}/payments`);

    if (response.status === 200 && response.body.success) {
      log('✅ Payment history endpoint working', 'green');

      if (response.body.summary) {
        log(`   Total Payments: ${response.body.summary.total}`, 'gray');
        log(`   Total Amount: ${response.body.summary.totalAmount}`, 'gray');
        log(`   Pending: ${response.body.summary.byStatus.PENDING}`, 'gray');
        log(`   Cleared: ${response.body.summary.byStatus.CLEARED}`, 'gray');
        log(`   Failed: ${response.body.summary.byStatus.FAILED}`, 'gray');
        log(`   Pending Amount: ${response.body.summary.pendingAmount}`, 'gray');
      }

      if (response.body.payments && response.body.payments.length > 0) {
        log(`   First Payment: ${response.body.payments[0].amount}`, 'gray');
        log(`   Status: ${response.body.payments[0].status}`, 'gray');
      }

      return true;
    } else {
      log(`❌ Payment history endpoint failed: ${response.status}`, 'red');
      if (response.body.error) {
        log(`   Error: ${response.body.error}`, 'red');
      }
      return false;
    }
  } catch (error) {
    log(`❌ Payment history endpoint error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  log('\n═══════════════════════════════════════════════════════', 'blue');
  log('🧪 Admin Retailer Dashboard API - Test Suite', 'blue');
  log('═══════════════════════════════════════════════════════\n', 'blue');

  log(`Base URL: ${baseUrl}`, 'gray');
  log(`API Key: ${apiKey.substring(0, 10)}...`, 'gray');

  const results = [];

  // Test 1: Dashboard
  results.push({
    name: 'Dashboard',
    passed: await testDashboard()
  });

  // Test 2: Retailers Overview
  const firstRetailerId = await testRetailersOverview();
  results.push({
    name: 'Retailers Overview',
    passed: firstRetailerId !== null
  });

  // Use provided retailer ID or first found
  const targetRetailerId = retailerId || firstRetailerId;

  if (targetRetailerId) {
    // Test 3: Retailer Credit
    results.push({
      name: 'Retailer Credit',
      passed: await testRetailerCredit(targetRetailerId)
    });

    // Test 4: Outstanding Orders
    results.push({
      name: 'Outstanding Orders',
      passed: await testOutstandingOrders(targetRetailerId)
    });

    // Test 5: Payment History
    results.push({
      name: 'Payment History',
      passed: await testPaymentHistory(targetRetailerId)
    });
  } else {
    log('\n⚠️  No retailers found to test individual endpoints', 'yellow');
  }

  // Summary
  log('\n═══════════════════════════════════════════════════════', 'blue');
  log('📊 Test Summary', 'blue');
  log('═══════════════════════════════════════════════════════\n', 'blue');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    const color = result.passed ? 'green' : 'red';
    log(`${icon} ${result.name}`, color);
  });

  log(`\n${passed}/${total} tests passed`, passed === total ? 'green' : 'red');

  if (passed === total) {
    log('\n🎉 All tests passed! API is working correctly.', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some tests failed. Check the output above.', 'yellow');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
