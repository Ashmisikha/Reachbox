import type { SendEmailJobData } from './email-job.types';
import { emailQueue, SEND_EMAIL_JOB_NAME } from './email.queue';

export async function enqueueEmailBatch(messages: SendEmailJobData[]): Promise<void> {
  if (messages.length === 0) {
    return;
  }

  await emailQueue.addBulk(
    messages.map((message) => ({
      name: SEND_EMAIL_JOB_NAME,
      data: message,
      opts: {
        jobId: `email-${message.emailMessageId}`,
        delay: Math.max(0, new Date(message.scheduledAt).getTime() - Date.now()),
      },
    }))
  );
}

export async function enqueueEmailJob(
  data: SendEmailJobData,
  delayMs?: number
): Promise<void> {
  const delay =
    delayMs !== undefined
      ? Math.max(0, delayMs)
      : Math.max(0, new Date(data.scheduledAt).getTime() - Date.now());

  await emailQueue.add(SEND_EMAIL_JOB_NAME, data, {
    jobId: `email-${data.emailMessageId}`,
    delay,
  });
}
