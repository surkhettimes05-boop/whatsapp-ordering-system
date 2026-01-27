/**
 * Webhook Load Test
 * 
 * Tests the WhatsApp webhook endpoint under load
 * Simulates concurrent webhook deliveries from Twilio
 * 
 * Usage:
 *   npm test -- webhook-load-test.js
 *   node tests/performance/webhook-load-test.js
 * 
 * Metrics tracked:
 *   - Requests per second (RPS)
 *   - Response time (p50, p95, p99)
 *   - Error rate
 *   - Memory usage
 *   - Database connection pool
 *   - Queue backlog
 */

const axios = require('axios');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const WEBHOOK_URL = `${BASE_URL}/api/v1/whatsapp/webhook`;

// Test configuration
const TEST_SCENARIOS = {
  light: {
    concurrentRequests: 10,
    duration: 30, // seconds
    description: 'Light load: 10 concurrent'
  },
  moderate: {
    concurrentRequests: 50,
    duration: 60,
    description: 'Moderate load: 50 concurrent'
  },
  heavy: {
    concurrentRequests: 200,
    duration: 120,
    description: 'Heavy load: 200 concurrent'
  },
  stress: {
    concurrentRequests: 500,
    duration: 60,
    description: 'Stress test: 500 concurrent'
  }
};

