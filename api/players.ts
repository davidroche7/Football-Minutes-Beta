/* eslint-env node */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { teamId } = req.query;

    if (!teamId || typeof teamId !== 'string') {
      return res.status(400).json({ error: 'teamId query parameter is required' });
    }

    if (req.method === 'GET') {
      // Get all players for the team
      const players = await prisma.player.findMany({
        where: {
          teamId: teamId,
          status: 'ACTIVE',
        },
        orderBy: {
          displayName: 'asc',
        },
      });

      // Map to expected format
      const playersDTO = players.map((player) => ({
        id: player.id,
        teamId: player.teamId,
        displayName: player.displayName,
        preferredPositions: player.preferredPositions ? player.preferredPositions.split(',') : [],
        squadNumber: player.squadNumber,
        status: player.status,
        notes: player.notes,
        createdAt: player.createdAt.toISOString(),
        updatedAt: player.updatedAt.toISOString(),
        removedAt: player.removedAt?.toISOString() || null,
      }));

      return res.status(200).json({ data: playersDTO });
    }

    if (req.method === 'POST') {
      // Create a new player
      const { displayName, preferredPositions, squadNumber, notes } = req.body;

      if (!displayName || typeof displayName !== 'string') {
        return res.status(400).json({ error: 'displayName is required' });
      }

      const player = await prisma.player.create({
        data: {
          teamId: teamId,
          displayName: displayName.trim(),
          preferredPositions: preferredPositions ? preferredPositions.join(',') : null,
          squadNumber: squadNumber || null,
          status: 'ACTIVE',
          notes: notes || null,
        },
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          teamId: teamId,
          type: 'PLAYER_CREATED',
          message: `Player created: ${player.displayName}`,
          actor: 'coach',
        },
      });

      const playerDTO = {
        id: player.id,
        teamId: player.teamId,
        displayName: player.displayName,
        preferredPositions: player.preferredPositions ? player.preferredPositions.split(',') : [],
        squadNumber: player.squadNumber,
        status: player.status,
        notes: player.notes,
        createdAt: player.createdAt.toISOString(),
        updatedAt: player.updatedAt.toISOString(),
        removedAt: player.removedAt?.toISOString() || null,
      };

      return res.status(201).json({ data: playerDTO });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Players API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await prisma.$disconnect();
  }
}
