/* eslint-env node */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { enforceSecurity } from '../../_lib/security';
import { ApiError, handleError } from '../../_lib/errors';
import { ok } from '../../_lib/responses';
import { lockFixture } from '../../../server/services/fixtures';

export async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Unsupported method: ${req.method}`);
    }

    const fixtureId = req.query.fixtureId;
    if (typeof fixtureId !== 'string') {
      throw new ApiError(400, 'FIXTURE_ID_REQUIRED', 'fixtureId parameter is required.');
    }

    const security = enforceSecurity(req, {
      requireAuthentication: true,
      requireCsrf: true,
      allowedRoles: ['coach', 'admin'],
    });

    const locked = await lockFixture(fixtureId, security.actorId ?? null);
    if (!locked) {
      throw new ApiError(404, 'FIXTURE_NOT_FOUND', 'Fixture not found.');
    }

    ok(res, { data: locked });
  } catch (error) {
    handleError(res, error);
  }
}
