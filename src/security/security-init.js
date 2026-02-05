/**
 * Security Initialization
 * Sets up all security middleware and configurations
 */

const express = require('express');
const cors = require('cors');
const { securityConfig, validateSecurityConfig } = require('../config/security.config');
const { validateSecretsMiddleware } = require('../middleware/secrets-validation.middleware');
const { logger } = require('../infrastructure/logger');

// Import all security middleware
const {
  verifyTwilioSignature,
  verifyWebhookSignature,
  apiRateLimit,
  authRateLimit,
  webhookRateLimit,
  adminRateLimit,
  sanitizeInput,
  validateInput,
  authenticateAdmin,
  require2FA,
  adminIPAllowlist,
  securityHeaders
} = require('../middleware/security.middleware');

const { preventSQLInjection } = require('../middleware/sql-injection-prevention.middleware');

// =============================================================================
// SECURITY INITIALIZATION
// =============================================================================

/**
 * Initialize all security measures
 */
function initializeSecurity(app) {
  logger.info('Initializing security measures', {
    action: 'security_initialization_start',
    environment: process.env.NODE_ENV
  });

  // 1. Validate secrets on startup
  logger.info('Validating secrets and configuration', {
    action: 'secrets_validation_start'
  });
  
  const secretsValidation = validateSecretsMiddleware();
  app.use(secretsValidation);

  // 2. Validate security configuration
  const configValidation = validateSecurityConfig();
  if (!configValidation.valid) {
    logger.error('Security configuration validation failed', {
      action: 'security_config_invalid',
      errors: configValidation.errors
    });
    
    if (securityConfig.isProduction) {
      logger.error('Exiting due to invalid security configuration in production', {
        action: 'security_config_exit'
      });
      process.exit(1);
    }
  }

  // 3. Trust proxy settings (must be first)
  if (securityConfig.ipAllowlist.general.trustProxy) {
    app.set('trust proxy', securityConfig.ipAllowlist.general.proxyTrustHops);
    logger.info('Proxy trust configured', {
      action: 'proxy_trust_configured',
      hops: securityConfig.ipAllowlist.general.proxyTrustHops
    });
  }

  // 4. Security headers (helmet)
  app.use(securityHeaders);
  logger.info('Security headers configured', {
    action: 'security_headers_configured'
  });

  // 5. CORS configuration
  setupCORS(app);

  // 6. Body parsing with security limits
  setupBodyParsing(app);

  // 7. Client IP extraction middleware
  app.use(extractClientIP);

  // 8. Input sanitization (global)
  if (securityConfig.inputSanitization.enabled) {
    app.use(sanitizeInput);
    logger.info('Input sanitization enabled', {
      action: 'input_sanitization_enabled'
    });
  }

  // 9. SQL injection prevention (global)
  if (securityConfig.sqlInjection.enabled) {
    app.use(preventSQLInjection({
      strictMode: securityConfig.sqlInjection.strictMode,
      logOnly: securityConfig.sqlInjection.logOnly,
      maxStringLength: securityConfig.sqlInjection.maxStringLength
    }));
    logger.info('SQL injection prevention enabled', {
      action: 'sql_injection_prevention_enabled',
      strictMode: securityConfig.sqlInjection.strictMode
    });
  }

  // 10. Rate limiting setup
  setupRateLimiting(app);

  // 11. Security monitoring middleware
  app.use(securityMonitoringMiddleware);

  logger.info('Security initialization completed', {
    action: 'security_initialization_complete',
    features: {
      rateLimiting: securityConfig.rateLimiting.enabled,
      inputSanitization: securityConfig.inputSanitization.enabled,
      sqlInjectionPrevention: securityConfig.sqlInjection.enabled,
      ipAllowlist: securityConfig.ipAllowlist.admin.enabled,
      twoFactor: securityConfig.twoFactor.enabled,
      webhookVerification: securityConfig.webhook.twilio.verifySignature
    }
  });

  return app;
}

// =============================================================================
// CORS CONFIGURATION
// =============================================================================

