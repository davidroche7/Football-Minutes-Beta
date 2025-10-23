/* eslint-env node */
import type { PoolClient } from 'pg';
import { query, withTransaction } from '../db/client';
import type {
  AwardType,
  FixtureRow,
  FixtureRole,
  FixtureStatus,
  LineupPosition,
  LineupQuarterRow,
  LineupWave,
  MatchAwardRow,
  MatchResultRow,
  PlayerMatchStatRow,
  ResultCode,
} from '../db/types';

interface AuditPayload {
  actorId: string | null;
  previousState: unknown;
  nextState: unknown;
  eventType: string;
  entityId: string;
}

const recordFixtureAudit = async (client: PoolClient, payload: AuditPayload) => {
  await client.query(
    `INSERT INTO audit_event (actor_id, entity_type, entity_id, event_type, previous_state, next_state)
     VALUES ($1, 'FIXTURE', $2, $3, $4, $5)`,
    [
      payload.actorId,
      payload.entityId,
      payload.eventType,
      payload.previousState ? JSON.stringify(payload.previousState) : null,
      payload.nextState ? JSON.stringify(payload.nextState) : null,
    ]
  );
};

export interface FixturePlayerDTO {
  id: string;
  playerId: string;
  displayName: string;
  role: FixtureRole;
  notes: string | null;
  removedAt: string | null;
}

export interface FixtureSummaryDTO {
  id: string;
  teamId: string;
  seasonId: string | null;
  opponent: string;
  fixtureDate: string;
  venueType: string;
  status: FixtureStatus;
  lockedAt: string | null;
  finalisedAt: string | null;
  createdAt: string;
  updatedAt: string;
  result?: {
    resultCode: ResultCode;
    teamGoals: number | null;
    opponentGoals: number | null;
  } | null;
}

export interface LineupSlotDTO {
  id: string;
  quarterNumber: number;
  wave: LineupWave;
  position: LineupPosition;
  playerId: string;
  playerName: string;
  minutes: number;
  isSubstitution: boolean;
  squadRole: FixtureRole | null;
}

export interface MatchAwardDTO {
  id: string;
  playerId: string;
  playerName: string;
  awardType: AwardType;
  count: number;
}

export interface FixtureDetailDTO {
  fixture: FixtureSummaryDTO;
  squad: FixturePlayerDTO[];
  quarters: LineupSlotDTO[];
  result: (MatchResultRow & { player_name: string | null }) | null;
  awards: MatchAwardDTO[];
  stats: PlayerMatchStatRow[];
}

export interface ListFixturesOptions {
  teamId: string;
  seasonId?: string;
  status?: FixtureStatus;
}

export interface CreateFixtureInput {
  teamId: string;
  seasonId?: string | null;
  opponent: string;
  fixtureDate: string;
  venueType: string;
  kickoffTime?: string | null;
  squad: Array<{ playerId: string; role: FixtureRole }>;
  notes?: string | null;
  createdBy: string | null;
}

export interface UpdateFixtureInput {
  opponent?: string;
  fixtureDate?: string;
  venueType?: string;
  kickoffTime?: string | null;
  notes?: string | null;
  seasonId?: string | null;
}

export interface ReplaceLineupInput {
  slots: Array<{
    quarterNumber: number;
    wave: LineupWave;
    position: LineupPosition;
    playerId: string;
    minutes: number;
    isSubstitution?: boolean;
  }>;
}

export interface SetResultInput {
  resultCode: ResultCode;
  teamGoals?: number | null;
  opponentGoals?: number | null;
  playerOfMatchId?: string | null;
  notes?: string | null;
  awards?: Array<{ playerId: string; awardType: AwardType; count?: number }>;
}

const mapFixtureSummary = (row: FixtureRow, resultRow?: MatchResultRow | null): FixtureSummaryDTO => ({
  id: row.id,
  teamId: row.team_id,
  seasonId: row.season_id,
  opponent: row.opponent,
  fixtureDate: row.fixture_date,
  venueType: row.venue_type,
  status: row.status,
  lockedAt: row.locked_at,
  finalisedAt: row.finalised_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  result: resultRow
    ? {
        resultCode: resultRow.result_code,
        teamGoals: resultRow.team_goals ?? null,
        opponentGoals: resultRow.opponent_goals ?? null,
      }
    : null,
});

