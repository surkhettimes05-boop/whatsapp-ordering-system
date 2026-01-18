/**
 * Observability Configuration
 * 
 * Production-grade observability settings
 */

module.exports = {
    // Logging Configuration
    LOGGING: {
        // Log level (debug, info, warn, error)
        LEVEL: process.env.LOG_LEVEL || 'info',
        
        // Log format (json, pretty)
        FORMAT: process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'pretty'),
        
        // Log destinations
        DESTINATIONS: {
            CONSOLE: true,
            FILE: true,
            // Optional: Add external services
            // DATADOG: process.env.DATADOG_API_KEY ? true : false,
            // SENTRY: process.env.SENTRY_DSN ? true : false
        },
        
        // Log file paths
        FILES: {
            APP: 'logs/app.log',
            ERROR: 'logs/error.log',
            ACCESS: 'logs/access.log',
            METRICS: 'logs/metrics.log'
        },
        
        // Log rotation
        ROTATION: {
            MAX_SIZE: '20m',
            MAX_FILES: '14d',
            DATE_PATTERN: 'YYYY-MM-DD'
        }
    },

    // Tracing Configuration
    TRACING: {
        // Enable distributed tracing
        ENABLED: process.env.TRACING_ENABLED !== 'false',
        
        // Correlation ID header name
        CORRELATION_ID_HEADER: 'X-Correlation-ID',
        
        // Request ID header name
        REQUEST_ID_HEADER: 'X-Request-ID',
        
        // Trace sampling rate (0.0 to 1.0)
        SAMPLING_RATE: parseFloat(process.env.TRACE_SAMPLING_RATE || '1.0'),
        
        // Include request/response bodies in traces (be careful with sensitive data)
        INCLUDE_BODIES: process.env.TRACE_INCLUDE_BODIES === 'true'
    },

    // Metrics Configuration
    METRICS: {
        // Enable metrics collection
        ENABLED: process.env.METRICS_ENABLED !== 'false',
        
        // Metrics endpoint path
        ENDPOINT: '/metrics',
        
        // Default metrics collection interval (ms)
        COLLECTION_INTERVAL: 15000, // 15 seconds
        
        // Histogram buckets for latency metrics
        LATENCY_BUCKETS: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120], // seconds
        
        // Histogram buckets for request size
        SIZE_BUCKETS: [100, 500, 1000, 5000, 10000, 50000, 100000], // bytes
    },

    // Alerting Configuration
    ALERTING: {
        // Enable alerting
        ENABLED: process.env.ALERTING_ENABLED === 'true',
        
        // Alert thresholds
        THRESHOLDS: {
            // Error rate threshold (errors per minute)
            ERROR_RATE: parseInt(process.env.ALERT_ERROR_RATE || '10'),
            
            // Response time threshold (ms)
            RESPONSE_TIME_P95: parseInt(process.env.ALERT_RESPONSE_TIME_P95 || '5000'),
            
            // Credit failure rate threshold (failures per minute)
            CREDIT_FAILURE_RATE: parseInt(process.env.ALERT_CREDIT_FAILURE_RATE || '5'),
            
            // Vendor response time threshold (ms)
            VENDOR_RESPONSE_TIME: parseInt(process.env.ALERT_VENDOR_RESPONSE_TIME || '10000'),
            
            // Order lifecycle time threshold (ms)
            ORDER_LIFECYCLE_TIME: parseInt(process.env.ALERT_ORDER_LIFECYCLE_TIME || '300000'), // 5 minutes
        },
        
        // Alert channels
        CHANNELS: {
            // Webhook URL for alerts
            WEBHOOK: process.env.ALERT_WEBHOOK_URL,
            
            // Email for alerts
            EMAIL: process.env.ALERT_EMAIL,
            
            // Slack webhook
            SLACK: process.env.ALERT_SLACK_WEBHOOK,
            
            // PagerDuty integration key
            PAGERDUTY: process.env.ALERT_PAGERDUTY_KEY
        },
        
        // Alert cooldown (ms) - prevent spam
        COOLDOWN: parseInt(process.env.ALERT_COOLDOWN || '300000'), // 5 minutes
    },

    // Business Metrics to Track
    BUSINESS_METRICS: {
        // Order lifecycle tracking
        ORDER_LIFECYCLE: {
            ENABLED: true,
            STAGES: [
                'order_created',
                'credit_approved',
                'stock_reserved',
                'wholesaler_accepted',
                'order_confirmed',
                'order_processing',
                'order_packed',
                'order_shipped',
                'order_delivered'
            ]
        },
        
        // Credit failure tracking
        CREDIT_FAILURES: {
            ENABLED: true,
            TYPES: [
                'credit_limit_exceeded',
                'account_blocked',
                'overdue_payment',
                'insufficient_credit',
                'account_hold'
            ]
        },
        
        // Vendor response time tracking
        VENDOR_RESPONSE: {
            ENABLED: true,
            OPERATIONS: [
                'offer_submission',
                'offer_confirmation',
                'stock_check',
                'price_quote',
                'delivery_eta'
            ]
        }
    }
};
