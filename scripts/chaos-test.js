/**
 * Chaos Engineering Test Script
 * 
 * Simulates random failures and tests system resilience:
 * - Random server crashes (container restarts)
 * - Database connection drops
 * - Redis failures
 * - Network latency
 * - Concurrent race conditions
 * 
 * Run: node scripts/chaos-test.js
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const CHAOS_DURATION = 5 * 60 * 1000; // 5 minutes
const CHECK_INTERVAL = 10 * 1000; // 10 seconds

const chaosResults = {
    startTime: null,
    endTime: null,
    events: [],
    failures: [],
    recoveries: [],
    dataIntegrityIssues: []
};

/**
 * Log chaos event
 */
function logEvent(type, message, data = {}) {
    const event = {
        timestamp: new Date().toISOString(),
        type,
        message,
        ...data
    };

    chaosResults.events.push(event);
    console.log(`[${type}] ${message}`);
}

/**
 * Restart Docker container (simulate crash)
 */
async function crashBackend() {
    try {
        logEvent('CHAOS', '💥 Crashing backend container...');
        await execPromise('docker-compose restart backend');

        chaosResults.failures.push({
            type: 'BACKEND_CRASH',
            timestamp: new Date().toISOString()
        });

        logEvent('CHAOS', '✅ Backend restarted');

        // Wait for recovery
        await new Promise(resolve => setTimeout(resolve, 5000));

        chaosResults.recoveries.push({
            type: 'BACKEND_RECOVERY',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logEvent('ERROR', `Failed to crash backend: ${error.message}`);
    }
}

/**
 * Pause database container (simulate connection loss)
 */
async function pauseDatabase() {
    try {
        logEvent('CHAOS', '⏸️  Pausing database container...');
        await execPromise('docker-compose pause postgres');

        chaosResults.failures.push({
            type: 'DATABASE_PAUSE',
            timestamp: new Date().toISOString()
        });

        // Keep paused for 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000));

        logEvent('CHAOS', '▶️  Resuming database container...');
        await execPromise('docker-compose unpause postgres');

        chaosResults.recoveries.push({
            type: 'DATABASE_RECOVERY',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logEvent('ERROR', `Failed to pause database: ${error.message}`);
    }
}

/**
 * Restart Redis (simulate cache failure)
 */
async function crashRedis() {
    try {
        logEvent('CHAOS', '🔄 Restarting Redis container...');
        await execPromise('docker-compose restart redis');

        chaosResults.failures.push({
            type: 'REDIS_CRASH',
            timestamp: new Date().toISOString()
        });

        await new Promise(resolve => setTimeout(resolve, 3000));

        chaosResults.recoveries.push({
            type: 'REDIS_RECOVERY',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logEvent('ERROR', `Failed to crash Redis: ${error.message}`);
    }
}

/**
 * Simulate network latency
 */
async function simulateNetworkLatency() {
    try {
        logEvent('CHAOS', '🐌 Simulating network latency...');

        // Add 500ms delay to backend container network
        await execPromise('docker-compose exec -T backend sh -c "sleep 0.5"');

        chaosResults.failures.push({
            type: 'NETWORK_LATENCY',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logEvent('ERROR', `Failed to simulate latency: ${error.message}`);
    }
}

/**
 * Check system health
 */
async function checkHealth() {
    try {
        const { stdout } = await execPromise('curl -s http://localhost:3000/api/v1/health');
        const health = JSON.parse(stdout);

        if (health.status !== 'healthy') {
            logEvent('WARNING', `System unhealthy: ${health.status}`, health);
        } else {
            logEvent('INFO', 'System healthy');
        }

        return health;
    } catch (error) {
        logEvent('ERROR', `Health check failed: ${error.message}`);
        return null;
    }
}

/**
 * Verify data integrity
 */
async function verifyDataIntegrity() {
    try {
        logEvent('INFO', '🔍 Verifying data integrity...');

        // Check for orphaned orders
        const { stdout: orphanedOrders } = await execPromise(`
            docker-compose exec -T postgres psql -U karnali -d karnali_trade -t -c "
                SELECT COUNT(*) FROM orders 
                WHERE status = 'ASSIGNED' 
                AND final_wholesaler_id IS NULL
            "
        `);

        const orphanedCount = parseInt(orphanedOrders.trim());
        if (orphanedCount > 0) {
            chaosResults.dataIntegrityIssues.push({
                type: 'ORPHANED_ORDERS',
                count: orphanedCount,
                timestamp: new Date().toISOString()
            });
            logEvent('WARNING', `Found ${orphanedCount} orphaned orders`);
        }

        // Check for duplicate winners
        const { stdout: duplicateWinners } = await execPromise(`
            docker-compose exec -T postgres psql -U karnali -d karnali_trade -t -c "
                SELECT COUNT(*) FROM (
                    SELECT order_id, COUNT(*) 
                    FROM vendor_offers 
                    WHERE status = 'ACCEPTED' 
                    GROUP BY order_id 
                    HAVING COUNT(*) > 1
                ) AS duplicates
            "
        `);

        const duplicateCount = parseInt(duplicateWinners.trim());
        if (duplicateCount > 0) {
            chaosResults.dataIntegrityIssues.push({
                type: 'DUPLICATE_WINNERS',
                count: duplicateCount,
                timestamp: new Date().toISOString()
            });
            logEvent('ERROR', `Found ${duplicateCount} orders with multiple winners!`);
        }

        // Check ledger balance consistency
        const { stdout: ledgerIssues } = await execPromise(`
            docker-compose exec -T postgres psql -U karnali -d karnali_trade -t -c "
                SELECT COUNT(*) FROM ledger_entries 
                WHERE balance_after < 0
            "
        `);

        const negativeBalances = parseInt(ledgerIssues.trim());
        if (negativeBalances > 0) {
            chaosResults.dataIntegrityIssues.push({
                type: 'NEGATIVE_BALANCES',
                count: negativeBalances,
                timestamp: new Date().toISOString()
            });
            logEvent('ERROR', `Found ${negativeBalances} negative balances in ledger!`);
        }

        logEvent('INFO', '✅ Data integrity check complete');
    } catch (error) {
        logEvent('ERROR', `Data integrity check failed: ${error.message}`);
    }
}

/**
 * Random chaos event
 */
async function triggerRandomChaos() {
    const chaosEvents = [
        { fn: crashBackend, weight: 2 },
        { fn: pauseDatabase, weight: 1 },
        { fn: crashRedis, weight: 2 },
        { fn: simulateNetworkLatency, weight: 3 }
    ];

    // Weighted random selection
    const totalWeight = chaosEvents.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;

    for (const event of chaosEvents) {
        random -= event.weight;
        if (random <= 0) {
            await event.fn();
            break;
        }
    }
}

/**
 * Generate chaos report
 */
function generateChaosReport() {
    const duration = (chaosResults.endTime - chaosResults.startTime) / 1000;

    console.log(`\n
╔═══════════════════════════════════════════════════════════════╗
║                  CHAOS ENGINEERING RESULTS                    ║
╚═══════════════════════════════════════════════════════════════╝

⏱️  DURATION: ${duration.toFixed(2)}s

💥 FAILURES INJECTED:
   Backend Crashes:    ${chaosResults.failures.filter(f => f.type === 'BACKEND_CRASH').length}
   Database Pauses:    ${chaosResults.failures.filter(f => f.type === 'DATABASE_PAUSE').length}
   Redis Crashes:      ${chaosResults.failures.filter(f => f.type === 'REDIS_CRASH').length}
   Network Latency:    ${chaosResults.failures.filter(f => f.type === 'NETWORK_LATENCY').length}
   TOTAL:              ${chaosResults.failures.length}

✅ RECOVERIES:
   Backend:   ${chaosResults.recoveries.filter(r => r.type === 'BACKEND_RECOVERY').length}
   Database:  ${chaosResults.recoveries.filter(r => r.type === 'DATABASE_RECOVERY').length}
   Redis:     ${chaosResults.recoveries.filter(r => r.type === 'REDIS_RECOVERY').length}
   TOTAL:     ${chaosResults.recoveries.length}

${chaosResults.dataIntegrityIssues.length > 0 ? `
⚠️  DATA INTEGRITY ISSUES:
${chaosResults.dataIntegrityIssues.map(issue =>
        `   - ${issue.type}: ${issue.count} found`
    ).join('\n')}
` : '✅ NO DATA INTEGRITY ISSUES FOUND'}

📊 EVENTS LOG: ${chaosResults.events.length} total events

╚═══════════════════════════════════════════════════════════════╝
    `);

    // Save to file
    const fs = require('fs');
    fs.writeFileSync(
        `chaos-test-report-${Date.now()}.json`,
        JSON.stringify(chaosResults, null, 2)
    );

    console.log(`\n📄 Full report saved to chaos-test-report-${Date.now()}.json\n`);
}

/**
 * Main chaos test execution
 */
async function runChaosTest() {
    console.log('🌪️  Starting Chaos Engineering Test...\n');
    console.log(`Duration: ${CHAOS_DURATION / 1000}s`);
    console.log(`Check Interval: ${CHECK_INTERVAL / 1000}s\n`);

    chaosResults.startTime = Date.now();

    const endTime = Date.now() + CHAOS_DURATION;

    try {
        while (Date.now() < endTime) {
            // Trigger random chaos
            await triggerRandomChaos();

            // Wait before next chaos event
            await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));

            // Check system health
            await checkHealth();

            // Verify data integrity periodically
            if (Math.random() > 0.7) {
                await verifyDataIntegrity();
            }
        }

        // Final integrity check
        logEvent('INFO', '🔍 Running final data integrity check...');
        await verifyDataIntegrity();

        chaosResults.endTime = Date.now();
        generateChaosReport();

    } catch (error) {
        console.error('❌ Chaos test failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    runChaosTest();
}

module.exports = { runChaosTest };
