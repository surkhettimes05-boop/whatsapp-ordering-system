const prisma = require('../src/config/prismaClient.js');

(async () => {
  try {
    console.log('SMOKE: connecting');
    await prisma.$connect();
    const result = await prisma.$queryRaw`SELECT 1 as result`;
    console.log('SMOKE OK', result);
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('SMOKE ERROR', error);
    try { await prisma.$disconnect(); } catch {}
    process.exit(1);
  }
})();
