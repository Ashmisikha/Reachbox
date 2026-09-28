import { Job, Worker } from 'bullmq';
import { elasticsearchConfig } from '../config/elasticsearch';
import { logger } from '../lib/logger';
import prisma from '../lib/prisma';
import { bullmqRedis } from '../queues/redis';
import {
  EMAIL_INDEX_QUEUE_NAME,
  type IndexEmailJobData,
} from '../queues/email-index.queue';
import {
  emailIndexService,
  EmailIndexService,
} from '../services/search/email-index.service';

export interface EmailIndexWorkerOptions {
  concurrency?: number;
}

export function createEmailIndexWorker(
  options?: EmailIndexWorkerOptions
): Worker<IndexEmailJobData> {
  const concurrency =
    options?.concurrency ?? elasticsearchConfig.indexingWorkerConcurrency;

  const worker = new Worker<IndexEmailJobData>(
    EMAIL_INDEX_QUEUE_NAME,
    async (job) => {
      await processIndexEmailJob(job);
    },
    {
      connection: bullmqRedis,
      concurrency,
    }
  );

  worker.on('error', (error) => {
    logger.error('Email index worker encountered error', {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return worker;
}

export async function processIndexEmailJob(
  job: Job<IndexEmailJobData>
): Promise<void> {
  const { emailMessageId } = job.data;

  const message = await prisma.emailMessage.findUnique({
    where: { id: emailMessageId },
    include: {
      sender: true,
      campaign: true,
    },
  });

  if (!message) {
    logger.warn('Email message not found for indexing, skipping', {
      emailMessageId,
      jobId: job.id,
    });
    return;
  }

  // Only index emails that have reached SENT status (or are scheduled/draft if relevant)
  // Per Section 7: "If SMTP succeeds: PostgreSQL SENT/COMPLETED -> attempt Elasticsearch indexing"
  const doc = EmailIndexService.transformToDocument(message);

  try {
    const result = await emailIndexService.indexEmail(doc);
    logger.info('Email message indexed in Elasticsearch', {
      emailMessageId: message.id,
      campaignId: message.campaignId,
      senderId: message.senderId,
      recipient: message.recipient,
      action: result.action,
      jobId: job.id,
      attempt: job.attemptsMade + 1,
    });
  } catch (error) {
    logger.error('Failed to index email message in Elasticsearch', {
      emailMessageId: message.id,
      campaignId: message.campaignId,
      senderId: message.senderId,
      recipient: message.recipient,
      jobId: job.id,
      attempt: job.attemptsMade + 1,
      error: error instanceof Error ? error.message : String(error),
    });

    // Rethrow to trigger BullMQ exponential backoff retry.
    // Critical: this does NOT affect PostgreSQL email state (remains SENT).
    throw error;
  }
}
