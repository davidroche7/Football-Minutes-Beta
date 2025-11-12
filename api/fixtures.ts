/* eslint-env node */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { enforceSecurity } from './_lib/security';
import { ApiError, handleError } from './_lib/errors';
import { readJsonBody } from './_lib/json';
import { ok, created } from './_lib/responses';
import { parseWithSchema } from './_lib/validation';
import {
  createFixture,
  listFixtures,
  getFixtureDetail,
  updateFixtureMetadata,
  replaceFixtureLineup,
  lockFixture,
  setFixtureResult,
} from '../server/services/fixtures';
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

const updateFixtureSchema = z
  .object({
    opponent: z.string().trim().min(1).max(200).optional(),
    fixtureDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'fixtureDate must be YYYY-MM-DD')
      .optional(),
    venueType: z.enum(['HOME', 'AWAY', 'NEUTRAL']).optional(),
    kickoffTime: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'kickoffTime must be HH:MM or HH:MM:SS')
      .nullable()
      .optional(),
    notes: z.string().max(2000).nullable().optional(),
    seasonId: z.string().uuid().nullable().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided.',
  });

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

function parseFixtureStatus(status: string | undefined): FixtureStatus | undefined {
  if (!status) return undefined;
  if (status === 'DRAFT' || status === 'LOCKED' || status === 'FINAL') {
    return status;
  }
  throw new ApiError(400, 'INVALID_STATUS', `Unknown fixture status "${status}".`);
}

export default async function(req: VercelRequest, res: VercelResponse) {
  try {
    const { fixtureId, action } = req.query;
    const isMutation = req.method !== 'GET';
    const security = enforceSecurity(req, {
      requireAuthentication: true,
      requireCsrf: isMutation,
      allowedRoles: isMutation ? ['coach', 'admin'] : ['coach', 'analyst', 'viewer', 'admin'],
    });

    // Handle /api/fixtures/:fixtureId/lineup
    if (fixtureId && action === 'lineup') {
      if (req.method !== 'POST') {
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Unsupported method: ${req.method}`);
      }
      if (typeof fixtureId !== 'string') {
        throw new ApiError(400, 'FIXTURE_ID_REQUIRED', 'fixtureId parameter is required.');
      }
      const rawBody = await readJsonBody(req);
      const payload = parseWithSchema(lineupSchema, rawBody, 'VALIDATION_ERROR');
      const lineup = await replaceFixtureLineup(fixtureId, security.actorId ?? null, payload);
      ok(res, { data: lineup });
      return;
    }

    // Handle /api/fixtures/:fixtureId/lock
    if (fixtureId && action === 'lock') {
      if (req.method !== 'POST') {
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Unsupported method: ${req.method}`);
      }
      if (typeof fixtureId !== 'string') {
        throw new ApiError(400, 'FIXTURE_ID_REQUIRED', 'fixtureId parameter is required.');
      }
      const locked = await lockFixture(fixtureId, security.actorId ?? null);
      if (!locked) {
        throw new ApiError(404, 'FIXTURE_NOT_FOUND', 'Fixture not found.');
      }
      ok(res, { data: locked });
      return;
    }

    // Handle /api/fixtures/:fixtureId/result
    if (fixtureId && action === 'result') {
      if (req.method !== 'POST') {
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Unsupported method: ${req.method}`);
      }
      if (typeof fixtureId !== 'string') {
        throw new ApiError(400, 'FIXTURE_ID_REQUIRED', 'fixtureId parameter is required.');
      }
      const rawBody = await readJsonBody(req);
      const payload = parseWithSchema(resultSchema, rawBody, 'VALIDATION_ERROR');
      const fixture = await setFixtureResult(fixtureId, security.actorId ?? null, payload);
      if (!fixture) {
        throw new ApiError(404, 'FIXTURE_NOT_FOUND', 'Fixture not found.');
      }
      ok(res, { data: fixture });
      return;
    }

    // Handle /api/fixtures/:fixtureId
    if (fixtureId) {
      if (typeof fixtureId !== 'string') {
        throw new ApiError(400, 'FIXTURE_ID_REQUIRED', 'fixtureId parameter is required.');
      }

      if (req.method === 'GET') {
        const detail = await getFixtureDetail(fixtureId);
        if (!detail) {
          throw new ApiError(404, 'FIXTURE_NOT_FOUND', 'Fixture not found.');
        }
        ok(res, { data: detail });
        return;
      }

      if (req.method === 'PATCH') {
        const rawBody = await readJsonBody(req);
        const payload = parseWithSchema(updateFixtureSchema, rawBody, 'VALIDATION_ERROR');
        const updated = await updateFixtureMetadata(fixtureId, security.actorId ?? null, payload);
        if (!updated) {
          throw new ApiError(404, 'FIXTURE_NOT_FOUND', 'Fixture not found.');
        }
        ok(res, { data: updated });
        return;
      }

      throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Unsupported method: ${req.method}`);
    }

    // Handle /api/fixtures
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
