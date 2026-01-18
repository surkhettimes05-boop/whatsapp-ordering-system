# Distributed Job Queue System

## Overview
Production-grade distributed job handling using BullMQ and Redis:
- **WhatsApp message sending** - Async message queue
- **Order expiry processing** - Scheduled expiry checks
- **Vendor fallback** - Retry logic for failed vendors
- **Daily reports** - Scheduled report generation
- **Credit reconciliation** - Periodic credit account reconciliation

## Architecture

### Components

1. **Queue Configuration** (`queue.config.js`)
   - Redis connection setup
   - Queue definitions with retry policies
   - Dead-letter queue configuration

2. **Workers** (`worker.js`)
   - Job processors for each queue
   - Concurrency control
   - Rate limiting
   - Error handling

3. **Job Processors** (`processors/`)
   - Individual processors for each job type
   - Business logic implementation
   - Error handling

4. **Job Scheduler** (`jobScheduler.js`)
   - Recurring job scheduling
   - Cron-based triggers

5. **Monitoring** (`monitoring.js`)
   - Queue metrics
   - Job status tracking
   - Dead-letter queue management

## Queues

### 1. WhatsApp Messages (`whatsapp`)
- **Purpose**: Send WhatsApp messages asynchronously
- **Concurrency**: 5
- **Retry**: 3 attempts, exponential backoff (2s, 4s, 8s)
- **Rate Limit**: 100 jobs/minute

### 2. Order Expiry (`orderExpiry`)
- **Purpose**: Process expired orders
- **Concurrency**: 3
- **Retry**: 2 attempts, fixed backoff (5s)
- **Rate Limit**: 50 jobs/minute

### 3. Vendor Fallback (`vendorFallback`)
- **Purpose**: Handle vendor confirmation failures
- **Concurrency**: 2
- **Retry**: 3 attempts, exponential backoff (3s, 6s, 12s)
- **Rate Limit**: 20 jobs/minute

### 4. Daily Reports (`dailyReports`)
- **Purpose**: Generate daily reports
- **Concurrency**: 1
- **Retry**: 2 attempts, fixed backoff (10s)
- **Rate Limit**: 10 jobs/minute

### 5. Credit Reconciliation (`creditReconciliation`)
- **Purpose**: Reconcile credit accounts
- **Concurrency**: 2
- **Retry**: 3 attempts, exponential backoff (5s, 10s, 20s)
- **Rate Limit**: 30 jobs/minute

## Retry Policies

### Exponential Backoff
```javascript
{
    type: 'exponential',
    delay: 2000, // 2s, 4s, 8s
}
```

### Fixed Backoff
```javascript
{
    type: 'fixed',
    delay: 5000, // 5s, 5s, 5s
}
```

## Dead-Letter Queue

Jobs that fail after all retry attempts are moved to the dead-letter queue:
- Never automatically removed
- Manual intervention required
- Contains original job data and error details

## Usage

### Adding Jobs

```javascript
const queueHelpers = require('./queue/queue');

// Add WhatsApp message
await queueHelpers.addWhatsAppMessage(
    '+9779800000000',
    'Hello!',
    { priority: 'high' }
);

// Add order expiry job
await queueHelpers.addOrderExpiryJob(
    orderId,
    new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
);

// Add vendor fallback
await queueHelpers.addVendorFallbackJob(
    orderId,
    failedWholesalerId
);
```

### Monitoring

```javascript
const monitoring = require('./queue/monitoring');

// Get all metrics
const metrics = await monitoring.getAllMetrics();

// Get queue-specific metrics
const whatsappMetrics = await monitoring.getQueueMetrics('whatsapp');

// Get failed jobs
const failedJobs = await monitoring.getFailedJobs('whatsapp', 50);

// Retry failed job
await monitoring.retryJob('whatsapp', jobId);
```

## API Endpoints

### Metrics
- `GET /api/v1/queue/metrics` - All queue metrics
- `GET /api/v1/queue/metrics/:queueName` - Queue-specific metrics

### Job Management
- `GET /api/v1/queue/jobs/:queueName/:jobId` - Job details
- `GET /api/v1/queue/failed/:queueName` - Failed jobs
- `GET /api/v1/queue/dead-letter` - Dead-letter queue
- `POST /api/v1/queue/retry/:queueName/:jobId` - Retry job
- `DELETE /api/v1/queue/jobs/:queueName/:jobId` - Remove job
- `POST /api/v1/queue/jobs/:queueName` - Add job manually

## Environment Variables

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
```

## Setup

1. Install dependencies:
```bash
npm install bullmq ioredis
```

2. Start Redis:
```bash
redis-server
```

3. Initialize queue system (automatic on app start)

## Monitoring Dashboard

Access queue metrics via API endpoints or integrate with monitoring tools like:
- Bull Board
- Grafana
- Custom dashboard

## Best Practices

1. **Always handle errors** - Jobs should throw errors for retry mechanism
2. **Use appropriate concurrency** - Balance throughput vs resource usage
3. **Monitor dead-letter queue** - Regularly check for failed jobs
4. **Set job priorities** - Use priority for urgent jobs
5. **Clean up old jobs** - Configure `removeOnComplete` and `removeOnFail`
