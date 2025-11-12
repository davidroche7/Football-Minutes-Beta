/* eslint-env node */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  let dbStatus: 'connected' | 'skipped' | 'error' = 'skipped';

  if (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING
  ) {
    try {
      await sql`SELECT 1`;
      dbStatus = 'connected';
    } catch (error) {
      console.error('health-check: database ping failed', error);
      dbStatus = 'error';
    }
  }

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
}
