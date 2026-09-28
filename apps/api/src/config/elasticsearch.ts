import { z } from 'zod';

export const elasticsearchConfigSchema = z.object({
  url: z.string().url().default('http://localhost:9200'),
  index: z.string().min(1).default('emails'),
  username: z.string().optional(),
  password: z.string().optional(),
  apiKey: z.string().optional(),
  requestTimeoutMs: z.coerce.number().int().min(1000).default(10000),
  indexingWorkerConcurrency: z.coerce.number().int().min(1).max(50).default(5),
  indexingMaxAttempts: z.coerce.number().int().min(1).max(20).default(5),
  indexingRetryDelayMs: z.coerce.number().int().min(500).default(3000),
});

export type ElasticsearchConfig = z.infer<typeof elasticsearchConfigSchema>;

export function loadElasticsearchConfig(env: NodeJS.ProcessEnv = process.env): ElasticsearchConfig {
  return elasticsearchConfigSchema.parse({
    url: env.ELASTICSEARCH_URL,
    index: env.ELASTICSEARCH_INDEX,
    username: env.ELASTICSEARCH_USERNAME || undefined,
    password: env.ELASTICSEARCH_PASSWORD || undefined,
    apiKey: env.ELASTICSEARCH_API_KEY || undefined,
    requestTimeoutMs: env.ELASTICSEARCH_REQUEST_TIMEOUT_MS,
    indexingWorkerConcurrency: env.INDEXING_WORKER_CONCURRENCY,
    indexingMaxAttempts: env.INDEXING_MAX_ATTEMPTS,
    indexingRetryDelayMs: env.INDEXING_RETRY_DELAY_MS,
  });
}

export const elasticsearchConfig = loadElasticsearchConfig();
