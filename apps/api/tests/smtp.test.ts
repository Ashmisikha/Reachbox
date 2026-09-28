import { describe, it, expect, vi } from 'vitest';
import { EmailStatus, JobStatus } from '@prisma/client';

import {
  smtpConfig,
  smtpConfigSchema,
  validateSmtpCredentials,
} from '../src/config/smtp';
import {
  type EmailTransport,
  type EmailTransportInput,
  type EmailTransportResult,
  EtherealEmailTransport,
  SmtpTransportManager,
} from '../src/services/smtp';
import { processEmailJob, createEmailWorker } from '../src/workers/email.worker';
import prisma from '../src/lib/prisma';

describe('Phase 3 — Ethereal SMTP + Real Email Dispatch', () => {
  // =========================================================================
  // A. SMTP Configuration Validation
  // =========================================================================
  describe('A. SMTP Configuration Validation', () => {
    it('validates default Ethereal settings in smtpConfigSchema', () => {
      const parsed = smtpConfigSchema.parse({});
      expect(parsed.ETHEREAL_HOST).toBe('smtp.ethereal.email');
      expect(parsed.ETHEREAL_PORT).toBe(587);
      expect(parsed.ETHEREAL_SECURE).toBe(false);
      expect(parsed.SMTP_POOL).toBe(true);
      expect(parsed.SMTP_MAX_CONNECTIONS).toBe(5);
      expect(parsed.SMTP_MAX_MESSAGES).toBe(100);
    });

    it('validateSmtpCredentials throws if user is missing or whitespace', () => {
      expect(() => validateSmtpCredentials('', 'some-pass')).toThrow(
        'Ethereal SMTP user credential (ETHEREAL_USER) is missing or empty'
      );
      expect(() => validateSmtpCredentials('   ', 'some-pass')).toThrow(
        'Ethereal SMTP user credential (ETHEREAL_USER) is missing or empty'
      );
    });

    it('validateSmtpCredentials throws if password is missing or whitespace', () => {
      expect(() => validateSmtpCredentials('some-user', '')).toThrow(
        'Ethereal SMTP password credential (ETHEREAL_PASSWORD) is missing or empty'
      );
      expect(() => validateSmtpCredentials('some-user', '   ')).toThrow(
        'Ethereal SMTP password credential (ETHEREAL_PASSWORD) is missing or empty'
      );
    });

    it('validateSmtpCredentials passes when user and password are valid', () => {
      expect(() => validateSmtpCredentials('valid_user', 'valid_pass')).not.toThrow();
    });
  });

  // =========================================================================
  // B-F. Message Field Construction (From address/name, Recipient, Subject, Body)
  // =========================================================================
  describe('B-F. Message Field Construction & Dispatch', () => {
    it('extracts From address, From display name, recipient, subject, and body from PostgreSQL record', async () => {
      let dispatchedInput: EmailTransportInput | null = null;

      const fakeTransport: EmailTransport = {
        async send(input: EmailTransportInput): Promise<EmailTransportResult> {
          dispatchedInput = input;
          return {
            messageId: '<test-message-123@ethereal.email>',
            previewUrl: 'https://ethereal.email/message/test-message-123',
          };
        },
        async close(): Promise<void> {},
      };

      vi.spyOn(prisma.emailMessage, 'findUnique').mockResolvedValue({
        id: 'msg-construct-1',
        senderId: 'sender-alice',
        recipient: 'client@example.org',
        subject: 'Welcome to ReachInbox',
        body: 'Deterministic email body content.',
        status: EmailStatus.SCHEDULED,
        attemptCount: 0,
        job: { status: JobStatus.PENDING } as any,
        sender: {
          id: 'sender-alice',
          email: 'alice@ethereal.email',
          name: 'Alice Cooper',
        } as any,
      } as any);

      vi.spyOn(prisma.emailMessage, 'updateMany').mockResolvedValue({ count: 1 });
      vi.spyOn(prisma.emailMessage, 'update').mockReturnValue({} as any);
      vi.spyOn(prisma.emailJob, 'update').mockReturnValue({} as any);
      vi.spyOn(prisma, '$transaction').mockResolvedValue([] as any);

      const deliveryPolicyService = await import('../src/services/email-delivery-policy.service');
      vi.spyOn(deliveryPolicyService, 'reserveDeliverySlot').mockResolvedValue({
        allowed: true,
        retryAfterMs: 0,
      });

      const fakeJob = {
        id: 'email-msg-construct-1',
        data: { emailMessageId: 'msg-construct-1' },
      } as any;

      await processEmailJob(fakeJob, fakeTransport, 0, 100);

      expect(dispatchedInput).not.toBeNull();
      // B. Correct From address
      expect(dispatchedInput!.from.email).toBe('alice@ethereal.email');
      // C. Correct From display name
      expect(dispatchedInput!.from.name).toBe('Alice Cooper');
      // D. Correct recipient
      expect(dispatchedInput!.recipient).toBe('client@example.org');
      // E. Correct subject
      expect(dispatchedInput!.subject).toBe('Welcome to ReachInbox');
      // F. Correct body
      expect(dispatchedInput!.body).toBe('Deterministic email body content.');

      vi.restoreAllMocks();
    });

    it('handles sender with null name gracefully (omits display name)', async () => {
      let dispatchedInput: EmailTransportInput | null = null;

      const fakeTransport: EmailTransport = {
        async send(input: EmailTransportInput): Promise<EmailTransportResult> {
          dispatchedInput = input;
          return { messageId: '<test-null-name@ethereal.email>' };
        },
        async close(): Promise<void> {},
      };

      vi.spyOn(prisma.emailMessage, 'findUnique').mockResolvedValue({
        id: 'msg-no-name',
        senderId: 'sender-no-name',
        recipient: 'recipient@test.com',
        subject: 'No Name Subject',
        body: 'Body',
        status: EmailStatus.SCHEDULED,
        attemptCount: 0,
        job: { status: JobStatus.PENDING } as any,
        sender: {
          id: 'sender-no-name',
          email: 'noname@ethereal.email',
          name: null,
        } as any,
      } as any);

      vi.spyOn(prisma.emailMessage, 'updateMany').mockResolvedValue({ count: 1 });
      vi.spyOn(prisma.emailMessage, 'update').mockReturnValue({} as any);
      vi.spyOn(prisma.emailJob, 'update').mockReturnValue({} as any);
      vi.spyOn(prisma, '$transaction').mockResolvedValue([] as any);

      const deliveryPolicyService = await import('../src/services/email-delivery-policy.service');
      vi.spyOn(deliveryPolicyService, 'reserveDeliverySlot').mockResolvedValue({
        allowed: true,
        retryAfterMs: 0,
      });

      await processEmailJob(
        { id: 'job-1', data: { emailMessageId: 'msg-no-name' } } as any,
        fakeTransport,
        0,
        100
      );

      expect(dispatchedInput!.from.email).toBe('noname@ethereal.email');
      expect(dispatchedInput!.from.name).toBeUndefined();

      vi.restoreAllMocks();
    });
  });

  // =========================================================================
  // G. Successful Transport & State Transitions (I)
  // =========================================================================
  describe('G & I. Successful Transport & State Transitions', () => {
    it('worker marks EmailMessage SENT and EmailJob COMPLETED after successful SMTP acceptance', async () => {
      const fakeTransport: EmailTransport = {
        send: vi.fn().mockResolvedValue({
          messageId: '<success-msg@ethereal.email>',
          previewUrl: 'https://ethereal.email/message/success-msg',
        }),
        close: vi.fn(),
      };

      vi.spyOn(prisma.emailMessage, 'findUnique').mockResolvedValue({
        id: 'msg-success-flow',
        senderId: 'sender-1',
        recipient: 'user@domain.com',
        subject: 'Success Flow',
        body: 'Success Body',
        status: EmailStatus.SCHEDULED,
        attemptCount: 0,
        job: { status: JobStatus.PENDING } as any,
        sender: {
          id: 'sender-1',
          email: 'sender1@ethereal.email',
          name: 'Sender 1',
        } as any,
      } as any);

      vi.spyOn(prisma.emailMessage, 'updateMany').mockResolvedValue({ count: 1 });
      const messageUpdateSpy = vi.spyOn(prisma.emailMessage, 'update').mockReturnValue({} as any);
      const jobUpdateSpy = vi.spyOn(prisma.emailJob, 'update').mockReturnValue({} as any);
      const txSpy = vi.spyOn(prisma, '$transaction').mockResolvedValue([] as any);

      const deliveryPolicyService = await import('../src/services/email-delivery-policy.service');
      vi.spyOn(deliveryPolicyService, 'reserveDeliverySlot').mockResolvedValue({
        allowed: true,
        retryAfterMs: 0,
      });

      await processEmailJob(
        { id: 'job-success', data: { emailMessageId: 'msg-success-flow' } } as any,
        fakeTransport,
        0,
        100
      );

      expect(fakeTransport.send).toHaveBeenCalledTimes(1);
      expect(txSpy).toHaveBeenCalledTimes(1);

      // Verify the transaction array contains updates to SENT and COMPLETED
      expect(messageUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'msg-success-flow' },
          data: expect.objectContaining({
            status: EmailStatus.SENT,
            lastError: null,
          }),
        })
      );

      expect(jobUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { emailMessageId: 'msg-success-flow' },
          data: expect.objectContaining({
            status: JobStatus.COMPLETED,
            lastError: null,
          }),
        })
      );

      vi.restoreAllMocks();
    });
  });

  // =========================================================================
  // H & J. SMTP Failure Handling
  // =========================================================================
  describe('H & J. SMTP Failure Handling', () => {
    it('marks EmailMessage and EmailJob FAILED and rethrows error for BullMQ retry', async () => {
      const fakeTransport: EmailTransport = {
        send: vi.fn().mockRejectedValue(new Error('SMTP Connection Refused (ECONNREFUSED)')),
        close: vi.fn(),
      };

      vi.spyOn(prisma.emailMessage, 'findUnique').mockResolvedValue({
        id: 'msg-fail-flow',
        senderId: 'sender-1',
        recipient: 'fail@domain.com',
        subject: 'Fail Flow',
        body: 'Fail Body',
        status: EmailStatus.SCHEDULED,
        attemptCount: 0,
        job: { status: JobStatus.PENDING } as any,
        sender: {
          id: 'sender-1',
          email: 'sender1@ethereal.email',
          name: 'Sender 1',
        } as any,
      } as any);

      vi.spyOn(prisma.emailMessage, 'updateMany').mockResolvedValue({ count: 1 });
      const messageUpdateSpy = vi.spyOn(prisma.emailMessage, 'update').mockReturnValue({} as any);
      const jobUpdateSpy = vi.spyOn(prisma.emailJob, 'update').mockReturnValue({} as any);
      const txSpy = vi.spyOn(prisma, '$transaction').mockResolvedValue([] as any);

      const deliveryPolicyService = await import('../src/services/email-delivery-policy.service');
      vi.spyOn(deliveryPolicyService, 'reserveDeliverySlot').mockResolvedValue({
        allowed: true,
        retryAfterMs: 0,
      });

      await expect(
        processEmailJob(
          { id: 'job-fail', data: { emailMessageId: 'msg-fail-flow' } } as any,
          fakeTransport,
          0,
          100
        )
      ).rejects.toThrow('SMTP Connection Refused (ECONNREFUSED)');

      expect(txSpy).toHaveBeenCalledTimes(1);

      // Verify that status was updated to FAILED, not SENT
      expect(messageUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'msg-fail-flow' },
          data: expect.objectContaining({
            status: EmailStatus.FAILED,
            lastError: expect.stringContaining('SMTP Connection Refused'),
          }),
        })
      );

      expect(jobUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { emailMessageId: 'msg-fail-flow' },
          data: expect.objectContaining({
            status: JobStatus.FAILED,
            lastError: expect.stringContaining('SMTP Connection Refused'),
          }),
        })
      );

      vi.restoreAllMocks();
    });
  });

  // =========================================================================
  // K. Sender Lookup
  // =========================================================================
  describe('K. Sender Lookup', () => {
    it('throws descriptive error if SenderAccount is missing from PostgreSQL', async () => {
      const fakeTransport: EmailTransport = {
        send: vi.fn(),
        close: vi.fn(),
      };

      vi.spyOn(prisma.emailMessage, 'findUnique').mockResolvedValue({
        id: 'msg-missing-sender',
        senderId: 'sender-not-exist',
        recipient: 'test@domain.com',
        subject: 'Subj',
        body: 'Body',
        status: EmailStatus.SCHEDULED,
        job: { status: JobStatus.PENDING } as any,
        sender: null, // Sender missing
      } as any);

      await expect(
        processEmailJob(
          { id: 'job-missing', data: { emailMessageId: 'msg-missing-sender' } } as any,
          fakeTransport,
          0,
          100
        )
      ).rejects.toThrow('Sender account sender-not-exist not found');

      expect(fakeTransport.send).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });

  // =========================================================================
  // L. Multiple Sender Identities
  // =========================================================================
  describe('L. Multiple Sender Identities', () => {
    it('correctly resolves distinct sender identities for different campaign messages', async () => {
      const sentFromAddresses: string[] = [];

      const fakeTransport: EmailTransport = {
        async send(input: EmailTransportInput): Promise<EmailTransportResult> {
          sentFromAddresses.push(input.from.email);
          return { messageId: '<sent@ethereal.email>' };
        },
        async close(): Promise<void> {},
      };

      vi.spyOn(prisma.emailMessage, 'updateMany').mockResolvedValue({ count: 1 });
      vi.spyOn(prisma.emailMessage, 'update').mockReturnValue({} as any);
      vi.spyOn(prisma.emailJob, 'update').mockReturnValue({} as any);
      vi.spyOn(prisma, '$transaction').mockResolvedValue([] as any);

      const deliveryPolicyService = await import('../src/services/email-delivery-policy.service');
      vi.spyOn(deliveryPolicyService, 'reserveDeliverySlot').mockResolvedValue({
        allowed: true,
        retryAfterMs: 0,
      });

      // Message 1 with Sender A
      vi.spyOn(prisma.emailMessage, 'findUnique').mockResolvedValueOnce({
        id: 'msg-sender-a',
        senderId: 'snd-a',
        recipient: 'r1@test.com',
        subject: 'S1',
        body: 'B1',
        status: EmailStatus.SCHEDULED,
        attemptCount: 0,
        job: { status: JobStatus.PENDING } as any,
        sender: { id: 'snd-a', email: 'alice@company-a.com', name: 'Alice' } as any,
      } as any);

      await processEmailJob(
        { id: 'job-a', data: { emailMessageId: 'msg-sender-a' } } as any,
        fakeTransport,
        0,
        100
      );

      // Message 2 with Sender B
      vi.spyOn(prisma.emailMessage, 'findUnique').mockResolvedValueOnce({
        id: 'msg-sender-b',
        senderId: 'snd-b',
        recipient: 'r2@test.com',
        subject: 'S2',
        body: 'B2',
        status: EmailStatus.SCHEDULED,
        attemptCount: 0,
        job: { status: JobStatus.PENDING } as any,
        sender: { id: 'snd-b', email: 'bob@company-b.com', name: 'Bob' } as any,
      } as any);

      await processEmailJob(
        { id: 'job-b', data: { emailMessageId: 'msg-sender-b' } } as any,
        fakeTransport,
        0,
        100
      );

      expect(sentFromAddresses).toEqual(['alice@company-a.com', 'bob@company-b.com']);
      vi.restoreAllMocks();
    });
  });

  // =========================================================================
  // M & N. Idempotency (Already-SENT & CANCELLED)
  // =========================================================================
  describe('M & N. Idempotency', () => {
    it('already-SENT message is skipped without calling transport', async () => {
      const fakeTransport: EmailTransport = { send: vi.fn(), close: vi.fn() };

      vi.spyOn(prisma.emailMessage, 'findUnique').mockResolvedValue({
        id: 'msg-already-sent',
        status: EmailStatus.SENT,
        job: { status: JobStatus.COMPLETED } as any,
        sender: { id: 'snd-1', email: 's@ethereal.email' } as any,
      } as any);

      await processEmailJob(
        { data: { emailMessageId: 'msg-already-sent' } } as any,
        fakeTransport,
        0,
        100
      );

      expect(fakeTransport.send).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('CANCELLED message is skipped without calling transport', async () => {
      const fakeTransport: EmailTransport = { send: vi.fn(), close: vi.fn() };

      vi.spyOn(prisma.emailMessage, 'findUnique').mockResolvedValue({
        id: 'msg-cancelled',
        status: EmailStatus.CANCELLED,
        job: { status: JobStatus.CANCELLED } as any,
        sender: { id: 'snd-1', email: 's@ethereal.email' } as any,
      } as any);

      await processEmailJob(
        { data: { emailMessageId: 'msg-cancelled' } } as any,
        fakeTransport,
        0,
        100
      );

      expect(fakeTransport.send).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });

  // =========================================================================
  // O. Retry Behavior (Claim from FAILED status)
  // =========================================================================
  describe('O. Retry Behavior', () => {
    it('successfully reclaims a previously FAILED email on BullMQ retry and delivers it', async () => {
      const fakeTransport: EmailTransport = {
        send: vi.fn().mockResolvedValue({ messageId: '<retry-success@ethereal.email>' }),
        close: vi.fn(),
      };

      // Message is currently in FAILED status from a prior attempt
      vi.spyOn(prisma.emailMessage, 'findUnique').mockResolvedValue({
        id: 'msg-retry',
        senderId: 'snd-1',
        recipient: 'retry@test.com',
        subject: 'Retry Test',
        body: 'Retry Body',
        status: EmailStatus.FAILED,
        attemptCount: 1,
        lastError: 'Prior transient error',
        job: { status: JobStatus.FAILED, attempts: 1 } as any,
        sender: { id: 'snd-1', email: 'snd@ethereal.email', name: 'Sender' } as any,
      } as any);

      // The claim accepts status in: [SCHEDULED, FAILED]
      vi.spyOn(prisma.emailMessage, 'updateMany').mockResolvedValue({ count: 1 });
      const messageUpdateSpy = vi.spyOn(prisma.emailMessage, 'update').mockReturnValue({} as any);
      vi.spyOn(prisma.emailJob, 'update').mockReturnValue({} as any);
      vi.spyOn(prisma, '$transaction').mockResolvedValue([] as any);

      const deliveryPolicyService = await import('../src/services/email-delivery-policy.service');
      vi.spyOn(deliveryPolicyService, 'reserveDeliverySlot').mockResolvedValue({
        allowed: true,
        retryAfterMs: 0,
      });

      await processEmailJob(
        { id: 'job-retry', data: { emailMessageId: 'msg-retry' } } as any,
        fakeTransport,
        0,
        100
      );

      expect(fakeTransport.send).toHaveBeenCalledTimes(1);
      // Successfully updated to SENT on second attempt
      expect(messageUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'msg-retry' },
          data: expect.objectContaining({
            status: EmailStatus.SENT,
          }),
        })
      );

      vi.restoreAllMocks();
    });
  });

  // =========================================================================
  // P. Transport Dependency Injection & SmtpTransportManager
  // =========================================================================
  describe('P. Transport Dependency Injection & Manager', () => {
    it('worker factory accepts injected EmailTransport without requiring Nodemailer', () => {
      const mockTransport: EmailTransport = {
        send: async () => ({ messageId: '<mock@ethereal.email>' }),
        close: async () => {},
      };

      const worker = createEmailWorker({
        transport: mockTransport,
        minimumDelayMs: 1000,
        hourlyLimit: 50,
        concurrency: 4,
      });

      expect(worker).toBeDefined();
      expect(worker.opts.concurrency).toBe(4);
      worker.close();
    });

    it('SmtpTransportManager manages default and keyed transport instances', async () => {
      const mockTransport1: EmailTransport = {
        send: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockTransport2: EmailTransport = {
        send: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
      };

      SmtpTransportManager.setDefaultTransport(mockTransport1);
      expect(SmtpTransportManager.getDefaultTransport()).toBe(mockTransport1);

      const keyed = SmtpTransportManager.getTransportForKey('sender-custom', () => mockTransport2);
      expect(keyed).toBe(mockTransport2);

      // Re-querying same key returns cached instance
      const sameKeyed = SmtpTransportManager.getTransportForKey('sender-custom', () => mockTransport1);
      expect(sameKeyed).toBe(mockTransport2);

      // Gracefully closes all managed connections
      await SmtpTransportManager.closeAll();
      expect(mockTransport1.close).toHaveBeenCalledTimes(1);
      expect(mockTransport2.close).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Q. Credential Sanitization
  // =========================================================================
  describe('Q. Credential Sanitization in Logs and Errors', () => {
    it('strips credentials and passwords from transport error messages before saving to DB', async () => {
      const sensitiveError = new Error(
        'Connection failed to smtp://ethereal_user:superSecretPassword123@smtp.ethereal.email:587'
      );

      const fakeTransport: EmailTransport = {
        send: vi.fn().mockRejectedValue(sensitiveError),
        close: vi.fn(),
      };

      vi.spyOn(prisma.emailMessage, 'findUnique').mockResolvedValue({
        id: 'msg-sensitive-fail',
        senderId: 'snd-1',
        recipient: 'test@domain.com',
        subject: 'Subj',
        body: 'Body',
        status: EmailStatus.SCHEDULED,
        job: { status: JobStatus.PENDING } as any,
        sender: { id: 'snd-1', email: 's@ethereal.email', name: 'S' } as any,
      } as any);

      vi.spyOn(prisma.emailMessage, 'updateMany').mockResolvedValue({ count: 1 });
      const messageUpdateSpy = vi.spyOn(prisma.emailMessage, 'update').mockReturnValue({} as any);
      vi.spyOn(prisma.emailJob, 'update').mockReturnValue({} as any);
      vi.spyOn(prisma, '$transaction').mockResolvedValue([] as any);

      const deliveryPolicyService = await import('../src/services/email-delivery-policy.service');
      vi.spyOn(deliveryPolicyService, 'reserveDeliverySlot').mockResolvedValue({
        allowed: true,
        retryAfterMs: 0,
      });

      await expect(
        processEmailJob(
          { id: 'job-sens', data: { emailMessageId: 'msg-sensitive-fail' } } as any,
          fakeTransport,
          0,
          100
        )
      ).rejects.toThrow();

      // Check what was passed to prisma.emailMessage.update
      const updateCall = messageUpdateSpy.mock.calls[0];
      const savedError = updateCall[0].data.lastError as string;

      // Sensitive password must NOT be in the saved error
      expect(savedError).not.toContain('superSecretPassword123');
      expect(savedError).toContain('***:***@');

      vi.restoreAllMocks();
    });
  });

  // =========================================================================
  // Live Ethereal Integration Test (Opt-in via Environment)
  // =========================================================================
  describe('Live Ethereal SMTP Integration (Opt-In)', () => {
    it('dispatches a real email through Ethereal SMTP and captures messageId and previewUrl when credentials exist', async (ctx) => {
      if (!smtpConfig.isConfigured) {
        ctx.skip();
        return;
      }

      const liveTransport = new EtherealEmailTransport();

      try {
        const result = await liveTransport.send({
          from: {
            email: smtpConfig.user,
            name: 'ReachInbox Live Test',
          },
          recipient: smtpConfig.user, // Send to self on Ethereal
          subject: `ReachInbox Phase 3 Live Verification [${new Date().toISOString()}]`,
          body: 'This is a live SMTP verification email sent via pooled Ethereal transporter.',
        });

        expect(result.messageId).toBeDefined();
        expect(result.messageId.length).toBeGreaterThan(0);
        expect(result.previewUrl).toBeDefined();
        expect(result.previewUrl).toContain('ethereal.email');

        console.log('\n--- LIVE ETHEREAL VERIFICATION RESULT ---');
        console.log('Message ID:', result.messageId);
        console.log('Preview URL:', result.previewUrl);
        console.log('-----------------------------------------\n');
      } finally {
        await liveTransport.close();
      }
    }, 25000);
  });
});
