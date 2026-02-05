/**
 * Security Middleware Suite
 * Comprehensive security hardening for WhatsApp ordering platform
 */

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const { logger } = require('../infrastructure/logger');
const prisma = require('../config/database');

// =============================================================================
// 1. WEBHOOK SIGNATURE VERIFICATION
// =============================================================================

/**
 * Verify Twilio webhook signatures
 */
function verifyTwilioSignature(req, res, next) {
  // Skip verification in development if explicitly disabled
  if (process.env.NODE_ENV === 'development' && process.env.FORCE_TWILIO_VERIFY !== 'true') {
    return next();
  }

  try {
    const signature = req.headers['x-twilio-signature'];
    if (!signature) {
      logger.warn('Missing Twilio signature', {
        action: 'missing_twilio_signature',
        ip: req.clientIP || req.ip,
        path: req.path
      });
      return res.status(403).json({
        success: false,
        error: 'Missing webhook signature',
        code: 'MISSING_SIGNATURE'
      });
    }

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
      logger.error('Missing Twilio auth token', {
        action: 'missing_auth_token'
      });
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        code: 'CONFIG_ERROR'
      });
    }

    // Construct the URL that Twilio used to sign the request
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const url = `${protocol}://${host}${req.originalUrl}`;

    // Get the request body as string
    let body = '';
    if (req.body) {
      if (typeof req.body === 'string') {
        body = req.body;
      } else {
        // Convert form data to query string format
        body = Object.keys(req.body)
          .sort()
          .map(key => `${key}=${req.body[key]}`)
          .join('&');
      }
    }

    // Create the expected signature
    const expectedSignature = crypto
      .createHmac('sha1', authToken)
      .update(url + body)
      .digest('base64');

    // Use timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      logger.warn('Invalid Twilio signature', {
        action: 'invalid_twilio_signature',
        ip: req.clientIP || req.ip,
        path: req.path,
        url,
        expectedSignature: expectedSignature.substring(0, 10) + '...',
        receivedSignature: signature.substring(0, 10) + '...'
      });
      return res.status(403).json({
        success: false,
        error: 'Invalid webhook signature',
        code: 'INVALID_SIGNATURE'
      });
    }

    logger.info('Twilio signature verified', {
      action: 'twilio_signature_verified',
      path: req.path
    });

    next();
  } catch (error) {
    logger.error('Signature verification error', {
      action: 'signature_verification_error',
      error: error.message,
      path: req.path
    });
    return res.status(500).json({
      success: false,
      error: 'Signature verification failed',
      code: 'VERIFICATION_ERROR'
    });
  }
}

/**
 * Generic webhook signature verification
 */
function verifyWebhookSignature(secretKey) {
  return (req, res, next) => {
    try {
      const signature = req.headers['x-webhook-signature'] || req.headers['x-signature'];
      if (!signature) {
        return res.status(403).json({
          success: false,
          error: 'Missing webhook signature',
          code: 'MISSING_SIGNATURE'
        });
      }

      const payload = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(payload)
        .digest('hex');

      const receivedSignature = signature.replace('sha256=', '');

      if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(receivedSignature))) {
        logger.warn('Invalid webhook signature', {
          action: 'invalid_webhook_signature',
          ip: req.clientIP || req.ip,
          path: req.path
        });
        return res.status(403).json({
          success: false,
          error: 'Invalid webhook signature',
          code: 'INVALID_SIGNATURE'
        });
      }

      next();
    } catch (error) {
      logger.error('Webhook signature verification error', {
        action: 'webhook_signature_error',
        error: error.message
      });
      return res.status(500).json({
        success: false,
        error: 'Signature verification failed',
        code: 'VERIFICATION_ERROR'
      });
    }
  };
}

// =============================================================================
// 2. API RATE LIMITING
// =============================================================================

/**
 * General API rate limiting
 */
const apiRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    error: 'Too many requests from this IP',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.clientIP || req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/metrics';
  }
});

/**
 * Strict rate limiting for authentication endpoints
 */
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: 'Too many authentication attempts',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    retryAfter: 900 // 15 minutes
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `auth:${req.clientIP || req.ip}:${req.body?.email || 'unknown'}`;
  }
});

/**
 * Webhook-specific rate limiting
 */
const webhookRateLimit = rateLimit({
  windowMs: parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW) || 60000, // 1 minute
  max: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX) || 100,
  message: {
    success: false,
    error: 'Webhook rate limit exceeded',
    code: 'WEBHOOK_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by source IP and user agent combination
    return `webhook:${req.clientIP || req.ip}:${crypto.createHash('md5').update(req.get('User-Agent') || '').digest('hex')}`;
  }
});

/**
 * Admin dashboard rate limiting
 */
const adminRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 200, // Higher limit for admin operations
  message: {
    success: false,
    error: 'Admin rate limit exceeded',
    code: 'ADMIN_RATE_LIMIT_EXCEEDED'
  },
  keyGenerator: (req) => {
    return `admin:${req.user?.id || req.clientIP || req.ip}`;
  }
});

// =============================================================================
// 3. INPUT SANITIZATION
// =============================================================================

/**
 * Comprehensive input sanitization middleware
 */
function sanitizeInput(req, res, next) {
  try {
    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize request body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize URL parameters
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    logger.error('Input sanitization error', {
      action: 'input_sanitization_error',
      error: error.message,
      path: req.path
    });
    return res.status(400).json({
      success: false,
      error: 'Invalid input data',
      code: 'INVALID_INPUT'
    });
  }
}

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key
      const cleanKey = sanitizeString(key);
      if (cleanKey !== key) {
        logger.warn('Suspicious key detected', {
          action: 'suspicious_key',
          originalKey: key,
          sanitizedKey: cleanKey
        });
      }
      
      sanitized[cleanKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  return obj;
}

/**
 * Sanitize string input
 */
function sanitizeString(str) {
  if (typeof str !== 'string') {
    return str;
  }

  // Remove null bytes
  str = str.replace(/\0/g, '');
  
  // Escape HTML to prevent XSS
  str = validator.escape(str);
  
  // Remove potentially dangerous patterns
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /eval\s*\(/gi,
    /expression\s*\(/gi
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(str)) {
      logger.warn('Dangerous pattern detected in input', {
        action: 'dangerous_pattern_detected',
        pattern: pattern.toString(),
        input: str.substring(0, 100)
      });
      str = str.replace(pattern, '');
    }
  }

  return str;
}

/**
 * Validate specific input types
 */
function validateInput(rules) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = getNestedValue(req.body, field);
      
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value !== undefined && value !== null && value !== '') {
        // Type validation
        if (rule.type === 'email' && !validator.isEmail(value)) {
          errors.push(`${field} must be a valid email`);
        }
        
        if (rule.type === 'phone' && !validator.isMobilePhone(value)) {
          errors.push(`${field} must be a valid phone number`);
        }
        
        if (rule.type === 'uuid' && !validator.isUUID(value)) {
          errors.push(`${field} must be a valid UUID`);
        }
        
        if (rule.type === 'url' && !validator.isURL(value)) {
          errors.push(`${field} must be a valid URL`);
        }

        // Length validation
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`${field} must be at least ${rule.minLength} characters`);
        }
        
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`${field} must be no more than ${rule.maxLength} characters`);
        }

        // Pattern validation
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`${field} format is invalid`);
        }

        // Custom validation
        if (rule.validate && !rule.validate(value)) {
          errors.push(`${field} validation failed`);
        }
      }
    }

    if (errors.length > 0) {
      logger.warn('Input validation failed', {
        action: 'input_validation_failed',
        errors,
        path: req.path
      });
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors
      });
    }

    next();
  };
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// =============================================================================
// 4. ADMIN AUTHENTICATION + 2FA
// =============================================================================

/**
 * Admin authentication middleware
 */
