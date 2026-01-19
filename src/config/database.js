// ============================================================================
// DATABASE CONFIGURATION
// Test vs Production modes
// ============================================================================

// In test mode, use the Jest Prisma mock
// The mock is auto-loaded via jest.config.js moduleNameMapper
if (process.env.NODE_ENV === 'test') {
  // When @prisma/client is required in tests, it returns our mock
  // This is handled by jest.config.js moduleNameMapper pointing to jest.prisma-mock.js
  const { PrismaClient } = require('@prisma/client');
  module.exports = new PrismaClient();
} else {
  // Production mode: use real PostgreSQL
  const prisma = require('./prismaClient.js');

  // Test database connection
  async function connectDatabase() {
    try {
      await prisma.$connect();
      console.log('✅ Database connected successfully');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      console.error('⚠️  Make sure PostgreSQL is running and DATABASE_URL is correct');
      // Don't exit in development - allow server to start
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
      return false;
    }
  }

  // Connect when module is loaded (non-blocking)
  connectDatabase().catch(console.error);

  // Graceful shutdown
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });

  module.exports = prisma;
}
