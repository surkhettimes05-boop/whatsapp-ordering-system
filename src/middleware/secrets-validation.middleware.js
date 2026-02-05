/**
 * Secrets Validation Middleware
 * Validates all required environment variables and secrets on startup
 */

const crypto = require('crypto');
const { logger } = require('../infrastructure/logger');

// =============================================================================
// REQUIRED ENVIRONMENT VARIABLES CONFIGURATION
// =============================================================================

const REQUIRED_SECRETS = {
  // Database
  DATABASE_URL: {
    required: true,
    type: 'connection_string',
    description: 'PostgreSQL database connection string',
    example: 'postgresql://user:password@host:port/database',
    validate: (value) => value.startsWith('postgresql://') || value.startsWith('postgres://'),
    sensitive: true
  },

  // JWT Authentication
  JWT_SECRET: {
    required: true,
    type: 'secret',
    description: 'JWT signing secret',
    minLength: 32,
    validate: (value) => value.length >= 32,
    sensitive: true
  },

  // Twilio Configuration
  TWILIO_ACCOUNT_SID: {
    required: true,
    type: 'api_key',
    description: 'Twilio Account SID',
    pattern: /^AC[a-f0-9]{32}$/,
    sensitive: false
  },

  TWILIO_AUTH_TOKEN: {
    required: true,
    type: 'secret',
    description: 'Twilio Auth Token',
    minLength: 32,
    sensitive: true
  },

  TWILIO_WHATSAPP_FROM: {
    required: true,
    type: 'phone_number',
    description: 'Twilio WhatsApp sender number',
    pattern: /^whatsapp:\+\d{10,15}$/,
    sensitive: false
  },

  // Redis Configuration
  REDIS_HOST: {
    required: false,
    type: 'hostname',
    description: 'Redis host',
    default: 'localhost',
    sensitive: false
  },

  REDIS_PORT: {
    required: false,
    type: 'port',
    description: 'Redis port',
    default: '6379',
    validate: (value) => {
      const port = parseInt(value);
      return port > 0 && port <= 65535;
    },
    sensitive: false
  },

  REDIS_PASSWORD: {
    required: false,
    type: 'secret',
    description: 'Redis password',
    sensitive: true
  },

  REDIS_URL: {
    required: false,
    type: 'connection_string',
    description: 'Redis connection URL (alternative to individual Redis config)',
    validate: (value) => value.startsWith('redis://') || value.startsWith('rediss://'),
    sensitive: true
  }
};

const PRODUCTION_REQUIRED_SECRETS = {
  // Additional secrets required in production
  WEBHOOK_URL: {
    required: true,
    type: 'url',
    description: 'Public webhook URL for Twilio callbacks',
    validate: (value) => value.startsWith('https://'),
    sensitive: false
  },

  // Email configuration for production alerts
  SMTP_HOST: {
    required: true,
    type: 'hostname',
    description: 'SMTP server host',
    sensitive: false
  },

  SMTP_USER: {
    required: true,
    type: 'email',
    description: 'SMTP username/email',
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    sensitive: false
  },

  SMTP_PASS: {
    required: true,
    type: 'secret',
    description: 'SMTP password',
    sensitive: true
  },

  ADMIN_EMAIL: {
    required: true,
    type: 'email',
    description: 'Admin email for alerts',
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    sensitive: false
  }
};

const OPTIONAL_SECRETS = {
  // OpenAI (for AI features)
  OPENAI_API_KEY: {
    required: false,
    type: 'api_key',
    description: 'OpenAI API key for AI features',
    pattern: /^sk-[a-zA-Z0-9]{48}$/,
    sensitive: true
  },

  // Monitoring and alerting
  ALERT_WEBHOOK_URL: {
    required: false,
    type: 'url',
    description: 'Webhook URL for alerts',
    validate: (value) => value.startsWith('https://'),
    sensitive: false
  },

  ALERT_SLACK_WEBHOOK: {
    required: false,
    type: 'url',
    description: 'Slack webhook URL for alerts',
    validate: (value) => value.startsWith('https://hooks.slack.com/'),
    sensitive: true
  },

  // Rate limiting configuration
  RATE_LIMIT_WINDOW_MS: {
    required: false,
    type: 'number',
    description: 'Rate limit window in milliseconds',
    default: '900000',
    validate: (value) => parseInt(value) > 0,
    sensitive: false
  },

  RATE_LIMIT_MAX_REQUESTS: {
    required: false,
    type: 'number',
    description: 'Maximum requests per rate limit window',
    default: '100',
    validate: (value) => parseInt(value) > 0,
    sensitive: false
  }
};

