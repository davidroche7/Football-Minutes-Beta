/* eslint-env node */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { enforceSecurity } from '../../_lib/security';
import { ApiError, handleError } from '../../_lib/errors';
import { readJsonBody } from '../../_lib/json';
import { ok } from '../../_lib/responses';
import { parseWithSchema } from '../../_lib/validation';
import { setFixtureResult } from '../../services/fixtures';

const resultSchema = z.object({
  resultCode: z.enum(['WIN', 'DRAW', 'LOSS', 'ABANDONED', 'VOID']),
  teamGoals: z.number().int().min(0).nullable().optional(),
  opponentGoals: z.number().int().min(0).nullable().optional(),
  playerOfMatchId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  awards: z
    .array(
      z.object({
        playerId: z.string().uuid(),
        awardType: z.enum(['SCORER', 'HONORABLE_MENTION', 'ASSIST']),
        count: z.number().int().min(1).max(10).optional(),
      })
    )
    .optional(),
});

export default async function(req: VercelRequest, res: VercelResponse) {
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
    const payload = parseWithSchema(resultSchema, rawBody, 'VALIDATION_ERROR');

    const fixture = await setFixtureResult(fixtureId, security.actorId ?? null, payload);
    if (!fixture) {
      throw new ApiError(404, 'FIXTURE_NOT_FOUND', 'Fixture not found.');
    }

    ok(res, { data: fixture });
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_JSON_BODY') {
      handleError(res, new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.'));
      return;
    }
    handleError(res, error);
  }
}
