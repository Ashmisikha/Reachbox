import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import prisma from '../src/lib/prisma';
import { sessionService } from '../src/services/auth/session.service';
import { googleConfig } from '../src/config/google';
import { randomUUID as uuidv4 } from 'node:crypto';

describe('Phase C & D — Sequences, Analytics & Activity Timeline', () => {
  let user: { id: string; email: string };
  let sender: { id: string; email: string };
  let cookie: string[];
  let contact: { id: string; email: string };

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: `seq-test-${Date.now()}@example.com`,
        name: 'Sequence Tester',
        googleId: `google-seq-${Date.now()}`,
      },
    });

    sender = await prisma.senderAccount.create({
      data: {
        id: uuidv4(),
        userId: user.id,
        email: `sender-${Date.now()}@example.com`,
        name: 'Sequence Sender',
        status: 'ACTIVE',
      },
    });

    contact = await prisma.contact.create({
      data: {
        id: uuidv4(),
        userId: user.id,
        email: 'alex.morgan@testdomain.com',
        firstName: 'Alex',
        lastName: 'Morgan',
        company: 'Starlight Tech',
        jobTitle: 'VP Engineering',
      },
    });

    cookie = [`${googleConfig.SESSION_COOKIE_NAME}=${(await sessionService.createSession(user.id)).rawToken}`];
  });

  afterAll(async () => {
    await prisma.campaignEvent.deleteMany({
      where: { campaign: { userId: user.id } },
    });
    await prisma.emailMessage.deleteMany({
      where: { campaign: { userId: user.id } },
    });
    await prisma.campaignStep.deleteMany({
      where: { campaign: { userId: user.id } },
    });
    await prisma.emailCampaign.deleteMany({
      where: { userId: user.id },
    });
    await prisma.contact.deleteMany({
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

  it('creates a multi-step sequence with personalized variables per step', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .set('Cookie', cookie)
      .send({
        senderId: sender.id,
        recipients: [contact.email],
        subject: 'Default subject',
        body: 'Default body',
        startAt: new Date(Date.now() + 60000).toISOString(),
        delayMs: 2000,
        hourlyLimit: 50,
        steps: [
          {
            stepOrder: 1,
            delayDays: 0,
            delayHours: 0,
            subject: 'Hi {{firstName}}, welcome to ReachInbox',
            body: 'Hello {{firstName}} {{lastName}},\nExcited to see your work at {{company}}.',
          },
          {
            stepOrder: 2,
            delayDays: 2,
            delayHours: 0,
            subject: 'Following up, {{firstName}}',
            body: 'Checking in about {{company}} engineering.',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.campaignId).toBeDefined();
    expect(res.body.stepCount).toBe(2);
    expect(res.body.messageCount).toBe(2);

    // Verify messages created with personalized content
    const messages = await prisma.emailMessage.findMany({
      where: { campaignId: res.body.campaignId },
      orderBy: { scheduledAt: 'asc' },
    });

    expect(messages.length).toBe(2);
    expect(messages[0].subject).toBe('Hi Alex, welcome to ReachInbox');
    expect(messages[0].body).toContain('Starlight Tech');
    expect(messages[1].subject).toBe('Following up, Alex');
  });

  it('retrieves real operational analytics and event timeline for a campaign', async () => {
    const listRes = await request(app).get('/api/campaigns').set('Cookie', cookie);
    const campaignId = listRes.body.campaigns[0].id;

    const detailRes = await request(app)
      .get(`/api/campaigns/${campaignId}`)
      .set('Cookie', cookie);

    expect(detailRes.status).toBe(200);
    const data = detailRes.body.campaign;

    expect(data.analytics).toBeDefined();
    expect(data.analytics.totalRecipients).toBe(2);
    expect(data.analytics.scheduled).toBe(2);
    expect(data.analytics.sent).toBe(0);
    expect(data.analytics.completionRate).toBe(0);

    // Events timeline
    expect(detailRes.body.campaign.events).toBeDefined();
    expect(detailRes.body.campaign.events.length).toBeGreaterThanOrEqual(2);
    const eventTypes = detailRes.body.campaign.events.map((e: any) => e.type);
    expect(eventTypes).toContain('CAMPAIGN_SCHEDULED');
    expect(eventTypes).toContain('JOBS_CREATED');
  });

  it('cancels a campaign and aborts all future scheduled steps', async () => {
    const listRes = await request(app).get('/api/campaigns').set('Cookie', cookie);
    const campaignId = listRes.body.campaigns[0].id;

    const cancelRes = await request(app)
      .post(`/api/campaigns/${campaignId}/cancel`)
      .set('Cookie', cookie);

    expect(cancelRes.status).toBe(200);

    // Verify messages transitioned to CANCELLED
    const messages = await prisma.emailMessage.findMany({
      where: { campaignId },
    });
    for (const msg of messages) {
      expect(msg.status).toBe('CANCELLED');
    }

    // Analytics reflects cancelled
    const detailRes = await request(app)
      .get(`/api/campaigns/${campaignId}`)
      .set('Cookie', cookie);

    expect(detailRes.body.campaign.analytics.cancelled).toBe(2);
    expect(detailRes.body.campaign.analytics.completionRate).toBe(100);
  });
});
