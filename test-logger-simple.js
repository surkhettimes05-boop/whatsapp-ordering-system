/**
 * Quick test to verify Winston logger loads
 */

try {
  console.log('Loading Winston logger...');
  const { logger, loggers, logsDir } = require('./src/config/winston-logger');
  
  console.log('✅ Logger loaded successfully');
  console.log('Logs directory:', logsDir);
  console.log('\nAvailable loggers:');
  console.log('  - logger.info()');
  console.log('  - logger.warn()');
  console.log('  - logger.error()');
  console.log('  - logger.debug()');
  console.log('  - logger.orders.*');
  console.log('  - logger.credit.*');
  console.log('  - logger.webhooks.*');
  console.log('  - logger.errors.*');
  
  console.log('\n✅ All logger methods available');
  
} catch (error) {
  console.error('❌ Error loading logger:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
