import crypto from 'crypto';
import { slackConfig } from '../../config/slack';
import { bullmqRedis } from '../../queues/redis';
import { SlackOAuthInstallation } from './slack.types';
import { logger } from '../../lib/logger';

export class SlackOAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private botScopes: string;

  constructor(
    clientId: string = slackConfig.SLACK_CLIENT_ID,
    clientSecret: string = slackConfig.SLACK_CLIENT_SECRET,
    redirectUri: string = slackConfig.SLACK_REDIRECT_URI,
    botScopes: string = slackConfig.SLACK_BOT_SCOPES
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.botScopes = botScopes;
  }

  /**
   * Generates a cryptographically secure, single-use OAuth state tied to the authenticated user ID.
   * Persisted in Redis with 10-minute expiration.
   */
  public async generateState(userId: string): Promise<string> {
    if (!userId) {
      throw new Error('User ID is required to generate Slack OAuth state');
    }

    const state = crypto.randomBytes(32).toString('hex');
    const redisKey = `slack-oauth-state:${state}`;

    // Store state with 10-minute TTL (600 seconds)
    await bullmqRedis.set(redisKey, userId, 'EX', 600);

    return state;
  }

  /**
   * Validates and single-use consumes the OAuth state against Redis and cookie.
   * Prevents CSRF and cross-user authorization attacks.
   */
  public async validateAndConsumeState(
    queryState: string,
    cookieState: string,
    currentUserId: string
  ): Promise<boolean> {
    if (!queryState || !cookieState || queryState !== cookieState) {
      logger.warn('Slack OAuth state validation failed: state mismatch or missing');
      const err = new Error('Slack OAuth state mismatch or missing parameter');
      (err as any).code = 'INVALID_SLACK_STATE';
      throw err;
    }

    const redisKey = `slack-oauth-state:${queryState}`;
    const storedUserId = await bullmqRedis.get(redisKey);

    // Atomically invalidate state so it cannot be reused
    await bullmqRedis.del(redisKey);

    if (!storedUserId) {
      logger.warn('Slack OAuth state validation failed: state expired or already consumed');
      const err = new Error('Slack OAuth state expired or already used');
      (err as any).code = 'EXPIRED_SLACK_STATE';
      throw err;
    }

    if (storedUserId !== currentUserId) {
      logger.warn('Slack OAuth state validation failed: state does not match authenticated user', {
        authenticatedUserId: currentUserId,
      });
      const err = new Error('Slack OAuth state does not match authenticated user');
      (err as any).code = 'FORBIDDEN_SLACK_STATE';
      throw err;
    }

    return true;
  }

  /**
   * Generates the official Slack OAuth v2 authorization URL.
   */
  public generateAuthUrl(state: string): string {
    if (!state) {
      throw new Error('OAuth state is required for Slack authorization');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: this.botScopes,
      redirect_uri: this.redirectUri,
      state,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for Slack installation credentials and access token.
   */
  public async exchangeCodeForInstallation(code: string): Promise<SlackOAuthInstallation> {
    if (!code) {
      throw new Error('Authorization code is required');
    }

    const tokenEndpoint = 'https://slack.com/api/oauth.v2.access';
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Slack token exchange HTTP failure: ${errorText}`);
    }

    const data = (await response.json()) as SlackOAuthInstallation;

    if (!data.ok) {
      const errorDesc = data.error || 'unknown_slack_oauth_error';
      throw new Error(`Slack OAuth exchange rejected: ${errorDesc}`);
    }

    if (!data.access_token) {
      throw new Error('Slack OAuth response did not contain an access_token');
    }

    return data;
  }
}

export const slackOAuthService = new SlackOAuthService();