export async function listFixtures(options: ListFixturesOptions): Promise<FixtureSummaryDTO[]> {
  const params: unknown[] = [options.teamId];
  const filters: string[] = ['f.team_id = $1'];
  if (options.seasonId) {
    params.push(options.seasonId);
    filters.push(`COALESCE(f.season_id, t.season_id) = $${params.length}`);
  }
  if (options.status) {
    params.push(options.status);
    filters.push(`f.status = $${params.length}`);
  }

  const sql = `
    SELECT f.*, mr.*
    FROM fixture f
    JOIN team t ON t.id = f.team_id
    LEFT JOIN match_result mr ON mr.fixture_id = f.id
    WHERE ${filters.join(' AND ')}
    ORDER BY f.fixture_date DESC, f.created_at DESC
  `;
  const result = await query<
    FixtureRow & {
      result_code: ResultCode | null;
      team_goals: number | null;
      opponent_goals: number | null;
    }
  >(sql, params);

  return result.rows.map((row) => {
    const resultRow: MatchResultRow | null =
      row.result_code !== null
        ? {
            id: '',
            fixture_id: row.id,
            result_code: row.result_code as ResultCode,
            team_goals: row.team_goals,
            opponent_goals: row.opponent_goals,
            player_of_match_id: null,
            notes: null,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }
        : null;
    return mapFixtureSummary(row, resultRow);
  });
}

export async function getFixtureDetail(fixtureId: string): Promise<FixtureDetailDTO | null> {
  const fixtureResult = await query<FixtureRow>('SELECT * FROM fixture WHERE id = $1', [fixtureId]);
  if (fixtureResult.rowCount === 0) {
    return null;
  }

  const fixture = fixtureResult.rows[0]!;

  const [squadResult, lineupResult, matchResult, awardsResult, statsResult] = await Promise.all([
    query<
      {
        fp_id: string;
        role: FixtureRole;
        notes: string | null;
        player_id: string;
        display_name: string;
        removed_at: string | null;
      }
    >(
      `SELECT fp.id as fp_id, fp.role, fp.notes, p.id as player_id, p.display_name, p.removed_at
       FROM fixture_player fp
       JOIN player p ON p.id = fp.player_id
       WHERE fp.fixture_id = $1
       ORDER BY p.display_name ASC`,
      [fixtureId]
    ),
    query<
      LineupQuarterRow & {
        player_name: string;
        squad_role: FixtureRole | null;
      }
    >(
      `SELECT lq.*, p.display_name AS player_name, fp.role AS squad_role
       FROM lineup_quarter lq
       JOIN player p ON p.id = lq.player_id
       LEFT JOIN fixture_player fp ON fp.fixture_id = lq.fixture_id AND fp.player_id = lq.player_id
       WHERE lq.fixture_id = $1
       ORDER BY lq.quarter_number ASC, lq.position ASC`,
      [fixtureId]
    ),
    query<
      MatchResultRow & {
        player_name: string | null;
      }
    >(
      `SELECT mr.*, p.display_name AS player_name
       FROM match_result mr
       LEFT JOIN player p ON p.id = mr.player_of_match_id
       WHERE mr.fixture_id = $1`,
      [fixtureId]
    ),
    query<
      MatchAwardRow & {
        player_name: string;
      }
    >(
      `SELECT ma.*, p.display_name AS player_name
       FROM match_award ma
       JOIN player p ON p.id = ma.player_id
       WHERE ma.fixture_id = $1`,
      [fixtureId]
    ),
    query<PlayerMatchStatRow>('SELECT * FROM player_match_stat WHERE fixture_id = $1', [fixtureId]),
  ]);

  const summary = mapFixtureSummary(fixture, matchResult.rows[0] ?? null);

  const squad: FixturePlayerDTO[] = squadResult.rows.map((row) => ({
    id: row.fp_id,
    playerId: row.player_id,
    displayName: row.display_name,
    role: row.role,
    notes: row.notes,
    removedAt: row.removed_at,
  }));

  const lineup: LineupSlotDTO[] = lineupResult.rows.map((row) => ({
    id: row.id,
    quarterNumber: row.quarter_number,
    wave: row.wave,
    position: row.position,
    playerId: row.player_id,
    playerName: row.player_name,
    minutes: row.minutes,
    isSubstitution: row.is_substitution,
    squadRole: row.squad_role ?? null,
  }));

  const awards: MatchAwardDTO[] = awardsResult.rows.map((row) => ({
    id: row.id,
    playerId: row.player_id,
    playerName: row.player_name,
    awardType: row.award_type,
    count: row.count,
  }));

  return {
    fixture: summary,
    squad,
    quarters: lineup,
    result: matchResult.rows[0] ?? null,
    awards,
    stats: statsResult.rows,
  };
}

