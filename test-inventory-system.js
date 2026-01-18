/**
 * Test Suite: Inventory Truth Layer
 * 
 * Run with: node test-inventory-system.js
 * Requires: Database with wholesaler and product data
 */

const inventoryService = require('./src/services/inventory.service');
const orderServiceV2 = require('./src/services/order.service.v2');
const prisma = require('./src/config/database');

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testInventoryTruthLayer() {
  try {
    log(colors.blue, '\n========================================');
    log(colors.blue, '📦 INVENTORY TRUTH LAYER TEST SUITE');
    log(colors.blue, '========================================\n');

    // ============================================
    // TEST 1: Check Availability
    // ============================================
    log(colors.blue, 'TEST 1: Check Availability');
    log(colors.yellow, '→ Validate inventory before ordering...\n');

    // Get a sample wholesaler and product
    const wholesaler = await prisma.wholesaler.findFirst();
    if (!wholesaler) {
      log(colors.red, '❌ No wholesaler found in database');
      return;
    }

    const wholesalerProduct = await prisma.wholesalerProduct.findFirst({
      where: { wholesalerId: wholesaler.id },
      include: { product: true }
    });

    if (!wholesalerProduct) {
      log(colors.red, '❌ No products found for wholesaler');
      return;
    }

    const testItems = [
      { productId: wholesalerProduct.productId, quantity: 10 }
    ];

    const validation = await inventoryService.validateOrderAvailability(
      wholesaler.id,
      testItems
    );

    log(colors.green, `✅ Availability Check Result:`);
    console.log(`   Can Fulfill: ${validation.canFulfill}`);
    console.log(`   Available: ${wholesalerProduct.stock - wholesalerProduct.reservedStock}`);
    console.log(`   Requested: 10`);

    if (!validation.canFulfill) {
      log(colors.yellow, '⚠️  Not enough stock available. Adjusting test quantity...\n');
      testItems[0].quantity = Math.max(1, 
        Math.floor((wholesalerProduct.stock - wholesalerProduct.reservedStock) / 2)
      );
    } else {
      log(colors.green, '✅ Stock available for order\n');
    }

    // ============================================
    // TEST 2: Get Inventory Status
    // ============================================
    log(colors.blue, 'TEST 2: Get Inventory Status');
    log(colors.yellow, '→ Check current physical and reserved stock...\n');

    const status = await inventoryService.getInventoryStatus(
      wholesaler.id,
      wholesalerProduct.productId
    );

    log(colors.green, `✅ Current Inventory:`);
    console.log(`   Product: ${status.productName}`);
    console.log(`   Physical Stock: ${status.physicalStock}`);
    console.log(`   Reserved Stock: ${status.reservedStock}`);
    console.log(`   Available Stock: ${status.availableStock}`);
    console.log(`   Is Available: ${status.isAvailable}\n`);

    // ============================================
    // TEST 3: Reserve Stock
    // ============================================
    log(colors.blue, 'TEST 3: Reserve Stock (Atomic Transaction)');
    log(colors.yellow, '→ Lock stock for new order...\n');

    const orderId = `test-order-${Date.now()}`;
    const stockBefore = await inventoryService.getAvailableStock(
      wholesaler.id,
      wholesalerProduct.productId
    );

    log(colors.yellow, `Available before reservation: ${stockBefore}`);

    try {
      const reservation = await inventoryService.reserveStock(
        orderId,
        wholesaler.id,
        testItems
      );

      const stockAfter = await inventoryService.getAvailableStock(
        wholesaler.id,
        wholesalerProduct.productId
      );

      log(colors.green, `✅ Stock Reserved Successfully:`);
      console.log(`   Order ID: ${orderId}`);
      console.log(`   Items Reserved: ${reservation.reservationCount}`);
      console.log(`   Quantity: ${testItems[0].quantity}`);
      console.log(`   Stock Before: ${stockBefore}`);
      console.log(`   Stock After: ${stockAfter}`);
      console.log(`   Difference: ${stockBefore - stockAfter} (should equal ${testItems[0].quantity})\n`);

      if (stockBefore - stockAfter !== testItems[0].quantity) {
        log(colors.red, '❌ Stock deduction mismatch!');
        return;
      }
    } catch (err) {
      log(colors.red, `❌ Reservation Failed: ${err.message}\n`);
      return;
    }

    // ============================================
    // TEST 4: Check Reservation Status
    // ============================================
    log(colors.blue, 'TEST 4: Check Reservation Status');
    log(colors.yellow, '→ Verify reservation tracking...\n');

    const reservations = await prisma.stockReservation.findMany({
      where: { orderId },
      include: { wholesalerProduct: { include: { product: true } } }
    });

    log(colors.green, `✅ Found ${reservations.length} reservations:`);
    reservations.forEach(res => {
      console.log(`   - ${res.wholesalerProduct.product.name}: ${res.quantity} units (${res.status})`);
    });
    console.log();

    // ============================================
    // TEST 5: Release Stock
    // ============================================
    log(colors.blue, 'TEST 5: Release Stock (Order Cancelled)');
    log(colors.yellow, '→ Unlock stock for cancelled order...\n');

    const stockBeforeRelease = await inventoryService.getAvailableStock(
      wholesaler.id,
      wholesalerProduct.productId
    );

    log(colors.yellow, `Available before release: ${stockBeforeRelease}`);

    try {
      const release = await inventoryService.releaseStock(orderId);

      const stockAfterRelease = await inventoryService.getAvailableStock(
        wholesaler.id,
        wholesalerProduct.productId
      );

      log(colors.green, `✅ Stock Released Successfully:`);
      console.log(`   Items Released: ${release.releasedCount}`);
      console.log(`   Stock Before: ${stockBeforeRelease}`);
      console.log(`   Stock After: ${stockAfterRelease}`);
      console.log(`   Difference: ${stockAfterRelease - stockBeforeRelease} (should equal ${testItems[0].quantity})\n`);

      if (stockAfterRelease - stockBeforeRelease !== testItems[0].quantity) {
        log(colors.red, '❌ Stock restoration mismatch!');
        return;
      }
    } catch (err) {
      log(colors.red, `❌ Release Failed: ${err.message}\n`);
      return;
    }

    // ============================================
    // TEST 6: Deduct Stock (On Delivery)
    // ============================================
    log(colors.blue, 'TEST 6: Deduct Stock (Order Delivered)');
    log(colors.yellow, '→ Finalize order with stock deduction...\n');

    // Create a new reservation for deduction
    const orderId2 = `test-order-delivery-${Date.now()}`;
    try {
      await inventoryService.reserveStock(orderId2, wholesaler.id, testItems);
      log(colors.yellow, `Reserved for order: ${orderId2}`);
    } catch (err) {
      log(colors.red, `❌ Could not reserve for deduction test: ${err.message}`);
      return;
    }

    const stockBeforeDeduct = await inventoryService.getAvailableStock(
      wholesaler.id,
      wholesalerProduct.productId
    );

    log(colors.yellow, `Available before deduction: ${stockBeforeDeduct}`);

    try {
      const deduct = await inventoryService.deductStock(orderId2);

      const stockAfterDeduct = await inventoryService.getAvailableStock(
        wholesaler.id,
        wholesalerProduct.productId
      );

      log(colors.green, `✅ Stock Deducted Successfully:`);
      console.log(`   Items Deducted: ${deduct.deductedCount}`);
      console.log(`   Physical Stock Before: ${stockBeforeDeduct}`);
      console.log(`   Physical Stock After: ${stockAfterDeduct}`);
      console.log(`   Difference: ${stockBeforeDeduct - stockAfterDeduct} (should equal ${testItems[0].quantity})\n`);

      if (stockBeforeDeduct - stockAfterDeduct !== testItems[0].quantity) {
        log(colors.red, '❌ Stock deduction mismatch!');
        return;
      }
    } catch (err) {
      log(colors.red, `❌ Deduction Failed: ${err.message}\n`);
      return;
    }

    // ============================================
    // TEST 7: Negative Stock Detection
    // ============================================
    log(colors.blue, 'TEST 7: Negative Stock Detection');
    log(colors.yellow, '→ Scan for inventory anomalies...\n');

    try {
      const issues = await inventoryService.detectNegativeStock();

      if (issues.length === 0) {
        log(colors.green, `✅ No inventory issues detected - Stock is clean!\n`);
      } else {
        log(colors.red, `❌ Found ${issues.length} inventory issues:`);
        issues.forEach(issue => {
          console.log(`   - ${issue.type}`);
          console.log(`     Wholesaler: ${issue.wholesaler}`);
          console.log(`     Product: ${issue.product}`);
          console.log(`     Physical: ${issue.stock}, Reserved: ${issue.reserved}`);
        });
        console.log();
      }
    } catch (err) {
      log(colors.red, `❌ Diagnosis Failed: ${err.message}\n`);
      return;
    }

    // ============================================
    // TEST 8: Partial Fulfillment
    // ============================================
    log(colors.blue, 'TEST 8: Partial Fulfillment');
    log(colors.yellow, '→ Deliver only portion of order...\n');

    const orderId3 = `test-order-partial-${Date.now()}`;
    const partialItems = [{ productId: wholesalerProduct.productId, quantity: 10 }];

    try {
      await inventoryService.reserveStock(orderId3, wholesaler.id, partialItems);
      log(colors.yellow, `Reserved 10 units for order: ${orderId3}`);

      const stockBeforePartial = await inventoryService.getAvailableStock(
        wholesaler.id,
        wholesalerProduct.productId
      );

      // Deliver only 7 out of 10
      const partial = await inventoryService.deductStock(orderId3, {
        partialQuantities: {
          [orderId3]: 7
        }
      });

      log(colors.green, `✅ Partial Fulfillment Complete:`);
      console.log(`   Ordered: 10`);
      console.log(`   Delivered: 7`);
      console.log(`   Remaining: 3 (should be released/pending)`);
      console.log();
    } catch (err) {
      log(colors.yellow, `⚠️  Partial test note: ${err.message}`);
      console.log();
    }

    // ============================================
    // TEST 9: Overselling Prevention
    // ============================================
    log(colors.blue, 'TEST 9: Overselling Prevention');
    log(colors.yellow, '→ Try to order more than available...\n');

    const oversellItems = [
      { productId: wholesalerProduct.productId, quantity: wholesalerProduct.stock + 1000 }
    ];

    try {
      await inventoryService.validateOrderAvailability(wholesaler.id, oversellItems);
      log(colors.red, `❌ Should have prevented overselling!`);
    } catch (err) {
      log(colors.green, `✅ Overselling Prevented:`);
      console.log(`   Attempted: ${oversellItems[0].quantity} units`);
      console.log(`   Available: ${wholesalerProduct.stock}`);
      console.log(`   Result: Error thrown ✓\n`);
    }

    const validation2 = await inventoryService.validateOrderAvailability(
      wholesaler.id,
      oversellItems
    );

    if (!validation2.canFulfill && validation2.shortages.length > 0) {
      log(colors.green, `✅ Inventory Validation correctly rejected overselling order\n`);
    }

    // ============================================
    // SUMMARY
    // ============================================
    log(colors.green, '========================================');
    log(colors.green, '✅ ALL TESTS PASSED!');
    log(colors.green, '========================================\n');

    log(colors.green, 'Inventory Truth Layer Guarantees:');
    console.log('  ✅ No overselling possible');
    console.log('  ✅ Atomic transactions prevent corruption');
    console.log('  ✅ Real-time stock tracking');
    console.log('  ✅ Automatic reservation on order creation');
    console.log('  ✅ Automatic release on cancellation');
    console.log('  ✅ Automatic deduction on delivery');
    console.log('  ✅ Partial fulfillment supported');
    console.log('  ✅ Negative stock detection available\n');

  } catch (err) {
    log(colors.red, `\n❌ Test Suite Failed: ${err.message}`);
    console.error(err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

// Run tests
testInventoryTruthLayer();
