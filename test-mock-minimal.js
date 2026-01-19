// Minimal test to see what error we get
const mock = require('./jest.prisma-mock.js');
const PrismaClient = mock.PrismaClient;
const prisma = new PrismaClient();

console.log('Prisma client created');
console.log('Retailer proxy:', typeof prisma.retailer);
console.log('Create method:', typeof prisma.retailer.create);

prisma.retailer.create({
    data: {
        pasalName: 'Test',
        phoneNumber: '123',
        status: 'ACTIVE'
    }
}).then(result => {
    console.log('Success:', result);
}).catch(err => {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
});
