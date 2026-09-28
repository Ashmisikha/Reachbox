import { config } from './index';

export const queueConfig = {
  redisUrl: config.REDIS_URL,
  workerConcurrency: config.EMAIL_WORKER_CONCURRENCY,
  maxAttempts: config.EMAIL_MAX_ATTEMPTS,
  retryDelayMs: config.EMAIL_RETRY_DELAY_MS,
  schedulingBatchSize: config.EMAIL_SCHEDULING_BATCH_SIZE,
};
