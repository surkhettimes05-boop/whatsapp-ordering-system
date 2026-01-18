# Production Observability Guide

## Overview
Complete observability implementation with:
- ✅ **Structured logging** - Winston-based JSON logging
- ✅ **Request tracing** - Correlation IDs and distributed tracing
- ✅ **Prometheus metrics** - Business and performance metrics
- ✅ **Error alerting** - Automated alerts for critical issues

## Components

### 1. Structured Logging (`utils/logger.js`)

#### Features
- JSON format for production
- Pretty format for development
- Multiple transports (console, file)
- Log rotation
- Correlation ID support

#### Usage
```javascript
const logger = require('./utils/logger');

// Basic logging
logger.info('Order created', { orderId: '123' });
logger.error('Payment failed', { error: error.message });

// With correlation ID
const childLogger = logger.child({ correlationId: 'abc-123' });
childLogger.info('Processing order');

// Business events
logger.businessEvent('order_created', {
    orderId: '123',
    retailerId: 'ret-1',
    amount: 1000
});

// Performance metrics
logger.metric('order_processing_time', 1500, {
    orderId: '123',
    stage: 'payment'
});
```

### 2. Request Tracing (`middleware/tracing.middleware.js`)

#### Features
- Automatic correlation ID generation
- Request ID tracking
- Performance timing
- Span tracking

#### Usage
```javascript
const { traceSpan, trackOperation } = require('./middleware/tracing.middleware');

// Track operation with span
await traceSpan('process_payment', async () => {
    // Your code here
});

// Track business operation
await trackOperation('create_order', async () => {
    // Your code here
}, { retailerId: 'ret-1' });
```

#### Headers
- `X-Correlation-ID` - Passed through requests
- `X-Request-ID` - Unique per request

### 3. Prometheus Metrics (`utils/metrics.js`)

#### Metrics Endpoint
```
GET /metrics
```

Returns Prometheus-formatted metrics.

#### Available Metrics

**HTTP Metrics:**
- `http_request_duration_seconds` - Request duration histogram
- `http_requests_total` - Total request counter
- `http_request_size_bytes` - Request size histogram

**Order Metrics:**
- `order_lifecycle_duration_seconds` - Order lifecycle timing
- `orders_created_total` - Order creation counter
- `orders_status_total` - Orders by status

**Credit Metrics:**
- `credit_check_duration_seconds` - Credit check timing
- `credit_checks_total` - Credit check counter
- `credit_failures_total` - Credit failure counter
- `credit_limit_current` - Current credit limit gauge
- `credit_balance_current` - Current balance gauge

**Vendor Metrics:**
- `vendor_response_duration_seconds` - Vendor response timing
- `vendor_responses_total` - Vendor response counter
- `vendor_offers_total` - Vendor offer counter

**Error Metrics:**
- `errors_total` - Error counter
- `error_rate_per_minute` - Error rate gauge

### 4. Error Alerting (`utils/alerting.js`)

#### Alert Channels
- Webhook (configurable URL)
- Slack (webhook URL)
- Email (future)

#### Alert Thresholds
Configured in `observability.config.js`:
- Error rate: 10 errors/minute
- Response time P95: 5000ms
- Credit failure rate: 5 failures/minute
- Vendor response time: 10000ms
- Order lifecycle time: 300000ms (5 minutes)

#### Usage
```javascript
const { alertCreditFailure, alertHighResponseTime } = require('./utils/alerting');

// Alert on credit failure
await alertCreditFailure('credit_limit_exceeded', retailerId, wholesalerId, {
    requestedAmount: 1000,
    availableCredit: 500
});

// Alert on high response time
await alertHighResponseTime('vendor_offer', 15000, {
    wholesalerId: 'wh-1',
    orderId: 'ord-1'
});
```

## Business Metrics Tracking

### Order Lifecycle Tracking

Track order through all stages:
```javascript
const { trackOrderLifecycle, trackOrderCreated, trackOrderStatus } = require('./utils/observability.helpers');

// Track order creation
trackOrderCreated(orderId, retailerId, paymentMethod, correlationId);

// Track lifecycle stage
trackOrderLifecycle(orderId, 'credit_approved', 'success', duration, correlationId);

// Track status change
trackOrderStatus(orderId, 'CONFIRMED', correlationId);
```

### Credit Failure Tracking

Track all credit failures:
```javascript
const { trackCreditCheck, trackCreditFailure } = require('./utils/observability.helpers');

// Track credit check
trackCreditCheck(retailerId, wholesalerId, passed, duration, correlationId);

// Track credit failure
await trackCreditFailure('credit_limit_exceeded', retailerId, wholesalerId, {
    requestedAmount: 1000,
    availableCredit: 500
}, correlationId);
```

