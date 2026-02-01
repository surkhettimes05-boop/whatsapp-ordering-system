# 🏗️ WhatsApp Messaging Infrastructure Architecture

## Overview

This document describes the production-grade messaging infrastructure for the WhatsApp ordering system. The architecture is designed for high availability, fault tolerance, and horizontal scalability.

## 🎯 Key Features

- **Sub-2 second webhook response time**
- **Message deduplication with Redis**
- **Exponential backoff retry strategy**
- **Dead letter queue for failed messages**
- **Structured logging for complete message lifecycle**
- **Real-time metrics and alerting**
- **Horizontal scaling support**
- **Graceful shutdown and recovery**

## 🏛️ Architecture Components

### 1. Webhook Gateway (`src/gateway/webhook-gateway.js`)

**Responsibilities:**
- Receive and validate Twilio webhooks
- Verify webhook signatures
- Deduplicate messages using Redis
- Enqueue messages for processing
- Respond within 2 seconds

**Features:**
- Rate limiting (100 req/min by default)
- Request timeout (2 seconds)
- Signature verification
- Structured logging
- Metrics collection

### 2. Worker System

#### Webhook Worker (`src/workers/webhook-worker.js`)
- Routes messages to appropriate queues
- Handles message classification
- Manages job distribution

#### Order Worker (`src/workers/order-worker.js`)
- Processes order-related messages
- Validates order format
- Creates orders in database
- Triggers vendor routing

#### Reply Worker (`src/workers/reply-worker.js`)
- Sends WhatsApp replies via Twilio
- Handles message formatting
- Manages delivery status

### 3. Queue System (BullMQ + Redis)

**Queue Types:**
- `whatsapp-webhooks` - Incoming webhook processing
- `order-processing` - Order creation and validation
- `vendor-routing` - Vendor assignment and routing
- `whatsapp-replies` - Outgoing message delivery
- `dead-letter-queue` - Failed message recovery

**Configuration:**
- Exponential backoff: 2s, 4s, 8s, 16s, 30s
- Max retry attempts: 5
- Job retention: 100 completed, 50 failed

### 4. Monitoring & Observability

#### Structured Logging (`src/infrastructure/logger.js`)
- JSON format for production
- Daily log rotation
- Separate error logs
- Message lifecycle tracking

#### Metrics Collection (`src/monitoring/metrics.js`)
- Prometheus-compatible metrics
- Queue depth monitoring
- Error rate tracking
- Response time histograms

#### Queue Monitor (`src/monitoring/queue-monitor.js`)
- Real-time queue status
- Dead letter queue management
- Job retry functionality
- Health check endpoints

### 5. Infrastructure Services

#### Redis Manager (`src/infrastructure/redis.js`)
- Connection pooling
- Health monitoring
- Graceful reconnection
- Message deduplication

## 📊 Message Flow

```
1. Twilio Webhook → Gateway (< 2s response)
2. Gateway → Webhook Queue
3. Webhook Worker → Route to appropriate queue
4. Specialized Worker → Process message
5. Reply Worker → Send response via Twilio
6. Status tracking throughout lifecycle
```

## 🔧 Configuration

### Environment Variables

```bash
# Core Configuration
NODE_ENV=production
PORT=3010

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secure_password
REDIS_DB=0

# Queue Configuration
WEBHOOK_WORKERS=2
ORDER_WORKERS=3
REPLY_WORKERS=4
MAX_RETRY_ATTEMPTS=5
RETRY_BACKOFF_TYPE=exponential
RETRY_BACKOFF_DELAY=2000

# Security
WEBHOOK_SIGNATURE_VERIFICATION=true
WEBHOOK_TIMEOUT=2000
FORCE_TWILIO_VERIFY=true

# Monitoring
METRICS_ENABLED=true
METRICS_PORT=9090
LOG_LEVEL=info
LOG_FORMAT=json

# Alerting
ALERT_ERROR_RATE=10
ALERT_RESPONSE_TIME_P95=5000
ALERT_WEBHOOK_URL=https://your-webhook.com
ALERT_SLACK_WEBHOOK=https://hooks.slack.com/...
```

## 🚀 Deployment

### Production Deployment

```bash
# Make deployment script executable
chmod +x deploy-messaging.sh

# Run deployment (as root)
sudo ./deploy-messaging.sh

# Configure environment
sudo cp /opt/whatsapp-messaging/.env.production.template /opt/whatsapp-messaging/.env
sudo nano /opt/whatsapp-messaging/.env

# Start services
sudo systemctl start whatsapp-messaging
```

### Service Management

```bash
# Start all services
systemctl start whatsapp-messaging

# Individual services
systemctl start whatsapp-gateway
systemctl start whatsapp-workers
systemctl start whatsapp-monitor

# Check status
systemctl status whatsapp-messaging

# View logs
journalctl -u whatsapp-messaging -f
```

## 📈 Monitoring & Alerting

### Health Check Endpoints

- **Gateway Health**: `http://localhost:3010/health`
- **Queue Monitor**: `http://localhost:9091/health`
- **Metrics**: `http://localhost:9090/metrics`

### Key Metrics