interface AggregatedPlayerStat {
  totalMinutes: number;
  goalkeeperQuarters: number;
  goals: number;
  assists: number;
  honorableMentions: number;
  isPlayerOfMatch: boolean;
}

const ensurePlayerStat = (
  map: Map<string, AggregatedPlayerStat>,
  playerId: string
): AggregatedPlayerStat => {
  let stat = map.get(playerId);
  if (!stat) {
    stat = {
      totalMinutes: 0,
      goalkeeperQuarters: 0,
      goals: 0,
      assists: 0,
      honorableMentions: 0,
      isPlayerOfMatch: false,
    };
    map.set(playerId, stat);
  }
  return stat;
};

export async function createFixture(input: CreateFixtureInput): Promise<FixtureSummaryDTO> {
  return withTransaction(async (client) => {
    const insertFixture = await client.query<FixtureRow>(
      `INSERT INTO fixture (team_id, season_id, opponent, fixture_date, venue_type, kickoff_time, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.teamId,
        input.seasonId ?? null,
        input.opponent.trim(),
        input.fixtureDate,
        input.venueType,
        input.kickoffTime ?? null,
        input.notes ?? null,
        input.createdBy,
      ]
    );

    const fixture = insertFixture.rows[0]!;

    if (input.squad.length > 0) {
      const values: unknown[] = [];
      const placeholders: string[] = [];
      input.squad.forEach((player, index) => {
        values.push(fixture.id, player.playerId, player.role, null);
        const offset = index * 4;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
      });

      await client.query(
        `INSERT INTO fixture_player (fixture_id, player_id, role, notes)
         VALUES ${placeholders.join(', ')}`,
        values
      );
    }

    await recordFixtureAudit(client, {
      actorId: input.createdBy ?? null,
      entityId: fixture.id,
      eventType: 'created',
      previousState: null,
      nextState: fixture,
    });

    return mapFixtureSummary(fixture, null);
  });
}

export async function updateFixtureMetadata(
  fixtureId: string,
  actorId: string | null,
  updates: UpdateFixtureInput
): Promise<FixtureSummaryDTO | null> {
  const fields: string[] = [];
  const params: unknown[] = [];

  if (typeof updates.opponent === 'string') {
    fields.push(`opponent = $${params.length + 1}`);
    params.push(updates.opponent.trim());
  }
  if (typeof updates.fixtureDate === 'string') {
    fields.push(`fixture_date = $${params.length + 1}`);
    params.push(updates.fixtureDate);
  }
  if (typeof updates.venueType === 'string') {
    fields.push(`venue_type = $${params.length + 1}`);
    params.push(updates.venueType);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'kickoffTime')) {
    fields.push(`kickoff_time = $${params.length + 1}`);
    params.push(updates.kickoffTime ?? null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'notes')) {
    fields.push(`notes = $${params.length + 1}`);
    params.push(updates.notes ?? null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'seasonId')) {
    fields.push(`season_id = $${params.length + 1}`);
    params.push(updates.seasonId ?? null);
  }

  if (fields.length === 0) {
    const current = await getFixtureDetail(fixtureId);
    return current ? current.fixture : null;
  }

  return withTransaction(async (client) => {
    const existing = await client.query<FixtureRow>('SELECT * FROM fixture WHERE id = $1', [fixtureId]);
    if (existing.rowCount === 0) {
      return null;
    }

    fields.push(`updated_at = NOW()`);
    params.push(fixtureId);

    const updateSql = `UPDATE fixture SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`;
    const updated = await client.query<FixtureRow>(updateSql, params);
    if (updated.rowCount === 0) return null;

    const fixture = updated.rows[0]!;
    await recordFixtureAudit(client, {
      actorId,
      entityId: fixture.id,
      eventType: 'updated',
      previousState: existing.rows[0],
      nextState: fixture,
    });

    return mapFixtureSummary(fixture, null);
  });
}

export async function replaceFixtureLineup(
  fixtureId: string,
  actorId: string | null,
  input: ReplaceLineupInput
): Promise<LineupSlotDTO[]> {
  return withTransaction(async (client) => {
    await client.query('DELETE FROM lineup_quarter WHERE fixture_id = $1', [fixtureId]);

    if (input.slots.length > 0) {
      const values: unknown[] = [];
      const placeholders: string[] = [];
      input.slots.forEach((slot, index) => {
        values.push(
          fixtureId,
          slot.quarterNumber,
          slot.wave,
          slot.position,
          slot.playerId,
          slot.minutes,
          slot.isSubstitution ?? false
        );
        const offset = index * 7;
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`
        );
      });

      await client.query(
        `INSERT INTO lineup_quarter (fixture_id, quarter_number, wave, position, player_id, minutes, is_substitution)
         VALUES ${placeholders.join(', ')}`,
        values
      );
    }

    await recordFixtureAudit(client, {
      actorId,
      entityId: fixtureId,
      eventType: 'lineup_replaced',
      previousState: null,
      nextState: input.slots,
    });

    const lineup = await query<
      LineupQuarterRow & {
        player_name: string;
        squad_role: FixtureRole | null;
      }
    >(
      `SELECT lq.*, p.display_name AS player_name, fp.role AS squad_role
       FROM lineup_quarter lq
       JOIN player p ON p.id = lq.player_id
       LEFT JOIN fixture_player fp ON fp.fixture_id = lq.fixture_id AND fp.player_id = lq.player_id
       WHERE lq.fixture_id = $1
       ORDER BY lq.quarter_number ASC, lq.position ASC`,
      [fixtureId]
    );

    return lineup.rows.map((row) => ({
      id: row.id,
      quarterNumber: row.quarter_number,
      wave: row.wave,
      position: row.position,
      playerId: row.player_id,
      playerName: row.player_name,
      minutes: row.minutes,
      isSubstitution: row.is_substitution,
      squadRole: row.squad_role ?? null,
    }));
  });
}

