-- Reds / Blacks squads (split mid 2026-27 season).
-- Additive only: a new enum type and two new nullable columns. No existing row
-- is changed or deleted; every existing player and fixture is left NULL.
--   player.squad_group  NULL = not tagged yet (treated as eligible for both)
--   fixture.squad_group NULL = played before the split (counts under Overall only)
-- Idempotent: safe to re-run.

DO $$
BEGIN
  CREATE TYPE squad_group AS ENUM ('REDS', 'BLACKS', 'BOTH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE player ADD COLUMN IF NOT EXISTS squad_group squad_group;
ALTER TABLE fixture ADD COLUMN IF NOT EXISTS squad_group squad_group;

-- A match is played by one squad, never "both".
DO $$
BEGIN
  ALTER TABLE fixture
    ADD CONSTRAINT fixture_squad_not_both CHECK (squad_group IS NULL OR squad_group <> 'BOTH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
