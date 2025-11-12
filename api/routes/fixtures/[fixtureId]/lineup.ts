/* eslint-env node */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { enforceSecurity } from '../../_lib/security';
import { ApiError, handleError } from '../../_lib/errors';
import { readJsonBody } from '../../_lib/json';
import { ok } from '../../_lib/responses';
import { parseWithSchema } from '../../_lib/validation';
import { replaceFixtureLineup } from '../../../server/services/fixtures';

const lineupSchema = z.object({
  slots: z
    .array(
      z.object({
        quarterNumber: z.number().int().min(1).max(4),
        wave: z.enum(['FULL', 'FIRST', 'SECOND']),
        position: z.enum(['GK', 'DEF', 'ATT']),
        playerId: z.string().uuid(),
        minutes: z.number().int().min(1).max(60),
        isSubstitution: z.boolean().optional(),
      })
    )
    .max(100),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    const rawBody = await readJsonBody(req);
    const payload = parseWithSchema(lineupSchema, rawBody, 'VALIDATION_ERROR');

    const lineup = await replaceFixtureLineup(fixtureId, security.actorId ?? null, payload);
    ok(res, { data: lineup });
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_JSON_BODY') {
      handleError(res, new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.'));
      return;
    }
    handleError(res, error);
  }
}
