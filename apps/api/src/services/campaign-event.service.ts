import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

export type CampaignEventType =
  | 'CAMPAIGN_SCHEDULED'
  | 'JOBS_CREATED'
  | 'SENDING_STARTED'
  | 'EMAIL_SENT'
  | 'RATE_LIMIT_REACHED'
  | 'SENDING_RESUMED'
  | 'CAMPAIGN_COMPLETED'
  | 'CAMPAIGN_CANCELLED'
  | 'RECIPIENT_SUPPRESSED'
  | 'SEND_FAILED'
  | 'RETRY_INITIATED';

export class CampaignEventService {
  public static async logEvent(
    campaignId: string,
    type: CampaignEventType,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.campaignEvent.create({
        data: {
          campaignId,
          type,
          description,
          metadata: metadata ? (metadata as any) : undefined,
        },
      });
    } catch (error) {
      logger.error('Failed to persist campaign event', {
        campaignId,
        type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public static async getEvents(campaignId: string, limit = 50) {
    return prisma.campaignEvent.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
