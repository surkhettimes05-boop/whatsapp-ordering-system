#!/usr/bin/env node
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/database');

async function seedFreeTest() {
  const groceries = await prisma.category.upsert({
    where: { slug: 'test-groceries' },
    update: { name: 'Test Groceries', isActive: true, sortOrder: 1 },
    create: {
      name: 'Test Groceries',
      slug: 'test-groceries',
      description: 'Demo category for zero-cost WhatsApp testing',
      sortOrder: 1,
      isActive: true
    }
  });

  const beverages = await prisma.category.upsert({
    where: { slug: 'test-beverages' },
    update: { name: 'Test Beverages', isActive: true, sortOrder: 2 },
    create: {
      name: 'Test Beverages',
      slug: 'test-beverages',
      description: 'Demo beverages for zero-cost WhatsApp testing',
      sortOrder: 2,
      isActive: true
    }
  });

  const products = [
    {
      sku: 'TEST-RICE-5KG',
      name: 'Test Rice 5 kg',
      slug: 'test-rice-5kg',
      brand: 'Demo',
      categoryId: groceries.id,
      unit: 'bag',
      packSize: '5 kg',
      fixedPrice: 500,
      mrp: 550,
      description: 'Demo product for COD flow testing',
      metaRetailerId: 'TEST-RICE-5KG'
    },
    {
      sku: 'TEST-MASALA-100G',
      name: 'Test Masala 100 g',
      slug: 'test-masala-100g',
      brand: 'Demo',
      categoryId: groceries.id,
      unit: 'pack',
      packSize: '100 g',
      fixedPrice: 80,
      mrp: 90,
      description: 'Demo product for search and cart testing',
      metaRetailerId: 'TEST-MASALA-100G'
    },
    {
      sku: 'TEST-JUICE-1L',
      name: 'Test Juice 1 L',
      slug: 'test-juice-1l',
      brand: 'Demo',
      categoryId: beverages.id,
      unit: 'bottle',
      packSize: '1 L',
      fixedPrice: 150,
      mrp: 175,
      description: 'Demo beverage for category testing',
      metaRetailerId: 'TEST-JUICE-1L'
    }
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: { ...product, isActive: true, deletedAt: null },
      create: { ...product, isActive: true }
    });
  }

  await prisma.serviceArea.upsert({
    where: { code: 'BIRENDRANAGAR-TEST' },
    update: {
      name: 'Birendranagar Test Zone',
      city: 'Birendranagar',
      district: 'Surkhet',
      postalCode: '21700',
      keywords: 'birendranagar,surkhet,latikoili,test chowk',
      isActive: true,
      minOrder: 0,
      deliveryFee: 0,
      etaText: 'Test zone: delivery simulation enabled'
    },
    create: {
      code: 'BIRENDRANAGAR-TEST',
      name: 'Birendranagar Test Zone',
      city: 'Birendranagar',
      district: 'Surkhet',
      postalCode: '21700',
      keywords: 'birendranagar,surkhet,latikoili,test chowk',
      isActive: true,
      minOrder: 0,
      deliveryFee: 0,
      etaText: 'Test zone: delivery simulation enabled'
    }
  });

  const now = new Date();
  const endsAt = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
  await prisma.commerceOffer.upsert({
    where: { code: 'TEST10' },
    update: {
      title: 'Test 10% Off',
      type: 'PERCENT',
      value: 10,
      minOrderAmount: 0,
      maxDiscount: 200,
      autoApply: false,
      perCustomerLimit: 100,
      startsAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      endsAt,
      isActive: true
    },
    create: {
      code: 'TEST10',
      title: 'Test 10% Off',
      description: 'Demo coupon for zero-cost COD flow testing',
      type: 'PERCENT',
      value: 10,
      minOrderAmount: 0,
      maxDiscount: 200,
      autoApply: false,
      perCustomerLimit: 100,
      startsAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      endsAt,
      isActive: true
    }
  });

  const adminPhone = String(process.env.TEST_ADMIN_PHONE || '').trim();
  const adminPassword = String(process.env.TEST_ADMIN_PASSWORD || '');
  if (adminPhone && adminPassword) {
    if (adminPassword.length < 10) {
      throw new Error('TEST_ADMIN_PASSWORD must be at least 10 characters');
    }
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.upsert({
      where: { phoneNumber: adminPhone },
      update: {
        whatsappNumber: adminPhone,
        name: 'Test Admin',
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE'
      },
      create: {
        phoneNumber: adminPhone,
        whatsappNumber: adminPhone,
        name: 'Test Admin',
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    });
  }

  return {
    categories: 2,
    products: products.length,
    serviceArea: 'BIRENDRANAGAR-TEST',
    coupon: 'TEST10',
    adminSeeded: Boolean(adminPhone && adminPassword)
  };
}

if (require.main === module) {
  seedFreeTest()
    .then(result => {
      console.log('Free test data ready:', JSON.stringify(result));
    })
    .catch(error => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { seedFreeTest };
