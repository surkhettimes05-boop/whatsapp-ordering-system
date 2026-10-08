require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/database');
async function bootstrap() {
  const id = process.env.COMMERCE_WHOLESALER_ID;
  if (!id) throw new Error('COMMERCE_WHOLESALER_ID is required');
  const phone = String(process.env.ADMIN_PHONE || '').replace(/^\+/, '');
  const password = process.env.ADMIN_PASSWORD;
  if (!/^9779[78]\d{8}$/.test(phone) || !password || password.length < 12) throw new Error('ADMIN_PHONE (+977 Nepal mobile) and ADMIN_PASSWORD (12+ characters) are required');
  const existing = await prisma.user.findUnique({ where: { phoneNumber: phone } });
  if (existing && existing.role !== 'ADMIN') throw new Error('Bootstrap phone belongs to a non-admin account');
  if (!existing) await prisma.user.create({ data: { phoneNumber: phone, whatsappNumber: phone, name: 'Pasalho Admin', role: 'ADMIN', passwordHash: await bcrypt.hash(password, 12) } });
  await prisma.wholesaler.upsert({ where: { id }, update: {}, create: {
    id, businessName: 'Pasalho Fulfillment', ownerName: 'Pasalho', phoneNumber: 'internal-' + id, whatsappNumber: 'internal-' + id,
    businessAddress: 'Birendranagar', city: 'Birendranagar', district: 'Surkhet', state: 'Karnali', pincode: '21700', latitude: 28.6, longitude: 81.6, categories: '[]', isVerified: true
  } });
  console.log('Production admin and fulfillment location ready. No demo products or delivery zones were created.');
}
if (require.main === module) bootstrap().catch(e => { console.error(e.message); process.exitCode=1; }).finally(() => prisma.$disconnect());
module.exports = { bootstrap };
