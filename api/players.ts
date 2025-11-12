/* eslint-env node */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { enforceSecurity } from './_lib/security';
import { handleError, ApiError } from './_lib/errors';
import { readJsonBody } from './_lib/json';
import { created, ok, noContent } from './_lib/responses';
import { parseWithSchema } from './_lib/validation';
import {
  createPlayer,
  listPlayers,
  getPlayer,
  updatePlayer,
  softDeletePlayer,
  restorePlayer,
  type CreatePlayerInput,
  type UpdatePlayerInput,
} from '../server/services/players';

const createPlayerSchema = z.object({
  teamId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(120),
  preferredPositions: z
    .array(z.string().trim().min(1))
    .max(5)
    .optional(),
  squadNumber: z
    .number({ invalid_type_error: 'squadNumber must be a number' })
    .int()
    .min(0)
    .max(99)
    .nullable()
    .optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TRIALIST']).optional(),
  notes: z.string().max(500).nullable().optional(),
});

const updatePlayerSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    preferredPositions: z.array(z.string().trim().min(1)).max(5).optional(),
    squadNumber: z.number().int().min(0).max(99).nullable().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'TRIALIST']).optional(),
    notes: z.string().max(500).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided.',
  });

function getRequiredTeamId(req: VercelRequest, headerTeamId?: string): string {
  const source = (req.query.teamId as string | undefined) ?? headerTeamId;
  if (!source) {
    throw new ApiError(400, 'TEAM_ID_REQUIRED', 'teamId is required.');
  }
  return source;
}

export default async function(req: VercelRequest, res: VercelResponse) {
  try {
    const { playerId, restore } = req.query;
    const isMutation = req.method !== 'GET';
    const security = enforceSecurity(req, {
      requireAuthentication: true,
      requireCsrf: isMutation,
      allowedRoles: isMutation ? ['coach', 'admin'] : ['coach', 'analyst', 'viewer', 'admin'],
    });

    // Handle /api/players/:playerId/restore
    if (playerId && restore === '1') {
      if (req.method !== 'POST') {
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Unsupported method: ${req.method}`);
      }
      if (typeof playerId !== 'string') {
        throw new ApiError(400, 'PLAYER_ID_REQUIRED', 'playerId param is required.');
      }
      const restored = await restorePlayer(playerId, security.actorId);
      if (!restored) {
        throw new ApiError(404, 'PLAYER_NOT_FOUND', 'Player not found.');
      }
      ok(res, { data: restored });
      return;
    }

    // Handle /api/players/:playerId
    if (playerId) {
      if (typeof playerId !== 'string') {
        throw new ApiError(400, 'PLAYER_ID_REQUIRED', 'playerId param is required.');
      }

      switch (req.method) {
        case 'GET': {
          const player = await getPlayer(playerId);
          if (!player) {
            throw new ApiError(404, 'PLAYER_NOT_FOUND', 'Player not found.');
          }
          ok(res, { data: player });
          return;
        }
        case 'PATCH': {
          const rawBody = await readJsonBody(req);
          const payload = parseWithSchema(updatePlayerSchema, rawBody, 'VALIDATION_ERROR');
          const input: UpdatePlayerInput = {
            displayName: payload.displayName,
            preferredPositions: payload.preferredPositions,
            squadNumber: payload.squadNumber ?? null,
            status: payload.status,
            notes: payload.notes ?? null,
            actorId: security.actorId,
          };
          const updated = await updatePlayer(playerId, input);
          if (!updated) {
            throw new ApiError(404, 'PLAYER_NOT_FOUND', 'Player not found.');
          }
          ok(res, { data: updated });
          return;
        }
        case 'DELETE': {
          const removed = await softDeletePlayer(playerId, security.actorId);
          if (!removed) {
            throw new ApiError(404, 'PLAYER_NOT_FOUND', 'Player not found.');
          }
          noContent(res);
          return;
        }
        default:
          throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Unsupported method: ${req.method}`);
      }
    }

    // Handle /api/players
    switch (req.method) {
      case 'GET': {
        const teamId = getRequiredTeamId(req, security.teamIdHeader);
        const includeRemoved =
          typeof req.query.includeRemoved === 'string'
            ? req.query.includeRemoved === 'true'
            : false;
        const players = await listPlayers(teamId, { includeRemoved });
        ok(res, { data: players });
        return;
      }
      case 'POST': {
        const rawBody = await readJsonBody(req);
        if (rawBody === undefined) {
          throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
        }
        const payload = parseWithSchema(createPlayerSchema, rawBody, 'VALIDATION_ERROR');
        const input: CreatePlayerInput = {
          teamId: payload.teamId,
          displayName: payload.displayName,
          preferredPositions: payload.preferredPositions,
          squadNumber: payload.squadNumber ?? null,
          status: payload.status,
          notes: payload.notes ?? null,
          actorId: security.actorId,
        };
        const player = await createPlayer(input);
        created(res, { data: player });
        return;
      }
      default:
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Unsupported method: ${req.method}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_JSON_BODY') {
      handleError(res, new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.'));
      return;
    }
    handleError(res, error);
  }
}
