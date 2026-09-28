export interface SlackOAuthInstallation {
  ok: boolean;
  app_id?: string;
  authed_user?: {
    id: string;
    scope?: string;
    access_token?: string;
    token_type?: string;
  };
  scope?: string;
  token_type?: string;
  access_token: string;
  bot_user_id?: string;
  team: {
    id: string;
    name: string;
  };
  incoming_webhook?: {
    channel: string;
    channel_id?: string;
    configuration_url?: string;
    url: string;
  };
  error?: string;
}

export interface SlackConnectionRecord {
  id: string;
  userId: string;
  teamId: string | null;
  teamName: string | null;
  accessToken: string;
  slackUserId: string | null;
  botUserId: string | null;
  channelId: string | null;
  channelName: string | null;
  incomingWebhookUrl: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlackPublicStatus {
  connected: boolean;
  teamName?: string;
  teamId?: string;
  channelName?: string;
  connectedAt?: string;
  status: string;
}

export interface RateLimitNotificationPayload {
  userId: string;
  campaignId: string;
  campaignSubject: string;
  senderId: string;
  senderEmail: string;
  hourlyLimit: number;
  retryAfterMs: number;
  timestamp: string;
}
