/* eslint-env node */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { enforceSecurity } from '../../_lib/security';
import { ApiError, handleError } from '../../_lib/errors';
import { ok } from '../../_lib/responses';
import { restorePlayer } from '../../services/players';

export default async function(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Unsupported method: ${req.method}`);
    }

    const security = enforceSecurity(req, {
      requireAuthentication: true,
      requireCsrf: true,
      allowedRoles: ['coach', 'admin'],
    });
    const playerId = req.query.playerId;
    if (typeof playerId !== 'string') {
      throw new ApiError(400, 'PLAYER_ID_REQUIRED', 'playerId param is required.');
    }

    const restored = await restorePlayer(playerId, security.actorId);
    if (!restored) {
      throw new ApiError(404, 'PLAYER_NOT_FOUND', 'Player not found.');
    }

    ok(res, { data: restored });
  } catch (error) {
    handleError(res, error);
  }
}