export async function lockFixture(fixtureId: string, actorId: string | null): Promise<FixtureSummaryDTO | null> {
  return withTransaction(async (client) => {
    const existing = await client.query<FixtureRow>('SELECT * FROM fixture WHERE id = $1', [fixtureId]);
    if (existing.rowCount === 0) return null;

    const fixture = existing.rows[0]!;
    if (fixture.status === 'LOCKED' || fixture.status === 'FINAL') {
      return mapFixtureSummary(fixture, null);
    }

    const updated = await client.query<FixtureRow>(
      `UPDATE fixture
       SET status = 'LOCKED', locked_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [fixtureId]
    );
    const locked = updated.rows[0]!;

    await recordFixtureAudit(client, {
      actorId,
      entityId: fixtureId,
      eventType: 'locked',
      previousState: existing.rows[0],
      nextState: locked,
    });

    return mapFixtureSummary(locked, null);
  });
}

export async function setFixtureResult(
  fixtureId: string,
  actorId: string | null,
  input: SetResultInput
): Promise<FixtureSummaryDTO | null> {
  return withTransaction(async (client) => {
    const existingFixture = await client.query<FixtureRow>('SELECT * FROM fixture WHERE id = $1', [fixtureId]);
    if (existingFixture.rowCount === 0) return null;

    const resultUpsert = await client.query<MatchResultRow>(
      `INSERT INTO match_result (fixture_id, result_code, team_goals, opponent_goals, player_of_match_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (fixture_id)
       DO UPDATE SET
         result_code = EXCLUDED.result_code,
         team_goals = EXCLUDED.team_goals,
         opponent_goals = EXCLUDED.opponent_goals,
         player_of_match_id = EXCLUDED.player_of_match_id,
         notes = EXCLUDED.notes,
         updated_at = NOW()
       RETURNING *`,
      [
        fixtureId,
        input.resultCode,
        input.teamGoals ?? null,
        input.opponentGoals ?? null,
        input.playerOfMatchId ?? null,
        input.notes ?? null,
      ]
    );

    await client.query('DELETE FROM match_award WHERE fixture_id = $1', [fixtureId]);
    if (input.awards && input.awards.length > 0) {
      const values: unknown[] = [];
      const placeholders: string[] = [];
      input.awards.forEach((award, index) => {
        values.push(fixtureId, award.playerId, award.awardType, award.count ?? 1);
        const offset = index * 4;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
      });
      await client.query(
        `INSERT INTO match_award (fixture_id, player_id, award_type, count) VALUES ${placeholders.join(', ')}`,
        values
      );
    }

    const fixtureUpdate = await client.query<FixtureRow>(
      `UPDATE fixture
       SET status = 'FINAL', finalised_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [fixtureId]
    );

    const lineupRows = await client.query<LineupQuarterRow>(
      `SELECT * FROM lineup_quarter WHERE fixture_id = $1`,
      [fixtureId]
    );

    const awardRows = await client.query<MatchAwardRow>(
      `SELECT * FROM match_award WHERE fixture_id = $1`,
      [fixtureId]
    );

    const statsByPlayer = new Map<string, AggregatedPlayerStat>();

    lineupRows.rows.forEach((row) => {
      const stat = ensurePlayerStat(statsByPlayer, row.player_id);
      stat.totalMinutes += row.minutes;
      if (row.position === 'GK' && !row.is_substitution) {
        stat.goalkeeperQuarters += 1;
      }
    });

    awardRows.rows.forEach((row) => {
      const stat = ensurePlayerStat(statsByPlayer, row.player_id);
      if (row.award_type === 'SCORER') {
        stat.goals += row.count;
      } else if (row.award_type === 'ASSIST') {
        stat.assists += row.count;
      } else if (row.award_type === 'HONORABLE_MENTION') {
        stat.honorableMentions += row.count;
      }
    });

    const resultRow = resultUpsert.rows[0]!;
    if (resultRow.player_of_match_id) {
      const stat = ensurePlayerStat(statsByPlayer, resultRow.player_of_match_id);
      stat.isPlayerOfMatch = true;
    }

    await client.query('DELETE FROM player_match_stat WHERE fixture_id = $1', [fixtureId]);
    if (statsByPlayer.size > 0) {
      const values: unknown[] = [];
      const placeholders: string[] = [];
      let index = 0;
      statsByPlayer.forEach((stat, playerId) => {
        values.push(
          fixtureId,
          playerId,
          stat.totalMinutes,
          stat.goalkeeperQuarters,
          stat.goals,
          stat.assists,
          stat.isPlayerOfMatch,
          stat.honorableMentions
        );
        const offset = index * 8;
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`
        );
        index += 1;
      });

      await client.query(
        `INSERT INTO player_match_stat (fixture_id, player_id, total_minutes, goalkeeper_quarters, goals, assists, is_player_of_match, honorable_mentions)
         VALUES ${placeholders.join(', ')}`,
        values
      );
    }

    await recordFixtureAudit(client, {
      actorId,
      entityId: fixtureId,
      eventType: 'result_set',
      previousState: existingFixture.rows[0],
      nextState: fixtureUpdate.rows[0],
    });

    return mapFixtureSummary(fixtureUpdate.rows[0]!, resultUpsert.rows[0]!);
  });
}
