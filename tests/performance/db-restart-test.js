/**
 * Database Restart Test
 * 
 * Tests system behavior during PostgreSQL restart
 * Simulates various database failure scenarios:
 *   1. Graceful restart (connection pool recovery)
 *   2. Abrupt crash (connection timeout)
 *   3. Connection pool exhaustion
 *   4. Long transaction impact
 *   5. Cascading failure recovery
 * 
 * Usage:
 *   node tests/performance/db-restart-test.js [graceful|crash|pool|slow|cascade]
 * 
 * Monitor:
 *   - Connection pool status
 *   - Query failure rate
 *   - Recovery time
 *   - Transaction rollback behavior
 */

const axios = require('axios');
const { execSync } = require('child_process');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

// Test scenarios
const TEST_SCENARIOS = {
  graceful: {
    description: 'Graceful database restart',
    duration: 60,
    method: 'systemctl',
    aggressive: false
  },
  crash: {
    description: 'Abrupt database crash (SIGKILL)',
    duration: 60,
    method: 'kill',
    aggressive: true
  },
  pool: {
    description: 'Connection pool exhaustion',
    duration: 45,
    method: 'pool',
    aggressive: false
  },
  slow: {
    description: 'Slow queries blocking connections',
    duration: 60,
    method: 'slow',
    aggressive: false
  },
  cascade: {
    description: 'Cascading failures and recovery',
    duration: 120,
    method: 'cascade',
    aggressive: true
  }
};

class DatabaseRestartTest {
  constructor(scenario = 'graceful') {
    this.scenario = TEST_SCENARIOS[scenario] || TEST_SCENARIOS.graceful;
    this.testType = scenario;
    this.results = {
      startTime: null,
      endTime: null,
      requestsBeforeFailure: 0,
      requestsDuringFailure: 0,
      requestsAfterRecovery: 0,
      successBeforeFailure: 0,
      successDuringFailure: 0,
      successAfterRecovery: 0,
      failureDetectedAt: null,
      recoveryCompletedAt: null,
      dbRestarts: 0,
      longestRecoveryTime: 0,
      connectionPoolStatus: [],
      transactionRollbacks: 0,
      errors: {}
    };
  }

  /**
   * Get database health status
   */
  async getDbStatus() {
    try {
      const response = await axios.get(`${BASE_URL}/health/detailed`, {
        timeout: 2000,
        validateStatus: () => true
      });
      return {
        status: response.data?.data?.database?.status || 'unknown',
        connections: response.data?.data?.database?.connections || 0,
        connected: response.status === 200
      };
    } catch (error) {
      return { status: 'error', connected: false, error: error.message };
    }
  }

