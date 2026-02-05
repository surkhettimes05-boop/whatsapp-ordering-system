const Redis = require('ioredis');
const { logger } = require('./logger');
require('dotenv').config();

class RedisManager {
  constructor() {
    this.connections = new Map();
    this.isConnected = false;
  }

  // Create Redis connection with retry logic
  createConnection(name = 'default', options = {}) {
    const config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB) || 0,
      maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES) || 3,
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY) || 1000,
      enableReadyCheck: true,
      lazyConnect: true,
      ...options
    };

    const redis = new Redis(config);

    // Connection event handlers
    redis.on('connect', () => {
      logger.info(`Redis connection established: ${name}`, { 
        action: 'redis_connected',
        connectionName: name 
      });
      this.isConnected = true;
    });

    redis.on('ready', () => {
      logger.info(`Redis connection ready: ${name}`, { 
        action: 'redis_ready',
        connectionName: name 
      });
    });

    redis.on('error', (error) => {
      logger.error(`Redis connection error: ${name}`, { 
        action: 'redis_error',
        connectionName: name,
        error: error.message 
      });
      this.isConnected = false;
    });

    redis.on('close', () => {
      logger.warn(`Redis connection closed: ${name}`, { 
        action: 'redis_closed',
        connectionName: name 
      });
      this.isConnected = false;
    });

    redis.on('reconnecting', () => {
      logger.info(`Redis reconnecting: ${name}`, { 
        action: 'redis_reconnecting',
        connectionName: name 
      });
    });

    this.connections.set(name, redis);
    return redis;
  }

  // Get existing connection
  getConnection(name = 'default') {
    return this.connections.get(name);
  }

  // Create all required connections
  async initializeConnections() {
    try {
      // Main connection for BullMQ
      const mainRedis = this.createConnection('main');
      await mainRedis.connect();

      // Separate connection for deduplication cache
      const cacheRedis = this.createConnection('cache', { db: 1 });
      await cacheRedis.connect();

      // Separate connection for metrics
      const metricsRedis = this.createConnection('metrics', { db: 2 });
      await metricsRedis.connect();

      logger.info('All Redis connections initialized', { 
        action: 'redis_init_complete',
        connections: Array.from(this.connections.keys())
      });

      return true;
    } catch (error) {
      logger.error('Failed to initialize Redis connections', { 
        action: 'redis_init_failed',
        error: error.message 
      });
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    const results = {};
    
    for (const [name, redis] of this.connections) {
      try {
        const start = Date.now();
        await redis.ping();
        results[name] = {
          status: 'healthy',
          responseTime: Date.now() - start
        };
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }

    return results;
  }

  // Graceful shutdown
  async shutdown() {
    logger.info('Shutting down Redis connections', { action: 'redis_shutdown' });
    
    const shutdownPromises = Array.from(this.connections.values()).map(redis => 
      redis.disconnect()
    );

    await Promise.all(shutdownPromises);
    this.connections.clear();
    this.isConnected = false;
    
    logger.info('Redis connections closed', { action: 'redis_shutdown_complete' });
  }
}

// Message deduplication using Redis
class MessageDeduplicator {
  constructor(redisConnection) {
    this.redis = redisConnection;
    this.ttl = parseInt(process.env.MESSAGE_DEDUP_TTL) || 3600; // 1 hour
    this.enabled = process.env.MESSAGE_DEDUP_ENABLED === 'true';
  }

  async isDuplicate(messageId) {
    if (!this.enabled) return false;

    try {
      const key = `dedup:${messageId}`;
      const exists = await this.redis.exists(key);
      
      if (exists) {
        logger.warn('Duplicate message detected', { 
          action: 'duplicate_detected',
          messageId 
        });
        return true;
      }

      // Mark message as seen
      await this.redis.setex(key, this.ttl, Date.now());
      return false;
    } catch (error) {
      logger.error('Deduplication check failed', { 
        action: 'dedup_error',
        messageId,
        error: error.message 
      });
      // Fail open - allow message through if dedup fails
      return false;
    }
  }

  async markProcessed(messageId, result) {
    if (!this.enabled) return;

    try {
      const key = `processed:${messageId}`;
      await this.redis.setex(key, this.ttl, JSON.stringify({
        processedAt: Date.now(),
        result: result?.action || 'unknown'
      }));
    } catch (error) {
      logger.error('Failed to mark message as processed', { 
        action: 'mark_processed_error',
        messageId,
        error: error.message 
      });
    }
  }
}

// Export singleton instance
const redisManager = new RedisManager();

module.exports = {
  redisManager,
  MessageDeduplicator
};