// =============================================================================
// SECRETS VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate all environment variables on startup
 */
function validateSecretsOnStartup() {
  logger.info('Starting secrets validation', {
    action: 'secrets_validation_start',
    environment: process.env.NODE_ENV
  });

  const validationResults = {
    valid: true,
    errors: [],
    warnings: [],
    missing: [],
    invalid: [],
    weak: [],
    summary: {}
  };

  // Determine which secrets to validate based on environment
  const secretsToValidate = { ...REQUIRED_SECRETS };
  
  if (process.env.NODE_ENV === 'production') {
    Object.assign(secretsToValidate, PRODUCTION_REQUIRED_SECRETS);
  }

  // Validate required secrets
  for (const [key, config] of Object.entries(secretsToValidate)) {
    const result = validateSecret(key, config);
    
    if (!result.valid) {
      validationResults.valid = false;
      validationResults.errors.push(result.error);
      
      if (result.missing) {
        validationResults.missing.push(key);
      } else {
        validationResults.invalid.push(key);
      }
    } else if (result.warning) {
      validationResults.warnings.push(result.warning);
      
      if (result.weak) {
        validationResults.weak.push(key);
      }
    }
  }

  // Validate optional secrets (only if present)
  for (const [key, config] of Object.entries(OPTIONAL_SECRETS)) {
    if (process.env[key]) {
      const result = validateSecret(key, config);
      
      if (!result.valid) {
        validationResults.warnings.push(result.error);
        validationResults.invalid.push(key);
      } else if (result.warning) {
        validationResults.warnings.push(result.warning);
      }
    }
  }

  // Generate summary
  validationResults.summary = {
    totalSecrets: Object.keys(secretsToValidate).length,
    validSecrets: Object.keys(secretsToValidate).length - validationResults.missing.length - validationResults.invalid.length,
    missingSecrets: validationResults.missing.length,
    invalidSecrets: validationResults.invalid.length,
    weakSecrets: validationResults.weak.length,
    optionalSecrets: Object.keys(OPTIONAL_SECRETS).filter(key => process.env[key]).length
  };

  // Log results
  if (validationResults.valid) {
    logger.info('Secrets validation completed successfully', {
      action: 'secrets_validation_success',
      summary: validationResults.summary,
      warnings: validationResults.warnings.length
    });
  } else {
    logger.error('Secrets validation failed', {
      action: 'secrets_validation_failed',
      summary: validationResults.summary,
      errors: validationResults.errors.length,
      missing: validationResults.missing,
      invalid: validationResults.invalid
    });
  }

  // Log warnings separately
  if (validationResults.warnings.length > 0) {
    logger.warn('Secrets validation warnings', {
      action: 'secrets_validation_warnings',
      warnings: validationResults.warnings,
      weak: validationResults.weak
    });
  }

  return validationResults;
}

/**
 * Validate individual secret
 */
function validateSecret(key, config) {
  const value = process.env[key];
  
  // Check if required secret is missing
  if (config.required && (!value || value.trim() === '')) {
    return {
      valid: false,
      missing: true,
      error: `Missing required environment variable: ${key} (${config.description})`
    };
  }

  // If not required and not present, skip validation
  if (!config.required && (!value || value.trim() === '')) {
    return { valid: true };
  }

  const trimmedValue = value.trim();

  // Type-specific validation
  switch (config.type) {
    case 'secret':
      return validateSecretValue(key, trimmedValue, config);
    
    case 'api_key':
      return validateApiKey(key, trimmedValue, config);
    
    case 'connection_string':
      return validateConnectionString(key, trimmedValue, config);
    
    case 'url':
      return validateUrl(key, trimmedValue, config);
    
    case 'email':
      return validateEmail(key, trimmedValue, config);
    
    case 'phone_number':
      return validatePhoneNumber(key, trimmedValue, config);
    
    case 'hostname':
      return validateHostname(key, trimmedValue, config);
    
    case 'port':
      return validatePort(key, trimmedValue, config);
    
    case 'number':
      return validateNumber(key, trimmedValue, config);
    
    default:
      return validateGeneric(key, trimmedValue, config);
  }
}

