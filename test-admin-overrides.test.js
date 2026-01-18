const request = require('supertest');
const app = require('./src/app');
const prisma = require('./src/config/database');
const jwt = require('jsonwebtoken');
const routingTimeoutJob = require('./src/jobs/routingTimeout.job.js');

let adminToken;
let regularUserToken;
let retailerId;
let orderId;

// Helper to generate JWT token
const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

describe('Admin Overrides E2E Tests', () => {
  beforeAll(async () => {
    // Clean up database before tests
    await prisma.$transaction([
      prisma.adminAuditLog.deleteMany(),
      prisma.creditAccount.deleteMany(),
      prisma.orderItem.deleteMany(),
      prisma.order.deleteMany(),
      prisma.retailer.deleteMany(),
      prisma.user.deleteMany(),
      prisma.product.deleteMany(),
      prisma.category.deleteMany(),
    ]);

    // Create a category and product
    const category = await prisma.category.create({
      data: { name: 'Electronics' },
    });
    const product = await prisma.product.create({
      data: {
        name: 'Smartphone',
        categoryId: category.id,
        fixedPrice: 1000,
        unit: 'pcs',
      },
    });

    // Create an admin user
    const adminUser = await prisma.user.create({
      data: {
        phoneNumber: '1234567890',
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'ADMIN',
        passwordHash: 'hashedpassword', // Placeholder
      },
    });
    adminToken = generateToken(adminUser.id, adminUser.role);

    // Create a regular user (for unauthorized attempts)
    const regularUser = await prisma.user.create({
      data: {
        phoneNumber: '0987654321',
        name: 'Regular User',
        email: 'user@example.com',
        role: 'STAFF',
        passwordHash: 'hashedpassword', // Placeholder
      },
    });
    regularUserToken = generateToken(regularUser.id, regularUser.role);

    // Create a retailer
    const retailer = await prisma.retailer.create({
      data: {
        pasalName: 'Test Retailer',
        phoneNumber: '9988776655',
      },
    });
    retailerId = retailer.id;

    // Create an order
    const order = await prisma.order.create({
      data: {
        retailerId: retailerId,
        totalAmount: 500,
        paymentMode: 'COD',
        status: 'PLACED',
        items: {
          create: {
            productId: product.id,
            quantity: 1,
            priceAtOrder: 500,
          },
        },
      },
    });
    orderId = order.id;
  });

  afterAll(async () => {
    routingTimeoutJob.cancel();
    await prisma.$disconnect();
  });

  describe('POST /api/v1/admin/overrides/credit-limit', () => {
    it('should allow an admin to override a retailer\'s credit limit', async () => {
      const newLimit = 50000;
      const reason = 'Manual adjustment by admin';

      const res = await request(app)
        .post('/api/v1/admin/overrides/credit-limit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ retailerId, newCreditLimit: newLimit, reason });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.creditLimit).toEqual(newLimit);

      // Verify audit log
      const auditLog = await prisma.adminAuditLog.findFirst({
        where: {
          adminId: jwt.decode(adminToken).userId,
          action: 'CREDIT_LIMIT_OVERRIDE',
          targetId: retailerId,
          reason: reason,
        },
      });
      expect(auditLog).not.toBeNull();
    });

    it('should create a credit account if one does not exist', async () => {
      const newRetailer = await prisma.retailer.create({
        data: {
          pasalName: 'New Retailer',
          phoneNumber: '1122334455',
        },
      });
      const newRetailerId = newRetailer.id;
      const newLimit = 75000;
      const reason = 'Initial credit setup';

      const res = await request(app)
        .post('/api/v1/admin/overrides/credit-limit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ retailerId: newRetailerId, newCreditLimit: newLimit, reason });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.creditLimit).toEqual(newLimit);

      const creditAccount = await prisma.creditAccount.findUnique({
        where: { retailerId: newRetailerId },
      });
      expect(creditAccount).not.toBeNull();
      expect(creditAccount.creditLimit).toEqual(newLimit);

      // Verify audit log
      const auditLog = await prisma.adminAuditLog.findFirst({
        where: {
          adminId: jwt.decode(adminToken).userId,
          action: 'CREDIT_LIMIT_OVERRIDE',
          targetId: newRetailerId,
          reason: reason,
        },
      });
      expect(auditLog).not.toBeNull();
    });

    it('should not allow a non-admin user to override credit limit', async () => {
      const newLimit = 10000;
      const reason = 'Unauthorized attempt';

      const res = await request(app)
        .post('/api/v1/admin/overrides/credit-limit')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ retailerId, newCreditLimit: newLimit, reason });

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toEqual('Admin access required');
    });

    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/admin/overrides/credit-limit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ retailerId }); // Missing newCreditLimit and reason

      expect(res.statusCode).toEqual(400);
      expect(res.body.errors).toBeArrayOfSize(2);
    });
  });

  describe('POST /api/v1/admin/overrides/cancel-order', () => {
    it('should allow an admin to forcefully cancel an order', async () => {
      const reason = 'Customer requested urgent cancellation after dispatch';

      // Ensure order is in a state that might normally be hard to cancel (e.g., DELIVERED, but for this test, we'll keep it PLACED)
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'PLACED' },
      });

      const res = await request(app)
        .post('/api/v1/admin/overrides/cancel-order')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orderId, reason });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toEqual(orderId);

      // Verify order status updated
      const cancelledOrder = await prisma.order.findUnique({
        where: { id: orderId },
      });
      expect(cancelledOrder.status).toEqual('CANCELLED');
      expect(cancelledOrder.failureReason).toEqual(reason);

      // Verify audit log
      const auditLog = await prisma.adminAuditLog.findFirst({
        where: {
          adminId: jwt.decode(adminToken).userId,
          action: 'ORDER_CANCELLATION_OVERRIDE',
          targetId: orderId,
          reason: reason,
        },
      });
      expect(auditLog).not.toBeNull();
    });

    it('should not allow a non-admin user to forcefully cancel an order', async () => {
      const reason = 'Unauthorized cancellation attempt';

      const res = await request(app)
        .post('/api/v1/admin/overrides/cancel-order')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ orderId, reason });

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toEqual('Admin access required');
    });

    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/admin/overrides/cancel-order')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orderId: '' }); // Missing reason

      expect(res.statusCode).toEqual(400);
      expect(res.body.errors).toBeArrayOfSize(1);
    });

    it('should return 500 if order does not exist', async () => {
      const nonExistentOrderId = 'nonexistentorder123';
      const reason = 'Attempt to cancel non-existent order';

      const res = await request(app)
        .post('/api/v1/admin/overrides/cancel-order')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orderId: nonExistentOrderId, reason });

      expect(res.statusCode).toEqual(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain(`Order not found`);
    });
  });
});
