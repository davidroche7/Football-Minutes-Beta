/* eslint-env node */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { z } from 'zod';
import { enforceSecurity } from './_lib/security';
import { handleError, ApiError } from './_lib/errors';
import { readJsonBody } from './_lib/json';
import { created, ok, noContent } from './_lib/responses';
import { parseWithSchema } from './_lib/validation';

// ===== Types =====
type PlayerStatus = 'ACTIVE' | 'INACTIVE' | 'TRIALIST';

interface PlayerRow {
  id: string;
  team_id: string;
  display_name: string;
  preferred_positions: string[] | null;
  squad_number: number | null;
  status: PlayerStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
}

interface PlayerDTO {
  id: string;
  teamId: string;
  displayName: string;
  preferredPositions: string[];
  squadNumber: number | null;
  status: PlayerStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  removedAt: string | null;
}

interface CreatePlayerInput {
  teamId: string;
  displayName: string;
  preferredPositions?: string[];
  squadNumber?: number | null;
  status?: PlayerStatus;
  notes?: string | null;
  actorId?: string | null;
}

interface UpdatePlayerInput {
  displayName?: string;
  preferredPositions?: string[];
  squadNumber?: number | null;
  status?: PlayerStatus;
  notes?: string | null;
  actorId?: string | null;
}

// ===== Validation Schemas =====
const createPlayerSchema = z.object({
  teamId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(120),
  preferredPositions: z.array(z.string().trim().min(1)).max(5).optional(),
  squadNumber: z.number({ invalid_type_error: 'squadNumber must be a number' }).int().min(0).max(99).nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TRIALIST']).optional(),
  notes: z.string().max(500).nullable().optional(),
});

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

// ===== Helper Functions =====
const mapPlayer = (row: PlayerRow): PlayerDTO => ({
  id: row.id,
  teamId: row.team_id,
  displayName: row.display_name,
  preferredPositions: row.preferred_positions ?? [],
  squadNumber: row.squad_number,
  status: row.status,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  removedAt: row.removed_at,
});

function getRequiredTeamId(req: VercelRequest, headerTeamId?: string): string {
  const source = (req.query.teamId as string | undefined) ?? headerTeamId;
  if (!source) {
    throw new ApiError(400, 'TEAM_ID_REQUIRED', 'teamId is required.');
  }
  return source;
}

// ===== Database Operations =====
async function listPlayers(teamId: string, options: { includeRemoved?: boolean } = {}): Promise<PlayerDTO[]> {
  const includeRemoved = options.includeRemoved ?? false;
  const result = await sql<PlayerRow>`
    SELECT * FROM player
    WHERE team_id = ${teamId} AND (${includeRemoved}::boolean OR removed_at IS NULL)
    ORDER BY display_name ASC
  `;
  return result.rows.map(mapPlayer);
}

async function getPlayer(playerId: string): Promise<PlayerDTO | null> {
  const result = await sql<PlayerRow>`SELECT * FROM player WHERE id = ${playerId}`;
  if (result.rowCount === 0) return null;
  return mapPlayer(result.rows[0]!);
}

async function createPlayer(input: CreatePlayerInput): Promise<PlayerDTO> {
  const now = new Date().toISOString();
  const result = await sql<PlayerRow>`
    INSERT INTO player (team_id, display_name, preferred_positions, squad_number, status, notes, created_at, updated_at)
    VALUES (${input.teamId}, ${input.displayName.trim()}, ${input.preferredPositions ?? []}, ${input.squadNumber ?? null}, ${input.status ?? 'ACTIVE'}, ${input.notes ?? null}, ${now}, ${now})
    RETURNING *
  `;

  const player = result.rows[0]!;

  // Record audit event
  await sql`
    INSERT INTO audit_event (actor_id, entity_type, entity_id, event_type, previous_state, next_state)
    VALUES (${input.actorId ?? null}, 'PLAYER', ${player.id}, 'created', NULL, ${JSON.stringify(player)})
  `;

  return mapPlayer(player);
}

