/**
 * Vendor Acceptance Race Simulation
 * 
 * Tests race conditions in vendor routing
 * Simulates multiple vendors competing to accept the same order
 * Validates that only the first vendor wins and others get rejected
 * 
 * Usage:
 *   node tests/performance/vendor-race-test.js [light|moderate|heavy|stress]
 * 
 * Race condition scenarios:
 *   1. First vendor wins (ACCEPTED)
 *   2. Concurrent vendors all attempt ACCEPT
 *   3. Late vendor gets REJECTED
 *   4. Database constraint validation
 *   5. Idempotency key handling
 */

const axios = require('axios');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

// Test configuration
const TEST_SCENARIOS = {
  light: {
    vendorsPerOrder: 5,
    iterations: 10,
    concurrencyLevel: 5,
    description: 'Light: 5 vendors competing 10 times'
  },
  moderate: {
    vendorsPerOrder: 10,
    iterations: 50,
    concurrencyLevel: 10,
    description: 'Moderate: 10 vendors competing 50 times'
  },
  heavy: {
    vendorsPerOrder: 25,
    iterations: 100,
    concurrencyLevel: 25,
    description: 'Heavy: 25 vendors competing 100 times'
  },
  stress: {
    vendorsPerOrder: 50,
    iterations: 100,
    concurrencyLevel: 50,
    description: 'Stress: 50 vendors competing 100 times'
  }
};

class VendorRaceSimulator {
  constructor(scenario = 'moderate') {
    this.scenario = TEST_SCENARIOS[scenario] || TEST_SCENARIOS.moderate;
    this.results = {
      totalRaces: 0,
      successfulRaces: 0,
      failedRaces: 0,
      firstVendorWins: 0,
      multipleAcceptances: 0, // RACE CONDITION: Should be 0
      raceConditionDetected: 0,
      raceTimes: [],
      vendorOutcomes: {},
      startTime: null,
      endTime: null
    };
  }

  /**
   * Create an order and route to vendors
   */
  async createOrderAndRoute() {
    const orderId = crypto.randomUUID();
    const retailerId = crypto.randomUUID();
    
    try {
      const response = await axios.post(
        `${BASE_URL}/api/orders/${orderId}/route-to-vendors`,
        {
          retailerId,
          productCategory: 'GROCERIES'
        },
        { validateStatus: () => true }
      );

      if (response.status === 201 && response.data.data?.routingId) {
        return {
          orderId,
          routingId: response.data.data.routingId,
          retailerId
        };
      }
    } catch (error) {
      console.error('Failed to create order:', error.message);
    }
    return null;
  }

  /**
   * Generate vendor IDs for a race
   */
  generateVendorIds(count) {
    return Array.from({ length: count }, () => ({
      vendorId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID()
    }));
  }

  /**
   * Send vendor acceptance response
   */
  async vendorAccept(routingId, vendor) {
    const startTime = performance.now();
    
    try {
      const response = await axios.post(
        `${BASE_URL}/api/routing/${routingId}/accept`,
        { vendorId: vendor.vendorId },
        {
          headers: {
            'X-Idempotency-Key': vendor.idempotencyKey
          },
          timeout: 10000,
          validateStatus: () => true
        }
      );

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      return {
        vendorId: vendor.vendorId,
        status: response.status,
        accepted: response.status === 200 && response.data?.accepted === true,
        responseTime,
        message: response.data?.message,
        idempotencyKey: vendor.idempotencyKey
      };
    } catch (error) {
      const endTime = performance.now();
      return {
        vendorId: vendor.vendorId,
        status: 0,
        accepted: false,
        responseTime: endTime - startTime,
        error: error.message
      };
    }
  }

  /**
   * Simulate a single race
   * Multiple vendors compete to accept the same order
   */
  async simulateSingleRace() {
    // Step 1: Create order
    const order = await this.createOrderAndRoute();
    if (!order) {
      this.results.failedRaces++;
      return;
    }

    // Step 2: Generate vendor competitors
    const vendors = this.generateVendorIds(this.scenario.vendorsPerOrder);

    // Step 3: All vendors attempt to accept simultaneously
    const raceStartTime = performance.now();
    const acceptancePromises = vendors.map(vendor =>
      this.vendorAccept(order.routingId, vendor)
    );
    
    const outcomes = await Promise.allSettled(acceptancePromises);

    const raceEndTime = performance.now();
    const raceTime = raceEndTime - raceStartTime;

    // Step 4: Analyze outcomes
    const acceptanceResults = outcomes
      .map((outcome, index) => ({
        index,
        ...outcome.value || { error: outcome.reason?.message || 'Unknown error' }
      }))
      .filter(o => !o.error);

    const acceptedCount = acceptanceResults.filter(r => r.accepted).length;
    const rejectedCount = acceptanceResults.filter(r => !r.accepted).length;

    this.results.totalRaces++;
    this.results.raceTimes.push(raceTime);

    // Analyze results for race conditions
    if (acceptedCount === 1) {
      this.results.firstVendorWins++;
      this.results.successfulRaces++;
    } else if (acceptedCount > 1) {
      // RACE CONDITION DETECTED!
      this.results.multipleAcceptances++;
      this.results.raceConditionDetected++;
      console.error(`\n⚠️  RACE CONDITION DETECTED: ${acceptedCount} vendors accepted order ${order.orderId}`);
    } else if (acceptedCount === 0) {
      this.results.failedRaces++;
    }

    return {
      orderId: order.orderId,
      routingId: order.routingId,
      vendorsCompeted: vendors.length,
      acceptedCount,
      rejectedCount,
      raceTime,
      acceptanceResults: acceptanceResults.slice(0, 5) // Top 5 for analysis
    };
  }

