/**
 * Vendor Routing Service - Standalone Test Suite
 * 
 * Run with: node test-vendor-routing.js
 * (No Jest required)
 */

const prisma = require('./src/config/database');
const VendorRoutingService = require('./src/services/vendorRouting.service');
const assert = require('assert');

let testsPassed = 0;
let testsFailed = 0;

// ============================================================================
// TEST HELPERS
// ============================================================================

async function runTest(name, testFn) {
	try {
		console.log(`\n[RUNNING] ${name}`);
		await testFn();
		console.log(`✅ PASSED: ${name}\n`);
		testsPassed++;
	} catch (error) {
		console.error(`❌ FAILED: ${name}`);
		console.error(`Error: ${error.message}\n`);
		testsFailed++;
	}
}

async function createTestRetailer() {
	return prisma.retailer.create({
		data: {
			ownerName: 'Test Retailer',
			phoneNumber: `+977980${Math.random().toString().slice(2, 8)}`,
			whatsappNumber: `+977980${Math.random().toString().slice(2, 8)}`,
			city: 'Kathmandu',
			address: 'Test Address',
			latitude: 27.7172,
			longitude: 85.3240
		}
	});
}

async function createTestWholesaler() {
	return prisma.wholesaler.create({
		data: {
			businessName: `Test Wholesaler ${Math.random().toString().slice(2, 5)}`,
			ownerName: 'Test Owner',
			phoneNumber: `+977981${Math.random().toString().slice(2, 8)}`,
			whatsappNumber: `+977981${Math.random().toString().slice(2, 8)}`,
			gstNumber: `12ABCD${Math.random().toString().slice(2, 6)}`,
			businessAddress: 'Wholesale Address',
			city: 'Kathmandu',
			state: 'Bagmati',
			pincode: '44600',
			latitude: 27.7172,
			longitude: 85.3240,
			isActive: true,
			isVerified: true,
			categories: JSON.stringify(['Electronics', 'Groceries']),
			reliabilityScore: 75,
			totalOrders: 50,
			completedOrders: 45,
			averageRating: 4.5,
			capacity: 20,
			currentOrders: 5
		}
	});
}

async function createTestOrder(retailerId) {
	return prisma.order.create({
		data: {
			orderNumber: `ORDER-${Date.now()}`,
			retailerId,
			totalAmount: 5000,
			status: 'CREATED'
		}
	});
}

async function cleanupTest(orderId, routingId) {
	try {
		await prisma.vendorCancellation.deleteMany({
			where: {
				vendorResponse: {
					vendorRouting: { orderId }
				}
			}
		});

		await prisma.vendorResponse.deleteMany({
			where: { vendorRoutingId: routingId }
		});

		await prisma.vendorRouting.deleteMany({
			where: { orderId }
		});

		await prisma.orderEvent.deleteMany({
			where: { orderId }
		});

		await prisma.order.delete({
			where: { id: orderId }
		});
	} catch (err) {
		console.warn(`Cleanup warning: ${err.message}`);
	}
}

// ============================================================================
// TESTS
// ============================================================================

