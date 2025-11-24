#!/usr/bin/env node
/**
 * One-off migration script: Fix imported fixtures with incorrect wave assignments
 *
 * This script wraps the SQL migration in a Node.js runner with better output
 * and error handling.
 *
 * Usage:
 *   node scripts/db/fix-imported-waves.mjs [--dry-run] [--auto-commit]
 *
 * Options:
 *   --dry-run      Show what would be changed without making changes
 *   --auto-commit  Automatically commit if verification passes (use with caution)
 */

import { Client } from 'pg';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    log('Please set it in your .env file or environment', 'error');
    process.exit(1);
  }

  section('WAVE MIGRATION TOOL');

  if (isDryRun) {
    log('Running in DRY-RUN mode - no changes will be made', 'warning');
  }

  if (autoCommit) {
    log('AUTO-COMMIT enabled - changes will be committed automatically', 'warning');
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    log('Connected to database', 'success');

    // Start transaction
    await client.query('BEGIN');
    log('Transaction started', 'info');

    // ========================================
    // PRE-MIGRATION ANALYSIS
    // ========================================

    section('PRE-MIGRATION ANALYSIS');

    // Count affected rows
    const countResult = await client.query(`
      SELECT
        COUNT(*) as total_rows,
        COUNT(DISTINCT fixture_id) as affected_fixtures
      FROM lineup_quarter
      WHERE wave = 'FULL'
        AND position != 'GK'
        AND minutes = 10
    `);

    const { total_rows, affected_fixtures } = countResult.rows[0];

    log(`Found ${total_rows} rows in ${affected_fixtures} fixtures that need fixing`);

    if (total_rows === '0') {
      log('No rows need fixing - database is already correct!', 'success');
      await client.query('ROLLBACK');
      return;
    }

    // Show affected fixtures
    const fixturesResult = await client.query(`
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
      ORDER BY f.fixture_date
    `);

    console.log('\nAffected fixtures:');
    console.log('Date       | Opponent                 | Bad Rows');
    console.log('-----------+--------------------------+---------');
    for (const row of fixturesResult.rows) {
      const date = row.fixture_date.toISOString().substring(0, 10);
      const opponent = (row.opponent || '').padEnd(24).substring(0, 24);
      console.log(`${date} | ${opponent} | ${row.bad_rows}`);
    }

    // Show sample of affected rows
    const sampleResult = await client.query(`
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
      WHERE lq.wave = 'FULL'
        AND lq.position != 'GK'
        AND lq.minutes = 10
      ORDER BY f.fixture_date, lq.quarter_number, lq.position
      LIMIT 10
    `);

    console.log('\nSample of rows to be fixed (first 10):');
    console.log('Date       | Opponent          | Q | Wave | Pos | Player      | Min');
    console.log('-----------+-------------------+---+------+-----+-------------+----');
    for (const row of sampleResult.rows) {
      const date = row.fixture_date.toISOString().substring(0, 10);
      const opponent = (row.opponent || '').padEnd(17).substring(0, 17);
      const player = (row.display_name || '').padEnd(11).substring(0, 11);
      console.log(
        `${date} | ${opponent} | ${row.quarter_number} | ${row.wave} | ${row.position} | ${player} | ${row.minutes}`
      );
    }

    if (isDryRun) {
      log('\nDRY-RUN complete - no changes made', 'success');
      await client.query('ROLLBACK');
      return;
    }

    // ========================================
    // EXECUTE MIGRATION
    // ========================================

    section('EXECUTING MIGRATION');

    // Create temp table
    await client.query(`
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
        AND lq.minutes = 10
    `);

    log('Created temporary table with rows to fix');

    // Delete FULL wave rows
    const deleteResult = await client.query(`
      DELETE FROM lineup_quarter
      WHERE id IN (SELECT id FROM rows_to_fix)
    `);

    log(`Deleted ${deleteResult.rowCount} FULL wave rows`, 'success');

    // Insert FIRST wave rows
    const firstResult = await client.query(`
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
      FROM rows_to_fix
    `);

    log(`Inserted ${firstResult.rowCount} FIRST wave rows (5 minutes each)`, 'success');

    // Insert SECOND wave rows
    const secondResult = await client.query(`
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
      FROM rows_to_fix
    `);

    log(`Inserted ${secondResult.rowCount} SECOND wave rows (5 minutes each)`, 'success');

    // ========================================
    // POST-MIGRATION VERIFICATION
    // ========================================

    section('POST-MIGRATION VERIFICATION');

    // Check for remaining bad rows
    const remainingResult = await client.query(`
      SELECT COUNT(*) as remaining
      FROM lineup_quarter
      WHERE wave = 'FULL'
        AND position != 'GK'
    `);

    const remaining = parseInt(remainingResult.rows[0].remaining);

    if (remaining > 0) {
      log(`WARNING: ${remaining} FULL wave outfield rows still exist!`, 'warning');
    } else {
      log('All FULL wave outfield rows have been fixed!', 'success');
    }

    // Show wave distribution
    const distResult = await client.query(`
      SELECT
        wave,
        position,
        COUNT(*) as count,
        AVG(minutes)::numeric(10,2) as avg_minutes
      FROM lineup_quarter
      GROUP BY wave, position
      ORDER BY wave, position
    `);

    console.log('\nWave distribution (all fixtures):');
    console.log('Wave   | Pos | Count | Avg Minutes');
    console.log('-------+-----+-------+------------');
    for (const row of distResult.rows) {
      const wave = row.wave.padEnd(6);
      console.log(`${wave} | ${row.position} | ${String(row.count).padStart(5)} | ${row.avg_minutes}`);
    }

    // Show sample fixture
    const sampleFixtureResult = await client.query(`
      WITH first_fixture AS (
        SELECT id, fixture_date, opponent
        FROM fixture
        ORDER BY fixture_date
        LIMIT 1
      )
      SELECT
        lq.quarter_number,
        lq.wave,
        lq.position,
        p.display_name,
        lq.minutes
      FROM lineup_quarter lq
      JOIN first_fixture f ON f.id = lq.fixture_id
      JOIN player p ON p.id = lq.player_id
      ORDER BY lq.quarter_number, lq.wave, lq.position, p.display_name
    `);

    if (sampleFixtureResult.rows.length > 0) {
      const firstFixtureInfo = await client.query(`
        SELECT fixture_date, opponent
        FROM fixture
        ORDER BY fixture_date
        LIMIT 1
      `);

      const info = firstFixtureInfo.rows[0];
      console.log(`\nSample fixture (${info.fixture_date.toISOString().substring(0, 10)} vs ${info.opponent}):`);
      console.log('Q | Wave   | Pos | Player      | Min');
      console.log('--+--------+-----+-------------+----');
      for (const row of sampleFixtureResult.rows) {
        const player = (row.display_name || '').padEnd(11).substring(0, 11);
        console.log(`${row.quarter_number} | ${row.wave.padEnd(6)} | ${row.position} | ${player} | ${row.minutes}`);
      }
    }

    // ========================================
    // COMMIT OR ROLLBACK
    // ========================================

    section('TRANSACTION DECISION');

    if (remaining > 0) {
      log('Migration failed - rolling back', 'error');
      await client.query('ROLLBACK');
      process.exit(1);
    }

    if (autoCommit) {
      await client.query('COMMIT');
      log('Changes committed automatically', 'success');
    } else {
      log('Migration successful! Review the results above.', 'success');
      log('To commit: Run this script with --auto-commit flag', 'info');
      log('For now, rolling back (no changes saved)', 'warning');
      await client.query('ROLLBACK');
    }

  } catch (error) {
    log(`Error during migration: ${error.message}`, 'error');
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
