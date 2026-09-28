import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';
import { logger } from './logger';

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', { error: err.message });
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  logger.debug('Executed DB query', { text, duration, rows: res.rowCount });
  return res;
}

export async function checkDbConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.warn('PostgreSQL connection check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
