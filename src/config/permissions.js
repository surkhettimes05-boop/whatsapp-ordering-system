/**
 * Role-Based Access Control (RBAC) System
 * 
 * Granular permission management for fintech platform
 * Replaces simple role checks with permission-based authorization
 */

/**
 * Permission definitions
 * Format: 'resource:action' => [allowed roles]
 */
const PERMISSIONS = {
    // Order Management
    'orders:create': ['RETAILER', 'ADMIN'],
    'orders:view_own': ['RETAILER', 'WHOLESALER', 'ADMIN'],
    'orders:view_all': ['ADMIN'],
    'orders:update_status': ['WHOLESALER', 'ADMIN'],
    'orders:cancel_own': ['RETAILER', 'ADMIN'],
    'orders:cancel_any': ['ADMIN'],
    'orders:force_assign': ['ADMIN'],

    // Credit Management
    'credit:view_own': ['RETAILER', 'WHOLESALER'],
    'credit:view_all': ['ADMIN'],
    'credit:update_limit': ['ADMIN'],
    'credit:override': ['ADMIN'],
    'credit:approve': ['ADMIN'],
    'credit:hold': ['ADMIN'],

    // Bidding
    'bids:submit': ['WHOLESALER'],
    'bids:view_own': ['WHOLESALER', 'ADMIN'],
    'bids:view_all': ['ADMIN'],
    'bids:force_select': ['ADMIN'],

    // Ledger & Financial
    'ledger:view_own': ['RETAILER', 'WHOLESALER'],
    'ledger:view_all': ['ADMIN'],
    'ledger:create_manual': ['ADMIN'],
    'ledger:reverse': ['ADMIN'],

    // Admin Functions
    'admin:dashboard': ['ADMIN'],
    'admin:reports': ['ADMIN'],
    'admin:recovery': ['ADMIN'],
    'admin:override': ['ADMIN'],
    'admin:audit_logs': ['ADMIN'],

    // System
    'system:health': ['ADMIN'],
    'system:logs': ['ADMIN'],
    'system:config': ['ADMIN']
};

/**
 * Role hierarchy (for future use in permission inheritance)
 */
const ROLE_HIERARCHY = {
    'ADMIN': 999,
    'WHOLESALER': 50,
    'RETAILER': 10,
    'SUPPORT': 5
};

/**
 * Check if a role has a specific permission
 * @param {string} userRole - User's role
 * @param {string} permission - Permission to check (e.g., 'orders:create')
 * @returns {boolean}
 */
function hasPermission(userRole, permission) {
    const allowedRoles = PERMISSIONS[permission];

    if (!allowedRoles) {
        console.warn(`Unknown permission: ${permission}`);
        return false;
    }

    return allowedRoles.includes(userRole);
}

/**
 * Middleware factory: Require specific permission
 * @param {string} permission - Required permission
 * @returns {Function} Express middleware
 */
function requirePermission(permission) {
    return (req, res, next) => {
        // Check authentication
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        // Check permission
        if (!hasPermission(req.user.role, permission)) {
            console.warn(`Permission denied: ${req.user.role} attempted ${permission}`);

            return res.status(403).json({
                success: false,
                error: 'Permission denied',
                required: permission
            });
        }

        next();
    };
}

/**
 * Middleware factory: Require any of the specified permissions
 * @param {string[]} permissions - Array of permissions (OR logic)
 * @returns {Function} Express middleware
 */
function requireAnyPermission(permissions) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const hasAny = permissions.some(permission =>
            hasPermission(req.user.role, permission)
        );

        if (!hasAny) {
            return res.status(403).json({
                success: false,
                error: 'Permission denied',
                required: `One of: ${permissions.join(', ')}`
            });
        }

        next();
    };
}

/**
 * Middleware factory: Require all specified permissions
 * @param {string[]} permissions - Array of permissions (AND logic)
 * @returns {Function} Express middleware
 */
function requireAllPermissions(permissions) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const hasAll = permissions.every(permission =>
            hasPermission(req.user.role, permission)
        );

        if (!hasAll) {
            return res.status(403).json({
                success: false,
                error: 'Permission denied',
                required: `All of: ${permissions.join(', ')}`
            });
        }

        next();
    };
}

/**
 * Get all permissions for a role
 * @param {string} role - User role
 * @returns {string[]} Array of permissions
 */
function getPermissionsForRole(role) {
    return Object.entries(PERMISSIONS)
        .filter(([_, roles]) => roles.includes(role))
        .map(([permission]) => permission);
}

/**
 * Check if user can access resource owned by another user
 * @param {object} req - Express request
 * @param {string} resourceOwnerId - ID of resource owner
 * @returns {boolean}
 */
function canAccessResource(req, resourceOwnerId) {
    // Admin can access everything
    if (req.user.role === 'ADMIN') {
        return true;
    }

    // User can access their own resources
    return req.user.id === resourceOwnerId;
}

module.exports = {
    PERMISSIONS,
    ROLE_HIERARCHY,
    hasPermission,
    requirePermission,
    requireAnyPermission,
    requireAllPermissions,
    getPermissionsForRole,
    canAccessResource
};
