#!/usr/bin/env node
import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

try {
  await client.connect();

  // Query FULL wave outfield rows with 5 minutes
  const result = await client.query(`
    SELECT
      f.fixture_date,
      f.opponent,
      lq.quarter_number,
      lq.wave,
      lq.position,
      p.display_name,
      lq.minutes,
      f.id as fixture_id
    FROM lineup_quarter lq
    JOIN fixture f ON f.id = lq.fixture_id
    JOIN player p ON p.id = lq.player_id
    WHERE lq.wave = 'FULL'
      AND lq.position != 'GK'
      AND lq.minutes = 5
    ORDER BY f.fixture_date, lq.quarter_number, lq.position, p.display_name
  `);

  console.log('\n=== FULL Wave Outfield with 5 Minutes ===\n');
  console.log(`Found ${result.rows.length} rows\n`);
  console.log('Date       | Opponent          | Q | Wave | Pos | Player      | Min');
  console.log('-----------+-------------------+---+------+-----+-------------+----');

  for (const row of result.rows) {
    const date = row.fixture_date.toISOString().substring(0, 10);
    const opponent = (row.opponent || '').padEnd(17).substring(0, 17);
    const player = (row.display_name || '').padEnd(11).substring(0, 11);
    console.log(
      `${date} | ${opponent} | ${row.quarter_number} | ${row.wave} | ${row.position} | ${player} | ${row.minutes}`
    );
  }

  // Count by fixture
  const countResult = await client.query(`
    SELECT
      f.id,
      f.fixture_date,
      f.opponent,
      COUNT(*) as count_5min
    FROM lineup_quarter lq
    JOIN fixture f ON f.id = lq.fixture_id
    WHERE lq.wave = 'FULL'
      AND lq.position != 'GK'
      AND lq.minutes = 5
    GROUP BY f.id, f.fixture_date, f.opponent
    ORDER BY f.fixture_date
  `);

  console.log('\n=== Fixtures with 5-minute FULL wave rows ===\n');
  for (const row of countResult.rows) {
    const date = row.fixture_date.toISOString().substring(0, 10);
    console.log(`${date} | ${row.opponent} | ${row.count_5min} rows`);
  }

  // Show one complete fixture to understand the pattern
  if (countResult.rows.length > 0) {
    const firstFixtureId = countResult.rows[0].id;
    const fixtureResult = await client.query(`
      SELECT
        lq.quarter_number,
        lq.wave,
        lq.position,
        p.display_name,
        lq.minutes
      FROM lineup_quarter lq
      JOIN player p ON p.id = lq.player_id
      WHERE lq.fixture_id = $1
      ORDER BY lq.quarter_number, lq.wave, lq.position, p.display_name
    `, [firstFixtureId]);

    console.log(`\n=== Complete lineup for ${countResult.rows[0].opponent} (${countResult.rows[0].fixture_date.toISOString().substring(0, 10)}) ===\n`);
    console.log('Q | Wave   | Pos | Player      | Min');
    console.log('--+--------+-----+-------------+----');
    for (const row of fixtureResult.rows) {
      const player = (row.display_name || '').padEnd(11).substring(0, 11);
      console.log(`${row.quarter_number} | ${row.wave.padEnd(6)} | ${row.position} | ${player} | ${row.minutes}`);
    }
  }

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
