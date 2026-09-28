import { Queue } from 'bullmq';
import { elasticsearchConfig } from '../config/elasticsearch';
import { bullmqRedis } from './redis';

export const EMAIL_INDEX_QUEUE_NAME = 'email-index';
export const INDEX_EMAIL_JOB_NAME = 'index-email';

export interface IndexEmailJobData {
  emailMessageId: string;
}

export const emailIndexQueue = new Queue<IndexEmailJobData>(EMAIL_INDEX_QUEUE_NAME, {
  connection: bullmqRedis,
  defaultJobOptions: {
    attempts: elasticsearchConfig.indexingMaxAttempts,
    backoff: {
      type: 'exponential',
      delay: elasticsearchConfig.indexingRetryDelayMs,
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

/**
 * Enqueue an email indexing job with a deterministic job ID.
 * Calling this multiple times for the same emailMessageId will not create duplicate pending jobs.
 */
export async function enqueueIndexEmailJob(emailMessageId: string) {
  const jobId = `index-email-${emailMessageId}`;
  return emailIndexQueue.add(
    INDEX_EMAIL_JOB_NAME,
    { emailMessageId },
    {
      jobId,
    }
  );
}
