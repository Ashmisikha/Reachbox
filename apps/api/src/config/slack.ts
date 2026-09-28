import { z } from 'zod';

export const slackConfigSchema = z.object({
  SLACK_CLIENT_ID: z.string().default('mock-slack-client-id'),
  SLACK_CLIENT_SECRET: z.string().default('mock-slack-client-secret'),
  SLACK_REDIRECT_URI: z
    .string()
    .default('http://localhost:4000/api/slack/callback'),
  SLACK_BOT_SCOPES: z
    .string()
    .default('incoming-webhook,chat:write,commands'),
  SLACK_NOTIFICATION_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(2),
  SLACK_NOTIFICATION_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  SLACK_NOTIFICATION_BACKOFF_MS: z.coerce.number().int().min(100).default(3000),
  SLACK_DEFAULT_CHANNEL: z.string().default('#general'),
  SLACK_STATE_COOKIE_NAME: z.string().default('reachinbox_slack_state'),
  SLACK_STATE_MAX_AGE_MS: z.coerce.number().default(10 * 60 * 1000), // 10 minutes
  SLACK_TOKEN_ENCRYPTION_KEY: z.string().optional(),
});

export type SlackConfig = z.infer<typeof slackConfigSchema>;

export function loadSlackConfig(): SlackConfig {
  const result = slackConfigSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`Invalid Slack configuration: ${errorDetails}`);
  }
  return result.data;
}

export const slackConfig = loadSlackConfig();
