/**
 * IP Allowlist Middleware
 * 
 * Fintech-grade IP filtering for webhooks and sensitive endpoints
 * Supports CIDR notation and IP ranges
 */

const securityConfig = require('../config/security.config');
const { isIP, isIPv4, isIPv6 } = require('net');

/**
 * Check if IP matches CIDR block
 * @param {string} ip - IP address
 * @param {string} cidr - CIDR block (e.g., "192.168.1.0/24")
 * @returns {boolean} - True if IP matches
 */
function matchesCIDR(ip, cidr) {
    if (!cidr.includes('/')) {
        // Not a CIDR, do exact match
        return ip === cidr;
    }

    const [network, prefixLength] = cidr.split('/');
    const prefix = parseInt(prefixLength, 10);

    if (isIPv4(ip) && isIPv4(network)) {
        return matchesIPv4CIDR(ip, network, prefix);
    } else if (isIPv6(ip) && isIPv6(network)) {
        return matchesIPv6CIDR(ip, network, prefix);
    }

    return false;
}

/**
 * Check if IPv4 matches CIDR
 */
function matchesIPv4CIDR(ip, network, prefix) {
    const ipNum = ipToNumber(ip);
    const networkNum = ipToNumber(network);
    const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
    
    return (ipNum & mask) === (networkNum & mask);
}

/**
 * Check if IPv6 matches CIDR
 */
function matchesIPv6CIDR(ip, network, prefix) {
    // Simplified IPv6 CIDR matching
    // For production, use a proper IPv6 library
    const ipParts = ip.split(':');
    const networkParts = network.split(':');
    
    // Basic matching (simplified)
    if (prefix <= 64) {
        // Match first 64 bits
        for (let i = 0; i < 4; i++) {
            if (ipParts[i] !== networkParts[i]) {
                return false;
            }
        }
    }
    
    return true;
}

/**
 * Convert IPv4 to number
 */
function ipToNumber(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * Get client IP address from request
 * @param {object} req - Express request
 * @returns {string} - Client IP
 */
function getClientIP(req) {
    // Check various headers (in order of preference)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // X-Forwarded-For can contain multiple IPs, take the first one
        const ips = forwarded.split(',').map(ip => ip.trim());
        return ips[0];
    }
    
    const realIP = req.headers['x-real-ip'];
    if (realIP) {
        return realIP;
    }
    
    const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
    if (cfConnectingIP) {
        return cfConnectingIP;
    }
    
    // Fallback to connection remote address
    return req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip || 'unknown';
}

/**
 * Check if IP is in allowlist
 * @param {string} ip - IP address to check
 * @param {Array<string>} allowlist - Array of allowed IPs/CIDR blocks
 * @returns {boolean} - True if IP is allowed
 */
function isIPAllowed(ip, allowlist) {
    if (!ip || ip === 'unknown') {
        return false;
    }
    
    // Normalize IP (handle IPv6 mapped IPv4)
    const normalizedIP = ip.replace(/^::ffff:/, '');
    
    for (const allowed of allowlist) {
        if (matchesCIDR(normalizedIP, allowed)) {
            return true;
        }
    }
    
    return false;
}

/**
 * IP allowlist middleware for webhooks
 * @param {object} options - Options
 * @param {Array<string>} options.allowedIPs - Custom allowed IPs (optional)
 * @param {boolean} options.strict - Strict mode (reject if not in list)
 * @returns {Function} - Express middleware
 */
function ipAllowlist(options = {}) {
    const {
        allowedIPs = securityConfig.IP_ALLOWLIST.WEBHOOK_IPS,
        strict = securityConfig.IP_ALLOWLIST.STRICT_MODE
    } = options;
    
    return (req, res, next) => {
        // Skip if allowlist is disabled
        if (!securityConfig.IP_ALLOWLIST.ENABLED) {
            return next();
        }
        
        const clientIP = getClientIP(req);
        
        if (!isIPAllowed(clientIP, allowedIPs)) {
            // Log blocked attempt
            console.warn(`🚫 IP allowlist blocked: ${clientIP} from ${req.path}`);
            
            if (strict) {
                return res.status(403).json({
                    success: false,
                    error: 'IP address not allowed',
                    message: 'Your IP address is not in the allowed list for this endpoint'
                });
            } else {
                // Non-strict mode: log but allow (for development)
                console.warn(`⚠️ IP ${clientIP} not in allowlist but allowing (non-strict mode)`);
            }
        }
        
        // Attach IP to request for logging
        req.clientIP = clientIP;
        
        next();
    };
}

/**
 * Webhook IP allowlist (pre-configured for webhooks)
 */
const webhookIPAllowlist = ipAllowlist({
    allowedIPs: securityConfig.IP_ALLOWLIST.WEBHOOK_IPS,
    strict: securityConfig.IP_ALLOWLIST.STRICT_MODE
});

module.exports = {
    ipAllowlist,
    webhookIPAllowlist,
    getClientIP,
    isIPAllowed,
    matchesCIDR
};
