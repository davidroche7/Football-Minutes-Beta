/* eslint-env node */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { enforceSecurity } from '../_lib/security';
import { ApiError, handleError } from '../_lib/errors';
import { ok } from '../_lib/responses';
import { listAuditEvents } from '../../server/services/audit';

export default async function(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Unsupported method: ${req.method}`);
    }

    const security = enforceSecurity(req, {
      requireAuthentication: true,
      requireCsrf: false,
      allowedRoles: ['coach', 'analyst', 'admin'],
    });
    const headerTeam = typeof security.teamIdHeader === 'string' ? security.teamIdHeader.trim() : undefined;
    const queryTeam =
      typeof req.query.teamId === 'string' && req.query.teamId.trim().length > 0
        ? req.query.teamId.trim()
        : undefined;
    const teamId = headerTeam || queryTeam;

    const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined;
    const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;

    if (!teamId && !entityId) {
      throw new ApiError(
        400,
        'TEAM_OR_ENTITY_REQUIRED',
        'Provide teamId header/query or an entityId to filter audit events.'
      );
    }

    const events = await listAuditEvents({ entityType, entityId, limit, teamId });
    ok(res, { data: events });
  } catch (error) {
    handleError(res, error);
  }
}
