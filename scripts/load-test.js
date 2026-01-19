/**
 * Load Testing Script for Fintech Platform
 * 
 * Simulates realistic high-load scenarios:
 * - 50 retailers creating orders
 * - 20 vendors submitting bids
 * - 100 concurrent orders
 * - Credit checks, winner selection, payments
 * 
 * Run: node scripts/load-test.js
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const RETAILERS = 50;
const VENDORS = 20;
const CONCURRENT_ORDERS = 100;

// Test results
const results = {
    startTime: null,
    endTime: null,
    duration: 0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    errors: [],
    latencies: [],
    orderCreation: { success: 0, failed: 0, avgLatency: 0 },
    bidSubmission: { success: 0, failed: 0, avgLatency: 0 },
    winnerSelection: { success: 0, failed: 0, avgLatency: 0 },
    creditChecks: { success: 0, failed: 0, avgLatency: 0 }
};

/**
 * Make HTTP request and track metrics
 */
async function makeRequest(method, url, data = null, headers = {}) {
    const startTime = performance.now();
    results.totalRequests++;

    try {
        const response = await axios({
            method,
            url: `${BASE_URL}${url}`,
            data,
            headers,
            timeout: 10000
        });

        const latency = performance.now() - startTime;
        results.latencies.push(latency);
        results.successfulRequests++;

        return { success: true, data: response.data, latency };
    } catch (error) {
        const latency = performance.now() - startTime;
        results.latencies.push(latency);
        results.failedRequests++;
        results.errors.push({
            url,
            method,
            error: error.message,
            status: error.response?.status
        });

        return { success: false, error: error.message, latency };
    }
}

/**
 * Create test retailers
 */
async function createRetailers() {
    console.log(`\n📊 Creating ${RETAILERS} test retailers...`);
    const retailers = [];

    for (let i = 1; i <= RETAILERS; i++) {
        const result = await makeRequest('POST', '/api/v1/retailers', {
            pasalName: `Load Test Shop ${i}`,
            phoneNumber: `9800${i.toString().padStart(6, '0')}`,
            status: 'ACTIVE'
        });

        if (result.success) {
            retailers.push(result.data.data);
        }

        if (i % 10 === 0) {
            console.log(`   Created ${i}/${RETAILERS} retailers`);
        }
    }

    console.log(`✅ Created ${retailers.length} retailers`);
    return retailers;
}

/**
 * Create test vendors
 */
async function createVendors() {
    console.log(`\n📊 Creating ${VENDORS} test vendors...`);
    const vendors = [];

    for (let i = 1; i <= VENDORS; i++) {
        const result = await makeRequest('POST', '/api/v1/wholesalers', {
            businessName: `Load Test Vendor ${i}`,
            whatsappNumber: `9770000${i.toString().padStart(3, '0')}`,
            status: 'APPROVED',
            isVerified: true,
            reliabilityScore: 50 + Math.random() * 50
        });

        if (result.success) {
            vendors.push(result.data.data);
        }
    }

    console.log(`✅ Created ${vendors.length} vendors`);
    return vendors;
}

/**
 * Create concurrent orders
 */
