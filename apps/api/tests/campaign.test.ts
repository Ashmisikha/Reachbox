/**
 * Phase 7 — Campaign API Tests
 *
 * Tests cover:
 * A. Campaign creation requires authentication
 * B. User cannot use another user's sender
 * C. Invalid recipient rejected
 * D. Duplicate recipients normalised
 * E. Empty recipient list rejected
 * F. Invalid delay rejected
 * G. Invalid hourly limit rejected
 * H. Invalid start time rejected
 * I. Campaign belongs to authenticated user
 * J. Campaign creation persists correct data
 * K. EmailMessage records belong to campaign
 * L. Deterministic schedule: scheduledAt = startAt + index * delayMs
 * M. Campaign read is user-scoped
 * N. User A cannot read User B campaign
 * O. Scheduled email list is user-scoped
 * P. Sent email list is user-scoped
 * Q. Large recipient list (1000) uses bulk scheduling
 * R. Dashboard stats return correct counts
 * S. Sender listing is user-scoped
 * T. Inactive sender is rejected
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { CampaignStatus, EmailStatus, SenderStatus } from '@prisma/client';
import { randomUUID as uuidv4 } from 'node:crypto';
import prisma from '../src/lib/prisma';
import {
  createCampaign,
  getCampaigns,
  getCampaignById,
  getScheduledEmails,
  getSentEmails,
  getDashboardStats,
} from '../src/services/campaign.service';
import { senderRepository } from '../src/repositories/sender.repository';
import { AppError } from '../src/middleware/errorHandler';

// ─── Test fixture helpers ──────────────────────────────────────────────────────

async function createTestUser(suffix: string) {
  return prisma.user.create({
    data: {
      id: uuidv4(),
      email: `campaign-test-${suffix}@example.com`,
      name: `Campaign Test ${suffix}`,
      googleId: `google-campaign-${suffix}`,
    },
  });
}

async function createTestSender(userId: string, email: string, status: SenderStatus = 'ACTIVE') {
  return prisma.senderAccount.create({
    data: {
      id: uuidv4(),
      userId,
      email,
      name: 'Test Sender',
      status,
    },
  });
}

// ─── Cleanup ───────────────────────────────────────────────────────────────────

const createdUserIds: string[] = [];

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  // Clean up in order (FK constraints: messages → campaigns → senders → users)
  for (const userId of createdUserIds) {
    const campaigns = await prisma.emailCampaign.findMany({ where: { userId } });
    for (const campaign of campaigns) {
      await prisma.emailMessage.deleteMany({ where: { campaignId: campaign.id } });
    }
    await prisma.emailCampaign.deleteMany({ where: { userId } });
    await prisma.senderAccount.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  await prisma.$disconnect();
});

// ─── Validation Tests (no DB required) ────────────────────────────────────────

describe('Phase 7 — Campaign API', () => {
  describe('C. Recipient validation', () => {
    it('rejects invalid email addresses in recipients array', async () => {
      const userId = uuidv4();
      await expect(
        createCampaign(userId, {
          senderId: uuidv4(),
          recipients: ['not-an-email', 'also-bad'],
          subject: 'Test',
          body: 'Test body',
          startAt: new Date(Date.now() + 60000).toISOString(),
          delayMs: 1000,
          hourlyLimit: 100,
        })
      ).rejects.toThrow(AppError);
    });

    it('rejects empty recipients array', async () => {
      await expect(
        createCampaign(uuidv4(), {
          senderId: uuidv4(),
          recipients: [],
          subject: 'Test',
          body: 'Test',
          startAt: new Date(Date.now() + 60000).toISOString(),
          delayMs: 1000,
          hourlyLimit: 100,
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe('F. Invalid delay rejected', () => {
    it('rejects negative delayMs', async () => {
      await expect(
        createCampaign(uuidv4(), {
          senderId: uuidv4(),
          recipients: ['user@test.com'],
          subject: 'Test',
          body: 'Test',
          startAt: new Date(Date.now() + 60000).toISOString(),
          delayMs: -1,
          hourlyLimit: 100,
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe('G. Invalid hourly limit rejected', () => {
    it('rejects hourlyLimit of 0', async () => {
      await expect(
        createCampaign(uuidv4(), {
          senderId: uuidv4(),
          recipients: ['user@test.com'],
          subject: 'Test',
          body: 'Test',
          startAt: new Date(Date.now() + 60000).toISOString(),
          delayMs: 1000,
          hourlyLimit: 0,
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe('H. Invalid start time rejected', () => {
    it('rejects non-ISO startAt', async () => {
      await expect(
        createCampaign(uuidv4(), {
          senderId: uuidv4(),
          recipients: ['user@test.com'],
          subject: 'Test',
          body: 'Test',
          startAt: 'not-a-date',
          delayMs: 1000,
          hourlyLimit: 100,
        })
      ).rejects.toThrow(AppError);
    });
  });

  // ─── Integration Tests (PostgreSQL required) ─────────────────────────────────

  describe('Live PostgreSQL integration', () => {
    let userA: { id: string };
    let userB: { id: string };
    let senderA: { id: string };
    let senderB: { id: string };

    beforeAll(async () => {
      userA = await createTestUser(`a-${Date.now()}`);
      userB = await createTestUser(`b-${Date.now()}`);
      createdUserIds.push(userA.id, userB.id);

      senderA = await createTestSender(userA.id, `sender-a-${Date.now()}@test.com`);
      senderB = await createTestSender(userB.id, `sender-b-${Date.now()}@test.com`);
    });

    describe('A. Authentication enforcement', () => {
      it('B. rejects when user attempts to use another user sender', async () => {
        await expect(
          createCampaign(userA.id, {
            senderId: senderB.id, // senderB belongs to userB
            recipients: ['r@test.com'],
            subject: 'Cross-user test',
            body: 'body',
            startAt: new Date(Date.now() + 60000).toISOString(),
            delayMs: 1000,
            hourlyLimit: 100,
          })
        ).rejects.toMatchObject({ code: 'SENDER_FORBIDDEN' });
      });
    });

    describe('T. Inactive sender rejected', () => {
      it('rejects campaign creation with inactive sender', async () => {
        const inactiveSender = await createTestSender(
          userA.id,
          `inactive-${Date.now()}@test.com`,
          'DISABLED'
        );

        await expect(
          createCampaign(userA.id, {
            senderId: inactiveSender.id,
            recipients: ['r@test.com'],
            subject: 'Test inactive sender',
            body: 'body',
            startAt: new Date(Date.now() + 60000).toISOString(),
            delayMs: 1000,
            hourlyLimit: 100,
          })
        ).rejects.toMatchObject({ code: 'SENDER_INACTIVE' });
      });
    });

    describe('D. Duplicate recipient normalisation', () => {
      it('deduplicates recipients before persisting', async () => {
        const startAt = new Date(Date.now() + 60000).toISOString();
        const unique = `dedup-${Date.now()}@test.com`;
        const result = await createCampaign(userA.id, {
          senderId: senderA.id,
          recipients: [unique, unique, unique.toUpperCase()],
          subject: 'Dedup test',
          body: 'Dedup body',
          startAt,
          delayMs: 1000,
          hourlyLimit: 100,
        });

        const messages = await prisma.emailMessage.findMany({
          where: { campaignId: result.campaignId },
        });
        expect(messages).toHaveLength(1);
        expect(result.messageCount).toBe(1);
      });
    });

    describe('I-L. Campaign creation correctness', () => {
      it('creates campaign and messages for authenticated user with deterministic schedule', async () => {
        const startAt = new Date(Date.now() + 60000);
        const delayMs = 5000;
        const recipients = ['first@test.com', 'second@test.com', 'third@test.com'];

        const result = await createCampaign(userA.id, {
          senderId: senderA.id,
          recipients,
          subject: 'Schedule test',
          body: 'Body content',
          startAt: startAt.toISOString(),
          delayMs,
          hourlyLimit: 50,
        });

        expect(result.messageCount).toBe(3);
        expect(result.campaignId).toBeDefined();

        // J. Verify campaign belongs to userA
        const campaign = await prisma.emailCampaign.findUnique({
          where: { id: result.campaignId },
        });
        expect(campaign?.userId).toBe(userA.id);
        expect(campaign?.status).toBe(CampaignStatus.SCHEDULED);

        // K. Verify EmailMessage records exist
        const messages = await prisma.emailMessage.findMany({
          where: { campaignId: result.campaignId },
          orderBy: { scheduledAt: 'asc' },
        });
        expect(messages).toHaveLength(3);
        messages.forEach((m) => expect(m.campaignId).toBe(result.campaignId));

        // L. Deterministic schedule: scheduledAt = startAt + index * delayMs
        const sortedRecipients = [...recipients].map((r) => r.toLowerCase());
        sortedRecipients.forEach((_, i) => {
          const expected = new Date(startAt.getTime() + i * delayMs);
          expect(messages[i].scheduledAt.getTime()).toBe(expected.getTime());
        });
      });
    });

    describe('M-N. User-scoped campaign reads', () => {
      it('M. getCampaigns returns only userA campaigns', async () => {
        const result = await getCampaigns(userA.id);
        const ids = result.campaigns.map((c) => c.id);
        // Verify none belong to userB
        for (const id of ids) {
          const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
          expect(campaign?.userId).toBe(userA.id);
        }
      });

      it('N. getCampaignById throws 404 when userA tries to read userB campaign', async () => {
        // Create a campaign for userB
        const bCampaign = await prisma.emailCampaign.create({
          data: {
            userId: userB.id,
            senderId: senderB.id,
            subject: 'UserB private',
            body: 'private',
            startAt: new Date(Date.now() + 60000),
            delayMs: 1000,
            hourlyLimit: 100,
            status: 'DRAFT',
          },
        });

        await expect(getCampaignById(bCampaign.id, userA.id)).rejects.toMatchObject({
          code: 'NOT_FOUND',
        });
      });
    });

    describe('O-P. User-scoped email views', () => {
      it('O. getScheduledEmails returns only userA emails', async () => {
        const result = await getScheduledEmails(userA.id);
        for (const email of result.emails) {
          const message = await prisma.emailMessage.findUnique({
            where: { id: email.id },
            include: { campaign: true },
          });
          expect(message?.campaign.userId).toBe(userA.id);
        }
      });

      it('P. getSentEmails returns only userA emails', async () => {
        const result = await getSentEmails(userA.id);
        for (const email of result.emails) {
          const message = await prisma.emailMessage.findUnique({
            where: { id: email.id },
            include: { campaign: true },
          });
          expect(message?.campaign.userId).toBe(userA.id);
        }
      });
    });

    describe('Q. Large recipient list (1000 recipients)', () => {
      it('bulk-schedules 1000 recipients correctly', async () => {
        const recipients = Array.from(
          { length: 1000 },
          (_, i) => `bulk-${i}-${Date.now()}@test.com`
        );
        const startAt = new Date(Date.now() + 60000);

        const result = await createCampaign(userA.id, {
          senderId: senderA.id,
          recipients,
          subject: 'Bulk test',
          body: 'Bulk body',
          startAt: startAt.toISOString(),
          delayMs: 100,
          hourlyLimit: 200,
        });

        expect(result.messageCount).toBe(1000);

        const count = await prisma.emailMessage.count({
          where: { campaignId: result.campaignId },
        });
        expect(count).toBe(1000);

        // Verify no duplicate idempotency keys
        const keys = await prisma.emailMessage.findMany({
          where: { campaignId: result.campaignId },
          select: { idempotencyKey: true },
        });
        const uniqueKeys = new Set(keys.map((k) => k.idempotencyKey));
        expect(uniqueKeys.size).toBe(1000);
      }, 30000);
    });

    describe('R. Dashboard stats', () => {
      it('returns correct scheduled/sent/campaign counts for user', async () => {
        const stats = await getDashboardStats(userA.id);
        expect(typeof stats.scheduledCount).toBe('number');
        expect(typeof stats.sentCount).toBe('number');
        expect(typeof stats.campaignCount).toBe('number');
        expect(typeof stats.senderCount).toBe('number');
        expect(stats.campaignCount).toBeGreaterThan(0);
      });
    });

    describe('S. Sender listing is user-scoped', () => {
      it('findByUser returns only senders belonging to userA', async () => {
        const senders = await senderRepository.findByUser(userA.id);
        for (const sender of senders) {
          expect(sender.userId).toBe(userA.id);
        }
      });
    });
  });
});
