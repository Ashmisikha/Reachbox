import { Worker, Job } from 'bullmq';
import { bullmqRedis } from '../queues/redis';
import {
  SLACK_NOTIFICATION_QUEUE_NAME,
  SLACK_RATE_LIMIT_JOB_NAME,
} from '../queues/slack-notification.queue';
import { slackConfig } from '../config/slack';
import { slackConnectionService } from '../services/slack/slack-connection.service';
import { slackNotificationService } from '../services/slack/slack-notification.service';
import { RateLimitNotificationPayload } from '../services/slack/slack.types';
import { logger } from '../lib/logger';

/**
 * Processes a single Slack rate-limit notification job.
 * Loads the connection dynamically from PostgreSQL so newly connected accounts work instantly without restart.
 */
export async function processSlackNotificationJob(
  job: Job<RateLimitNotificationPayload>
): Promise<void> {
  const { userId, campaignId, senderEmail, hourlyLimit } = job.data;

  // 1. Dynamic lookup: load current Slack connection from PostgreSQL
  const connection = await slackConnectionService.getConnection(userId);

  if (!connection || connection.status !== 'CONNECTED') {
    logger.info('No active Slack connection found for user; skipping rate-limit notification', {
      userId,
      campaignId,
      jobId: job.id,
    });
    return;
  }

  // 2. Dispatch the notification
  logger.info('Dispatching Slack rate-limit notification', {
    userId,
    campaignId,
    senderEmail,
    hourlyLimit,
    jobId: job.id,
  });

  const result = await slackNotificationService.dispatchRateLimitNotification(
    connection,
    job.data
  );

  if (result.revoked) {
    logger.warn('Slack connection was revoked; notification marked complete without retry', {
      userId,
      jobId: job.id,
    });
    return;
  }

  logger.info('Slack rate-limit notification dispatched successfully', {
    userId,
    campaignId,
    jobId: job.id,
  });
}

/**
 * Creates and starts the dedicated BullMQ Slack notification worker.
 */
export function createSlackNotificationWorker(
  concurrency: number = slackConfig.SLACK_NOTIFICATION_CONCURRENCY
): Worker<RateLimitNotificationPayload> {
  const worker = new Worker<RateLimitNotificationPayload>(
    SLACK_NOTIFICATION_QUEUE_NAME,
    async (job: Job<RateLimitNotificationPayload>) => {
      if (job.name === SLACK_RATE_LIMIT_JOB_NAME) {
        await processSlackNotificationJob(job);
      }
    },
    {
      connection: bullmqRedis,
      concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error('Slack notification worker job failed', {
      jobId: job?.id,
      error: err.message,
      attemptsMade: job?.attemptsMade,
    });
  });

  return worker;
}

export const slackNotificationWorker = createSlackNotificationWorker();
