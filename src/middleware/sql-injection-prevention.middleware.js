/**
 * SQL Injection Prevention Middleware
 * Comprehensive protection against SQL injection attacks
 */

const { logger } = require('../infrastructure/logger');
const validator = require('validator');

// =============================================================================
// SQL INJECTION DETECTION PATTERNS
// =============================================================================

const SQL_INJECTION_PATTERNS = [
  // Basic SQL injection patterns
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/gi,
  
  // SQL comments
  /(--|\#|\/\*|\*\/)/g,
  
  // SQL string delimiters and escape sequences
  /('|(\\')|('')|(\\")|(")|(\\""))/g,
  
  // SQL operators and functions
  /(\b(AND|OR|NOT|LIKE|IN|EXISTS|BETWEEN|IS\s+NULL|IS\s+NOT\s+NULL)\b)/gi,
  
  // SQL injection specific patterns
  /(\b(WAITFOR|DELAY|BENCHMARK|SLEEP|PG_SLEEP)\b)/gi,
  
  // Database-specific functions
  /(\b(CHAR|ASCII|SUBSTRING|CONCAT|CAST|CONVERT|COALESCE|ISNULL|LEN|LENGTH)\b)/gi,
  
  // Union-based injection
  /(\bUNION\b.*\bSELECT\b)/gi,
  
  // Boolean-based blind injection
  /(\b(TRUE|FALSE)\b.*(\b(AND|OR)\b).*\b(TRUE|FALSE)\b)/gi,
  
  // Time-based blind injection
  /(\bIF\b.*\bWAITFOR\b|\bIF\b.*\bDELAY\b|\bIF\b.*\bSLEEP\b)/gi,
  
  // Error-based injection
  /(\bCAST\b.*\bAS\b.*\bINT\b|\bCONVERT\b.*\bINT\b)/gi,
  
  // Stacked queries
  /(;.*\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/gi,
  
  // SQL Server specific
  /(\bxp_cmdshell\b|\bsp_executesql\b|\bOPENROWSET\b|\bOPENQUERY\b)/gi,
  
  // MySQL specific
  /(\bLOAD_FILE\b|\bINTO\s+OUTFILE\b|\bINTO\s+DUMPFILE\b)/gi,
  
  // PostgreSQL specific
  /(\bCOPY\b.*\bFROM\b|\bCOPY\b.*\bTO\b)/gi,
  
  // Oracle specific
  /(\bUTL_FILE\b|\bUTL_HTTP\b|\bDBMS_\w+)/gi,
  
  // NoSQL injection patterns (for MongoDB, etc.)
  /(\$where|\$ne|\$gt|\$lt|\$gte|\$lte|\$in|\$nin|\$regex|\$exists)/gi,
  
  // Advanced evasion techniques
  /(\bCHAR\b\s*\(\s*\d+\s*\))/gi, // CHAR(65) = 'A'
  /(\bASCII\b\s*\(\s*\w+\s*\))/gi,
  /(0x[0-9a-fA-F]+)/g, // Hexadecimal encoding
  
  // Encoded injection attempts
  /%27|%22|%2D%2D|%23|%2F%2A|%2A%2F/gi, // URL encoded quotes, comments
  
  // JavaScript injection in NoSQL contexts
  /(function\s*\(|=\s*function|\$function)/gi
];

// Whitelist patterns that should be allowed even if they match SQL patterns
const WHITELIST_PATTERNS = [
  // Common business terms that might contain SQL keywords
  /\b(select\s+option|insert\s+coin|update\s+profile|delete\s+account)\b/gi,
  
  // Product names or descriptions
  /\b(microsoft\s+sql|oracle\s+database|mysql\s+server)\b/gi,
  
  // Common phrases
  /\b(and\s+or|true\s+or\s+false|select\s+all)\b/gi
];

// =============================================================================
// SQL INJECTION PREVENTION MIDDLEWARE
// =============================================================================

/**
 * Main SQL injection prevention middleware
 */
function preventSQLInjection(options = {}) {
  const {
    strictMode = process.env.SQL_INJECTION_STRICT_MODE === 'true',
    logOnly = process.env.SQL_INJECTION_LOG_ONLY === 'true',
    skipPaths = ['/health', '/metrics'],
    maxStringLength = 10000,
    checkHeaders = true,
    checkCookies = true
  } = options;

  return (req, res, next) => {
    try {
      // Skip certain paths
      if (skipPaths.some(path => req.path.includes(path))) {
        return next();
      }

      const detectionResults = [];

      // Check request body
      if (req.body) {
        const bodyResults = checkForSQLInjection(req.body, 'body', maxStringLength);
        detectionResults.push(...bodyResults);
      }

      // Check query parameters
      if (req.query) {
        const queryResults = checkForSQLInjection(req.query, 'query', maxStringLength);
        detectionResults.push(...queryResults);
      }

      // Check URL parameters
      if (req.params) {
        const paramsResults = checkForSQLInjection(req.params, 'params', maxStringLength);
        detectionResults.push(...paramsResults);
      }

      // Check headers if enabled
      if (checkHeaders && req.headers) {
        const headerResults = checkForSQLInjection(req.headers, 'headers', maxStringLength);
        detectionResults.push(...headerResults);
      }

      // Check cookies if enabled
      if (checkCookies && req.cookies) {
        const cookieResults = checkForSQLInjection(req.cookies, 'cookies', maxStringLength);
        detectionResults.push(...cookieResults);
      }

      // Process detection results
      if (detectionResults.length > 0) {
        const highRiskDetections = detectionResults.filter(result => result.riskLevel === 'HIGH');
        const mediumRiskDetections = detectionResults.filter(result => result.riskLevel === 'MEDIUM');

        // Log all detections
        logger.warn('SQL injection attempt detected', {
          action: 'sql_injection_detected',
          ip: req.clientIP || req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method,
          detections: detectionResults.length,
          highRisk: highRiskDetections.length,
          mediumRisk: mediumRiskDetections.length,
          patterns: detectionResults.map(d => ({
            location: d.location,
            field: d.field,
            pattern: d.pattern,
            riskLevel: d.riskLevel,
            value: d.value.substring(0, 100)
          })),
          userId: req.user?.id,
          adminId: req.adminId
        });

        // In strict mode or for high-risk detections, block the request
        if (!logOnly && (strictMode || highRiskDetections.length > 0)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid input detected',
            code: 'INVALID_INPUT',
            details: strictMode ? 'Potentially malicious input detected' : undefined
          });
        }

        // For medium-risk detections in non-strict mode, sanitize and continue
        if (mediumRiskDetections.length > 0 && !strictMode) {
          sanitizeSQLInjectionAttempts(req);
        }
      }

      next();
    } catch (error) {
      logger.error('SQL injection prevention error', {
        action: 'sql_injection_prevention_error',
        error: error.message,
        path: req.path
      });
      
      // In case of error, allow request to continue but log the issue
      next();
    }
  };
}

