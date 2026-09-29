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
import { CampaignEventService } from '../services/campaign-event.service';
import { isPermanentFailureError } from '../services/failure.service';
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

  // Idempotency: skip if already sent or cancelled or suppressed
  if (
    message.status === EmailStatus.SENT ||
    message.status === EmailStatus.CANCELLED ||
    message.status === EmailStatus.SUPPRESSED
  ) {
    return;
  }

  let emailJob = message.job;
  if (!emailJob) {
    emailJob = await prisma.emailJob.upsert({
      where: { emailMessageId: message.id },
      create: {
        emailMessageId: message.id,
        bullmqJobId: String(job.id || `email-${message.id}`),
        status: JobStatus.PENDING,
      },
      update: {},
    });
  }

  if (!message.sender) {
    throw new Error(`Sender account ${message.senderId} not found for message ${message.id}`);
  }

  if (emailJob.status === JobStatus.COMPLETED) {
    return;
  }

  // Phase E: Server-side Suppression Check
  if (message.campaign?.userId) {
    const suppressed = await prisma.suppression.findUnique({
      where: {
        userId_email: {
          userId: message.campaign.userId,
          email: message.recipient.toLowerCase().trim(),
        },
      },
    });

    if (suppressed) {
      logger.info('Recipient is suppressed. Skipping send.', {
        emailMessageId: message.id,
        recipient: message.recipient,
        userId: message.campaign.userId,
      });

      await prisma.$transaction([
        prisma.emailMessage.update({
          where: { id: message.id },
          data: {
            status: EmailStatus.SUPPRESSED,
            lastError: `Recipient suppressed (${suppressed.reason || 'Unsubscribed'})`,
          },
        }),
        prisma.emailJob.update({
          where: { emailMessageId: message.id },
          data: {
            status: JobStatus.COMPLETED,
            lastError: 'Suppressed recipient',
          },
        }),
      ]);

      if (message.campaignId) {
        await CampaignEventService.logEvent(
          message.campaignId,
          'RECIPIENT_SUPPRESSED',
          `Recipient ${message.recipient} suppressed (${suppressed.reason || 'Unsubscribed'})`,
          { recipient: message.recipient, reason: suppressed.reason }
        );
      }
      return;
    }
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
      current?.status === EmailStatus.SUPPRESSED ||
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
  const policy = await reserveDeliverySlot({
    senderId: message.senderId,
    hourlyLimit,
    minimumDelayMs,
  });

  if (!policy.allowed) {
    if (policy.reason === 'HOURLY_LIMIT' || policy.retryAfterMs >= 60000) {
      if (message.campaign?.userId) {
        slackNotificationService
          .notifyRateLimitReached({
            userId: message.campaign.userId,
            campaignId: message.campaignId,
            campaignSubject: message.campaign?.subject || 'Campaign',
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

      if (message.campaignId) {
        await CampaignEventService.logEvent(
          message.campaignId,
          'RATE_LIMIT_REACHED',
          `Hourly limit reached for sender ${message.sender.email}. Rescheduling in ${Math.round(policy.retryAfterMs / 1000)}s`,
          { senderId: message.senderId, retryAfterMs: policy.retryAfterMs }
        );
      }
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

    if (message.campaignId) {
      await CampaignEventService.logEvent(
        message.campaignId,
        'EMAIL_SENT',
        `Email successfully sent to ${message.recipient}`,
        { recipient: message.recipient, messageId: transportResult?.messageId }
      );

      // Check if campaign is completed
      const pendingCount = await prisma.emailMessage.count({
        where: {
          campaignId: message.campaignId,
          status: { in: [EmailStatus.SCHEDULED, EmailStatus.PROCESSING] },
        },
      });

      if (pendingCount === 0) {
        await prisma.emailCampaign.update({
          where: { id: message.campaignId },
          data: { status: 'COMPLETED' },
        });
        await CampaignEventService.logEvent(
          message.campaignId,
          'CAMPAIGN_COMPLETED',
          'All recipients in campaign have finished processing'
        );
      }
    }

    // Phase 4: Enqueue for Elasticsearch indexing
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
    }
  } catch (error) {
    const rawErrorMessage =
      error instanceof Error ? error.message : 'Unknown email transport error';

    const sanitizedError = rawErrorMessage
      .replace(/([a-zA-Z0-9._%+-]+:[^@\s]+@)/g, '***:***@')
      .slice(0, 1000);

    const isPermanent = isPermanentFailureError(sanitizedError);
    const nextRetryAt = isPermanent ? null : new Date(Date.now() + 15 * 60 * 1000);

    logger.error('Email transport dispatch failed', {
      emailMessageId: message.id,
      campaignId: message.campaignId,
      senderId: message.senderId,
      recipient: message.recipient,
      error: sanitizedError,
      isPermanent,
    });

    await prisma.$transaction([
      prisma.emailMessage.update({
        where: {
          id: message.id,
        },
        data: {
          status: EmailStatus.FAILED,
          lastError: sanitizedError,
          isPermanent,
          nextRetryAt,
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

    if (message.campaignId) {
      await CampaignEventService.logEvent(
        message.campaignId,
        'SEND_FAILED',
        `Sending failed for ${message.recipient}: ${sanitizedError}`,
        { recipient: message.recipient, isPermanent, error: sanitizedError }
      );
    }

    throw error;
  }
}
