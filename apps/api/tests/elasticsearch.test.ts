import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Client } from '@elastic/elasticsearch';
import { Job } from 'bullmq';

import { app } from '../src/app';
import {
  elasticsearchConfig,
  loadElasticsearchConfig,
  elasticsearchConfigSchema,
} from '../src/config/elasticsearch';
import {
  createElasticsearchClient,
  getElasticsearchClient,
  closeElasticsearchClient,
  isElasticsearchAvailable,
  getElasticsearchHealth,
} from '../src/services/search/elasticsearch.client';
import {
  EmailIndexService,
  emailIndexService,
  EMAIL_INDEX_MAPPINGS,
} from '../src/services/search/email-index.service';
import { EmailSearchService } from '../src/services/search/email-search.service';
import type { IndexedEmailDocument } from '../src/services/search/email-search.types';
import {
  enqueueIndexEmailJob,
  emailIndexQueue,
  type IndexEmailJobData,
} from '../src/queues/email-index.queue';
import { processIndexEmailJob } from '../src/workers/email-index.worker';
import prisma from '../src/lib/prisma';
import { EmailStatus, JobStatus, UserStatus, SenderStatus, CampaignStatus } from '@prisma/client';
import { processEmailJob } from '../src/workers/email.worker';
import type { EmailTransport } from '../src/services/smtp/email.transport';

