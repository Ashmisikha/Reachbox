import { EmailStatus, JobStatus } from '@prisma/client';
import { enqueueEmailJob } from '../queues/email.queue';
import prisma from '../lib/prisma';

interface ScheduleEmailInput {
  emailMessageId: string;
}

export async function scheduleEmail({ emailMessageId }: ScheduleEmailInput): Promise<void> {
  const emailMessage = await prisma.emailMessage.findUnique({
    where: {
      id: emailMessageId,
    },
    include: {
      job: true,
    },
  });

  if (!emailMessage) {
    throw new Error(`Email message ${emailMessageId} was not found`);
  }

  if (emailMessage.status !== EmailStatus.SCHEDULED) {
    throw new Error(
      `Email message ${emailMessageId} cannot be scheduled from status ${emailMessage.status}`
    );
  }

  if (emailMessage.job) {
    if (
      emailMessage.job.status === JobStatus.PENDING ||
      emailMessage.job.status === JobStatus.PROCESSING
    ) {
      return;
    }

    if (emailMessage.job.status === JobStatus.COMPLETED) {
      return;
    }
  }

  const delayMs = Math.max(0, emailMessage.scheduledAt.getTime() - Date.now());

  await enqueueEmailJob(
    {
      emailMessageId: emailMessage.id,
      campaignId: emailMessage.campaignId,
      senderId: emailMessage.senderId,
      scheduledAt: emailMessage.scheduledAt.toISOString(),
      idempotencyKey: emailMessage.idempotencyKey,
    },
    delayMs
  );

  await prisma.emailJob.upsert({
    where: {
      emailMessageId: emailMessage.id,
    },
    create: {
      emailMessageId: emailMessage.id,
      bullmqJobId: emailMessage.idempotencyKey,
      status: JobStatus.PENDING,
    },
    update: {
      bullmqJobId: emailMessage.idempotencyKey,
      status: JobStatus.PENDING,
      lastError: null,
    },
  });
}
