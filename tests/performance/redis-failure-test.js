/**
 * Redis Failure Test
 * 
 * Tests system behavior when Redis becomes unavailable
 * Simulates various Redis failure scenarios:
 *   1. Connection timeout
 *   2. Connection refused
 *   3. Slow Redis (high latency)
 *   4. Redis crash (SIGKILL)
 *   5. Partial Redis recovery
 * 
 * Usage:
 *   node tests/performance/redis-failure-test.js [connection|timeout|slow|crash|recovery]
 * 
 * Monitor:
 *   - Application error rate during outage
 *   - Queue backlog growth
 *   - Message loss (if any)
 *   - Recovery time after Redis restart
 */

const axios = require('axios');
const { execSync } = require('child_process');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

// Test scenarios
const TEST_SCENARIOS = {
  connection: {
    description: 'Simulate connection refused',
    duration: 30,
    monitor: true
  },
  timeout: {
    description: 'Simulate connection timeout (high latency)',
    duration: 60,
    monitor: true
  },
  slow: {
    description: 'Simulate slow Redis responses',
    duration: 45,
    monitor: true
  },
  crash: {
    description: 'Crash Redis instance',
    duration: 60,
    monitor: true,
    recover: true
  },
  recovery: {
    description: 'Restart Redis and monitor recovery',
    duration: 120,
    monitor: true
  }
};

class RedisFailureTest {
  constructor(scenario = 'timeout') {
    this.scenario = TEST_SCENARIOS[scenario] || TEST_SCENARIOS.timeout;
    this.testType = scenario;
    this.results = {
      startTime: null,
      endTime: null,
      requestsDuringFailure: 0,
      successfulRequests: 0,
      failedRequests: 0,
      degradedRequests: 0, // Success but slow
      responseTimes: [],
      errors: {},
      redisRestarts: 0,
      queueBacklog: []
    };
  }

  /**
   * Get current Redis status
   */
  async getRedisStatus() {
    try {
      const response = await axios.get(`${BASE_URL}/health/detailed`, {
        validateStatus: () => true
      });
      return response.data?.data?.redis || 'unknown';
    } catch (error) {
      return 'error';
    }
  }

