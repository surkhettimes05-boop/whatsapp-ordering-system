/**
 * Audit Trail Middleware
 * Comprehensive logging of all admin actions for compliance and security
 */

const prisma = require('../config/database');
const { logger } = require('../infrastructure/logger');
const crypto = require('crypto');

/**
 * Audit trail middleware for admin actions
 * Logs all admin actions with detailed context
 */
function auditTrail(options = {}) {
  const {
    action = null,
    resource = null,
    skipRoutes = ['/health', '/metrics'],
    sensitiveFields = ['password', 'token', 'secret', 'key'],
    maxBodySize = 10000 // Max request body size to log (bytes)
  } = options;

  return async (req, res, next) => {
    // Skip audit for certain routes
    if (skipRoutes.some(route => req.path.includes(route))) {
      return next();
    }

    // Only audit authenticated admin requests
    if (!req.user || !['ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE', 'OPERATIONS'].includes(req.user.role)) {
      return next();
    }

    const startTime = Date.now();
    const requestId = req.requestId || crypto.randomUUID();
    
    // Capture request data
    const requestData = {
      method: req.method,
      path: req.path,
      query: req.query,
      params: req.params,
      headers: {
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip']
      },
      ip: req.clientIP || req.ip,
      body: req.body && JSON.stringify(req.body).length <= maxBodySize 
        ? sanitizeBody(req.body, sensitiveFields)
        : { _truncated: 'Body too large or empty' }
    };

    // Determine action and resource from route or options
    const auditAction = action || deriveActionFromRequest(req);
    const auditResource = resource || deriveResourceFromRequest(req);

    // Store original res.json to capture response
    const originalJson = res.json;
    let responseData = null;
    let responseStatus = null;

    res.json = function(data) {
      responseData = data;
      responseStatus = res.statusCode;
      return originalJson.call(this, data);
    };

    // Continue with request processing
    next();

    // Log audit trail after response (using setImmediate to ensure response is sent)
    setImmediate(async () => {
      try {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Determine if action was successful
        const success = responseStatus < 400 && (!responseData || responseData.success !== false);

        // Extract target ID from response or request
        const targetId = extractTargetId(req, responseData);

        // Create audit log entry
        const auditEntry = {
          adminId: req.user.id,
          action: auditAction,
          resource: auditResource,
          targetId,
          success,
          requestId,
          method: req.method,
          path: req.path,
          ipAddress: req.clientIP || req.ip,
          userAgent: req.headers['user-agent'],
          duration,
          statusCode: responseStatus,
          metadata: JSON.stringify({
            query: req.query,
            params: req.params,
            body: requestData.body,
            response: success && responseData ? sanitizeResponse(responseData, sensitiveFields) : null,
            error: !success && responseData ? responseData.error : null,
            permission: req.permission,
            timestamp: new Date().toISOString()
          }),
          createdAt: new Date()
        };

        // Save to database
        await prisma.adminAuditLog.create({
          data: auditEntry
        });

        // Log to application logger
        logger.info('Admin action audited', {
          action: 'admin_action_audited',
          adminId: req.user.id,
          auditAction,
          auditResource,
          targetId,
          success,
          duration,
          statusCode: responseStatus,
          requestId
        });

      } catch (error) {
        logger.error('Failed to create audit log', {
          action: 'audit_log_failed',
          error: error.message,
          adminId: req.user?.id,
          requestId,
          path: req.path,
          method: req.method
        });
      }
    });
  };
}

/**
 * Sanitize request body by removing sensitive fields
 */
