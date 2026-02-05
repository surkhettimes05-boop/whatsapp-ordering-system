const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedCompleteData() {
  console.log('🌱 Seeding complete sample data...');
  
  try {
    // Clear existing data (in development only)
    if (process.env.NODE_ENV !== 'production') {
      console.log('🧹 Cleaning existing data...');
      await prisma.orderItem.deleteMany();
      await prisma.order.deleteMany();
      await prisma.wholesalerProduct.deleteMany();
      await prisma.product.deleteMany();
      await prisma.category.deleteMany();
      await prisma.retailer.deleteMany();
      await prisma.wholesaler.deleteMany();
      await prisma.admin.deleteMany();
      await prisma.user.deleteMany();
    }
    
    // 1. Create Categories
    console.log('📂 Creating categories...');
    const categories = await Promise.all([
      prisma.category.create({
        data: {
          name: 'Grains & Cereals',
          slug: 'grains-cereals',
          description: 'Rice, wheat, flour and other grains'
        }
      }),
      prisma.category.create({
        data: {
          name: 'Pulses & Legumes',
          slug: 'pulses-legumes',
          description: 'Dal, beans, lentils'
        }
      }),
      prisma.category.create({
        data: {
          name: 'Cooking Essentials',
          slug: 'cooking-essentials',
          description: 'Oil, spices, salt, sugar'
        }
      }),
      prisma.category.create({
        data: {
          name: 'Beverages',
          slug: 'beverages',
          description: 'Tea, coffee, drinks'
        }
      }),
      prisma.category.create({
        data: {
          name: 'Vegetables',
          slug: 'vegetables',
          description: 'Fresh and dried vegetables'
        }
      })
    ]);
    
    // 2. Create Products
    console.log('🛍️ Creating products...');
    const products = await Promise.all([
      // Grains & Cereals
      prisma.product.create({
        data: {
          name: 'Basmati Rice',
          slug: 'basmati-rice-1kg',
          categoryId: categories[0].id,
          unit: '1kg',
          fixedPrice: 120,
          description: 'Premium quality basmati rice',
          imageUrl: '/images/products/basmati-rice.jpg'
        }
      }),
      prisma.product.create({
        data: {
          name: 'Wheat Flour',
          slug: 'wheat-flour-1kg',
          categoryId: categories[0].id,
          unit: '1kg',
          fixedPrice: 80,
          description: 'Fresh ground wheat flour',
          imageUrl: '/images/products/wheat-flour.jpg'
        }
      }),
      
      // Pulses & Legumes
      prisma.product.create({
        data: {
          name: 'Masoor Dal',
          slug: 'masoor-dal-1kg',
          categoryId: categories[1].id,
          unit: '1kg',
          fixedPrice: 180,
          description: 'Red lentils - high protein',
          imageUrl: '/images/products/masoor-dal.jpg'
        }
      }),
      prisma.product.create({
        data: {
          name: 'Moong Dal',
          slug: 'moong-dal-1kg',
          categoryId: categories[1].id,
          unit: '1kg',
          fixedPrice: 160,
          description: 'Yellow split mung beans',
          imageUrl: '/images/products/moong-dal.jpg'
        }
      }),
      
      // Cooking Essentials
      prisma.product.create({
        data: {
          name: 'Mustard Oil',
          slug: 'mustard-oil-1l',
          categoryId: categories[2].id,
          unit: '1L',
          fixedPrice: 200,
          description: 'Pure mustard cooking oil',
          imageUrl: '/images/products/mustard-oil.jpg'
        }
      }),
      prisma.product.create({
        data: {
          name: 'Sugar',
          slug: 'sugar-1kg',
          categoryId: categories[2].id,
          unit: '1kg',
          fixedPrice: 90,
          description: 'Refined white sugar',
          imageUrl: '/images/products/sugar.jpg'
        }
      }),
      prisma.product.create({
        data: {
          name: 'Salt',
          slug: 'salt-1kg',
          categoryId: categories[2].id,
          unit: '1kg',
          fixedPrice: 25,
          description: 'Iodized table salt',
          imageUrl: '/images/products/salt.jpg'
        }
      }),
      
      // Beverages
      prisma.product.create({
        data: {
          name: 'Black Tea',
          slug: 'black-tea-250g',
          categoryId: categories[3].id,
          unit: '250g',
          fixedPrice: 150,
          description: 'Premium black tea leaves',
          imageUrl: '/images/products/black-tea.jpg'
        }
      }),
      
      // Vegetables
      prisma.product.create({
        data: {
          name: 'Onion',
          slug: 'onion-1kg',
          categoryId: categories[4].id,
          unit: '1kg',
          fixedPrice: 60,
          description: 'Fresh red onions',
          imageUrl: '/images/products/onion.jpg'
        }
      }),
      prisma.product.create({
        data: {
          name: 'Potato',
          slug: 'potato-1kg',
          categoryId: categories[4].id,
          unit: '1kg',
          fixedPrice: 40,
          description: 'Fresh potatoes',
          imageUrl: '/images/products/potato.jpg'
        }
      })
    ]);
    
    // 3. Create Admin User
    console.log('👤 Creating admin user...');
    const adminUser = await prisma.user.create({
      data: {
        phoneNumber: '+977-9800000000',
        whatsappNumber: '+977-9800000000',
        name: 'System Admin',
        email: 'admin@whatsapporder.com',
        passwordHash: await bcrypt.hash('admin123', 10),
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    });
    
    const admin = await prisma.admin.create({
      data: {
        userId: adminUser.id,
        name: 'System Admin',
        email: 'admin@whatsapporder.com',
        phoneNumber: '+977-9800000000',
        whatsappNumber: '+977-9800000000'
      }
    });
    
    // 4. Create Wholesalers
    console.log('🏪 Creating wholesalers...');
    const wholesalers = await Promise.all([
      prisma.wholesaler.create({
        data: {
          businessName: 'Kathmandu Wholesale Hub',
          ownerName: 'Ram Bahadur Shrestha',
          phoneNumber: '+977-9801111111',
          whatsappNumber: '+977-9801111111',
          email: 'ram@ktmwholesale.com',
          businessAddress: 'Kalimati, Kathmandu',
          city: 'Kathmandu',
          district: 'Kathmandu',
          state: 'Bagmati',
          pincode: '44600',
          latitude: 27.7172,
          longitude: 85.3240,
          reliabilityScore: 85.5,
          totalOrders: 150,
          completedOrders: 142,
          cancelledOrders: 8,
          averageRating: 4.2,
          totalRevenue: 2500000,
          isActive: true,
          isVerified: true,
          capacity: 50,
          currentOrders: 12,
          categories: 'Grains,Pulses,Oil,Spices',
          deliveryRadius: 25,
          minimumOrder: 1000,
          deliveryCharges: 50
        }
      }),
      prisma.wholesaler.create({
        data: {
          businessName: 'Valley Traders',
          ownerName: 'Sita Devi Maharjan',
          phoneNumber: '+977-9802222222',
          whatsappNumber: '+977-9802222222',
          email: 'sita@valleytraders.com',
          businessAddress: 'Balkhu, Kathmandu',
          city: 'Kathmandu',
          district: 'Kathmandu',
          state: 'Bagmati',
          pincode: '44600',
          latitude: 27.6710,
          longitude: 85.2962,
          reliabilityScore: 92.3,
          totalOrders: 89,
          completedOrders: 85,
          cancelledOrders: 4,
          averageRating: 4.6,
          totalRevenue: 1800000,
          isActive: true,
          isVerified: true,
          capacity: 30,
          currentOrders: 8,
          categories: 'Vegetables,Fruits,Dairy',
          deliveryRadius: 20,
          minimumOrder: 800,
          deliveryCharges: 40
        }
      }),
      prisma.wholesaler.create({
        data: {
          businessName: 'Pokhara Agro Supplies',
          ownerName: 'Gopal Gurung',
          phoneNumber: '+977-9803333333',
          whatsappNumber: '+977-9803333333',
          email: 'gopal@pokharaagro.com',
          businessAddress: 'Mahendrapul, Pokhara',
          city: 'Pokhara',
          district: 'Kaski',
          state: 'Gandaki',
          pincode: '33700',
          latitude: 28.2096,
          longitude: 83.9856,
          reliabilityScore: 78.9,
          totalOrders: 67,
          completedOrders: 61,
          cancelledOrders: 6,
          averageRating: 4.0,
          totalRevenue: 1200000,
          isActive: true,
          isVerified: true,
          capacity: 25,
          currentOrders: 5,
          categories: 'Grains,Pulses,Tea',
          deliveryRadius: 30,
          minimumOrder: 1200,
          deliveryCharges: 60
        }
      })
    ]);
    
    // 5. Create Wholesaler Products (Inventory)
    console.log('📦 Creating wholesaler inventory...');
    const wholesalerProducts = [];
    
    for (const wholesaler of wholesalers) {
      for (const product of products) {
        // Each wholesaler has different pricing and stock
        const basePrice = parseFloat(product.fixedPrice);
        const priceVariation = (Math.random() - 0.5) * 0.2; // ±10% variation
        const priceOffered = Math.round(basePrice * (1 + priceVariation));
        
        const wholesalerProduct = await prisma.wholesalerProduct.create({
          data: {
            wholesalerId: wholesaler.id,
            productId: product.id,
            priceOffered: priceOffered,
            stock: Math.floor(Math.random() * 200) + 50, // 50-250 stock
            reservedStock: 0,
            minOrderQuantity: Math.floor(Math.random() * 5) + 1, // 1-5 min order
            leadTime: Math.floor(Math.random() * 48) + 24, // 24-72 hours
            isAvailable: Math.random() > 0.1 // 90% availability
          }
        });
        
        wholesalerProducts.push(wholesalerProduct);
      }
    }
    
    // 6. Create Retailers
    console.log('🏬 Creating retailers...');
    const retailers = await Promise.all([
      prisma.retailer.create({
        data: {
          pasalName: 'Kathmandu General Store',
          ownerName: 'Hari Prasad Sharma',
          phoneNumber: '+977-9811111111',
          whatsappNumber: '+977-9811111111',
          email: 'hari@ktmstore.com',
          status: 'ACTIVE',
          city: 'Kathmandu',
          district: 'Kathmandu',
          address: 'Thamel, Kathmandu',
          latitude: 27.7151,
          longitude: 85.3075,
          creditStatus: 'ACTIVE'
        }
      }),
      prisma.retailer.create({
        data: {
          pasalName: 'Pokhara Mart',
          ownerName: 'Maya Devi Thapa',
          phoneNumber: '+977-9822222222',
          whatsappNumber: '+977-9822222222',
          email: 'maya@pokharamart.com',
          status: 'ACTIVE',
          city: 'Pokhara',
          district: 'Kaski',
          address: 'Lakeside, Pokhara',
          latitude: 28.2080,
          longitude: 83.9590,
          creditStatus: 'ACTIVE'
        }
      }),
      prisma.retailer.create({
        data: {
          pasalName: 'Chitwan Supplies',
          ownerName: 'Bishnu Tharu',
          phoneNumber: '+977-9833333333',
          whatsappNumber: '+977-9833333333',
          email: 'bishnu@chitwansupplies.com',
          status: 'ACTIVE',
          city: 'Bharatpur',
          district: 'Chitwan',
          address: 'Narayanghat, Chitwan',
          latitude: 27.6588,
          longitude: 84.4360,
          creditStatus: 'ACTIVE'
        }
      })
    ]);
    
    // 7. Create Credit Accounts
    console.log('💳 Creating credit accounts...');
    for (const retailer of retailers) {
      await prisma.creditAccount.create({
        data: {
          retailerId: retailer.id,
          creditLimit: 50000 + Math.floor(Math.random() * 50000), // 50k-100k limit
          usedCredit: Math.floor(Math.random() * 20000), // 0-20k used
          maxOrderValue: 25000,
          maxOutstandingDays: 30
        }
      });
    }
    
    // 8. Create Sample Orders
    console.log('📋 Creating sample orders...');
    const orderStatuses = ['DELIVERED', 'PROCESSING', 'CONFIRMED', 'SHIPPED'];
    
    for (let i = 0; i < 15; i++) {
      const retailer = retailers[Math.floor(Math.random() * retailers.length)];
      const wholesaler = wholesalers[Math.floor(Math.random() * wholesalers.length)];
      const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
      
      // Create order
      const order = await prisma.order.create({
        data: {
          orderNumber: `WO-2026-${String(i + 1).padStart(3, '0')}`,
          retailerId: retailer.id,
          wholesalerId: wholesaler.id,
          finalWholesalerId: wholesaler.id,
          subtotal: 0, // Will calculate below
          taxRate: 13.0,
          taxAmount: 0, // Will calculate below
          totalAmount: 0, // Will calculate below
          paymentMode: Math.random() > 0.5 ? 'COD' : 'ONLINE',
          status: status,
          confirmedAt: status !== 'CREATED' ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : null,
          deliveredAt: status === 'DELIVERED' ? new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000) : null,
          createdAt: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000)
        }
      });
      
      // Add order items
      const numItems = Math.floor(Math.random() * 4) + 2; // 2-5 items per order
      let subtotal = 0;
      
      for (let j = 0; j < numItems; j++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const quantity = Math.floor(Math.random() * 5) + 1; // 1-5 quantity
        const priceAtOrder = parseFloat(product.fixedPrice);
        const itemTotal = priceAtOrder * quantity;
        subtotal += itemTotal;
        
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            quantity: quantity,
            priceAtOrder: priceAtOrder
          }
        });
      }
      
      // Update order totals
      const taxAmount = subtotal * 0.13;
      const totalAmount = subtotal + taxAmount;
      
      await prisma.order.update({
        where: { id: order.id },
        data: {
          subtotal: subtotal,
          taxAmount: taxAmount,
          totalAmount: totalAmount
        }
      });
    }
    
    console.log('✅ Sample data seeded successfully!');
    console.log('📊 Summary:');
    console.log(`   • ${categories.length} categories`);
    console.log(`   • ${products.length} products`);
    console.log(`   • ${wholesalers.length} wholesalers`);
    console.log(`   • ${wholesalerProducts.length} wholesaler products`);
    console.log(`   • ${retailers.length} retailers`);
    console.log(`   • 15 sample orders`);
    console.log(`   • 1 admin user (admin@whatsapporder.com / admin123)`);
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  seedCompleteData()
    .then(() => {
      console.log('🎉 Database seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedCompleteData };