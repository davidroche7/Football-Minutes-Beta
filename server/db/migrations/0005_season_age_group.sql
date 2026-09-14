-- A team ages up every year, so age group belongs to the season, not the
-- team. Additive only: new nullable column, and a one-time backfill for the
-- two seasons created in 0003 (2025-26 was Girls U8, 2026-27 is Girls U9).

ALTER TABLE season ADD COLUMN IF NOT EXISTS age_group TEXT;

UPDATE season SET age_group = 'Girls U8' WHERE name = '2025-26' AND age_group IS NULL;
UPDATE season SET age_group = 'Girls U9' WHERE name = '2026-27' AND age_group IS NULL;