  /**
   * Send a database query via API
   */
  async sendDbQuery() {
    const startTime = performance.now();

    try {
      // This endpoint should query the database
      const response = await axios.get(`${BASE_URL}/api/v1/products?limit=5`, {
        timeout: 3000,
        validateStatus: () => true
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      return {
        success: response.status === 200,
        responseTime,
        status: response.status,
        error: response.status >= 500 ? response.data?.message : null
      };
    } catch (error) {
      const endTime = performance.now();
      return {
        success: false,
        responseTime: endTime - startTime,
        status: 0,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Send write operation to test transactions
   */
  async sendWriteQuery() {
    const startTime = performance.now();

    try {
      const response = await axios.post(
        `${BASE_URL}/api/orders`,
        {
          retailerId: crypto.randomUUID(),
          items: [{ productId: '1', quantity: 1 }],
          deliveryAddress: 'Test Address'
        },
        {
          timeout: 3000,
          validateStatus: () => true
        }
      );

      const endTime = performance.now();

      return {
        success: response.status === 201,
        responseTime: endTime - startTime,
        status: response.status,
        transactionId: response.data?.data?.id
      };
    } catch (error) {
      const endTime = performance.now();
      return {
        success: false,
        responseTime: endTime - startTime,
        status: 0,
        error: error.message
      };
    }
  }

  /**
   * Stop database (gracefully)
   */
  async stopDatabaseGracefully() {
    try {
      if (process.platform === 'linux') {
        // Try Docker first
        try {
          execSync('docker stop postgres-db 2>/dev/null', { stdio: 'ignore' });
          console.log('✅ PostgreSQL stopped (Docker - graceful)');
          return true;
        } catch {
          // Try systemctl
          execSync('sudo systemctl stop postgresql', { stdio: 'ignore' });
          console.log('✅ PostgreSQL stopped (systemctl - graceful)');
          return true;
        }
      }
      return false;
    } catch (error) {
      console.warn('⚠️  Could not stop database:', error.message);
      return false;
    }
  }

  /**
   * Kill database process
   */
  async killDatabase() {
    try {
      if (process.platform === 'linux') {
        try {
          execSync('docker kill postgres-db 2>/dev/null', { stdio: 'ignore' });
          console.log('💥 PostgreSQL killed (Docker)');
          return true;
        } catch {
          // Try direct kill
          execSync('sudo pkill -9 postgres', { stdio: 'ignore' });
          console.log('💥 PostgreSQL killed (SIGKILL)');
          return true;
        }
      }
      return false;
    } catch (error) {
      console.warn('⚠️  Could not kill database:', error.message);
      return false;
    }
  }

  /**
   * Start database
   */
  async startDatabase() {
    try {
      if (process.platform === 'linux') {
        // Give it a moment
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Try Docker first
        try {
          execSync('docker start postgres-db 2>/dev/null', { stdio: 'ignore' });
          console.log('🟢 PostgreSQL started (Docker)');
          this.results.dbRestarts++;
        } catch {
          // Try systemctl
          execSync('sudo systemctl start postgresql', { stdio: 'ignore' });
          console.log('🟢 PostgreSQL started (systemctl)');
          this.results.dbRestarts++;
        }

        // Wait for database to be ready
        const startWait = Date.now();
        let ready = false;
        while (!ready && (Date.now() - startWait) < 30000) {
          const status = await this.getDbStatus();
          if (status.connected) {
            ready = true;
            this.results.recoveryCompletedAt = Date.now();
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (ready) {
          const recoveryTime = Date.now() - startWait;
          this.results.longestRecoveryTime = Math.max(
            this.results.longestRecoveryTime,
            recoveryTime
          );
          console.log(`⏱️  Recovery took ${recoveryTime}ms`);
        } else {
          console.warn('⚠️  Database did not recover within timeout');
        }

        return ready;
      }
      return false;
    } catch (error) {
      console.warn('⚠️  Could not start database:', error.message);
      return false;
    }
  }

  /**
   * Test graceful restart
   */
  async testGracefulRestart() {
    console.log('\n📊 Sending queries before shutdown...\n');
    
    const preFailureTime = Date.now();
    const preDuration = 10000; // 10 seconds

    while (Date.now() - preFailureTime < preDuration) {
      const result = await this.sendDbQuery();
      if (result.success) {
        this.results.requestsBeforeFailure++;
        this.results.successBeforeFailure++;
      } else {
        this.results.requestsBeforeFailure++;
      }
      process.stdout.write(`\r✅ Pre-failure queries: ${this.results.requestsBeforeFailure}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n\n🛑 Initiating graceful database restart...');
    const shutdownStart = Date.now();
    await this.stopDatabaseGracefully();
    this.results.failureDetectedAt = Date.now();

    console.log('📊 Sending queries during shutdown...\n');
    let failureDuration = Date.now() - shutdownStart;
    
    while (failureDuration < 20000) { // 20 seconds
      const result = await this.sendDbQuery();
      this.results.requestsDuringFailure++;
      if (result.success) {
        this.results.successDuringFailure++;
      } else {
        this.recordError(result.code || 'DB_ERROR', result.error);
      }

      process.stdout.write(`\r❌ During-failure queries: ${this.results.requestsDuringFailure}`);
      failureDuration = Date.now() - shutdownStart;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n\n🟢 Starting database...');
    const recovered = await this.startDatabase();

    if (recovered) {
      console.log('📊 Sending queries after recovery...\n');
      
      const recoveryStart = Date.now();
      const recoveryDuration = 10000; // 10 seconds

      while (Date.now() - recoveryStart < recoveryDuration) {
        const result = await this.sendDbQuery();
        this.results.requestsAfterRecovery++;
        if (result.success) {
          this.results.successAfterRecovery++;
        }
        process.stdout.write(`\r✅ Post-recovery queries: ${this.results.requestsAfterRecovery}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('\n');
  }

  /**
   * Test abrupt crash
   */
  async testAbruptCrash() {
    console.log('\n📊 Sending queries before crash...\n');
    
    const preFailureTime = Date.now();
    const preDuration = 10000; // 10 seconds

    while (Date.now() - preFailureTime < preDuration) {
      const result = await this.sendDbQuery();
      if (result.success) {
        this.results.requestsBeforeFailure++;
        this.results.successBeforeFailure++;
      } else {
        this.results.requestsBeforeFailure++;
      }
      process.stdout.write(`\r✅ Pre-crash queries: ${this.results.requestsBeforeFailure}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n\n💥 CRASHING DATABASE (SIGKILL)...');
    const crashStart = Date.now();
    await this.killDatabase();
    this.results.failureDetectedAt = Date.now();

    console.log('📊 Sending queries during crash...\n');
    let crashDuration = Date.now() - crashStart;
    
    while (crashDuration < 15000) { // 15 seconds
      const result = await this.sendDbQuery();
      this.results.requestsDuringFailure++;
      if (result.success) {
        this.results.successDuringFailure++;
      } else {
        this.recordError(result.code || 'CONNECTION_ERROR', result.error);
      }

      process.stdout.write(`\r❌ During-crash queries: ${this.results.requestsDuringFailure}`);
      crashDuration = Date.now() - crashStart;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n\n🟢 Recovering database...');
    const recovered = await this.startDatabase();

    if (recovered) {
      console.log('📊 Sending queries after recovery...\n');
      
      const recoveryStart = Date.now();
      const recoveryDuration = 10000; // 10 seconds

      while (Date.now() - recoveryStart < recoveryDuration) {
        const result = await this.sendDbQuery();
        this.results.requestsAfterRecovery++;
        if (result.success) {
          this.results.successAfterRecovery++;
        }
        process.stdout.write(`\r✅ Post-recovery queries: ${this.results.requestsAfterRecovery}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('\n');
  }

  /**
   * Record errors
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
   * Run the test
   */
  async run() {
    console.log('\n' + '='.repeat(70));
    console.log('🔄 Database Restart Test');
    console.log('='.repeat(70));
    console.log(`\nScenario: ${this.scenario.description}\n`);

    this.results.startTime = performance.now();

    try {
      switch (this.testType) {
        case 'graceful':
          await this.testGracefulRestart();
          break;
        case 'crash':
          await this.testAbruptCrash();
          break;
        case 'pool':
        case 'slow':
        case 'cascade':
          // Simplified versions for MVP
          console.log('⚠️  Scenario not fully implemented yet');
          console.log('   For full testing, run: graceful or crash');
          break;
        default:
          await this.testGracefulRestart();
      }
    } finally {
      // Ensure database is running
      const status = await this.getDbStatus();
      if (!status.connected) {
        console.log('\n⚠️  Database is offline - attempting restart...');
        await this.startDatabase();
      }
    }

    this.results.endTime = performance.now();
    this.printResults();
  }

  /**
   * Print results
   */
  printResults() {
    const duration = (this.results.endTime - this.results.startTime) / 1000;
    
    const successRateBefore = (this.results.successBeforeFailure / this.results.requestsBeforeFailure * 100).toFixed(2);
    const successRateDuring = (this.results.successDuringFailure / this.results.requestsDuringFailure * 100).toFixed(2);
    const successRateAfter = (this.results.successAfterRecovery / this.results.requestsAfterRecovery * 100).toFixed(2);

    console.log('\n📊 DATABASE RESTART TEST RESULTS');
    console.log('='.repeat(70));
    console.log(`Total Duration: ${duration.toFixed(2)}s`);
    console.log(`Database Restarts: ${this.results.dbRestarts}`);
    console.log(`Max Recovery Time: ${this.results.longestRecoveryTime}ms`);

    console.log('\n📈 Query Success Rates');
    console.log('-'.repeat(70));
    console.log(`Before Failure: ${this.results.successBeforeFailure}/${this.results.requestsBeforeFailure} (${successRateBefore}%)`);
    console.log(`During Failure: ${this.results.successDuringFailure}/${this.results.requestsDuringFailure} (${successRateDuring}%)`);
    console.log(`After Recovery: ${this.results.successAfterRecovery}/${this.results.requestsAfterRecovery} (${successRateAfter}%)`);

    if (Object.keys(this.results.errors).length > 0) {
      console.log('\n❌ Errors Encountered');
      console.log('-'.repeat(70));
      for (const [errorType, data] of Object.entries(this.results.errors)) {
        console.log(`${errorType}: ${data.count} occurrences`);
      }
    }

    console.log('\n🎯 Analysis');
    console.log('-'.repeat(70));
    this.analyzeResults(successRateBefore, successRateDuring, successRateAfter);

    // Save results
    const fs = require('fs');
    fs.writeFileSync(
      'db-restart-test-results.json',
      JSON.stringify({
        scenario: this.scenario.description,
        timestamp: new Date().toISOString(),
        duration: parseFloat(duration.toFixed(2)),
        stats: {
          dbRestarts: this.results.dbRestarts,
          maxRecoveryTime: this.results.longestRecoveryTime,
          beforeFailure: {
            total: this.results.requestsBeforeFailure,
            success: this.results.successBeforeFailure,
            successRate: parseFloat(successRateBefore)
          },
          duringFailure: {
            total: this.results.requestsDuringFailure,
            success: this.results.successDuringFailure,
            successRate: parseFloat(successRateDuring)
          },
          afterRecovery: {
            total: this.results.requestsAfterRecovery,
            success: this.results.successAfterRecovery,
            successRate: parseFloat(successRateAfter)
          }
        }
      }, null, 2)
    );
    console.log('\n💾 Results saved to db-restart-test-results.json');
    console.log('\n');
  }

  /**
   * Analyze results
   */
  analyzeResults(rateBefore, rateDuring, rateAfter) {
    const rateDuringNum = parseFloat(rateDuring);

    if (rateDuringNum === 0) {
      console.log('🔴 CRITICAL: Complete database unavailability detected');
      console.log('   - No requests succeeded during outage');
      console.log('   - Action: Implement database failover mechanism');
      console.log('   - Action: Add connection pooling with fallback');
    } else if (rateDuringNum < 10) {
      console.log('🟠 WARNING: < 10% success rate during outage');
      console.log('   - Minimal resilience during database unavailability');
      console.log('   - Action: Review error handling and retry logic');
    } else {
      console.log('🟡 GOOD: Some requests succeeded during outage');
      console.log('   - Possible cached responses or fallback mechanisms');
    }

    const rateAfterNum = parseFloat(rateAfter);
    if (rateAfterNum > 95) {
      console.log('\n🟢 EXCELLENT: Full recovery after restart');
      console.log('   - Application recovered successfully');
    } else {
      console.log('\n🟠 WARNING: Incomplete recovery after restart');
      console.log('   - Action: Check for connection pool stuck connections');
      console.log('   - Action: Review transaction log for uncommitted transactions');
    }

    if (this.results.longestRecoveryTime > 30000) {
      console.log('\n🔴 CRITICAL: Recovery took > 30 seconds');
      console.log('   - Long recovery window may impact SLA');
      console.log('   - Action: Implement faster failover mechanism');
    } else if (this.results.longestRecoveryTime > 10000) {
      console.log('\n🟠 WARNING: Recovery took > 10 seconds');
      console.log('   - Consider optimizing connection pool recovery');
    } else {
      console.log('\n🟢 GOOD: Fast recovery (< 10 seconds)');
    }
  }
}

// Main execution
async function main() {
  const testType = process.argv[2] || 'graceful';

  if (!TEST_SCENARIOS[testType]) {
    console.log('Available scenarios:', Object.keys(TEST_SCENARIOS).join(', '));
    console.log('Usage: node db-restart-test.js [graceful|crash|pool|slow|cascade]');
    process.exit(1);
  }

  const test = new DatabaseRestartTest(testType);

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

module.exports = DatabaseRestartTest;
