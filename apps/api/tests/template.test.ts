import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import prisma from '../src/lib/prisma';
import { sessionService } from '../src/services/auth/session.service';
import { googleConfig } from '../src/config/google';
import { randomUUID as uuidv4 } from 'node:crypto';

describe('Phase B — Template Management & Personalization API Tests', () => {
  let userA: { id: string; email: string; name: string };
  let userB: { id: string; email: string; name: string };
  let cookieA: string[];
  let cookieB: string[];
  let contactA: { id: string; email: string };

  beforeAll(async () => {
    userA = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: `template-test-a-${Date.now()}@example.com`,
        name: 'Template User A',
        googleId: `google-template-a-${Date.now()}`,
      },
    });

    userB = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: `template-test-b-${Date.now()}@example.com`,
        name: 'Template User B',
        googleId: `google-template-b-${Date.now()}`,
      },
    });

    cookieA = [`${googleConfig.SESSION_COOKIE_NAME}=${(await sessionService.createSession(userA.id)).rawToken}`];
    cookieB = [`${googleConfig.SESSION_COOKIE_NAME}=${(await sessionService.createSession(userB.id)).rawToken}`];

    contactA = await prisma.contact.create({
      data: {
        id: uuidv4(),
        userId: userA.id,
        email: 'sarah.connor@cyberdyne.com',
        firstName: 'Sarah',
        lastName: 'Connor',
        company: 'Resistance',
        jobTitle: 'Commander',
      },
    });
  });

  afterAll(async () => {
    await prisma.emailTemplate.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    });
    await prisma.contact.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id] } },
    });
  });

  it('rejects unauthenticated requests to templates', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(401);
  });

  it('creates a new template for userA', async () => {
    const res = await request(app)
      .post('/api/templates')
      .set('Cookie', cookieA)
      .send({
        name: 'Cold Outreach v1',
        subject: 'Quick question regarding {{company}}',
        body: 'Hi {{firstName}},\n\nI noticed your work as {{jobTitle}} at {{company}}.\n\nBest,\nReachInbox',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.name).toBe('Cold Outreach v1');
  });

  it('lists templates isolated to authenticated user', async () => {
    // userA should see the created template
    const resA = await request(app).get('/api/templates').set('Cookie', cookieA);
    expect(resA.status).toBe(200);
    expect(resA.body.data.templates.length).toBe(1);
    expect(resA.body.data.templates[0].name).toBe('Cold Outreach v1');

    // userB should see 0 templates
    const resB = await request(app).get('/api/templates').set('Cookie', cookieB);
    expect(resB.status).toBe(200);
    expect(resB.body.data.templates.length).toBe(0);
  });

  it('duplicates a template', async () => {
    const listRes = await request(app).get('/api/templates').set('Cookie', cookieA);
    const templateId = listRes.body.data.templates[0].id;

    const dupRes = await request(app)
      .post(`/api/templates/${templateId}/duplicate`)
      .set('Cookie', cookieA);

    expect(dupRes.status).toBe(201);
    expect(dupRes.body.data.name).toBe('Cold Outreach v1 (Copy)');
    expect(dupRes.body.data.subject).toBe('Quick question regarding {{company}}');

    const updatedList = await request(app).get('/api/templates').set('Cookie', cookieA);
    expect(updatedList.body.data.templates.length).toBe(2);
  });

  it('prevents userB from updating or deleting userA templates', async () => {
    const listRes = await request(app).get('/api/templates').set('Cookie', cookieA);
    const templateId = listRes.body.data.templates[0].id;

    const patchRes = await request(app)
      .patch(`/api/templates/${templateId}`)
      .set('Cookie', cookieB)
      .send({ name: 'Hacked name' });
    expect(patchRes.status).toBe(404);

    const delRes = await request(app)
      .delete(`/api/templates/${templateId}`)
      .set('Cookie', cookieB);
    expect(delRes.status).toBe(404);
  });

  it('previews a template resolving real contact personalization', async () => {
    const previewRes = await request(app)
      .post('/api/templates/preview')
      .set('Cookie', cookieA)
      .send({
        subject: 'Hello {{firstName}} from {{company}}',
        body: 'Dear {{firstName}} {{lastName}},\nAre you still the {{jobTitle}} at {{company}}? Reach out to {{email}}.',
        contactId: contactA.id,
      });

    expect(previewRes.status).toBe(200);
    expect(previewRes.body.data.previewSubject).toBe('Hello Sarah from Resistance');
    expect(previewRes.body.data.previewBody).toBe(
      'Dear Sarah Connor,\nAre you still the Commander at Resistance? Reach out to sarah.connor@cyberdyne.com.'
    );
    expect(previewRes.body.data.usedVariables).toEqual(
      expect.arrayContaining(['firstName', 'lastName', 'company', 'jobTitle', 'email'])
    );
  });

  it('updates and deletes a template cleanly', async () => {
    const listRes = await request(app).get('/api/templates').set('Cookie', cookieA);
    const templateId = listRes.body.data.templates[0].id;

    const patchRes = await request(app)
      .patch(`/api/templates/${templateId}`)
      .set('Cookie', cookieA)
      .send({ name: 'Updated Template Name' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.name).toBe('Updated Template Name');

    const delRes = await request(app)
      .delete(`/api/templates/${templateId}`)
      .set('Cookie', cookieA);
    expect(delRes.status).toBe(200);
  });
});
