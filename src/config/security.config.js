/**
 * Security Configuration
 * Central configuration for all security middleware and settings
 */

const { logger } = require('../infrastructure/logger');

// =============================================================================
// SECURITY CONFIGURATION
// =============================================================================

const securityConfig = {
  // Environment
  environment: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    algorithm: 'HS256',
    issuer: 'whatsapp-ordering-system',
    audience: 'whatsapp-ordering-api'
  },

  // Rate Limiting Configuration
  rateLimiting: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    
    // General API rate limiting
    api: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
      skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
      standardHeaders: true,
      legacyHeaders: false
    },

    // Authentication rate limiting (stricter)
    auth: {
      windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
      max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 5,
      message: 'Too many attempts. Please try again later.',
      skipSuccessfulRequests: false,
      standardHeaders: true,
      legacyHeaders: false
    },

    // Admin dashboard rate limiting
    admin: {
      windowMs: parseInt(process.env.ADMIN_RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000,
      max: parseInt(process.env.ADMIN_RATE_LIMIT_MAX_REQUESTS) || 200,
      skipSuccessfulRequests: true,
      standardHeaders: true,
      legacyHeaders: false
    },

    // Webhook rate limiting
    webhook: {
      windowMs: parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW) || 60 * 1000,
      max: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX) || 100,
      skipSuccessfulRequests: process.env.WEBHOOK_RATE_LIMIT_SKIP_SUCCESS === 'true',
      standardHeaders: true,
      legacyHeaders: false
    }
  },

  // Input Sanitization Configuration
  inputSanitization: {
    enabled: process.env.INPUT_SANITIZATION_ENABLED !== 'false',
    maxStringLength: parseInt(process.env.INPUT_MAX_STRING_LENGTH) || 10000,
    maxArrayLength: parseInt(process.env.INPUT_MAX_ARRAY_LENGTH) || 1000,
    maxObjectDepth: parseInt(process.env.INPUT_MAX_OBJECT_DEPTH) || 10,
    
    xssProtection: {
      enabled: process.env.XSS_PROTECTION_ENABLED !== 'false',
      mode: process.env.XSS_FILTER_MODE || 'strict' // strict, moderate, permissive
    },
    
    htmlSanitization: {
      enabled: process.env.HTML_SANITIZATION_ENABLED !== 'false',
      allowedTags: (process.env.ALLOWED_HTML_TAGS || 'b,i,em,strong,p,br').split(',')
    }
  },

  // Validation Configuration
  validation: {
    strictMode: process.env.VALIDATION_STRICT_MODE === 'true',
    failFast: process.env.VALIDATION_FAIL_FAST !== 'false',
    logFailures: process.env.VALIDATION_LOG_FAILURES !== 'false',
    
    email: {
      strict: process.env.EMAIL_VALIDATION_STRICT !== 'false'
    },
    
    phone: {
      strict: process.env.PHONE_VALIDATION_STRICT !== 'false'
    },
    
    url: {
      requireHttps: process.env.URL_VALIDATION_REQUIRE_HTTPS === 'true'
    }
  },

  // Admin Authentication Configuration
  admin: {
    session: {
      timeout: parseInt(process.env.ADMIN_SESSION_TIMEOUT) || 60 * 60 * 1000, // 1 hour
      absoluteTimeout: parseInt(process.env.ADMIN_SESSION_ABSOLUTE_TIMEOUT) || 8 * 60 * 60 * 1000, // 8 hours
      maxConcurrentSessions: parseInt(process.env.ADMIN_CONCURRENT_SESSIONS) || 3
    },
    
    lockout: {
      maxAttempts: parseInt(process.env.ADMIN_MAX_LOGIN_ATTEMPTS) || 5,
      duration: parseInt(process.env.ADMIN_LOCKOUT_DURATION) || 30 * 60 * 1000, // 30 minutes
      increment: process.env.ADMIN_LOCKOUT_INCREMENT === 'true'
    },
    
    password: {
      minLength: parseInt(process.env.ADMIN_PASSWORD_MIN_LENGTH) || 12,
      requireUppercase: process.env.ADMIN_PASSWORD_REQUIRE_UPPERCASE !== 'false',
      requireLowercase: process.env.ADMIN_PASSWORD_REQUIRE_LOWERCASE !== 'false',
      requireNumbers: process.env.ADMIN_PASSWORD_REQUIRE_NUMBERS !== 'false',
      requireSymbols: process.env.ADMIN_PASSWORD_REQUIRE_SYMBOLS !== 'false',
      history: parseInt(process.env.ADMIN_PASSWORD_HISTORY) || 5
    }
  },

  // Two-Factor Authentication Configuration
  twoFactor: {
    enabled: process.env.TOTP_ENABLED === 'true',
    issuer: process.env.TOTP_ISSUER || 'WhatsApp Ordering System',
    window: parseInt(process.env.TOTP_WINDOW) || 2,
    step: parseInt(process.env.TOTP_STEP) || 30,
    
    enforcement: {
      requireForAdmins: process.env.REQUIRE_2FA_FOR_ADMINS === 'true',
      requireForCriticalActions: process.env.REQUIRE_2FA_FOR_CRITICAL_ACTIONS === 'true',
      gracePeriod: parseInt(process.env.TOTP_GRACE_PERIOD) || 24 * 60 * 60 * 1000 // 24 hours
    },
    
    backupCodes: {
      count: parseInt(process.env.TOTP_BACKUP_CODES_COUNT) || 10
    }
  },

  // IP Allowlist Configuration
  ipAllowlist: {
    admin: {
      enabled: process.env.ADMIN_IP_ALLOWLIST_ENABLED === 'true',
      allowedIPs: (process.env.ADMIN_ALLOWED_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean),
      strictMode: process.env.ADMIN_IP_STRICT_MODE === 'true',
      logViolations: process.env.ADMIN_IP_LOG_VIOLATIONS !== 'false'
    },
    
    webhook: {
      enabled: process.env.WEBHOOK_IP_ALLOWLIST_ENABLED === 'true',
      allowedIPs: (process.env.WEBHOOK_ALLOWED_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean),
      strictMode: process.env.WEBHOOK_IP_STRICT_MODE === 'true'
    },
    
    general: {
      trustProxy: process.env.TRUST_PROXY === 'true',
      proxyTrustHops: parseInt(process.env.PROXY_TRUST_HOPS) || 1,
      ipHeaders: (process.env.IP_HEADERS || 'x-forwarded-for,x-real-ip,x-client-ip').split(','),
      
      geolocation: {
        blockCountries: (process.env.BLOCK_COUNTRIES || '').split(',').map(c => c.trim()).filter(Boolean),
        allowCountriesOnly: process.env.ALLOW_COUNTRIES_ONLY === 'true',
        allowedCountries: (process.env.ALLOWED_COUNTRIES || '').split(',').map(c => c.trim()).filter(Boolean)
      }
    }
  },

  // SQL Injection Prevention Configuration
  sqlInjection: {
    enabled: process.env.SQL_INJECTION_PREVENTION_ENABLED !== 'false',
    strictMode: process.env.SQL_INJECTION_STRICT_MODE === 'true',
    logOnly: process.env.SQL_INJECTION_LOG_ONLY === 'true',
    sensitivity: process.env.SQL_INJECTION_SENSITIVITY || 'high', // low, medium, high
    maxStringLength: parseInt(process.env.SQL_INJECTION_MAX_STRING_LENGTH) || 10000,
    
    response: {
      blockRequest: process.env.SQL_INJECTION_BLOCK_RESPONSE !== 'false',
      sanitizeInput: process.env.SQL_INJECTION_SANITIZE_INPUT === 'true'
    },
    
    database: {
      requireParameterized: process.env.REQUIRE_PARAMETERIZED_QUERIES === 'true',
      logNonParameterized: process.env.LOG_NON_PARAMETERIZED_QUERIES === 'true',
      queryTimeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT) || 30000,
      slowQueryThreshold: parseInt(process.env.DATABASE_SLOW_QUERY_THRESHOLD) || 5000
    }
  },

  // Webhook Security Configuration
  webhook: {
    twilio: {
      verifySignature: process.env.WEBHOOK_SIGNATURE_VERIFICATION === 'true',
      forceVerify: process.env.FORCE_TWILIO_VERIFY === 'true',
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      timeout: parseInt(process.env.WEBHOOK_TIMEOUT) || 5000,
      maxPayloadSize: parseInt(process.env.WEBHOOK_MAX_PAYLOAD_SIZE) || 1024 * 1024 // 1MB
    },
    
    generic: {
      secretKey: process.env.WEBHOOK_SECRET_KEY,
      maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY) || 2000,
      retryBackoff: process.env.WEBHOOK_RETRY_BACKOFF || 'exponential'
    }
  },

  // Encryption Configuration
  encryption: {
    key: process.env.ENCRYPTION_KEY,
    algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
    ivLength: parseInt(process.env.ENCRYPTION_IV_LENGTH) || 16,
    
    password: {
      algorithm: process.env.PASSWORD_HASH_ALGORITHM || 'bcrypt',
      rounds: parseInt(process.env.PASSWORD_HASH_ROUNDS) || 12
    },
    
    data: {
      encryptPII: process.env.ENCRYPT_PII === 'true',
      encryptFinancial: process.env.ENCRYPT_FINANCIAL_DATA === 'true'
    }
  },

  // HTTPS/TLS Configuration
  https: {
    force: process.env.FORCE_HTTPS === 'true',
    port: parseInt(process.env.HTTPS_PORT) || 443,
    redirectHttp: process.env.HTTP_REDIRECT_TO_HTTPS === 'true',
    
    hsts: {
      enabled: process.env.HSTS_ENABLED === 'true',
      maxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000, // 1 year
      includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS === 'true',
      preload: process.env.HSTS_PRELOAD === 'true'
    },
    
    tls: {
      minVersion: process.env.TLS_MIN_VERSION || '1.2',
      ciphers: process.env.TLS_CIPHERS,
      preferServerCiphers: process.env.TLS_PREFER_SERVER_CIPHERS === 'true'
    },
    
    certificates: {
      cert: process.env.SSL_CERT_PATH,
      key: process.env.SSL_KEY_PATH,
      ca: process.env.SSL_CA_PATH
    }
  },

  // Security Monitoring Configuration
  monitoring: {
    enabled: process.env.SECURITY_MONITORING_ENABLED === 'true',
    
    thresholds: {
      high: parseInt(process.env.SECURITY_ALERT_THRESHOLD_HIGH) || 10,
      medium: parseInt(process.env.SECURITY_ALERT_THRESHOLD_MEDIUM) || 50
    },
    
    authentication: {
      failureThreshold: parseInt(process.env.AUTH_FAILURE_THRESHOLD) || 20,
      ipFailureThreshold: parseInt(process.env.AUTH_FAILURE_IP_THRESHOLD) || 10
    },
    
    suspicious: {
      enabled: process.env.SUSPICIOUS_ACTIVITY_DETECTION === 'true',
      threshold: parseInt(process.env.SUSPICIOUS_ACTIVITY_THRESHOLD) || 100
    }
  },

  // Logging Configuration
  logging: {
    security: {
      enabled: process.env.SECURITY_LOGGING_ENABLED !== 'false',
      level: process.env.SECURITY_LOG_LEVEL || 'info',
      format: process.env.SECURITY_LOG_FORMAT || 'json',
      file: process.env.SECURITY_LOG_FILE || 'logs/security.log',
      maxSize: process.env.SECURITY_LOG_MAX_SIZE || '100m',
      maxFiles: process.env.SECURITY_LOG_MAX_FILES || '30',
      rotateDaily: process.env.SECURITY_LOG_ROTATE_DAILY !== 'false'
    },
    
    audit: {
      enabled: process.env.AUDIT_LOGGING_ENABLED === 'true',
      logAllRequests: process.env.AUDIT_LOG_ALL_REQUESTS === 'true',
      logAdminActions: process.env.AUDIT_LOG_ADMIN_ACTIONS !== 'false',
      logSensitiveData: process.env.AUDIT_LOG_SENSITIVE_DATA === 'true'
    }
  },

  // Alerting Configuration
  alerting: {
    enabled: process.env.SECURITY_MONITORING_ENABLED === 'true',
    
    cooldown: {
      critical: parseInt(process.env.ALERT_COOLDOWN_CRITICAL) || 5 * 60 * 1000, // 5 minutes
      high: parseInt(process.env.ALERT_COOLDOWN_HIGH) || 15 * 60 * 1000, // 15 minutes
      medium: parseInt(process.env.ALERT_COOLDOWN_MEDIUM) || 60 * 60 * 1000 // 1 hour
    },
    
    thresholds: {
      sqlInjection: parseInt(process.env.ALERT_SQL_INJECTION_THRESHOLD) || 5,
      xss: parseInt(process.env.ALERT_XSS_THRESHOLD) || 10,
      rateLimit: parseInt(process.env.ALERT_RATE_LIMIT_THRESHOLD) || 100,
      authFailure: parseInt(process.env.ALERT_AUTH_FAILURE_THRESHOLD) || 50,
      permissionDenied: parseInt(process.env.ALERT_PERMISSION_DENIED_THRESHOLD) || 100
    },
    
    channels: {
      email: {
        enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
        from: process.env.ALERT_EMAIL_FROM,
        to: (process.env.ALERT_EMAIL_TO || '').split(',').map(e => e.trim()).filter(Boolean),
        smtp: {
          host: process.env.ALERT_EMAIL_SMTP_HOST,
          port: parseInt(process.env.ALERT_EMAIL_SMTP_PORT) || 587,
          user: process.env.ALERT_EMAIL_SMTP_USER,
          pass: process.env.ALERT_EMAIL_SMTP_PASS
        }
      },
      
      slack: {
        enabled: process.env.ALERT_SLACK_ENABLED === 'true',
        webhook: process.env.ALERT_SLACK_WEBHOOK,
        channel: process.env.ALERT_SLACK_CHANNEL || '#security-alerts',
        username: process.env.ALERT_SLACK_USERNAME || 'SecurityBot'
      },
      
      webhook: {
        enabled: process.env.ALERT_WEBHOOK_ENABLED === 'true',
        url: process.env.ALERT_WEBHOOK_URL,
        secret: process.env.ALERT_WEBHOOK_SECRET
      },
      
      pagerduty: {
        enabled: process.env.ALERT_PAGERDUTY_ENABLED === 'true',
        integrationKey: process.env.ALERT_PAGERDUTY_INTEGRATION_KEY
      }
    }
  },

  // Secrets Management Configuration
  secrets: {
    validation: {
      onStartup: process.env.VALIDATE_SECRETS_ON_STARTUP !== 'false',
      strict: process.env.SECRETS_VALIDATION_STRICT === 'true'
    },
    
    rotation: {
      enabled: process.env.SECRET_ROTATION_ENABLED === 'true',
      interval: parseInt(process.env.SECRET_ROTATION_INTERVAL) || 30 * 24 * 60 * 60 * 1000, // 30 days
      warningDays: parseInt(process.env.SECRET_ROTATION_WARNING_DAYS) || 7
    },
    
    external: {
      enabled: process.env.USE_EXTERNAL_SECRETS === 'true',
      provider: process.env.SECRETS_PROVIDER,
      region: process.env.SECRETS_REGION
    }
  }
};