async function runAllTests() {
	console.log('\n🧪 VENDOR ROUTING SERVICE - TEST SUITE\n');
	console.log('=====================================\n');

	// TEST 1
	await runTest('Basic vendor routing broadcast', async () => {
		const retailer = await createTestRetailer();
		const order = await createTestOrder(retailer.id);

		const vendors = [];
		for (let i = 0; i < 3; i++) {
			vendors.push(await createTestWholesaler());
		}

		const result = await VendorRoutingService.routeOrderToVendors(
			order.id,
			retailer.id,
			'Test Product'
		);

		assert(result.routingId, 'Should have routing ID');
		assert(result.vendorCount > 0, 'Should have vendors');

		const routing = await prisma.vendorRouting.findUnique({
			where: { id: result.routingId }
		});

		assert(routing, 'Routing should exist');
		assert.equal(routing.orderId, order.id);
		assert.equal(routing.lockedWholesalerId, null);

		await cleanupTest(order.id, result.routingId);
	});

	// TEST 2
	await runTest('Record vendor responses', async () => {
		const retailer = await createTestRetailer();
		const order = await createTestOrder(retailer.id);
		const vendor1 = await createTestWholesaler();
		const vendor2 = await createTestWholesaler();

		const routeResult = await VendorRoutingService.routeOrderToVendors(
			order.id,
			retailer.id,
			'Test Product'
		);

		const response1 = await VendorRoutingService.respondToVendor(
			routeResult.routingId,
			vendor1.id,
			'ACCEPT',
			{ responseTime: 2000 }
		);

		assert.equal(response1.responseType, 'ACCEPT');
		assert(response1.acceptedAt);

		const response2 = await VendorRoutingService.respondToVendor(
			routeResult.routingId,
			vendor2.id,
			'REJECT',
			{ reason: 'Out of stock' }
		);

		assert.equal(response2.responseType, 'REJECT');

		await cleanupTest(order.id, routeResult.routingId);
	});

	// TEST 3
	await runTest('Single vendor acceptance', async () => {
		const retailer = await createTestRetailer();
		const order = await createTestOrder(retailer.id);
		const vendor = await createTestWholesaler();

		const routeResult = await VendorRoutingService.routeOrderToVendors(
			order.id,
			retailer.id,
			'Test Product'
		);

		await VendorRoutingService.respondToVendor(
			routeResult.routingId,
			vendor.id,
			'ACCEPT'
		);

		const result = await VendorRoutingService.acceptVendor(
			routeResult.routingId,
			vendor.id
		);

		assert(result.accepted, 'Should be accepted');
		assert.equal(result.reason, 'LOCKED');

		const routing = await prisma.vendorRouting.findUnique({
			where: { id: routeResult.routingId }
		});

		assert.equal(routing.lockedWholesalerId, vendor.id);

		await cleanupTest(order.id, routeResult.routingId);
	});

	// TEST 4 - CRITICAL RACE CONDITION TEST
	await runTest('⚡ RACE CONDITION - 10 vendors simultaneously', async () => {
		const retailer = await createTestRetailer();
		const order = await createTestOrder(retailer.id);
		const vendors = [];

		for (let i = 0; i < 10; i++) {
			vendors.push(await createTestWholesaler());
		}

		const routeResult = await VendorRoutingService.routeOrderToVendors(
			order.id,
			retailer.id,
			'Test Product'
		);

		// Record all vendors as responding ACCEPT
		for (const vendor of vendors) {
			await VendorRoutingService.respondToVendor(
				routeResult.routingId,
				vendor.id,
				'ACCEPT'
			);
		}

		// Now: All 10 vendors try to accept simultaneously
		const acceptPromises = vendors.map((vendor) =>
			VendorRoutingService.acceptVendor(routeResult.routingId, vendor.id)
		);

		const results = await Promise.all(acceptPromises);

		const accepted = results.filter((r) => r.accepted);
		const rejected = results.filter((r) => !r.accepted);

		console.log(`  → Accepted: ${accepted.length} (should be 1)`);
		console.log(`  → Rejected: ${rejected.length} (should be 9)`);

		assert.equal(accepted.length, 1, 'Exactly ONE vendor should win');
		assert.equal(rejected.length, 9, 'Exactly 9 should lose');

		const routing = await prisma.vendorRouting.findUnique({
			where: { id: routeResult.routingId }
		});

		assert(routing.lockedWholesalerId, 'Order should be locked');
		console.log(`  → Winner: ${routing.lockedWholesalerId.slice(0, 8)}...`);

		await cleanupTest(order.id, routeResult.routingId);
	});

	// TEST 5
	await runTest('Idempotency - accept called twice', async () => {
		const retailer = await createTestRetailer();
		const order = await createTestOrder(retailer.id);
		const vendor = await createTestWholesaler();

		const routeResult = await VendorRoutingService.routeOrderToVendors(
			order.id,
			retailer.id,
			'Test Product'
		);

		await VendorRoutingService.respondToVendor(
			routeResult.routingId,
			vendor.id,
			'ACCEPT'
		);

		const result1 = await VendorRoutingService.acceptVendor(
			routeResult.routingId,
			vendor.id
		);

		const result2 = await VendorRoutingService.acceptVendor(
			routeResult.routingId,
			vendor.id
		);

		assert(result1.accepted);
		assert(result2.accepted);
		assert.equal(result2.reason, 'ALREADY_ACCEPTED');

		await cleanupTest(order.id, routeResult.routingId);
	});

	// TEST 6
	await runTest('Auto-cancellations sent to non-winners', async () => {
		const retailer = await createTestRetailer();
		const order = await createTestOrder(retailer.id);
		const vendors = [];

		for (let i = 0; i < 5; i++) {
			vendors.push(await createTestWholesaler());
		}

		const routeResult = await VendorRoutingService.routeOrderToVendors(
			order.id,
			retailer.id,
			'Test Product'
		);

		for (const vendor of vendors) {
			await VendorRoutingService.respondToVendor(
				routeResult.routingId,
				vendor.id,
				'ACCEPT'
			);
		}

		const result = await VendorRoutingService.acceptVendor(
			routeResult.routingId,
			vendors[0].id
		);

		assert(result.accepted);

		const cancelResult = await VendorRoutingService.sendAutoCancellations(
			routeResult.routingId,
			vendors[0].id
		);

		console.log(`  → Sent cancellations to ${cancelResult.cancelledCount} vendors`);
		assert(cancelResult.success);

		await cleanupTest(order.id, routeResult.routingId);
	});

	// TEST 7
	await runTest('Complete routing status with all details', async () => {
		const retailer = await createTestRetailer();
		const order = await createTestOrder(retailer.id);
		const vendors = [];

		for (let i = 0; i < 3; i++) {
			vendors.push(await createTestWholesaler());
		}

		const routeResult = await VendorRoutingService.routeOrderToVendors(
			order.id,
			retailer.id,
			'Test Product'
		);

		await VendorRoutingService.respondToVendor(
			routeResult.routingId,
			vendors[0].id,
			'ACCEPT'
		);

		await VendorRoutingService.acceptVendor(
			routeResult.routingId,
			vendors[0].id
		);

		const status = await VendorRoutingService.getRoutingStatus(
			routeResult.routingId
		);

		console.log(`  → Status: ${status.status}`);
		console.log(`  → Locked vendor: ${status.lockedVendor?.slice(0, 8) || 'none'}...`);

		assert.equal(status.status, 'LOCKED');
		assert(status.lockedVendor);

		await cleanupTest(order.id, routeResult.routingId);
	});

	// TEST 8
	await runTest('Error handling', async () => {
		try {
			await VendorRoutingService.getRoutingStatus('non-existent-id');
			assert(false, 'Should throw error');
		} catch (error) {
			assert(error.message.includes('not found') || error.message.includes('NOT_FOUND'));
		}
	});

	// Print results
	console.log('\n=====================================\n');
	console.log(`📊 TEST RESULTS\n`);
	console.log(`✅ Passed: ${testsPassed}`);
	console.log(`❌ Failed: ${testsFailed}`);
	console.log(`📈 Total:  ${testsPassed + testsFailed}\n`);

	if (testsFailed === 0) {
		console.log('🎉 ALL TESTS PASSED!\n');
	} else {
		console.log('⚠️  SOME TESTS FAILED\n');
		process.exit(1);
	}

	await prisma.$disconnect();
	process.exit(0);
}

// Run all tests
runAllTests().catch((error) => {
	console.error('Fatal error:', error);
	prisma.$disconnect().catch(() => {});
	process.exit(1);
});
