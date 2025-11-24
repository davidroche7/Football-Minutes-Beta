#!/usr/bin/env node
/**
 * Comprehensive wave migration - handles both 10-minute and 5-minute FULL wave cases
 */

import { Client } from 'pg';
import { config } from 'dotenv';
config();

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const autoCommit = args.includes('--auto-commit');

function log(message, level = 'info') {
  const prefix = {
    info: 'ℹ️ ',
    success: '✅',
    warning: '⚠️ ',
    error: '❌',
  }[level] || '';
  console.log(`${prefix} ${message}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60) + '\n');
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    log('DATABASE_URL environment variable is not set', 'error');
    process.exit(1);
  }

  section('COMPREHENSIVE WAVE MIGRATION');

  if (isDryRun) {
    log('Running in DRY-RUN mode - no changes will be made', 'warning');
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    log('Connected to database', 'success');

    await client.query('BEGIN');
    log('Transaction started', 'info');

    // ========================================
    // PRE-MIGRATION ANALYSIS
    // ========================================

    section('PRE-MIGRATION ANALYSIS');

    // Case 1: 10-minute FULL wave outfield rows
    const case1Result = await client.query(`
      SELECT COUNT(*) as count, COUNT(DISTINCT fixture_id) as fixtures
      FROM lineup_quarter
      WHERE wave = 'FULL' AND position != 'GK' AND minutes = 10
    `);

    const case1Count = parseInt(case1Result.rows[0].count);
    const case1Fixtures = parseInt(case1Result.rows[0].fixtures);

    log(`Case 1: ${case1Count} rows in ${case1Fixtures} fixtures (10-minute FULL → split into FIRST(5) + SECOND(5))`);

    // Case 2: 5-minute FULL wave outfield rows
    const case2Result = await client.query(`
      SELECT COUNT(*) as count, COUNT(DISTINCT fixture_id) as fixtures
      FROM lineup_quarter
      WHERE wave = 'FULL' AND position != 'GK' AND minutes = 5
    `);

    const case2Count = parseInt(case2Result.rows[0].count);
    const case2Fixtures = parseInt(case2Result.rows[0].fixtures);

    log(`Case 2: ${case2Count} rows in ${case2Fixtures} fixtures (5-minute FULL → assign to FIRST or SECOND based on position in quarter)`);

    const totalAffected = case1Count + case2Count;

    if (totalAffected === 0) {
      log('No rows need fixing - database is already correct!', 'success');
      await client.query('ROLLBACK');
      return;
    }

    if (isDryRun) {
      log(`\nTotal rows to fix: ${totalAffected}`, 'info');
      log('DRY-RUN complete - no changes made', 'success');
      await client.query('ROLLBACK');
      return;
    }

    // ========================================
    // MIGRATION CASE 1: Split 10-minute rows
    // ========================================

    if (case1Count > 0) {
      section('CASE 1: Splitting 10-minute FULL waves');

      await client.query(`
        CREATE TEMP TABLE rows_to_split AS
        SELECT
          lq.id,
          lq.fixture_id,
          lq.quarter_number,
          lq.position,
          lq.player_id,
          lq.is_substitution,
          lq.created_at
        FROM lineup_quarter lq
        WHERE lq.wave = 'FULL' AND lq.position != 'GK' AND lq.minutes = 10
      `);

      const deleteResult1 = await client.query(`
        DELETE FROM lineup_quarter
        WHERE id IN (SELECT id FROM rows_to_split)
      `);

      log(`Deleted ${deleteResult1.rowCount} FULL wave rows (10 min)`);

      const firstResult1 = await client.query(`
        INSERT INTO lineup_quarter (
          id, fixture_id, quarter_number, wave, position, player_id,
          minutes, is_substitution, created_at, updated_at
        )
        SELECT
          gen_random_uuid(), fixture_id, quarter_number, 'FIRST'::lineup_wave,
          position, player_id, 5, is_substitution, created_at, NOW()
        FROM rows_to_split
      `);

      log(`Inserted ${firstResult1.rowCount} FIRST wave rows (5 min)`, 'success');

      const secondResult1 = await client.query(`
        INSERT INTO lineup_quarter (
          id, fixture_id, quarter_number, wave, position, player_id,
          minutes, is_substitution, created_at, updated_at
        )
        SELECT
          gen_random_uuid(), fixture_id, quarter_number, 'SECOND'::lineup_wave,
          position, player_id, 5, is_substitution, created_at, NOW()
        FROM rows_to_split
      `);

      log(`Inserted ${secondResult1.rowCount} SECOND wave rows (5 min)`, 'success');

      await client.query('DROP TABLE rows_to_split');
    }

    // ========================================
    // MIGRATION CASE 2: Assign 5-minute rows to waves
    // ========================================

    if (case2Count > 0) {
      section('CASE 2: Assigning 5-minute FULL waves to FIRST/SECOND');

      // Strategy: For each fixture/quarter/position combination,
      // assign first half to FIRST wave, second half to SECOND wave
      // (ordered by player name for consistency)

      await client.query(`
        CREATE TEMP TABLE rows_to_assign AS
        SELECT
          lq.id,
          lq.fixture_id,
          lq.quarter_number,
          lq.position,
          lq.player_id,
          p.display_name,
          lq.is_substitution,
          lq.created_at,
          ROW_NUMBER() OVER (
            PARTITION BY lq.fixture_id, lq.quarter_number, lq.position
            ORDER BY p.display_name
          ) as row_num,
          COUNT(*) OVER (
            PARTITION BY lq.fixture_id, lq.quarter_number, lq.position
          ) as total_in_group
        FROM lineup_quarter lq
        JOIN player p ON p.id = lq.player_id
        WHERE lq.wave = 'FULL' AND lq.position != 'GK' AND lq.minutes = 5
      `);

      // Update first half to FIRST wave
      const firstResult2 = await client.query(`
        UPDATE lineup_quarter lq
        SET wave = 'FIRST'::lineup_wave, updated_at = NOW()
        WHERE id IN (
          SELECT id FROM rows_to_assign
          WHERE row_num <= (total_in_group / 2.0)
        )
      `);

      log(`Assigned ${firstResult2.rowCount} rows to FIRST wave`, 'success');

      // Update second half to SECOND wave
      const secondResult2 = await client.query(`
        UPDATE lineup_quarter lq
        SET wave = 'SECOND'::lineup_wave, updated_at = NOW()
        WHERE id IN (
          SELECT id FROM rows_to_assign
          WHERE row_num > (total_in_group / 2.0)
        )
      `);

      log(`Assigned ${secondResult2.rowCount} rows to SECOND wave`, 'success');

      await client.query('DROP TABLE rows_to_assign');
    }

    // ========================================
    // POST-MIGRATION VERIFICATION
    // ========================================

    section('POST-MIGRATION VERIFICATION');

    const remainingResult = await client.query(`
      SELECT COUNT(*) as remaining
      FROM lineup_quarter
      WHERE wave = 'FULL' AND position != 'GK'
    `);

    const remaining = parseInt(remainingResult.rows[0].remaining);

    if (remaining > 0) {
      log(`WARNING: ${remaining} FULL wave outfield rows still exist!`, 'error');
      log('Migration failed - rolling back', 'error');
      await client.query('ROLLBACK');
      process.exit(1);
    } else {
      log('All FULL wave outfield rows have been fixed!', 'success');
    }

    // Show wave distribution
    const distResult = await client.query(`
      SELECT
        wave, position, COUNT(*) as count, AVG(minutes)::numeric(10,2) as avg_minutes
      FROM lineup_quarter
      GROUP BY wave, position
      ORDER BY wave, position
    `);

    console.log('\nWave distribution:');
    console.log('Wave   | Pos | Count | Avg Min');
    console.log('-------+-----+-------+--------');
    for (const row of distResult.rows) {
      console.log(`${row.wave.padEnd(6)} | ${row.position} | ${String(row.count).padStart(5)} | ${row.avg_minutes}`);
    }

    // ========================================
    // COMMIT OR ROLLBACK
    // ========================================

    section('TRANSACTION DECISION');

    if (autoCommit) {
      await client.query('COMMIT');
      log(`Migration successful! Fixed ${totalAffected} rows.`, 'success');
      log('Changes committed', 'success');
    } else {
      log('Migration successful! Review results above.', 'success');
      log('To commit: Re-run with --auto-commit flag', 'info');
      log('For now, rolling back (no changes saved)', 'warning');
      await client.query('ROLLBACK');
    }

  } catch (error) {
    log(`Error: ${error.message}`, 'error');
    console.error(error);

    try {
      await client.query('ROLLBACK');
      log('Transaction rolled back', 'info');
    } catch (rollbackError) {
      log(`Failed to rollback: ${rollbackError.message}`, 'error');
    }

    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