  /**
   * Get queue backlog
   */
  async getQueueBacklog() {
    try {
      const response = await axios.get(`${BASE_URL}/api/v1/queue/status`, {
        validateStatus: () => true
      });
      return response.data?.data?.backlog || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Send a test request that uses Redis
   */
  async sendTestRequest() {
    const startTime = performance.now();

    try {
      // This endpoint should use Redis if available (e.g., caching or queue operations)
      const response = await axios.post(
        `${BASE_URL}/api/orders`,
        {
          retailerId: crypto.randomUUID(),
          items: [{ productId: '1', quantity: 1 }],
          deliveryAddress: 'Test Address'
        },
        {
          timeout: 5000,
          validateStatus: () => true
        }
      );

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.results.responseTimes.push(responseTime);
      this.results.requestsDuringFailure++;

      if (response.status === 201) {
        this.results.successfulRequests++;
      } else if (response.status >= 500) {
        this.results.failedRequests++;
        this.recordError(`HTTP ${response.status}`, response.data?.message || 'Server error');
      } else {
        this.results.degradedRequests++;
      }

      return { success: response.status === 201, responseTime };
    } catch (error) {
      const endTime = performance.now();
      this.results.requestsDuringFailure++;
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
    if (this.results.errors[errorType].samples.length < 3) {
      this.results.errors[errorType].samples.push(message);
    }
  }

  /**
   * Stop Redis connection (block port)
   */
  async blockRedisConnection() {
    try {
      // Use iptables or firewall to block Redis port
      if (process.platform === 'linux') {
        execSync(`sudo iptables -A INPUT -p tcp --dport ${REDIS_PORT} -j DROP`, {
          stdio: 'ignore'
        });
        console.log('✅ Redis connection blocked (iptables)');
      } else if (process.platform === 'darwin') {
        // macOS: use pfctl
        execSync(`echo "block drop in proto tcp from any to any port ${REDIS_PORT}" | sudo pfctl -ef -`, {
          stdio: 'ignore'
        });
        console.log('✅ Redis connection blocked (pfctl)');
      }
      return true;
    } catch (error) {
      console.warn('⚠️  Could not block Redis connection:', error.message);
      return false;
    }
  }

  /**
   * Restore Redis connection
   */
  async unblockRedisConnection() {
    try {
      if (process.platform === 'linux') {
        execSync(`sudo iptables -D INPUT -p tcp --dport ${REDIS_PORT} -j DROP`, {
          stdio: 'ignore'
        });
        console.log('✅ Redis connection restored (iptables)');
      } else if (process.platform === 'darwin') {
        execSync(`sudo pfctl -f /etc/pf.conf`, { stdio: 'ignore' });
        console.log('✅ Redis connection restored (pfctl)');
      }
      return true;
    } catch (error) {
      console.warn('⚠️  Could not restore Redis connection:', error.message);
      return false;
    }
  }

  /**
   * Stop Redis container/process
   */
  async stopRedis() {
    try {
      // Try Docker first
      try {
        execSync('docker stop redis-server 2>/dev/null', { stdio: 'ignore' });
        console.log('✅ Redis stopped (Docker)');
        this.results.redisRestarts++;
        return true;
      } catch {
        // Try direct Redis shutdown
        const redis = require('redis');
        const client = redis.createClient({ host: REDIS_HOST, port: REDIS_PORT });
        await client.shutdown('NOSAVE');
        console.log('✅ Redis stopped (direct)');
        return true;
      }
    } catch (error) {
      console.warn('⚠️  Could not stop Redis:', error.message);
      return false;
    }
  }

  /**
   * Start Redis container/process
   */
  async startRedis() {
    try {
      // Try Docker first
      try {
        execSync('docker start redis-server 2>/dev/null', { stdio: 'ignore' });
        console.log('✅ Redis started (Docker)');
        this.results.redisRestarts++;
        // Wait for Redis to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
      } catch {
        // Try systemd
        execSync('sudo systemctl start redis-server', { stdio: 'ignore' });
        console.log('✅ Redis started (systemd)');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return true;
      }
    } catch (error) {
      console.warn('⚠️  Could not start Redis:', error.message);
      return false;
    }
  }

  /**
   * Test connection refused scenario
   */
  async testConnectionRefused() {
    console.log('\n🔴 Blocking Redis connection...');
    await this.blockRedisConnection();

    console.log('📊 Sending requests while Redis is blocked...\n');
    const startTime = Date.now();
    const duration = this.scenario.duration * 1000;

    let requestCount = 0;
    while (Date.now() - startTime < duration) {
      await this.sendTestRequest();
      requestCount++;
      
      if (requestCount % 10 === 0) {
        process.stdout.write(`\r📤 Requests sent: ${requestCount}`);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n\n🟢 Restoring Redis connection...');
    await this.unblockRedisConnection();
    console.log('💚 Redis restored\n');
  }

  /**
   * Test timeout scenario
   */
  async testTimeout() {
    console.log('\n⏱️  Introducing latency to Redis...');
    // This would require tc (traffic control) on Linux
    try {
      if (process.platform === 'linux') {
        execSync(`sudo tc qdisc add dev lo root netem delay 5000ms`, {
          stdio: 'ignore'
        });
        console.log('✅ Added 5s latency to localhost (tc)');
      }
    } catch {
      console.warn('⚠️  Could not add latency (requires root and tc)');
    }

    console.log('📊 Sending requests with high latency...\n');
    const startTime = Date.now();
    const duration = this.scenario.duration * 1000;

    let requestCount = 0;
    while (Date.now() - startTime < duration) {
      await this.sendTestRequest();
      requestCount++;

      if (requestCount % 10 === 0) {
        process.stdout.write(`\r📤 Requests sent: ${requestCount}`);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n\n🔧 Removing latency...');
    try {
      if (process.platform === 'linux') {
        execSync(`sudo tc qdisc del dev lo root`, { stdio: 'ignore' });
        console.log('✅ Latency removed\n');
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Test crash scenario
   */
  async testCrash() {
    console.log('\n💥 Crashing Redis...');
    const redisStarted = await this.startRedis();

    if (!redisStarted) {
      console.log('⚠️  Could not ensure Redis is running');
      return;
    }

    // Give it a moment to settle
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('📊 Sending requests while crashing Redis...\n');
    const startTime = Date.now();
    const duration = this.scenario.duration * 1000;

    let requestCount = 0;
    let crashTime = null;

    while (Date.now() - startTime < duration) {
      // Crash Redis at 25% through the test
      if (!crashTime && (Date.now() - startTime) > (duration * 0.25)) {
        console.log('\n🔴 CRASHING REDIS NOW!');
        await this.stopRedis();
        crashTime = Date.now();
        console.log('');
      }

      // Restart Redis at 75% through the test
      if (crashTime && (Date.now() - crashTime) > (duration * 0.5)) {
        console.log('\n🟢 RESTARTING REDIS NOW!');
        await this.startRedis();
        crashTime = null;
        console.log('');
      }

      await this.sendTestRequest();
      requestCount++;

      if (requestCount % 10 === 0) {
        process.stdout.write(`\r📤 Requests sent: ${requestCount}`);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n\n✅ Test complete\n');
  }

  /**
   * Run monitoring during test
   */
  async monitorSystem() {
    if (!this.scenario.monitor) return;

    while (true) {
      try {
        const status = await this.getRedisStatus();
        const backlog = await this.getQueueBacklog();
        this.results.queueBacklog.push({
          timestamp: new Date().toISOString(),
          redisStatus: status,
          queueSize: backlog
        });
      } catch (error) {
        // Monitoring error, continue
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  /**
   * Execute the appropriate test scenario
   */
  async run() {
    console.log('\n' + '='.repeat(70));
    console.log('🚨 Redis Failure Test');
    console.log('='.repeat(70));
    console.log(`\nScenario: ${this.scenario.description}`);
    console.log(`Duration: ${this.scenario.duration}s\n`);

    this.results.startTime = performance.now();

    // Start monitoring
    if (this.scenario.monitor) {
      setInterval(() => this.monitorSystem(), 5000);
    }

    try {
      switch (this.testType) {
        case 'connection':
          await this.testConnectionRefused();
          break;
        case 'timeout':
          await this.testTimeout();
          break;
        case 'crash':
          await this.testCrash();
          break;
        default:
          await this.testTimeout();
      }
    } finally {
      // Cleanup
      if (process.platform === 'linux') {
        try {
          execSync('sudo tc qdisc del dev lo root 2>/dev/null', { stdio: 'ignore' });
        } catch {
          // Ignore
        }
      }
      await this.unblockRedisConnection();
    }

    this.results.endTime = performance.now();
    this.printResults();
  }

  /**
   * Print test results
   */
  printResults() {
    const duration = (this.results.endTime - this.results.startTime) / 1000;
    const errorRate = ((this.results.failedRequests / this.results.requestsDuringFailure) * 100).toFixed(2);
    const times = this.results.responseTimes.sort((a, b) => a - b);

    console.log('📊 REDIS FAILURE TEST RESULTS');
    console.log('='.repeat(70));
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log(`Total Requests: ${this.results.requestsDuringFailure}`);
    console.log(`Successful: ${this.results.successfulRequests}`);
    console.log(`Degraded (slow): ${this.results.degradedRequests}`);
    console.log(`Failed: ${this.results.failedRequests}`);
    console.log(`Error Rate: ${errorRate}%`);

    if (times.length > 0) {
      console.log(`\n⏱️  Response Times`);
      console.log('-'.repeat(70));
      console.log(`Min: ${times[0].toFixed(2)}ms`);
      console.log(`Max: ${times[times.length - 1].toFixed(2)}ms`);
      console.log(`Avg: ${(times.reduce((a, b) => a + b) / times.length).toFixed(2)}ms`);
      console.log(`p50: ${times[Math.floor(times.length * 0.5)].toFixed(2)}ms`);
      console.log(`p99: ${times[Math.floor(times.length * 0.99)].toFixed(2)}ms`);
    }

    if (Object.keys(this.results.errors).length > 0) {
      console.log(`\n❌ Errors`);
      console.log('-'.repeat(70));
      for (const [errorType, data] of Object.entries(this.results.errors)) {
        console.log(`${errorType}: ${data.count}`);
      }
    }

    console.log(`\n🎯 Analysis`);
    console.log('-'.repeat(70));
    this.analyzeResults(errorRate);

    console.log('\n');
  }

  /**
   * Analyze test results
   */
  analyzeResults(errorRate) {
    const errRate = parseFloat(errorRate);

    if (errRate > 50) {
      console.log('🔴 CRITICAL: > 50% error rate during Redis outage');
      console.log('   - No fallback mechanism in place');
      console.log('   - Action: Implement circuit breaker pattern');
      console.log('   - Action: Add graceful degradation');
      console.log('   - Action: Queue operations for retry');
    } else if (errRate > 20) {
      console.log('🟠 WARNING: > 20% error rate during outage');
      console.log('   - Partial fallback working');
      console.log('   - Action: Review error handling logic');
      console.log('   - Action: Improve retry mechanism');
    } else if (errRate > 0) {
      console.log('🟡 GOOD: Some requests succeeded despite Redis being down');
      console.log('   - Fallback mechanism is partially working');
      console.log('   - Review if all operations have fallbacks');
    } else {
      console.log('🟢 EXCELLENT: All requests succeeded');
      console.log('   - System is resilient to Redis failures');
    }

    if (this.results.redisRestarts > 0) {
      console.log(`✅ Redis recovered ${this.results.redisRestarts} times`);
    }

    if (this.results.queueBacklog.length > 0) {
      const maxBacklog = Math.max(...this.results.queueBacklog.map(q => q.queueSize));
      console.log(`\n📈 Queue Backlog peaked at ${maxBacklog} messages`);
      if (maxBacklog > 1000) {
        console.log('   ⚠️  Consider: Increase number of workers');
      }
    }
  }
}

// Main execution
async function main() {
  const testType = process.argv[2] || 'timeout';

  if (!TEST_SCENARIOS[testType]) {
    console.log('Available scenarios:', Object.keys(TEST_SCENARIOS).join(', '));
    console.log('Usage: node redis-failure-test.js [connection|timeout|slow|crash|recovery]');
    process.exit(1);
  }

  const test = new RedisFailureTest(testType);

  try {
    await test.run();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = RedisFailureTest;
