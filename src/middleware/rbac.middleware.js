/**
 * Role-Based Access Control (RBAC) Middleware
 * Fine-grained permissions for admin dashboard
 */

const { logger } = require('../infrastructure/logger');

// Define permissions for each role
const ROLE_PERMISSIONS = {
  SUPER_ADMIN: [
    // All permissions
    '*'
  ],
  ADMIN: [
    // Dashboard access
    'dashboard:read',
    'dashboard:write',
    
    // Order management
    'orders:read',
    'orders:write',
    'orders:reassign',
    'orders:cancel',
    'orders:status_override',
    
    // Credit management
    'credit:read',
    'credit:write',
    'credit:adjust_limit',
    'credit:view_exposure',
    
    // Vendor management
    'vendors:read',
    'vendors:write',
    'vendors:pause',
    'vendors:performance',
    
    // Retailer management
    'retailers:read',
    'retailers:write',
    'retailers:freeze',
    'retailers:credit_adjust',
    
    // Reports and analytics
    'reports:read',
    'analytics:read',
    
    // Alerts
    'alerts:read',
    'alerts:acknowledge',
    
    // Audit logs
    'audit:read'
  ],
  SUPPORT: [
    // Limited dashboard access
    'dashboard:read',
    
    // Order viewing and basic actions
    'orders:read',
    'orders:status_update',
    
    // Credit viewing
    'credit:read',
    
    // Vendor and retailer viewing
    'vendors:read',
    'retailers:read',
    
    // Reports viewing
    'reports:read',
    'analytics:read',
    
    // Alerts viewing
    'alerts:read'
  ],
  FINANCE: [
    // Dashboard access
    'dashboard:read',
    
    // Credit management
    'credit:read',
    'credit:write',
    'credit:adjust_limit',
    'credit:view_exposure',
    
    // Financial reports
    'reports:read',
    'reports:financial',
    'analytics:read',
    
    // Order financial data
    'orders:read',
    'orders:financial_data',
    
    // Audit logs
    'audit:read'
  ],
  OPERATIONS: [
    // Dashboard access
    'dashboard:read',
    'dashboard:write',
    
    // Order management
    'orders:read',
    'orders:write',
    'orders:reassign',
    'orders:status_override',
    
    // Vendor management
    'vendors:read',
    'vendors:write',
    'vendors:pause',
    'vendors:performance',
    
    // Retailer basic management
    'retailers:read',
    'retailers:freeze',
    
    // Alerts
    'alerts:read',
    'alerts:acknowledge'
  ]
};

// Define resource-action mappings
const RESOURCE_ACTIONS = {
  'dashboard': ['read', 'write'],
  'orders': ['read', 'write', 'reassign', 'cancel', 'status_override', 'status_update', 'financial_data'],
  'credit': ['read', 'write', 'adjust_limit', 'view_exposure'],
  'vendors': ['read', 'write', 'pause', 'performance'],
  'retailers': ['read', 'write', 'freeze', 'credit_adjust'],
  'reports': ['read', 'financial'],
  'analytics': ['read'],
  'alerts': ['read', 'acknowledge'],
  'audit': ['read']
};

/**
 * Check if user has permission
 * @param {string} userRole - User's role
 * @param {string} permission - Required permission (e.g., 'orders:read')
 * @returns {boolean} - Whether user has permission
 */
function hasPermission(userRole, permission) {
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  
  // Super admin has all permissions
  if (rolePermissions.includes('*')) {
    return true;
  }
  
  // Check exact permission match
  if (rolePermissions.includes(permission)) {
    return true;
  }
  
  // Check wildcard permissions (e.g., 'orders:*')
  const [resource] = permission.split(':');
  if (rolePermissions.includes(`${resource}:*`)) {
    return true;
  }
  
  return false;
}

