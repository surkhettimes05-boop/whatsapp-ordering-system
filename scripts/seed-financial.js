const prisma = require('../src/config/database');

async function seed() {
  // Create retailer
  const retailer = await prisma.retailer.create({ data: { phoneNumber: '9999999990', pasalName: 'Test Retailer' } });

  // Create wholesaler
  const wholesaler = await prisma.wholesaler.create({ data: { businessName: 'Test Wholesaler', ownerName: 'Owner', phoneNumber: '8888888800', whatsappNumber: '8888888800', businessAddress: 'Addr', city: 'City', state: 'State', pincode: '000000', latitude: 0, longitude: 0, categories: 'grocery' } });

  // Create credit config with small limit for testing
  const credit = await prisma.retailerWholesalerCredit.create({ data: { retailerId: retailer.id, wholesalerId: wholesaler.id, creditLimit: 100, creditTerms: 30, isActive: true } });

  console.log('Seeded:', { retailerId: retailer.id, wholesalerId: wholesaler.id, creditId: credit.id });
  return { retailer, wholesaler, credit };
}

if (require.main === module) {
  (async () => {
    try {
      await seed();
      console.log('Seeding complete');
    } catch (err) {
      console.error('Seed failed', err);
    } finally {
      await prisma.$disconnect();
    }
  })();
}

module.exports = { seed };