/**
 * Check object for SQL injection patterns
 */
function checkForSQLInjection(obj, location, maxLength, path = '') {
  const results = [];

  if (obj === null || obj === undefined) {
    return results;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const itemPath = path ? `${path}[${index}]` : `[${index}]`;
      results.push(...checkForSQLInjection(item, location, maxLength, itemPath));
    });
    return results;
  }

  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      const keyPath = path ? `${path}.${key}` : key;
      
      // Check the key itself
      const keyResults = checkStringForSQLInjection(key, location, `${keyPath}(key)`, maxLength);
      results.push(...keyResults);
      
      // Check the value
      results.push(...checkForSQLInjection(value, location, maxLength, keyPath));
    }
    return results;
  }

  if (typeof obj === 'string') {
    const stringResults = checkStringForSQLInjection(obj, location, path, maxLength);
    results.push(...stringResults);
  }

  return results;
}

/**
 * Check individual string for SQL injection patterns
 */
function checkStringForSQLInjection(str, location, field, maxLength) {
  const results = [];

  if (typeof str !== 'string' || str.length === 0) {
    return results;
  }

  // Skip very long strings to avoid performance issues
  if (str.length > maxLength) {
    logger.warn('String too long for SQL injection check', {
      action: 'string_too_long_for_sql_check',
      location,
      field,
      length: str.length,
      maxLength
    });
    return results;
  }

  // Check against whitelist first
  const isWhitelisted = WHITELIST_PATTERNS.some(pattern => pattern.test(str));
  if (isWhitelisted) {
    return results;
  }

  // Check against SQL injection patterns
  for (let i = 0; i < SQL_INJECTION_PATTERNS.length; i++) {
    const pattern = SQL_INJECTION_PATTERNS[i];
    const matches = str.match(pattern);
    
    if (matches) {
      const riskLevel = calculateRiskLevel(pattern, matches, str);
      
      results.push({
        location,
        field,
        pattern: pattern.toString(),
        matches: matches.slice(0, 5), // Limit matches to avoid huge logs
        riskLevel,
        value: str,
        confidence: calculateConfidence(pattern, matches, str)
      });
    }
  }

  return results;
}