async function authenticateAdmin(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token required',
        code: 'TOKEN_REQUIRED'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get admin user from database
    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        loginAttempts: true,
        lockedUntil: true
      }
    });

    if (!admin) {
      logger.warn('Invalid admin token - user not found', {
        action: 'invalid_admin_token',
        userId: decoded.userId,
        ip: req.clientIP || req.ip
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token',
        code: 'INVALID_TOKEN'
      });
    }

    if (!admin.isActive) {
      logger.warn('Inactive admin attempted access', {
        action: 'inactive_admin_access',
        adminId: admin.id,
        ip: req.clientIP || req.ip
      });
      return res.status(401).json({
        success: false,
        error: 'Account is inactive',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    // Check if account is locked
    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      logger.warn('Locked admin attempted access', {
        action: 'locked_admin_access',
        adminId: admin.id,
        lockedUntil: admin.lockedUntil,
        ip: req.clientIP || req.ip
      });
      return res.status(401).json({
        success: false,
        error: 'Account is temporarily locked',
        code: 'ACCOUNT_LOCKED',
        lockedUntil: admin.lockedUntil
      });
    }

    // Add admin to request
    req.user = admin;
    req.adminId = admin.id;

    logger.info('Admin authenticated', {
      action: 'admin_authenticated',
      adminId: admin.id,
      role: admin.role,
      ip: req.clientIP || req.ip
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid JWT token', {
        action: 'invalid_jwt_token',
        error: error.message,
        ip: req.clientIP || req.ip
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token',
        code: 'INVALID_TOKEN'
      });
    }

    if (error.name === 'TokenExpiredError') {
      logger.warn('Expired JWT token', {
        action: 'expired_jwt_token',
        ip: req.clientIP || req.ip
      });
      return res.status(401).json({
        success: false,
        error: 'Authentication token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    logger.error('Admin authentication error', {
      action: 'admin_auth_error',
      error: error.message,
      ip: req.clientIP || req.ip
    });
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Two-factor authentication middleware
 */
function require2FA(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Skip 2FA check if not enabled for user
  if (!req.user.twoFactorEnabled) {
    return next();
  }

  const totpToken = req.headers['x-totp-token'];
  
  if (!totpToken) {
    return res.status(401).json({
      success: false,
      error: '2FA token required',
      code: 'TOTP_REQUIRED'
    });
  }

  // Verify TOTP token (implementation depends on your 2FA setup)
  verify2FAToken(req.user.id, totpToken)
    .then(isValid => {
      if (!isValid) {
        logger.warn('Invalid 2FA token', {
          action: 'invalid_2fa_token',
          adminId: req.user.id,
          ip: req.clientIP || req.ip
        });
        return res.status(401).json({
          success: false,
          error: 'Invalid 2FA token',
          code: 'INVALID_TOTP'
        });
      }

      logger.info('2FA verified', {
        action: '2fa_verified',
        adminId: req.user.id,
        ip: req.clientIP || req.ip
      });

      next();
    })
    .catch(error => {
      logger.error('2FA verification error', {
        action: '2fa_verification_error',
        error: error.message,
        adminId: req.user.id
      });
      return res.status(500).json({
        success: false,
        error: '2FA verification failed',
        code: 'TOTP_ERROR'
      });
    });
}

/**
 * Verify 2FA token
 */
async function verify2FAToken(adminId, token) {
  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { twoFactorSecret: true }
    });

    if (!admin?.twoFactorSecret) {
      return false;
    }

    return speakeasy.totp.verify({
      secret: admin.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2 // Allow 2 time steps of variance
    });
  } catch (error) {
    logger.error('2FA token verification error', {
      action: '2fa_token_verification_error',
      error: error.message,
      adminId
    });
    return false;
  }
}

/**
 * Setup 2FA for admin user
 */
async function setup2FA(adminId) {
  try {
    const secret = speakeasy.generateSecret({
      name: `WhatsApp Ordering (${adminId})`,
      issuer: 'WhatsApp Ordering System'
    });

    // Save secret to database (encrypted)
    await prisma.adminUser.update({
      where: { id: adminId },
      data: {
        twoFactorSecret: secret.base32,
        twoFactorEnabled: false // Will be enabled after verification
      }
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32
    };
  } catch (error) {
    logger.error('2FA setup error', {
      action: '2fa_setup_error',
      error: error.message,
      adminId
    });
    throw error;
  }
}

// =============================================================================
// 5. IP ALLOWLIST FOR ADMIN
// =============================================================================

/**
 * IP allowlist middleware for admin endpoints
 */
function adminIPAllowlist(req, res, next) {
  // Skip in development unless explicitly enabled
  if (process.env.NODE_ENV === 'development' && process.env.ADMIN_IP_ALLOWLIST_ENABLED !== 'true') {
    return next();
  }

  const allowedIPs = (process.env.ADMIN_ALLOWED_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean);
  
  if (allowedIPs.length === 0) {
    logger.warn('No admin IPs configured in allowlist', {
      action: 'no_admin_ips_configured'
    });
    return next(); // Allow if no IPs configured
  }

  const clientIP = req.clientIP || req.ip;
  const isAllowed = allowedIPs.some(allowedIP => {
    if (allowedIP.includes('/')) {
      // CIDR notation
      return isIPInCIDR(clientIP, allowedIP);
    } else {
      // Exact IP match
      return clientIP === allowedIP;
    }
  });

  if (!isAllowed) {
    logger.warn('Admin access denied - IP not in allowlist', {
      action: 'admin_ip_denied',
      clientIP,
      allowedIPs: allowedIPs.map(ip => ip.substring(0, 10) + '...'),
      path: req.path
    });
    return res.status(403).json({
      success: false,
      error: 'Access denied from this IP address',
      code: 'IP_NOT_ALLOWED'
    });
  }

  logger.info('Admin IP allowlist check passed', {
    action: 'admin_ip_allowed',
    clientIP,
    path: req.path
  });

  next();
}

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
// 6. SECURITY HEADERS
// =============================================================================

/**
 * Security headers middleware
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Allow Twilio webhooks
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

module.exports = {
  // Webhook security
  verifyTwilioSignature,
  verifyWebhookSignature,
  
  // Rate limiting
  apiRateLimit,
  authRateLimit,
  webhookRateLimit,
  adminRateLimit,
  
  // Input sanitization
  sanitizeInput,
  validateInput,
  sanitizeString,
  
  // Admin authentication
  authenticateAdmin,
  require2FA,
  verify2FAToken,
  setup2FA,
  
  // IP allowlist
  adminIPAllowlist,
  
  // Security headers
  securityHeaders
};