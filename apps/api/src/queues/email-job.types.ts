export interface SendEmailJobData {
  emailMessageId: string;
  campaignId: string;
  senderId: string;
  scheduledAt: string;
  idempotencyKey: string;
}
