require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/database');

async function main() {
  const phone = String(process.env.TEST_ADMIN_PHONE || '').trim().replace(/^\+/, '');
  const password = process.env.TEST_ADMIN_PASSWORD || '';
  if (!/^\+?9779[78]\d{8}$/.test(phone) || password.length < 10) {
    throw new Error('Set TEST_ADMIN_PHONE to a Nepal mobile and TEST_ADMIN_PASSWORD to at least 10 characters');
  }
  const existing = await prisma.user.findUnique({ where: { phoneNumber: phone } });
  if (existing && existing.role !== 'ADMIN') {
    throw new Error('This phone belongs to a non-admin account; choose a separate admin phone');
  }
  const data = { name: 'Test Admin', whatsappNumber: phone, role: 'ADMIN', status: 'ACTIVE', passwordHash: await bcrypt.hash(password, 12) };
  await prisma.user.upsert({ where: { phoneNumber: phone }, update: data, create: { ...data, phoneNumber: phone } });
  console.log('Test admin login ready');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