function sanitizeBody(body, sensitiveFields) {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Sanitize response data by removing sensitive fields
 */
function sanitizeResponse(response, sensitiveFields) {
  if (!response || typeof response !== 'object') {
    return response;
  }

  // Limit response size in audit log
  const responseStr = JSON.stringify(response);
  if (responseStr.length > 5000) {
    return { _truncated: 'Response too large', success: response.success };
  }

  const sanitized = { ...response };
  
  // Remove sensitive fields recursively
  function removeSensitiveFields(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(removeSensitiveFields);
    }
    
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        cleaned[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        cleaned[key] = removeSensitiveFields(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  return removeSensitiveFields(sanitized);
}

/**
 * Derive action from HTTP request
 */
function deriveActionFromRequest(req) {
  const { method, path } = req;
  
  // Map common patterns to actions
  const actionMappings = [
    { pattern: /\/freeze$/, action: 'FREEZE' },
    { pattern: /\/pause$/, action: 'PAUSE' },
    { pattern: /\/reassign$/, action: 'REASSIGN' },
    { pattern: /\/status$/, action: 'STATUS_UPDATE' },
    { pattern: /\/credit$/, action: 'CREDIT_ADJUST' },
    { pattern: /\/bulk-/, action: 'BULK_OPERATION' },
    { pattern: /\/overrides\//, action: 'OVERRIDE' },
    { pattern: /\/alerts\/.*\/acknowledge$/, action: 'ALERT_ACKNOWLEDGE' }
  ];

  // Check for specific patterns
  for (const mapping of actionMappings) {
    if (mapping.pattern.test(path)) {
      return mapping.action;
    }
  }

  // Default action based on HTTP method
  switch (method) {
    case 'GET':
      return 'READ';
    case 'POST':
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Derive resource from HTTP request
 */
function deriveResourceFromRequest(req) {
  const { path } = req;
  
  // Extract resource from path
  const pathParts = path.split('/').filter(part => part);
  
  // Common resource mappings
  const resourceMappings = {
    'orders': 'ORDER',
    'retailers': 'RETAILER',
    'vendors': 'VENDOR',
    'credit': 'CREDIT',
    'alerts': 'ALERT',
    'dashboard': 'DASHBOARD',
    'overrides': 'OVERRIDE'
  };

  // Find resource in path
  for (const part of pathParts) {
    if (resourceMappings[part]) {
      return resourceMappings[part];
    }
  }

  return 'UNKNOWN';
}

/**
 * Extract target ID from request or response
 */
function extractTargetId(req, responseData) {
  // Try to get ID from URL params
  if (req.params.id) {
    return req.params.id;
  }

  // Try to get ID from other common param names
  const idParams = ['retailerId', 'vendorId', 'orderId', 'wholesalerId'];
  for (const param of idParams) {
    if (req.params[param]) {
      return req.params[param];
    }
  }

  // Try to get ID from request body
  if (req.body) {
    for (const param of ['id', ...idParams]) {
      if (req.body[param]) {
        return req.body[param];
      }
    }
  }

  // Try to get ID from response data
  if (responseData && responseData.data) {
    if (responseData.data.id) {
      return responseData.data.id;
    }
    
    // Check nested data structures
    for (const param of idParams) {
      if (responseData.data[param]) {
        return responseData.data[param];
      }
    }
  }

  return null;
}

/**
 * Middleware for high-risk actions that require additional logging
 */
function highRiskAudit(riskLevel = 'HIGH') {
  return async (req, res, next) => {
    if (!req.user) {
      return next();
    }

    // Log high-risk action attempt
    logger.warn('High-risk admin action attempted', {
      action: 'high_risk_action_attempted',
      adminId: req.user.id,
      riskLevel,
      path: req.path,
      method: req.method,
      ip: req.clientIP || req.ip,
      userAgent: req.headers['user-agent']
    });

    // Add risk level to request for audit trail
    req.riskLevel = riskLevel;

    next();
  };
}

/**
 * Get audit logs for admin user
 */
async function getAuditLogs(adminId, options = {}) {
  const {
    startDate,
    endDate,
    action,
    resource,
    success,
    limit = 100,
    offset = 0
  } = options;

  const where = { adminId };

  if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
  if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
  if (action) where.action = action;
  if (resource) where.resource = resource;
  if (success !== undefined) where.success = success;

  const [logs, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        admin: {
          select: { id: true, email: true, name: true }
        }
      }
    }),
    prisma.adminAuditLog.count({ where })
  ]);

  return { logs, total };
}

/**
 * Get audit summary for admin user
 */
async function getAuditSummary(adminId, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const summary = await prisma.adminAuditLog.groupBy({
    by: ['action', 'success'],
    where: {
      adminId,
      createdAt: { gte: startDate }
    },
    _count: { action: true }
  });

  const totalActions = summary.reduce((sum, item) => sum + item._count.action, 0);
  const successfulActions = summary
    .filter(item => item.success)
    .reduce((sum, item) => sum + item._count.action, 0);

  return {
    totalActions,
    successfulActions,
    failedActions: totalActions - successfulActions,
    successRate: totalActions > 0 ? (successfulActions / totalActions) * 100 : 0,
    actionBreakdown: summary,
    period: `${days} days`
  };
}

module.exports = {
  auditTrail,
  highRiskAudit,
  getAuditLogs,
  getAuditSummary,
  sanitizeBody,
  sanitizeResponse
};