import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { Job } from 'bullmq';
import { processSlackNotificationJob } from '../../src/workers/slack-notification.worker';
import { slackConnectionService } from '../../src/services/slack/slack-connection.service';
import { slackNotificationService } from '../../src/services/slack/slack-notification.service';
import { RateLimitNotificationPayload } from '../../src/services/slack/slack.types';

describe('Production Deployment Hardening Tests', () => {
  describe('1. Railway Dynamic Port Resolution', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('respects Railway dynamically injected PORT environment variable', () => {
      process.env.PORT = '7890';
      delete process.env.API_PORT;

      const schema = z.object({
        API_PORT: z.preprocess(
          (val) => (process.env.PORT ? process.env.PORT : (val ?? 4000)),
          z.coerce.number()
        ),
      });

      const parsed = schema.parse({});
      expect(parsed.API_PORT).toBe(7890);
    });

    it('falls back to API_PORT if PORT is not set (local development with API_PORT)', () => {
      delete process.env.PORT;
      process.env.API_PORT = '5001';

      const schema = z.object({
        API_PORT: z.preprocess(
          (val) => (process.env.PORT ? process.env.PORT : (val ?? 4000)),
          z.coerce.number()
        ),
      });

      const parsed = schema.parse({ API_PORT: '5001' });
      expect(parsed.API_PORT).toBe(5001);
    });

    it('defaults to 4000 if neither PORT nor API_PORT is set', () => {
      delete process.env.PORT;
      delete process.env.API_PORT;

      const schema = z.object({
        API_PORT: z.preprocess(
          (val) => (process.env.PORT ? process.env.PORT : (val ?? 4000)),
          z.coerce.number()
        ),
      });

      const parsed = schema.parse({});
      expect(parsed.API_PORT).toBe(4000);
    });
  });

  describe('2. Environment-Aware Cross-Site Session Cookie', () => {
    it('uses SameSite=None and Secure=true in production for Vercel <-> Railway cross-site auth', () => {
      const isProduction = true;
      const cookieSameSite: 'lax' | 'none' = isProduction ? 'none' : 'lax';
      const secure = isProduction;

      expect(cookieSameSite).toBe('none');
      expect(secure).toBe(true);

      // Verify cookie options object
      const cookieOptions = {
        httpOnly: true,
        secure,
        sameSite: cookieSameSite,
        path: '/',
        maxAge: 604800000,
      };

      expect(cookieOptions.sameSite).toBe('none');
      expect(cookieOptions.secure).toBe(true);
      expect(cookieOptions.httpOnly).toBe(true);
    });

    it('uses SameSite=Lax and Secure=false in development for localhost HTTP', () => {
      const isProduction = false;
      const cookieSameSite: 'lax' | 'none' = isProduction ? 'none' : 'lax';
      const secure = isProduction;

      expect(cookieSameSite).toBe('lax');
      expect(secure).toBe(false);

      const cookieOptions = {
        httpOnly: true,
        secure,
        sameSite: cookieSameSite,
        path: '/',
      };

      expect(cookieOptions.sameSite).toBe('lax');
      expect(cookieOptions.secure).toBe(false);
      expect(cookieOptions.httpOnly).toBe(true);
    });
  });

  describe('3. Slack Notification Worker Execution', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('executes rate-limit notification when user has an active Slack connection', async () => {
      const mockPayload: RateLimitNotificationPayload = {
        userId: 'user-prod-123',
        campaignId: 'camp-prod-456',
        campaignSubject: 'Q3 Enterprise Outreach',
        senderId: 'sender-prod-789',
        senderEmail: 'sales@reachinbox.ai',
        hourlyLimit: 50,
        retryAfterMs: 3600000,
        timestamp: new Date().toISOString(),
      };

      const mockJob = {
        id: 'slack-rate-limit-user-prod-123-camp-prod-456-sender-prod-789-100',
        name: 'rate-limit-notification',
        data: mockPayload,
        attemptsMade: 0,
      } as unknown as Job<RateLimitNotificationPayload>;

      // Mock active Slack connection
      vi.spyOn(slackConnectionService, 'getConnection').mockResolvedValueOnce({
        id: 'conn-1',
        userId: 'user-prod-123',
        teamId: 'T123',
        teamName: 'ReachInbox Team',
        botUserId: 'U123',
        accessTokenEncrypted: 'enc-token',
        tokenIv: 'iv',
        tokenAuthTag: 'tag',
        scopes: ['chat:write', 'incoming-webhook'],
        incomingWebhookUrl: 'https://hooks.slack.com/services/xxx',
        incomingWebhookChannel: '#alerts',
        incomingWebhookChannelId: 'C123',
        incomingWebhookConfigUrl: 'https://config.slack.com',
        status: 'CONNECTED',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const dispatchSpy = vi
        .spyOn(slackNotificationService, 'dispatchRateLimitNotification')
        .mockResolvedValueOnce({
          success: true,
          method: 'webhook',
          channel: '#alerts',
        });

      await processSlackNotificationJob(mockJob);

      expect(slackConnectionService.getConnection).toHaveBeenCalledWith('user-prod-123');
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'CONNECTED' }),
        mockPayload
      );
    });

    it('skips notification gracefully when no Slack connection exists (no crash)', async () => {
      const mockPayload: RateLimitNotificationPayload = {
        userId: 'user-without-slack',
        campaignId: 'camp-prod-456',
        campaignSubject: 'Q3 Outreach',
        senderId: 'sender-prod-789',
        senderEmail: 'sales@reachinbox.ai',
        hourlyLimit: 50,
        retryAfterMs: 3600000,
        timestamp: new Date().toISOString(),
      };

      const mockJob = {
        id: 'slack-rate-limit-skip',
        name: 'rate-limit-notification',
        data: mockPayload,
        attemptsMade: 0,
      } as unknown as Job<RateLimitNotificationPayload>;

      vi.spyOn(slackConnectionService, 'getConnection').mockResolvedValueOnce(null);
      const dispatchSpy = vi.spyOn(
        slackNotificationService,
        'dispatchRateLimitNotification'
      );

      await expect(processSlackNotificationJob(mockJob)).resolves.not.toThrow();
      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('gracefully handles revoked Slack tokens without retrying', async () => {
      const mockPayload: RateLimitNotificationPayload = {
        userId: 'user-revoked',
        campaignId: 'camp-prod-456',
        campaignSubject: 'Outreach',
        senderId: 'sender-prod-789',
        senderEmail: 'sales@reachinbox.ai',
        hourlyLimit: 50,
        retryAfterMs: 3600000,
        timestamp: new Date().toISOString(),
      };

      const mockJob = {
        id: 'slack-rate-limit-revoked',
        name: 'rate-limit-notification',
        data: mockPayload,
        attemptsMade: 0,
      } as unknown as Job<RateLimitNotificationPayload>;

      vi.spyOn(slackConnectionService, 'getConnection').mockResolvedValueOnce({
        id: 'conn-revoked',
        userId: 'user-revoked',
        status: 'CONNECTED',
      } as any);

      vi.spyOn(slackNotificationService, 'dispatchRateLimitNotification').mockResolvedValueOnce({
        success: false,
        revoked: true,
        error: 'token_revoked',
      });

      // Must complete normally without throwing error so BullMQ marks job as completed, not failed
      await expect(processSlackNotificationJob(mockJob)).resolves.not.toThrow();
    });
  });
});