/**
 * Calculate risk level based on pattern and context
 */
function calculateRiskLevel(pattern, matches, str) {
  const patternStr = pattern.toString().toLowerCase();
  
  // High-risk patterns
  const highRiskKeywords = [
    'drop', 'delete', 'truncate', 'alter', 'create', 'exec', 'execute',
    'xp_cmdshell', 'sp_executesql', 'waitfor', 'delay', 'benchmark', 'sleep',
    'load_file', 'into outfile', 'into dumpfile', 'copy.*from', 'copy.*to'
  ];
  
  if (highRiskKeywords.some(keyword => patternStr.includes(keyword))) {
    return 'HIGH';
  }
  
  // Medium-risk patterns
  const mediumRiskKeywords = [
    'union.*select', 'select.*from', 'insert.*into', 'update.*set',
    'and.*or', 'true.*false', 'char.*ascii', 'substring', 'concat'
  ];
  
  if (mediumRiskKeywords.some(keyword => patternStr.includes(keyword))) {
    return 'MEDIUM';
  }
  
  // Check for multiple SQL keywords in the same string
  const sqlKeywordCount = (str.match(/\b(select|insert|update|delete|union|where|from|into|set|values|and|or)\b/gi) || []).length;
  if (sqlKeywordCount >= 3) {
    return 'HIGH';
  } else if (sqlKeywordCount >= 2) {
    return 'MEDIUM';
  }
  
  return 'LOW';
}

/**
 * Calculate confidence level of detection
 */
function calculateConfidence(pattern, matches, str) {
  let confidence = 0.5; // Base confidence
  
  // Increase confidence for multiple matches
  confidence += Math.min(matches.length * 0.1, 0.3);
  
  // Increase confidence for SQL-like structure
  if (/\b(select|insert|update|delete)\b.*\b(from|into|set|where)\b/gi.test(str)) {
    confidence += 0.3;
  }
  
  // Increase confidence for SQL operators
  if (/\b(and|or)\b.*[=<>]/gi.test(str)) {
    confidence += 0.2;
  }
  
  // Decrease confidence for common words
  const commonWords = ['and', 'or', 'not', 'in', 'like', 'true', 'false'];
  const commonWordMatches = commonWords.filter(word => 
    str.toLowerCase().includes(word)
  ).length;
  confidence -= Math.min(commonWordMatches * 0.05, 0.2);
  
  return Math.max(0.1, Math.min(1.0, confidence));
}

/**
 * Sanitize SQL injection attempts
 */
function sanitizeSQLInjectionAttempts(req) {
  if (req.body) {
    req.body = sanitizeObjectForSQL(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObjectForSQL(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeObjectForSQL(req.params);
  }
}

/**
 * Sanitize object by removing SQL injection patterns
 */
function sanitizeObjectForSQL(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObjectForSQL(item));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanKey = sanitizeStringForSQL(key);
      sanitized[cleanKey] = sanitizeObjectForSQL(value);
    }
    return sanitized;
  }

  if (typeof obj === 'string') {
    return sanitizeStringForSQL(obj);
  }

  return obj;
}

