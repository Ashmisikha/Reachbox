import { Job, Worker } from 'bullmq';
import { EmailStatus, JobStatus } from '@prisma/client';

import prisma from '../lib/prisma';
import { queueConfig } from '../config/queue';
import { bullmqRedis } from '../queues/redis';
import { EMAIL_QUEUE_NAME } from '../queues/email.queue';
import type { SendEmailJobData } from '../queues/email-job.types';
import { reserveDeliverySlot } from '../services/email-delivery-policy.service';
import { rescheduleEmail } from '../queues/reschedule-email';
import { enqueueIndexEmailJob } from '../queues/email-index.queue';
import { slackNotificationService } from '../services/slack/slack-notification.service';

import { logger } from '../lib/logger';
import type {
  EmailTransport,
  EmailTransportInput,
  EmailTransportResult,
} from '../services/smtp/email.transport';

export type { EmailTransport, EmailTransportInput, EmailTransportResult };

export interface EmailWorkerOptions {
  transport: EmailTransport;
  minimumDelayMs: number;
  hourlyLimit: number;
  concurrency?: number;
}

export class RescheduleRequired extends Error {
  constructor(
    public readonly delayMs: number,
    reason: string
  ) {
    super(reason);
    this.name = 'RescheduleRequired';
  }
}

export function createEmailWorker({
  transport,
  minimumDelayMs,
  hourlyLimit,
  concurrency = queueConfig.workerConcurrency,
}: EmailWorkerOptions): Worker<SendEmailJobData> {
  const worker = new Worker<SendEmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      try {
        await processEmailJob(job, transport, minimumDelayMs, hourlyLimit);
      } catch (error) {
        if (error instanceof RescheduleRequired) {
          await rescheduleEmail(job, error.delayMs);
        }
        throw error;
      }
    },
    {
      connection: bullmqRedis,
      concurrency,
    }
  );

  worker.on('error', (error) => {
    console.error('email worker error', error);
  });

  return worker;
}

