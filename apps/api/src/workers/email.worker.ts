import { Job, Worker } from 'bullmq';
import { EmailStatus, JobStatus } from '@prisma/client';

import prisma from '../lib/prisma';
import { queueConfig } from '../config/queue';
import { bullmqRedis } from '../queues/redis';
import { EMAIL_QUEUE_NAME } from '../queues/email.queue';
import type { SendEmailJobData } from '../queues/email-job.types';
import { reserveDeliverySlot } from '../services/email-delivery-policy.service';
import { rescheduleEmail } from '../queues/reschedule-email';

export interface EmailTransport {
  send(input: {
    recipient: string;
    subject: string;
    body: string;
  }): Promise<void>;
}

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
    await transport.send({
      recipient: message.recipient,
      subject: message.subject,
      body: message.body,
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
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown email transport error';

    await prisma.$transaction([
      prisma.emailMessage.update({
        where: {
          id: message.id,
        },
        data: {
          status: EmailStatus.FAILED,
          lastError: errorMessage,
        },
      }),
      prisma.emailJob.update({
        where: {
          emailMessageId: message.id,
        },
        data: {
          status: JobStatus.FAILED,
          lastError: errorMessage,
        },
      }),
    ]);

    throw error;
  }
}
