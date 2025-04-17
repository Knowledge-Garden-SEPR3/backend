/**
 * Cache utility for Knowledge Garden
 * Implements multi-level caching strategy using Redis
 */

const redis = require('redis');
const config = require('../config');
const logger = require('./logger');

// Create Redis client
const redisClient = redis.createClient({
  url: config.redis.url,
});

// Handle Redis connection events
redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('error', (err) => {
  logger.error(`Redis client error: ${err.message}`);
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error(`Redis connection error: ${error.message}`);
  }
})();

/**
 * Set a value in the cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache (will be serialized)
 * @param {number} expiry - Expiry time in seconds
 */
const set = async (key, value, expiry = 3600) => {
  try {
    const serializedValue = JSON.stringify(value);
    await redisClient.set(key, serializedValue, { EX: expiry });
    logger.debug(`Cache set: ${key}`);
  } catch (error) {
    logger.error(`Cache set error: ${error.message}`);
    // Continue execution even if cache fails
  }
};

/**
 * Get a value from the cache
 * @param {string} key - Cache key
 * @returns {any} Parsed cached value or null if not found
 */
const get = async (key) => {
  try {
    const cachedValue = await redisClient.get(key);
    if (cachedValue) {
      logger.debug(`Cache hit: ${key}`);
      return JSON.parse(cachedValue);
    }
    logger.debug(`Cache miss: ${key}`);
    return null;
  } catch (error) {
    logger.error(`Cache get error: ${error.message}`);
    return null; // Continue execution even if cache fails
  }
};

/**
 * Delete a value from the cache
 * @param {string} key - Cache key
 */
const del = async (key) => {
  try {
    await redisClient.del(key);
    logger.debug(`Cache deleted: ${key}`);
  } catch (error) {
    logger.error(`Cache delete error: ${error.message}`);
  }
};

/**
 * Clear cache by pattern
 * @param {string} pattern - Pattern to match keys (e.g., 'users:*')
 */
const clearByPattern = async (pattern) => {
  try {
    let cursor = 0;
    do {
      const reply = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = reply.cursor;
      
      const keys = reply.keys;
      if (keys.length) {
        await redisClient.del(keys);
        logger.debug(`Cleared ${keys.length} keys matching pattern: ${pattern}`);
      }
    } while (cursor !== 0);
  } catch (error) {
    logger.error(`Cache clear by pattern error: ${error.message}`);
  }
};

/**
 * Cache middleware for Express routes
 * @param {number} duration - Cache duration in seconds
 * @returns {Function} Express middleware
 */
const cacheMiddleware = (duration = 3600) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Create a cache key from the request URL
    const key = `api:${req.originalUrl}`;

    try {
      // Try to get cached response
      const cachedResponse = await get(key);
      
      if (cachedResponse) {
        // Return cached response
        return res.status(200).json({
          ...cachedResponse,
          fromCache: true
        });
      }

      // Store the original send function
      const originalSend = res.send;

      // Override send function to cache response
      res.send = function(body) {
        try {
          const responseBody = JSON.parse(body);
          // Only cache successful responses
          if (res.statusCode === 200) {
            set(key, responseBody, duration);
          }
        } catch (error) {
          logger.error(`Cache middleware error: ${error.message}`);
        }
        
        // Call original send
        return originalSend.call(this, body);
      };

      next();
    } catch (error) {
      logger.error(`Cache middleware error: ${error.message}`);
      next();
    }
  };
};

module.exports = {
  set,
  get,
  del,
  clearByPattern,
  cacheMiddleware,
  redisClient
};
