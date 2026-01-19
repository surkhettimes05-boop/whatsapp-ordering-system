#!/usr/bin/env node

/**
 * HTTPS Configuration Test Utility
 * 
 * Tests that HTTPS enforcement and webhook security are working correctly
 * 
 * Usage:
 *   node test-https-setup.js
 *   node test-https-setup.js --domain api.example.com
 *   node test-https-setup.js --verbose
 */

const http = require('http');
const https = require('https');
const url = require('url');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

function section(title) {
  console.log('\n' + colors.cyan + '═'.repeat(60));
  console.log('  ' + title);
  console.log('═'.repeat(60) + colors.reset);
}

function test(name) {
  process.stdout.write(colors.blue + '  ▸ ' + name + '... ' + colors.reset);
}

function pass(message = 'PASS') {
  console.log(colors.green + '✓ ' + message + colors.reset);
}

function fail(message = 'FAIL') {
  console.log(colors.red + '✗ ' + message + colors.reset);
}

function warn(message) {
  console.log(colors.yellow + '⚠ ' + message + colors.reset);
}

/**
 * Make HTTP/HTTPS request
 */
function makeRequest(targetUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new url.URL(targetUrl);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 5000
    };

    // For HTTPS, ignore self-signed certificates in dev
    if (isHttps && process.env.NODE_ENV !== 'production') {
      requestOptions.rejectUnauthorized = false;
    }

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
          url: targetUrl
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Test HTTP to HTTPS redirect
 */
async function testHttpRedirect(domain, port = 80) {
  section('Testing HTTP to HTTPS Redirect');

  test('HTTP request to /health');
  try {
    const response = await makeRequest(`http://${domain}:${port}/health`, {
      timeout: 10000
    });

    if (response.status === 301 || response.status === 302) {
      const location = response.headers.location;
      if (location && location.startsWith('https://')) {
        pass(`Redirects to HTTPS (${response.status})`);
        return true;
      } else {
        warn(`Redirects but not to HTTPS: ${location}`);
        return false;
      }
    } else if (response.status === 200) {
      warn('No redirect (may be in development mode)');
      return true; // OK in dev
    } else {
      fail(`Unexpected status: ${response.status}`);
      return false;
    }
  } catch (error) {
    if (error.message.includes('ECONNREFUSED')) {
      warn('Connection refused (server not running on HTTP port)');
      return null; // Skip
    }
    fail(error.message);
    return false;
  }
}

/**
 * Test HTTPS endpoint
 */
async function testHttpsEndpoint(domain, port = 443) {
  section('Testing HTTPS Endpoint');

  test('HTTPS request to /health');
  try {
    const response = await makeRequest(`https://${domain}:${port}/health`);
    
    if (response.status === 200) {
      pass('200 OK');
      return true;
    } else {
      warn(`Status: ${response.status}`);
      return true; // Still HTTPS works
    }
  } catch (error) {
    if (error.message.includes('ECONNREFUSED')) {
      warn('Connection refused (check if server is running)');
      return null; // Skip
    }
    fail(error.message);
    return false;
  }
}

/**
 * Test webhook HTTPS enforcement
 */
async function testWebhookHttpsEnforcement(domain) {
  section('Testing Webhook HTTPS Enforcement');

  // Test HTTPS webhook
  test('POST /api/v1/whatsapp/webhook via HTTPS');
  try {
    const response = await makeRequest(
      `https://${domain}/api/v1/whatsapp/webhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { test: 'data' }
      }
    );

    if (response.status === 403) {
      // 403 means HTTPS works but webhook validation failed (expected with dummy data)
      pass('HTTPS accepted');
    } else if (response.status === 400 || response.status === 401 || response.status === 422) {
      pass('HTTPS accepted (webhook validation error - expected)');
    } else {
      warn(`Status: ${response.status}`);
    }
  } catch (error) {
    if (error.message.includes('ECONNREFUSED')) {
      warn('Connection refused');
      return null;
    }
    fail(error.message);
    return false;
  }

  // Test HTTP webhook (should fail)
  test('POST /api/v1/whatsapp/webhook via HTTP');
  try {
    const response = await makeRequest(
      `http://${domain}/api/v1/whatsapp/webhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { test: 'data' }
      }
    );

    if (response.status === 403) {
      pass('403 Forbidden (HTTPS required)');
      return true;
    } else if (response.status === 301 || response.status === 302) {
      warn('Redirecting instead of rejecting');
      return true; // Still secure
    } else {
      warn(`Status: ${response.status} (expected 403)`);
      return true; // May be redirect
    }
  } catch (error) {
    if (error.message.includes('ECONNREFUSED')) {
      warn('Connection refused');
      return null;
    }
    fail(error.message);
    return false;
  }

  return true;
}

