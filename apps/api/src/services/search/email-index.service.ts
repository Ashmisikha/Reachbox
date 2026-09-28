import type { Client } from '@elastic/elasticsearch';
import { elasticsearchConfig } from '../../config/elasticsearch';
import { logger } from '../../lib/logger';
import prisma from '../../lib/prisma';
import { getElasticsearchClient } from './elasticsearch.client';
import type {
  BulkIndexResult,
  EmailIndexResult,
  IndexedEmailDocument,
} from './email-search.types';

export const EMAIL_INDEX_NAME = elasticsearchConfig.index;

export const EMAIL_INDEX_MAPPINGS = {
  properties: {
    id: { type: 'keyword' },
    campaignId: { type: 'keyword' },
    userId: { type: 'keyword' },
    senderId: { type: 'keyword' },
    senderEmail: { type: 'keyword' },
    senderName: {
      type: 'text',
      fields: {
        keyword: { type: 'keyword', ignore_above: 256 },
      },
    },
    recipient: { type: 'keyword' },
    subject: { type: 'text' },
    body: { type: 'text' },
    status: { type: 'keyword' },
    scheduledAt: { type: 'date' },
    sentAt: { type: 'date' },
    createdAt: { type: 'date' },
    updatedAt: { type: 'date' },
    messageId: { type: 'keyword' },
    idempotencyKey: { type: 'keyword' },
  },
} as const;

export class EmailIndexService {
  constructor(
    private readonly client: Client = getElasticsearchClient(),
    private readonly indexName: string = EMAIL_INDEX_NAME
  ) {}

  /**
   * Idempotently ensure the email search index exists with explicit mappings.
   */
  async ensureIndex(): Promise<boolean> {
    const exists = await this.client.indices.exists({ index: this.indexName });
    if (exists) {
      return false;
    }

    try {
      await this.client.indices.create({
        index: this.indexName,
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
        },
        mappings: EMAIL_INDEX_MAPPINGS,
      });

      logger.info('Created Elasticsearch index with explicit mapping', {
        index: this.indexName,
      });
      return true;
    } catch (error) {
      // Handle race condition where index was created concurrently
      const recheck = await this.client.indices.exists({ index: this.indexName });
      if (recheck) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Index a single email using its deterministic EmailMessage.id as document ID.
   */
  async indexEmail(
    document: IndexedEmailDocument,
    options?: { refresh?: boolean }
  ): Promise<EmailIndexResult> {
    const response = await this.client.index({
      index: this.indexName,
      id: document.id,
      document,
      refresh: options?.refresh ?? false,
    });

    return {
      id: response._id,
      action: response.result === 'created' ? 'created' : 'updated',
      version: response._version,
    };
  }

  /**
   * Update an existing indexed email document.
   */
  async updateEmail(
    id: string,
    partial: Partial<IndexedEmailDocument>,
    options?: { refresh?: boolean }
  ): Promise<EmailIndexResult> {
    const response = await this.client.update({
      index: this.indexName,
      id,
      doc: partial,
      doc_as_upsert: true,
      refresh: options?.refresh ?? false,
    });

    return {
      id: response._id,
      action: response.result === 'created' ? 'created' : 'updated',
      version: response._version,
    };
  }

  /**
   * Delete an email document from the index.
   */
  async deleteEmail(id: string): Promise<boolean> {
    try {
      const response = await this.client.delete({
        index: this.indexName,
        id,
      });
      return response.result === 'deleted';
    } catch (error: any) {
      if (error?.meta?.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Bulk index an array of email documents with batching and item-level error inspection.
   */
  async bulkIndexEmails(
    documents: IndexedEmailDocument[],
    options?: { batchSize?: number; refresh?: boolean }
  ): Promise<BulkIndexResult> {
    if (documents.length === 0) {
      return { total: 0, successful: 0, failed: 0, errors: [] };
    }

    const batchSize = options?.batchSize ?? 500;
    const errors: Array<{ id: string; error: string }> = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const operations = batch.flatMap((doc) => [
        { index: { _index: this.indexName, _id: doc.id } },
        doc,
      ]);

      const bulkResponse = await this.client.bulk({
        operations,
        refresh: options?.refresh ?? false,
      });

      if (bulkResponse.errors) {
        for (const item of bulkResponse.items) {
          const action = item.index ?? item.create ?? item.update;
          if (action?.error) {
            failed++;
            errors.push({
              id: action._id ?? '',
              error: action.error.reason ?? JSON.stringify(action.error),
            });
          } else {
            successful++;
          }
        }
      } else {
        successful += batch.length;
      }
    }

    return {
      total: documents.length,
      successful,
      failed,
      errors,
    };
  }

  /**
   * Reindex all existing email records from PostgreSQL using keyset pagination.
   */
  async reindexFromDatabase(options?: { batchSize?: number }): Promise<BulkIndexResult> {
    await this.ensureIndex();

    const batchSize = options?.batchSize ?? 500;
    let lastId: string | undefined = undefined;
    let totalProcessed = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    const allErrors: Array<{ id: string; error: string }> = [];

    while (true) {
      type MessageWithRelations = Awaited<
        ReturnType<
          typeof prisma.emailMessage.findMany<{
            include: { sender: true; campaign: true };
          }>
        >
      >;

      const messages: MessageWithRelations = await prisma.emailMessage.findMany({
        take: batchSize,
        skip: lastId ? 1 : 0,
        cursor: lastId ? { id: lastId } : undefined,
        orderBy: { id: 'asc' },
        include: {
          sender: true,
          campaign: true,
        },
      });

      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) {
        break;
      }

      lastId = lastMessage.id;

      const documents: IndexedEmailDocument[] = messages.map((m) =>
        EmailIndexService.transformToDocument(m)
      );

      const batchResult = await this.bulkIndexEmails(documents, { batchSize });
      totalProcessed += batchResult.total;
      totalSuccessful += batchResult.successful;
      totalFailed += batchResult.failed;
      allErrors.push(...batchResult.errors);

      if (messages.length < batchSize) {
        break;
      }
    }

    return {
      total: totalProcessed,
      successful: totalSuccessful,
      failed: totalFailed,
      errors: allErrors,
    };
  }

  /**
   * Transform a PostgreSQL EmailMessage record into a clean IndexedEmailDocument.
   */
  static transformToDocument(message: {
    id: string;
    campaignId: string;
    senderId: string;
    recipient: string;
    subject: string;
    body: string;
    status: string;
    scheduledAt: Date;
    sentAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    idempotencyKey: string;
    campaign?: { userId: string } | null;
    sender?: { email: string; name: string | null } | null;
  }): IndexedEmailDocument {
    return {
      id: message.id,
      campaignId: message.campaignId,
      userId: message.campaign?.userId ?? '',
      senderId: message.senderId,
      senderEmail: message.sender?.email ?? '',
      senderName: message.sender?.name ?? null,
      recipient: message.recipient,
      subject: message.subject,
      body: message.body,
      status: message.status,
      scheduledAt: message.scheduledAt.toISOString(),
      sentAt: message.sentAt ? message.sentAt.toISOString() : null,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
      messageId: null, // Populated from transport result if available
      idempotencyKey: message.idempotencyKey,
    };
  }
}

export const emailIndexService = new EmailIndexService();
