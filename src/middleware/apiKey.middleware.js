/**
 * API Key Authentication Middleware
 * 
 * Fintech-grade API key system for admin authentication
 * Supports key scopes and expiration
 */

const crypto = require('crypto');
const prisma = require('../config/database');
const securityConfig = require('../config/security.config');

/**
 * Generate API key
 * @param {string} adminId - Admin ID
 * @param {string} scope - Key scope (admin, read_only, write, webhook)
 * @param {object} options - Options
 * @param {number} options.expirationDays - Expiration in days (null for no expiration)
 * @returns {Promise<object>} - Generated key and metadata
 */
async function generateApiKey(adminId, scope = 'admin', options = {}) {
    const { expirationDays = securityConfig.API_KEYS.EXPIRATION_DAYS } = options;
    
    // Generate secure random key
    const keyBytes = crypto.randomBytes(securityConfig.API_KEYS.KEY_LENGTH);
    const keySuffix = keyBytes.toString('base64url'); // URL-safe base64
    
    // Use appropriate prefix
    const prefix = process.env.NODE_ENV === 'production' 
        ? securityConfig.API_KEYS.PREFIX 
        : securityConfig.API_KEYS.PREFIX_TEST;
    
    const apiKey = `${prefix}${keySuffix}`;
    
    // Hash the key for storage
    const keyHash = crypto
        .createHash('sha256')
        .update(apiKey)
        .digest('hex');
    
    // Calculate expiration date
    const expiresAt = expirationDays 
        ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000)
        : null;
    
    // Store in database (ApiKey model must exist in schema)
    const apiKeyRecord = await prisma.apiKey.create({
        data: {
            adminId,
            keyHash,
            scope,
            expiresAt,
            isActive: true,
            lastUsedAt: null
        }
    });
    
    // Log API key creation (if AdminAuditLog exists)
    try {
        await prisma.adminAuditLog.create({
            data: {
                adminId,
                action: 'API_KEY_CREATED',
                targetId: apiKeyRecord.id,
                reason: `API key created with scope: ${scope}`,
                metadata: JSON.stringify({
                    scope,
                    expiresAt: expiresAt?.toISOString() || null
                })
            }
        });
    } catch (error) {
        // AdminAuditLog might not exist, log to console
        console.log(`API key created: ${apiKeyRecord.id} for admin ${adminId} with scope ${scope}`);
    }
    
    return {
        id: apiKeyRecord.id,
        apiKey, // Only returned once - store securely!
        scope,
        expiresAt,
        createdAt: apiKeyRecord.createdAt
    };
}

/**
 * Revoke API key
 * @param {string} keyId - API key ID
 * @param {string} adminId - Admin ID (for authorization)
 * @returns {Promise<object>} - Revoked key info
 */
async function revokeApiKey(keyId, adminId) {
    const apiKey = await prisma.apiKey.findUnique({
        where: { id: keyId },
        include: { admin: true }
    });
    
    if (!apiKey) {
        throw new Error('API key not found');
    }
    
    // Check authorization (admin can only revoke their own keys unless super admin)
    if (apiKey.adminId !== adminId) {
        // Try to find admin record (may not exist if Admin model doesn't exist)
        try {
            const admin = await prisma.admin.findUnique({
                where: { userId: adminId },
                select: { id: true }
            });
            
            // TODO: Add super admin check if needed
            if (!admin) {
                throw new Error('Unauthorized to revoke this API key');
            }
        } catch (error) {
            // If Admin model doesn't exist, check if adminId matches
            if (apiKey.adminId !== adminId) {
                throw new Error('Unauthorized to revoke this API key');
            }
        }
    }
    
    await prisma.apiKey.update({
        where: { id: keyId },
        data: {
            isActive: false,
            revokedAt: new Date()
        }
    });
    
    // Log revocation (if AdminAuditLog exists)
    try {
        await prisma.adminAuditLog.create({
            data: {
                adminId,
                action: 'API_KEY_REVOKED',
                targetId: keyId,
                reason: 'API key revoked'
            }
        });
    } catch (error) {
        // AdminAuditLog might not exist, log to console
        console.log(`API key revoked: ${keyId} by admin ${adminId}`);
    }
    
    return {
        id: keyId,
        revoked: true
    };
}