async function createConcurrentOrders(retailers, products) {
    console.log(`\n🚀 Creating ${CONCURRENT_ORDERS} concurrent orders...`);
    const orderPromises = [];

    for (let i = 0; i < CONCURRENT_ORDERS; i++) {
        const retailer = retailers[Math.floor(Math.random() * retailers.length)];
        const product = products[Math.floor(Math.random() * products.length)];
        const quantity = Math.floor(Math.random() * 50) + 10;

        const promise = (async () => {
            const result = await makeRequest('POST', '/api/v1/orders', {
                retailerId: retailer.id,
                items: [{
                    productId: product.id,
                    quantity
                }],
                paymentMode: 'COD'
            });

            if (result.success) {
                results.orderCreation.success++;
                results.orderCreation.avgLatency += result.latency;
                return result.data.data;
            } else {
                results.orderCreation.failed++;
                return null;
            }
        })();

        orderPromises.push(promise);

        // Stagger requests slightly to simulate realistic load
        if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    const orders = (await Promise.all(orderPromises)).filter(o => o !== null);

    if (results.orderCreation.success > 0) {
        results.orderCreation.avgLatency /= results.orderCreation.success;
    }

    console.log(`✅ Created ${orders.length}/${CONCURRENT_ORDERS} orders`);
    console.log(`   Success: ${results.orderCreation.success}, Failed: ${results.orderCreation.failed}`);
    console.log(`   Avg Latency: ${results.orderCreation.avgLatency.toFixed(2)}ms`);

    return orders;
}

/**
 * Submit concurrent bids
 */
async function submitConcurrentBids(orders, vendors) {
    console.log(`\n💰 Submitting concurrent bids...`);
    const bidPromises = [];

    for (const order of orders) {
        // Each order gets 3-5 random bids
        const numBids = Math.floor(Math.random() * 3) + 3;
        const selectedVendors = vendors
            .sort(() => Math.random() - 0.5)
            .slice(0, numBids);

        for (const vendor of selectedVendors) {
            const promise = (async () => {
                const result = await makeRequest('POST', '/api/v1/bids', {
                    orderId: order.id,
                    wholesalerId: vendor.id,
                    priceQuote: order.totalAmount * (0.85 + Math.random() * 0.2),
                    deliveryEta: `${Math.floor(Math.random() * 24) + 1}H`,
                    stockConfirmed: Math.random() > 0.3
                });

                if (result.success) {
                    results.bidSubmission.success++;
                    results.bidSubmission.avgLatency += result.latency;
                } else {
                    results.bidSubmission.failed++;
                }
            })();

            bidPromises.push(promise);
        }
    }

    await Promise.all(bidPromises);

    if (results.bidSubmission.success > 0) {
        results.bidSubmission.avgLatency /= results.bidSubmission.success;
    }

    console.log(`✅ Submitted ${results.bidSubmission.success} bids`);
    console.log(`   Success: ${results.bidSubmission.success}, Failed: ${results.bidSubmission.failed}`);
    console.log(`   Avg Latency: ${results.bidSubmission.avgLatency.toFixed(2)}ms`);
}

/**
 * Select winners concurrently
 */
async function selectWinnersConcurrently(orders) {
    console.log(`\n🏆 Selecting winners concurrently...`);
    const selectionPromises = [];

    for (const order of orders) {
        const promise = (async () => {
            const result = await makeRequest('POST', `/api/v1/admin/orders/${order.id}/assign-winner`);

            if (result.success) {
                results.winnerSelection.success++;
                results.winnerSelection.avgLatency += result.latency;
            } else {
                results.winnerSelection.failed++;
            }
        })();

        selectionPromises.push(promise);
    }

    await Promise.all(selectionPromises);

    if (results.winnerSelection.success > 0) {
        results.winnerSelection.avgLatency /= results.winnerSelection.success;
    }

    console.log(`✅ Selected ${results.winnerSelection.success} winners`);
    console.log(`   Success: ${results.winnerSelection.success}, Failed: ${results.winnerSelection.failed}`);
    console.log(`   Avg Latency: ${results.winnerSelection.avgLatency.toFixed(2)}ms`);
}

/**
 * Simulate credit checks
 */
async function simulateCreditChecks(retailers, vendors) {
    console.log(`\n💳 Simulating credit checks...`);
    const creditPromises = [];

    for (let i = 0; i < 100; i++) {
        const retailer = retailers[Math.floor(Math.random() * retailers.length)];
        const vendor = vendors[Math.floor(Math.random() * vendors.length)];

        const promise = (async () => {
            const result = await makeRequest('GET', `/api/v1/credit/check?retailerId=${retailer.id}&wholesalerId=${vendor.id}`);

            if (result.success) {
                results.creditChecks.success++;
                results.creditChecks.avgLatency += result.latency;
            } else {
                results.creditChecks.failed++;
            }
        })();

        creditPromises.push(promise);
    }

    await Promise.all(creditPromises);

    if (results.creditChecks.success > 0) {
        results.creditChecks.avgLatency /= results.creditChecks.success;
    }

    console.log(`✅ Completed ${results.creditChecks.success} credit checks`);
    console.log(`   Avg Latency: ${results.creditChecks.avgLatency.toFixed(2)}ms`);
}

/**
 * Calculate statistics
 */
function calculateStats() {
    const sorted = [...results.latencies].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
    const avg = results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length || 0;
    const min = sorted[0] || 0;
    const max = sorted[sorted.length - 1] || 0;

    return { p50, p95, p99, avg, min, max };
}

/**
 * Generate report
 */
function generateReport() {
    const stats = calculateStats();
    const successRate = (results.successfulRequests / results.totalRequests * 100).toFixed(2);

    console.log(`\n
╔═══════════════════════════════════════════════════════════════╗
║                    LOAD TEST RESULTS                          ║
╚═══════════════════════════════════════════════════════════════╝

⏱️  DURATION: ${(results.duration / 1000).toFixed(2)}s

📊 REQUESTS:
   Total:      ${results.totalRequests}
   Successful: ${results.successfulRequests} (${successRate}%)
   Failed:     ${results.failedRequests}

📈 LATENCY (ms):
   Min:  ${stats.min.toFixed(2)}
   Avg:  ${stats.avg.toFixed(2)}
   P50:  ${stats.p50.toFixed(2)}
   P95:  ${stats.p95.toFixed(2)}
   P99:  ${stats.p99.toFixed(2)}
   Max:  ${stats.max.toFixed(2)}

🛒 ORDER CREATION:
   Success: ${results.orderCreation.success}
   Failed:  ${results.orderCreation.failed}
   Avg Latency: ${results.orderCreation.avgLatency.toFixed(2)}ms

💰 BID SUBMISSION:
   Success: ${results.bidSubmission.success}
   Failed:  ${results.bidSubmission.failed}
   Avg Latency: ${results.bidSubmission.avgLatency.toFixed(2)}ms

🏆 WINNER SELECTION:
   Success: ${results.winnerSelection.success}
   Failed:  ${results.winnerSelection.failed}
   Avg Latency: ${results.winnerSelection.avgLatency.toFixed(2)}ms

💳 CREDIT CHECKS:
   Success: ${results.creditChecks.success}
   Failed:  ${results.creditChecks.failed}
   Avg Latency: ${results.creditChecks.avgLatency.toFixed(2)}ms

${results.errors.length > 0 ? `
❌ TOP ERRORS (${results.errors.length} total):
${results.errors.slice(0, 5).map(e => `   - ${e.method} ${e.url}: ${e.error}`).join('\n')}
` : '✅ NO ERRORS'}

╚═══════════════════════════════════════════════════════════════╝
    `);

    // Save to file
    const fs = require('fs');
    fs.writeFileSync(
        `load-test-report-${Date.now()}.json`,
        JSON.stringify({ ...results, stats }, null, 2)
    );
}

/**
 * Main test execution
 */
async function runLoadTest() {
    console.log('🚀 Starting Load Test...\n');
    results.startTime = Date.now();

    try {
        // Get existing products (from seed)
        const productsRes = await makeRequest('GET', '/api/v1/products');
        const products = productsRes.data?.data || [];

        if (products.length === 0) {
            console.error('❌ No products found. Run seed script first.');
            process.exit(1);
        }

        // Phase 1: Setup
        const retailers = await createRetailers();
        const vendors = await createVendors();

        // Phase 2: Concurrent order creation
        const orders = await createConcurrentOrders(retailers, products);

        // Phase 3: Concurrent bid submission
        await submitConcurrentBids(orders, vendors);

        // Phase 4: Concurrent winner selection
        await selectWinnersConcurrently(orders);

        // Phase 5: Credit checks
        await simulateCreditChecks(retailers, vendors);

        // Calculate results
        results.endTime = Date.now();
        results.duration = results.endTime - results.startTime;

        // Generate report
        generateReport();

    } catch (error) {
        console.error('❌ Load test failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    runLoadTest();
}

module.exports = { runLoadTest };
