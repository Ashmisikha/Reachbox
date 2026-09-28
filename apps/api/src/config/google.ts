import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

export const googleConfigSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().default('mock-google-client-id.apps.googleusercontent.com'),
  GOOGLE_CLIENT_SECRET: z.string().default('mock-google-client-secret'),
  GOOGLE_REDIRECT_URI: z
    .string()
    .default(
      process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback'
    ),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  SESSION_SECRET: z
    .string()
    .default('reachinbox_development_session_secret_change_in_production_min_32_chars'),
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
