import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../server/db/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { teamId, includeRemoved } = req.query;

    if (!teamId || typeof teamId !== 'string') {
      return res.status(400).json({ error: 'teamId query parameter is required' });
    }

    const players = await prisma.player.findMany({
      where: {
        teamId,
        ...(includeRemoved === 'true' ? {} : { removedAt: null }),
      },
      orderBy: { displayName: 'asc' },
    });

    return res.status(200).json({ data: players });
  } catch (error) {
    console.error('Players API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
