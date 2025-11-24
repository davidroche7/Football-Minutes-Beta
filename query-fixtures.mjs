#!/usr/bin/env node
import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

try {
  await client.connect();

  // Query to compare imported vs newly created fixtures
  const result = await client.query(`
    SELECT
      f.id,
      f.fixture_date,
      f.opponent,
      f.status,
      f.created_at,
      lq.quarter_number,
      lq.wave,
      lq.position,
      p.display_name,
      lq.minutes
    FROM fixture f
    JOIN lineup_quarter lq ON lq.fixture_id = f.id
    JOIN player p ON p.id = lq.player_id
    ORDER BY f.created_at, f.fixture_date, lq.quarter_number, lq.wave, lq.position
    LIMIT 80
  `);

  console.log('\n=== FIXTURE LINEUP DATA ===\n');
  console.log('Date       | Opponent          | Q | Wave   | Pos | Player      | Min');
  console.log('-----------+-------------------+---+--------+-----+-------------+----');

  let currentFixture = null;
  for (const row of result.rows) {
    if (currentFixture !== row.id) {
      currentFixture = row.id;
      console.log('');
    }
    const dateStr = row.fixture_date.toISOString().substring(0, 10);
    const opponent = (row.opponent || '').padEnd(17).substring(0, 17);
    const player = (row.display_name || '').padEnd(11).substring(0, 11);
    console.log(
      `${dateStr} | ${opponent} | ${row.quarter_number} | ${row.wave.padEnd(6)} | ${row.position} | ${player} | ${row.minutes}`
    );
  }

  // Count fixtures by status
  const countResult = await client.query(`
    SELECT status, COUNT(*) as count
    FROM fixture
    GROUP BY status
    ORDER BY count DESC
  `);

  console.log('\n\n=== FIXTURE COUNT BY STATUS ===\n');
  for (const row of countResult.rows) {
    console.log(`${row.status}: ${row.count}`);
  }

  // Find oldest and newest fixtures
  const rangeResult = await client.query(`
    SELECT
      MIN(created_at) as oldest_created,
      MAX(created_at) as newest_created,
      MIN(fixture_date) as oldest_date,
      MAX(fixture_date) as newest_date
    FROM fixture
  `);

  console.log('\n=== FIXTURE DATE RANGE ===\n');
  const range = rangeResult.rows[0];
  console.log(`Oldest created: ${range.oldest_created}`);
  console.log(`Newest created: ${range.newest_created}`);
  console.log(`Oldest fixture date: ${range.oldest_date}`);
  console.log(`Newest fixture date: ${range.newest_date}`);

} catch (error) {
  console.error('Error querying database:', error);
  process.exit(1);
} finally {
  await client.end();
}
