import IORedis from 'ioredis';
import { queueConfig } from '../config/queue';

export const bullmqRedis = new IORedis(queueConfig.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 2) {
      return null;
    }
    return Math.min(times * 100, 1000);
  },
});

export async function checkRedisConnection(): Promise<void> {
  if (bullmqRedis.status !== 'ready' && bullmqRedis.status !== 'connecting') {
    await bullmqRedis.connect();
  }
  await bullmqRedis.ping();
}

export async function closeRedisConnection(): Promise<void> {
  if (bullmqRedis.status === 'ready' || bullmqRedis.status === 'connecting') {
    await bullmqRedis.quit();
  }
}
