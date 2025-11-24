# Wave Migration: Fix Imported Fixtures

## Problem

Imported fixtures have incorrect wave assignments in the `lineup_quarter` table:
- **Bad:** Outfield players (DEF/ATT) have `wave='FULL'` with `minutes=10`
- **Good:** Outfield players should have TWO rows: `wave='FIRST'` (5min) + `wave='SECOND'` (5min)

This causes the Season Stats UI to display imported fixtures as a single "Other Players" block instead of properly grouped waves (0-5 min, 5-10 min).

## Solution

This one-off migration script:
1. Identifies all `lineup_quarter` rows with `wave='FULL'`, `position != 'GK'`, `minutes=10`
2. Deletes each incorrect row
3. Inserts two new rows: one with `wave='FIRST'` (5min), one with `wave='SECOND'` (5min)
4. Preserves all other data (player, fixture, quarter, position, timestamps)

## Safety Features

✅ **Idempotent**: Safe to run multiple times (only affects rows matching exact criteria)
✅ **Transaction-wrapped**: All changes in a single transaction
✅ **Pre/post verification**: Shows exactly what will change and confirms results
✅ **Dry-run mode**: Preview changes without modifying data
✅ **Manual commit**: Won't commit unless you explicitly approve

## Usage

### Option 1: Node.js Script (Recommended)

**Dry-run (preview changes):**
```bash
node scripts/db/fix-imported-waves.mjs --dry-run
```

**Execute with manual review:**
```bash
node scripts/db/fix-imported-waves.mjs
# Review output, then run again with --auto-commit if satisfied
```

**Execute with auto-commit:**
```bash
node scripts/db/fix-imported-waves.mjs --auto-commit
```

### Option 2: Raw SQL Script

```bash
# Local PostgreSQL
psql $DATABASE_URL -f scripts/db/fix-imported-waves.sql

# Railway CLI
railway run psql < scripts/db/fix-imported-waves.sql
```

**Important:** The SQL script leaves the transaction open. You must manually type `COMMIT;` or `ROLLBACK;` after reviewing the results.

## What It Does

### Before Migration
```
Quarter | Wave | Pos | Player | Minutes
--------|------|-----|--------|--------
1       | FULL | GK  | John   | 10      ← Correct (GK always FULL)
1       | FULL | DEF | Jane   | 10      ← WRONG
1       | FULL | ATT | Mike   | 10      ← WRONG
```

### After Migration
```
Quarter | Wave   | Pos | Player | Minutes
--------|--------|-----|--------|--------
1       | FULL   | GK  | John   | 10      ← Unchanged
1       | FIRST  | DEF | Jane   | 5       ← Fixed (split into 2 rows)
1       | SECOND | DEF | Jane   | 5       ← Fixed
1       | FIRST  | ATT | Mike   | 5       ← Fixed (split into 2 rows)
1       | SECOND | ATT | Mike   | 5       ← Fixed
```

## Verification Queries

Run these queries to check the results:

### 1. Check for remaining bad rows (should be 0)
```sql
SELECT COUNT(*) as remaining_bad_rows
FROM lineup_quarter
WHERE wave = 'FULL'
  AND position != 'GK';
```

### 2. View wave distribution
```sql
SELECT
  wave,
  position,
  COUNT(*) as count,
  AVG(minutes) as avg_minutes
FROM lineup_quarter
GROUP BY wave, position
ORDER BY wave, position;
```

Expected output:
```
wave   | position | count | avg_minutes
-------+----------+-------+------------
FIRST  | ATT      |   XX  |    5.00
FIRST  | DEF      |   XX  |    5.00
FULL   | GK       |   XX  |   10.00
SECOND | ATT      |   XX  |    5.00
SECOND | DEF      |   XX  |    5.00
```

### 3. View a sample fixture
```sql
WITH first_fixture AS (
  SELECT id, fixture_date, opponent
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
JOIN first_fixture f ON f.id = lq.fixture_id
JOIN player p ON p.id = lq.player_id
ORDER BY lq.quarter_number, lq.wave, lq.position;
```

## Rollback Plan

If something goes wrong:

### If transaction is still open (SQL script):
```sql
ROLLBACK;
```

### If already committed:
You'll need to manually restore from a database backup. Before running the migration, consider:

```bash
# Create a backup (Railway)
railway db backup

# Or export specific tables (PostgreSQL)
pg_dump $DATABASE_URL -t lineup_quarter > backup-lineup-quarter.sql
```

## Expected Impact

- **Fixtures affected:** ~7 imported fixtures
- **Rows deleted:** ~224 (7 fixtures × 4 quarters × 8 outfield slots)
- **Rows inserted:** ~448 (2 rows per deleted row: FIRST + SECOND)
- **Net change:** +224 rows
- **Execution time:** < 5 seconds
- **Frontend impact:** Season Stats tab will immediately show imported fixtures with proper wave grouping

## Post-Migration

1. Visit Season Stats tab in the web app
2. Open any imported fixture
3. Verify that it now displays:
   - GK row (10 minutes)
   - First Wave section (0-5 min): 2 DEF + 2 ATT
   - Second Wave section (5-10 min): 2 DEF + 2 ATT
4. Compare with a newly-created fixture to ensure they look identical

## Troubleshooting

### "No rows need fixing"
✅ Database is already correct! No action needed.

### "Remaining bad rows > 0 after migration"
❌ Migration failed. The script will automatically rollback. Check:
- Database permissions
- Data integrity constraints
- Foreign key relationships

### Migration runs but UI still shows "Other Players"
- Clear browser cache and hard refresh (Ctrl+Shift+R)
- Check browser console for API errors
- Verify API is fetching latest data (not cached)

## Questions?

Contact the development team or review the code in:
- `scripts/db/fix-imported-waves.sql` (SQL migration)
- `scripts/db/fix-imported-waves.mjs` (Node.js wrapper)
- `src/lib/persistence.ts:529-636` (Data conversion logic)
- `src/components/AllocationGrid.tsx:348-394` (UI rendering logic)