function setupCORS(app) {
  const corsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean);
      
      // In development, allow all origins if none specified
      if (securityConfig.isDevelopment && allowedOrigins.length === 0) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS origin blocked', {
          action: 'cors_origin_blocked',
          origin,
          allowedOrigins: allowedOrigins.slice(0, 3) // Log first 3 for security
        });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-TOTP-Token',
      'X-Request-ID'
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ]
  };

  app.use(cors(corsOptions));
  
  logger.info('CORS configured', {
    action: 'cors_configured',
    allowedOrigins: (process.env.CORS_ORIGIN || '').split(',').length
  });
}

// =============================================================================
// BODY PARSING CONFIGURATION
// =============================================================================

function setupBodyParsing(app) {
  // JSON body parser with size limits
  app.use(express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
      // Store raw body for webhook signature verification
      req.rawBody = buf;
    }
  }));

  // URL-encoded body parser
  app.use(express.urlencoded({
    extended: true,
    limit: '1mb'
  }));

  logger.info('Body parsing configured with security limits', {
    action: 'body_parsing_configured',
    jsonLimit: '1mb',
    urlencodedLimit: '1mb'
  });
}

// =============================================================================
// CLIENT IP EXTRACTION
// =============================================================================

function extractClientIP(req, res, next) {
  let clientIP = req.ip;

  // Check various IP headers in order of preference
  const ipHeaders = securityConfig.ipAllowlist.general.ipHeaders;
  
  for (const header of ipHeaders) {
    const headerValue = req.headers[header.toLowerCase()];
    if (headerValue) {
      // Handle comma-separated IPs (take the first one)
      const ips = headerValue.split(',').map(ip => ip.trim());
      if (ips[0] && ips[0] !== 'unknown') {
        clientIP = ips[0];
        break;
      }
    }
  }

  // Validate IP format
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  if (!ipv4Regex.test(clientIP) && !ipv6Regex.test(clientIP) && clientIP !== '::1') {
    logger.warn('Invalid client IP detected', {
      action: 'invalid_client_ip',
      clientIP,
      headers: req.headers
    });
    clientIP = req.ip; // Fallback to Express IP
  }

  req.clientIP = clientIP;
  next();
}

// =============================================================================
// RATE LIMITING SETUP
// =============================================================================

function setupRateLimiting(app) {
  if (!securityConfig.rateLimiting.enabled) {
    logger.info('Rate limiting disabled', {
      action: 'rate_limiting_disabled'
    });
    return;
  }

  // General API rate limiting
  app.use('/api/', apiRateLimit);

  // Authentication rate limiting
  app.use('/api/v1/auth/', authRateLimit);

  // Admin rate limiting
  app.use('/api/v1/admin/', adminRateLimit);

  // Webhook rate limiting
  app.use('/api/v1/whatsapp/webhook', webhookRateLimit);

  logger.info('Rate limiting configured', {
    action: 'rate_limiting_configured',
    limits: {
      api: securityConfig.rateLimiting.api.max,
      auth: securityConfig.rateLimiting.auth.max,
      admin: securityConfig.rateLimiting.admin.max,
      webhook: securityConfig.rateLimiting.webhook.max
    }
  });
}

// =============================================================================
// SECURITY MONITORING MIDDLEWARE
// =============================================================================

