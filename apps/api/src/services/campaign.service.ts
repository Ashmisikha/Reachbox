import crypto from 'crypto';
import { z } from 'zod';
import { CampaignStatus, EmailStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { scheduleCampaign } from './campaign-scheduler.service';
import { PersonalizationService } from './personalization.service';
import { CampaignEventService } from './campaign-event.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../lib/logger';

// ─── Validation ────────────────────────────────────────────────────────────────

export const campaignStepInputSchema = z.object({
  stepOrder: z.number().int().min(1),
  delayDays: z.number().int().min(0).default(0),
  delayHours: z.number().int().min(0).max(23).default(0),
  subject: z.string().min(1, 'Step subject is required').max(998),
  body: z.string().min(1, 'Step body is required').max(1_000_000),
});

export const createCampaignSchema = z.object({
  senderId: z.string().uuid({ message: 'senderId must be a valid UUID' }),
  recipients: z
    .array(z.string().email({ message: 'Each recipient must be a valid email address' }))
    .min(1, 'At least one recipient is required')
    .max(10000, 'Maximum 10,000 recipients per campaign'),
  subject: z.string().min(1, 'Subject is required').max(998, 'Subject too long'),
  body: z.string().min(1, 'Body is required').max(1_000_000, 'Body too large'),
  startAt: z.string().datetime({ offset: true, message: 'startAt must be a valid ISO 8601 datetime' }),
  delayMs: z
    .number()
    .int()
    .min(0, 'delayMs must be non-negative')
    .max(86_400_000, 'delayMs maximum is 24 hours'),
  hourlyLimit: z
    .number()
    .int()
    .min(1, 'hourlyLimit must be at least 1')
    .max(10000, 'hourlyLimit maximum is 10,000'),
  steps: z.array(campaignStepInputSchema).optional(),
  idempotencyKey: z.string().max(128).optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

// ─── Service ───────────────────────────────────────────────────────────────────

/**
 * Creates a campaign with bulk EmailMessage records (supporting multi-step sequences
 * and personalized contact variables) and enqueues BullMQ delayed jobs.
 */
export async function createCampaign(
  userId: string,
  rawInput: unknown
): Promise<{ campaignId: string; messageCount: number; scheduledCount: number; stepCount: number }> {
  const parseResult = createCampaignSchema.safeParse(rawInput);
  if (!parseResult.success) {
    throw new AppError('Campaign validation failed', 422, 'VALIDATION_ERROR', {
      fields: parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const input = parseResult.data;

  // 1. Verify sender belongs to the authenticated user
  const sender = await prisma.senderAccount.findFirst({
    where: { id: input.senderId, userId },
  });
  if (!sender) {
    throw new AppError('Sender not found or access denied', 403, 'SENDER_FORBIDDEN');
  }
  if (sender.status !== 'ACTIVE') {
    throw new AppError('Sender account is not active', 422, 'SENDER_INACTIVE');
  }

  // 2. Normalise recipients: lowercase, trim, deduplicate, validate
  const uniqueRecipients = [
    ...new Set(
      input.recipients.map((r) => r.toLowerCase().trim()).filter((r) => r.length > 0)
    ),
  ];
  if (uniqueRecipients.length === 0) {
    throw new AppError('No valid recipients after normalisation', 422, 'EMPTY_RECIPIENTS');
  }

  // 3. Lookup real contacts for personalization variables
  const existingContacts = await prisma.contact.findMany({
    where: {
      userId,
      email: { in: uniqueRecipients },
    },
  });
  const contactMap = new Map<string, (typeof existingContacts)[0]>();
  for (const c of existingContacts) {
    contactMap.set(c.email.toLowerCase(), c);
  }

  const startAt = new Date(input.startAt);

  // 4. Create campaign record (DRAFT → SCHEDULED after enqueueing)
  const campaign = await prisma.emailCampaign.create({
    data: {
      userId,
      senderId: input.senderId,
      subject: input.subject,
      body: input.body,
      startAt,
      delayMs: input.delayMs,
      hourlyLimit: input.hourlyLimit,
      status: CampaignStatus.DRAFT,
    },
  });

  // 5. Prepare sequence steps (if none provided, default to Step 1 from root subject/body)
  const stepsToCreate =
    input.steps && input.steps.length > 0
      ? input.steps
      : [
          {
            stepOrder: 1,
            delayDays: 0,
            delayHours: 0,
            subject: input.subject,
            body: input.body,
          },
        ];

  // Persist campaign steps
  const persistedSteps = await Promise.all(
    stepsToCreate.map((step) =>
      prisma.campaignStep.create({
        data: {
          campaignId: campaign.id,
          stepOrder: step.stepOrder,
          delayDays: step.delayDays,
          delayHours: step.delayHours,
          subject: step.subject,
          body: step.body,
        },
      })
    )
  );

  const now = new Date();
  let totalMessageCount = 0;

  // 6. Bulk-create EmailMessage records for each step and recipient
  for (const step of persistedSteps) {
    const stepDelayMs = (step.delayDays * 24 * 60 + step.delayHours * 60) * 60 * 1000;
    const stepStartAt = new Date(startAt.getTime() + stepDelayMs);

    const BATCH_SIZE = 500;
    for (let batchStart = 0; batchStart < uniqueRecipients.length; batchStart += BATCH_SIZE) {
      const batch = uniqueRecipients.slice(batchStart, batchStart + BATCH_SIZE);
      const messagesData = batch.map((recipient, i) => {
        const index = batchStart + i;
        const scheduledAt = new Date(stepStartAt.getTime() + index * input.delayMs);
        const contact = contactMap.get(recipient);

        const rendered = PersonalizationService.renderEmail(step.subject, step.body, {
          email: recipient,
          firstName: contact?.firstName,
          lastName: contact?.lastName,
          company: contact?.company,
          jobTitle: contact?.jobTitle,
        });

        return {
          campaignId: campaign.id,
          stepId: step.id,
          senderId: input.senderId,
          recipient,
          subject: rendered.subject,
          body: rendered.body,
          scheduledAt,
          status: EmailStatus.SCHEDULED,
          idempotencyKey: crypto
            .createHash('sha256')
            .update(`${campaign.id}:${step.id}:${recipient}:${index}`)
            .digest('hex'),
          createdAt: now,
          updatedAt: now,
        };
      });

      await prisma.emailMessage.createMany({
        data: messagesData,
        skipDuplicates: true,
      });

      totalMessageCount += messagesData.length;
    }
  }

  // 7. Enqueue BullMQ delayed jobs via existing scheduler
  const scheduledCount = await scheduleCampaign(campaign.id);

  // 8. Mark campaign SCHEDULED
  await prisma.emailCampaign.update({
    where: { id: campaign.id },
    data: { status: CampaignStatus.SCHEDULED },
  });

  // 9. Record operational campaign events
  await CampaignEventService.logEvent(
    campaign.id,
    'CAMPAIGN_SCHEDULED',
    `Campaign scheduled with ${uniqueRecipients.length} recipients across ${persistedSteps.length} sequence step(s)`,
    { recipients: uniqueRecipients.length, steps: persistedSteps.length }
  );

  await CampaignEventService.logEvent(
    campaign.id,
    'JOBS_CREATED',
    `${scheduledCount} delayed jobs successfully persisted and enqueued in BullMQ`,
    { scheduledCount }
  );

  logger.info('Campaign successfully scheduled', {
    campaignId: campaign.id,
    userId,
    recipients: uniqueRecipients.length,
    steps: persistedSteps.length,
    scheduledCount,
  });

  return {
    campaignId: campaign.id,
    messageCount: totalMessageCount,
    scheduledCount,
    stepCount: persistedSteps.length,
  };
}

// ─── Read Helpers & Operational Analytics ──────────────────────────────────────

export async function getCampaigns(userId: string, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;
  const [total, campaigns] = await prisma.$transaction([
    prisma.emailCampaign.count({ where: { userId } }),
    prisma.emailCampaign.findMany({
      where: { userId },
      include: {
        sender: { select: { id: true, email: true, name: true } },
        steps: { orderBy: { stepOrder: 'asc' }, select: { id: true, stepOrder: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
  ]);

  return {
    campaigns: campaigns.map((c) => ({
      id: c.id,
      subject: c.subject,
      status: c.status,
      startAt: c.startAt,
      delayMs: c.delayMs,
      hourlyLimit: c.hourlyLimit,
      createdAt: c.createdAt,
      sender: c.sender,
      stepCount: c.steps.length,
      messageCount: c._count.messages,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getCampaignById(campaignId: string, userId: string) {
  const campaign = await prisma.emailCampaign.findFirst({
    where: { id: campaignId, userId },
    include: {
      sender: { select: { id: true, email: true, name: true } },
      steps: { orderBy: { stepOrder: 'asc' } },
      _count: { select: { messages: true } },
    },
  });

  if (!campaign) {
    throw new AppError('Campaign not found', 404, 'NOT_FOUND');
  }

  // Aggregate real status counts
  const counts = await prisma.emailMessage.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: { _all: true },
  });

  const statusMap: Record<string, number> = {};
  counts.forEach((c) => {
    statusMap[c.status] = c._count._all;
  });

  const scheduled = statusMap['SCHEDULED'] || 0;
  const processing = statusMap['PROCESSING'] || 0;
  const sent = statusMap['SENT'] || 0;
  const failed = statusMap['FAILED'] || 0;
  const cancelled = statusMap['CANCELLED'] || 0;
  const suppressed = statusMap['SUPPRESSED'] || 0;
  const total = campaign._count.messages;

  const completionRate = total > 0 ? Math.round(((sent + failed + cancelled + suppressed) / total) * 100) : 0;
  const deliveryRate = total > 0 ? Math.round((sent / total) * 100) : 0;
  const failureRate = total > 0 ? Math.round((failed / total) * 100) : 0;

  // Failure breakdown
  const failures = await prisma.emailMessage.findMany({
    where: { campaignId, status: 'FAILED' },
    select: { lastError: true },
    take: 100,
  });
  const failureBreakdown: Record<string, number> = {};
  failures.forEach((f) => {
    const err = f.lastError || 'Unknown Error';
    failureBreakdown[err] = (failureBreakdown[err] || 0) + 1;
  });

  // Real operational events
  const events = await CampaignEventService.getEvents(campaignId, 40);

  return {
    ...campaign,
    analytics: {
      totalRecipients: total,
      scheduled,
      waiting: scheduled,
      delayed: scheduled,
      active: processing,
      sent,
      failed,
      cancelled,
      suppressed,
      completionRate,
      deliveryRate,
      failureRate,
      failureBreakdown,
    },
    events,
  };
}

export async function cancelCampaign(campaignId: string, userId: string) {
  const campaign = await prisma.emailCampaign.findFirst({
    where: { id: campaignId, userId },
  });

  if (!campaign) {
    throw new AppError('Campaign not found', 404, 'NOT_FOUND');
  }

  await prisma.$transaction([
    prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.CANCELLED },
    }),
    prisma.emailMessage.updateMany({
      where: {
        campaignId,
        status: { in: [EmailStatus.SCHEDULED, EmailStatus.PROCESSING] },
      },
      data: { status: EmailStatus.CANCELLED },
    }),
  ]);

  await CampaignEventService.logEvent(
    campaignId,
    'CAMPAIGN_CANCELLED',
    'Campaign cancelled by user. Pending emails and future sequence steps aborted.'
  );

  return { success: true, message: 'Campaign cancelled successfully' };
}

export async function getScheduledEmails(userId: string, page = 1, pageSize = 25) {
  const skip = (page - 1) * pageSize;
  const [total, messages] = await prisma.$transaction([
    prisma.emailMessage.count({
      where: {
        campaign: { userId },
        status: { in: ['SCHEDULED', 'PROCESSING', 'FAILED'] },
      },
    }),
    prisma.emailMessage.findMany({
      where: {
        campaign: { userId },
        status: { in: ['SCHEDULED', 'PROCESSING', 'FAILED'] },
      },
      include: {
        campaign: { select: { id: true, subject: true } },
        sender: { select: { id: true, email: true, name: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      skip,
      take: pageSize,
    }),
  ]);

  return {
    emails: messages.map((m) => ({
      id: m.id,
      recipient: m.recipient,
      subject: m.subject,
      status: m.status,
      scheduledAt: m.scheduledAt,
      attemptCount: m.attemptCount,
      campaign: m.campaign,
      sender: m.sender,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function getSentEmails(userId: string, page = 1, pageSize = 25) {
  const skip = (page - 1) * pageSize;
  const [total, messages] = await prisma.$transaction([
    prisma.emailMessage.count({
      where: { campaign: { userId }, status: 'SENT' },
    }),
    prisma.emailMessage.findMany({
      where: { campaign: { userId }, status: 'SENT' },
      include: {
        campaign: { select: { id: true, subject: true } },
        sender: { select: { id: true, email: true, name: true } },
      },
      orderBy: { sentAt: 'desc' },
      skip,
      take: pageSize,
    }),
  ]);

  return {
    emails: messages.map((m) => ({
      id: m.id,
      recipient: m.recipient,
      subject: m.subject,
      status: m.status,
      sentAt: m.sentAt,
      campaign: m.campaign,
      sender: m.sender,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function getDashboardStats(userId: string) {
  const [scheduledCount, sentCount, failedCount, campaignCount, senderCount] =
    await prisma.$transaction([
      prisma.emailMessage.count({
        where: { campaign: { userId }, status: { in: ['SCHEDULED', 'PROCESSING'] } },
      }),
      prisma.emailMessage.count({ where: { campaign: { userId }, status: 'SENT' } }),
      prisma.emailMessage.count({ where: { campaign: { userId }, status: 'FAILED' } }),
      prisma.emailCampaign.count({ where: { userId } }),
      prisma.senderAccount.count({ where: { userId, status: 'ACTIVE' } }),
    ]);

  return { scheduledCount, sentCount, failedCount, campaignCount, senderCount };
}
