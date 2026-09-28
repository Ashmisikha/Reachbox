import { Queue } from 'bullmq';
import { queueConfig } from '../config/queue';
import { bullmqRedis } from './redis';
import type { SendEmailJobData } from './email-job.types';

export const EMAIL_QUEUE_NAME = 'email-dispatch';
export const SEND_EMAIL_JOB_NAME = 'send-email';

export const emailQueue = new Queue<SendEmailJobData>(EMAIL_QUEUE_NAME, {
  connection: bullmqRedis,
  defaultJobOptions: {
    attempts: queueConfig.maxAttempts,
    backoff: {
      type: 'exponential',
      delay: queueConfig.retryDelayMs,
    },
    removeOnComplete: {
      age: 60 * 60,
      count: 1_000,
    },
    removeOnFail: {
      age: 24 * 60 * 60,
      count: 5_000,
    },
  },
});

export { enqueueEmailJob, enqueueEmailBatch } from './email-enqueue.service';

