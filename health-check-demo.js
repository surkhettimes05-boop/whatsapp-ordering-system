#!/usr/bin/env node

/**
 * Health Check Endpoints - Test & Demo Script
 * 
 * Run this to test all health endpoints
 * Usage: node health-check-demo.js
 */

const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Make HTTP request
 */
async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? require('https') : http;

    const req = protocol.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          status: res.statusCode,
          duration,
          data: data ? JSON.parse(data) : null
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(5000);
  });
}

/**
 * Format and display results
 */
function displayResult(endpoint, result) {
  const statusColor = result.status === 200 ? colors.green : colors.red;
  const status = `${statusColor}${result.status}${colors.reset}`;

  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}${endpoint}${colors.reset}`);
  console.log(`Status: ${status} | Duration: ${result.duration}ms`);
  
  if (result.data) {
    console.log(`\n${colors.cyan}Response:${colors.reset}`);
    console.log(JSON.stringify(result.data, null, 2));
  }
}

/**
 * Test all endpoints
 */
async function testAllEndpoints() {
  console.log(`${colors.bright}${colors.cyan}Health Check Endpoints - Test Suite${colors.reset}\n`);
  console.log(`Testing: ${BASE_URL}\n`);

  const endpoints = [
    {
      name: 'Basic Health',
      url: `${BASE_URL}/health`,
      description: 'Quick liveness check'
    },
    {
      name: 'Detailed Health',
      url: `${BASE_URL}/health/detailed`,
      description: 'Full system diagnostics'
    },
    {
      name: 'Health Status (Database + Twilio + Queue)',
      url: `${BASE_URL}/health/status`,
      description: 'Comprehensive service check'
    },
    {
      name: 'Monitoring Status',
      url: `${BASE_URL}/health/monitor`,
      description: 'Simple boolean status'
    },
    {
      name: 'Readiness Probe',
      url: `${BASE_URL}/health/ready`,
      description: 'Kubernetes readiness'
    },
    {
      name: 'Liveness Probe',
      url: `${BASE_URL}/health/live`,
      description: 'Kubernetes liveness'
    }
  ];

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const endpoint of endpoints) {
    try {
      console.log(`${colors.yellow}Testing: ${endpoint.name}...${colors.reset}`);
      const result = await makeRequest(endpoint.url);
      displayResult(endpoint.url, result);
      
      if (result.status === 200 || result.status === 503) {
        passed++;
      } else {
        failed++;
      }
      results.push({ endpoint: endpoint.name, status: result.status, duration: result.duration });
    } catch (error) {
      console.log(`${colors.red}Error: ${error.message}${colors.reset}`);
      failed++;
      results.push({ endpoint: endpoint.name, status: 'ERROR', error: error.message });
    }
  }

  // Summary
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}Summary${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.green}✓ Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}✗ Failed: ${failed}${colors.reset}`);
  console.log(`\n${colors.cyan}Detailed Results:${colors.reset}`);
  
  results.forEach(r => {
    const statusColor = r.status === 200 ? colors.green : r.status === 503 ? colors.yellow : colors.red;
    console.log(`  ${statusColor}${r.endpoint}: ${r.status}${colors.reset}` + 
      (r.duration ? ` (${r.duration}ms)` : '') +
      (r.error ? ` - ${r.error}` : ''));
  });
}

/**
 * Interactive monitoring mode
 */
async function interactiveMonitoring() {
  console.log(`${colors.bright}${colors.cyan}Interactive Health Monitoring${colors.reset}`);
  console.log(`Press Ctrl+C to stop\n`);

  const interval = setInterval(async () => {
    try {
      const result = await makeRequest(`${BASE_URL}/health/monitor`);
      const status = result.data?.status || 'unknown';
      const statusColor = status === 'healthy' ? colors.green : colors.red;
      
      console.log(`${new Date().toLocaleTimeString()} | ${statusColor}${status.toUpperCase()}${colors.reset} | ` +
        `DB: ${result.data?.checks?.database ? '✓' : '✗'} | ` +
        `Twilio: ${result.data?.checks?.twilio ? '✓' : '✗'} | ` +
        `Queue: ${result.data?.checks?.queue ? '✓' : '✗'}`);
    } catch (error) {
      console.log(`${new Date().toLocaleTimeString()} | ${colors.red}ERROR${colors.reset} | ${error.message}`);
    }
  }, 5000);
}

/**
 * Detailed service check
 */
async function detailedCheck() {
  console.log(`${colors.bright}${colors.cyan}Detailed Service Health Check${colors.reset}\n`);

  try {
    const result = await makeRequest(`${BASE_URL}/health/status`);
    const data = result.data;

    console.log(`${colors.bright}Overall Status: ${data.status}${colors.reset}\n`);

    console.log(`${colors.bright}Services:${colors.reset}`);
    Object.entries(data.services || {}).forEach(([service, info]) => {
      const statusColor = info.status === 'connected' || info.status === 'operational' 
        ? colors.green 
        : colors.red;
      console.log(`  ${service}: ${statusColor}${info.status}${colors.reset}` +
        (info.latency ? ` (${info.latency})` : '') +
        (info.error ? ` - ${info.error}` : ''));
    });

    if (data.system) {
      console.log(`\n${colors.bright}System Metrics:${colors.reset}`);
      console.log(`  Memory: ${data.system.memory?.usage || 'N/A'}`);
      console.log(`  CPU Load: ${data.system.cpu?.loadAverage?.[0] || 'N/A'}`);
      console.log(`  Uptime: ${data.system.uptime || 'N/A'}`);
    }

    console.log(`\n${colors.bright}Check Results:${colors.reset}`);
    Object.entries(data.checks || {}).forEach(([check, result]) => {
      const resultColor = result === 'pass' ? colors.green : result === 'skip' ? colors.yellow : colors.red;
      console.log(`  ${check}: ${resultColor}${result}${colors.reset}`);
    });
  } catch (error) {
    console.log(`${colors.red}Error: ${error.message}${colors.reset}`);
  }
}

// Main
async function main() {
  const command = process.argv[2] || 'test';

  switch (command) {
    case 'test':
      await testAllEndpoints();
      break;
    case 'monitor':
      await interactiveMonitoring();
      break;
    case 'detailed':
      await detailedCheck();
      break;
    case 'help':
      console.log(`
${colors.bright}Health Check Endpoints - Test Script${colors.reset}

Usage: node health-check-demo.js [command]

Commands:
  test                 Run all endpoint tests (default)
  monitor              Interactive monitoring (refreshes every 5s)
  detailed             Show detailed service status
  help                 Show this help message

Environment Variables:
  BASE_URL             API base URL (default: http://localhost:3000)

Examples:
  node health-check-demo.js test
  BASE_URL=http://api.example.com node health-check-demo.js monitor
  node health-check-demo.js detailed
      `);
      break;
    default:
      console.log(`${colors.red}Unknown command: ${command}${colors.reset}`);
      console.log(`Run: node health-check-demo.js help`);
  }
}

main().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});
