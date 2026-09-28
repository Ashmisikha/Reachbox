import type { Client } from '@elastic/elasticsearch';
import { elasticsearchConfig } from '../../config/elasticsearch';
import { getElasticsearchClient } from './elasticsearch.client';
import type {
  EmailSearchQuery,
  EmailSearchResult,
  IndexedEmailDocument,
} from './email-search.types';

export class EmailSearchService {
  constructor(
    private readonly client: Client = getElasticsearchClient(),
    private readonly indexName: string = elasticsearchConfig.index
  ) {}

  /**
   * Search indexed email messages with free-text querying, structured filtering, date ranges, and pagination.
   */
  async search(query: EmailSearchQuery): Promise<EmailSearchResult> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
    const fromOffset = (page - 1) * pageSize;

    const boolQuery: Record<string, any> = {
      must: [],
      filter: [],
    };

    // 1. Free-text search across subject, body, senderName, senderEmail, recipient
    if (query.q && query.q.trim().length > 0) {
      const searchTerm = query.q.trim();
      boolQuery.must.push({
        multi_match: {
          query: searchTerm,
          fields: [
            'subject^3',
            'body^2',
            'senderName^2',
            'senderEmail',
            'recipient',
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    } else {
      boolQuery.must.push({ match_all: {} });
    }

    // 2. Exact keyword filters
    if (query.userId) {
      boolQuery.filter.push({ term: { userId: query.userId } });
    }
    if (query.campaignId) {
      boolQuery.filter.push({ term: { campaignId: query.campaignId } });
    }
    if (query.senderId) {
      boolQuery.filter.push({ term: { senderId: query.senderId } });
    }
    if (query.senderEmail) {
      boolQuery.filter.push({ term: { senderEmail: query.senderEmail.toLowerCase() } });
    }
    if (query.recipient) {
      boolQuery.filter.push({ term: { recipient: query.recipient.toLowerCase() } });
    }
    if (query.status) {
      boolQuery.filter.push({ term: { status: query.status.toUpperCase() } });
    }

    // 3. Date range filtering (createdAt | scheduledAt | sentAt)
    if (query.from || query.to) {
      const dateField = query.dateField ?? 'sentAt';
      const rangeClause: Record<string, any> = {};

      if (query.from) {
        rangeClause.gte = query.from;
      }
      if (query.to) {
        rangeClause.lte = query.to;
      }

      boolQuery.filter.push({
        range: {
          [dateField]: rangeClause,
        },
      });
    }

    // 4. Sorting
    const sortFieldAndOrder = (query.sort ?? 'sentAt:desc').split(':');
    const sortField = sortFieldAndOrder[0] || 'sentAt';
    const sortOrder = sortFieldAndOrder[1]?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const sortClause: Array<Record<string, any>> = [
      { [sortField]: { order: sortOrder, missing: '_last' } },
      { id: { order: 'desc' } }, // Tie-breaker for stable pagination
    ];

    try {
      const response = await this.client.search<IndexedEmailDocument>({
        index: this.indexName,
        from: fromOffset,
        size: pageSize,
        query: {
          bool: boolQuery,
        },
        sort: sortClause,
      });

      const totalHits =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : (response.hits.total?.value ?? 0);

      const items: IndexedEmailDocument[] = response.hits.hits
        .map((hit) => hit._source)
        .filter((doc): doc is IndexedEmailDocument => doc !== undefined);

      const totalPages = Math.ceil(totalHits / pageSize);

      return {
        items,
        page,
        pageSize,
        total: totalHits,
        totalPages,
      };
    } catch (error: any) {
      // If the index does not exist yet, return a clean empty result rather than failing
      if (error?.meta?.statusCode === 404) {
        return {
          items: [],
          page,
          pageSize,
          total: 0,
          totalPages: 0,
        };
      }
      throw error;
    }
  }
}

export const emailSearchService = new EmailSearchService();
