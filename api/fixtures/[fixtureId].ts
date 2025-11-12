/* eslint-env node */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { enforceSecurity } from '../_lib/security';
import { ApiError, handleError } from '../_lib/errors';
import { readJsonBody } from '../_lib/json';
import { ok } from '../_lib/responses';
import { parseWithSchema } from '../_lib/validation';
import { getFixtureDetail, updateFixtureMetadata } from '../../server/services/fixtures';

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

export default async function(req: VercelRequest, res: VercelResponse) {
  try {
    const fixtureId = req.query.fixtureId;
    if (typeof fixtureId !== 'string') {
      throw new ApiError(400, 'FIXTURE_ID_REQUIRED', 'fixtureId parameter is required.');
    }

    const security = enforceSecurity(req, {
      requireAuthentication: true,
      requireCsrf: req.method === 'PATCH',
      allowedRoles: req.method === 'GET' ? ['coach', 'analyst', 'viewer', 'admin'] : ['coach', 'admin'],
    });

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
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_JSON_BODY') {
      handleError(res, new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.'));
      return;
    }
    handleError(res, error);
  }
}
