/* eslint-env node */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { enforceSecurity } from '../_lib/security';
import { ApiError, handleError } from '../_lib/errors';
import { ok } from '../_lib/responses';
import { getPlayerSeasonSummary } from '../server/services/stats';

export default async function(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Unsupported method: ${req.method}`);
    }

    const security = enforceSecurity(req, {
      requireAuthentication: true,
      requireCsrf: false,
      allowedRoles: ['coach', 'analyst', 'viewer', 'admin'],
    });
    const teamId =
      (typeof req.query.teamId === 'string' && req.query.teamId) || security.teamIdHeader;
    if (!teamId) {
      throw new ApiError(400, 'TEAM_ID_REQUIRED', 'teamId is required.');
    }

    const seasonId = typeof req.query.seasonId === 'string' ? req.query.seasonId : undefined;
    const players = await getPlayerSeasonSummary(teamId, seasonId ?? undefined);
    ok(res, { data: players });
  } catch (error) {
    handleError(res, error);
  }
}
