#!/usr/bin/env node
/**
 * Import SW backup into Railway PostgreSQL database
 * Usage: node scripts/import-sw-backup.mjs <backup-file>
 */

import { readFileSync } from 'fs';
import pkg from 'pg';
const { Pool } = pkg;
import { config } from 'dotenv';

config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const TEAM_ID = process.env.VITE_TEAM_ID || 'a0b6a1d3-19d7-4630-8b67-eaa8c33e4765';

async function importBackup(filePath) {
  console.log(`Reading backup from: ${filePath}`);
  const backup = JSON.parse(readFileSync(filePath, 'utf8'));

  console.log(`Found ${backup.data.matches.length} matches to import`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Track player name -> ID mapping
    const playerMap = new Map();

    // Get existing players
    const existingPlayers = await client.query(
      'SELECT id, display_name FROM player WHERE team_id = $1',
      [TEAM_ID]
    );
    existingPlayers.rows.forEach(row => {
      playerMap.set(row.display_name, row.id);
    });

    console.log(`Found ${playerMap.size} existing players`);

    for (const match of backup.data.matches) {
      console.log(`\nImporting match: ${match.opponent} on ${match.date}`);

      // Collect all unique player names from this match
      const playerNames = new Set(match.players || []);
      match.allocation?.quarters?.forEach(q => {
        q.slots?.forEach(slot => {
          if (slot.player) playerNames.add(slot.player);
        });
      });

      // Create any missing players
      for (const name of playerNames) {
        if (!playerMap.has(name)) {
          console.log(`  Creating player: ${name}`);
          const result = await client.query(
            'INSERT INTO player (team_id, display_name, status) VALUES ($1, $2, $3) RETURNING id',
            [TEAM_ID, name, 'ACTIVE']
          );
          playerMap.set(name, result.rows[0].id);
        }
      }

      // Create fixture
      const fixtureResult = await client.query(`
        INSERT INTO fixture (
          team_id, opponent, fixture_date, venue_type, status
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [
        TEAM_ID,
        match.opponent,
        match.date + 'T00:00:00Z',
        match.venue?.toUpperCase() === 'AWAY' ? 'AWAY' : 'HOME',
        'FINAL'
      ]);

      const fixtureId = fixtureResult.rows[0].id;
      console.log(`  Created fixture ID: ${fixtureId}`);

      // Add players to fixture_player table
      for (const playerName of playerNames) {
        const playerId = playerMap.get(playerName);
        await client.query(`
          INSERT INTO fixture_player (fixture_id, player_id, role)
          VALUES ($1, $2, $3)
        `, [fixtureId, playerId, 'STARTER']);
      }

      // Create lineup slots
      if (match.allocation?.quarters) {
        for (const quarter of match.allocation.quarters) {
          for (const slot of quarter.slots || []) {
            if (!slot.player) continue;

            const playerId = playerMap.get(slot.player);
            if (!playerId) {
              console.warn(`  Warning: Player "${slot.player}" not found`);
              continue;
            }

            await client.query(`
              INSERT INTO lineup_quarter (
                fixture_id, quarter_number, wave, position,
                player_id, minutes, is_substitution
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              fixtureId,
              quarter.quarter,
              'FULL',
              slot.position,
              playerId,
              slot.minutes || 10,
              false
            ]);
          }
        }
        console.log(`  Added ${match.allocation.quarters.length} quarters of lineup data`);
      }

      // Set result if available
      if (match.result) {
        // Map result to enum values
        let resultCode = match.result.result?.toUpperCase() || 'DRAW';
        if (resultCode === 'LOST') resultCode = 'LOSS';
        if (resultCode === 'WON') resultCode = 'WIN';

        await client.query(`
          INSERT INTO match_result (fixture_id, result_code, team_goals, opponent_goals)
          VALUES ($1, $2, $3, $4)
        `, [
          fixtureId,
          resultCode,
          match.result.goalsFor,
          match.result.goalsAgainst
        ]);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Import complete!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Import failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

const backupFile = process.argv[2];
if (!backupFile) {
  console.error('Usage: node scripts/import-sw-backup.mjs <backup-file>');
  process.exit(1);
}

importBackup(backupFile);
