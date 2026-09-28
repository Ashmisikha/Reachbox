import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

export const redis = new Redis(config.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  logger.warn('Redis client error', { error: err.message });
});

export async function checkRedisConnection(): Promise<boolean> {
  try {
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect();
    }
    const pingResponse = await redis.ping();
    return pingResponse === 'PONG';
  } catch (error) {
    logger.warn('Redis connection check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (redis.status === 'ready' || redis.status === 'connecting') {
    await redis.quit();
  }
}
