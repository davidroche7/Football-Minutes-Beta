-- Archive last season's data and switch the team over to a new season.
-- Additive/backfill only: no rows are deleted, no columns are dropped.
-- The `season` table and `season_id` foreign keys already existed (0001_init.sql)
-- but no season had ever been created, so every fixture/team row was unset.

-- Last season: covers every existing fixture (all currently NULL season_id).
INSERT INTO season (name, year, starts_on, ends_on)
VALUES ('2025-26', 2025, '2025-08-01', '2026-07-31')
ON CONFLICT (LOWER(name), year) DO NOTHING;

-- New season: current, open-ended.
INSERT INTO season (name, year, starts_on)
VALUES ('2026-27', 2026, '2026-08-01')
ON CONFLICT (LOWER(name), year) DO NOTHING;

-- Backfill: fixtures with no season yet belong to last season.
UPDATE fixture f
SET season_id = s.id
FROM season s
WHERE s.name = '2025-26' AND f.season_id IS NULL;

-- Point the team at the new season, so fixtures created without an explicit
-- season_id default to it via COALESCE(f.season_id, t.season_id) in
-- team_season_summary / player_season_summary.
UPDATE team t
SET season_id = s.id
FROM season s
WHERE s.name = '2026-27';
