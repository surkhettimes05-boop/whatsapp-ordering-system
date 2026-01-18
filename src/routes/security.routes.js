/**
 * Security Management Routes
 */

const express = require('express');
const router = express.Router();
const securityController = require('../controllers/security.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');
const { authenticateApiKey } = require('../middleware/apiKey.middleware');
const {
    createApiKeySchema,
    revokeApiKeySchema,
    listApiKeysSchema,
    updateIPAllowlistSchema
} = require('../validators/security.validator');
const { validate } = require('../middleware/validation.middleware');

// All routes require authentication (either JWT or API key)
// Try API key first, fallback to JWT if no API key provided
router.use(async (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (apiKey && apiKey.startsWith('sk_')) {
        // Has API key, use API key authentication
        return authenticateApiKey(req, res, next);
    } else {
        // No API key, use JWT authentication
        return authenticate(req, res, next);
    }
});

// API Key Management
router.post('/api-keys', isAdmin, validate(createApiKeySchema), securityController.createApiKey);
router.get('/api-keys', isAdmin, validate(listApiKeysSchema), securityController.listApiKeys);
router.delete('/api-keys/:keyId', isAdmin, validate(revokeApiKeySchema), securityController.revokeApiKeyEndpoint);

// IP Allowlist Management
router.get('/ip-allowlist', isAdmin, securityController.getIPAllowlist);
router.put('/ip-allowlist', isAdmin, validate(updateIPAllowlistSchema), securityController.updateIPAllowlist);

// Security Configuration
router.get('/config', isAdmin, securityController.getSecurityConfig);

module.exports = router;