/**
 * Authenticate request using API key
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {Function} next - Next middleware
 */
async function authenticateApiKey(req, res, next) {
    try {
        // Get API key from header
        const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
        
        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'API key required',
                message: 'Provide API key in X-API-Key header or Authorization header'
            });
        }
        
        // Validate key format
        const prefix = apiKey.startsWith(securityConfig.API_KEYS.PREFIX) 
            ? securityConfig.API_KEYS.PREFIX
            : apiKey.startsWith(securityConfig.API_KEYS.PREFIX_TEST)
            ? securityConfig.API_KEYS.PREFIX_TEST
            : null;
        
        if (!prefix) {
            return res.status(401).json({
                success: false,
                error: 'Invalid API key format'
            });
        }
        
        // Hash the provided key
        const keyHash = crypto
            .createHash('sha256')
            .update(apiKey)
            .digest('hex');
        
        // Find API key in database
        // Note: Admin model must exist in schema for this to work
        // If Admin model doesn't exist, use User model instead
        let apiKeyRecord;
        try {
            apiKeyRecord = await prisma.apiKey.findFirst({
                where: {
                    keyHash,
                    isActive: true
                },
                include: {
                    admin: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    role: true
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            // If Admin relation doesn't exist, query without include
            apiKeyRecord = await prisma.apiKey.findFirst({
                where: {
                    keyHash,
                    isActive: true
                }
            });
            
            if (apiKeyRecord) {
                // Get user directly if Admin model doesn't exist
                const user = await prisma.user.findUnique({
                    where: { id: apiKeyRecord.adminId },
                    select: { id: true, name: true, role: true }
                });
                apiKeyRecord.admin = { user };
            }
        }
        
        if (!apiKeyRecord) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or revoked API key'
            });
        }
        
        // Check expiration
        if (apiKeyRecord.expiresAt && new Date(apiKeyRecord.expiresAt) < new Date()) {
            // Auto-revoke expired key
            await prisma.apiKey.update({
                where: { id: apiKeyRecord.id },
                data: { isActive: false }
            });
            
            return res.status(401).json({
                success: false,
                error: 'API key has expired'
            });
        }
        
        // Update last used timestamp
        await prisma.apiKey.update({
            where: { id: apiKeyRecord.id },
            data: { lastUsedAt: new Date() }
        });
        
        // Attach admin info to request
        req.apiKey = {
            id: apiKeyRecord.id,
            scope: apiKeyRecord.scope,
            adminId: apiKeyRecord.adminId
        };
        
        req.user = apiKeyRecord.admin.user;
        req.user.role = 'ADMIN'; // API keys are admin-only
        
        next();
    } catch (error) {
        console.error('API key authentication error:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });
    }
}

/**
 * Check API key scope
 * @param {string|Array<string>} requiredScopes - Required scope(s)
 * @returns {Function} - Express middleware
 */
function requireScope(requiredScopes) {
    const scopes = Array.isArray(requiredScopes) ? requiredScopes : [requiredScopes];
    
    return (req, res, next) => {
        if (!req.apiKey) {
            return res.status(401).json({
                success: false,
                error: 'API key authentication required'
            });
        }
        
        // Admin scope has access to everything
        if (req.apiKey.scope === securityConfig.API_KEYS.SCOPES.ADMIN) {
            return next();
        }
        
        // Check if scope matches
        if (!scopes.includes(req.apiKey.scope)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient scope',
                required: scopes,
                current: req.apiKey.scope
            });
        }
        
        next();
    };
}

module.exports = {
    generateApiKey,
    revokeApiKey,
    authenticateApiKey,
    requireScope
};
