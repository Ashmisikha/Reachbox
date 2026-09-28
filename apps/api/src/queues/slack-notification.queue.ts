import { Queue } from 'bullmq';
import { slackConfig } from '../config/slack';
import { bullmqRedis } from './redis';
import { RateLimitNotificationPayload } from '../services/slack/slack.types';

export const SLACK_NOTIFICATION_QUEUE_NAME = 'slack-notification';
export const SLACK_RATE_LIMIT_JOB_NAME = 'rate-limit-notification';

export const slackNotificationQueue = new Queue<RateLimitNotificationPayload>(
  SLACK_NOTIFICATION_QUEUE_NAME,
  {
    connection: bullmqRedis,
    defaultJobOptions: {
      attempts: slackConfig.SLACK_NOTIFICATION_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: slackConfig.SLACK_NOTIFICATION_BACKOFF_MS,
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
  }
);

/**
 * Enqueue a Slack rate-limit notification job with a deterministic job ID.
 * Prevents duplicate notification queueing for the same hourly window across workers.
 */
export async function enqueueSlackNotificationJob(
  payload: RateLimitNotificationPayload,
  hourWindow: number = Math.floor(Date.now() / 3600000)
) {
  const jobId = `slack-rate-limit-${payload.userId}-${payload.campaignId}-${payload.senderId}-${hourWindow}`;

  return slackNotificationQueue.add(SLACK_RATE_LIMIT_JOB_NAME, payload, {
    jobId,
  });
}
