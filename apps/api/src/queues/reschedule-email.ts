import { DelayedError, Job } from 'bullmq';
import type { SendEmailJobData } from './email-job.types';

export async function rescheduleEmail(
  job: Job<SendEmailJobData>,
  delayMs: number
): Promise<never> {
  const token = job.token;

  if (!token) {
    throw new Error(`Worker token missing for job ${job.id}`);
  }

  const safeDelay = Math.max(delayMs, 1_000);

  await job.moveToDelayed(Date.now() + safeDelay, token);

  throw new DelayedError();
}
