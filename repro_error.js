const mock = require('./jest.prisma-mock.js');
const { PrismaClient } = mock;
const prisma = new PrismaClient();

async function test() {
    try {
        await prisma.$transaction(async (tx) => {
            console.log('In transaction...');
            await tx.user.create({ data: { id: '1', email: 'test@test.com' } });
            console.log('Created user in transaction');
        });
        console.log('Transaction committed');
    } catch (err) {
        console.error('ERROR_START');
        console.error(err.message);
        console.error(err.stack);
        console.error('ERROR_END');
    }
}

test();
