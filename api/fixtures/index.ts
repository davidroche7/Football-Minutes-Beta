/* eslint-env node */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { enforceSecurity } from '../_lib/security';
import { ApiError, handleError } from '../_lib/errors';
import { readJsonBody } from '../_lib/json';
import { ok, created } from '../_lib/responses';
import { parseWithSchema } from '../_lib/validation';
import { createFixture, listFixtures } from '../server/services/fixtures';
import type { FixtureStatus } from '../server/db/types';

const createFixtureSchema = z.object({
  teamId: z.string().uuid(),
  seasonId: z.string().uuid().optional(),
  opponent: z.string().trim().min(1).max(200),
  fixtureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fixtureDate must be YYYY-MM-DD'),
  venueType: z.enum(['HOME', 'AWAY', 'NEUTRAL']),
  kickoffTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'kickoffTime must be HH:MM or HH:MM:SS')
    .nullable()
    .optional(),
  notes: z.string().max(2000).nullable().optional(),
  squad: z
    .array(
      z.object({
        playerId: z.string().uuid(),
        role: z.enum(['STARTER', 'BENCH']),
      })
    )
    .nonempty('squad must include at least one player'),
});

export default async function(req: VercelRequest, res: VercelResponse) {
  try {
    const isMutation = req.method !== 'GET';
    const security = enforceSecurity(req, {
      requireAuthentication: true,
      requireCsrf: req.method === 'POST',
      allowedRoles: isMutation ? ['coach', 'admin'] : ['coach', 'analyst', 'viewer', 'admin'],
    });

    if (req.method === 'GET') {
      const teamId =
        (req.query.teamId as string | undefined) ?? security.teamIdHeader ?? undefined;
      if (!teamId) {
        throw new ApiError(400, 'TEAM_ID_REQUIRED', 'teamId is required.');
      }

      const statusParam = typeof req.query.status === 'string' ? req.query.status : undefined;
      const status = statusParam ? parseFixtureStatus(statusParam) : undefined;
      const seasonId =
        typeof req.query.seasonId === 'string' ? req.query.seasonId : undefined;

      const fixtures = await listFixtures({
        teamId,
        seasonId,
        status,
      });
      ok(res, { data: fixtures });
      return;
    }

    if (req.method === 'POST') {
      const rawBody = await readJsonBody(req);
      const payload = parseWithSchema(createFixtureSchema, rawBody, 'VALIDATION_ERROR');
        const fixture = await createFixture({
          teamId: payload.teamId,
          seasonId: payload.seasonId ?? null,
          opponent: payload.opponent,
          fixtureDate: payload.fixtureDate,
          venueType: payload.venueType,
          kickoffTime: payload.kickoffTime ?? null,
          notes: payload.notes ?? null,
          squad: payload.squad,
          createdBy: security.actorId ?? null,
        });
      created(res, { data: fixture });
      return;
    }

    throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Unsupported method: ${req.method}`);
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_JSON_BODY') {
      handleError(res, new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.'));
      return;
    }
    handleError(res, error);
  }
}

function parseFixtureStatus(status: string | undefined): FixtureStatus | undefined {
  if (!status) return undefined;
  if (status === 'DRAFT' || status === 'LOCKED' || status === 'FINAL') {
    return status;
  }
  throw new ApiError(400, 'INVALID_STATUS', `Unknown fixture status "${status}".`);
}
