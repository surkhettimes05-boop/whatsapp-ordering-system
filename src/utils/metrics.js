/**
 * Prometheus Metrics Collection
 */

const client = require('prom-client');
const observabilityConfig = require('../config/observability.config');

// Create a Registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({
    register,
    prefix: 'whatsapp_ordering_'
});

// HTTP Request Metrics
const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: observabilityConfig.METRICS.LATENCY_BUCKETS,
    registers: [register]
});

const httpRequestTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register]
});

// Order Lifecycle Metrics
const orderLifecycleDuration = new client.Histogram({
    name: 'order_lifecycle_duration_seconds',
    help: 'Time taken for order lifecycle stages',
    labelNames: ['stage', 'status'],
    buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600],
    registers: [register]
});

const orderLifecycleTotal = new client.Counter({
    name: 'order_lifecycle_total',
    help: 'Total number of order lifecycle events',
    labelNames: ['stage', 'status'],
    registers: [register]
});

const orderCreatedTotal = new client.Counter({
    name: 'orders_created_total',
    help: 'Total number of orders created',
    labelNames: ['retailer_id', 'payment_method'],
    registers: [register]
});

const orderStatusTotal = new client.Counter({
    name: 'orders_status_total',
    help: 'Total number of orders by status',
    labelNames: ['status'],
    registers: [register]
});

// Credit Metrics
const creditCheckDuration = new client.Histogram({
    name: 'credit_check_duration_seconds',
    help: 'Time taken for credit checks',
    labelNames: ['retailer_id', 'wholesaler_id', 'result'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [register]
});

const creditCheckTotal = new client.Counter({
    name: 'credit_checks_total',
    help: 'Total number of credit checks',
    labelNames: ['retailer_id', 'wholesaler_id', 'result'],
    registers: [register]
});

const creditFailureTotal = new client.Counter({
    name: 'credit_failures_total',
    help: 'Total number of credit failures',
    labelNames: ['failure_type', 'retailer_id', 'wholesaler_id'],
    registers: [register]
});

// Vendor Response Metrics
const vendorResponseDuration = new client.Histogram({
    name: 'vendor_response_duration_seconds',
    help: 'Time taken for vendor responses',
    labelNames: ['operation', 'wholesaler_id', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    registers: [register]
});

const vendorResponseTotal = new client.Counter({
    name: 'vendor_responses_total',
    help: 'Total number of vendor responses',
    labelNames: ['operation', 'wholesaler_id', 'status'],
    registers: [register]
});

const vendorOfferTotal = new client.Counter({
    name: 'vendor_offers_total',
    help: 'Total number of vendor offers',
    labelNames: ['order_id', 'wholesaler_id', 'status'],
    registers: [register]
});

// Error Metrics
const errorTotal = new client.Counter({
    name: 'errors_total',
    help: 'Total number of errors',
    labelNames: ['type', 'severity', 'route'],
    registers: [register]
});

// Business Metrics Helpers
const metrics = {
    recordHttpRequest(method, route, statusCode, duration, size = 0) {
        httpRequestDuration.observe({ method, route, status_code: statusCode }, duration / 1000);
        httpRequestTotal.inc({ method, route, status_code: statusCode });
    },
    
    recordOrderLifecycleStage(stage, status, duration) {
        orderLifecycleDuration.observe({ stage, status }, duration / 1000);
        orderLifecycleTotal.inc({ stage, status });
    },
    
    recordOrderCreated(retailerId, paymentMethod) {
        orderCreatedTotal.inc({ retailer_id: retailerId, payment_method: paymentMethod });
    },
    
    recordOrderStatus(status) {
        orderStatusTotal.inc({ status });
    },
    
    recordCreditCheck(retailerId, wholesalerId, result, duration) {
        creditCheckDuration.observe({ retailer_id: retailerId, wholesaler_id: wholesalerId, result }, duration / 1000);
        creditCheckTotal.inc({ retailer_id: retailerId, wholesaler_id: wholesalerId, result });
    },
    
    recordCreditFailure(failureType, retailerId, wholesalerId) {
        creditFailureTotal.inc({ 
            failure_type: failureType, 
            retailer_id: retailerId, 
            wholesaler_id: wholesalerId 
        });
    },
    
    recordVendorResponse(operation, wholesalerId, status, duration) {
        vendorResponseDuration.observe({ operation, wholesaler_id: wholesalerId, status }, duration / 1000);
        vendorResponseTotal.inc({ operation, wholesaler_id: wholesalerId, status });
    },
    
    recordVendorOffer(orderId, wholesalerId, status) {
        vendorOfferTotal.inc({ order_id: orderId, wholesaler_id: wholesalerId, status });
    },
    
    recordError(type, severity, route) {
        errorTotal.inc({ type, severity, route: route || 'unknown' });
    },
    
    async getMetrics() {
        return register.metrics();
    },
    
    async getMetricsAsJSON() {
        return register.getMetricsAsJSON();
    }
};

module.exports = metrics;
