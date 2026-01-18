const prisma = require('../src/config/prismaClient');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seedAdmin() {
    const phoneNumber = '+9779800000000'; // Example admin phone
    const password = 'admin123';
    const passwordHash = await bcrypt.hash(password, 10);

    const existingAdmin = await prisma.user.findUnique({
        where: { phoneNumber },
    });

    if (!existingAdmin) {
        await prisma.user.create({
            data: {
                phoneNumber,
                whatsappNumber: phoneNumber,
                name: 'System Admin',
                passwordHash,
                role: 'ADMIN',
                status: 'ACTIVE'
            }
        });
        console.log('✅ Admin user created successfully!');
    } else {
        console.log('ℹ️ Admin user already exists.');
    }
}

async function main() {
    try {
        await seedAdmin();
    } catch (err) {
        console.error('❌ An error occurred during seeding:', err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
