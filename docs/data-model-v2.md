# Football Minutes Domain Model (Phase 2)

## Overview

Goal: support end-to-end workflow (Player Admin → Pick a Team → Post-Match stats → Rules visibility) on a secure, persistent backend. The model below supersedes `docs/data-model.json` once implemented.

## Entities

### Team
- `id` (uuid, pk)
- `name` (text, unique)
- `age_group` (text)
- `season_id` (uuid, fk -> Season)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### Season
- `id` (uuid, pk)
- `name` (text)
- `year` (integer)
- `club` (text, optional)
- `starts_on` (date, optional)
- `ends_on` (date, optional)
- `created_at` (timestamptz)

### Player
- `id` (uuid, pk)
- `team_id` (uuid, fk -> Team)
- `display_name` (text)
- `preferred_positions` (text[], default `{}`)
- `squad_number` (integer, optional)
- `status` (enum: ACTIVE, INACTIVE, TRIALIST)
- `notes` (text, optional)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- `removed_at` (timestamptz, nullable)

### Fixture
- `id` (uuid, pk)
- `team_id` (uuid, fk -> Team)
- `season_id` (uuid, fk -> Season)
- `opponent` (text)
- `fixture_date` (date)
- `kickoff_time` (time, optional)
- `venue_type` (enum: HOME, AWAY, NEUTRAL)
- `status` (enum: DRAFT, LOCKED, FINAL)
- `created_by` (uuid, fk -> User)
- `locked_at` (timestamptz, nullable)
- `finalised_at` (timestamptz, nullable)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### FixturePlayer (planned squad)
- `id` (uuid, pk)
- `fixture_id` (uuid, fk -> Fixture)
- `player_id` (uuid, fk -> Player)
- `role` (enum: STARTER, BENCH)
- `notes` (text, optional)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### LineupQuarter
- `id` (uuid, pk)
- `fixture_id` (uuid, fk -> Fixture)
- `quarter_number` (integer 1-4)
- `wave` (enum: FULL, FIRST, SECOND)  _allows 5+5 split_
- `position` (enum: GK, DEF, ATT)
- `player_id` (uuid, fk -> Player)
- `minutes` (integer)
- `is_substitution` (boolean, default false)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### MatchResult
- `id` (uuid, pk)
- `fixture_id` (uuid, fk -> Fixture)
- `result_code` (enum: WIN, DRAW, LOSS, ABANDONED, VOID)
- `team_goals` (integer, nullable)
- `opponent_goals` (integer, nullable)
- `player_of_match_id` (uuid, fk -> Player, nullable)
- `notes` (text, optional)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### MatchAward
- `id` (uuid, pk)
- `fixture_id` (uuid, fk -> Fixture)
- `player_id` (uuid, fk -> Player)
- `award_type` (enum: SCORER, HONORABLE_MENTION, ASSIST)
- `count` (integer, default 1)
- `created_at` (timestamptz)

### PlayerMatchStat
- `id` (uuid, pk)
- `fixture_id` (uuid, fk -> Fixture)
- `player_id` (uuid, fk -> Player)
- `total_minutes` (integer)
- `goalkeeper_quarters` (integer)
- `goals` (integer)
- `assists` (integer)
- `is_player_of_match` (boolean)
- `honorable_mentions` (integer)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### Ruleset
- `id` (uuid, pk)
- `team_id` (uuid, fk -> Team)
- `name` (text)
- `config_json` (jsonb)  _current RuleConfig_
- `is_active` (boolean)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### RuleToggle
- `id` (uuid, pk)
- `ruleset_id` (uuid, fk -> Ruleset)
- `toggle_key` (text)
- `description` (text)
- `enabled` (boolean)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### AuditEvent
- `id` (uuid, pk)
- `actor_id` (uuid, fk -> User)
- `entity_type` (enum: PLAYER, FIXTURE, LINEUP, RULESET, IMPORT)
- `entity_id` (uuid)
- `event_type` (text)
- `previous_state` (jsonb)
- `next_state` (jsonb)
- `metadata` (jsonb)
- `created_at` (timestamptz)

## Relationships Summary
- `Season` 1..* `Team`
- `Team` 1..* `Player`
- `Team` 1..* `Fixture`
- `Fixture` 1..1 `MatchResult`
- `Fixture` 1..* `FixturePlayer`
- `Fixture` 1..* `LineupQuarter`
- `Fixture` 1..* `PlayerMatchStat`
- `Fixture` 1..* `MatchAward`
- `Ruleset` 1..* `RuleToggle`
- All entities emit `AuditEvent` on mutation.

## Derived Views
- **TeamSeasonSummary**: aggregate matches played, wins, goals for/against (supports Home screen).
- **PlayerSeasonSummary**: aggregates PlayerMatchStat + MatchAward counts for Team Stats page.
- **FixtureTimeline**: joins LineupQuarter with FixturePlayer to power the expandable quarters UI.
