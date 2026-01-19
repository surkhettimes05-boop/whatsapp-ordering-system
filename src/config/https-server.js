/**
 * HTTPS Server Configuration
 * 
 * Handles HTTPS server initialization with:
 * - Support for platform-managed SSL (Railway, Render)
 * - Self-signed certificates for development
 * - Let's Encrypt integration for VPS
 * - Certificate auto-renewal
 * 
 * Usage in app.js:
 *   const { startServer } = require('./config/https-server');
 *   startServer(app);
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Check if running on managed platform with automatic SSL
 */
function isManagedPlatformWithSSL() {
  // Railway: Automatic HTTPS on Railway domain
  if (process.env.RAILWAY_ENVIRONMENT) {
    logger.info('🚂 Railway detected - using platform-managed SSL');
    return true;
  }

  // Render: Automatic HTTPS on Render domain
  if (process.env.RENDER === 'true') {
    logger.info('🎨 Render detected - using platform-managed SSL');
    return true;
  }

  // Heroku: Automatic HTTPS (with automatic certificate)
  if (process.env.DYNO) {
    logger.info('🚀 Heroku detected - using platform-managed SSL');
    return true;
  }

  // Vercel: Automatic HTTPS
  if (process.env.VERCEL_ENV) {
    logger.info('▲ Vercel detected - using platform-managed SSL');
    return true;
  }

  return false;
}

/**
 * Get certificate paths
 * 
 * Tries multiple locations:
 * 1. Environment variables (for Let's Encrypt automated paths)
 * 2. Default locations
 * 3. Docker/container paths
 */
function getCertificatePaths() {
  const certPath = process.env.CERT_PATH || '/etc/letsencrypt/live';
  const domain = process.env.DOMAIN || process.env.CERTBOT_DOMAIN;

  if (!domain) {
    return null;
  }

  const possiblePaths = [
    // Let's Encrypt standard locations
    `/etc/letsencrypt/live/${domain}/fullchain.pem`,
    `/etc/letsencrypt/live/${domain}/privkey.pem`,

    // Docker volume paths
    `/app/certs/${domain}/fullchain.pem`,
    `/app/certs/${domain}/privkey.pem`,

    // Environment-specified paths
    `${certPath}/${domain}/fullchain.pem`,
    `${certPath}/${domain}/privkey.pem`,

    // Relative paths (for custom setups)
    path.join(__dirname, '../../certs', domain, 'fullchain.pem'),
    path.join(__dirname, '../../certs', domain, 'privkey.pem'),

    // Development self-signed
    path.join(__dirname, '../../certs/self-signed/cert.pem'),
    path.join(__dirname, '../../certs/self-signed/key.pem'),
  ];

  return possiblePaths;
}

/**
 * Load certificates from file system
 */
function loadCertificates() {
  const paths = getCertificatePaths();

  if (!paths) {
    logger.warn('No domain configured for certificate loading');
    return null;
  }

  for (let i = 0; i < paths.length; i += 2) {
    const certPath = paths[i];
    const keyPath = paths[i + 1];

    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      try {
        logger.info('Loading SSL certificates', { certPath, keyPath });
        return {
          cert: fs.readFileSync(certPath, 'utf8'),
          key: fs.readFileSync(keyPath, 'utf8')
        };
      } catch (error) {
        logger.warn('Failed to load certificates', { certPath, error: error.message });
      }
    }
  }

  logger.warn('No valid SSL certificates found at expected locations');
  return null;
}

/**
 * Generate self-signed certificate for development
 * 
 * DO NOT USE IN PRODUCTION
 */
function generateSelfSignedCert() {
  const { execSync } = require('child_process');
  const certsDir = path.join(__dirname, '../../certs/self-signed');

  // Create directory if it doesn't exist
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
  }

  const keyPath = path.join(certsDir, 'key.pem');
  const certPath = path.join(certsDir, 'cert.pem');

  // Check if certificates already exist
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    logger.info('Self-signed certificate already exists');
    return {
      cert: fs.readFileSync(certPath, 'utf8'),
      key: fs.readFileSync(keyPath, 'utf8')
    };
  }

  logger.info('Generating self-signed certificate for development');

  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"`,
      { stdio: 'pipe' }
    );

    logger.info('Self-signed certificate generated', { keyPath, certPath });

    return {
      cert: fs.readFileSync(certPath, 'utf8'),
      key: fs.readFileSync(keyPath, 'utf8')
    };
  } catch (error) {
    logger.error('Failed to generate self-signed certificate', {
      error: error.message,
      suggestion: 'Ensure OpenSSL is installed on your system'
    });
    return null;
  }
}

