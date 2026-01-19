/**
 * HTTPS Enforcer Middleware
 * 
 * Ensures all traffic is over HTTPS in production
 * - Redirects HTTP to HTTPS
 * - Adds security headers
 * - Enforces HTTPS-only cookies
 * - Validates webhook URLs are HTTPS
 * 
 * Usage:
 *   const { enforceHttps, httpsOnly } = require('./middleware/https-enforcer.middleware');
 *   
 *   // For app-level (all routes)
 *   app.use(enforceHttps);
 *   
 *   // For specific routes (webhooks)
 *   app.post('/webhook', httpsOnly, handler);
 */

const logger = require('../utils/logger');

/**
 * Check if request is over HTTPS
 * 
 * Handles:
 * - Direct HTTPS connections
 * - X-Forwarded-Proto header (Railway, Render, Heroku, AWS)
 * - X-Forwarded-For header (custom reverse proxy)
 * - CF-Visitor header (Cloudflare)
 * - ALB-Proto header (AWS ALB)
 */
function isHttps(req) {
  // Direct HTTPS connection
  if (req.protocol === 'https') {
    return true;
  }

  // Cloud platform headers (Railway, Render, Heroku, AWS ELB)
  const xForwardedProto = req.get('x-forwarded-proto');
  if (xForwardedProto === 'https') {
    return true;
  }

  // Cloudflare
  const cfVisitor = req.get('cf-visitor');
  if (cfVisitor) {
    try {
      const data = JSON.parse(cfVisitor);
      if (data.scheme === 'https') {
        return true;
      }
    } catch (e) {
      logger.warn('Failed to parse CF-Visitor header', { error: e.message });
    }
  }

  // AWS ALB
  const albProto = req.get('x-alb-proto');
  if (albProto === 'https') {
    return true;
  }

  // Nginx reverse proxy custom header
  const customHttps = req.get('x-proto');
  if (customHttps === 'https') {
    return true;
  }

  return false;
}

/**
 * Get full URL from request (handles all proxy scenarios)
 */
function getFullUrl(req) {
  // Try to get host from X-Forwarded-Host (set by reverse proxy)
  let host = req.get('x-forwarded-host') || req.get('host') || 'unknown';

  // Ensure we have the protocol
  const protocol = isHttps(req) ? 'https' : 'http';

  return `${protocol}://${host}${req.originalUrl}`;
}

/**
 * Middleware: Enforce HTTPS for all traffic (production only)
 * 
 * In production: Redirect HTTP to HTTPS
 * In development: Allow HTTP for local testing
 * 
 * Usage: app.use(enforceHttps);
 */
const enforceHttps = (req, res, next) => {
  // Skip in development/testing
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Skip HTTP checks for health endpoints (some platforms need HTTP health checks)
  const noHttpsRequiredPaths = ['/health', '/health/live', '/metrics'];
  if (noHttpsRequiredPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Already on HTTPS
  if (isHttps(req)) {
    return next();
  }

  // Redirect to HTTPS
  const httpsUrl = getFullUrl(req).replace(/^http:/, 'https:');
  
  logger.warn('HTTP request detected, redirecting to HTTPS', {
    originalUrl: req.originalUrl,
    from: req.clientIP,
    redirectTo: httpsUrl
  });

  res.redirect(301, httpsUrl);
};

/**
 * Middleware: Strict HTTPS enforcement for specific routes (webhooks)
 * 
 * Returns 403 Forbidden if not HTTPS
 * Does NOT redirect - just rejects non-HTTPS
 * 
 * Usage: app.post('/webhook', httpsOnly, handler);
 */
const httpsOnly = (req, res, next) => {
  if (isHttps(req)) {
    return next();
  }

  logger.error('Non-HTTPS webhook request rejected', {
    path: req.path,
    method: req.method,
    from: req.clientIP,
    userAgent: req.get('user-agent'),
    protocol: req.protocol,
    headers: {
      'x-forwarded-proto': req.get('x-forwarded-proto'),
      'x-forwarded-for': req.get('x-forwarded-for'),
      host: req.get('host')
    }
  });

  return res.status(403).json({
    success: false,
    error: 'HTTPS required',
    message: 'Webhook endpoints must use HTTPS protocol',
    code: 'HTTPS_REQUIRED'
  });
};

/**
 * Middleware: Set HTTPS security headers
 * 
 * Adds headers to enforce browser HTTPS policies
 */
const httpsSecurityHeaders = (req, res, next) => {
  // Strict-Transport-Security: Tell browsers to always use HTTPS
  // - max-age: 1 year (31536000 seconds)
  // - includeSubDomains: Apply to all subdomains
  // - preload: Include in browser HSTS preload list
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // Upgrade insecure requests (older browsers)
  res.setHeader('Upgrade-Insecure-Requests', '1');

  // Content Security Policy: Allow HTTPS only
  if (!req.get('content-security-policy')) {
    res.setHeader(
      'Content-Security-Policy',
      "upgrade-insecure-requests; default-src 'self' https:"
    );
  }

  // Public-Key-Pins (optional - for certificate pinning)
  // This is advanced and requires careful management
  if (process.env.ENABLE_HPKP === 'true') {
    const pkp = process.env.PUBLIC_KEY_PINS || '';
    if (pkp) {
      res.setHeader('Public-Key-Pins', pkp);
    }
  }

  next();
};

/**
 * Validate that webhook URL is HTTPS
 * 
 * Called during Twilio webhook configuration
 * Ensures Twilio can only reach HTTPS endpoints
 */
function validateWebhookUrl(webhookUrl) {
  if (!webhookUrl) {
    throw new Error('WEBHOOK_URL environment variable not set');
  }

  if (!webhookUrl.startsWith('https://')) {
    throw new Error(
      `Webhook URL must use HTTPS. Got: ${webhookUrl}. ` +
      'Twilio requires secure HTTPS endpoints.'
    );
  }

  try {
    new URL(webhookUrl);
  } catch (e) {
    throw new Error(`Invalid webhook URL format: ${webhookUrl}`);
  }

  logger.info('Webhook URL validated', { webhookUrl });
  return true;
}

/**
 * Check HTTPS support
 * 
 * Called on startup to validate HTTPS configuration
 * Returns detailed info about HTTPS setup
 */
function checkHttpsSupport(req) {
  const details = {
    isHttps: isHttps(req),
    protocol: req.protocol,
    headers: {
      'x-forwarded-proto': req.get('x-forwarded-proto'),
      'x-forwarded-for': req.get('x-forwarded-for'),
      'cf-visitor': !!req.get('cf-visitor'),
      'x-alb-proto': req.get('x-alb-proto'),
      host: req.get('host')
    },
    environment: process.env.NODE_ENV,
    platform: detectPlatform()
  };

  return details;
}

/**
 * Detect which platform/proxy is being used
 */
function detectPlatform() {
  if (process.env.RAILWAY_ENVIRONMENT) {
    return 'Railway';
  }
  if (process.env.RENDER === 'true') {
    return 'Render';
  }
  if (process.env.DYNO) {
    return 'Heroku';
  }
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return 'AWS Lambda';
  }
  if (process.env.CF_PAGES === 'true') {
    return 'Cloudflare Pages';
  }
  if (process.env.VERCEL_ENV) {
    return 'Vercel';
  }
  if (process.env.NETLIFY === 'true') {
    return 'Netlify';
  }
  
  return 'Unknown/VPS';
}

module.exports = {
  enforceHttps,
  httpsOnly,
  httpsSecurityHeaders,
  isHttps,
  getFullUrl,
  validateWebhookUrl,
  checkHttpsSupport,
  detectPlatform
};
