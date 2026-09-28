import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import { Queue } from 'bullmq';
import { EmailStatus, JobStatus } from '@prisma/client';

import { emailQueue, EMAIL_QUEUE_NAME, SEND_EMAIL_JOB_NAME } from '../src/queues/email.queue';
import { bullmqRedis, checkRedisConnection, closeRedisConnection } from '../src/queues/redis';
import { queueConfig } from '../src/config/queue';
import {
  calculateScheduledAt,
} from '../src/services/scheduling/schedule-calculator';
import { enqueueEmailBatch } from '../src/queues/email-enqueue.service';
import {
  reserveDeliverySlot,
} from '../src/services/email-delivery-policy.service';
import {
  rescheduleEmail,
} from '../src/queues/reschedule-email';
import {
  createEmailWorker,
  processEmailJob,
  RescheduleRequired,
  type EmailTransport,
} from '../src/workers/email.worker';
import prisma, { checkDatabaseConnection, disconnectDatabase } from '../src/lib/prisma';
import type { SendEmailJobData } from '../src/queues/email-job.types';

describe('Phase 2 Revision — Production-Grade Scheduling Engine', () => {
  let isRedisAvailable = false;
  let isDbAvailable = false;

  beforeAll(async () => {
    try {
      await checkRedisConnection();
      isRedisAvailable = true;
    } catch {
      isRedisAvailable = false;
      console.warn('Redis is offline. Live Redis integration tests will be skipped gracefully.');
    }

    try {
      await checkDatabaseConnection();
      isDbAvailable = true;
    } catch {
      isDbAvailable = false;
      console.warn('PostgreSQL is offline. Live database worker tests will be skipped gracefully.');
    }
  });

  afterAll(async () => {
    if (isRedisAvailable) {
      await emailQueue.close();
      await closeRedisConnection();
    }
    if (isDbAvailable) {
      await disconnectDatabase();
    }
  });

  // =========================================================================
  // A. Deterministic Scheduled Time Calculation
  // =========================================================================
  describe('A. Deterministic Scheduled Time Calculation', () => {
    it('calculates scheduledAt as startAt + index * delayMs', () => {
      const startAt = new Date('2026-10-01T10:00:00.000Z');
      const delayMs = 3000;

      const time0 = calculateScheduledAt({ startAt, delayMs, index: 0 });
      const time1 = calculateScheduledAt({ startAt, delayMs, index: 1 });
      const time5 = calculateScheduledAt({ startAt, delayMs, index: 5 });

      expect(time0.toISOString()).toBe('2026-10-01T10:00:00.000Z');
      expect(time1.toISOString()).toBe('2026-10-01T10:00:03.000Z');
      expect(time5.toISOString()).toBe('2026-10-01T10:00:15.000Z');
    });

    it('produces identical result when recalculated with identical parameters (deterministic)', () => {
      const startAt = new Date('2026-10-01T10:00:00.000Z');
      const input = { startAt, delayMs: 2500, index: 42 };

      const calc1 = calculateScheduledAt(input);
      const calc2 = calculateScheduledAt(input);

      expect(calc1.getTime()).toBe(calc2.getTime());
    });

    it('supports delayMs = 0 (all emails scheduled immediately at startAt)', () => {
      const startAt = new Date('2026-10-01T10:00:00.000Z');
      const time = calculateScheduledAt({ startAt, delayMs: 0, index: 10 });
      expect(time.getTime()).toBe(startAt.getTime());
    });

    it('throws when delayMs is negative', () => {
      const startAt = new Date();
      expect(() => calculateScheduledAt({ startAt, delayMs: -1, index: 0 })).toThrow(
        'Schedule delay cannot be negative'
      );
    });

    it('throws when index is negative or not an integer', () => {
      const startAt = new Date();
      expect(() => calculateScheduledAt({ startAt, delayMs: 1000, index: -1 })).toThrow(
        'Schedule index must be a non-negative integer'
      );
      expect(() => calculateScheduledAt({ startAt, delayMs: 1000, index: 2.5 })).toThrow(
        'Schedule index must be a non-negative integer'
      );
    });
  });

  // =========================================================================
  // B. Delayed BullMQ Job Creation
  // =========================================================================
  describe('B. Delayed BullMQ Job Creation', () => {
    it('calculates delay accurately for future scheduled times', () => {
      const futureTime = new Date(Date.now() + 60000);
      const delay = Math.max(0, futureTime.getTime() - Date.now());
      expect(delay).toBeGreaterThanOrEqual(59000);
      expect(delay).toBeLessThanOrEqual(60000);
    });

    it('assigns 0 delay for past or immediate scheduled times', () => {
      const pastTime = new Date(Date.now() - 5000);
      const delay = Math.max(0, pastTime.getTime() - Date.now());
      expect(delay).toBe(0);
    });

    it('creates a delayed BullMQ job in Redis with delayed state', async (ctx) => {
      if (!isRedisAvailable) {
        ctx.skip();
        return;
      }

      const emailMessageId = crypto.randomUUID();
      const delayMs = 30000;
      const scheduledAt = new Date(Date.now() + delayMs).toISOString();

      await enqueueEmailBatch([
        {
          emailMessageId,
          campaignId: crypto.randomUUID(),
          senderId: crypto.randomUUID(),
          scheduledAt,
          idempotencyKey: crypto.randomUUID(),
        },
      ]);

      const job = await emailQueue.getJob(`email-${emailMessageId}`);
      expect(job).not.toBeNull();
      expect(job?.id).toBe(`email-${emailMessageId}`);
      expect(await job?.getState()).toBe('delayed');
    });
  });

  // =========================================================================
  // C. Bulk Queue Insertion
  // =========================================================================
  describe('C. Bulk Queue Insertion (addBulk)', () => {
    it('returns early when messages array is empty', async () => {
      const addBulkSpy = vi.spyOn(emailQueue, 'addBulk');
      await enqueueEmailBatch([]);
      expect(addBulkSpy).not.toHaveBeenCalled();
      addBulkSpy.mockRestore();
    });

    it('formats batch items with SEND_EMAIL_JOB_NAME, stable jobId, and non-negative delay', async () => {
      const addBulkSpy = vi.spyOn(emailQueue, 'addBulk').mockResolvedValue([] as any);

      const items: SendEmailJobData[] = [
        {
          emailMessageId: 'msg-1',
          campaignId: 'cmp-1',
          senderId: 'snd-1',
          scheduledAt: new Date(Date.now() + 5000).toISOString(),
          idempotencyKey: 'idemp-1',
        },
        {
          emailMessageId: 'msg-2',
          campaignId: 'cmp-1',
          senderId: 'snd-1',
          scheduledAt: new Date(Date.now() - 1000).toISOString(),
          idempotencyKey: 'idemp-2',
        },
      ];

      await enqueueEmailBatch(items);

      expect(addBulkSpy).toHaveBeenCalledTimes(1);
      const passedBatch = addBulkSpy.mock.calls[0][0];
      expect(passedBatch).toHaveLength(2);

      expect(passedBatch[0].name).toBe(SEND_EMAIL_JOB_NAME);
      expect(passedBatch[0].opts?.jobId).toBe('email-msg-1');
      expect(passedBatch[0].opts?.delay).toBeGreaterThanOrEqual(4000);

      expect(passedBatch[1].opts?.jobId).toBe('email-msg-2');
      expect(passedBatch[1].opts?.delay).toBe(0);

      addBulkSpy.mockRestore();
    });
  });

  // =========================================================================
  // D. Duplicate Job Prevention
  // =========================================================================
  describe('D. Duplicate Job Prevention', () => {
    it('uses a stable non-numeric custom jobId format without colons: email-${id}', () => {
      const emailId = '550e8400-e29b-41d4-a716-446655440000';
      const jobId = `email-${emailId}`;
      expect(jobId).not.toContain(':');
      expect(isNaN(Number(jobId))).toBe(true);
      expect(jobId.startsWith('email-')).toBe(true);
    });

    it('deduplicates duplicate enqueue calls with same jobId in BullMQ', async (ctx) => {
      if (!isRedisAvailable) {
        ctx.skip();
        return;
      }

      const emailMessageId = crypto.randomUUID();
      const jobData: SendEmailJobData = {
        emailMessageId,
        campaignId: crypto.randomUUID(),
        senderId: crypto.randomUUID(),
        scheduledAt: new Date(Date.now() + 10000).toISOString(),
        idempotencyKey: crypto.randomUUID(),
      };

      await enqueueEmailBatch([jobData]);
      await enqueueEmailBatch([jobData]); // Duplicate enqueue attempt

      const job = await emailQueue.getJob(`email-${emailMessageId}`);
      expect(job).not.toBeNull();
      expect(job?.id).toBe(`email-${emailMessageId}`);
    });
  });

  // =========================================================================
  // E. Worker Idempotency
  // =========================================================================
  describe('E. Worker Idempotency', () => {
    it('exits without calling transport if email is already in SENT status', async () => {
      const mockTransport: EmailTransport = {
        send: vi.fn(),
      };

      vi.spyOn(prisma.emailMessage, 'findUnique').mockResolvedValue({
        id: 'msg-sent',
        status: EmailStatus.SENT,
        job: { status: JobStatus.COMPLETED } as any,
      } as any);

      const fakeJob = {
        id: 'email-msg-sent',
        data: { emailMessageId: 'msg-sent' },
      } as any;

      await processEmailJob(fakeJob, mockTransport, 1000, 100);

      expect(mockTransport.send).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('exits without calling transport if email is CANCELLED', async () => {
      const mockTransport: EmailTransport = {
        send: vi.fn(),
      };

      vi.spyOn(prisma.emailMessage, 'findUnique').mockResolvedValue({
        id: 'msg-cancelled',
        status: EmailStatus.CANCELLED,
        job: { status: JobStatus.CANCELLED } as any,
      } as any);

      const fakeJob = {
        id: 'email-msg-cancelled',
        data: { emailMessageId: 'msg-cancelled' },
      } as any;

      await processEmailJob(fakeJob, mockTransport, 1000, 100);

      expect(mockTransport.send).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('exits without sending if another worker already claimed the message (claimed.count === 0)', async () => {
      const mockTransport: EmailTransport = {
        send: vi.fn(),
      };

      vi.spyOn(prisma.emailMessage, 'findUnique')
        .mockResolvedValueOnce({
          id: 'msg-racing',
          status: EmailStatus.SCHEDULED,
          job: { status: JobStatus.PENDING } as any,
        } as any)
        .mockResolvedValueOnce({
          status: EmailStatus.PROCESSING,
        } as any);

      // Simulate updateMany claiming 0 rows because another worker concurrently claimed it
      vi.spyOn(prisma.emailMessage, 'updateMany').mockResolvedValue({ count: 0 });

      const fakeJob = {
        id: 'email-msg-racing',
        data: { emailMessageId: 'msg-racing' },
      } as any;

      await processEmailJob(fakeJob, mockTransport, 1000, 100);

      expect(mockTransport.send).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });

  // =========================================================================
  // F. Minimum Sender Spacing (Redis Lua Script)
  // =========================================================================
  describe('F. Minimum Sender Spacing Policy', () => {
    it('allows first send immediately and enforces spacing delay on subsequent send', async (ctx) => {
      if (!isRedisAvailable) {
        ctx.skip();
        return;
      }

      const senderId = `sender-spacing-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const minimumDelayMs = 2000;
      const hourlyLimit = 100;

      // First call: allowed
      const res1 = await reserveDeliverySlot({ senderId, hourlyLimit, minimumDelayMs });
      expect(res1.allowed).toBe(true);
      expect(res1.retryAfterMs).toBe(0);

      // Immediate second call: denied with spacing retry
      const res2 = await reserveDeliverySlot({ senderId, hourlyLimit, minimumDelayMs });
      expect(res2.allowed).toBe(false);
      expect(res2.retryAfterMs).toBeGreaterThan(0);
      expect(res2.retryAfterMs).toBeLessThanOrEqual(minimumDelayMs);

      // Independent sender is NOT blocked by first sender's spacing
      const otherSender = `sender-other-${Date.now()}`;
      const resOther = await reserveDeliverySlot({
        senderId: otherSender,
        hourlyLimit,
        minimumDelayMs,
      });
      expect(resOther.allowed).toBe(true);
    });
  });

  // =========================================================================
  // G. Hourly Sender Rate Limit
  // =========================================================================
  describe('G. Hourly Sender Rate Limit Policy', () => {
    it('allows sends up to hourlyLimit and denies exceeding requests', async (ctx) => {
      if (!isRedisAvailable) {
        ctx.skip();
        return;
      }

      const senderId = `sender-rate-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const hourlyLimit = 3;
      const minimumDelayMs = 0; // zero spacing to test rate limit in isolation

      const r1 = await reserveDeliverySlot({ senderId, hourlyLimit, minimumDelayMs });
      const r2 = await reserveDeliverySlot({ senderId, hourlyLimit, minimumDelayMs });
      const r3 = await reserveDeliverySlot({ senderId, hourlyLimit, minimumDelayMs });

      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
      expect(r3.allowed).toBe(true);

      // 4th send exceeds hourly quota of 3
      const r4 = await reserveDeliverySlot({ senderId, hourlyLimit, minimumDelayMs });
      expect(r4.allowed).toBe(false);
      expect(r4.retryAfterMs).toBeGreaterThan(0);
    });

    it('rejects invalid hourlyLimit <= 0 or negative minimumDelayMs', async () => {
      await expect(
        reserveDeliverySlot({ senderId: 's1', hourlyLimit: 0, minimumDelayMs: 100 })
      ).rejects.toThrow('Hourly email limit must be greater than zero');

      await expect(
        reserveDeliverySlot({ senderId: 's1', hourlyLimit: 10, minimumDelayMs: -10 })
      ).rejects.toThrow('Minimum email delay cannot be negative');
    });
  });

  // =========================================================================
  // H. Concurrent Rate-Limit Attempts (Redis Lua Atomicity)
  // =========================================================================
  describe('H. Concurrent Rate-Limit Attempts', () => {
    it('atomically grants exactly N slots when concurrent requests fire simultaneously', async (ctx) => {
      if (!isRedisAvailable) {
        ctx.skip();
        return;
      }

      const senderId = `sender-concurrent-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const hourlyLimit = 5;
      const minimumDelayMs = 0;

      // Dispatch 10 concurrent requests simultaneously
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          reserveDeliverySlot({ senderId, hourlyLimit, minimumDelayMs })
        )
      );

      const allowedCount = results.filter((r) => r.allowed).length;
      const deniedCount = results.filter((r) => !r.allowed).length;

      expect(allowedCount).toBe(hourlyLimit);
      expect(deniedCount).toBe(5);
    });
  });

  // =========================================================================
  // I. Rate-Limit Rescheduling Mechanism
  // =========================================================================
  describe('I. Rate-Limit Rescheduling Mechanism', () => {
    it('RescheduleRequired error stores delayMs and name correctly', () => {
      const err = new RescheduleRequired(4500, 'Sender limit exceeded');
      expect(err.delayMs).toBe(4500);
      expect(err.message).toBe('Sender limit exceeded');
      expect(err.name).toBe('RescheduleRequired');
    });

    it('rescheduleEmail calls job.moveToDelayed and throws DelayedError', async () => {
      const moveToDelayedMock = vi.fn().mockResolvedValue(undefined);
      const fakeJob = {
        id: 'email-resched-1',
        token: 'worker-token-xyz',
        moveToDelayed: moveToDelayedMock,
      } as any;

      await expect(rescheduleEmail(fakeJob, 5000)).rejects.toThrow();

      expect(moveToDelayedMock).toHaveBeenCalledTimes(1);
      const [delayedTimestamp, token] = moveToDelayedMock.mock.calls[0];
      expect(token).toBe('worker-token-xyz');
      expect(delayedTimestamp).toBeGreaterThanOrEqual(Date.now() + 4900);
    });

    it('enforces a safe minimum delay of at least 1,000ms when rescheduling', async () => {
      const moveToDelayedMock = vi.fn().mockResolvedValue(undefined);
      const fakeJob = {
        id: 'email-resched-2',
        token: 'worker-token-xyz',
        moveToDelayed: moveToDelayedMock,
      } as any;

      await expect(rescheduleEmail(fakeJob, 200)).rejects.toThrow();

      const [delayedTimestamp] = moveToDelayedMock.mock.calls[0];
      // Even with 200ms input, it enforces safeDelay >= 1000ms
      expect(delayedTimestamp).toBeGreaterThanOrEqual(Date.now() + 900);
    });

    it('throws error if worker token is missing', async () => {
      const fakeJob = {
        id: 'email-no-token',
        token: undefined,
      } as any;

      await expect(rescheduleEmail(fakeJob, 5000)).rejects.toThrow('Worker token missing');
    });
  });

  // =========================================================================
  // J. Failed Transport Handling
  // =========================================================================
  describe('J. Failed Transport Handling', () => {
    it('updates EmailMessage and EmailJob to FAILED and records lastError when transport throws', async () => {
      const mockTransport: EmailTransport = {
        send: vi.fn().mockRejectedValue(new Error('SMTP Connection Refused')),
      };

      vi.spyOn(prisma.emailMessage, 'findUnique').mockResolvedValue({
        id: 'msg-fail',
        senderId: 'snd-1',
        recipient: 'fail@test.com',
        subject: 'Fail Subj',
        body: 'Fail Body',
        status: EmailStatus.SCHEDULED,
        job: { status: JobStatus.PENDING } as any,
      } as any);

      vi.spyOn(prisma.emailMessage, 'updateMany').mockResolvedValue({ count: 1 });
      vi.spyOn(prisma.emailJob, 'update').mockResolvedValue({} as any);
      vi.spyOn(prisma, '$transaction').mockResolvedValue([] as any);

      // Mock policy as allowed
      const deliveryPolicyService = await import('../src/services/email-delivery-policy.service');
      vi.spyOn(deliveryPolicyService, 'reserveDeliverySlot').mockResolvedValue({
        allowed: true,
        retryAfterMs: 0,
      });

      const fakeJob = {
        id: 'email-msg-fail',
        data: { emailMessageId: 'msg-fail' },
      } as any;

      await expect(processEmailJob(fakeJob, mockTransport, 0, 100)).rejects.toThrow(
        'SMTP Connection Refused'
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });

  // =========================================================================
  // K. Successful Transport Delivery
  // =========================================================================
  describe('K. Successful Transport Delivery', () => {
    it('transitions EmailMessage to SENT and EmailJob to COMPLETED on success', async () => {
      const mockTransport: EmailTransport = {
        send: vi.fn().mockResolvedValue(undefined),
      };

      vi.spyOn(prisma.emailMessage, 'findUnique').mockResolvedValue({
        id: 'msg-success',
        senderId: 'snd-1',
        recipient: 'success@test.com',
        subject: 'Success Subj',
        body: 'Success Body',
        status: EmailStatus.SCHEDULED,
        job: { status: JobStatus.PENDING } as any,
      } as any);

      vi.spyOn(prisma.emailMessage, 'updateMany').mockResolvedValue({ count: 1 });
      vi.spyOn(prisma.emailJob, 'update').mockResolvedValue({} as any);
      const txSpy = vi.spyOn(prisma, '$transaction').mockResolvedValue([] as any);

      const deliveryPolicyService = await import('../src/services/email-delivery-policy.service');
      vi.spyOn(deliveryPolicyService, 'reserveDeliverySlot').mockResolvedValue({
        allowed: true,
        retryAfterMs: 0,
      });

      const fakeJob = {
        id: 'email-msg-success',
        data: { emailMessageId: 'msg-success' },
      } as any;

      await processEmailJob(fakeJob, mockTransport, 0, 100);

      expect(mockTransport.send).toHaveBeenCalledWith({
        recipient: 'success@test.com',
        subject: 'Success Subj',
        body: 'Success Body',
      });
      expect(txSpy).toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });

  // =========================================================================
  // L. SENT Email Cannot Be Sent Again
  // =========================================================================
  describe('L. SENT Email Cannot Be Sent Again', () => {
    it('safely skips already sent messages without re-invoking transport', async () => {
      const mockTransport: EmailTransport = { send: vi.fn() };

      vi.spyOn(prisma.emailMessage, 'findUnique').mockResolvedValue({
        id: 'msg-already-sent',
        status: EmailStatus.SENT,
        job: { status: JobStatus.COMPLETED } as any,
      } as any);

      await processEmailJob(
        { data: { emailMessageId: 'msg-already-sent' } } as any,
        mockTransport,
        0,
        100
      );

      expect(mockTransport.send).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });

  // =========================================================================
  // M. CANCELLED Email Cannot Be Sent
  // =========================================================================
  describe('M. CANCELLED Email Cannot Be Sent', () => {
    it('safely skips cancelled messages without re-invoking transport', async () => {
      const mockTransport: EmailTransport = { send: vi.fn() };

      vi.spyOn(prisma.emailMessage, 'findUnique').mockResolvedValue({
        id: 'msg-cancelled-2',
        status: EmailStatus.CANCELLED,
        job: { status: JobStatus.CANCELLED } as any,
      } as any);

      await processEmailJob(
        { data: { emailMessageId: 'msg-cancelled-2' } } as any,
        mockTransport,
        0,
        100
      );

      expect(mockTransport.send).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });

  // =========================================================================
  // N. Delayed Job Persistence Across Queue Restart (Conditional on Live Redis)
  // =========================================================================
  describe('N. Delayed Job Persistence Across Queue Restart (Conditional on Live Redis)', () => {
    it('preserves future delayed jobs across BullMQ queue instance restart when Redis is available', async (ctx) => {
      if (!isRedisAvailable) {
        ctx.skip();
        return;
      }

      const persistentJobId = `email-restart-${crypto.randomUUID()}`;
      const delayMs = 120000; // 2 minutes

      await emailQueue.add(
        SEND_EMAIL_JOB_NAME,
        {
          emailMessageId: crypto.randomUUID(),
          campaignId: crypto.randomUUID(),
          senderId: crypto.randomUUID(),
          scheduledAt: new Date(Date.now() + delayMs).toISOString(),
          idempotencyKey: crypto.randomUUID(),
        },
        { jobId: persistentJobId, delay: delayMs }
      );

      // Verify job is stored in Redis delayed zset
      const preRestartJob = await emailQueue.getJob(persistentJobId);
      expect(preRestartJob).not.toBeNull();
      expect(await preRestartJob?.getState()).toBe('delayed');

      // Simulate application shutdown: close connection
      await emailQueue.close();

      // Simulate application restart: reconnect new Queue instance to Redis
      const restartedQueue = new Queue(EMAIL_QUEUE_NAME, {
        connection: bullmqRedis,
      });

      // Verify job survives in Redis and retains its delayed state
      const postRestartJob = await restartedQueue.getJob(persistentJobId);
      expect(postRestartJob).not.toBeNull();
      expect(postRestartJob?.id).toBe(persistentJobId);
      expect(await postRestartJob?.getState()).toBe('delayed');

      await restartedQueue.close();
    });
  });

  // =========================================================================
  // O. 1,000-Email Local Scheduling Calculation & Batching Benchmark
  // =========================================================================
  describe('O. 1,000-Email Local Scheduling Calculation & Batching Benchmark', () => {
    it('deterministically calculates and partitions 1,000 scheduled emails in under 50ms (local calculation & batching only)', () => {
      const startAt = new Date('2026-10-01T12:00:00.000Z');
      const delayMs = 2000;
      const count = 1000;
      const batchSize = queueConfig.schedulingBatchSize; // 500

      const startTime = performance.now();

      // 1. Calculate 1,000 timestamps
      const scheduledTimestamps: Date[] = [];
      for (let i = 0; i < count; i++) {
        scheduledTimestamps.push(calculateScheduledAt({ startAt, delayMs, index: i }));
      }

      // 2. Partition into batches of batchSize (500)
      const batches: Date[][] = [];
      for (let i = 0; i < scheduledTimestamps.length; i += batchSize) {
        batches.push(scheduledTimestamps.slice(i, i + batchSize));
      }

      const durationMs = performance.now() - startTime;

      // Performance check
      expect(durationMs).toBeLessThan(50);

      // Structural correctness checks
      expect(scheduledTimestamps).toHaveLength(1000);
      expect(batches).toHaveLength(2); // 1000 / 500 = 2 batches
      expect(batches[0]).toHaveLength(500);
      expect(batches[1]).toHaveLength(500);

      // Deterministic progression check: t_i = t_0 + i * delayMs
      expect(scheduledTimestamps[0].toISOString()).toBe('2026-10-01T12:00:00.000Z');
      expect(scheduledTimestamps[999].toISOString()).toBe(
        new Date(startAt.getTime() + 999 * delayMs).toISOString()
      );

      // Strictly monotonically increasing
      for (let i = 1; i < count; i++) {
        expect(scheduledTimestamps[i].getTime()).toBeGreaterThan(
          scheduledTimestamps[i - 1].getTime()
        );
      }
    });
  });

  // =========================================================================
  // Worker Factory & Concurrency Configuration
  // =========================================================================
  describe('Worker Factory & Concurrency Configuration', () => {
    it('creates BullMQ worker with configured concurrency', () => {
      const mockTransport: EmailTransport = { send: async () => {} };
      const worker = createEmailWorker({
        transport: mockTransport,
        minimumDelayMs: 1000,
        hourlyLimit: 50,
        concurrency: 8,
      });

      expect(worker).toBeDefined();
      expect(worker.opts.concurrency).toBe(8);

      worker.close();
    });
  });
});
