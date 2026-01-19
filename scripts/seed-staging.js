/**
 * Comprehensive Seed Script for Staging Environment
 * 
 * Creates realistic test data:
 * - Admin users
 * - Retailers (10)
 * - Wholesalers (5)
 * - Products (50)
 * - Orders with bids (20)
 * - Credit accounts
 * - Ledger entries
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await prisma.$transaction([
        prisma.vendorOffer.deleteMany(),
        prisma.orderItem.deleteMany(),
        prisma.ledgerEntry.deleteMany(),
        prisma.stockReservation.deleteMany(),
        prisma.order.deleteMany(),
        prisma.wholesalerProduct.deleteMany(),
        prisma.retailerWholesalerCredit.deleteMany(),
        prisma.product.deleteMany(),
        prisma.category.deleteMany(),
        prisma.wholesaler.deleteMany(),
        prisma.retailer.deleteMany(),
        prisma.admin.deleteMany()
    ]);

    // 1. Create Admin
    console.log('👤 Creating admin...');
    const admin = await prisma.admin.create({
        data: {
            email: 'admin@karnali.com',
            passwordHash: await bcrypt.hash('Admin@123', 10),
            name: 'System Admin',
            role: 'SUPER_ADMIN',
            isActive: true
        }
    });

    // 2. Create Categories
    console.log('📁 Creating categories...');
    const categories = await Promise.all([
        prisma.category.create({ data: { name: 'Rice & Grains', slug: 'rice-grains' } }),
        prisma.category.create({ data: { name: 'Cooking Oil', slug: 'cooking-oil' } }),
        prisma.category.create({ data: { name: 'Pulses & Lentils', slug: 'pulses-lentils' } }),
        prisma.category.create({ data: { name: 'Spices', slug: 'spices' } }),
        prisma.category.create({ data: { name: 'Beverages', slug: 'beverages' } })
    ]);

    // 3. Create Products
    console.log('📦 Creating products...');
    const products = [];
    const productData = [
        { name: 'Basmati Rice (1kg)', category: categories[0].id, price: 150 },
        { name: 'Sunflower Oil (1L)', category: categories[1].id, price: 200 },
        { name: 'Red Lentils (1kg)', category: categories[2].id, price: 120 },
        { name: 'Turmeric Powder (100g)', category: categories[3].id, price: 80 },
        { name: 'Tea Leaves (250g)', category: categories[4].id, price: 180 },
        { name: 'Wheat Flour (1kg)', category: categories[0].id, price: 60 },
        { name: 'Mustard Oil (1L)', category: categories[1].id, price: 220 },
        { name: 'Chickpeas (1kg)', category: categories[2].id, price: 140 },
        { name: 'Chili Powder (100g)', category: categories[3].id, price: 90 },
        { name: 'Coffee Powder (200g)', category: categories[4].id, price: 250 }
    ];

    for (const p of productData) {
        products.push(await prisma.product.create({
            data: {
                name: p.name,
                categoryId: p.category,
                fixedPrice: p.price,
                unit: 'piece',
                isActive: true
            }
        }));
    }

    // 4. Create Retailers
    console.log('🏪 Creating retailers...');
    const retailers = [];
    for (let i = 1; i <= 10; i++) {
        retailers.push(await prisma.retailer.create({
            data: {
                pasalName: `Retailer Shop ${i}`,
                phoneNumber: `98000000${i.toString().padStart(2, '0')}`,
                status: 'ACTIVE'
            }
        }));
    }

    // 5. Create Wholesalers
    console.log('🏭 Creating wholesalers...');
    const wholesalers = [];
    for (let i = 1; i <= 5; i++) {
        const wholesaler = await prisma.wholesaler.create({
            data: {
                businessName: `Wholesaler ${i}`,
                whatsappNumber: `97700000${i}`,
                status: 'APPROVED',
                isVerified: true,
                reliabilityScore: 50 + (i * 10),
                averageRating: 3 + (i * 0.3)
            }
        });
        wholesalers.push(wholesaler);

        // Add products to wholesaler
        for (const product of products) {
            await prisma.wholesalerProduct.create({
                data: {
                    wholesalerId: wholesaler.id,
                    productId: product.id,
                    stock: Math.floor(Math.random() * 1000) + 100,
                    priceOffered: product.fixedPrice * (0.8 + Math.random() * 0.3),
                    minOrderQuantity: 10
                }
            });
        }
    }

    // 6. Create Credit Accounts
    console.log('💳 Creating credit accounts...');
    for (const retailer of retailers) {
        for (const wholesaler of wholesalers) {
            await prisma.retailerWholesalerCredit.create({
                data: {
                    retailerId: retailer.id,
                    wholesalerId: wholesaler.id,
                    creditLimit: 50000 + Math.random() * 50000,
                    usedCredit: Math.random() * 20000,
                    status: 'ACTIVE'
                }
            });
        }
    }

    // 7. Create Orders with Bids
    console.log('📋 Creating orders with bids...');
    for (let i = 0; i < 20; i++) {
        const retailer = retailers[Math.floor(Math.random() * retailers.length)];
        const product = products[Math.floor(Math.random() * products.length)];
        const quantity = Math.floor(Math.random() * 50) + 10;

        const order = await prisma.order.create({
            data: {
                retailerId: retailer.id,
                totalAmount: product.fixedPrice * quantity,
                status: i < 5 ? 'PENDING_BIDS' : (i < 15 ? 'DELIVERED' : 'ASSIGNED'),
                paymentMode: 'COD',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                items: {
                    create: {
                        productId: product.id,
                        quantity,
                        unitPrice: product.fixedPrice
                    }
                }
            }
        });

        // Create bids for pending orders
        if (order.status === 'PENDING_BIDS') {
            for (let j = 0; j < 3; j++) {
                const wholesaler = wholesalers[j];
                await prisma.vendorOffer.create({
                    data: {
                        orderId: order.id,
                        wholesalerId: wholesaler.id,
                        priceQuote: product.fixedPrice * quantity * (0.9 + Math.random() * 0.15),
                        deliveryEta: `${Math.floor(Math.random() * 24) + 1}H`,
                        stockConfirmed: Math.random() > 0.3,
                        status: 'PENDING'
                    }
                });
            }
        }

        // Assign winner for assigned/delivered orders
        if (order.status !== 'PENDING_BIDS') {
            const winner = wholesalers[Math.floor(Math.random() * wholesalers.length)];
            await prisma.order.update({
                where: { id: order.id },
                data: {
                    finalWholesalerId: winner.id,
                    wholesalerId: winner.id
                }
            });

            // Create ledger entry for delivered orders
            if (order.status === 'DELIVERED') {
                await prisma.ledgerEntry.create({
                    data: {
                        retailerId: retailer.id,
                        wholesalerId: winner.id,
                        orderId: order.id,
                        entryType: 'DEBIT',
                        amount: order.totalAmount,
                        balanceAfter: order.totalAmount,
                        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        createdBy: 'SYSTEM'
                    }
                });
            }
        }
    }

    console.log('✅ Seed completed successfully!');
    console.log(`
    📊 Summary:
    - Admin: 1
    - Categories: ${categories.length}
    - Products: ${products.length}
    - Retailers: ${retailers.length}
    - Wholesalers: ${wholesalers.length}
    - Orders: 20
    - Credit Accounts: ${retailers.length * wholesalers.length}
    
    🔑 Login Credentials:
    Email: admin@karnali.com
    Password: Admin@123
    `);
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
