import { bullmqRedis } from '../../queues/redis';
import { enqueueSlackNotificationJob } from '../../queues/slack-notification.queue';
import { slackConnectionService, SlackConnectionService } from './slack-connection.service';
import { RateLimitNotificationPayload, SlackConnectionRecord } from './slack.types';
import { slackConfig } from '../../config/slack';
import { logger } from '../../lib/logger';

export class SlackNotificationService {
  private connectionService: SlackConnectionService;

  constructor(connectionService: SlackConnectionService = slackConnectionService) {
    this.connectionService = connectionService;
  }

  /**
   * Evaluates distributed deduplication using Redis and enqueues the Slack notification.
   * Atomic SET ... NX EX ensures only one notification is dispatched per hour window across all workers.
   */
  public async notifyRateLimitReached(
    payload: RateLimitNotificationPayload
  ): Promise<{ enqueued: boolean; reason?: string }> {
    const hourWindow = Math.floor(Date.now() / 3600000);
    const dedupKey = `slack-rate-limit:${payload.userId}:${payload.campaignId}:${payload.senderId}:${hourWindow}`;

    // Atomic Redis acquisition: returns 'OK' if key did not exist, null if already set
    const acquired = await bullmqRedis.set(dedupKey, '1', 'EX', 3600, 'NX');

    if (acquired !== 'OK') {
      logger.debug('Slack rate-limit notification deduplicated for current hour window', {
        userId: payload.userId,
        campaignId: payload.campaignId,
        senderId: payload.senderId,
        hourWindow,
      });
      return { enqueued: false, reason: 'DEDUPLICATED' };
    }

    try {
      await enqueueSlackNotificationJob(payload, hourWindow);
      logger.info('Enqueued Slack rate-limit notification job', {
        userId: payload.userId,
        campaignId: payload.campaignId,
        senderId: payload.senderId,
        hourWindow,
      });
      return { enqueued: true };
    } catch (err: any) {
      logger.error('Failed to enqueue Slack notification job', {
        error: err.message,
        userId: payload.userId,
      });
      return { enqueued: false, reason: 'ENQUEUE_FAILED' };
    }
  }

  /**
   * Formats and posts a rate limit notification to Slack using the user's active connection.
   * If Slack token is revoked, marks the connection revoked without throwing fatal errors.
   */
  public async dispatchRateLimitNotification(
    connection: SlackConnectionRecord,
    payload: RateLimitNotificationPayload
  ): Promise<{ delivered: boolean; revoked?: boolean }> {
    const retryAtIso = new Date(Date.now() + payload.retryAfterMs).toISOString();

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 ReachInbox Email Hourly Rate Limit Reached',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Campaign:*\n${payload.campaignSubject || payload.campaignId}`,
          },
          {
            type: 'mrkdwn',
            text: `*Sender:*\n${payload.senderEmail}`,
          },
          {
            type: 'mrkdwn',
            text: `*Hourly Quota:*\n${payload.hourlyLimit} emails/hr`,
          },
          {
            type: 'mrkdwn',
            text: `*Next Available Slot:*\n${retryAtIso}`,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Emails are safely queued and will automatically resume delivery once the window resets.',
          },
        ],
      },
    ];

    const fallbackText = `🚨 ReachInbox Rate Limit Reached: Sender ${payload.senderEmail} exceeded ${payload.hourlyLimit} emails/hr. Next slot at ${retryAtIso}.`;

    // 1. Post via Incoming Webhook if available
    if (connection.incomingWebhookUrl) {
      const response = await fetch(connection.incomingWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: fallbackText,
          blocks,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Slack webhook dispatch failed HTTP ${response.status}: ${errorText}`);
      }

      return { delivered: true };
    }

    // 2. Post via chat.postMessage API using decrypted bot/user access token
    if (connection.accessToken) {
      const channel = connection.channelId || slackConfig.SLACK_DEFAULT_CHANNEL;

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          channel,
          text: fallbackText,
          blocks,
        }),
      });

      if (!response.ok) {
        throw new Error(`Slack chat.postMessage HTTP error: ${response.status}`);
      }

      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!data.ok) {
        const error = data.error || 'unknown_error';

        // Check for permanent authorization / revocation failures
        if (
          error === 'token_revoked' ||
          error === 'account_inactive' ||
          error === 'invalid_auth'
        ) {
          logger.warn('Slack authorization revoked by workspace; marking connection REVOKED', {
            userId: connection.userId,
            error,
          });
          await this.connectionService.markRevoked(connection.userId);
          return { delivered: false, revoked: true };
        }

        // Retryable Slack error (channel_not_found, rate_limited, etc.)
        throw new Error(`Slack API error: ${error}`);
      }

      return { delivered: true };
    }

    throw new Error('Slack connection has neither webhook URL nor access token');
  }
}

export const slackNotificationService = new SlackNotificationService();
