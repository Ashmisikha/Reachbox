import prisma from '../../lib/prisma';
import { encryptSlackToken, decryptSlackToken } from './slack-crypto';
import {
  SlackOAuthInstallation,
  SlackConnectionRecord,
  SlackPublicStatus,
} from './slack.types';
import { logger } from '../../lib/logger';

export class SlackConnectionService {
  /**
   * Persists or updates a Slack installation for the authenticated user.
   * Access tokens are encrypted before saving.
   */
  public async saveConnection(
    userId: string,
    installation: SlackOAuthInstallation
  ): Promise<SlackConnectionRecord> {
    if (!userId) {
      throw new Error('User ID is required to save Slack connection');
    }

    const encryptedToken = encryptSlackToken(installation.access_token);

    const record = await prisma.slackConnection.upsert({
      where: { userId },
      create: {
        userId,
        teamId: installation.team?.id || null,
        teamName: installation.team?.name || null,
        accessToken: encryptedToken,
        slackUserId: installation.authed_user?.id || null,
        botUserId: installation.bot_user_id || null,
        channelId: installation.incoming_webhook?.channel_id || null,
        channelName: installation.incoming_webhook?.channel || null,
        incomingWebhookUrl: installation.incoming_webhook?.url || null,
        status: 'CONNECTED',
      },
      update: {
        teamId: installation.team?.id || null,
        teamName: installation.team?.name || null,
        accessToken: encryptedToken,
        slackUserId: installation.authed_user?.id || null,
        botUserId: installation.bot_user_id || null,
        channelId: installation.incoming_webhook?.channel_id || null,
        channelName: installation.incoming_webhook?.channel || null,
        incomingWebhookUrl: installation.incoming_webhook?.url || null,
        status: 'CONNECTED',
      },
    });

    logger.info('Slack connection persisted successfully', {
      userId,
      teamId: record.teamId,
      teamName: record.teamName,
    });

    return {
      ...record,
      accessToken: installation.access_token,
    };
  }

  /**
   * Loads an active Slack connection for a user with the decrypted access token.
   */
  public async getConnection(userId: string): Promise<SlackConnectionRecord | null> {
    if (!userId) {
      return null;
    }

    const record = await prisma.slackConnection.findUnique({
      where: { userId },
    });

    if (!record) {
      return null;
    }

    return {
      ...record,
      accessToken: decryptSlackToken(record.accessToken),
    };
  }

  /**
   * Returns sanitized public status safe for API exposure to frontend.
   * Never leaks access tokens, webhook secrets, or client credentials.
   */
  public async getPublicStatus(userId: string): Promise<SlackPublicStatus> {
    const record = await prisma.slackConnection.findUnique({
      where: { userId },
    });

    if (!record || record.status === 'DISCONNECTED') {
      return {
        connected: false,
        status: 'DISCONNECTED',
      };
    }

    return {
      connected: record.status === 'CONNECTED',
      teamName: record.teamName || undefined,
      teamId: record.teamId || undefined,
      channelName: record.channelName || undefined,
      connectedAt: record.createdAt.toISOString(),
      status: record.status,
    };
  }

  /**
   * Disconnects and permanently removes the Slack connection for the user.
   */
  public async disconnect(userId: string): Promise<boolean> {
    if (!userId) {
      return false;
    }

    const result = await prisma.slackConnection.deleteMany({
      where: { userId },
    });

    logger.info('Slack connection removed', { userId });

    return result.count > 0;
  }

  /**
   * Marks a connection as REVOKED when Slack reports an invalid or revoked token.
   */
  public async markRevoked(userId: string): Promise<void> {
    await prisma.slackConnection.updateMany({
      where: { userId },
      data: {
        status: 'REVOKED',
      },
    });

    logger.warn('Slack connection marked as REVOKED', { userId });
  }
}

export const slackConnectionService = new SlackConnectionService();