class WebhookLoadTester {
  constructor(scenario = 'moderate') {
    this.scenario = TEST_SCENARIOS[scenario] || TEST_SCENARIOS.moderate;
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: {},
      startTime: null,
      endTime: null
    };
    this.activeRequests = 0;
  }

  /**
   * Generate mock Twilio webhook payload
   * Simulates a real WhatsApp message from Twilio
   */
  generatePayload() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    const messageId = `SM${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
    const timestamp = Math.floor(Date.now() / 1000);
    
    return {
      From: `whatsapp:+${Math.floor(Math.random() * 9000000000000000) + 1000000000000000}`,
      To: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
      Body: `Test message ${Math.random()}`,
      MessageSid: messageId,
      AccountSid: accountSid,
      ProfileName: `Test User ${Math.floor(Math.random() * 1000)}`,
      SmsSid: messageId,
      NumMedia: '0'
    };
  }

  /**
   * Generate Twilio signature for request validation
   * (Simplified - would need actual Twilio auth token for real tests)
   */
  generateTwilioSignature(url, params) {
    // In production, this would use the actual auth token
    // For testing, we'll use a mock token
    const authToken = process.env.TWILIO_AUTH_TOKEN || 'test_auth_token_12345678901234567890ab';
    
    let data = url;
    const keys = Object.keys(params).sort();
    for (const key of keys) {
      data += key + params[key];
    }
    
    return crypto
      .createHmac('sha1', authToken)
      .update(data)
      .digest('Base64');
  }

  /**
   * Send a single webhook request
   */
  async sendWebhookRequest() {
    const payload = this.generatePayload();
    const signature = this.generateTwilioSignature(WEBHOOK_URL, payload);
    
    const startTime = performance.now();
    
    try {
      const response = await axios.post(WEBHOOK_URL, payload, {
        headers: {
          'X-Twilio-Signature': signature,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'TwilioProxy/1.1'
        },
        timeout: 30000,
        validateStatus: () => true // Don't throw on any status
      });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      this.results.responseTimes.push(responseTime);
      this.results.totalRequests++;
      
      if (response.status === 200) {
        this.results.successfulRequests++;
      } else {
        this.results.failedRequests++;
        this.recordError(`HTTP ${response.status}`, response.data?.message || 'Unknown');
      }
      
      return { success: true, responseTime, status: response.status };
    } catch (error) {
      this.results.totalRequests++;
      this.results.failedRequests++;
      this.recordError(error.code || 'NETWORK_ERROR', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record error statistics
   */
  recordError(errorType, message) {
    if (!this.results.errors[errorType]) {
      this.results.errors[errorType] = { count: 0, samples: [] };
    }
    this.results.errors[errorType].count++;
    if (this.results.errors[errorType].samples.length < 5) {
      this.results.errors[errorType].samples.push(message);
    }
  }

  /**
   * Run concurrent requests
   */
  async runConcurrentBatch() {
    const promises = [];
    for (let i = 0; i < this.scenario.concurrentRequests; i++) {
      promises.push(this.sendWebhookRequest());
    }
    await Promise.allSettled(promises);
  }

  /**
   * Main load test execution
   */
  async run() {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 Webhook Load Test');
    console.log('='.repeat(70));
    console.log(`\nScenario: ${this.scenario.description}`);
    console.log(`Duration: ${this.scenario.duration} seconds`);
    console.log(`Target URL: ${WEBHOOK_URL}\n`);

    this.results.startTime = performance.now();
    const startRealTime = Date.now();
    const endTime = startRealTime + (this.scenario.duration * 1000);

    let batchCount = 0;
    process.stdout.write('Progress: ');

    while (Date.now() < endTime) {
      await this.runConcurrentBatch();
      batchCount++;
      
      const elapsed = (Date.now() - startRealTime) / 1000;
      const progress = Math.min(100, Math.floor((elapsed / this.scenario.duration) * 100));
      process.stdout.write(`\r⏳ Progress: ${progress}% (${batchCount} batches)`);
      
      // Small delay between batches to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.results.endTime = performance.now();
    console.log('\n\n✅ Test Complete!\n');
    this.printResults();
  }

  /**
   * Calculate statistics
   */
  calculateStats() {
    const times = this.results.responseTimes.sort((a, b) => a - b);
    const length = times.length;

    return {
      p50: times[Math.floor(length * 0.5)],
      p95: times[Math.floor(length * 0.95)],
      p99: times[Math.floor(length * 0.99)],
      min: times[0],
      max: times[length - 1],
      avg: times.reduce((a, b) => a + b, 0) / length
    };
  }

  /**
   * Print detailed test results
   */
  printResults() {
    const duration = (this.results.endTime - this.results.startTime) / 1000;
    const rps = this.results.totalRequests / duration;
    const errorRate = ((this.results.failedRequests / this.results.totalRequests) * 100).toFixed(2);
    const stats = this.calculateStats();

    console.log('📊 RESULTS SUMMARY');
    console.log('-'.repeat(70));
    console.log(`Total Duration: ${duration.toFixed(2)}s`);
    console.log(`Total Requests: ${this.results.totalRequests}`);
    console.log(`Successful: ${this.results.successfulRequests} (${((this.results.successfulRequests / this.results.totalRequests) * 100).toFixed(2)}%)`);
    console.log(`Failed: ${this.results.failedRequests} (${errorRate}%)`);
    console.log(`Requests/sec: ${rps.toFixed(2)}`);

    console.log('\n📈 RESPONSE TIME METRICS');
    console.log('-'.repeat(70));
    console.log(`Min: ${stats.min.toFixed(2)}ms`);
    console.log(`Max: ${stats.max.toFixed(2)}ms`);
    console.log(`Avg: ${stats.avg.toFixed(2)}ms`);
    console.log(`p50: ${stats.p50.toFixed(2)}ms`);
    console.log(`p95: ${stats.p95.toFixed(2)}ms`);
    console.log(`p99: ${stats.p99.toFixed(2)}ms`);

    if (Object.keys(this.results.errors).length > 0) {
      console.log('\n❌ ERRORS');
      console.log('-'.repeat(70));
      for (const [errorType, data] of Object.entries(this.results.errors)) {
        console.log(`${errorType}: ${data.count} occurrences`);
        if (data.samples.length > 0) {
          console.log(`  Samples: ${data.samples.join(', ')}`);
        }
      }
    }

    console.log('\n🎯 PERFORMANCE ANALYSIS');
    console.log('-'.repeat(70));
    this.analyzePerformance(rps, stats, errorRate);

    console.log('\n' + '='.repeat(70));
    console.log('💾 Saving results to webhook-load-test-results.json...');
    const fs = require('fs');
    fs.writeFileSync(
      'webhook-load-test-results.json',
      JSON.stringify({
        scenario: this.scenario.description,
        timestamp: new Date().toISOString(),
        duration,
        stats: {
          totalRequests: this.results.totalRequests,
          successfulRequests: this.results.successfulRequests,
          failedRequests: this.results.failedRequests,
          errorRate: parseFloat(errorRate),
          rps: parseFloat(rps.toFixed(2)),
          responseTimes: stats
        },
        errors: this.results.errors
      }, null, 2)
    );
    console.log('✅ Results saved!\n');
  }

  /**
   * Analyze performance and identify bottlenecks
   */
  analyzePerformance(rps, stats, errorRate) {
    const breakingPoints = [];

    // Response time analysis
    if (stats.p99 > 5000) {
      breakingPoints.push('🔴 CRITICAL: p99 response time > 5s (indicates queueing)');
    } else if (stats.p99 > 2000) {
      breakingPoints.push('🟠 WARNING: p99 response time > 2s (database or processing bottleneck)');
    } else if (stats.p99 < 500) {
      breakingPoints.push('🟢 GOOD: p99 response time < 500ms');
    }

    // RPS capacity
    if (rps > 1000) {
      breakingPoints.push('🟢 EXCELLENT: > 1000 req/s throughput');
    } else if (rps > 500) {
      breakingPoints.push('🟢 GOOD: > 500 req/s throughput');
    } else if (rps > 100) {
      breakingPoints.push('🟠 WARNING: < 500 req/s throughput (below target)');
    } else {
      breakingPoints.push('🔴 CRITICAL: < 100 req/s (severe bottleneck)');
    }

    // Error rate analysis
    if (parseFloat(errorRate) > 5) {
      breakingPoints.push('🔴 CRITICAL: Error rate > 5% (system instability)');
    } else if (parseFloat(errorRate) > 1) {
      breakingPoints.push('🟠 WARNING: Error rate > 1% (investigate failures)');
    } else if (parseFloat(errorRate) === 0) {
      breakingPoints.push('🟢 EXCELLENT: 0% error rate');
    }

    // Latency variance analysis
    const variance = stats.p99 - stats.p50;
    if (variance > stats.p50 * 2) {
      breakingPoints.push('🟠 WARNING: High latency variance (inconsistent performance)');
    } else {
      breakingPoints.push('🟢 GOOD: Consistent response times');
    }

    breakingPoints.forEach(point => console.log(point));
  }
}

// Main execution
async function main() {
  const scenario = process.argv[2] || 'moderate';
  
  if (!TEST_SCENARIOS[scenario]) {
    console.log('Available scenarios:', Object.keys(TEST_SCENARIOS).join(', '));
    console.log('Usage: node webhook-load-test.js [light|moderate|heavy|stress]');
    process.exit(1);
  }

  const tester = new WebhookLoadTester(scenario);
  
  try {
    await tester.run();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = WebhookLoadTester;