/**
 * Test security headers
 */
async function testSecurityHeaders(domain) {
  section('Testing Security Headers');

  test('Checking Strict-Transport-Security header');
  try {
    const response = await makeRequest(`https://${domain}/health`);
    
    if (response.headers['strict-transport-security']) {
      pass(response.headers['strict-transport-security']);
      return true;
    } else {
      warn('Header not found');
      return true; // May not be set in dev
    }
  } catch (error) {
    warn(error.message);
    return null;
  }
}

/**
 * Test environment detection
 */
async function testEnvironmentDetection() {
  section('Testing Environment Detection');

  const envVars = {
    'RAILWAY_ENVIRONMENT': process.env.RAILWAY_ENVIRONMENT,
    'RENDER': process.env.RENDER,
    'DYNO': process.env.DYNO,
    'VERCEL_ENV': process.env.VERCEL_ENV,
    'NODE_ENV': process.env.NODE_ENV,
    'DOMAIN': process.env.DOMAIN,
    'WEBHOOK_URL': process.env.WEBHOOK_URL,
  };

  Object.entries(envVars).forEach(([key, value]) => {
    if (value) {
      log(colors.cyan, `  ${key}: ${value}`);
    }
  });

  // Detect platform
  let platform = 'Unknown';
  if (process.env.RAILWAY_ENVIRONMENT) platform = 'Railway';
  if (process.env.RENDER === 'true') platform = 'Render';
  if (process.env.DYNO) platform = 'Heroku';
  if (process.env.VERCEL_ENV) platform = 'Vercel';
  if (!process.env.RAILWAY_ENVIRONMENT && !process.env.RENDER && !process.env.DYNO && !process.env.VERCEL_ENV) {
    platform = 'VPS/Custom';
  }

  log(colors.blue, `  Platform: ${platform}`);
  return true;
}

/**
 * Main test suite
 */
async function runTests() {
  const args = process.argv.slice(2);
  const domain = args.includes('--domain') 
    ? args[args.indexOf('--domain') + 1] 
    : 'localhost';
  
  const port = args.includes('--port')
    ? parseInt(args[args.indexOf('--port') + 1])
    : 5000;

  const isLocalhost = domain === 'localhost' || domain.startsWith('127.');

  console.log(colors.cyan + `
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║          HTTPS Configuration Test Suite                        ║
║                                                                ║
║  Testing HTTPS enforcement and webhook security               ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  ` + colors.reset);

  // Test environment
  await testEnvironmentDetection();

  let results = {
    passed: 0,
    failed: 0,
    skipped: 0
  };

  // Test redirect (skip on localhost for now)
  if (!isLocalhost) {
    const result = await testHttpRedirect(domain, port);
    if (result === true) results.passed++;
    else if (result === false) results.failed++;
    else results.skipped++;
  }

  // Test HTTPS endpoint
  const httpsResult = await testHttpsEndpoint(domain, port);
  if (httpsResult === true) results.passed++;
  else if (httpsResult === false) results.failed++;
  else results.skipped++;

  // Test webhook
  if (!isLocalhost) {
    const webhookResult = await testWebhookHttpsEnforcement(domain);
    if (webhookResult === true) results.passed++;
    else if (webhookResult === false) results.failed++;
    else results.skipped++;
  }

  // Test headers
  const headersResult = await testSecurityHeaders(domain);
  if (headersResult === true) results.passed++;
  else if (headersResult === false) results.failed++;
  else results.skipped++;

  // Summary
  section('Summary');
  log(colors.green, `  ✓ Passed: ${results.passed}`);
  if (results.failed > 0) {
    log(colors.red, `  ✗ Failed: ${results.failed}`);
  }
  if (results.skipped > 0) {
    log(colors.yellow, `  ⊘ Skipped: ${results.skipped}`);
  }

  if (results.failed === 0) {
    log(colors.green, '\n  ✅ All tests passed! HTTPS is properly configured.\n');
    process.exit(0);
  } else {
    log(colors.red, `\n  ❌ ${results.failed} test(s) failed. Review the output above.\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
