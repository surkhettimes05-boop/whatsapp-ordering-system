# BullMQ + Redis Setup Guide

## Overview
Distributed job queue system using BullMQ and Redis for:
- WhatsApp message sending
- Order expiry processing
- Vendor fallback handling
- Daily reports generation
- Credit reconciliation
- Bidding timeout management
- Wholesaler confirmation timeout
- Payment reminders

## Prerequisites

### Install Redis
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis:latest
```

### Environment Variables
Add to `.env`:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Optional, leave empty if no password
```

## Architecture

### Components

1. **Queue** (`queue.js`)
   - Queue configuration
   - Retry policies
   - Dead-letter queue setup
   - Job metrics

2. **Worker** (`worker.js`)
   - Job processors
   - Error handling
   - Event logging

3. **Processors** (`processors/`)
   - Individual job processors
   - Business logic execution

4. **Scheduler** (`scheduler.js`)
   - Recurring job scheduling
   - Cron-like patterns

## Job Types

### WhatsApp Message Send
- **Queue**: `whatsapp-message-send`
- **Retries**: 3 attempts with exponential backoff
- **Use Case**: Send WhatsApp messages asynchronously

### Order Expiry
- **Queue**: `order-expiry`
- **Retries**: 1 attempt
- **Use Case**: Process expired orders

### Vendor Fallback
- **Queue**: `vendor-fallback`
- **Retries**: 2 attempts
- **Use Case**: Re-assign orders when vendor fails

### Daily Reports
- **Queue**: `daily-reports`
- **Schedule**: Daily at midnight
- **Use Case**: Generate and send daily analytics

### Credit Reconciliation
- **Queue**: `credit-reconciliation`
- **Schedule**: Daily at 2 AM
- **Use Case**: Reconcile credit accounts

### Bidding Timeout
- **Queue**: `bidding-timeout`
- **Schedule**: Every 2 minutes
- **Use Case**: Auto-select winners when bidding expires

### Wholesaler Confirmation Timeout
- **Queue**: `wholesaler-confirmation-timeout`
- **Schedule**: Every 2 minutes
- **Use Case**: Handle wholesaler confirmation timeouts

### Payment Reminders
- **Queue**: `payment-reminders`
- **Schedule**: Daily at 9 AM
- **Use Case**: Send payment reminders for overdue invoices

## Usage

### Adding Jobs

```javascript
const { addJob, JOB_TYPES } = require('./queue/queue');

// Add immediate job
await addJob(JOB_TYPES.WHATSAPP_MESSAGE_SEND, {
    phoneNumber: '+9779800000000',
    message: 'Hello!'
});

// Add delayed job (5 minutes)
await addDelayedJob(
    JOB_TYPES.ORDER_EXPIRY,
    { orderId: 'order-123' },
    5 * 60 * 1000
);
```

### Scheduling Jobs

```javascript
const { addScheduledJob, JOB_TYPES } = require('./queue/queue');

// Schedule daily job
await addScheduledJob(
    JOB_TYPES.DAILY_REPORTS,
    { reportType: 'all' },
    '0 0 * * *' // Daily at midnight
);
```

## Retry Policies

### Exponential Backoff
```javascript
{
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 2000 // Start with 2 seconds
    }
}
```

### Fixed Delay
```javascript
{
    attempts: 2,
    backoff: {
        type: 'fixed',
        delay: 5000 // 5 seconds between retries
    }
}
```

## Dead-Letter Queue

Failed jobs after all retries are moved to dead-letter queue:
- Queue name: `{queueName}-dlq`
- Access via: `GET /api/v1/queue/dead-letter/:queueName`
- Can be retried manually: `POST /api/v1/queue/retry/:queueName/:jobId`

## Monitoring

### API Endpoints

#### Get All Metrics
```
GET /api/v1/queue/metrics
```

Response:
```json
{
    "success": true,
    "data": {
        "queues": [
            {
                "queueName": "whatsapp-message-send",
                "waiting": 10,
                "active": 2,
                "completed": 1500,
                "failed": 5,
                "delayed": 3,
                "total": 1520
            }
        ],
        "totals": {
            "waiting": 50,
            "active": 10,
            "completed": 5000,
            "failed": 20,
            "delayed": 5,
            "total": 5085
        }
    }
}
```

#### Get Queue Metrics
```
GET /api/v1/queue/metrics/:queueName
```

#### Get Dead-Letter Jobs
```
GET /api/v1/queue/dead-letter/:queueName
```

#### Retry Failed Job
```
POST /api/v1/queue/retry/:queueName/:jobId
```

#### Clean Failed Jobs
```
POST /api/v1/queue/clean/:queueName
Body: { "limit": 100 }
```

## Monitoring Dashboard

### Basic Dashboard Endpoint
```
GET /api/v1/queue/dashboard
```

Returns:
- Queue health status
- Job statistics
- Failed job alerts
- Performance metrics

## Best Practices

1. **Always handle errors** - Jobs should throw errors to trigger retries
2. **Use idempotent operations** - Jobs should be safe to retry
3. **Monitor dead-letter queue** - Check regularly for failed jobs
4. **Set appropriate retry policies** - Balance between reliability and performance
5. **Use delayed jobs** - For time-based operations instead of polling
6. **Clean up old jobs** - Configure `removeOnComplete` and `removeOnFail`

## Migration from node-schedule

Existing `node-schedule` jobs can be gradually migrated:

1. Create processor in `processors/`
2. Add job type to `JOB_TYPES`
3. Schedule via `scheduler.js` or `addScheduledJob()`
4. Remove old `node-schedule` job file

## Troubleshooting

### Redis Connection Issues
```bash
# Check Redis is running
redis-cli ping
# Should return: PONG
```

### Job Not Processing
1. Check worker is running
2. Check Redis connection
3. Check job data format
4. Check processor error logs

### High Failed Job Count
1. Check dead-letter queue
2. Review error messages
3. Adjust retry policies
4. Fix underlying issues

## Performance Tuning

### Worker Concurrency
```javascript
// In worker.js
const WORKER_CONFIG = {
    concurrency: 5, // Adjust based on workload
    limiter: {
        max: 10, // Max jobs per second
        duration: 1000
    }
};
```

### Redis Configuration
- Use Redis persistence for production
- Configure memory limits
- Monitor Redis memory usage
- Use Redis Cluster for high availability