/**
 * Middleware to check specific permission
 * @param {string} permission - Required permission
 * @returns {Function} - Express middleware
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRole = req.user.role;
    
    if (!hasPermission(userRole, permission)) {
      logger.warn('Permission denied', {
        action: 'permission_denied',
        userId: req.user.id,
        userRole,
        requiredPermission: permission,
        endpoint: req.path,
        method: req.method
      });

      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'PERMISSION_DENIED',
        required: permission,
        userRole
      });
    }

    // Add permission info to request
    req.permission = permission;
    req.userPermissions = ROLE_PERMISSIONS[userRole] || [];

    next();
  };
}

/**
 * Middleware to check multiple permissions (OR logic)
 * @param {string[]} permissions - Array of permissions (user needs at least one)
 * @returns {Function} - Express middleware
 */
function requireAnyPermission(permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRole = req.user.role;
    const hasAnyPermission = permissions.some(permission => hasPermission(userRole, permission));
    
    if (!hasAnyPermission) {
      logger.warn('Permission denied - none of required permissions', {
        action: 'permission_denied',
        userId: req.user.id,
        userRole,
        requiredPermissions: permissions,
        endpoint: req.path,
        method: req.method
      });

      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'PERMISSION_DENIED',
        required: permissions,
        userRole
      });
    }

    req.userPermissions = ROLE_PERMISSIONS[userRole] || [];
    next();
  };
}

/**
 * Middleware to check multiple permissions (AND logic)
 * @param {string[]} permissions - Array of permissions (user needs all)
 * @returns {Function} - Express middleware
 */
function requireAllPermissions(permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRole = req.user.role;
    const hasAllPermissions = permissions.every(permission => hasPermission(userRole, permission));
    
    if (!hasAllPermissions) {
      const missingPermissions = permissions.filter(permission => !hasPermission(userRole, permission));
      
      logger.warn('Permission denied - missing required permissions', {
        action: 'permission_denied',
        userId: req.user.id,
        userRole,
        requiredPermissions: permissions,
        missingPermissions,
        endpoint: req.path,
        method: req.method
      });

      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'PERMISSION_DENIED',
        required: permissions,
        missing: missingPermissions,
        userRole
      });
    }

    req.userPermissions = ROLE_PERMISSIONS[userRole] || [];
    next();
  };
}

/**
 * Get user's permissions
 * @param {string} userRole - User's role
 * @returns {string[]} - Array of permissions
 */
function getUserPermissions(userRole) {
  return ROLE_PERMISSIONS[userRole] || [];
}

/**
 * Filter data based on user permissions
 * @param {Object} data - Data to filter
 * @param {string} userRole - User's role
 * @param {string} context - Context for filtering (e.g., 'order', 'credit')
 * @returns {Object} - Filtered data
 */
function filterDataByPermissions(data, userRole, context) {
  const permissions = getUserPermissions(userRole);
  
  // Super admin sees everything
  if (permissions.includes('*')) {
    return data;
  }
  
  // Context-specific filtering
  switch (context) {
    case 'order':
      // Remove financial data if user doesn't have financial permissions
      if (!hasPermission(userRole, 'orders:financial_data')) {
        const { totalAmount, items, ...filteredData } = data;
        return {
          ...filteredData,
          items: items?.map(item => {
            const { unitPrice, ...filteredItem } = item;
            return filteredItem;
          })
        };
      }
      break;
      
    case 'credit':
      // Limit credit exposure data for non-finance roles
      if (!hasPermission(userRole, 'credit:view_exposure')) {
        const { balance, creditLimit, ...filteredData } = data;
        return filteredData;
      }
      break;
      
    case 'vendor':
      // Hide sensitive vendor data for support roles
      if (userRole === 'SUPPORT') {
        const { performance, financialData, ...filteredData } = data;
        return filteredData;
      }
      break;
  }
  
  return data;
}

/**
 * Middleware to add user permissions to response
 */
function addPermissionsToResponse(req, res, next) {
  const originalJson = res.json;
  
  res.json = function(data) {
    if (req.user && data.success !== false) {
      data.userPermissions = getUserPermissions(req.user.role);
      data.userRole = req.user.role;
    }
    
    return originalJson.call(this, data);
  };
  
  next();
}

module.exports = {
  hasPermission,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  getUserPermissions,
  filterDataByPermissions,
  addPermissionsToResponse,
  ROLE_PERMISSIONS,
  RESOURCE_ACTIONS
};