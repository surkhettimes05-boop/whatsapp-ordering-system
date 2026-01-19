/**
 * Seed Script for Financial Integrity Tests
 * Usage: node scripts/seed-financial-test.js
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function seed() {
    console.log('🌱 Seeding Financial Test Data...');

    // 1. Clean up previous test data (Idempotency)
    const TEST_RETAILER_PHONE = '9999999999';
    const TEST_WHOLESALER_NUMBER = '8888888888';

    // Delete related data cascade via retailer/wholesaler is tricky, manual cleanup safer
    const existingRetailer = await prisma.retailer.findUnique({ where: { phoneNumber: TEST_RETAILER_PHONE } });
    if (existingRetailer) {
        await prisma.ledgerEntry.deleteMany({ where: { retailerId: existingRetailer.id } });
        await prisma.retailerWholesalerCredit.deleteMany({ where: { retailerId: existingRetailer.id } });
        await prisma.retailer.delete({ where: { id: existingRetailer.id } });
    }

    const existingWholesaler = await prisma.wholesaler.findUnique({ where: { whatsappNumber: TEST_WHOLESALER_NUMBER } });
    if (existingWholesaler) {
        await prisma.wholesaler.delete({ where: { id: existingWholesaler.id } });
    }

    // 2. Create Wholesaler
    const wholesaler = await prisma.wholesaler.create({
        data: {
            businessName: 'Test Bank Wholesaler',
            whatsappNumber: TEST_WHOLESALER_NUMBER,
            status: 'APPROVED',
            isVerified: true
        }
    });

    // 3. Create Retailer
    const retailer = await prisma.retailer.create({
        data: {
            pasalName: 'Test Debit Retailer',
            phoneNumber: TEST_RETAILER_PHONE,
            status: 'ACTIVE'
        }
    });

    // 4. Create Credit Link (Limit: 10,000)
    await prisma.retailerWholesalerCredit.create({
        data: {
            retailerId: retailer.id,
            wholesalerId: wholesaler.id,
            creditLimit: 10000,
            creditTerms: 30,
            isActive: true
        }
    });

    console.log('✅ Seed Complete.');
    console.log('Wholesaler ID:', wholesaler.id);
    console.log('Retailer ID:', retailer.id);

    return { wholesalerId: wholesaler.id, retailerId: retailer.id };
}

if (require.main === module) {
    seed()
        .catch(e => {
            console.error(e);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}

module.exports = seed;
