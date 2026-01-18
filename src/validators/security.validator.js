/**
 * Security Validation Schemas
 * 
 * Joi validation schemas for security-related endpoints
 */

const { createSchema, commonSchemas, Joi } = require('../middleware/validation.middleware');

// API Key Management Schemas
const createApiKeySchema = createSchema({
    body: {
        scope: Joi.string().valid('admin', 'read_only', 'write', 'webhook').default('admin'),
        expirationDays: Joi.number().integer().min(1).max(365).optional().allow(null)
    }
});

const revokeApiKeySchema = createSchema({
    params: {
        keyId: commonSchemas.uuid
    }
});

const listApiKeysSchema = createSchema({
    query: {
        ...commonSchemas.pagination,
        scope: Joi.string().valid('admin', 'read_only', 'write', 'webhook').optional(),
        isActive: Joi.boolean().optional()
    }
});

// IP Allowlist Management Schemas
const updateIPAllowlistSchema = createSchema({
    body: {
        enabled: Joi.boolean().optional(),
        strictMode: Joi.boolean().optional(),
        allowedIPs: Joi.array().items(
            Joi.string().ip({ version: ['ipv4', 'ipv6'] }).required()
        ).optional()
    }
});

// Rate Limit Configuration Schema
const updateRateLimitSchema = createSchema({
    body: {
        endpoint: Joi.string().required(),
        windowMs: Joi.number().integer().min(1000).required(),
        max: Joi.number().integer().min(1).required()
    }
});

module.exports = {
    createApiKeySchema,
    revokeApiKeySchema,
    listApiKeysSchema,
    updateIPAllowlistSchema,
    updateRateLimitSchema
};