// =============================================================================
// CONFIGURATION VALIDATION
// =============================================================================

/**
 * Validate security configuration
 */
function validateSecurityConfig() {
  const errors = [];
  const warnings = [];

  // Validate JWT secret
  if (!securityConfig.jwt.secret) {
    errors.push('JWT_SECRET is required');
  } else if (securityConfig.jwt.secret.length < 32) {
    warnings.push('JWT_SECRET should be at least 32 characters long');
  }

  // Validate Twilio configuration if webhook verification is enabled
  if (securityConfig.webhook.twilio.verifySignature) {
    if (!securityConfig.webhook.twilio.accountSid) {
      errors.push('TWILIO_ACCOUNT_SID is required when webhook verification is enabled');
    }
    if (!securityConfig.webhook.twilio.authToken) {
      errors.push('TWILIO_AUTH_TOKEN is required when webhook verification is enabled');
    }
  }

  // Validate encryption key
  if (securityConfig.encryption.data.encryptPII || securityConfig.encryption.data.encryptFinancial) {
    if (!securityConfig.encryption.key) {
      errors.push('ENCRYPTION_KEY is required when data encryption is enabled');
    } else if (securityConfig.encryption.key.length < 32) {
      warnings.push('ENCRYPTION_KEY should be at least 32 characters long');
    }
  }

  // Production-specific validations
  if (securityConfig.isProduction) {
    if (!securityConfig.https.force) {
      warnings.push('FORCE_HTTPS should be enabled in production');
    }
    
    if (!securityConfig.webhook.twilio.forceVerify) {
      warnings.push('FORCE_TWILIO_VERIFY should be enabled in production');
    }
    
    if (!securityConfig.ipAllowlist.admin.enabled) {
      warnings.push('ADMIN_IP_ALLOWLIST_ENABLED should be enabled in production');
    }
    
    if (!securityConfig.sqlInjection.strictMode) {
      warnings.push('SQL_INJECTION_STRICT_MODE should be enabled in production');
    }
  }

  // Log validation results
  if (errors.length > 0) {
    logger.error('Security configuration validation failed', {
      action: 'security_config_validation_failed',
      errors
    });
  }

  if (warnings.length > 0) {
    logger.warn('Security configuration warnings', {
      action: 'security_config_warnings',
      warnings
    });
  }

  if (errors.length === 0) {
    logger.info('Security configuration validated successfully', {
      action: 'security_config_validated',
      warnings: warnings.length
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// =============================================================================
// CONFIGURATION HELPERS
// =============================================================================

/**
 * Get security configuration for specific component
 */
function getSecurityConfig(component) {
  const componentConfig = securityConfig[component];
  if (!componentConfig) {
    logger.warn('Unknown security component requested', {
      action: 'unknown_security_component',
      component
    });
    return {};
  }
  return componentConfig;
}

/**
 * Check if security feature is enabled
 */
function isSecurityFeatureEnabled(feature) {
  const parts = feature.split('.');
  let config = securityConfig;
  
  for (const part of parts) {
    config = config[part];
    if (config === undefined) {
      return false;
    }
  }
  
  return config === true || config.enabled === true;
}

/**
 * Get security threshold value
 */
function getSecurityThreshold(thresholdPath) {
  const parts = thresholdPath.split('.');
  let config = securityConfig;
  
  for (const part of parts) {
    config = config[part];
    if (config === undefined) {
      return null;
    }
  }
  
  return config;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  securityConfig,
  validateSecurityConfig,
  getSecurityConfig,
  isSecurityFeatureEnabled,
  getSecurityThreshold
};