/**
 * Validate secret value (passwords, tokens, etc.)
 */
function validateSecretValue(key, value, config) {
  const result = { valid: true };

  // Check minimum length
  if (config.minLength && value.length < config.minLength) {
    return {
      valid: false,
      error: `${key} must be at least ${config.minLength} characters long`
    };
  }

  // Check pattern if specified
  if (config.pattern && !config.pattern.test(value)) {
    return {
      valid: false,
      error: `${key} format is invalid`
    };
  }

  // Custom validation
  if (config.validate && !config.validate(value)) {
    return {
      valid: false,
      error: `${key} validation failed`
    };
  }

  // Check for weak secrets
  const weaknessCheck = checkSecretStrength(value);
  if (weaknessCheck.isWeak) {
    result.warning = `${key} appears to be weak: ${weaknessCheck.reason}`;
    result.weak = true;
  }

  return result;
}

/**
 * Validate API key format
 */
function validateApiKey(key, value, config) {
  if (config.pattern && !config.pattern.test(value)) {
    return {
      valid: false,
      error: `${key} format is invalid (expected pattern: ${config.pattern})`
    };
  }

  // Check for common weak API keys
  const weakPatterns = [
    /^(test|demo|sample|example)/i,
    /^(sk-)?[0]{10,}/,
    /^(sk-)?[1]{10,}/,
    /^(sk-)?[a]{10,}/i
  ];

  for (const pattern of weakPatterns) {
    if (pattern.test(value)) {
      return {
        valid: true,
        warning: `${key} appears to be a test/demo key`,
        weak: true
      };
    }
  }

  return { valid: true };
}

/**
 * Validate connection string
 */
function validateConnectionString(key, value, config) {
  if (config.validate && !config.validate(value)) {
    return {
      valid: false,
      error: `${key} format is invalid (${config.description})`
    };
  }

  // Check for common security issues in connection strings
  if (value.includes('password=') && !value.includes('sslmode=require')) {
    return {
      valid: true,
      warning: `${key} should use SSL in production (add sslmode=require)`
    };
  }

  return { valid: true };
}

/**
 * Validate URL
 */
function validateUrl(key, value, config) {
  try {
    const url = new URL(value);
    
    if (config.validate && !config.validate(value)) {
      return {
        valid: false,
        error: `${key} validation failed`
      };
    }

    // Warn about HTTP URLs in production
    if (process.env.NODE_ENV === 'production' && url.protocol === 'http:') {
      return {
        valid: true,
        warning: `${key} should use HTTPS in production`
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `${key} is not a valid URL`
    };
  }
}

/**
 * Validate email address
 */
function validateEmail(key, value, config) {
  if (config.validate && !config.validate(value)) {
    return {
      valid: false,
      error: `${key} is not a valid email address`
    };
  }

  return { valid: true };
}

/**
 * Validate phone number
 */
function validatePhoneNumber(key, value, config) {
  if (config.pattern && !config.pattern.test(value)) {
    return {
      valid: false,
      error: `${key} format is invalid (expected: ${config.pattern})`
    };
  }

  return { valid: true };
}

/**
 * Validate hostname
 */
function validateHostname(key, value, config) {
  const hostnamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!hostnamePattern.test(value) && value !== 'localhost') {
    return {
      valid: false,
      error: `${key} is not a valid hostname`
    };
  }

  return { valid: true };
}

/**
 * Validate port number
 */
function validatePort(key, value, config) {
  const port = parseInt(value);
  
  if (isNaN(port) || port < 1 || port > 65535) {
    return {
      valid: false,
      error: `${key} must be a valid port number (1-65535)`
    };
  }

  if (config.validate && !config.validate(value)) {
    return {
      valid: false,
      error: `${key} validation failed`
    };
  }

  return { valid: true };
}

/**
 * Validate number
 */