/**
 * Sanitize string by removing SQL injection patterns
 */
function sanitizeStringForSQL(str) {
  if (typeof str !== 'string') {
    return str;
  }

  let sanitized = str;

  // Remove SQL comments
  sanitized = sanitized.replace(/(--|\#|\/\*|\*\/)/g, '');
  
  // Remove dangerous SQL keywords (but preserve common words)
  const dangerousKeywords = [
    'xp_cmdshell', 'sp_executesql', 'openrowset', 'openquery',
    'load_file', 'into outfile', 'into dumpfile',
    'waitfor delay', 'benchmark', 'pg_sleep'
  ];
  
  for (const keyword of dangerousKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    sanitized = sanitized.replace(regex, '');
  }
  
  // Remove excessive quotes and escape sequences
  sanitized = sanitized.replace(/'{2,}/g, "'");
  sanitized = sanitized.replace(/"{2,}/g, '"');
  
  // Remove SQL injection specific patterns
  sanitized = sanitized.replace(/(\bunion\b.*\bselect\b)/gi, '');
  sanitized = sanitized.replace(/(;\s*\b(drop|delete|truncate|alter|create)\b)/gi, '');
  
  return sanitized.trim();
}

/**
 * Parameterized query validator
 */
function validateParameterizedQuery(query, params) {
  // Check if query uses parameterized placeholders
  const placeholderPatterns = [
    /\$\d+/g,        // PostgreSQL: $1, $2, etc.
    /\?/g,           // MySQL: ?
    /@\w+/g,         // SQL Server: @param
    /:\w+/g          // Named parameters: :param
  ];
  
  const hasPlaceholders = placeholderPatterns.some(pattern => pattern.test(query));
  
  if (!hasPlaceholders && params && params.length > 0) {
    logger.warn('Query with parameters but no placeholders detected', {
      action: 'non_parameterized_query_detected',
      query: query.substring(0, 200),
      paramCount: params.length
    });
    return false;
  }
  
  // Check for direct string concatenation patterns
  const concatenationPatterns = [
    /\+\s*['"`]/g,    // JavaScript/C#: + "string"
    /\|\|\s*['"`]/g,  // SQL: || 'string'
    /concat\s*\(/gi   // SQL: CONCAT()
  ];
  
  const hasConcatenation = concatenationPatterns.some(pattern => pattern.test(query));
  
  if (hasConcatenation) {
    logger.warn('Query with string concatenation detected', {
      action: 'string_concatenation_in_query',
      query: query.substring(0, 200)
    });
    return false;
  }
  
  return true;
}

/**
 * Database query wrapper with SQL injection protection
 */
function secureQuery(queryFunction) {
  return async function(query, params = []) {
    // Validate the query
    if (!validateParameterizedQuery(query, params)) {
      const error = new Error('Potentially unsafe query detected');
      error.code = 'UNSAFE_QUERY';
      throw error;
    }
    
    // Check query for SQL injection patterns
    const queryResults = checkStringForSQLInjection(query, 'query', 'sql', 10000);
    
    if (queryResults.length > 0) {
      const highRiskResults = queryResults.filter(r => r.riskLevel === 'HIGH');
      
      if (highRiskResults.length > 0) {
        logger.error('High-risk SQL injection pattern in query', {
          action: 'high_risk_sql_in_query',
          query: query.substring(0, 200),
          patterns: highRiskResults.map(r => r.pattern)
        });
        
        const error = new Error('Unsafe query pattern detected');
        error.code = 'UNSAFE_QUERY_PATTERN';
        throw error;
      }
    }
    
    // Execute the original query function
    return await queryFunction(query, params);
  };
}

module.exports = {
  preventSQLInjection,
  checkForSQLInjection,
  checkStringForSQLInjection,
  sanitizeStringForSQL,
  validateParameterizedQuery,
  secureQuery,
  SQL_INJECTION_PATTERNS
};