- `whatsapp_webhooks_received_total` - Total webhooks received
- `whatsapp_webhook_duration_seconds` - Webhook processing time
- `whatsapp_queue_size` - Current queue depths
- `whatsapp_jobs_processed_total` - Jobs processed by type
- `whatsapp_error_rate` - Error rate by component
- `whatsapp_dead_letter_queue_size` - Failed messages

### Alerts

- **High Error Rate**: > 10% errors in 5 minutes
- **High Response Time**: > 5 seconds P95
- **Queue Backlog**: > 1000 waiting jobs
- **Dead Letter Queue**: > 100 failed messages

## 🔄 Failure Handling

### Retry Strategy

1. **Immediate retry** (0s delay)
2. **Exponential backoff**: 2s, 4s, 8s, 16s, 30s
3. **Dead letter queue** after 5 failed attempts
4. **Manual retry** from DLQ via API

### Recovery Procedures

#### High Error Rate
```bash
# Check service status
systemctl status whatsapp-messaging

# View recent errors
journalctl -u whatsapp-messaging --since "5 minutes ago" | grep ERROR

# Restart if needed
systemctl restart whatsapp-messaging
```

#### Queue Backlog
```bash
# Check queue status
curl http://localhost:9091/queues

# Scale workers (update .env and restart)
WEBHOOK_WORKERS=4
ORDER_WORKERS=6
REPLY_WORKERS=8
```

#### Dead Letter Queue Recovery
```bash
# View failed messages
curl http://localhost:9091/dlq

# Retry all failed messages
curl -X POST http://localhost:9091/dlq/retry -d '{"retryAll": true}'

# Retry specific messages
curl -X POST http://localhost:9091/dlq/retry -d '{"jobIds": ["job1", "job2"]}'
```

## 🔒 Security Features

- **Webhook signature verification** using Twilio auth token
- **Rate limiting** to prevent abuse
- **Input validation** with Joi schemas
- **Process isolation** with systemd security features
- **Least privilege** service user
- **Secure file permissions**

## 📊 Performance Characteristics

### Throughput
- **Webhook processing**: < 2 seconds response time
- **Message throughput**: 1000+ messages/minute
- **Concurrent workers**: Configurable per queue type

### Scalability
- **Horizontal scaling**: Add more worker processes
- **Queue partitioning**: Separate queues by message type
- **Redis clustering**: Support for Redis cluster mode

### Resource Usage
- **Memory**: ~100MB per worker process
- **CPU**: Low usage with efficient async processing
- **Disk**: Log rotation prevents disk fill-up

## 🛠️ Maintenance

### Daily Tasks
```bash
# Health check
/opt/whatsapp-messaging/health-check.sh

# Check queue status
curl http://localhost:9091/queues
```

### Weekly Tasks
```bash
# Create backup
/opt/whatsapp-messaging/backup.sh

# Review error logs
journalctl -u whatsapp-messaging --since "1 week ago" | grep ERROR

# Clean old completed jobs
curl -X POST http://localhost:9091/queues/whatsapp-webhooks/purge \
  -d '{"status": "completed", "olderThan": 604800000}'
```

### Monthly Tasks
- Review and update dependencies
- Analyze performance metrics
- Update monitoring thresholds
- Test disaster recovery procedures

## 🚨 Troubleshooting

### Common Issues

#### Messages Not Processing
1. Check Redis connection: `redis-cli ping`
2. Verify queue workers: `curl http://localhost:9091/queues`
3. Check webhook signature verification
4. Review error logs: `journalctl -u whatsapp-messaging -f`

#### High Response Times
1. Check Redis performance
2. Monitor queue depths
3. Scale worker processes
4. Review database query performance

#### Memory Issues
1. Check for memory leaks in logs
2. Monitor process memory usage
3. Restart workers if needed
4. Review job retention settings

## 📚 API Reference

### Queue Monitor API

#### Get Queue Status
```bash
GET /queues
```

#### Get Specific Queue Details
```bash
GET /queues/{queueName}
```

#### Retry Dead Letter Jobs
```bash
POST /dlq/retry
{
  "jobIds": ["job1", "job2"],
  "retryAll": false
}
```

#### Purge Old Jobs
```bash
POST /queues/{queueName}/purge
{
  "status": "completed",
  "olderThan": 86400000
}
```

## 🎯 Performance Tuning

### Redis Optimization
```bash
# Redis configuration for high throughput
maxmemory-policy allkeys-lru
tcp-keepalive 60
timeout 0
```

### Worker Scaling Guidelines
- **Webhook Workers**: 1 per 500 req/min
- **Order Workers**: 1 per 200 orders/min  
- **Reply Workers**: 1 per 300 replies/min

### Queue Optimization
- Set appropriate job TTL
- Configure job retention limits
- Use job priorities for critical messages
- Monitor queue depth trends

---

## 🎉 Summary

This messaging infrastructure provides:

✅ **Production-ready** webhook processing  
✅ **Fault-tolerant** message handling  
✅ **Scalable** worker architecture  
✅ **Observable** with comprehensive logging  
✅ **Recoverable** with dead letter queues  
✅ **Secure** with signature verification  
✅ **Maintainable** with monitoring tools  

The system is designed to handle high-volume WhatsApp messaging with enterprise-grade reliability and observability.