function validateNumber(key, value, config) {
  const num = parseInt(value);
  
  if (isNaN(num)) {
    return {
      valid: false,
      error: `${key} must be a valid number`
    };
  }

  if (config.validate && !config.validate(value)) {
    return {
      valid: false,
      error: `${key} validation failed`
    };
  }

  return { valid: true };
}

/**
 * Generic validation
 */
function validateGeneric(key, value, config) {
  if (config.pattern && !config.pattern.test(value)) {
    return {
      valid: false,
      error: `${key} format is invalid`
    };
  }

  if (config.validate && !config.validate(value)) {
    return {
      valid: false,
      error: `${key} validation failed`
    };
  }

  return { valid: true };
}

/**
 * Check secret strength
 */
function checkSecretStrength(secret) {
  // Common weak patterns
  const weakPatterns = [
    { pattern: /^(password|secret|key|token)$/i, reason: 'uses common word' },
    { pattern: /^(123|abc|test|demo|sample)/i, reason: 'uses common prefix' },
    { pattern: /^(.)\1{5,}/, reason: 'has repeated characters' },
    { pattern: /^(qwerty|asdf|zxcv)/i, reason: 'uses keyboard pattern' },
    { pattern: /^[0-9]+$/, reason: 'contains only numbers' },
    { pattern: /^[a-zA-Z]+$/, reason: 'contains only letters' }
  ];

  for (const { pattern, reason } of weakPatterns) {
    if (pattern.test(secret)) {
      return { isWeak: true, reason };
    }
  }

  // Check length
  if (secret.length < 16) {
    return { isWeak: true, reason: 'too short (recommended: 16+ characters)' };
  }

  // Check character diversity
  const hasLower = /[a-z]/.test(secret);
  const hasUpper = /[A-Z]/.test(secret);
  const hasNumber = /[0-9]/.test(secret);
  const hasSpecial = /[^a-zA-Z0-9]/.test(secret);

  const diversity = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
  
  if (diversity < 3) {
    return { isWeak: true, reason: 'lacks character diversity' };
  }

  return { isWeak: false };
}

/**
 * Generate secrets validation report
 */
function generateSecretsReport() {
  const validationResults = validateSecretsOnStartup();
  
  const report = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    validation: validationResults,
    recommendations: []
  };

  // Add recommendations based on validation results
  if (validationResults.missing.length > 0) {
    report.recommendations.push({
      type: 'critical',
      message: `Set missing required environment variables: ${validationResults.missing.join(', ')}`
    });
  }

  if (validationResults.invalid.length > 0) {
    report.recommendations.push({
      type: 'error',
      message: `Fix invalid environment variables: ${validationResults.invalid.join(', ')}`
    });
  }

  if (validationResults.weak.length > 0) {
    report.recommendations.push({
      type: 'warning',
      message: `Strengthen weak secrets: ${validationResults.weak.join(', ')}`
    });
  }

  if (process.env.NODE_ENV === 'production') {
    // Production-specific recommendations
    if (!process.env.WEBHOOK_URL || !process.env.WEBHOOK_URL.startsWith('https://')) {
      report.recommendations.push({
        type: 'security',
        message: 'Use HTTPS for webhook URL in production'
      });
    }

    if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('sslmode=require')) {
      report.recommendations.push({
        type: 'security',
        message: 'Enable SSL for database connection in production'
      });
    }
  }

  return report;
}

/**
 * Middleware to validate secrets on startup
 */
function validateSecretsMiddleware() {
  const validationResults = validateSecretsOnStartup();
  
  if (!validationResults.valid) {
    logger.error('Application startup failed due to invalid secrets', {
      action: 'startup_failed_invalid_secrets',
      errors: validationResults.errors,
      missing: validationResults.missing,
      invalid: validationResults.invalid
    });
    
    // In production, exit the process
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  return (req, res, next) => {
    // Add validation results to request for debugging
    req.secretsValidation = validationResults;
    next();
  };
}

module.exports = {
  validateSecretsOnStartup,
  validateSecret,
  generateSecretsReport,
  validateSecretsMiddleware,
  checkSecretStrength,
  REQUIRED_SECRETS,
  PRODUCTION_REQUIRED_SECRETS,
  OPTIONAL_SECRETS
};