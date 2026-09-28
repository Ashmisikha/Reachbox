import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import prisma from '../src/lib/prisma';
import { sessionService } from '../src/services/auth/session.service';
import { googleConfig } from '../src/config/google';
import { randomUUID as uuidv4 } from 'node:crypto';
import { processEmailJob } from '../src/workers/email.worker';

describe('Phase E — Suppression & Unsubscribe System', () => {
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };
  let sender: { id: string; email: string };
  let cookieA: string[];
  let cookieB: string[];

  beforeAll(async () => {
    userA = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: `supp-user-a-${Date.now()}@example.com`,
        name: 'Supp User A',
        googleId: `google-supp-a-${Date.now()}`,
      },
    });

    userB = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: `supp-user-b-${Date.now()}@example.com`,
        name: 'Supp User B',
        googleId: `google-supp-b-${Date.now()}`,
      },
    });

    sender = await prisma.senderAccount.create({
      data: {
        id: uuidv4(),
        userId: userA.id,
        email: `supp-sender-${Date.now()}@example.com`,
        name: 'Supp Sender',
        status: 'ACTIVE',
      },
    });

    cookieA = [`${googleConfig.SESSION_COOKIE_NAME}=${(await sessionService.createSession(userA.id)).rawToken}`];
    cookieB = [`${googleConfig.SESSION_COOKIE_NAME}=${(await sessionService.createSession(userB.id)).rawToken}`];
  });

  afterAll(async () => {
    await prisma.suppression.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    });
    await prisma.campaignEvent.deleteMany({
      where: { campaign: { userId: userA.id } },
    });
    await prisma.emailMessage.deleteMany({
      where: { campaign: { userId: userA.id } },
    });
    await prisma.emailCampaign.deleteMany({
      where: { userId: userA.id },
    });
    await prisma.senderAccount.deleteMany({
      where: { userId: userA.id },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id] } },
    });
  });

  it('adds an email address to suppression list for userA', async () => {
    const res = await request(app)
      .post('/api/suppressions')
      .set('Cookie', cookieA)
      .send({
        email: 'do-not-email@acme.com',
        reason: 'User unsubscribed via preference center',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('do-not-email@acme.com');
  });

  it('lists suppressions isolated by user', async () => {
    const resA = await request(app).get('/api/suppressions').set('Cookie', cookieA);
    expect(resA.status).toBe(200);
    expect(resA.body.data.suppressions.length).toBe(1);
    expect(resA.body.data.suppressions[0].email).toBe('do-not-email@acme.com');

    const resB = await request(app).get('/api/suppressions').set('Cookie', cookieB);
    expect(resB.status).toBe(200);
    expect(resB.body.data.suppressions.length).toBe(0);
  });

  it('worker skips sending and marks message SUPPRESSED when recipient is on suppression list', async () => {
    // Create campaign with suppressed recipient
    const campaign = await prisma.emailCampaign.create({
      data: {
        userId: userA.id,
        senderId: sender.id,
        subject: 'Suppression Test',
        body: 'Testing suppression',
        startAt: new Date(),
        delayMs: 1000,
        hourlyLimit: 100,
        status: 'SCHEDULED',
      },
    });

    const msg = await prisma.emailMessage.create({
      data: {
        campaignId: campaign.id,
        senderId: sender.id,
        recipient: 'do-not-email@acme.com',
        subject: 'Hello',
        body: 'World',
        scheduledAt: new Date(),
        status: 'SCHEDULED',
        idempotencyKey: `supp-test-${Date.now()}`,
      },
    });

    await prisma.emailJob.create({
      data: {
        emailMessageId: msg.id,
        status: 'PENDING',
      },
    });

    let transportCalled = false;
    const mockTransport = {
      send: async () => {
        transportCalled = true;
        return { messageId: 'mock-123' };
      },
    };

    const mockJob = {
      data: {
        emailMessageId: msg.id,
        campaignId: campaign.id,
        senderId: sender.id,
        scheduledAt: new Date().toISOString(),
        idempotencyKey: msg.idempotencyKey,
      },
    } as any;

    await processEmailJob(mockJob, mockTransport as any, 0, 100);

    // Transport MUST NOT have been called!
    expect(transportCalled).toBe(false);

    // Message must be marked SUPPRESSED
    const updated = await prisma.emailMessage.findUnique({
      where: { id: msg.id },
    });
    expect(updated?.status).toBe('SUPPRESSED');
    expect(updated?.lastError).toContain('Recipient suppressed');
  });

  it('removes recipient from suppression list', async () => {
    const delRes = await request(app)
      .delete('/api/suppressions/by-email/do-not-email@acme.com')
      .set('Cookie', cookieA);
    expect(delRes.status).toBe(200);

    const listRes = await request(app).get('/api/suppressions').set('Cookie', cookieA);
    expect(listRes.body.data.suppressions.length).toBe(0);
  });
});
