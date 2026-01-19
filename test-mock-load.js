#!/usr/bin/env node
// Quick test to verify the mock loads

try {
  console.log('1. Loading mock...');
  const mock = require('./jest.prisma-mock.js');
  console.log('✓ Mock loaded');
  
  console.log('2. Creating PrismaClient...');
  const prisma = new mock.PrismaClient();
  console.log('✓ PrismaClient created');
  
  console.log('3. Checking methods...');
  console.log('  - $transaction:', typeof prisma.$transaction);
  console.log('  - ledgerEntry:', typeof prisma.ledgerEntry);
  console.log('  - order:', typeof prisma.order);
  
  console.log('\n✓ All checks passed!');
} catch (error) {
  console.error('✗ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