function securityMonitoringMiddleware(req, res, next) {
  if (!securityConfig.monitoring.enabled) {
    return next();
  }

  // Add security context to request
  req.securityContext = {
    timestamp: Date.now(),
    clientIP: req.clientIP || req.ip,
    userAgent: req.get('User-Agent'),
    path: req.path,
    method: req.method,
    suspicious: false,
    riskLevel: 'low'
  };

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//g,                    // Path traversal
    /<script/gi,                  // XSS attempts
    /union.*select/gi,            // SQL injection
    /exec\s*\(/gi,               // Command injection
    /eval\s*\(/gi,               // Code injection
    /javascript:/gi,              // JavaScript protocol
    /vbscript:/gi,               // VBScript protocol
    /data:text\/html/gi          // Data URI XSS
  ];

  const requestString = JSON.stringify({
    url: req.url,
    body: req.body,
    query: req.query,
    headers: req.headers
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      req.securityContext.suspicious = true;
      req.securityContext.riskLevel = 'high';
      
      logger.warn('Suspicious request pattern detected', {
        action: 'suspicious_pattern_detected',
        pattern: pattern.toString(),
        clientIP: req.clientIP,
        path: req.path,
        userAgent: req.get('User-Agent')
      });
      break;
    }
  }

  next();
}

// =============================================================================
// ROUTE-SPECIFIC SECURITY SETUP
// =============================================================================

/**
 * Setup security for webhook routes
 */
function setupWebhookSecurity(router) {
  // Twilio webhook signature verification
  if (securityConfig.webhook.twilio.verifySignature) {
    router.use('/whatsapp/webhook', verifyTwilioSignature);
    logger.info('Twilio webhook signature verification enabled', {
      action: 'twilio_webhook_security_enabled'
    });
  }

  // Webhook IP allowlist
  if (securityConfig.ipAllowlist.webhook.enabled) {
    router.use('/whatsapp/webhook', (req, res, next) => {
      const clientIP = req.clientIP || req.ip;
      const allowedIPs = securityConfig.ipAllowlist.webhook.allowedIPs;
      
      const isAllowed = allowedIPs.some(allowedIP => {
        if (allowedIP.includes('/')) {
          return isIPInCIDR(clientIP, allowedIP);
        } else {
          return clientIP === allowedIP;
        }
      });

      if (!isAllowed) {
        logger.warn('Webhook IP not in allowlist', {
          action: 'webhook_ip_denied',
          clientIP,
          path: req.path
        });
        return res.status(403).json({
          success: false,
          error: 'Access denied from this IP address',
          code: 'IP_NOT_ALLOWED'
        });
      }

      next();
    });
    
    logger.info('Webhook IP allowlist enabled', {
      action: 'webhook_ip_allowlist_enabled',
      allowedIPs: securityConfig.ipAllowlist.webhook.allowedIPs.length
    });
  }

  return router;
}

/**
 * Setup security for admin routes
 */
function setupAdminSecurity(router) {
  // Admin IP allowlist
  if (securityConfig.ipAllowlist.admin.enabled) {
    router.use(adminIPAllowlist);
    logger.info('Admin IP allowlist enabled', {
      action: 'admin_ip_allowlist_enabled',
      allowedIPs: securityConfig.ipAllowlist.admin.allowedIPs.length
    });
  }

  // Admin authentication
  router.use(authenticateAdmin);

  // 2FA for critical admin actions
  if (securityConfig.twoFactor.enabled && securityConfig.twoFactor.enforcement.requireForCriticalActions) {
    router.use('/critical/*', require2FA);
    router.use('/users/*', require2FA);
    router.use('/system/*', require2FA);
    
    logger.info('2FA enabled for critical admin actions', {
      action: '2fa_critical_actions_enabled'
    });
  }

  return router;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if IP is in CIDR range
 */
function isIPInCIDR(ip, cidr) {
  try {
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - bits) - 1);
    return (ip2int(ip) & mask) === (ip2int(range) & mask);
  } catch (error) {
    logger.error('CIDR check error', {
      action: 'cidr_check_error',
      error: error.message,
      ip,
      cidr
    });
    return false;
  }
}

function ip2int(ip) {
  return ip.split('.').reduce((int, oct) => (int << 8) + parseInt(oct, 10), 0) >>> 0;
}

// =============================================================================
// SECURITY HEALTH CHECK
// =============================================================================

/**
 * Get security health status
 */
function getSecurityHealth() {
  return {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    features: {
      rateLimiting: {
        enabled: securityConfig.rateLimiting.enabled,
        status: 'active'
      },
      inputSanitization: {
        enabled: securityConfig.inputSanitization.enabled,
        status: 'active'
      },
      sqlInjectionPrevention: {
        enabled: securityConfig.sqlInjection.enabled,
        strictMode: securityConfig.sqlInjection.strictMode,
        status: 'active'
      },
      webhookSecurity: {
        signatureVerification: securityConfig.webhook.twilio.verifySignature,
        ipAllowlist: securityConfig.ipAllowlist.webhook.enabled,
        status: 'active'
      },
      adminSecurity: {
        ipAllowlist: securityConfig.ipAllowlist.admin.enabled,
        twoFactor: securityConfig.twoFactor.enabled,
        status: 'active'
      },
      monitoring: {
        enabled: securityConfig.monitoring.enabled,
        status: 'active'
      }
    },
    environment: process.env.NODE_ENV,
    lastValidated: new Date().toISOString()
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  initializeSecurity,
  setupWebhookSecurity,
  setupAdminSecurity,
  getSecurityHealth,
  extractClientIP,
  securityMonitoringMiddleware
};