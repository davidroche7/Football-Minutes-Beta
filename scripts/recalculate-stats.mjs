#!/usr/bin/env node
/**
 * Recalculate player_match_stat from lineup_quarter data
 */

import pkg from 'pg';
const { Pool } = pkg;
import { config } from 'dotenv';

config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function recalculateStats() {
  const client = await pool.connect();

  try {
    console.log('Recalculating player match stats from lineup data...\n');

    // Delete existing stats
    await client.query('DELETE FROM player_match_stat');
    console.log('✓ Cleared existing stats');

    // Calculate and insert stats from lineup_quarter
    const result = await client.query(`
      INSERT INTO player_match_stat (fixture_id, player_id, total_minutes, goalkeeper_quarters)
      SELECT
        lq.fixture_id,
        lq.player_id,
        SUM(lq.minutes) AS total_minutes,
        COUNT(CASE WHEN lq.position = 'GK' THEN 1 END) AS goalkeeper_quarters
      FROM lineup_quarter lq
      GROUP BY lq.fixture_id, lq.player_id
      RETURNING fixture_id, player_id, total_minutes, goalkeeper_quarters
    `);

    console.log(`✓ Created ${result.rowCount} player match stat records`);
    console.log('\n✅ Stats recalculation complete!');

  } catch (error) {
    console.error('\n❌ Recalculation failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

recalculateStats();
