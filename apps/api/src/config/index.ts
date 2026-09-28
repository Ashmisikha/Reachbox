import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_URL: z
    .string()
    .default(
      'postgresql://reachinbox:reachinbox_secret@localhost:5432/reachinbox_db?schema=public'
    ),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Operational limits and delays
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  MIN_EMAIL_DELAY_MS: z.coerce.number().default(2000),
  MAX_EMAILS_PER_HOUR: z.coerce.number().default(200),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().default(50),

  // BullMQ queue configuration
  EMAIL_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(10),
  EMAIL_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  EMAIL_RETRY_DELAY_MS: z.coerce.number().int().min(100).default(5000),
  EMAIL_SCHEDULING_BATCH_SIZE: z.coerce.number().int().min(50).max(2000).default(500),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`Invalid environment configuration: ${errorDetails}`);
  }
  return result.data;
}

export const config = loadConfig();
