import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const sanitizeEnv = (defaultVal: string) =>
  z.preprocess(
    (val) => {
      if (typeof val !== 'string') return val;
      return val
        .replace(/^[A-Z0-9_]+\s*=\s*/i, '')
        .replace(/^["']|["']$/g, '')
        .replace(/\r?\n/g, '')
        .trim();
    },
    z.string().default(defaultVal)
  );

export const googleConfigSchema = z.object({
  GOOGLE_CLIENT_ID: sanitizeEnv('mock-google-client-id.apps.googleusercontent.com'),
  GOOGLE_CLIENT_SECRET: sanitizeEnv('mock-google-client-secret'),
  GOOGLE_REDIRECT_URI: sanitizeEnv(
    process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback'
  ),
  WEB_ORIGIN: sanitizeEnv('http://localhost:3000'),
  SESSION_SECRET: sanitizeEnv('reachinbox_development_session_secret_change_in_production_min_32_chars'),
  SESSION_COOKIE_NAME: z.string().default('reachinbox_sid'),
  SESSION_MAX_AGE_MS: z.coerce.number().default(7 * 24 * 60 * 60 * 1000), // 7 days
  OAUTH_STATE_COOKIE_NAME: z.string().default('reachinbox_oauth_state'),
  OAUTH_STATE_MAX_AGE_MS: z.coerce.number().default(10 * 60 * 1000), // 10 minutes
});

export type GoogleConfig = z.infer<typeof googleConfigSchema>;

export function loadGoogleConfig(): GoogleConfig {
  const result = googleConfigSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`Invalid Google OAuth configuration: ${errorDetails}`);
  }
  return result.data;
}

export const googleConfig = loadGoogleConfig();
