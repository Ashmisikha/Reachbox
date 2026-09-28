import { z } from 'zod';
import { EmailStatus, JobStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { emailQueue } from '../queues/email.queue';
import { enqueueEmailJob } from '../queues/email-enqueue.service';
import { CampaignEventService } from './campaign-event.service';
import { AppError } from '../middleware/errorHandler';

export const listFailuresQuerySchema = z.object({
  search: z.string().trim().optional(),
  campaignId: z.string().uuid().optional(),
  senderId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const retrySelectedSchema = z.object({
  messageIds: z.array(z.string().uuid()).min(1).max(500),
});

/**
 * Determines whether an error string represents a permanent non-retryable failure.
 */
export function isPermanentFailureError(errorText?: string | null): boolean {
  if (!errorText) return false;
  const lower = errorText.toLowerCase();
  const permanentKeywords = [
    'invalid email',
    'syntax error',
    'suppressed',
    'unsubscribed',
    'user unknown',
    'recipient address rejected',
    'mailbox not found',
    'no such user',
    '550 ',
    '551 ',
    '553 ',
    '554 ',
  ];
  return permanentKeywords.some((kw) => lower.includes(kw));
}

export const failureService = {
  async listFailures(userId: string, query: z.infer<typeof listFailuresQuerySchema>) {
    const skip = (query.page - 1) * query.limit;

    const where: any = {
      campaign: { userId },
      status: EmailStatus.FAILED,
    };

    if (query.campaignId) {
      where.campaignId = query.campaignId;
    }

    if (query.senderId) {
      where.senderId = query.senderId;
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { recipient: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { lastError: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [messages, total] = await Promise.all([
      prisma.emailMessage.findMany({
        where,
        include: {
          campaign: { select: { id: true, subject: true } },
          sender: { select: { id: true, email: true, name: true } },
          job: { select: { attempts: true, processedAt: true, lastError: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: query.limit,
      }),
      prisma.emailMessage.count({ where }),
    ]);

    const formatted = messages.map((m) => {
      const permanent = m.isPermanent || isPermanentFailureError(m.lastError);
      return {
        id: m.id,
        campaignId: m.campaignId,
        campaignName: m.campaign.subject,
        senderEmail: m.sender.email,
        recipient: m.recipient,
        subject: m.subject,
        error: m.lastError || m.job?.lastError || 'Unknown failure',
        isPermanent: permanent,
        attempts: m.attemptCount ?? m.job?.attempts ?? 1,
        lastAttemptAt: m.job?.processedAt?.toISOString() || m.updatedAt.toISOString(),
        nextRetryAt: m.nextRetryAt?.toISOString() || null,
        status: m.status,
      };
    });

    return {
      failures: formatted,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  },

  async retrySingle(userId: string, messageId: string) {
    const message = await prisma.emailMessage.findFirst({
      where: {
        id: messageId,
        campaign: { userId },
        status: EmailStatus.FAILED,
      },
      include: {
        campaign: true,
        sender: true,
      },
    });

    if (!message) {
      throw new AppError('Eligible failed email message not found', 404, 'MESSAGE_NOT_FOUND');
    }

    if (message.isPermanent || isPermanentFailureError(message.lastError)) {
      throw new AppError('Cannot retry permanent failure (e.g. invalid recipient or hard bounce)', 422, 'PERMANENT_FAILURE');
    }

    // Atomically reset message status to SCHEDULED
    await prisma.$transaction([
      prisma.emailMessage.update({
        where: { id: message.id },
        data: {
          status: EmailStatus.SCHEDULED,
          lastError: null,
          scheduledAt: new Date(),
        },
      }),
      prisma.emailJob.update({
        where: { emailMessageId: message.id },
        data: {
          status: JobStatus.PENDING,
          lastError: null,
        },
      }),
    ]);

    // Remove any stale BullMQ job
    try {
      const existingJob = await emailQueue.getJob(`email-${message.id}`);
      if (existingJob) {
        await existingJob.remove();
      }
    } catch {
      // Ignore if job did not exist
    }

    // Re-enqueue job
    await enqueueEmailJob(
      {
        emailMessageId: message.id,
        campaignId: message.campaignId,
        senderId: message.senderId,
        scheduledAt: new Date().toISOString(),
        idempotencyKey: message.idempotencyKey,
      },
      0
    );

    await CampaignEventService.logEvent(
      message.campaignId,
      'RETRY_INITIATED',
      `Manual retry initiated for recipient ${message.recipient}`,
      { emailMessageId: message.id, recipient: message.recipient }
    );

    return { success: true, messageId: message.id };
  },

  async retrySelected(userId: string, messageIds: string[]) {
    let retriedCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const id of messageIds) {
      try {
        await this.retrySingle(userId, id);
        retriedCount++;
      } catch (err) {
        errors.push({
          id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      success: true,
      requestedCount: messageIds.length,
      retriedCount,
      failedCount: errors.length,
      errors,
    };
  },

  async retryAllEligible(userId: string, campaignId?: string) {
    const where: any = {
      campaign: { userId },
      status: EmailStatus.FAILED,
      isPermanent: false,
    };

    if (campaignId) {
      where.campaignId = campaignId;
    }

    const eligible = await prisma.emailMessage.findMany({
      where,
      select: { id: true, lastError: true },
      take: 200,
    });

    const nonPermanentIds = eligible
      .filter((m) => !isPermanentFailureError(m.lastError))
      .map((m) => m.id);

    return this.retrySelected(userId, nonPermanentIds);
  },
};