export async function processEmailJob(
  job: Job<SendEmailJobData>,
  transport: EmailTransport,
  minimumDelayMs: number,
  hourlyLimit: number
): Promise<void> {
  const message = await prisma.emailMessage.findUnique({
    where: {
      id: job.data.emailMessageId,
    },
    include: {
      job: true,
      sender: true,
      campaign: true,
    },
  });

  if (!message) {
    return;
  }

  // Idempotency: skip if already sent or cancelled
  if (message.status === EmailStatus.SENT || message.status === EmailStatus.CANCELLED) {
    return;
  }

  if (!message.job) {
    throw new Error(`Email job record missing for message ${message.id}`);
  }

  if (!message.sender) {
    throw new Error(`Sender account ${message.senderId} not found for message ${message.id}`);
  }

  if (message.job.status === JobStatus.COMPLETED) {
    return;
  }

  // 1. Conditional database claim: only from SCHEDULED or FAILED
  // Ensures this worker has exclusive ownership before consuming any delivery quota
  const claimed = await prisma.emailMessage.updateMany({
    where: {
      id: message.id,
      status: {
        in: [EmailStatus.SCHEDULED, EmailStatus.FAILED],
      },
    },
    data: {
      status: EmailStatus.PROCESSING,
      attemptCount: {
        increment: 1,
      },
      lastError: null,
    },
  });

  if (claimed.count === 0) {
    const current = await prisma.emailMessage.findUnique({
      where: {
        id: message.id,
      },
      select: {
        status: true,
      },
    });

    if (
      current?.status === EmailStatus.SENT ||
      current?.status === EmailStatus.CANCELLED ||
      current?.status === EmailStatus.PROCESSING
    ) {
      return;
    }

    throw new Error(`Email message ${message.id} could not be claimed`);
  }

  await prisma.emailJob.update({
    where: {
      emailMessageId: message.id,
    },
    data: {
      status: JobStatus.PROCESSING,
      attempts: {
        increment: 1,
      },
      lastError: null,
    },
  });

  // 2. Atomic Redis spacing & hourly quota policy check
  // Executed AFTER DB claim to guarantee zero quota is wasted on un-claimable emails.
  // If denied, the email is cleanly reverted from PROCESSING back to SCHEDULED/PENDING
  // so it is not stuck in PROCESSING during the BullMQ delayed window.
  const policy = await reserveDeliverySlot({
    senderId: message.senderId,
    hourlyLimit,
    minimumDelayMs,
  });

  if (!policy.allowed) {
    // Auxiliary Slack Notification: emit event when hourly quota is hit
    if (policy.reason === 'HOURLY_LIMIT' || policy.retryAfterMs >= 60000) {
      slackNotificationService
        .notifyRateLimitReached({
          userId: message.campaign.userId,
          campaignId: message.campaignId,
          campaignSubject: message.campaign.subject,
          senderId: message.senderId,
          senderEmail: message.sender.email,
          hourlyLimit,
          retryAfterMs: policy.retryAfterMs,
          timestamp: new Date().toISOString(),
        })
        .catch((err) => {
          logger.error('Failed to enqueue Slack rate-limit notification', {
            error: err.message,
            emailMessageId: message.id,
          });
        });
    }

    await prisma.$transaction([
      prisma.emailMessage.update({
        where: { id: message.id },
        data: {
          status: message.status, // Restores original SCHEDULED or FAILED state
          attemptCount: { decrement: 1 },
        },
      }),
      prisma.emailJob.update({
        where: { emailMessageId: message.id },
        data: {
          status: JobStatus.PENDING,
          attempts: { decrement: 1 },
        },
      }),
    ]);

    throw new RescheduleRequired(
      policy.retryAfterMs,
      'Email delivery policy requires rescheduling'
    );
  }

  try {
    const transportResult = await transport.send({
      from: {
        email: message.sender.email,
        name: message.sender.name ?? undefined,
      },
      recipient: message.recipient,
      subject: message.subject,
      body: message.body,
    });

    logger.info('Email message dispatched via SMTP', {
      emailMessageId: message.id,
      campaignId: message.campaignId,
      senderId: message.senderId,
      senderEmail: message.sender.email,
      recipient: message.recipient,
      messageId: transportResult?.messageId,
      previewUrl: transportResult?.previewUrl,
      attempt: (message.attemptCount ?? 0) + 1,
    });

    await prisma.$transaction([
      prisma.emailMessage.update({
        where: {
          id: message.id,
        },
        data: {
          status: EmailStatus.SENT,
          sentAt: new Date(),
          lastError: null,
        },
      }),
      prisma.emailJob.update({
        where: {
          emailMessageId: message.id,
        },
        data: {
          status: JobStatus.COMPLETED,
          processedAt: new Date(),
          lastError: null,
        },
      }),
    ]);

    // Phase 4: Enqueue for Elasticsearch indexing
    // Non-blocking & decoupled from SMTP delivery success
    try {
      await enqueueIndexEmailJob(message.id);
    } catch (indexEnqueueError) {
      logger.error('Failed to enqueue email for indexing', {
        emailMessageId: message.id,
        error:
          indexEnqueueError instanceof Error
            ? indexEnqueueError.message
            : String(indexEnqueueError),
      });
      // Important: Delivery remains SENT and COMPLETED even if queueing index fails
    }
  } catch (error) {
    const rawErrorMessage =
      error instanceof Error ? error.message : 'Unknown email transport error';

    // Sanitize any accidental credentials, passwords, or tokens in error message
    const sanitizedError = rawErrorMessage
      .replace(/([a-zA-Z0-9._%+-]+:[^@\s]+@)/g, '***:***@')
      .slice(0, 1000);

    logger.error('Email transport dispatch failed', {
      emailMessageId: message.id,
      campaignId: message.campaignId,
      senderId: message.senderId,
      recipient: message.recipient,
      error: sanitizedError,
    });

    await prisma.$transaction([
      prisma.emailMessage.update({
        where: {
          id: message.id,
        },
        data: {
          status: EmailStatus.FAILED,
          lastError: sanitizedError,
        },
      }),
      prisma.emailJob.update({
        where: {
          emailMessageId: message.id,
        },
        data: {
          status: JobStatus.FAILED,
          lastError: sanitizedError,
        },
      }),
    ]);

    throw error;
  }
}
