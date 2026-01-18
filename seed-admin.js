const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function seedAdmin() {
    const phoneNumber = '+9779800000000'; // Example admin phone
    const password = 'admin123';
    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await prisma.user.upsert({
        where: { phoneNumber },
        update: {
            role: 'ADMIN',
            passwordHash,
            status: 'ACTIVE',
            whatsappNumber: phoneNumber
        },
        create: {
            phoneNumber,
            whatsappNumber: phoneNumber,
            name: 'System Admin',
            passwordHash,
            role: 'ADMIN',
            status: 'ACTIVE'
        }
    });

    console.log('✅ Admin user seeded successfully!');
    console.log(`Phone: ${phoneNumber}`);
    console.log(`Password: ${password}`);
    process.exit(0);
}

seedAdmin().catch(err => {
    console.error('❌ Error seeding admin:', err);
    process.exit(1);
});
