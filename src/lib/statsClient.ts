import { TEAM_ID } from '../config/environment';
import { apiRequest } from './apiClient';

export interface TeamStats {
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

export interface PlayerStats {
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

interface StatsRequestOptions {
  teamId?: string;
  seasonId?: string | null;
  signal?: AbortSignal;
}

const resolveTeamId = (explicit?: string) => {
  const teamId = explicit ?? TEAM_ID;
  if (!teamId) {
    throw new Error('TEAM_ID environment variable is required for stats API operations.');
  }
  return teamId;
};

export async function fetchTeamStats(options: StatsRequestOptions = {}): Promise<TeamStats | null> {
  const teamId = resolveTeamId(options.teamId);
  const response = await apiRequest<{ data: TeamStats | null }>('/stats/team', {
    query: {
      teamId,
      seasonId: options.seasonId ?? undefined,
    },
    signal: options.signal,
  });
  return response?.data ?? null;
}

export async function fetchPlayerStats(options: StatsRequestOptions = {}): Promise<PlayerStats[]> {
  const teamId = resolveTeamId(options.teamId);
  const response = await apiRequest<{ data: PlayerStats[] }>('/stats/players', {
    query: {
      teamId,
      seasonId: options.seasonId ?? undefined,
    },
    signal: options.signal,
  });
  return Array.isArray(response?.data) ? response.data : [];
}