### Vendor Response Time Tracking

Track vendor operations:
```javascript
const { trackVendorResponse, trackVendorOffer } = require('./utils/observability.helpers');

// Track vendor response
trackVendorResponse('offer_submission', wholesalerId, 'success', duration, correlationId);

// Track vendor offer
trackVendorOffer(orderId, wholesalerId, 'PENDING', correlationId);
```

## Configuration

### Environment Variables
```env
# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Tracing
TRACING_ENABLED=true
TRACE_SAMPLING_RATE=1.0
TRACE_INCLUDE_BODIES=false

# Metrics
METRICS_ENABLED=true

# Alerting
ALERTING_ENABLED=true
ALERT_ERROR_RATE=10
ALERT_RESPONSE_TIME_P95=5000
ALERT_CREDIT_FAILURE_RATE=5
ALERT_VENDOR_RESPONSE_TIME=10000
ALERT_ORDER_LIFECYCLE_TIME=300000
ALERT_WEBHOOK_URL=https://your-webhook-url.com/alerts
ALERT_SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
ALERT_COOLDOWN=300000
```

## Integration Examples

### In Order Service
```javascript
const { trackOrderCreated, trackOrderLifecycle, withObservability } = require('../utils/observability.helpers');

async function createOrder(orderData, correlationId) {
    return withObservability('create_order', async () => {
        const startTime = Date.now();
        
        // Create order
        const order = await prisma.order.create({...});
        
        // Track creation
        trackOrderCreated(order.id, order.retailerId, order.paymentMode, correlationId);
        
        // Track lifecycle stage
        const duration = Date.now() - startTime;
        trackOrderLifecycle(order.id, 'order_created', 'success', duration, correlationId);
        
        return order;
    }, { retailerId: orderData.retailerId });
}
```

### In Credit Service
```javascript
const { trackCreditCheck, trackCreditFailure } = require('../utils/observability.helpers');

async function checkCreditLimit(retailerId, wholesalerId, amount, correlationId) {
    const startTime = Date.now();
    
    try {
        const result = await performCreditCheck(...);
        const duration = Date.now() - startTime;
        
        trackCreditCheck(retailerId, wholesalerId, result.passed, duration, correlationId);
        
        if (!result.passed) {
            await trackCreditFailure(result.failureType, retailerId, wholesalerId, {
                requestedAmount: amount,
                availableCredit: result.availableCredit
            }, correlationId);
        }
        
        return result;
    } catch (error) {
        await trackCreditFailure('check_error', retailerId, wholesalerId, {
            error: error.message
        }, correlationId);
        throw error;
    }
}
```

### In Bidding Service
```javascript
const { trackVendorResponse, trackVendorOffer } = require('../utils/observability.helpers');

async function ingestOffer(orderId, wholesalerId, offerData, correlationId) {
    const startTime = Date.now();
    
    try {
        const offer = await processOffer(...);
        const duration = Date.now() - startTime;
        
        trackVendorResponse('offer_submission', wholesalerId, 'success', duration, correlationId);
        trackVendorOffer(orderId, wholesalerId, 'PENDING', correlationId);
        
        return offer;
    } catch (error) {
        const duration = Date.now() - startTime;
        trackVendorResponse('offer_submission', wholesalerId, 'failed', duration, correlationId);
        throw error;
    }
}
```

## Monitoring

### Prometheus Scraping
Configure Prometheus to scrape metrics:
```yaml
scrape_configs:
  - job_name: 'whatsapp-ordering'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:5000']
```

### Grafana Dashboards
Create dashboards using:
- HTTP request metrics
- Order lifecycle metrics
- Credit metrics
- Vendor response metrics
- Error rates

### Log Aggregation
- Logs are written to `logs/` directory
- Use log aggregation tools (ELK, Loki, etc.) to collect logs
- Filter by correlation ID for request tracing

## Best Practices

1. **Always use correlation IDs** - Pass through all async operations
2. **Track business events** - Use `businessEvent` for important events
3. **Monitor error rates** - Set up alerts for high error rates
4. **Track performance** - Monitor P95/P99 response times
5. **Alert on thresholds** - Configure appropriate alert thresholds
6. **Log context** - Include relevant context in all logs
7. **Use structured logging** - Always use structured format

## Troubleshooting

### Metrics not appearing
- Check `/metrics` endpoint is accessible
- Verify `METRICS_ENABLED=true`
- Check Prometheus can scrape endpoint

### Alerts not firing
- Verify `ALERTING_ENABLED=true`
- Check alert thresholds are configured
- Verify webhook/Slack URLs are correct
- Check alert cooldown period

### Logs not structured
- Set `LOG_FORMAT=json` for production
- Check Winston transports are configured
- Verify log directory exists
