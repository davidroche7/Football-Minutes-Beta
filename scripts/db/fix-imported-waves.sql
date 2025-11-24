/**
 * One-off migration: Fix imported fixtures with incorrect wave assignments
 *
 * Problem: Imported fixtures have wave='FULL' for outfield players (DEF/ATT)
 * instead of being split into FIRST (5 min) + SECOND (5 min) waves.
 *
 * Solution: For each affected row, delete the FULL wave record and insert
 * two new records with FIRST and SECOND waves.
 *
 * Safety: Idempotent - can be run multiple times safely. Only affects rows
 * matching the exact criteria (wave='FULL', position NOT 'GK', minutes=10).
 *
 * Usage:
 *   psql $DATABASE_URL -f scripts/db/fix-imported-waves.sql
 *
 * Or with Railway CLI:
 *   railway run psql -f scripts/db/fix-imported-waves.sql
 */

-- Start transaction
BEGIN;

-- =======================
-- PRE-MIGRATION VERIFICATION
-- =======================

\echo ''
\echo '============================================'
\echo 'PRE-MIGRATION ANALYSIS'
\echo '============================================'
\echo ''

\echo '--- Affected Rows (will be fixed) ---'
SELECT
    f.fixture_date,
    f.opponent,
    lq.quarter_number,
    lq.wave,
    lq.position,
    p.display_name,
    lq.minutes,
    lq.id as row_id
FROM lineup_quarter lq
JOIN fixture f ON f.id = lq.fixture_id
JOIN player p ON p.id = lq.player_id
WHERE lq.wave = 'FULL'
  AND lq.position != 'GK'
  AND lq.minutes = 10
ORDER BY f.fixture_date, lq.quarter_number, lq.position, p.display_name;

\echo ''
\echo '--- Count by Fixture ---'
SELECT
    f.id,
    f.fixture_date,
    f.opponent,
    COUNT(*) as bad_rows
FROM lineup_quarter lq
JOIN fixture f ON f.id = lq.fixture_id
WHERE lq.wave = 'FULL'
  AND lq.position != 'GK'
  AND lq.minutes = 10
GROUP BY f.id, f.fixture_date, f.opponent
ORDER BY f.fixture_date;

\echo ''
\echo '--- Summary ---'
SELECT
    COUNT(*) as total_affected_rows,
    COUNT(DISTINCT fixture_id) as affected_fixtures
FROM lineup_quarter
WHERE wave = 'FULL'
  AND position != 'GK'
  AND minutes = 10;

\echo ''
\echo '============================================'
\echo 'EXECUTING MIGRATION'
\echo '============================================'
\echo ''

-- =======================
-- MIGRATION: Fix the waves
-- =======================

-- Create temporary table to store rows that need fixing
CREATE TEMP TABLE rows_to_fix AS
SELECT
    lq.id,
    lq.fixture_id,
    lq.quarter_number,
    lq.position,
    lq.player_id,
    lq.is_substitution,
    lq.created_at,
    lq.updated_at
FROM lineup_quarter lq
WHERE lq.wave = 'FULL'
  AND lq.position != 'GK'
  AND lq.minutes = 10;

-- Report how many rows will be fixed
\echo 'Rows to fix:'
SELECT COUNT(*) FROM rows_to_fix;

-- Delete the incorrect FULL wave rows
DELETE FROM lineup_quarter
WHERE id IN (SELECT id FROM rows_to_fix);

\echo 'Deleted FULL wave rows'

-- Insert FIRST wave (5 minutes) for each deleted row
INSERT INTO lineup_quarter (
    id,
    fixture_id,
    quarter_number,
    wave,
    position,
    player_id,
    minutes,
    is_substitution,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    fixture_id,
    quarter_number,
    'FIRST'::lineup_wave,
    position,
    player_id,
    5,
    is_substitution,
    created_at,
    NOW()
FROM rows_to_fix;

\echo 'Inserted FIRST wave rows (5 minutes each)'

-- Insert SECOND wave (5 minutes) for each deleted row
INSERT INTO lineup_quarter (
    id,
    fixture_id,
    quarter_number,
    wave,
    position,
    player_id,
    minutes,
    is_substitution,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    fixture_id,
    quarter_number,
    'SECOND'::lineup_wave,
    position,
    player_id,
    5,
    is_substitution,
    created_at,
    NOW()
FROM rows_to_fix;

\echo 'Inserted SECOND wave rows (5 minutes each)'

-- Clean up temp table
DROP TABLE rows_to_fix;

-- =======================
-- POST-MIGRATION VERIFICATION
-- =======================

\echo ''
\echo '============================================'
\echo 'POST-MIGRATION VERIFICATION'
\echo '============================================'
\echo ''

\echo '--- Any remaining FULL wave outfield players? (should be 0) ---'
SELECT COUNT(*) as remaining_bad_rows
FROM lineup_quarter
WHERE wave = 'FULL'
  AND position != 'GK';

\echo ''
\echo '--- Wave distribution for all fixtures ---'
SELECT
    wave,
    position,
    COUNT(*) as count,
    AVG(minutes) as avg_minutes
FROM lineup_quarter
GROUP BY wave, position
ORDER BY wave, position;

\echo ''
\echo '--- Sample fixture lineup (first fixture by date) ---'
WITH first_fixture AS (
    SELECT id
    FROM fixture
    ORDER BY fixture_date
    LIMIT 1
)
SELECT
    f.fixture_date,
    f.opponent,
    lq.quarter_number,
    lq.wave,
    lq.position,
    p.display_name,
    lq.minutes
FROM lineup_quarter lq
JOIN fixture f ON f.id = lq.fixture_id
JOIN player p ON p.id = lq.player_id
WHERE lq.fixture_id = (SELECT id FROM first_fixture)
ORDER BY lq.quarter_number, lq.wave, lq.position, p.display_name;

\echo ''
\echo '--- Verify total minutes per player per fixture (should still be same) ---'
SELECT
    f.fixture_date,
    f.opponent,
    p.display_name,
    SUM(lq.minutes) as total_minutes
FROM lineup_quarter lq
JOIN fixture f ON f.id = lq.fixture_id
JOIN player p ON p.id = lq.player_id
GROUP BY f.id, f.fixture_date, f.opponent, p.id, p.display_name
HAVING SUM(lq.minutes) != 10
ORDER BY f.fixture_date, total_minutes DESC
LIMIT 20;

\echo ''
\echo '============================================'
\echo 'MIGRATION SUMMARY'
\echo '============================================'
\echo ''
\echo 'Migration completed successfully!'
\echo 'Review the verification results above.'
\echo ''
\echo 'If everything looks correct, type: COMMIT;'
\echo 'If you want to undo changes, type: ROLLBACK;'
\echo ''

-- Transaction remains open - user must commit or rollback
-- END; -- Commented out - user should commit manually after review
