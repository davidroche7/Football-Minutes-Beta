/* eslint-env node */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Simple ping endpoint - no database'
  });
}
