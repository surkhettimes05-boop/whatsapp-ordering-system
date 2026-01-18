const { exec } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function runCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing command: ${command}`);
                console.error(stderr);
                return reject(error);
            }
            console.log(stdout);
            resolve(stdout);
        });
    });
}

async function seedAdmin() {
    const phoneNumber = '+9779800000000';
    const password = 'admin123';
    const passwordHash = await bcrypt.hash(password, 10);

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

    console.log('✅ Admin user seeded successfully!');
}


async function main() {
    try {
        console.log('--- Resetting database ---');
        await runCommand('npx prisma migrate reset --force');
        
        console.log('\n--- Seeding admin user ---');
        await seedAdmin();

    } catch (err) {
        console.error('❌ An error occurred during the reset and seed process:', err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
