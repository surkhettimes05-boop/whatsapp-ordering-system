import prisma from '../src/config/prismaClient.js';

(async () => {
  try {
    console.log('SMOKE: connecting');
    await prisma.$connect();
    const res = await prisma.$queryRaw`SELECT 1 as result`;
    console.log('SMOKE OK', res);
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    console.error('SMOKE ERROR', e);
    try { await prisma.$disconnect(); } catch {};
    process.exit(1);
  }
})();
