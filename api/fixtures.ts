import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../server/db/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { teamId } = req.query;

    if (!teamId || typeof teamId !== 'string') {
      return res.status(400).json({ error: 'teamId query parameter is required' });
    }

    const matches = await prisma.match.findMany({
      where: { teamId },
      orderBy: { fixtureDate: 'desc' },
    });

    // Transform to Beta's expected format
    const matchesDTO = matches.map((match) => {
      // Parse allocation JSON
      let allocation = null;
      if (match.allocation) {
        try {
          allocation = typeof match.allocation === 'string'
            ? JSON.parse(match.allocation)
            : match.allocation;
        } catch (e) {
          console.error('Failed to parse allocation:', e);
        }
      }

      // Extract unique player names from allocation
      const players: string[] = [];
      if (allocation?.quarters) {
        const playerSet = new Set<string>();
        allocation.quarters.forEach((quarter: any) => {
          quarter.slots?.forEach((slot: any) => {
            if (slot.player) playerSet.add(slot.player);
          });
        });
        players.push(...Array.from(playerSet));
      }

      return {
        id: match.id,
        date: match.fixtureDate,
        opponent: match.opponent || 'Unknown',
        players,
        allocation,
        result: match.goalsFor !== null && match.goalsAgainst !== null
          ? {
              goalsFor: match.goalsFor,
              goalsAgainst: match.goalsAgainst,
              potm: match.potm,
              honorableMentions: match.honorableMentions || [],
            }
          : null,
      };
    });

    return res.status(200).json({ data: matchesDTO });
  } catch (error) {
    console.error('Fixtures API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
