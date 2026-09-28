import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import prisma from '../src/lib/prisma';
import { sessionService } from '../src/services/auth/session.service';
import { googleConfig } from '../src/config/google';
import { randomUUID as uuidv4 } from 'node:crypto';
import { parseCsvContent } from '../src/services/contact.service';

describe('Phase A — Contact Management System Tests', () => {
  let userA: { id: string; email: string; name: string };
  let userB: { id: string; email: string; name: string };
  let cookieA: string[];
  let cookieB: string[];

  beforeAll(async () => {
    userA = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: `contact-test-a-${Date.now()}@example.com`,
        name: 'Contact User A',
        googleId: `google-contact-a-${Date.now()}`,
      },
    });

    userB = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: `contact-test-b-${Date.now()}@example.com`,
        name: 'Contact User B',
        googleId: `google-contact-b-${Date.now()}`,
      },
    });

    cookieA = [`${googleConfig.SESSION_COOKIE_NAME}=${(await sessionService.createSession(userA.id)).rawToken}`];
    cookieB = [`${googleConfig.SESSION_COOKIE_NAME}=${(await sessionService.createSession(userB.id)).rawToken}`];
  });

  afterAll(async () => {
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

  // ============================================================================
  // 1. Authentication & Ownership Security
  // ============================================================================
  describe('Authentication & Ownership Security', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/contacts');
      expect(res.status).toBe(401);
    });

    it('creates a contact scoped strictly to authenticated user', async () => {
      const res = await request(app)
        .post('/api/contacts')
        .set('Cookie', cookieA)
        .send({
          email: 'alice@acme.inc',
          firstName: 'Alice',
          lastName: 'Smith',
          company: 'Acme Inc',
          jobTitle: 'VP Engineering',
          tags: ['executive', 'tech'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('alice@acme.inc');
      expect(res.body.data.userId).toBe(userA.id);
      expect(res.body.data.tags).toEqual(['executive', 'tech']);
    });

    it('prevents User B from accessing or viewing User A contacts', async () => {
      // User B lists contacts
      const resB = await request(app)
        .get('/api/contacts')
        .set('Cookie', cookieB);

      expect(resB.status).toBe(200);
      expect(resB.body.data).toHaveLength(0);
    });

    it('prevents duplicate contact email for the same user (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/contacts')
        .set('Cookie', cookieA)
        .send({
          email: 'alice@acme.inc',
          firstName: 'Duplicate Alice',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONTACT_ALREADY_EXISTS');
    });

    it('allows a different user to have the same contact email independently', async () => {
      const res = await request(app)
        .post('/api/contacts')
        .set('Cookie', cookieB)
        .send({
          email: 'alice@acme.inc',
          firstName: 'Alice in User B Org',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.userId).toBe(userB.id);
    });

    it('prevents User B from modifying User A contact (404 Not Found)', async () => {
      const listA = await request(app).get('/api/contacts').set('Cookie', cookieA);
      const contactA = listA.body.data[0];

      const res = await request(app)
        .patch(`/api/contacts/${contactA.id}`)
        .set('Cookie', cookieB)
        .send({ company: 'Malicious Update' });

      expect(res.status).toBe(404);
    });

    it('prevents User B from deleting User A contact (404 Not Found)', async () => {
      const listA = await request(app).get('/api/contacts').set('Cookie', cookieA);
      const contactA = listA.body.data[0];

      const res = await request(app)
        .delete(`/api/contacts/${contactA.id}`)
        .set('Cookie', cookieB);

      expect(res.status).toBe(404);
    });
  });

  // ============================================================================
  // 2. Validation & Input Sanitization
  // ============================================================================
  describe('Input Validation', () => {
    it('rejects invalid email formats with 400', async () => {
      const res = await request(app)
        .post('/api/contacts')
        .set('Cookie', cookieA)
        .send({
          email: 'not-an-email',
          firstName: 'Invalid',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('updates contact details successfully', async () => {
      const createRes = await request(app)
        .post('/api/contacts')
        .set('Cookie', cookieA)
        .send({
          email: 'bob@partner.org',
          firstName: 'Robert',
          company: 'Partner Org',
        });
      const bobId = createRes.body.data.id;

      const updateRes = await request(app)
        .patch(`/api/contacts/${bobId}`)
        .set('Cookie', cookieA)
        .send({
          jobTitle: 'Director of Partnerships',
          tags: ['partner', 'vip'],
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.jobTitle).toBe('Director of Partnerships');
      expect(updateRes.body.data.tags).toEqual(['partner', 'vip']);
    });

    it('deletes a contact successfully', async () => {
      const createRes = await request(app)
        .post('/api/contacts')
        .set('Cookie', cookieA)
        .send({
          email: 'delete-me@temp.com',
          firstName: 'Temp',
        });
      const tempId = createRes.body.data.id;

      const deleteRes = await request(app)
        .delete(`/api/contacts/${tempId}`)
        .set('Cookie', cookieA);

      expect(deleteRes.status).toBe(200);

      const verifyRes = await request(app)
        .get(`/api/contacts/${tempId}`)
        .set('Cookie', cookieA);
      expect(verifyRes.status).toBe(404);
    });
  });

  // ============================================================================
  // 3. Search & Tag Filtering
  // ============================================================================
  describe('Search & Tag Filtering', () => {
    it('searches contacts by company or name', async () => {
      const res = await request(app)
        .get('/api/contacts?search=Partner')
        .set('Cookie', cookieA);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].company).toContain('Partner');
    });

    it('filters contacts by tag', async () => {
      const res = await request(app)
        .get('/api/contacts?tag=vip')
        .set('Cookie', cookieA);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((c: { tags: string[] }) => c.tags.includes('vip'))).toBe(true);
    });

    it('fetches aggregated tags list for the user', async () => {
      const res = await request(app)
        .get('/api/contacts/tags')
        .set('Cookie', cookieA);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toContain('vip');
      expect(res.body.data).toContain('partner');
    });
  });

  // ============================================================================
  // 4. CSV Import Engine
  // ============================================================================
  describe('CSV Import Engine', () => {
    it('parses CSV lines with commas inside quotes properly', () => {
      const csv = `email,company,tags\n"ceo@example.com","Acme, Inc.","sales,marketing"`;
      const rows = parseCsvContent(csv);
      expect(rows).toHaveLength(2);
      expect(rows[1][0]).toBe('ceo@example.com');
      expect(rows[1][1]).toBe('Acme, Inc.');
      expect(rows[1][2]).toBe('sales,marketing');
    });

    it('imports CSV and produces an accurate summary (imported, duplicates, invalid, skipped)', async () => {
      const csvData = [
        'email,firstName,lastName,company,jobTitle,tags',
        'charlie@enterprise.com,Charlie,Brown,Enterprise Corp,CEO,enterprise',
        'diana@enterprise.com,Diana,Prince,Enterprise Corp,CTO,enterprise',
        'invalid-email-format,Bad,Email,None,None,none',
        'charlie@enterprise.com,DuplicateCharlie,Brown,Enterprise Corp,CEO,enterprise', // duplicate in file
        'alice@acme.inc,AliceExisting,Smith,Acme Inc,VP,tech', // duplicate against DB
        '   ', // skipped empty line
      ].join('\n');

      const res = await request(app)
        .post('/api/contacts/import')
        .set('Cookie', cookieA)
        .send({
          csv: csvData,
          defaultTags: ['campaign-import'],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(2); // charlie & diana
      expect(res.body.data.invalid).toBe(1); // invalid-email-format
      expect(res.body.data.duplicates).toBe(2); // 1 duplicate in file + 1 duplicate in DB
      expect(res.body.data.skipped).toBe(1); // empty line
      expect(res.body.data.totalRows).toBe(6);
    });

    it('handles empty CSV gracefully', async () => {
      const res = await request(app)
        .post('/api/contacts/import')
        .set('Cookie', cookieA)
        .send({
          csv: '',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.imported).toBe(0);
      expect(res.body.data.totalRows).toBe(0);
    });
  });

  // ============================================================================
  // 5. Bulk Deletion
  // ============================================================================
  describe('Bulk Deletion', () => {
    it('bulk deletes multiple selected contacts belonging to user', async () => {
      const listRes = await request(app).get('/api/contacts').set('Cookie', cookieA);
      const idsToDelete = listRes.body.data.slice(0, 2).map((c: { id: string }) => c.id);

      const deleteRes = await request(app)
        .post('/api/contacts/bulk-delete')
        .set('Cookie', cookieA)
        .send({ ids: idsToDelete });

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data.count).toBe(2);
    });
  });
});
