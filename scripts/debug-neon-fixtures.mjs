#!/usr/bin/env node
/**
 * Debug script to check fixture IDs in Neon database
 */

import pkg from 'pg';
const { Pool } = pkg;
import { config } from 'dotenv';

config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

async function debug() {
  try {
    console.log('🔍 Connecting to database...\n');
    console.log(`Database: ${(process.env.DATABASE_URL || '').substring(0, 50)}...\n`);

    // 1. Check fixture table schema
    console.log('📋 Fixture table schema:');
    const schemaResult = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'fixture' AND column_name = 'id'
    `);
    console.log(schemaResult.rows);
    console.log('');

    // 2. List all fixtures with raw ID values
    console.log('📝 All fixtures (showing ID with length and encoding):');
    const fixturesResult = await pool.query(`
      SELECT
        id,
        length(id::text) as id_length,
        pg_typeof(id) as id_type,
        opponent,
        status
      FROM fixture
      ORDER BY created_at DESC
      LIMIT 10
    `);
    console.log(`Found ${fixturesResult.rows.length} fixtures:`);
    fixturesResult.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ID: "${row.id}" (length: ${row.id_length}, type: ${row.id_type})`);
      console.log(`     Opponent: ${row.opponent}, Status: ${row.status}`);
      console.log(`     ID bytes: [${Buffer.from(row.id).toString('hex')}]`);
    });
    console.log('');

    // 3. Try to query by specific ID from logs
    const testId = 'e9539a4c-9cbe-4403-a6df-4f3482257634';
    console.log(`🔎 Testing query for ID: "${testId}"`);

    const testResult = await pool.query('SELECT * FROM fixture WHERE id = $1', [testId]);
    console.log(`   Result: ${testResult.rowCount} rows found`);
    if (testResult.rows.length > 0) {
      console.log('   ✅ Found fixture:', testResult.rows[0]);
    } else {
      console.log('   ❌ No fixture found');

      // Try with LIKE to see if there's any partial match
      const likeResult = await pool.query(`SELECT id, opponent FROM fixture WHERE id::text LIKE $1`, [`%${testId}%`]);
      console.log(`   LIKE search result: ${likeResult.rowCount} rows`);
      if (likeResult.rows.length > 0) {
        likeResult.rows.forEach(r => console.log(`     - ID: "${r.id}"`));
      }
    }
    console.log('');

    // 4. Check team_id filtering
    console.log('🏢 Checking team_id filtering:');
    const teamIdResult = await pool.query(`
      SELECT DISTINCT team_id, COUNT(*) as count
      FROM fixture
      GROUP BY team_id
    `);
    console.log('Team IDs in fixture table:', teamIdResult.rows);
    console.log('');

    console.log('✅ Debug complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

debug();
