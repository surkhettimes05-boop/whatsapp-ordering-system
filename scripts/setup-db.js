const { exec } = require('child_process');
const bcrypt = require('bcryptjs');
const path = require('path');

// We have to import this dynamically after 'prisma generate' is run
let PrismaClient;

function runCommand(command) {
    const schemaPath = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');
    const fullCommand = `${command} --schema=${schemaPath}`;
    
    return new Promise((resolve, reject) => {
        // Run commands from the context of the backend directory
        exec(fullCommand, { cwd: path.join(__dirname, '..'), env: process.env }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing command: ${fullCommand}`);
                console.error(stderr);
                return reject(error);
            }
            console.log(stdout);
            resolve(stdout);
        });
    });
}

async function seedAdmin(prisma) {
    const phoneNumber = '+9779800000000';
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
        console.log('--- Resetting database ---');
        await runCommand('npx prisma migrate reset --force');

        console.log('\n--- Generating Prisma Client ---');
        await runCommand('npx prisma generate');
        
        // Dynamically import the fresh client
        PrismaClient = require('@prisma/client').PrismaClient;
        const prisma = new PrismaClient();
        
        console.log('\n--- Seeding admin user ---');
        await seedAdmin(prisma);

        await prisma.$disconnect();

    } catch (err) {
        console.error('❌ An error occurred during the database setup:', err);
        process.exit(1);
    }
}

main();