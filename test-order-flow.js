/**
 * COMPLETE ORDER FLOW TEST
 * Tests the entire WhatsApp ordering process
 */

require('dotenv').config();
const axios = require('axios');

const API_BASE = 'http://localhost:5000/api/v1';

console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║        🧪 COMPLETE WHATSAPP ORDER FLOW TEST 🧪               ║
║                                                                ║
║  Testing: Products → Browse → Add to Cart → Checkout         ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`);

let testResults = [];

async function test(name, fn) {
  try {
    console.log(`\n⏳ ${name}...`);
    await fn();
    console.log(`✅ ${name}`);
    testResults.push({ name, status: 'PASS' });
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    testResults.push({ name, status: 'FAIL', error: error.message });
  }
}

async function runTests() {
  
  // Test 1: Get all products
  await test('Fetch all products', async () => {
    const res = await axios.get(`${API_BASE}/products`);
    if (!res.data.success || res.data.data.length === 0) {
      throw new Error('No products found');
    }
    console.log(`   Found ${res.data.data.length} products`);
  });

  // Test 2: Get products by category
  await test('Get products by category (Electronics)', async () => {
    const res = await axios.get(`${API_BASE}/products?category=Electronics`);
    if (!res.data.success) {
      throw new Error('Failed to fetch by category');
    }
    console.log(`   Found ${res.data.data.length} electronics`);
  });

  // Test 3: Create user via WhatsApp
  const phoneNumber = '+977' + Math.floor(Math.random() * 9000000000 + 1000000000);
  let userId;
  await test('Create user (simulate WhatsApp)', async () => {
    const res = await axios.post(`${API_BASE}/auth/whatsapp-register`, {
      phoneNumber: phoneNumber,
      name: 'Test Customer'
    });
    if (!res.data.success) {
      throw new Error('Failed to create user');
    }
    userId = res.data.data.user.id;
    console.log(`   User created: ${phoneNumber}`);
  });

  // Test 4: Get user cart (should be empty)
  await test('Get empty cart', async () => {
    const res = await axios.get(`${API_BASE}/cart/${userId}`);
    if (!res.data.success) {
      throw new Error('Failed to get cart');
    }
    console.log(`   Cart items: ${res.data.data.length}`);
  });

  // Test 5: Add product to cart
  let productId;
  await test('Add product to cart', async () => {
    // First, get a product
    const productsRes = await axios.get(`${API_BASE}/products`);
    productId = productsRes.data.data[0].id;
    
    const res = await axios.post(`${API_BASE}/cart/${userId}/add`, {
      productId: productId,
      quantity: 2
    });
    if (!res.data.success) {
      throw new Error('Failed to add to cart');
    }
    console.log(`   Product added: ${productsRes.data.data[0].name} x2`);
  });

  // Test 6: View cart
  await test('View cart with items', async () => {
    const res = await axios.get(`${API_BASE}/cart/${userId}`);
    if (!res.data.success || res.data.data.length === 0) {
      throw new Error('Cart is empty');
    }
    const total = res.data.data.reduce((sum, item) => sum + (item.product.basePrice * item.quantity), 0);
    console.log(`   ${res.data.data.length} item(s), Total: Rs. ${total}`);
  });

  // Test 7: Update cart quantity
  await test('Update cart item quantity', async () => {
    const cartRes = await axios.get(`${API_BASE}/cart/${userId}`);
    const cartItemId = cartRes.data.data[0].id;
    
    const res = await axios.put(`${API_BASE}/cart/${userId}/${cartItemId}`, {
      quantity: 5
    });
    if (!res.data.success) {
      throw new Error('Failed to update cart');
    }
    console.log(`   Quantity updated to 5`);
  });

  // Test 8: Create delivery address
  let addressId;
  await test('Add delivery address', async () => {
    const res = await axios.post(`${API_BASE}/addresses`, {
      userId: userId,
      addressLine1: '123 Main Street',
      city: 'Kathmandu',
      state: 'Bagmati',
      pincode: '44600'
    });
    if (!res.data.success) {
      throw new Error('Failed to create address');
    }
    addressId = res.data.data.id;
    console.log(`   Address saved: Kathmandu`);
  });

  // Test 9: Create order from cart
  let orderId;
  await test('Create order (checkout)', async () => {
    const res = await axios.post(`${API_BASE}/orders`, {
      userId: userId,
      addressId: addressId,
      paymentMethod: 'CASH_ON_DELIVERY'
    });
    if (!res.data.success) {
      throw new Error('Failed to create order');
    }
    orderId = res.data.data.id;
    console.log(`   Order created: ${res.data.data.orderNumber}`);
  });

  // Test 10: Get order details
  await test('Get order details', async () => {
    const res = await axios.get(`${API_BASE}/orders/${orderId}`);
    if (!res.data.success) {
      throw new Error('Failed to fetch order');
    }
    console.log(`   Order #${res.data.data.orderNumber}`);
    console.log(`   Status: ${res.data.data.status}`);
    console.log(`   Total: Rs. ${res.data.data.totalAmount}`);
  });

  // Test 11: Get user orders
  await test('Get user order history', async () => {
    const res = await axios.get(`${API_BASE}/orders?userId=${userId}`);
    if (!res.data.success) {
      throw new Error('Failed to fetch orders');
    }
    console.log(`   Total orders: ${res.data.data.length}`);
  });

  // Test 12: Verify webhook is working
  await test('Verify webhook endpoint', async () => {
    const res = await axios.get(`http://localhost:5000/api/v1/whatsapp/test`);
    if (!res.data.success) {
      throw new Error('Webhook test failed');
    }
    console.log(`   Webhook is active ✅`);
  });

  // Summary
  console.log(`\n${'═'.repeat(70)}`);
  console.log('\n📊 TEST SUMMARY\n');
  
  const passed = testResults.filter(t => t.status === 'PASS').length;
  const failed = testResults.filter(t => t.status === 'FAIL').length;
  
  testResults.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    if (result.error) {
      console.log(`   └─ ${result.error}`);
    }
  });

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`\n📈 Results: ${passed} PASSED, ${failed} FAILED out of ${testResults.length}`);

  if (failed === 0) {
    console.log(`\n🎉 ALL TESTS PASSED! Your ordering system is working!\n`);
    console.log(`✨ Next Steps:`);
    console.log(`   1. Send WhatsApp to: +1 (415) 523-8886`);
    console.log(`   2. Say: "products"  (to browse products)`);
    console.log(`   3. Say: "1"         (to add product 1 to cart)`);
    console.log(`   4. Say: "checkout"  (to place order)`);
    console.log(`   5. Provide delivery address`);
    console.log(`   6. Get order confirmation!\n`);
  } else {
    console.log(`\n⚠️  Some tests failed. Check the errors above.\n`);
  }
}

runTests().catch(console.error);