describe('Phase 4 — Elasticsearch Indexing & Search', () => {
  const TEST_INDEX = `test-emails-${Date.now()}`;
  let esClient: Client;
  let indexService: EmailIndexService;
  let searchService: EmailSearchService;
  let isEsLive = false;

  beforeAll(async () => {
    esClient = getElasticsearchClient();
    isEsLive = await isElasticsearchAvailable(esClient);

    if (isEsLive) {
      indexService = new EmailIndexService(esClient, TEST_INDEX);
      searchService = new EmailSearchService(esClient, TEST_INDEX);
      await indexService.ensureIndex();
    }
  });

  afterAll(async () => {
    if (isEsLive) {
      try {
        await esClient.indices.delete({ index: TEST_INDEX });
      } catch {
        // ignore cleanup error
      }
    }
    await closeElasticsearchClient();
  });

  // ============================================================================
  // A. Configuration Validation
  // ============================================================================
  describe('A. Elasticsearch Configuration Validation', () => {
    it('validates and loads default configuration values correctly', () => {
      const cfg = loadElasticsearchConfig({});
      expect(cfg.url).toBe('http://localhost:9200');
      expect(cfg.index).toBe('emails');
      expect(cfg.requestTimeoutMs).toBe(10000);
      expect(cfg.indexingWorkerConcurrency).toBe(5);
      expect(cfg.indexingMaxAttempts).toBe(5);
      expect(cfg.indexingRetryDelayMs).toBe(3000);
    });

    it('rejects invalid URLs', () => {
      expect(() => {
        elasticsearchConfigSchema.parse({ url: 'not-a-valid-url' });
      }).toThrow();
    });

    it('parses custom environment variables properly', () => {
      const custom = loadElasticsearchConfig({
        ELASTICSEARCH_URL: 'http://elastic.internal:9200',
        ELASTICSEARCH_INDEX: 'custom-emails',
        ELASTICSEARCH_USERNAME: 'elastic_user',
        ELASTICSEARCH_PASSWORD: 'secret_password',
        INDEXING_WORKER_CONCURRENCY: '8',
      });

      expect(custom.url).toBe('http://elastic.internal:9200');
      expect(custom.index).toBe('custom-emails');
      expect(custom.username).toBe('elastic_user');
      expect(custom.password).toBe('secret_password');
      expect(custom.indexingWorkerConcurrency).toBe(8);
    });
  });

  // ============================================================================
  // B. Client Creation & Lifecycle
  // ============================================================================
  describe('B. Elasticsearch Client Creation & Lifecycle', () => {
    it('creates an official Client instance with expected properties', () => {
      const client = createElasticsearchClient({ url: 'http://localhost:9200' });
      expect(client).toBeInstanceOf(Client);
    });

    it('reuses client singleton on repeated calls', () => {
      const client1 = getElasticsearchClient();
      const client2 = getElasticsearchClient();
      expect(client1).toBe(client2);
    });

    it('verifies Elasticsearch health check status', async () => {
      const health = await getElasticsearchHealth(esClient);
      expect(health.status).toBe(isEsLive ? 'connected' : 'disconnected');
      if (isEsLive) {
        expect(health.clusterName).toBeDefined();
        expect(health.version).toBeDefined();
      }
    });
  });

  // ============================================================================
  // C & D. Index Creation & Explicit Mapping
  // ============================================================================
  describe('C & D. Index Creation & Explicit Mapping', () => {
    it('ensures index is created idempotently without throwing on duplicate calls', async () => {
      if (!isEsLive) return;

      const createdFirst = await indexService.ensureIndex();
      const createdSecond = await indexService.ensureIndex();

      expect(createdSecond).toBe(false); // Second call detects existing index
    });

    it('applies the required explicit field mappings', async () => {
      if (!isEsLive) return;

      const mappingResponse = await esClient.indices.getMapping({ index: TEST_INDEX });
      const mappings = mappingResponse[TEST_INDEX]?.mappings?.properties as any;

      expect(mappings).toBeDefined();
      expect(mappings.id.type).toBe('keyword');
      expect(mappings.campaignId.type).toBe('keyword');
      expect(mappings.userId.type).toBe('keyword');
      expect(mappings.senderId.type).toBe('keyword');
      expect(mappings.senderEmail.type).toBe('keyword');
      expect(mappings.recipient.type).toBe('keyword');
      expect(mappings.subject.type).toBe('text');
      expect(mappings.body.type).toBe('text');
      expect(mappings.status.type).toBe('keyword');
      expect(mappings.scheduledAt.type).toBe('date');
      expect(mappings.sentAt.type).toBe('date');
      expect(mappings.createdAt.type).toBe('date');
      expect(mappings.updatedAt.type).toBe('date');
      expect(mappings.idempotencyKey.type).toBe('keyword');
      expect(mappings.senderName.fields.keyword.type).toBe('keyword');
    });
  });

  // ============================================================================
  // E & F. Document Transformation & Deterministic IDs
  // ============================================================================
  describe('E & F. Document Transformation & Deterministic IDs', () => {
    it('transforms a database message record into an IndexedEmailDocument', () => {
      const dbRecord = {
        id: 'msg-trans-1',
        campaignId: 'camp-100',
        senderId: 'snd-200',
        recipient: 'recipient@example.com',
        subject: 'Weekly Digest',
        body: 'Here is your weekly update.',
        status: 'SENT',
        scheduledAt: new Date('2026-09-28T10:00:00Z'),
        sentAt: new Date('2026-09-28T10:00:05Z'),
        createdAt: new Date('2026-09-28T09:00:00Z'),
        updatedAt: new Date('2026-09-28T10:00:06Z'),
        idempotencyKey: 'idem-trans-1',
        campaign: { userId: 'usr-300' },
        sender: { email: 'newsletter@company.com', name: 'Company News' },
      };

      const doc = EmailIndexService.transformToDocument(dbRecord);

      expect(doc.id).toBe('msg-trans-1'); // Deterministic document ID = EmailMessage.id
      expect(doc.campaignId).toBe('camp-100');
      expect(doc.userId).toBe('usr-300');
      expect(doc.senderId).toBe('snd-200');
      expect(doc.senderEmail).toBe('newsletter@company.com');
      expect(doc.senderName).toBe('Company News');
      expect(doc.recipient).toBe('recipient@example.com');
      expect(doc.subject).toBe('Weekly Digest');
      expect(doc.body).toBe('Here is your weekly update.');
      expect(doc.status).toBe('SENT');
      expect(doc.scheduledAt).toBe('2026-09-28T10:00:00.000Z');
      expect(doc.sentAt).toBe('2026-09-28T10:00:05.000Z');
      expect(doc.idempotencyKey).toBe('idem-trans-1');
    });
  });

  // ============================================================================
  // G & H. Idempotent Indexing & Re-indexing
  // ============================================================================
  describe('G & H. Idempotent Indexing & Re-indexing', () => {
    it('indexes a single email using EmailMessage.id as deterministic document ID', async () => {
      if (!isEsLive) return;

      const doc: IndexedEmailDocument = {
        id: 'email-doc-1',
        campaignId: 'camp-1',
        userId: 'user-1',
        senderId: 'snd-1',
        senderEmail: 'alice@domain.com',
        senderName: 'Alice Smith',
        recipient: 'bob@example.com',
        subject: 'Hello Bob',
        body: 'Welcome to the platform',
        status: 'SENT',
        scheduledAt: new Date().toISOString(),
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageId: '<alice-1@domain.com>',
        idempotencyKey: 'idem-doc-1',
      };

      const result = await indexService.indexEmail(doc, { refresh: true });
      expect(result.id).toBe('email-doc-1');
      expect(result.action).toBe('created');

      // Verify retrieval by deterministic ID
      const retrieved = await esClient.get({ index: TEST_INDEX, id: 'email-doc-1' });
      expect(retrieved._source).toMatchObject({
        id: 'email-doc-1',
        subject: 'Hello Bob',
        recipient: 'bob@example.com',
      });
    });

    it('re-indexing the same email updates the existing document without creating duplicates', async () => {
      if (!isEsLive) return;

      const updatedDoc: IndexedEmailDocument = {
        id: 'email-doc-1',
        campaignId: 'camp-1',
        userId: 'user-1',
        senderId: 'snd-1',
        senderEmail: 'alice@domain.com',
        senderName: 'Alice Smith',
        recipient: 'bob@example.com',
        subject: 'Hello Bob - Updated Subject',
        body: 'Updated body content',
        status: 'SENT',
        scheduledAt: new Date().toISOString(),
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageId: '<alice-1@domain.com>',
        idempotencyKey: 'idem-doc-1',
      };

      const result = await indexService.indexEmail(updatedDoc, { refresh: true });
      expect(result.id).toBe('email-doc-1');
      expect(result.action).toBe('updated');

      // Verify that total documents matching ID is still exactly 1
      const count = await esClient.count({
        index: TEST_INDEX,
        query: { term: { id: 'email-doc-1' } },
      });
      expect(count.count).toBe(1);
    });

    it('updates partial fields on existing indexed email', async () => {
      if (!isEsLive) return;

      const updateResult = await indexService.updateEmail(
        'email-doc-1',
        { status: 'DELIVERED' },
        { refresh: true }
      );
      expect(updateResult.id).toBe('email-doc-1');

      const retrieved = await esClient.get<IndexedEmailDocument>({
        index: TEST_INDEX,
        id: 'email-doc-1',
      });
      expect(retrieved._source?.status).toBe('DELIVERED');
    });

    it('deletes an email document when requested', async () => {
      if (!isEsLive) return;

      const docToDelete: IndexedEmailDocument = {
        id: 'email-to-delete',
        campaignId: 'c-del',
        userId: 'u-del',
        senderId: 's-del',
        senderEmail: 'del@domain.com',
        senderName: 'Delete Me',
        recipient: 'target@domain.com',
        subject: 'Temporary',
        body: 'To be removed',
        status: 'DRAFT',
        scheduledAt: new Date().toISOString(),
        sentAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageId: null,
        idempotencyKey: 'del-idem',
      };

      await indexService.indexEmail(docToDelete, { refresh: true });
      const deleted = await indexService.deleteEmail('email-to-delete');
      expect(deleted).toBe(true);

      const exists = await esClient.exists({ index: TEST_INDEX, id: 'email-to-delete' });
      expect(exists).toBe(false);
    });
  });

  // ============================================================================
  // I-R. Search Capabilities
  // ============================================================================
  describe('I-R. Search Capabilities (Text, Filters, Range, Pagination, Sorting)', () => {
    beforeAll(async () => {
      if (!isEsLive) return;

      // Seed a rich dataset for search testing
      const testDocs: IndexedEmailDocument[] = [
        {
          id: 'search-1',
          campaignId: 'camp-alpha',
          userId: 'user-alice',
          senderId: 'sender-1',
          senderEmail: 'marketing@alpha.com',
          senderName: 'Alpha Marketing',
          recipient: 'lead1@customer.com',
          subject: 'Exclusive Winter Discount',
          body: 'Enjoy our special winter deals for loyal customers.',
          status: 'SENT',
          scheduledAt: '2026-09-20T08:00:00.000Z',
          sentAt: '2026-09-20T08:05:00.000Z',
          createdAt: '2026-09-19T10:00:00.000Z',
          updatedAt: '2026-09-20T08:05:00.000Z',
          messageId: '<winter-1@alpha.com>',
          idempotencyKey: 'idem-s1',
        },
        {
          id: 'search-2',
          campaignId: 'camp-alpha',
          userId: 'user-alice',
          senderId: 'sender-1',
          senderEmail: 'marketing@alpha.com',
          senderName: 'Alpha Marketing',
          recipient: 'lead2@enterprise.org',
          subject: 'Important System Security Notification',
          body: 'Please verify your billing account security settings.',
          status: 'SENT',
          scheduledAt: '2026-09-22T09:00:00.000Z',
          sentAt: '2026-09-22T09:02:00.000Z',
          createdAt: '2026-09-21T11:00:00.000Z',
          updatedAt: '2026-09-22T09:02:00.000Z',
          messageId: '<sec-2@alpha.com>',
          idempotencyKey: 'idem-s2',
        },
        {
          id: 'search-3',
          campaignId: 'camp-beta',
          userId: 'user-bob',
          senderId: 'sender-2',
          senderEmail: 'billing@beta.com',
          senderName: 'Beta Billing',
          recipient: 'lead3@customer.com',
          subject: 'Monthly Invoice Receipt',
          body: 'Your payment was received. Thank you for your business.',
          status: 'SENT',
          scheduledAt: '2026-09-25T14:00:00.000Z',
          sentAt: '2026-09-25T14:01:00.000Z',
          createdAt: '2026-09-24T12:00:00.000Z',
          updatedAt: '2026-09-25T14:01:00.000Z',
          messageId: '<inv-3@beta.com>',
          idempotencyKey: 'idem-s3',
        },
        {
          id: 'search-4',
          campaignId: 'camp-beta',
          userId: 'user-bob',
          senderId: 'sender-2',
          senderEmail: 'billing@beta.com',
          senderName: 'Beta Billing',
          recipient: 'support@partner.net',
          subject: 'Unfulfilled Order Inquiry',
          body: 'We are investigating the shipment delay for your winter gear.',
          status: 'FAILED',
          scheduledAt: '2026-09-26T16:00:00.000Z',
          sentAt: null,
          createdAt: '2026-09-26T15:00:00.000Z',
          updatedAt: '2026-09-26T16:05:00.000Z',
          messageId: null,
          idempotencyKey: 'idem-s4',
        },
      ];

      await indexService.bulkIndexEmails(testDocs, { refresh: true });
    });

    it('I. searches by subject keywords', async () => {
      if (!isEsLive) return;

      const result = await searchService.search({ q: 'Security Notification' });
      expect(result.items.some((doc) => doc.id === 'search-2')).toBe(true);
    });

    it('J. searches by body keywords', async () => {
      if (!isEsLive) return;

      const result = await searchService.search({ q: 'winter deals' });
      expect(result.items.some((doc) => doc.id === 'search-1')).toBe(true);
    });

    it('K. searches by recipient address', async () => {
      if (!isEsLive) return;

      const result = await searchService.search({ recipient: 'lead2@enterprise.org' });
      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe('search-2');
    });

    it('L. searches by sender email', async () => {
      if (!isEsLive) return;

      const result = await searchService.search({ senderEmail: 'marketing@alpha.com' });
      expect(result.total).toBe(2);
      expect(result.items.every((d) => d.senderEmail === 'marketing@alpha.com')).toBe(true);
    });

    it('M. filters by exact status', async () => {
      if (!isEsLive) return;

      const failedResult = await searchService.search({ status: 'FAILED' });
      expect(failedResult.total).toBe(1);
      expect(failedResult.items[0].id).toBe('search-4');
    });

    it('N. filters by campaignId and userId', async () => {
      if (!isEsLive) return;

      const result = await searchService.search({
        campaignId: 'camp-beta',
        userId: 'user-bob',
      });
      expect(result.total).toBe(2);
      expect(result.items.every((d) => d.campaignId === 'camp-beta')).toBe(true);
    });

    it('O. filters by date range (from / to)', async () => {
      if (!isEsLive) return;

      const result = await searchService.search({
        campaignId: 'camp-beta',
        dateField: 'sentAt',
        from: '2026-09-24T00:00:00.000Z',
        to: '2026-09-25T23:59:59.000Z',
      });

      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe('search-3');
    });

    it('P. supports pagination (page, pageSize)', async () => {
      if (!isEsLive) return;

      const page1 = await searchService.search({ pageSize: 2, page: 1, sort: 'createdAt:asc' });
      const page2 = await searchService.search({ pageSize: 2, page: 2, sort: 'createdAt:asc' });

      expect(page1.items.length).toBe(2);
      expect(page2.items.length).toBeGreaterThanOrEqual(1);
      expect(page1.items[0].id).not.toBe(page2.items[0].id);
      expect(page1.totalPages).toBeGreaterThanOrEqual(2);
    });

    it('Q. sorts results by requested date field and order', async () => {
      if (!isEsLive) return;

      const descResult = await searchService.search({ sort: 'createdAt:desc', pageSize: 10 });
      for (let i = 0; i < descResult.items.length - 1; i++) {
        const current = new Date(descResult.items[i].createdAt).getTime();
        const next = new Date(descResult.items[i + 1].createdAt).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it('R. returns clean empty result structure when no documents match', async () => {
      if (!isEsLive) return;

      const result = await searchService.search({ q: 'nonexistent-query-string-xyz-12345' });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.page).toBe(1);
    });
  });

  // ============================================================================
  // U & V. Bulk Indexing & Partial Failure Handling
  // ============================================================================
  describe('U & V. Bulk Indexing & Partial Failure Handling', () => {
    it('U. indexes a batch of documents using Elasticsearch bulk API', async () => {
      if (!isEsLive) return;

      const bulkDocs: IndexedEmailDocument[] = [
        {
          id: 'bulk-doc-1',
          campaignId: 'camp-bulk',
          userId: 'usr-bulk',
          senderId: 'snd-bulk',
          senderEmail: 'bulk1@domain.com',
          senderName: 'Bulk 1',
          recipient: 'r1@bulk.com',
          subject: 'Bulk Subject 1',
          body: 'Bulk body 1',
          status: 'SENT',
          scheduledAt: new Date().toISOString(),
          sentAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageId: '<b1@domain.com>',
          idempotencyKey: 'idem-b1',
        },
        {
          id: 'bulk-doc-2',
          campaignId: 'camp-bulk',
          userId: 'usr-bulk',
          senderId: 'snd-bulk',
          senderEmail: 'bulk2@domain.com',
          senderName: 'Bulk 2',
          recipient: 'r2@bulk.com',
          subject: 'Bulk Subject 2',
          body: 'Bulk body 2',
          status: 'SENT',
          scheduledAt: new Date().toISOString(),
          sentAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageId: '<b2@domain.com>',
          idempotencyKey: 'idem-b2',
        },
      ];

      const result = await indexService.bulkIndexEmails(bulkDocs, { refresh: true });
      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('V. handles partial bulk failures and inspects item-level errors', async () => {
      // Mock client that returns partial failure in bulk items
      const mockEsClient = {
        bulk: vi.fn().mockResolvedValue({
          errors: true,
          items: [
            {
              index: {
                _id: 'doc-ok',
                status: 200,
              },
            },
            {
              index: {
                _id: 'doc-failed',
                status: 400,
                error: {
                  type: 'mapper_parsing_exception',
                  reason: 'failed to parse field [sentAt] of type [date]',
                },
              },
            },
          ],
        }),
      } as unknown as Client;

      const mockService = new EmailIndexService(mockEsClient, 'test-index');
      const result = await mockService.bulkIndexEmails([
        { id: 'doc-ok' } as any,
        { id: 'doc-failed' } as any,
      ]);

      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].id).toBe('doc-failed');
      expect(result.errors[0].error).toContain('failed to parse field');
    });
  });

  // ============================================================================
  // S & T. Elasticsearch Outage & Decoupled SMTP Delivery
  // ============================================================================
  describe('S & T. Elasticsearch Outage & Decoupled SMTP Delivery', () => {
    it('S. search service gracefully handles non-existent index or 404', async () => {
      const mockClient = {
        search: vi.fn().mockRejectedValue({
          meta: { statusCode: 404 },
          message: 'index_not_found_exception',
        }),
      } as unknown as Client;

      const missingIndexSearch = new EmailSearchService(mockClient, 'non-existent-index');
      const result = await missingIndexSearch.search({ q: 'anything' });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('T. SMTP delivery success is NOT marked FAILED if Elasticsearch index enqueueing fails', async () => {
      const testEmail = `es-fail-${Date.now()}@example.org`;

      const user = await prisma.user.create({
        data: {
          email: testEmail,
          name: 'Decoupled User',
          status: UserStatus.ACTIVE,
        },
      });

      const sender = await prisma.senderAccount.create({
        data: {
          userId: user.id,
          email: `sender-${Date.now()}@ethereal.email`,
          name: 'Decoupled Sender',
          status: SenderStatus.ACTIVE,
        },
      });

      const campaign = await prisma.emailCampaign.create({
        data: {
          userId: user.id,
          senderId: sender.id,
          subject: 'Delivery Must Succeed',
          body: 'Testing failure isolation',
          status: CampaignStatus.PROCESSING,
          startAt: new Date(),
          delayMs: 2000,
          hourlyLimit: 100,
        },
      });

      const message = await prisma.emailMessage.create({
        data: {
          campaignId: campaign.id,
          senderId: sender.id,
          recipient: 'isolated@client.com',
          subject: 'Delivery Isolation',
          body: 'Testing decoupling',
          status: EmailStatus.SCHEDULED,
          scheduledAt: new Date(),
          idempotencyKey: `idem-decouple-${Date.now()}`,
          job: {
            create: {
              status: JobStatus.PENDING,
            },
          },
        },
        include: {
          job: true,
          sender: true,
        },
      });

      const mockTransport: EmailTransport = {
        send: vi.fn().mockResolvedValue({
          messageId: '<delivered-123@ethereal.email>',
          previewUrl: 'https://ethereal.email/message/test',
        }),
      };

      const mockJob = {
        id: `job-${message.id}`,
        data: { emailMessageId: message.id },
      } as unknown as Job;

      // Execute worker delivery
      await processEmailJob(mockJob as any, mockTransport, 0, 1000);

      // Verify PostgreSQL authoritative state: must be SENT and COMPLETED!
      const updatedMessage = await prisma.emailMessage.findUnique({
        where: { id: message.id },
        include: { job: true },
      });

      expect(updatedMessage?.status).toBe(EmailStatus.SENT);
      expect(updatedMessage?.job?.status).toBe(JobStatus.COMPLETED);
      expect(updatedMessage?.sentAt).not.toBeNull();
      expect(updatedMessage?.lastError).toBeNull();
    });
  });

  // ============================================================================
  // W & X. Index Worker Retry & Idempotent Index Queueing
  // ============================================================================
  describe('W & X. Index Worker Retry & Idempotent Index Queueing', () => {
    it('X. enqueues indexing job with deterministic job ID', async () => {
      const emailMessageId = `test-msg-idempotency-${Date.now()}`;
      const job1 = await enqueueIndexEmailJob(emailMessageId);
      expect(job1.id).toBe(`index-email-${emailMessageId}`);

      // Adding again with the same deterministic job ID does not create a duplicate
      const job2 = await enqueueIndexEmailJob(emailMessageId);
      expect(job2.id).toBe(`index-email-${emailMessageId}`);
    });

    it('W. index worker rethrows error on Elasticsearch failure so BullMQ can retry', async () => {
      // 1. Nonexistent valid UUID message skips without error
      const mockJobSkip = {
        id: 'index-job-skip',
        attemptsMade: 0,
        data: { emailMessageId: '00000000-0000-0000-0000-000000000000' },
      } as unknown as Job<IndexEmailJobData>;

      await expect(processIndexEmailJob(mockJobSkip)).resolves.toBeUndefined();

      // 2. Existing message rethrows on Elasticsearch failure to trigger BullMQ retry
      const spyIndex = vi
        .spyOn(emailIndexService, 'indexEmail')
        .mockRejectedValueOnce(new Error('Elasticsearch Connection Timeout'));

      // Look up any existing message in DB
      const existingMessage = await prisma.emailMessage.findFirst();
      if (existingMessage) {
        const mockJobRetry = {
          id: 'index-job-retry',
          attemptsMade: 0,
          data: { emailMessageId: existingMessage.id },
        } as unknown as Job<IndexEmailJobData>;

        await expect(processIndexEmailJob(mockJobRetry)).rejects.toThrow(
          'Elasticsearch Connection Timeout'
        );
      }

      spyIndex.mockRestore();
    });
  });

  // ============================================================================
  // Search API & Health Endpoint Tests
  // ============================================================================
  describe('Search API & Health Endpoints', () => {
    it('GET /health returns 200 with standard health status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('GET /health/elasticsearch reports Elasticsearch connectivity status', async () => {
      const res = await request(app).get('/health/elasticsearch');
      if (isEsLive) {
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('healthy');
        expect(res.body.elasticsearch.status).toBe('connected');
      } else {
        expect(res.status).toBe(503);
        expect(res.body.status).toBe('unhealthy');
      }
    });

    it('GET /api/emails/search rejects invalid query parameters with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get('/api/emails/search')
        .query({ page: -5, pageSize: 500, status: 'INVALID_STATUS' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('GET /api/emails/search executes valid query and returns clean search result schema', async () => {
      const res = await request(app)
        .get('/api/emails/search')
        .query({ q: 'discount', page: 1, pageSize: 10 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('pageSize', 10);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('totalPages');
      expect(Array.isArray(res.body.items)).toBe(true);
    });
  });
});