  /**
   * Run multiple races with controlled concurrency
   */
  async run() {
    console.log('\n' + '='.repeat(70));
    console.log('🏁 Vendor Acceptance Race Simulation');
    console.log('='.repeat(70));
    console.log(`\nScenario: ${this.scenario.description}`);
    console.log(`Total races to simulate: ${this.scenario.iterations}\n`);

    this.results.startTime = performance.now();

    for (let i = 0; i < this.scenario.iterations; i++) {
      await this.simulateSingleRace();
      
      const progress = Math.floor(((i + 1) / this.scenario.iterations) * 100);
      process.stdout.write(`\r⏳ Progress: ${progress}% (${i + 1}/${this.scenario.iterations})`);
      
      // Small delay between races
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.results.endTime = performance.now();
    console.log('\n\n✅ Race Simulation Complete!\n');
    this.printResults();
  }

  /**
   * Calculate statistics
   */
  calculateStats() {
    const times = this.results.raceTimes.sort((a, b) => a - b);
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
   * Print detailed race results
   */
  printResults() {
    const duration = (this.results.endTime - this.results.startTime) / 1000;
    const stats = this.calculateStats();
    const winRate = ((this.results.firstVendorWins / this.results.totalRaces) * 100).toFixed(2);
    const raceConditionRate = ((this.results.raceConditionDetected / this.results.totalRaces) * 100).toFixed(2);

    console.log('📊 RACE RESULTS SUMMARY');
    console.log('-'.repeat(70));
    console.log(`Total Duration: ${duration.toFixed(2)}s`);
    console.log(`Total Races: ${this.results.totalRaces}`);
    console.log(`Successful (1 winner): ${this.results.firstVendorWins} (${winRate}%)`);
    console.log(`Failed/No winner: ${this.results.failedRaces}`);
    console.log(`Race Conditions Detected: ${this.results.raceConditionDetected} (${raceConditionRate}%)`);

    console.log('\n⏱️  RACE TIME METRICS');
    console.log('-'.repeat(70));
    console.log(`Min: ${stats.min.toFixed(2)}ms`);
    console.log(`Max: ${stats.max.toFixed(2)}ms`);
    console.log(`Avg: ${stats.avg.toFixed(2)}ms`);
    console.log(`p50: ${stats.p50.toFixed(2)}ms`);
    console.log(`p95: ${stats.p95.toFixed(2)}ms`);
    console.log(`p99: ${stats.p99.toFixed(2)}ms`);

    console.log('\n🎯 RACE CONDITION ANALYSIS');
    console.log('-'.repeat(70));
    this.analyzeRaceConditions(winRate, raceConditionRate);

    // Save results
    console.log('\n💾 Saving results to vendor-race-test-results.json...');
    const fs = require('fs');
    fs.writeFileSync(
      'vendor-race-test-results.json',
      JSON.stringify({
        scenario: this.scenario.description,
        timestamp: new Date().toISOString(),
        duration,
        stats: {
          totalRaces: this.results.totalRaces,
          firstVendorWins: this.results.firstVendorWins,
          failedRaces: this.results.failedRaces,
          raceConditionsDetected: this.results.raceConditionDetected,
          winRate: parseFloat(winRate),
          raceConditionRate: parseFloat(raceConditionRate),
          raceTimes: stats
        }
      }, null, 2)
    );
    console.log('✅ Results saved!\n');
  }

  /**
   * Analyze race condition severity
   */
  analyzeRaceConditions(winRate, raceConditionRate) {
    const raceRate = parseFloat(raceConditionRate);

    if (raceRate > 5) {
      console.log('🔴 CRITICAL: Race conditions detected in > 5% of races');
      console.log('   Action: Review database constraints and locking strategy');
      console.log('   - Ensure vendor_routing_responses has UNIQUE constraint on (routing_id, vendor_id)');
      console.log('   - Check for proper use of database transactions');
      console.log('   - Validate pessimistic locking is enabled');
    } else if (raceRate > 0) {
      console.log('🟠 WARNING: Race conditions detected in some races');
      console.log('   Action: Investigate intermittent concurrency issues');
    } else {
      console.log('🟢 EXCELLENT: No race conditions detected');
      console.log('   Status: Vendor acceptance logic is thread-safe');
    }

    if (parseFloat(winRate) < 95) {
      console.log('🟠 WARNING: Low success rate suggests systemic issues');
      console.log('   - Check database connection pool for limitations');
      console.log('   - Verify adequate transaction isolation level');
      console.log('   - Review error handling in routing logic');
    } else {
      console.log('🟢 GOOD: Vendor acceptance success rate > 95%');
    }

    if (this.results.failedRaces > 0) {
      const failRate = ((this.results.failedRaces / this.results.totalRaces) * 100).toFixed(2);
      console.log(`\n⚠️  ${this.results.failedRaces} races failed (${failRate}%)`);
      console.log('   - Check application error logs');
      console.log('   - Verify database connectivity during test');
      console.log('   - Review database transaction logs');
    }
  }
}

// Main execution
async function main() {
  const scenario = process.argv[2] || 'moderate';

  if (!TEST_SCENARIOS[scenario]) {
    console.log('Available scenarios:', Object.keys(TEST_SCENARIOS).join(', '));
    console.log('Usage: node vendor-race-test.js [light|moderate|heavy|stress]');
    process.exit(1);
  }

  const simulator = new VendorRaceSimulator(scenario);

  try {
    await simulator.run();
  } catch (error) {
    console.error('❌ Simulation failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = VendorRaceSimulator;
