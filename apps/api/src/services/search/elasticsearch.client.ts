import { Client } from '@elastic/elasticsearch';
import { elasticsearchConfig } from '../../config/elasticsearch';
import { logger } from '../../lib/logger';
import type { ElasticsearchHealth } from './email-search.types';

let clientInstance: Client | null = null;

export function createElasticsearchClient(options?: {
  url?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  requestTimeout?: number;
}): Client {
  const node = options?.url ?? elasticsearchConfig.url;
  const username = options?.username ?? elasticsearchConfig.username;
  const password = options?.password ?? elasticsearchConfig.password;
  const apiKey = options?.apiKey ?? elasticsearchConfig.apiKey;
  const requestTimeout = options?.requestTimeout ?? elasticsearchConfig.requestTimeoutMs;

  const clientOptions: ConstructorParameters<typeof Client>[0] = {
    node,
    requestTimeout,
  };

  if (apiKey) {
    clientOptions.auth = { apiKey };
  } else if (username && password) {
    clientOptions.auth = { username, password };
  }

  return new Client(clientOptions);
}

export function getElasticsearchClient(): Client {
  if (!clientInstance) {
    clientInstance = createElasticsearchClient();
    logger.info('Elasticsearch client initialized', {
      node: elasticsearchConfig.url,
      index: elasticsearchConfig.index,
    });
  }
  return clientInstance;
}

export async function closeElasticsearchClient(): Promise<void> {
  if (clientInstance) {
    try {
      await clientInstance.close();
      logger.info('Elasticsearch client closed cleanly');
    } catch (error) {
      logger.error('Error closing Elasticsearch client', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clientInstance = null;
    }
  }
}

export async function isElasticsearchAvailable(client: Client = getElasticsearchClient()): Promise<boolean> {
  try {
    const ping = await client.ping();
    return ping === true;
  } catch {
    return false;
  }
}

export async function getElasticsearchHealth(
  client: Client = getElasticsearchClient()
): Promise<ElasticsearchHealth> {
  try {
    const info = await client.info();
    return {
      status: 'connected',
      clusterName: info.cluster_name,
      version: info.version?.number,
    };
  } catch (error) {
    return {
      status: 'disconnected',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function setElasticsearchClientForTesting(mockClient: Client | null): void {
  clientInstance = mockClient;
}
