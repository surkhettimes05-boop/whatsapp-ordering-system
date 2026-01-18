require('dotenv').config();
const prisma = require('./src/config/database');

async function checkSchema() {
    const result = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'VendorOffer'
    ORDER BY ordinal_position
  `;
    console.log('VendorOffer table columns:');
    console.table(result);
    await prisma.$disconnect();
}

checkSchema();
