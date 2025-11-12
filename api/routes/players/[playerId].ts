/* eslint-env node */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { enforceSecurity } from '../_lib/security';
import { ApiError, handleError } from '../_lib/errors';
import { readJsonBody } from '../_lib/json';
import { noContent, ok } from '../_lib/responses';
import { parseWithSchema } from '../_lib/validation';
import {
  getPlayer,
  softDeletePlayer,
  updatePlayer,
  type UpdatePlayerInput,
} from '../../server/services/players';

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

export async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const isMutation = req.method !== 'GET';
    const security = enforceSecurity(req, {
      requireAuthentication: true,
      requireCsrf: req.method === 'PATCH' || req.method === 'DELETE',
      allowedRoles: isMutation ? ['coach', 'admin'] : ['coach', 'analyst', 'viewer', 'admin'],
    });
    const playerId = req.query.playerId;
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
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_JSON_BODY') {
      handleError(res, new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.'));
      return;
    }
    handleError(res, error);
  }
}