/**
 * Create HTTPS server
 * 
 * For managed platforms: Regular HTTP server (platform handles SSL termination)
 * For VPS with Let's Encrypt: HTTPS server with certificates
 * For development: HTTP or self-signed HTTPS
 */
function createHttpsServer(app) {
  const PORT = process.env.PORT || 5000;

  // If on managed platform, just use HTTP (platform terminates SSL)
  if (isManagedPlatformWithSSL()) {
    logger.info('🔒 Using managed platform SSL - returning HTTP server');
    return require('http').createServer(app);
  }

  // Try to load real certificates first (Let's Encrypt on VPS)
  let certificates = loadCertificates();

  // Fallback to self-signed for development
  if (!certificates && process.env.NODE_ENV !== 'production') {
    logger.warn('No Let\'s Encrypt certificates found, generating self-signed certificate');
    certificates = generateSelfSignedCert();
  }

  // If we have certificates, create HTTPS server
  if (certificates) {
    logger.info('🔒 Creating HTTPS server with certificates');
    return https.createServer(certificates, app);
  }

  // Last resort: HTTP server (but log warning)
  logger.warn(
    '⚠️ No SSL certificates found. Server will run on HTTP. ' +
    'This is NOT secure for production. ' +
    'Set up Let\'s Encrypt on your VPS or use a managed platform.'
  );
  return require('http').createServer(app);
}

/**
 * Start server with proper HTTPS configuration
 * 
 * Usage:
 *   const { startServer } = require('./config/https-server');
 *   startServer(app);
 */
function startServer(app, options = {}) {
  const PORT = options.port || process.env.PORT || 5000;
  const HOST = options.host || process.env.HOST || '0.0.0.0';

  if (process.env.NODE_ENV === 'test') {
    // Don't start server in test mode
    return null;
  }

  // Create server (HTTP for managed platforms, HTTPS for VPS)
  const server = createHttpsServer(app);

  // Start listening
  server.listen(PORT, HOST, () => {
    const protocol = isManagedPlatformWithSSL() || process.env.NODE_ENV === 'development' 
      ? 'HTTP (SSL handled by platform)'
      : 'HTTPS';

    console.log('================================');
    console.log(`🚀 Server running on ${protocol}`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`📍 Host: ${HOST}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 API Base: http://localhost:${PORT}/api/v1`);

    // Show HTTPS info
    if (isManagedPlatformWithSSL()) {
      console.log(`📍 HTTPS: Managed by platform`);
    } else if (process.env.DOMAIN) {
      console.log(`📍 Domain: ${process.env.DOMAIN}`);
      console.log(`📍 Certificate: Let's Encrypt (Certbot)`);
      console.log(`📍 Auto-renewal: Enabled via systemd/cron`);
    }

    console.log('================================');

    // Log SSL configuration
    logger.info('Server started', {
      port: PORT,
      host: HOST,
      environment: process.env.NODE_ENV,
      https: !isManagedPlatformWithSSL(),
      domain: process.env.DOMAIN,
      platform: detectPlatform()
    });
  });

  // Handle server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Please use a different port.`);
      process.exit(1);
    } else if (error.code === 'EACCES') {
      console.error(`❌ Permission denied for port ${PORT}. Try using a port > 1024.`);
      process.exit(1);
    } else {
      console.error('❌ Server error:', error.message);
      process.exit(1);
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing server gracefully');
    server.close(() => {
      logger.info('Server closed');
      const prisma = require('./database');
      prisma.$disconnect().catch(() => {});
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing server gracefully');
    server.close(() => {
      logger.info('Server closed');
      const prisma = require('./database');
      prisma.$disconnect().catch(() => {});
    });
  });

  return server;
}

/**
 * Detect which platform is running
 */
function detectPlatform() {
  if (process.env.RAILWAY_ENVIRONMENT) return 'Railway';
  if (process.env.RENDER === 'true') return 'Render';
  if (process.env.DYNO) return 'Heroku';
  if (process.env.VERCEL_ENV) return 'Vercel';
  return 'VPS/Custom';
}

module.exports = {
  createHttpsServer,
  startServer,
  loadCertificates,
  generateSelfSignedCert,
  isManagedPlatformWithSSL,
  getCertificatePaths,
  detectPlatform
};
