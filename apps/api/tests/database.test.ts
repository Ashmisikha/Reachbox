import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma, { checkDatabaseConnection, disconnectDatabase } from '../src/lib/prisma';
import { userRepository } from '../src/repositories/user.repository';
import { senderRepository } from '../src/repositories/sender.repository';
import { campaignRepository } from '../src/repositories/campaign.repository';
import { emailMessageRepository } from '../src/repositories/email-message.repository';
import { emailJobRepository } from '../src/repositories/email-job.repository';
import { withTransaction } from '../src/repositories/transaction';
import { EmailStatus, JobStatus, CampaignStatus } from '@prisma/client';
import crypto from 'crypto';

describe('PostgreSQL Persistence Layer & Repositories', () => {
  let isDbAvailable = false;

  beforeAll(async () => {
    try {
      await checkDatabaseConnection();
      isDbAvailable = true;
    } catch {
      isDbAvailable = false;
      console.warn(
        'PostgreSQL database is offline. Running repository structure tests; skipping live I/O scenarios.'
      );
    }
  });

  afterAll(async () => {
    if (isDbAvailable) {
      await disconnectDatabase();
    }
  });

  describe('Repository Layer Definition', () => {
    it('userRepository exports expected CRUD methods', () => {
      expect(typeof userRepository.findById).toBe('function');
      expect(typeof userRepository.findByEmail).toBe('function');
      expect(typeof userRepository.create).toBe('function');
      expect(typeof userRepository.updateStatus).toBe('function');
    });

    it('senderRepository exports expected methods', () => {
      expect(typeof senderRepository.findById).toBe('function');
      expect(typeof senderRepository.findByUserAndEmail).toBe('function');
      expect(typeof senderRepository.findByUser).toBe('function');
      expect(typeof senderRepository.create).toBe('function');
      expect(typeof senderRepository.updateStatus).toBe('function');
    });

    it('campaignRepository exports expected methods', () => {
      expect(typeof campaignRepository.findById).toBe('function');
      expect(typeof campaignRepository.findByUser).toBe('function');
      expect(typeof campaignRepository.create).toBe('function');
      expect(typeof campaignRepository.updateStatus).toBe('function');
    });

    it('emailMessageRepository exports expected methods', () => {
      expect(typeof emailMessageRepository.findById).toBe('function');
      expect(typeof emailMessageRepository.findByIdempotencyKey).toBe('function');
      expect(typeof emailMessageRepository.findScheduled).toBe('function');
      expect(typeof emailMessageRepository.findSent).toBe('function');
      expect(typeof emailMessageRepository.create).toBe('function');
      expect(typeof emailMessageRepository.updateStatus).toBe('function');
    });

    it('emailJobRepository exports expected methods', () => {
      expect(typeof emailJobRepository.findByEmailMessageId).toBe('function');
      expect(typeof emailJobRepository.findByBullmqJobId).toBe('function');
      expect(typeof emailJobRepository.create).toBe('function');
      expect(typeof emailJobRepository.updateStatus).toBe('function');
    });

    it('withTransaction helper is defined', () => {
      expect(typeof withTransaction).toBe('function');
    });
  });

  describe('Live Database Relational & Idempotency Constraints', () => {
    it('User creation and retrieval', async (ctx) => {
      if (!isDbAvailable) {
        ctx.skip();
        return;
      }

      const randomEmail = `test-${Date.now()}@example.com`;
      const user = await userRepository.create({
        email: randomEmail,
        name: 'Test Engineer',
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe(randomEmail);

      const found = await userRepository.findById(user.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Test Engineer');
    });

    it('Sender relationship with User', async (ctx) => {
      if (!isDbAvailable) {
        ctx.skip();
        return;
      }

      const user = await userRepository.create({
        email: `sender-owner-${Date.now()}@example.com`,
        name: 'Sender Owner',
      });

      const sender = await senderRepository.create({
        user: { connect: { id: user.id } },
        email: 'sender@reachinbox.test',
        name: 'Official Sender',
      });

      expect(sender.userId).toBe(user.id);
      expect(sender.email).toBe('sender@reachinbox.test');
    });

    it('Campaign belongs to both User and Sender', async (ctx) => {
      if (!isDbAvailable) {
        ctx.skip();
        return;
      }

      const user = await userRepository.create({
        email: `campaign-owner-${Date.now()}@example.com`,
        name: 'Campaign Owner',
      });

      const sender = await senderRepository.create({
        user: { connect: { id: user.id } },
        email: `outreach-${Date.now()}@reachinbox.test`,
      });

      const campaign = await campaignRepository.create({
        user: { connect: { id: user.id } },
        sender: { connect: { id: sender.id } },
        subject: 'Q4 Product Launch',
        body: 'Hello, welcome to our launch event.',
        startAt: new Date(Date.now() + 3600000),
        delayMs: 2000,
        hourlyLimit: 100,
        status: CampaignStatus.SCHEDULED,
      });

      expect(campaign.id).toBeDefined();
      expect(campaign.userId).toBe(user.id);
      expect(campaign.senderId).toBe(sender.id);
    });

    it('Email message belongs to Campaign and Sender', async (ctx) => {
      if (!isDbAvailable) {
        ctx.skip();
        return;
      }

      const user = await userRepository.create({
        email: `email-owner-${Date.now()}@example.com`,
        name: 'Email Owner',
      });

      const sender = await senderRepository.create({
        user: { connect: { id: user.id } },
        email: `dispatch-${Date.now()}@reachinbox.test`,
      });

      const campaign = await campaignRepository.create({
        user: { connect: { id: user.id } },
        sender: { connect: { id: sender.id } },
        subject: 'Welcome Series',
        body: 'Welcome!',
        startAt: new Date(),
        delayMs: 1000,
        hourlyLimit: 50,
      });

      const idempotencyKey = crypto.randomUUID();
      const message = await emailMessageRepository.create({
        campaign: { connect: { id: campaign.id } },
        sender: { connect: { id: sender.id } },
        recipient: 'recipient@client.test',
        subject: 'Welcome Series',
        body: 'Welcome!',
        scheduledAt: new Date(),
        idempotencyKey,
      });

      expect(message.id).toBeDefined();
      expect(message.campaignId).toBe(campaign.id);
      expect(message.senderId).toBe(sender.id);
    });

    it('Email has at most one associated job', async (ctx) => {
      if (!isDbAvailable) {
        ctx.skip();
        return;
      }

      const user = await userRepository.create({
        email: `job-owner-${Date.now()}@example.com`,
        name: 'Job Owner',
      });

      const sender = await senderRepository.create({
        user: { connect: { id: user.id } },
        email: `job-sender-${Date.now()}@reachinbox.test`,
      });

      const campaign = await campaignRepository.create({
        user: { connect: { id: user.id } },
        sender: { connect: { id: sender.id } },
        subject: 'Job Test Campaign',
        body: 'Job Test',
        startAt: new Date(),
        delayMs: 1000,
        hourlyLimit: 50,
      });

      const message = await emailMessageRepository.create({
        campaign: { connect: { id: campaign.id } },
        sender: { connect: { id: sender.id } },
        recipient: 'job-recipient@client.test',
        subject: 'Job Test',
        body: 'Job Test',
        scheduledAt: new Date(),
        idempotencyKey: crypto.randomUUID(),
      });

      const job = await emailJobRepository.create({
        emailMessage: { connect: { id: message.id } },
        bullmqJobId: `bullmq-${Date.now()}`,
        status: JobStatus.PENDING,
      });

      expect(job.emailMessageId).toBe(message.id);

      // Attempting to create a second job for the same email message should fail
      await expect(
        emailJobRepository.create({
          emailMessage: { connect: { id: message.id } },
          bullmqJobId: `bullmq-duplicate-${Date.now()}`,
          status: JobStatus.PENDING,
        })
      ).rejects.toThrow();
    });

    it('Idempotency constraint: two email messages cannot use the same idempotencyKey', async (ctx) => {
      if (!isDbAvailable) {
        ctx.skip();
        return;
      }

      const user = await userRepository.create({
        email: `idempotency-owner-${Date.now()}@example.com`,
        name: 'Idempotency Owner',
      });

      const sender = await senderRepository.create({
        user: { connect: { id: user.id } },
        email: `idempotency-sender-${Date.now()}@reachinbox.test`,
      });

      const campaign = await campaignRepository.create({
        user: { connect: { id: user.id } },
        sender: { connect: { id: sender.id } },
        subject: 'Idempotency Test',
        body: 'Idempotency Test',
        startAt: new Date(),
        delayMs: 1000,
        hourlyLimit: 50,
      });

      const duplicateKey = `idem-key-${Date.now()}`;

      await emailMessageRepository.create({
        campaign: { connect: { id: campaign.id } },
        sender: { connect: { id: sender.id } },
        recipient: 'user1@example.com',
        subject: 'Test 1',
        body: 'Body 1',
        scheduledAt: new Date(),
        idempotencyKey: duplicateKey,
      });

      // Second insert with the identical idempotencyKey MUST be rejected at the database level
      await expect(
        emailMessageRepository.create({
          campaign: { connect: { id: campaign.id } },
          sender: { connect: { id: sender.id } },
          recipient: 'user2@example.com',
          subject: 'Test 2',
          body: 'Body 2',
          scheduledAt: new Date(),
          idempotencyKey: duplicateKey,
        })
      ).rejects.toThrow();
    });

    it('Foreign-key integrity: a message cannot reference a nonexistent campaign', async (ctx) => {
      if (!isDbAvailable) {
        ctx.skip();
        return;
      }

      const user = await userRepository.create({
        email: `fk-owner-${Date.now()}@example.com`,
        name: 'FK Owner',
      });

      const sender = await senderRepository.create({
        user: { connect: { id: user.id } },
        email: `fk-sender-${Date.now()}@reachinbox.test`,
      });

      const nonExistentCampaignId = crypto.randomUUID();

      await expect(
        emailMessageRepository.create({
          campaign: { connect: { id: nonExistentCampaignId } },
          sender: { connect: { id: sender.id } },
          recipient: 'fk-test@example.com',
          subject: 'FK Test',
          body: 'FK Test Body',
          scheduledAt: new Date(),
          idempotencyKey: crypto.randomUUID(),
        })
      ).rejects.toThrow();
    });
  });
});
