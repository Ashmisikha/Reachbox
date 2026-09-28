import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import prisma from '../src/lib/prisma';
import { sessionService } from '../src/services/auth/session.service';
import { googleConfig } from '../src/config/google';
import { randomUUID as uuidv4 } from 'node:crypto';

describe('Phase G — Sender Health & Operations', () => {
  let user: { id: string; email: string };
  let sender: { id: string; email: string };
  let cookie: string[];

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: `health-user-${Date.now()}@example.com`,
        name: 'Health Tester',
        googleId: `google-health-${Date.now()}`,
      },
    });

    sender = await prisma.senderAccount.create({
      data: {
        id: uuidv4(),
        userId: user.id,
        email: `health-sender-${Date.now()}@example.com`,
        name: 'Health Sender',
        status: 'ACTIVE',
      },
    });

    cookie = [`${googleConfig.SESSION_COOKIE_NAME}=${(await sessionService.createSession(user.id)).rawToken}`];
  });

  afterAll(async () => {
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

  it('retrieves live sender health and operational metrics', async () => {
    const res = await request(app).get('/api/senders/health').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.senders).toBeDefined();
    expect(res.body.senders.length).toBe(1);

    const s = res.body.senders[0];
    expect(s.id).toBe(sender.id);
    expect(s.hourlyLimit).toBeGreaterThan(0);
    expect(s.remainingCapacity).toBeGreaterThanOrEqual(0);
    expect(s.status).toBe('ACTIVE');
    expect(s.failedCount).toBe(0);
  });
});
