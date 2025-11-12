/* eslint-env node */
import { Pool } from 'pg';
import type { PoolClient, PoolConfig, QueryResult } from 'pg';

let sharedPool: Pool | null = null;

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`${name} environment variable is required when running API services.`);
  }
  return value;
};

function resolveConnectionString(): string {
  const primary = process.env.DATABASE_URL;
  if (primary && primary.trim().length > 0) {
    return primary;
  }

  const candidates = [
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL_NON_POOLING,
  ];
  const value = candidates.find((item) => typeof item === 'string' && item.length > 0);
  if (!value) {
    throw new Error('DATABASE_URL (or POSTGRES_URL*) env var must be configured before using the db client.');
  }
  return value;
}

function createPool(): Pool {
  requireEnv('DATABASE_URL');
  const connectionString = resolveConnectionString();
  const config: PoolConfig = {
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : false,
  };
  return new Pool(config);
}

export function getPool(): Pool {
  if (!sharedPool) {
    sharedPool = createPool();
  }
  return sharedPool;
}

export async function query<T extends Record<string, any> = any>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params as any[]);
}

export async function withTransaction<T>(fn: (_client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