async function updatePlayer(playerId: string, updates: UpdatePlayerInput): Promise<PlayerDTO | null> {
  const fields: string[] = [];
  const values: Record<string, any> = {};

  const trimmedName = typeof updates.displayName === 'string' ? updates.displayName.trim() : undefined;
  if (typeof trimmedName === 'string') {
    fields.push('display_name');
    values.display_name = trimmedName;
  }
  if (updates.preferredPositions) {
    fields.push('preferred_positions');
    values.preferred_positions = updates.preferredPositions;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'squadNumber')) {
    fields.push('squad_number');
    values.squad_number = updates.squadNumber ?? null;
  }
  if (updates.status) {
    fields.push('status');
    values.status = updates.status;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'notes')) {
    fields.push('notes');
    values.notes = updates.notes ?? null;
  }

  if (fields.length === 0) {
    return getPlayer(playerId);
  }

  // Get previous state
  const previous = await sql<PlayerRow>`SELECT * FROM player WHERE id = ${playerId}`;
  if (previous.rowCount === 0) {
    return null;
  }

  // Build dynamic update query (simplified - using individual updates)
  let updated = previous.rows[0]!;
  if (values.display_name !== undefined) {
    const result = await sql<PlayerRow>`UPDATE player SET display_name = ${values.display_name}, updated_at = NOW() WHERE id = ${playerId} RETURNING *`;
    updated = result.rows[0]!;
  }
  if (values.preferred_positions !== undefined) {
    const result = await sql<PlayerRow>`UPDATE player SET preferred_positions = ${values.preferred_positions}, updated_at = NOW() WHERE id = ${playerId} RETURNING *`;
    updated = result.rows[0]!;
  }
  if (values.squad_number !== undefined) {
    const result = await sql<PlayerRow>`UPDATE player SET squad_number = ${values.squad_number}, updated_at = NOW() WHERE id = ${playerId} RETURNING *`;
    updated = result.rows[0]!;
  }
  if (values.status !== undefined) {
    const result = await sql<PlayerRow>`UPDATE player SET status = ${values.status}, updated_at = NOW() WHERE id = ${playerId} RETURNING *`;
    updated = result.rows[0]!;
  }
  if (values.notes !== undefined) {
    const result = await sql<PlayerRow>`UPDATE player SET notes = ${values.notes}, updated_at = NOW() WHERE id = ${playerId} RETURNING *`;
    updated = result.rows[0]!;
  }

  // Record audit event
  await sql`
    INSERT INTO audit_event (actor_id, entity_type, entity_id, event_type, previous_state, next_state)
    VALUES (${updates.actorId ?? null}, 'PLAYER', ${playerId}, 'updated', ${JSON.stringify(previous.rows[0])}, ${JSON.stringify(updated)})
  `;

  return mapPlayer(updated);
}

async function softDeletePlayer(playerId: string, actorId?: string | null): Promise<PlayerDTO | null> {
  const previous = await sql<PlayerRow>`SELECT * FROM player WHERE id = ${playerId}`;
  if (previous.rowCount === 0) return null;

  const result = await sql<PlayerRow>`
    UPDATE player
    SET removed_at = NOW(), updated_at = NOW()
    WHERE id = ${playerId}
    RETURNING *
  `;

  const player = result.rows[0]!;

  // Record audit event
  await sql`
    INSERT INTO audit_event (actor_id, entity_type, entity_id, event_type, previous_state, next_state)
    VALUES (${actorId ?? null}, 'PLAYER', ${playerId}, 'removed', ${JSON.stringify(previous.rows[0])}, ${JSON.stringify(player)})
  `;

  return mapPlayer(player);
}

async function restorePlayer(playerId: string, actorId?: string | null): Promise<PlayerDTO | null> {
  const previous = await sql<PlayerRow>`SELECT * FROM player WHERE id = ${playerId}`;
  if (previous.rowCount === 0) return null;

  const result = await sql<PlayerRow>`
    UPDATE player
    SET removed_at = NULL, updated_at = NOW()
    WHERE id = ${playerId}
    RETURNING *
  `;

  const player = result.rows[0]!;

  // Record audit event
  await sql`
    INSERT INTO audit_event (actor_id, entity_type, entity_id, event_type, previous_state, next_state)
    VALUES (${actorId ?? null}, 'PLAYER', ${playerId}, 'restored', ${JSON.stringify(previous.rows[0])}, ${JSON.stringify(player)})
  `;

  return mapPlayer(player);
}

// ===== API Handler =====
export default async function(req: VercelRequest, res: VercelResponse) {
  try {
    const { playerId, restore } = req.query;
    const isMutation = req.method !== 'GET';
    const security = enforceSecurity(req, {
      requireAuthentication: true,
      requireCsrf: isMutation,
      allowedRoles: isMutation ? ['coach', 'admin'] : ['coach', 'analyst', 'viewer', 'admin'],
    });

    // Handle /api/players/:playerId/restore
    if (playerId && restore === '1') {
      if (req.method !== 'POST') {
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Unsupported method: ${req.method}`);
      }
      if (typeof playerId !== 'string') {
        throw new ApiError(400, 'PLAYER_ID_REQUIRED', 'playerId param is required.');
      }
      const restored = await restorePlayer(playerId, security.actorId);
      if (!restored) {
        throw new ApiError(404, 'PLAYER_NOT_FOUND', 'Player not found.');
      }
      ok(res, { data: restored });
      return;
    }

    // Handle /api/players/:playerId
    if (playerId) {
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
    }

    // Handle /api/players
    switch (req.method) {
      case 'GET': {
        const teamId = getRequiredTeamId(req, security.teamIdHeader);
        const includeRemoved =
          typeof req.query.includeRemoved === 'string'
            ? req.query.includeRemoved === 'true'
            : false;
        const players = await listPlayers(teamId, { includeRemoved });
        ok(res, { data: players });
        return;
      }
      case 'POST': {
        const rawBody = await readJsonBody(req);
        if (rawBody === undefined) {
          throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
        }
        const payload = parseWithSchema(createPlayerSchema, rawBody, 'VALIDATION_ERROR');
        const input: CreatePlayerInput = {
          teamId: payload.teamId,
          displayName: payload.displayName,
          preferredPositions: payload.preferredPositions,
          squadNumber: payload.squadNumber ?? null,
          status: payload.status,
          notes: payload.notes ?? null,
          actorId: security.actorId,
        };
        const player = await createPlayer(input);
        created(res, { data: player });
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
