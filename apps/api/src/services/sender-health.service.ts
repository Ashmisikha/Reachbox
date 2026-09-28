import prisma from '../lib/prisma';
import { bullmqRedis } from '../queues/redis';
import { config } from '../config';
import { SenderHealthMetrics } from '@reachinbox/shared';

export class SenderHealthService {
  public static async getSendersHealth(userId: string): Promise<SenderHealthMetrics[]> {
    const senders = await prisma.senderAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (senders.length === 0) {
      return [];
    }

    const defaultHourlyLimit = config.MAX_EMAILS_PER_HOUR_PER_SENDER;
    const oneHourAgo = new Date(Date.now() - 3600000);

    const results: SenderHealthMetrics[] = await Promise.all(
      senders.map(async (sender) => {
        const hourlyLimit = defaultHourlyLimit;
        // 1. Get sentThisHour from Redis atomic counter, with DB fallback
        let sentThisHour = 0;
        try {
          const redisCount = await bullmqRedis.get(`email-rate-limit:${sender.id}:count`);
          if (redisCount !== null) {
            sentThisHour = parseInt(redisCount, 10) || 0;
          } else {
            sentThisHour = await prisma.emailMessage.count({
              where: {
                senderId: sender.id,
                status: 'SENT',
                sentAt: { gte: oneHourAgo },
              },
            });
          }
        } catch {
          sentThisHour = await prisma.emailMessage.count({
            where: {
              senderId: sender.id,
              status: 'SENT',
              sentAt: { gte: oneHourAgo },
            },
          });
        }

        // 2. Count failed emails for this sender
        const failedCount = await prisma.emailMessage.count({
          where: {
            senderId: sender.id,
            status: 'FAILED',
          },
        });

        // 3. Count rate limit events
        const rateLimitEventsCount = await prisma.campaignEvent.count({
          where: {
            type: 'RATE_LIMIT_REACHED',
            campaign: { senderId: sender.id },
          },
        });

        // 4. Last sent email timestamp
        const lastSentMessage = await prisma.emailMessage.findFirst({
          where: {
            senderId: sender.id,
            status: 'SENT',
          },
          orderBy: { sentAt: 'desc' },
          select: { sentAt: true },
        });

        const remainingCapacity = Math.max(0, hourlyLimit - sentThisHour);

        let operationalStatus: 'ACTIVE' | 'PAUSED' | 'RATE_LIMITED' | 'ERROR' = 'ACTIVE';
        if (sender.status !== 'ACTIVE') {
          operationalStatus = 'PAUSED';
        } else if (sentThisHour >= hourlyLimit) {
          operationalStatus = 'RATE_LIMITED';
        } else if (failedCount > 20 && sentThisHour === 0) {
          operationalStatus = 'ERROR';
        }

        return {
          id: sender.id,
          email: sender.email,
          name: sender.name ?? (sender.email.split('@')[0] || 'Sender'),
          status: operationalStatus,
          hourlyLimit,
          sentThisHour,
          remainingCapacity,
          failedCount,
          rateLimitEventsCount,
          lastSentAt: lastSentMessage?.sentAt?.toISOString() || null,
        };
      })
    );

    return results;
  }
}
