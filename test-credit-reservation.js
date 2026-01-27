#!/usr/bin/env node

/**
 * Credit Reservation System - Test Suite
 * 
 * Tests the complete credit reservation lifecycle:
 * 1. Available credit calculation
 * 2. Credit reservation on order validation
 * 3. Credit release on cancellation
 * 4. Credit conversion to DEBIT on fulfillment
 * 5. Error handling
 */

const prisma = require('../config/database');
const creditReservationService = require('../services/creditReservation.service');
const orderService = require('../services/order.service');

let testsPassed = 0;
let testsFailed = 0;

// Helper: Print test result
function assert(condition, testName, details = '') {
    if (condition) {
        console.log(`✅ ${testName}`);
        if (details) console.log(`   ${details}`);
        testsPassed++;
    } else {
        console.log(`❌ ${testName}`);
        if (details) console.log(`   ${details}`);
        testsFailed++;
    }
}

async function runTests() {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  CREDIT RESERVATION SYSTEM - TEST SUITE  ║');
    console.log('╚════════════════════════════════════════════╝\n');

    try {
        // Test 1: Setup test data
        console.log('🔧 TEST 1: Setup Test Data');
        console.log('─'.repeat(45));

        // Create test retailer and wholesaler
        const retailer = await prisma.retailer.findFirst();
        const wholesaler = await prisma.wholesaler.findFirst();

        if (!retailer || !wholesaler) {
            console.log('⚠️  No retailers or wholesalers found in database');
            console.log('   Run: node backend/create-wholesaler-simple.js');
            console.log('   Then retry tests\n');
            process.exit(0);
        }

        const retailerId = retailer.id;
        const wholesalerId = wholesaler.id;

        // Create or get credit account
        let creditAccount = await prisma.retailerWholesalerCredit.findUnique({
            where: {
                retailerId_wholesalerId: { retailerId, wholesalerId },
            },
        });

        if (!creditAccount) {
            creditAccount = await prisma.retailerWholesalerCredit.create({
                data: {
                    retailerId,
                    wholesalerId,
                    creditLimit: 100000, // ₹100,000 limit
                    creditTerms: 30,
                    isActive: true,
                },
            });
        }

        assert(creditAccount.isActive, 'Credit account is active');
        assert(creditAccount.creditLimit === 100000, 'Credit limit is ₹100,000');

        // Create test order
        const order = await prisma.order.create({
            data: {
                retailerId,
                wholesalerId,
                orderNumber: `TEST-${Date.now()}`,
                subtotal: 50000,
                taxRate: 13,
                taxAmount: 6500,
                totalAmount: 56500,
                paymentMode: 'COD',
                status: 'CREATED',
            },
        });

        assert(order.id !== null, 'Test order created');
        console.log(`   Order ID: ${order.id}\n`);

        // Test 2: Calculate available credit
        console.log('🔧 TEST 2: Calculate Available Credit');
        console.log('─'.repeat(45));

        const creditBefore = await creditReservationService.getAvailableCredit(
            retailerId,
            wholesalerId
        );

        assert(creditBefore.available === 100000, 'Initial available credit is ₹100,000');
        assert(creditBefore.reserved === 0, 'No reservations initially');
        assert(creditBefore.debits === 0, 'No debits initially');
        console.log(`   Available: ₹${creditBefore.available}`);
        console.log(`   Limit: ₹${creditBefore.limit}`);
        console.log(`   Reserved: ₹${creditBefore.reserved}`);
        console.log(`   Debits: ₹${creditBefore.debits}\n`);

        // Test 3: Pre-check credit availability
        console.log('🔧 TEST 3: Pre-Check Credit Availability');
        console.log('─'.repeat(45));

        const check = await creditReservationService.canReserveCredit(
            retailerId,
            wholesalerId,
            56500
        );

        assert(check.canReserve === true, 'Can reserve ₹56,500');
        assert(check.available === 100000, 'Available credit shown correctly');
        console.log(`   Message: ${check.message}\n`);

        // Test 4: Reserve credit
        console.log('🔧 TEST 4: Reserve Credit for Order');
        console.log('─'.repeat(45));

        const reservation = await creditReservationService.reserveCredit(
            retailerId,
            wholesalerId,
            order.id,
            56500
        );

        assert(reservation.id !== null, 'Reservation created');
        assert(reservation.status === 'ACTIVE', 'Reservation status is ACTIVE');
        assert(reservation.reservationAmount === 56500, 'Reserved amount is ₹56,500');
        console.log(`   Reservation ID: ${reservation.id}`);
        console.log(`   Status: ${reservation.status}`);
        console.log(`   Amount: ₹${reservation.reservationAmount}\n`);

        // Test 5: Verify available credit reduced
        console.log('🔧 TEST 5: Verify Available Credit Reduced');
        console.log('─'.repeat(45));

        const creditAfterReserve = await creditReservationService.getAvailableCredit(
            retailerId,
            wholesalerId
        );

        assert(creditAfterReserve.available === 43500, 'Available credit reduced to ₹43,500');
        assert(creditAfterReserve.reserved === 56500, 'Reserved amount is ₹56,500');
        console.log(`   Available after reserve: ₹${creditAfterReserve.available}\n`);

        // Test 6: Reject order if credit insufficient
        console.log('🔧 TEST 6: Reject Order if Credit Insufficient');
        console.log('─'.repeat(45));

        const largeOrderCheck = await creditReservationService.canReserveCredit(
            retailerId,
            wholesalerId,
            50000 // Requesting ₹50k more (would need ₹106.5k total)
        );

        assert(largeOrderCheck.canReserve === false, 'Large order rejected (insufficient credit)');
        assert(largeOrderCheck.shortfall > 0, 'Shortfall calculated');
        console.log(`   Message: ${largeOrderCheck.message}`);
        console.log(`   Shortfall: ₹${largeOrderCheck.shortfall}\n`);

        // Test 7: Retrieve reservation details
        console.log('🔧 TEST 7: Retrieve Reservation Details');
        console.log('─'.repeat(45));

        const retrievedRes = await creditReservationService.getReservation(order.id);

        assert(retrievedRes.id === reservation.id, 'Reservation retrieved correctly');
        assert(retrievedRes.order.id === order.id, 'Order linked to reservation');
        console.log(`   Reservation found with order: ${retrievedRes.order.orderNumber}\n`);

        // Test 8: Release reservation (cancellation)
        console.log('🔧 TEST 8: Release Reservation (Cancellation)');
        console.log('─'.repeat(45));

        const released = await creditReservationService.releaseReservation(
            order.id,
            'CANCELLED'
        );

        assert(released.status === 'RELEASED', 'Reservation released');
        assert(released.releasedReason === 'CANCELLED', 'Release reason recorded');
        assert(released.releasedAt !== null, 'Release timestamp set');
        console.log(`   Status: ${released.status}`);
        console.log(`   Reason: ${released.releasedReason}`);
        console.log(`   Released At: ${released.releasedAt}\n`);

        // Test 9: Verify credit returned to pool
        console.log('🔧 TEST 9: Verify Credit Returned to Pool');
        console.log('─'.repeat(45));

        const creditAfterRelease = await creditReservationService.getAvailableCredit(
            retailerId,
            wholesalerId
        );

        assert(creditAfterRelease.available === 100000, 'Available credit returned to ₹100,000');
        assert(creditAfterRelease.reserved === 0, 'No active reservations');
        console.log(`   Available after release: ₹${creditAfterRelease.available}\n`);

        // Test 10: Create new order for DEBIT conversion test
        console.log('🔧 TEST 10: Prepare Order for DEBIT Conversion');
        console.log('─'.repeat(45));

        const order2 = await prisma.order.create({
            data: {
                retailerId,
                wholesalerId,
                orderNumber: `TEST-DEBIT-${Date.now()}`,
                subtotal: 30000,
                taxRate: 13,
                taxAmount: 3900,
                totalAmount: 33900,
                paymentMode: 'COD',
                status: 'CREATED',
            },
        });

        assert(order2.id !== null, 'Second test order created');
        console.log(`   Order 2 ID: ${order2.id}\n`);

        // Test 11: Reserve credit for order 2
        console.log('🔧 TEST 11: Reserve Credit for Order 2');
        console.log('─'.repeat(45));

        const reservation2 = await creditReservationService.reserveCredit(
            retailerId,
            wholesalerId,
            order2.id,
            33900
        );

        assert(reservation2.status === 'ACTIVE', 'Reservation 2 created and active');
        console.log(`   Reservation 2 Amount: ₹${reservation2.reservationAmount}\n`);

        // Test 12: Convert reservation to DEBIT (fulfillment)
        console.log('🔧 TEST 12: Convert Reservation to DEBIT (Fulfillment)');
        console.log('─'.repeat(45));

        const conversion = await creditReservationService.convertReservationToDebit(
            order2.id,
            retailerId,
            wholesalerId,
            33900,
            {
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            }
        );

        assert(conversion.reservation.status === 'CONVERTED_TO_DEBIT', 'Reservation converted');
        assert(conversion.ledgerEntry.id !== null, 'Ledger entry created');
        assert(conversion.ledgerEntry.entryType === 'DEBIT', 'Ledger entry is DEBIT type');
        assert(conversion.ledgerEntry.amount === 33900, 'Ledger entry amount matches');
        console.log(`   Ledger Entry ID: ${conversion.ledgerEntry.id}`);
        console.log(`   Type: ${conversion.ledgerEntry.entryType}`);
        console.log(`   Amount: ₹${conversion.ledgerEntry.amount}`);
        console.log(`   New Balance: ₹${conversion.ledgerEntry.balanceAfter}\n`);

        // Test 13: Verify available credit still same (reservation → debit)
        console.log('🔧 TEST 13: Verify Available Credit Pool');
        console.log('─'.repeat(45));

        const creditFinal = await creditReservationService.getAvailableCredit(
            retailerId,
            wholesalerId
        );

        assert(creditFinal.debits === 33900, 'Debits now include converted amount');
        assert(creditFinal.available === 66100, 'Available credit is limit - debits');
        console.log(`   Available: ₹${creditFinal.available}`);
        console.log(`   Debits: ₹${creditFinal.debits}`);
        console.log(`   Limit: ₹${creditFinal.limit}\n`);

        // Test 14: Get ledger entry from database
        console.log('🔧 TEST 14: Verify Ledger Entry in Database');
        console.log('─'.repeat(45));

        const ledgerEntry = await prisma.ledgerEntry.findUnique({
            where: { id: conversion.ledgerEntry.id },
        });

        assert(ledgerEntry !== null, 'Ledger entry found in database');
        assert(ledgerEntry.orderId === order2.id, 'Ledger entry linked to order');
        console.log(`   Ledger entry persisted with due date: ${ledgerEntry.dueDate}\n`);

        // Test 15: Cleanup and final stats
        console.log('🔧 TEST 15: Cleanup');
        console.log('─'.repeat(45));

        await prisma.creditReservation.deleteMany({
            where: {
                orderId: { in: [order.id, order2.id] },
            },
        });

        await prisma.order.deleteMany({
            where: {
                id: { in: [order.id, order2.id] },
            },
        });

        assert(true, 'Test data cleaned up');
        console.log(`\n`);

        // Summary
        console.log('╔════════════════════════════════════════════╗');
        console.log('║           TEST SUMMARY                    ║');
        console.log('╠════════════════════════════════════════════╣');
        console.log(`║ Passed: ${testsPassed.toString().padEnd(37)} ║`);
        console.log(`║ Failed: ${testsFailed.toString().padEnd(37)} ║`);
        console.log('╚════════════════════════════════════════════╝\n');

        if (testsFailed === 0) {
            console.log('🎉 All tests passed! Credit reservation system is working.\n');
            process.exit(0);
        } else {
            console.log(`⚠️  ${testsFailed} test(s) failed. Please review.\n`);
            process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Test suite error:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run tests
runTests();
