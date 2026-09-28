import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import prisma from '../src/lib/prisma';
import { sessionService } from '../src/services/auth/session.service';
import { googleConfig } from '../src/config/google';
import { randomUUID as uuidv4 } from 'node:crypto';

describe('Phase F — Failure & Retry Center', () => {
  let user: { id: string; email: string };
  let sender: { id: string; email: string };
  let cookie: string[];
  let campaign: { id: string };
  let failedMsgId: string;
  let permanentFailedMsgId: string;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: `failure-user-${Date.now()}@example.com`,
        name: 'Failure Tester',
        googleId: `google-fail-${Date.now()}`,
      },
    });

    sender = await prisma.senderAccount.create({
      data: {
        id: uuidv4(),
        userId: user.id,
        email: `fail-sender-${Date.now()}@example.com`,
        name: 'Failure Sender',
        status: 'ACTIVE',
      },
    });

    cookie = [`${googleConfig.SESSION_COOKIE_NAME}=${(await sessionService.createSession(user.id)).rawToken}`];

    campaign = await prisma.emailCampaign.create({
      data: {
        userId: user.id,
        senderId: sender.id,
        subject: 'Failure Center Campaign',
        body: 'Testing failures and retry center',
        startAt: new Date(),
        delayMs: 1000,
        hourlyLimit: 100,
        status: 'SCHEDULED',
      },
    });

    // Create a retryable failure (temporary SMTP timeout)
    const retryable = await prisma.emailMessage.create({
      data: {
        campaignId: campaign.id,
        senderId: sender.id,
        recipient: 'retryable@example.com',
        subject: 'Retryable Failure Test',
        body: 'Body',
        scheduledAt: new Date(),
        status: 'FAILED',
        lastError: 'ETIMEDOUT connection to mail server timed out',
        isPermanent: false,
        idempotencyKey: `fail-key-1-${Date.now()}`,
      },
    });
    failedMsgId = retryable.id;
    await prisma.emailJob.create({
      data: {
        emailMessageId: retryable.id,
        status: 'FAILED',
        lastError: 'ETIMEDOUT connection to mail server timed out',
        attempts: 1,
      },
    });

    // Create a permanent failure (hard bounce / invalid recipient address)
    const permanent = await prisma.emailMessage.create({
      data: {
        campaignId: campaign.id,
        senderId: sender.id,
        recipient: 'invalid-hard-bounce@example.com',
        subject: 'Permanent Failure Test',
        body: 'Body',
        scheduledAt: new Date(),
        status: 'FAILED',
        lastError: '550 5.1.1 User unknown / recipient address rejected',
        isPermanent: true,
        idempotencyKey: `fail-key-2-${Date.now()}`,
      },
    });
    permanentFailedMsgId = permanent.id;
    await prisma.emailJob.create({
      data: {
        emailMessageId: permanent.id,
        status: 'FAILED',
        lastError: '550 5.1.1 User unknown',
        attempts: 1,
      },
    });
  });

  afterAll(async () => {
    await prisma.campaignEvent.deleteMany({
      where: { campaign: { userId: user.id } },
    });
    await prisma.emailJob.deleteMany({
      where: { emailMessage: { campaign: { userId: user.id } } },
    });
    await prisma.emailMessage.deleteMany({
      where: { campaign: { userId: user.id } },
    });
    await prisma.emailCampaign.deleteMany({
      where: { userId: user.id },
    });
    await prisma.senderAccount.deleteMany({
      where: { userId: user.id },
    });
    await prisma.session.deleteMany({
      where: { userId: user.id },
    });
    await prisma.user.deleteMany({
      where: { id: user.id },
    });
  });

  it('lists failures with campaign, sender, error, and permanent status', async () => {
    const res = await request(app).get('/api/failures').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.failures.length).toBe(2);

    const retryable = res.body.data.failures.find((f: any) => f.id === failedMsgId);
    expect(retryable.isPermanent).toBe(false);
    expect(retryable.recipient).toBe('retryable@example.com');

    const perm = res.body.data.failures.find((f: any) => f.id === permanentFailedMsgId);
    expect(perm.isPermanent).toBe(true);
  });

  it('rejects retrying a permanent failure', async () => {
    const res = await request(app)
      .post(`/api/failures/${permanentFailedMsgId}/retry`)
      .set('Cookie', cookie);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PERMANENT_FAILURE');
  });

  it('retries an eligible failed email message resetting status to SCHEDULED', async () => {
    const res = await request(app)
      .post(`/api/failures/${failedMsgId}/retry`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);

    const updated = await prisma.emailMessage.findUnique({
      where: { id: failedMsgId },
    });
    expect(updated?.status).toBe('SCHEDULED');
    expect(updated?.lastError).toBeNull();
  });
});
