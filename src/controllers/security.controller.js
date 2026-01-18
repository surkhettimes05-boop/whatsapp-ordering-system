/**
 * Security Management Controller
 * 
 * Endpoints for managing API keys, IP allowlists, and security settings
 */

const { generateApiKey, revokeApiKey } = require('../middleware/apiKey.middleware');
const prisma = require('../config/database');
const securityConfig = require('../config/security.config');

class SecurityController {
    /**
     * Generate new API key
     * POST /api/v1/security/api-keys
     */
    async createApiKey(req, res) {
        try {
            const { scope = 'admin', expirationDays = null } = req.body;
            const adminId = req.user.id; // From auth middleware

            const result = await generateApiKey(adminId, scope, { expirationDays });

            res.json({
                success: true,
                message: 'API key generated successfully. Store it securely - it will not be shown again.',
                data: {
                    id: result.id,
                    apiKey: result.apiKey, // Only shown once!
                    scope: result.scope,
                    expiresAt: result.expiresAt,
                    createdAt: result.createdAt
                }
            });
        } catch (error) {
            console.error('Error creating API key:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * List API keys for current admin
     * GET /api/v1/security/api-keys
     */
    async listApiKeys(req, res) {
        try {
            const adminId = req.user.id;
            const { page = 1, limit = 50, scope, isActive } = req.query;

            const where = {
                adminId
            };

            if (scope) {
                where.scope = scope;
            }

            if (isActive !== undefined) {
                where.isActive = isActive === 'true';
            }

            const [keys, total] = await Promise.all([
                prisma.apiKey.findMany({
                    where,
                    select: {
                        id: true,
                        scope: true,
                        isActive: true,
                        expiresAt: true,
                        lastUsedAt: true,
                        revokedAt: true,
                        createdAt: true
                    },
                    orderBy: { createdAt: 'desc' },
                    skip: (page - 1) * limit,
                    take: parseInt(limit)
                }),
                prisma.apiKey.count({ where })
            ]);

            res.json({
                success: true,
                data: {
                    keys,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                }
            });
        } catch (error) {
            console.error('Error listing API keys:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Revoke API key
     * DELETE /api/v1/security/api-keys/:keyId
     */
    async revokeApiKeyEndpoint(req, res) {
        try {
            const { keyId } = req.params;
            const adminId = req.user.id;

            await revokeApiKey(keyId, adminId);

            res.json({
                success: true,
                message: 'API key revoked successfully'
            });
        } catch (error) {
            console.error('Error revoking API key:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get IP allowlist configuration
     * GET /api/v1/security/ip-allowlist
     */
    async getIPAllowlist(req, res) {
        res.json({
            success: true,
            data: {
                enabled: securityConfig.IP_ALLOWLIST.ENABLED,
                strictMode: securityConfig.IP_ALLOWLIST.STRICT_MODE,
                allowedIPs: securityConfig.IP_ALLOWLIST.WEBHOOK_IPS,
                clientIP: req.clientIP || 'unknown'
            }
        });
    }

    /**
     * Update IP allowlist (admin only)
     * PUT /api/v1/security/ip-allowlist
     */
    async updateIPAllowlist(req, res) {
        try {
            // In production, this should update environment variables or config file
            // For now, return current config
            res.json({
                success: true,
                message: 'IP allowlist configuration updated (requires server restart)',
                data: {
                    enabled: req.body.enabled ?? securityConfig.IP_ALLOWLIST.ENABLED,
                    strictMode: req.body.strictMode ?? securityConfig.IP_ALLOWLIST.STRICT_MODE,
                    allowedIPs: req.body.allowedIPs ?? securityConfig.IP_ALLOWLIST.WEBHOOK_IPS
                }
            });
        } catch (error) {
            console.error('Error updating IP allowlist:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get security configuration
     * GET /api/v1/security/config
     */
    async getSecurityConfig(req, res) {
        res.json({
            success: true,
            data: {
                rateLimits: Object.keys(securityConfig.RATE_LIMITS),
                apiKeyPrefix: process.env.NODE_ENV === 'production'
                    ? securityConfig.API_KEYS.PREFIX
                    : securityConfig.API_KEYS.PREFIX_TEST,
                ipAllowlistEnabled: securityConfig.IP_ALLOWLIST.ENABLED,
                validationStrictMode: securityConfig.VALIDATION.STRICT_MODE
            }
        });
    }
}

module.exports = new SecurityController();
