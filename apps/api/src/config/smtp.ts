import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

export const smtpConfigSchema = z.object({
  ETHEREAL_HOST: z.string().min(1).default('smtp.ethereal.email'),
  ETHEREAL_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  ETHEREAL_SECURE: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => value === true || value === 'true'),
  ETHEREAL_USER: z.string().optional().default(''),
  ETHEREAL_PASSWORD: z.string().optional().default(''),

  SMTP_POOL: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => value !== false && value !== 'false'),

  SMTP_MAX_CONNECTIONS: z.coerce.number().int().min(1).max(20).default(5),
  SMTP_MAX_MESSAGES: z.coerce.number().int().min(1).max(1000).default(100),
});

const parsed = smtpConfigSchema.parse({
  ETHEREAL_HOST: process.env.ETHEREAL_HOST,
  ETHEREAL_PORT: process.env.ETHEREAL_PORT,
  ETHEREAL_SECURE: process.env.ETHEREAL_SECURE,
  ETHEREAL_USER: process.env.ETHEREAL_USER,
  ETHEREAL_PASSWORD: process.env.ETHEREAL_PASSWORD,
  SMTP_POOL: process.env.SMTP_POOL,
  SMTP_MAX_CONNECTIONS: process.env.SMTP_MAX_CONNECTIONS,
  SMTP_MAX_MESSAGES: process.env.SMTP_MAX_MESSAGES,
});

export const smtpConfig = {
  host: parsed.ETHEREAL_HOST,
  port: parsed.ETHEREAL_PORT,
  secure: parsed.ETHEREAL_SECURE,
  user: parsed.ETHEREAL_USER,
  password: parsed.ETHEREAL_PASSWORD,
  pool: parsed.SMTP_POOL,
  maxConnections: parsed.SMTP_MAX_CONNECTIONS,
  maxMessages: parsed.SMTP_MAX_MESSAGES,
  isConfigured: Boolean(parsed.ETHEREAL_USER && parsed.ETHEREAL_PASSWORD),
};

export function validateSmtpCredentials(user?: string, password?: string): void {
  const effectiveUser = user ?? smtpConfig.user;
  const effectivePassword = password ?? smtpConfig.password;

  if (!effectiveUser || effectiveUser.trim() === '') {
    throw new Error('Ethereal SMTP user credential (ETHEREAL_USER) is missing or empty');
  }

  if (!effectivePassword || effectivePassword.trim() === '') {
    throw new Error('Ethereal SMTP password credential (ETHEREAL_PASSWORD) is missing or empty');
  }
}
