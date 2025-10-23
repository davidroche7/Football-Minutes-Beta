/* eslint-env node */
import { query } from '../db/client';

export interface TeamSeasonSummary {
  teamId: string;
  seasonId: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  lastUpdated: string | null;
}

export interface PlayerSeasonSummary {
  teamId: string;
  seasonId: string | null;
  playerId: string;
  displayName: string;
  appearances: number;
  totalMinutes: number;
  goalkeeperQuarters: number;
  goals: number;
  assists: number;
  playerOfMatch: number;
  honorableMentions: number;
}

export async function getTeamSeasonSummary(
  teamId: string,
  seasonId?: string | null
): Promise<TeamSeasonSummary | null> {
  const params: unknown[] = [teamId];
  const conditions: string[] = ['team_id = $1'];
  if (seasonId) {
    params.push(seasonId);
    conditions.push(`season_id = $${params.length}`);
  }

  const sql = `
    SELECT team_id, season_id, played, wins, draws, losses, goals_for, goals_against, goal_difference, last_updated
    FROM team_season_summary
    WHERE ${conditions.join(' AND ')}
    ORDER BY last_updated DESC NULLS LAST, season_id DESC NULLS LAST
    LIMIT 1
  `;

  const result = await query<{
    team_id: string;
    season_id: string | null;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goals_for: number;
    goals_against: number;
    goal_difference: number;
    last_updated: string | null;
  }>(sql, params);

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0]!;
  return {
    teamId: row.team_id,
    seasonId: row.season_id,
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    goalDifference: row.goal_difference,
    lastUpdated: row.last_updated,
  };
}

export async function getPlayerSeasonSummary(
  teamId: string,
  seasonId?: string | null
): Promise<PlayerSeasonSummary[]> {
  const params: unknown[] = [teamId];
  const conditions: string[] = ['team_id = $1'];
  if (seasonId) {
    params.push(seasonId);
    conditions.push(`season_id = $${params.length}`);
  }

  const sql = `
    SELECT team_id, season_id, player_id, display_name, appearances, total_minutes, goalkeeper_quarters,
           goals, assists, player_of_match, honorable_mentions
    FROM player_season_summary
    WHERE ${conditions.join(' AND ')}
    ORDER BY display_name ASC
  `;

  const result = await query<{
    team_id: string;
    season_id: string | null;
    player_id: string;
    display_name: string;
    appearances: number;
    total_minutes: number;
    goalkeeper_quarters: number;
    goals: number;
    assists: number;
    player_of_match: number;
    honorable_mentions: number;
  }>(sql, params);

  return result.rows.map((row) => ({
    teamId: row.team_id,
    seasonId: row.season_id,
    playerId: row.player_id,
    displayName: row.display_name,
    appearances: row.appearances,
    totalMinutes: row.total_minutes,
    goalkeeperQuarters: row.goalkeeper_quarters,
    goals: row.goals,
    assists: row.assists,
    playerOfMatch: row.player_of_match,
    honorableMentions: row.honorable_mentions,
  }));
}
