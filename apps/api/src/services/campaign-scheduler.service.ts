import { EmailStatus, JobStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { queueConfig } from '../config/queue';
import { enqueueEmailBatch } from '../queues/email-enqueue.service';

export async function scheduleCampaign(campaignId: string): Promise<number> {
  const campaign = await prisma.emailCampaign.findUnique({
    where: {
      id: campaignId,
    },
  });

  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  let cursor: string | undefined;
  let totalScheduled = 0;

  while (true) {
    // Direct keyset pagination using primary key index B-Tree (avoids O(N) OFFSET scan degradation)
    const messages = await prisma.emailMessage.findMany({
      where: {
        campaignId,
        status: EmailStatus.SCHEDULED,
        ...(cursor
          ? {
              id: {
                gt: cursor,
              },
            }
          : {}),
      },
      orderBy: {
        id: 'asc',
      },
      take: queueConfig.schedulingBatchSize,
      select: {
        id: true,
        campaignId: true,
        senderId: true,
        scheduledAt: true,
        idempotencyKey: true,
      },
    });

    if (messages.length === 0) {
      break;
    }

    // Persist EmailJob tracking records in database for worker lifecycle management
    await prisma.emailJob.createMany({
      data: messages.map((message) => ({
        emailMessageId: message.id,
        bullmqJobId: `email-${message.id}`,
        status: JobStatus.PENDING,
      })),
      skipDuplicates: true,
    });

    // High-performance bulk insertion using BullMQ addBulk()
    await enqueueEmailBatch(
      messages.map((message) => ({
        emailMessageId: message.id,
        campaignId: message.campaignId,
        senderId: message.senderId,
        scheduledAt: message.scheduledAt.toISOString(),
        idempotencyKey: message.idempotencyKey,
      }))
    );

    totalScheduled += messages.length;
    cursor = messages[messages.length - 1]?.id;

    if (messages.length < queueConfig.schedulingBatchSize) {
      break;
    }
  }

  return totalScheduled;
}
