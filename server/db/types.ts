export type UserRole = 'coach' | 'analyst' | 'viewer' | 'admin';

export type PlayerStatus = 'ACTIVE' | 'INACTIVE' | 'TRIALIST';
export type VenueType = 'HOME' | 'AWAY' | 'NEUTRAL';
export type FixtureStatus = 'DRAFT' | 'LOCKED' | 'FINAL';
export type FixtureRole = 'STARTER' | 'BENCH';
export type LineupWave = 'FULL' | 'FIRST' | 'SECOND';
export type LineupPosition = 'GK' | 'DEF' | 'ATT';
export type ResultCode = 'WIN' | 'DRAW' | 'LOSS' | 'ABANDONED' | 'VOID';
export type AwardType = 'SCORER' | 'HONORABLE_MENTION' | 'ASSIST';
export type AuditEntity = 'PLAYER' | 'FIXTURE' | 'LINEUP' | 'RULESET' | 'IMPORT';

export interface SeasonRow {
  id: string;
  name: string;
  year: number;
  club: string | null;
  starts_on: string | null;
  ends_on: string | null;
  created_at: string;
}

export interface TeamRow {
  id: string;
  name: string;
  age_group: string | null;
  season_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerRow {
  id: string;
  team_id: string;
  display_name: string;
  preferred_positions: string[];
  squad_number: number | null;
  status: PlayerStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
}

export interface FixtureRow {
  id: string;
  team_id: string;
  season_id: string | null;
  opponent: string;
  fixture_date: string;
  kickoff_time: string | null;
  venue_type: VenueType;
  status: FixtureStatus;
  created_by: string | null;
  notes: string | null;
  locked_at: string | null;
  finalised_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FixturePlayerRow {
  id: string;
  fixture_id: string;
  player_id: string;
  role: FixtureRole;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LineupQuarterRow {
  id: string;
  fixture_id: string;
  quarter_number: number;
  wave: LineupWave;
  position: LineupPosition;
  player_id: string;
  minutes: number;
  is_substitution: boolean;
  created_at: string;
  updated_at: string;
}

export interface MatchResultRow {
  id: string;
  fixture_id: string;
  result_code: ResultCode;
  team_goals: number | null;
  opponent_goals: number | null;
  player_of_match_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchAwardRow {
  id: string;
  fixture_id: string;
  player_id: string;
  award_type: AwardType;
  count: number;
  created_at: string;
}

export interface PlayerMatchStatRow {
  id: string;
  fixture_id: string;
  player_id: string;
  total_minutes: number;
  goalkeeper_quarters: number;
  goals: number;
  assists: number;
  is_player_of_match: boolean;
  honorable_mentions: number;
  created_at: string;
  updated_at: string;
}

export interface RulesetRow {
  id: string;
  team_id: string;
  name: string;
  config_json: unknown;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuleToggleRow {
  id: string;
  ruleset_id: string;
  toggle_key: string;
  description: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditEventRow {
  id: string;
  actor_id: string | null;
  entity_type: AuditEntity;
  entity_id: string;
  event_type: string;
  previous_state: unknown;
  next_state: unknown;
  metadata: unknown;
  created_at: string;
}
