import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import prisma from '../src/lib/prisma';
import { sessionService } from '../src/services/auth/session.service';
import { googleConfig } from '../src/config/google';
import { randomUUID as uuidv4 } from 'node:crypto';

describe('Onboarding & Tour API Tests', () => {
  let userA: { id: string; email: string; name: string };
  let userB: { id: string; email: string; name: string };

  const authCookie = async (userId: string) => [
    `${googleConfig.SESSION_COOKIE_NAME}=${(await sessionService.createSession(userId)).rawToken}`,
  ];

  beforeAll(async () => {
    // Create test user A
    userA = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: `onboarding-test-a-${Date.now()}@example.com`,
        name: 'User A Onboarding',
        googleId: `google-onboard-a-${Date.now()}`,
      },
    });

    // Create test user B
    userB = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: `onboarding-test-b-${Date.now()}@example.com`,
        name: 'User B Onboarding',
        googleId: `google-onboard-b-${Date.now()}`,
      },
    });
  });

  afterAll(async () => {
    await prisma.session.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id] } },
    });
  });

  // ============================================================================
  // Security & Authentication Checks
  // ============================================================================
  describe('Security & Authentication', () => {
    it('14. Unauthenticated user cannot access onboarding APIs (rejects with 401)', async () => {
      const res = await request(app).get('/api/onboarding/status');
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('15. User A cannot modify User B onboarding state (scoped by verified session)', async () => {
      // User A completes setup
      await request(app)
        .post('/api/onboarding/setup')
        .set('Cookie', await authCookie(userA.id))
        .send({
          setupCompleted: true,
          workspaceName: "User A Workspace",
        })
        .expect(200);

      // Verify User A status
      const resA = await request(app)
        .get('/api/onboarding/status')
        .set('Cookie', await authCookie(userA.id))
        .expect(200);
      expect(resA.body.data.workspaceName).toBe("User A Workspace");
      expect(resA.body.data.setupCompleted).toBe(true);

      // Verify User B status remains completely uncompleted / unaffected
      const resB = await request(app)
        .get('/api/onboarding/status')
        .set('Cookie', await authCookie(userB.id))
        .expect(200);
      expect(resB.body.data.workspaceName).toBe('');
      expect(resB.body.data.setupCompleted).toBe(false);
    });
  });

  // ============================================================================
  // Workspace Setup Flow & Persistence
  // ============================================================================
  describe('Workspace Setup Flow & Persistence', () => {
    it('1. New user receives uncompleted setup state by default', async () => {
      const res = await request(app)
        .get('/api/onboarding/status')
        .set('Cookie', await authCookie(userB.id))
        .expect(200);

      expect(res.body.data.setupCompleted).toBe(false);
      expect(res.body.data.tourCompleted).toBe(false);
    });

    it('2 & 4. Setup completion persists workspace name, delivery settings, and updates name in DB', async () => {
      const payload = {
        setupCompleted: true,
        workspaceName: 'Acme Growth Labs',
        userName: 'User B Updated Name',
        minDelayMs: 1500,
        hourlyLimit: 120,
      };

      const saveRes = await request(app)
        .post('/api/onboarding/setup')
        .set('Cookie', await authCookie(userB.id))
        .send(payload)
        .expect(200);

      expect(saveRes.body.data.setupCompleted).toBe(true);
      expect(saveRes.body.data.workspaceName).toBe('Acme Growth Labs');
      expect(saveRes.body.data.minDelayMs).toBe(1500);
      expect(saveRes.body.data.hourlyLimit).toBe(120);

      // Verify persistence on subsequent GET
      const getRes = await request(app)
        .get('/api/onboarding/status')
        .set('Cookie', await authCookie(userB.id))
        .expect(200);

      expect(getRes.body.data.setupCompleted).toBe(true);
      expect(getRes.body.data.workspaceName).toBe('Acme Growth Labs');

      // Verify user's name was updated in Prisma database
      const dbUser = await prisma.user.findUnique({ where: { id: userB.id } });
      expect(dbUser?.name).toBe('User B Updated Name');
    });

    it('3. User can skip setup without inventing fake configuration', async () => {
      const skipRes = await request(app)
        .post('/api/onboarding/setup')
        .set('Cookie', await authCookie(userB.id))
        .send({ setupCompleted: false })
        .expect(200);

      expect(skipRes.body.data.setupCompleted).toBe(false);
    });

    it('5. Existing user with setup completed retains verified completion state', async () => {
      await request(app)
        .post('/api/onboarding/setup')
        .set('Cookie', await authCookie(userB.id))
        .send({ setupCompleted: true })
        .expect(200);

      const statusRes = await request(app)
        .get('/api/onboarding/status')
        .set('Cookie', await authCookie(userB.id))
        .expect(200);

      expect(statusRes.body.data.setupCompleted).toBe(true);
    });
  });

  // ============================================================================
  // Product Tour Flow & Persistence
  // ============================================================================
  describe('Product Tour Flow & Persistence', () => {
    it('6. Tour initially remains uncompleted when setup finishes', async () => {
      const res = await request(app)
        .get('/api/onboarding/status')
        .set('Cookie', await authCookie(userA.id))
        .expect(200);

      expect(res.body.data.tourCompleted).toBe(false);
    });

    it('7, 8 & 11. Completing or skipping tour updates and persists tourCompleted flag', async () => {
      const res = await request(app)
        .post('/api/onboarding/tour')
        .set('Cookie', await authCookie(userA.id))
        .send({ tourCompleted: true })
        .expect(200);

      expect(res.body.data.tourCompleted).toBe(true);

      // Verify persisted state
      const checkRes = await request(app)
        .get('/api/onboarding/status')
        .set('Cookie', await authCookie(userA.id))
        .expect(200);

      expect(checkRes.body.data.tourCompleted).toBe(true);
    });

    it('9 & 12. Replay product tour resets tourCompleted to false for immediate replay', async () => {
      const replayRes = await request(app)
        .post('/api/onboarding/tour/replay')
        .set('Cookie', await authCookie(userA.id))
        .expect(200);

      expect(replayRes.body.data.tourCompleted).toBe(false);
    });

    it('10 & 13. Restart workspace setup resets setupCompleted', async () => {
      const resetRes = await request(app)
        .post('/api/onboarding/setup/reset')
        .set('Cookie', await authCookie(userA.id))
        .expect(200);

      expect(resetRes.body.data.setupCompleted).toBe(false);
    });
  });
});
