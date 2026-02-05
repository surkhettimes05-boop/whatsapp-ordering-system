-- Seed basic data for WhatsApp Ordering System

-- Insert admin user
INSERT INTO users (id, "phoneNumber", "whatsappNumber", name, email, role, status, "updatedAt") 
VALUES ('admin-001', '+9779800000000', '+9779800000000', 'System Admin', 'admin@whatsapporder.com', 'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP);

INSERT INTO admins (id, "userId", name, email, "phoneNumber", "whatsappNumber", "updatedAt") 
VALUES ('admin-001', 'admin-001', 'System Admin', 'admin@whatsapporder.com', '+9779800000000', '+9779800000000', CURRENT_TIMESTAMP);

-- Insert categories
INSERT INTO categories (id, name, slug, description, "updatedAt") VALUES 
('cat-001', 'Grains & Cereals', 'grains-cereals', 'Rice, wheat, barley and other grains', CURRENT_TIMESTAMP),
('cat-002', 'Pulses & Lentils', 'pulses-lentils', 'Dal, beans, chickpeas and other pulses', CURRENT_TIMESTAMP),
('cat-003', 'Cooking Essentials', 'cooking-essentials', 'Oil, spices, salt and cooking ingredients', CURRENT_TIMESTAMP),
('cat-004', 'Beverages', 'beverages', 'Tea, coffee and other beverages', CURRENT_TIMESTAMP),
('cat-005', 'Vegetables', 'vegetables', 'Fresh and dried vegetables', CURRENT_TIMESTAMP);

-- Insert products
INSERT INTO products (id, name, slug, "categoryId", unit, "fixedPrice", description, "updatedAt") VALUES 
('prod-001', 'Basmati Rice', 'basmati-rice', 'cat-001', 'kg', 120.00, 'Premium quality basmati rice', CURRENT_TIMESTAMP),
('prod-002', 'Wheat Flour', 'wheat-flour', 'cat-001', 'kg', 45.00, 'Fine wheat flour for chapati', CURRENT_TIMESTAMP),
('prod-003', 'Masoor Dal', 'masoor-dal', 'cat-002', 'kg', 85.00, 'Red lentils - masoor dal', CURRENT_TIMESTAMP),
('prod-004', 'Cooking Oil', 'cooking-oil', 'cat-003', 'liter', 150.00, 'Refined cooking oil', CURRENT_TIMESTAMP),
('prod-005', 'Black Tea', 'black-tea', 'cat-004', 'kg', 300.00, 'Premium black tea leaves', CURRENT_TIMESTAMP),
('prod-006', 'Sugar', 'sugar', 'cat-003', 'kg', 55.00, 'White refined sugar', CURRENT_TIMESTAMP),
('prod-007', 'Salt', 'salt', 'cat-003', 'kg', 25.00, 'Iodized table salt', CURRENT_TIMESTAMP),
('prod-008', 'Onion', 'onion', 'cat-005', 'kg', 40.00, 'Fresh red onions', CURRENT_TIMESTAMP),
('prod-009', 'Potato', 'potato', 'cat-005', 'kg', 35.00, 'Fresh potatoes', CURRENT_TIMESTAMP),
('prod-010', 'Turmeric Powder', 'turmeric-powder', 'cat-003', 'kg', 180.00, 'Pure turmeric powder', CURRENT_TIMESTAMP);

-- Insert wholesalers
INSERT INTO wholesalers (id, "businessName", "ownerName", "phoneNumber", "whatsappNumber", email, "businessAddress", city, state, pincode, latitude, longitude, categories, "updatedAt") VALUES 
('whole-001', 'Kathmandu Traders', 'Ram Bahadur Shrestha', '+9779801234567', '+9779801234567', 'ram@ktmtraders.com', 'Asan Bazaar, Kathmandu', 'Kathmandu', 'Bagmati', '44600', 27.7172, 85.3240, 'grains-cereals,pulses-lentils,cooking-essentials', CURRENT_TIMESTAMP),
('whole-002', 'Pokhara Wholesale', 'Sita Gurung', '+9779807654321', '+9779807654321', 'sita@pokharawholesale.com', 'Mahendrapul, Pokhara', 'Pokhara', 'Gandaki', '33700', 28.2096, 83.9856, 'beverages,vegetables,cooking-essentials', CURRENT_TIMESTAMP),
('whole-003', 'Valley Suppliers', 'Krishna Tamang', '+9779809876543', '+9779809876543', 'krishna@valleysuppliers.com', 'Bhaktapur Durbar Square', 'Bhaktapur', 'Bagmati', '44800', 27.6710, 85.4298, 'grains-cereals,pulses-lentils,vegetables', CURRENT_TIMESTAMP);

-- Insert wholesaler products
INSERT INTO wholesaler_products (id, "wholesalerId", "productId", "priceOffered", stock, "minOrderQuantity", "leadTime", "updatedAt") VALUES 
('wp-001', 'whole-001', 'prod-001', 115.00, 1000, 10, 24, CURRENT_TIMESTAMP),
('wp-002', 'whole-001', 'prod-002', 42.00, 500, 25, 24, CURRENT_TIMESTAMP),
('wp-003', 'whole-001', 'prod-003', 82.00, 200, 5, 24, CURRENT_TIMESTAMP),
('wp-004', 'whole-002', 'prod-004', 145.00, 100, 5, 48, CURRENT_TIMESTAMP),
('wp-005', 'whole-002', 'prod-005', 290.00, 50, 2, 48, CURRENT_TIMESTAMP),
('wp-006', 'whole-002', 'prod-008', 38.00, 300, 10, 24, CURRENT_TIMESTAMP),
('wp-007', 'whole-003', 'prod-006', 52.00, 400, 20, 24, CURRENT_TIMESTAMP),
('wp-008', 'whole-003', 'prod-007', 23.00, 200, 10, 24, CURRENT_TIMESTAMP),
('wp-009', 'whole-003', 'prod-009', 33.00, 500, 15, 24, CURRENT_TIMESTAMP),
('wp-010', 'whole-001', 'prod-010', 175.00, 100, 2, 48, CURRENT_TIMESTAMP);

-- Insert retailers
INSERT INTO retailers (id, "pasalName", "ownerName", "phoneNumber", "whatsappNumber", email, city, district, address, "updatedAt") VALUES 
('ret-001', 'Sunrise General Store', 'Hari Prasad Sharma', '+9779851234567', '+9779851234567', 'hari@sunrisestore.com', 'Lalitpur', 'Lalitpur', 'Jawalakhel, Lalitpur', CURRENT_TIMESTAMP),
('ret-002', 'Mountain View Shop', 'Maya Thapa', '+9779857654321', '+9779857654321', 'maya@mountainview.com', 'Pokhara', 'Kaski', 'Lakeside, Pokhara', CURRENT_TIMESTAMP),
('ret-003', 'City Center Mart', 'Rajesh Acharya', '+9779859876543', '+9779859876543', 'rajesh@citycenter.com', 'Kathmandu', 'Kathmandu', 'Thamel, Kathmandu', CURRENT_TIMESTAMP);

-- Insert credit accounts for retailers
INSERT INTO credit_accounts (id, "retailerId", "creditLimit", "usedCredit", "maxOrderValue", "updatedAt") VALUES 
('credit-001', 'ret-001', 50000.00, 15000.00, 25000.00, CURRENT_TIMESTAMP),
('credit-002', 'ret-002', 30000.00, 8000.00, 15000.00, CURRENT_TIMESTAMP),
('credit-003', 'ret-003', 75000.00, 25000.00, 35000.00, CURRENT_TIMESTAMP);

-- Insert sample orders
INSERT INTO orders (id, "orderNumber", "retailerId", "wholesalerId", "finalWholesalerId", "totalAmount", status, "createdAt", "updatedAt") VALUES 
('order-001', 'ORD-2026-001', 'ret-001', 'whole-001', 'whole-001', 2300.00, 'DELIVERED', '2026-01-25 10:30:00', CURRENT_TIMESTAMP),
('order-002', 'ORD-2026-002', 'ret-002', 'whole-002', 'whole-002', 1450.00, 'SHIPPED', '2026-01-28 14:15:00', CURRENT_TIMESTAMP),
('order-003', 'ORD-2026-003', 'ret-003', 'whole-003', 'whole-003', 3200.00, 'PROCESSING', '2026-01-29 09:45:00', CURRENT_TIMESTAMP),
('order-004', 'ORD-2026-004', 'ret-001', NULL, NULL, 1800.00, 'PENDING_BIDS', '2026-01-30 11:20:00', CURRENT_TIMESTAMP),
('order-005', 'ORD-2026-005', 'ret-002', 'whole-001', 'whole-001', 2750.00, 'CONFIRMED', '2026-01-30 16:30:00', CURRENT_TIMESTAMP);

-- Insert order items
INSERT INTO order_items (id, "orderId", "productId", quantity, "priceAtOrder") VALUES 
('oi-001', 'order-001', 'prod-001', 10, 115.00),
('oi-002', 'order-001', 'prod-003', 15, 82.00),
('oi-003', 'order-002', 'prod-004', 10, 145.00),
('oi-004', 'order-003', 'prod-006', 50, 52.00),
('oi-005', 'order-003', 'prod-007', 20, 23.00),
('oi-006', 'order-004', 'prod-002', 40, 42.00),
('oi-007', 'order-005', 'prod-001', 20, 115.00),
('oi-008', 'order-005', 'prod-010', 2, 175.00);

-- Insert some sample conversations
INSERT INTO conversations (id, "retailerId", status, "unreadCount", "updatedAt") VALUES 
('conv-001', 'ret-001', 'OPEN', 2, CURRENT_TIMESTAMP),
('conv-002', 'ret-002', 'CLOSED', 0, CURRENT_TIMESTAMP),
('conv-003', 'ret-003', 'OPEN', 1, CURRENT_TIMESTAMP);

-- Insert sample WhatsApp messages
INSERT INTO whatsapp_messages (id, "from", "to", body, direction) VALUES 
('msg-001', '+9779851234567', '+9779800000000', 'I want to order rice', 'INBOUND'),
('msg-002', '+9779800000000', '+9779851234567', 'Sure! How much rice do you need?', 'OUTBOUND'),
('msg-003', '+9779857654321', '+9779800000000', 'order', 'INBOUND'),
('msg-004', '+9779800000000', '+9779857654321', 'Welcome! Please select items from our menu', 'OUTBOUND');

COMMIT;