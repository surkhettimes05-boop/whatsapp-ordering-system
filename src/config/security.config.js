/**
 * Security Configuration
 * 
 * Fintech-grade security settings for API
 */

module.exports = {
    // Rate Limiting Configuration
    RATE_LIMITS: {
        // General API rate limits
        general: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // 100 requests per window
            message: 'Too many requests from this IP, please try again later',
            standardHeaders: true,
            legacyHeaders: false
        },
        
        // Strict rate limit for auth endpoints
        auth: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // 5 login attempts per 15 minutes
            message: 'Too many authentication attempts, please try again later',
            skipSuccessfulRequests: true
        },
        
        // Admin endpoints
        admin: {
            windowMs: 60 * 1000, // 1 minute
            max: 30, // 30 requests per minute
            message: 'Too many admin requests, please slow down'
        },
        
        // WhatsApp webhook (more lenient)
        webhook: {
            windowMs: 60 * 1000, // 1 minute
            max: 200, // 200 requests per minute
            message: 'Too many webhook requests'
        },
        
        // Order creation (prevent abuse)
        orderCreation: {
            windowMs: 60 * 1000, // 1 minute
            max: 10, // 10 orders per minute
            message: 'Too many order creation attempts, please slow down'
        },
        
        // Bidding endpoints
        bidding: {
            windowMs: 60 * 1000, // 1 minute
            max: 20, // 20 bids per minute
            message: 'Too many bidding requests, please slow down'
        }
    },

    // API Key Configuration
    API_KEYS: {
        // API key prefix
        PREFIX: 'sk_live_', // Production keys
        PREFIX_TEST: 'sk_test_', // Test keys
        
        // Key length (excluding prefix)
        KEY_LENGTH: 32,
        
        // Key expiration (in days, null for no expiration)
        EXPIRATION_DAYS: null, // null = no expiration
        
        // Scopes for API keys
        SCOPES: {
            ADMIN: 'admin',
            READ_ONLY: 'read_only',
            WRITE: 'write',
            WEBHOOK: 'webhook'
        }
    },

    // IP Allowlist Configuration
    IP_ALLOWLIST: {
        // Enable IP allowlist for webhooks
        ENABLED: process.env.WEBHOOK_IP_ALLOWLIST_ENABLED === 'true',
        
        // Allowed IPs/CIDR blocks for webhooks
        WEBHOOK_IPS: process.env.WEBHOOK_ALLOWED_IPS 
            ? process.env.WEBHOOK_ALLOWED_IPS.split(',').map(ip => ip.trim())
            : [
                '127.0.0.1',
                '::1',
                // Twilio IP ranges (from https://www.twilio.com/docs/ip-addresses)
                '54.172.60.0/22',
                '54.244.51.0/24',
                '54.187.174.0/24',
                '54.187.205.0/24',
                '54.187.216.0/24',
                '54.241.31.0/24',
                '54.241.32.0/24',
                '54.241.33.0/24',
                '54.241.34.0/24',
                '54.241.35.0/24',
                '54.241.36.0/24',
                '54.241.37.0/24',
                '54.241.38.0/24',
                '54.241.39.0/24',
                '54.241.40.0/24',
                '54.241.41.0/24',
                '54.241.42.0/24',
                '54.241.43.0/24',
                '54.241.44.0/24',
                '54.241.45.0/24',
                '54.241.46.0/24',
                '54.241.47.0/24',
                '54.241.48.0/24',
                '54.241.49.0/24',
                '54.241.50.0/24',
                '54.241.51.0/24',
                '54.241.52.0/24',
                '54.241.53.0/24',
                '54.241.54.0/24',
                '54.241.55.0/24',
                '54.241.56.0/24',
                '54.241.57.0/24',
                '54.241.58.0/24',
                '54.241.59.0/24',
                '54.241.60.0/24',
                '54.241.61.0/24',
                '54.241.62.0/24',
                '54.241.63.0/24',
                // Meta/Facebook WhatsApp webhook IPs (if using Meta)
                '157.240.0.0/16', // Facebook IP range
                '31.13.0.0/16'    // Facebook IP range
            ],
        
        // Strict mode (reject if IP not in allowlist)
        STRICT_MODE: process.env.WEBHOOK_STRICT_MODE === 'true'
    },

    // Request Validation
    VALIDATION: {
        // Maximum request body size (in bytes)
        MAX_BODY_SIZE: 10 * 1024 * 1024, // 10MB
        
        // Allowed content types
        ALLOWED_CONTENT_TYPES: [
            'application/json',
            'application/x-www-form-urlencoded',
            'multipart/form-data'
        ],
        
        // Strict validation mode
        STRICT_MODE: process.env.VALIDATION_STRICT_MODE === 'true'
    },

    // Security Headers
    SECURITY_HEADERS: {
        // Enable security headers
        ENABLED: true,
        
        // CORS configuration
        CORS: {
            origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
            credentials: true,
            maxAge: 86400 // 24 hours
        }
    }
};
