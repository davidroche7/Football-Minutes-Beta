-- Football Minutes initial schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enumerations
CREATE TYPE user_role AS ENUM ('coach', 'analyst', 'viewer', 'admin');
CREATE TYPE player_status AS ENUM ('ACTIVE', 'INACTIVE', 'TRIALIST');
CREATE TYPE venue_type AS ENUM ('HOME', 'AWAY', 'NEUTRAL');
CREATE TYPE fixture_status AS ENUM ('DRAFT', 'LOCKED', 'FINAL');
CREATE TYPE fixture_role AS ENUM ('STARTER', 'BENCH');
CREATE TYPE lineup_wave AS ENUM ('FULL', 'FIRST', 'SECOND');
CREATE TYPE lineup_position AS ENUM ('GK', 'DEF', 'ATT');
CREATE TYPE result_code AS ENUM ('WIN', 'DRAW', 'LOSS', 'ABANDONED', 'VOID');
CREATE TYPE award_type AS ENUM ('SCORER', 'HONORABLE_MENTION', 'ASSIST');
CREATE TYPE audit_entity AS ENUM ('PLAYER', 'FIXTURE', 'LINEUP', 'RULESET', 'IMPORT');

-- Users / auth
CREATE TABLE app_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'coach',
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seasons
CREATE TABLE season (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  club TEXT,
  starts_on DATE,
  ends_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX season_name_year_idx ON season (LOWER(name), year);

-- Teams
CREATE TABLE team (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  age_group TEXT,
  season_id UUID REFERENCES season(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX team_name_idx ON team (LOWER(name));

-- Players
CREATE TABLE player (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  preferred_positions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  squad_number INTEGER,
  status player_status NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ
);

CREATE INDEX player_team_idx ON player (team_id);
CREATE UNIQUE INDEX player_team_display_idx ON player (team_id, LOWER(display_name));

-- Fixtures
CREATE TABLE fixture (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  season_id UUID REFERENCES season(id) ON DELETE SET NULL,
  opponent TEXT NOT NULL,
  fixture_date DATE NOT NULL,
  kickoff_time TIME,
  venue_type venue_type NOT NULL DEFAULT 'HOME',
  status fixture_status NOT NULL DEFAULT 'DRAFT',
  created_by UUID REFERENCES app_user(id) ON DELETE SET NULL,
  notes TEXT,
  locked_at TIMESTAMPTZ,
  finalised_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX fixture_team_idx ON fixture (team_id, fixture_date);
CREATE INDEX fixture_season_idx ON fixture (season_id, fixture_date);
CREATE INDEX fixture_status_idx ON fixture (status);

-- Planned squad
CREATE TABLE fixture_player (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID NOT NULL REFERENCES fixture(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  role fixture_role NOT NULL DEFAULT 'STARTER',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX fixture_player_unique_idx ON fixture_player (fixture_id, player_id);

-- Quarter assignments
CREATE TABLE lineup_quarter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID NOT NULL REFERENCES fixture(id) ON DELETE CASCADE,
  quarter_number INTEGER NOT NULL CHECK (quarter_number BETWEEN 1 AND 4),
  wave lineup_wave NOT NULL DEFAULT 'FULL',
  position lineup_position NOT NULL,
  player_id UUID NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  minutes INTEGER NOT NULL CHECK (minutes > 0),
  is_substitution BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX lineup_quarter_fixture_idx ON lineup_quarter (fixture_id, quarter_number);

-- Match result
CREATE TABLE match_result (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID NOT NULL UNIQUE REFERENCES fixture(id) ON DELETE CASCADE,
  result_code result_code NOT NULL,
  team_goals INTEGER,
  opponent_goals INTEGER,
  player_of_match_id UUID REFERENCES player(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Awards (goals, HM, assists)
CREATE TABLE match_award (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID NOT NULL REFERENCES fixture(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  award_type award_type NOT NULL,
  count INTEGER NOT NULL DEFAULT 1 CHECK (count > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX match_award_fixture_idx ON match_award (fixture_id);
CREATE INDEX match_award_player_idx ON match_award (player_id);

-- Aggregated per-player stats
CREATE TABLE player_match_stat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID NOT NULL REFERENCES fixture(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  total_minutes INTEGER NOT NULL DEFAULT 0,
  goalkeeper_quarters INTEGER NOT NULL DEFAULT 0,
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  is_player_of_match BOOLEAN NOT NULL DEFAULT FALSE,
  honorable_mentions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX player_match_stat_unique_idx ON player_match_stat (fixture_id, player_id);

-- Rules configuration
CREATE TABLE ruleset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  config_json JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ruleset_team_idx ON ruleset (team_id, is_active);

CREATE TABLE rule_toggle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_id UUID NOT NULL REFERENCES ruleset(id) ON DELETE CASCADE,
  toggle_key TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX rule_toggle_key_idx ON rule_toggle (ruleset_id, toggle_key);

-- Audit events
CREATE TABLE audit_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  entity_type audit_entity NOT NULL,
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  previous_state JSONB,
  next_state JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_event_entity_idx ON audit_event (entity_type, entity_id);
CREATE INDEX audit_event_actor_idx ON audit_event (actor_id);

-- Derived views
CREATE OR REPLACE VIEW team_season_summary AS
SELECT
  t.id AS team_id,
  COALESCE(f.season_id, t.season_id) AS season_id,
  COUNT(f.*) FILTER (WHERE f.status = 'FINAL') AS played,
  COUNT(f.*) FILTER (WHERE mr.result_code = 'WIN') AS wins,
  COUNT(f.*) FILTER (WHERE mr.result_code = 'DRAW') AS draws,
  COUNT(f.*) FILTER (WHERE mr.result_code = 'LOSS') AS losses,
  COALESCE(SUM(mr.team_goals), 0) AS goals_for,
  COALESCE(SUM(mr.opponent_goals), 0) AS goals_against,
  COALESCE(SUM(mr.team_goals), 0) - COALESCE(SUM(mr.opponent_goals), 0) AS goal_difference,
  MAX(f.updated_at) AS last_updated
FROM team t
LEFT JOIN fixture f ON f.team_id = t.id AND f.status = 'FINAL'
LEFT JOIN match_result mr ON mr.fixture_id = f.id
GROUP BY t.id, COALESCE(f.season_id, t.season_id);

CREATE OR REPLACE VIEW player_season_summary AS
SELECT
  t.id AS team_id,
  COALESCE(f.season_id, t.season_id) AS season_id,
  p.id AS player_id,
  p.display_name,
  COUNT(DISTINCT CASE WHEN f.status = 'FINAL' THEN f.id END) AS appearances,
  COALESCE(SUM(pms.total_minutes), 0) AS total_minutes,
  COALESCE(SUM(pms.goalkeeper_quarters), 0) AS goalkeeper_quarters,
  COALESCE(SUM(pms.goals), 0) AS goals,
  COALESCE(SUM(pms.assists), 0) AS assists,
  COALESCE(SUM(CASE WHEN pms.is_player_of_match THEN 1 ELSE 0 END), 0) AS player_of_match,
  COALESCE(SUM(pms.honorable_mentions), 0) AS honorable_mentions
FROM player p
JOIN team t ON t.id = p.team_id
LEFT JOIN player_match_stat pms ON pms.player_id = p.id
LEFT JOIN fixture f ON f.id = pms.fixture_id AND f.status = 'FINAL'
GROUP BY t.id, COALESCE(f.season_id, t.season_id), p.id, p.display_name;

CREATE OR REPLACE VIEW fixture_timeline AS
SELECT
  lq.fixture_id,
  lq.quarter_number,
  lq.wave,
  lq.position,
  lq.player_id,
  p.display_name AS player_name,
  lq.minutes,
  lq.is_substitution,
  fp.role AS squad_role
FROM lineup_quarter lq
LEFT JOIN player p ON p.id = lq.player_id
LEFT JOIN fixture_player fp ON fp.fixture_id = lq.fixture_id AND fp.player_id = lq.player_id;
