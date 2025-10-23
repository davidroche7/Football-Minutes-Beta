/* eslint-env node */
import type { PoolClient } from 'pg';
import { query, withTransaction } from '../db/client';
import type { PlayerRow, PlayerStatus } from '../db/types';

export interface PlayerDTO {
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

export interface CreatePlayerInput {
  teamId: string;
  displayName: string;
  preferredPositions?: string[];
  squadNumber?: number | null;
  status?: PlayerStatus;
  notes?: string | null;
  actorId?: string | null;
}

export interface UpdatePlayerInput {
  displayName?: string;
  preferredPositions?: string[];
  squadNumber?: number | null;
  status?: PlayerStatus;
  notes?: string | null;
  actorId?: string | null;
}

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

async function recordAudit(
  client: PoolClient,
  entityId: string,
  eventType: string,
  actorId: string | null,
  previousState: unknown,
  nextState: unknown
) {
  await client.query(
    `INSERT INTO audit_event (actor_id, entity_type, entity_id, event_type, previous_state, next_state)
     VALUES ($1, 'PLAYER', $2, $3, $4, $5)`,
    [actorId ?? null, entityId, eventType, previousState ? JSON.stringify(previousState) : null, nextState ? JSON.stringify(nextState) : null]
  );
}

export async function listPlayers(teamId: string, options: { includeRemoved?: boolean } = {}): Promise<PlayerDTO[]> {
  const includeRemoved = options.includeRemoved ?? false;
  const result = await query<PlayerRow>(
    `SELECT * FROM player
     WHERE team_id = $1 AND ($2::boolean OR removed_at IS NULL)
     ORDER BY display_name ASC`,
    [teamId, includeRemoved]
  );
  return result.rows.map(mapPlayer);
}

export async function getPlayer(playerId: string): Promise<PlayerDTO | null> {
  const result = await query<PlayerRow>('SELECT * FROM player WHERE id = $1', [playerId]);
  if (result.rowCount === 0) return null;
  return mapPlayer(result.rows[0]!);
}

export async function createPlayer(input: CreatePlayerInput): Promise<PlayerDTO> {
  const now = new Date().toISOString();
  return withTransaction(async (client) => {
    const insert = await client.query<PlayerRow>(
      `INSERT INTO player (team_id, display_name, preferred_positions, squad_number, status, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING *`,
      [
        input.teamId,
        input.displayName.trim(),
        input.preferredPositions ?? [],
        input.squadNumber ?? null,
        input.status ?? 'ACTIVE',
        input.notes ?? null,
        now,
      ]
    );

    const player = insert.rows[0]!;
    await recordAudit(client, player.id, 'created', input.actorId ?? null, null, player);
    return mapPlayer(player);
  });
}

export async function updatePlayer(playerId: string, updates: UpdatePlayerInput): Promise<PlayerDTO | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  const trimmedName = typeof updates.displayName === 'string' ? updates.displayName.trim() : undefined;
  if (typeof trimmedName === 'string') {
    fields.push(`display_name = $${index++}`);
    values.push(trimmedName);
  }
  if (updates.preferredPositions) {
    fields.push(`preferred_positions = $${index++}`);
    values.push(updates.preferredPositions);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'squadNumber')) {
    fields.push(`squad_number = $${index++}`);
    values.push(updates.squadNumber ?? null);
  }
  if (updates.status) {
    fields.push(`status = $${index++}`);
    values.push(updates.status);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'notes')) {
    fields.push(`notes = $${index++}`);
    values.push(updates.notes ?? null);
  }

  if (fields.length === 0) {
    return getPlayer(playerId);
  }

  fields.push(`updated_at = NOW()`);
  values.push(playerId);
  const previous = await query<PlayerRow>('SELECT * FROM player WHERE id = $1', [playerId]);
  if (previous.rowCount === 0) {
    return null;
  }

  return withTransaction(async (client) => {
    const updateSql = `UPDATE player SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`;
    const updated = await client.query<PlayerRow>(updateSql, values);
    if (updated.rowCount === 0) {
      return null;
    }
    const player = updated.rows[0]!;
    await recordAudit(client, player.id, 'updated', updates.actorId ?? null, previous.rows[0], player);
    return mapPlayer(player);
  });
}

export async function softDeletePlayer(playerId: string, actorId?: string | null): Promise<PlayerDTO | null> {
  const previous = await query<PlayerRow>('SELECT * FROM player WHERE id = $1', [playerId]);
  if (previous.rowCount === 0) return null;

  return withTransaction(async (client) => {
    const result = await client.query<PlayerRow>(
      `UPDATE player
       SET removed_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [playerId]
    );
    const player = result.rows[0]!;
    await recordAudit(client, player.id, 'removed', actorId ?? null, previous.rows[0], player);
    return mapPlayer(player);
  });
}

export async function restorePlayer(playerId: string, actorId?: string | null): Promise<PlayerDTO | null> {
  const previous = await query<PlayerRow>('SELECT * FROM player WHERE id = $1', [playerId]);
  if (previous.rowCount === 0) return null;

  return withTransaction(async (client) => {
    const result = await client.query<PlayerRow>(
      `UPDATE player
       SET removed_at = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [playerId]
    );
    const player = result.rows[0]!;
    await recordAudit(client, player.id, 'restored', actorId ?? null, previous.rows[0], player);
    return mapPlayer(player);
  });
}
