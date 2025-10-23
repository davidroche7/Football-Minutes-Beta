#!/usr/bin/env node
/**
 * Seed the Postgres database with legacy match data exported to data/imported-matches.json.
 *
 * Usage:
 *    DATABASE_URL=postgres://... \
 *    VITE_TEAM_ID=0000-... \
 *    node scripts/db/seed-from-json.cjs
 *
 * Optional environment variables:
 *    SEED_TEAM_ID           - Override the team UUID (defaults to VITE_TEAM_ID)
 *    SEED_TEAM_NAME         - Display name for the seeded team (defaults to "Saffron Walden U8s")
 *    SEED_TEAM_AGE_GROUP    - Age group label for the team (defaults to "U8")
 *    SEED_SEASON_NAME       - Season label (defaults to "<current year> Season")
 *    SEED_SEASON_YEAR       - Season year integer (defaults to current year)
 */

/* eslint-env node */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const DATA_PATH = path.resolve(__dirname, '../../data/imported-matches.json');

const NAME_ALIASES = new Map([
  ['Renne', 'Renee'],
]);

function fatal(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function toTitleCase(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function normaliseName(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return toTitleCase(trimmed);
}

function normalisePlayerName(value) {
  const base = normaliseName(value);
  if (!base) return null;
  return NAME_ALIASES.get(base) ?? base;
}

function normaliseKey(value) {
  return normalisePlayerName(value)?.toLowerCase() ?? null;
}

function mapVenueType(value) {
  if (typeof value !== 'string') return 'NEUTRAL';
  const key = value.trim().toLowerCase();
  if (key.startsWith('home')) return 'HOME';
  if (key.startsWith('away')) return 'AWAY';
  if (key.startsWith('neutral')) return 'NEUTRAL';
  return 'NEUTRAL';
}

function mapResultCode(value) {
  if (typeof value !== 'string') return 'VOID';
  const key = value.trim().toLowerCase();
  if (key === 'win' || key === 'won') return 'WIN';
  if (key === 'loss' || key === 'lose' || key === 'lost') return 'LOSS';
  if (key === 'draw' || key === 'tie') return 'DRAW';
  if (key === 'abandoned') return 'ABANDONED';
  return 'VOID';
}

function safeNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function splitOutfieldMinutes(totalMinutes) {
  const minutes = typeof totalMinutes === 'number' && totalMinutes > 0 ? Math.round(totalMinutes) : 0;
  if (minutes === 0) {
    return { first: 0, second: 0 };
  }
  if (minutes <= 5) {
    return { first: minutes, second: 0 };
  }
  const first = Math.min(5, minutes);
  const second = minutes - first;
  return { first, second };
}

function readLegacyData(filePath) {
  if (!fs.existsSync(filePath)) {
    fatal(`Legacy data file not found at ${filePath}. Run "npm run import:legacy" first.`);
  }
  const rawJson = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(rawJson);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.matches)) {
    fatal('Legacy data file is malformed; expected an object with a "matches" array.');
  }
  return parsed.matches;
}

(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    fatal('DATABASE_URL environment variable must be set.');
  }

  const teamId =
    process.env.SEED_TEAM_ID ||
    process.env.VITE_TEAM_ID ||
    process.env.TEAM_ID ||
    null;
  if (!teamId) {
    fatal('Provide SEED_TEAM_ID or VITE_TEAM_ID so seeded records align with the frontend.');
  }

  const teamName = process.env.SEED_TEAM_NAME || 'Saffron Walden U8s';
  const teamAgeGroup = process.env.SEED_TEAM_AGE_GROUP || 'U8';
  const seasonLabel = process.env.SEED_SEASON_NAME || `${new Date().getFullYear()} Season`;
  const seasonYear = Number(process.env.SEED_SEASON_YEAR || new Date().getFullYear());
  if (!Number.isInteger(seasonYear)) {
    fatal('SEED_SEASON_YEAR must be an integer year value if provided.');
  }

  const matches = readLegacyData(DATA_PATH);
  if (matches.length === 0) {
    fatal('Legacy file contains no matches to import.');
  }

  const processedMatches = [];
  const playerMeta = new Map(); // name -> { name, positions: Set }
  const matchIssues = [];

  matches.forEach((match, matchIdx) => {
    const date = typeof match?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(match.date)
      ? match.date
      : null;
    if (!date) {
      console.warn(`Skipping match index ${matchIdx} (missing or invalid date).`);
      return;
    }

    const opponent = normaliseName(match.opponent) || 'Unknown Opponent';
    const venueType = mapVenueType(match.venue);

    const availablePlayers = new Set();
    if (Array.isArray(match.availablePlayers)) {
      match.availablePlayers.forEach((name) => {
        const normalised = normalisePlayerName(name);
        if (normalised) {
          availablePlayers.add(normalised);
        }
      });
    }

    const quarterData = [];
    const summaryFromQuarters = new Map();
    const goalkeeperQuarters = new Map();

    const quarters = Array.isArray(match.quarters) ? match.quarters : [];
    quarters.forEach((quarterRaw, index) => {
      const quarterNumber =
        typeof quarterRaw?.quarter === 'number'
          ? Math.min(Math.max(Math.round(quarterRaw.quarter), 1), 4)
          : Math.min(index + 1, 4);

      const slots = Array.isArray(quarterRaw?.slots) ? quarterRaw.slots : [];
      const slotEntries = [];

      slots.forEach((slot) => {
        const playerName = normalisePlayerName(slot?.player);
        const positionRaw = typeof slot?.position === 'string' ? slot.position.trim().toUpperCase() : null;
        const minutesRaw = typeof slot?.minutes === 'number' ? slot.minutes : null;
        if (!playerName || !positionRaw) return;
        if (!['GK', 'DEF', 'ATT'].includes(positionRaw)) return;
        const minutes = minutesRaw && Number.isFinite(minutesRaw) ? Math.max(Math.round(minutesRaw), 5) : 10;

        slotEntries.push({ playerName, position: positionRaw, minutes });
        availablePlayers.add(playerName);

        if (!playerMeta.has(playerName)) {
          playerMeta.set(playerName, { name: playerName, positions: new Set([positionRaw]) });
        } else {
          playerMeta.get(playerName).positions.add(positionRaw);
        }

        summaryFromQuarters.set(
          playerName,
          (summaryFromQuarters.get(playerName) ?? 0) + minutes
        );

        if (positionRaw === 'GK') {
          goalkeeperQuarters.set(
            playerName,
            (goalkeeperQuarters.get(playerName) ?? 0) + 1
          );
        }
      });

      const substitutes = Array.isArray(quarterRaw?.substitutes)
        ? quarterRaw.substitutes
            .map((name) => normalisePlayerName(name))
            .filter(Boolean)
        : [];
      substitutes.forEach((name) => availablePlayers.add(name));

      quarterData.push({
        number: quarterNumber,
        slots: slotEntries,
        substitutes,
      });
    });

    const summaryEntries = new Map(summaryFromQuarters);
    if (match.summary && typeof match.summary === 'object') {
      Object.entries(match.summary).forEach(([name, minutes]) => {
        const playerName = normalisePlayerName(name);
        const minutesValue = safeNumber(minutes);
        if (!playerName || minutesValue === null) return;
        summaryEntries.set(playerName, Math.max(Math.round(minutesValue), 0));
        if (!playerMeta.has(playerName)) {
          playerMeta.set(playerName, { name: playerName, positions: new Set() });
        }
        availablePlayers.add(playerName);
      });
    }

    if (summaryEntries.size === 0) {
      matchIssues.push({
        date,
        opponent,
        reason: 'Unable to derive player minutes; review spreadsheet entries.',
      });
      console.warn(`Skipping match on ${date} (${opponent}) – unable to derive player minutes.`);
      return;
    }

    const goalCounts = new Map();
    const honorableCounts = new Map();
    let playerOfMatch = null;
    let goalsFor = null;
    let goalsAgainst = null;
    let resultCode = 'VOID';

    if (match.result && typeof match.result === 'object') {
      if (match.result.result) {
        resultCode = mapResultCode(match.result.result);
      }
      const gf = safeNumber(match.result.goalsFor);
      const ga = safeNumber(match.result.goalsAgainst);
      goalsFor = gf !== null ? Math.max(0, gf) : null;
      goalsAgainst = ga !== null ? Math.max(0, ga) : null;

      const pom = normalisePlayerName(match.result.playerOfMatch);
      if (pom) {
        playerOfMatch = pom;
        availablePlayers.add(pom);
      }

      if (Array.isArray(match.result.scorers)) {
        match.result.scorers.forEach((name) => {
          const scorer = normalisePlayerName(name);
          if (!scorer) return;
          goalCounts.set(scorer, (goalCounts.get(scorer) ?? 0) + 1);
          availablePlayers.add(scorer);
        });
      }

      if (Array.isArray(match.result.honorableMentions)) {
        match.result.honorableMentions.forEach((name) => {
          const nominee = normalisePlayerName(name);
          if (!nominee) return;
          honorableCounts.set(nominee, (honorableCounts.get(nominee) ?? 0) + 1);
          availablePlayers.add(nominee);
        });
      }
    }

    availablePlayers.forEach((playerName) => {
      if (!playerMeta.has(playerName)) {
        playerMeta.set(playerName, { name: playerName, positions: new Set() });
      }
    });

    processedMatches.push({
      date,
      opponent,
      venueType,
      quarters: quarterData,
      summary: summaryEntries,
      availablePlayers: Array.from(availablePlayers),
      goalkeeperQuarters,
      goalCounts,
      honorableCounts,
      playerOfMatch,
      goalsFor,
      goalsAgainst,
      resultCode,
    });
  });

  if (processedMatches.length === 0) {
    fatal('No valid matches were parsed from the legacy data set.');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const nowIso = new Date().toISOString();

  const uniqueNames = Array.from(playerMeta.values())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  console.log(`\nSeeding ${processedMatches.length} matches for team "${teamName}" (${teamId}).`);
  console.log(`Detected ${uniqueNames.length} unique players.`);

  try {
    await client.query('BEGIN');

    // Ensure season and team records exist
    let seasonId = null;
    const seasonLookup = await client.query(
      'SELECT id FROM season WHERE LOWER(name) = LOWER($1) AND year = $2 LIMIT 1',
      [seasonLabel, seasonYear]
    );
    if (seasonLookup.rowCount > 0) {
      seasonId = seasonLookup.rows[0].id;
    } else {
      seasonId = crypto.randomUUID();
      await client.query(
        `INSERT INTO season (id, name, year, club, starts_on, ends_on, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          seasonId,
          seasonLabel,
          seasonYear,
          'Saffron Walden',
          null,
          null,
          nowIso,
        ]
      );
    }

    const teamLookup = await client.query('SELECT id FROM team WHERE id = $1', [teamId]);
    if (teamLookup.rowCount === 0) {
      await client.query(
        `INSERT INTO team (id, name, age_group, season_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)`,
        [teamId, teamName, teamAgeGroup, seasonId, nowIso]
      );
    } else {
      await client.query(
        `UPDATE team
         SET name = $2,
             age_group = $3,
             season_id = $4,
             updated_at = $5
         WHERE id = $1`,
        [teamId, teamName, teamAgeGroup, seasonId, nowIso]
      );
    }

    // Clear previous data for the team
    const existingFixtureIds = await client.query('SELECT id FROM fixture WHERE team_id = $1', [teamId]);
    const existingPlayerIds = await client.query('SELECT id FROM player WHERE team_id = $1', [teamId]);

    if (existingFixtureIds.rowCount > 0) {
      const fixtureIdList = existingFixtureIds.rows.map((row) => row.id);
      await client.query(
        `DELETE FROM audit_event
         WHERE entity_type IN ('FIXTURE', 'LINEUP')
           AND entity_id = ANY($1::uuid[])`,
        [fixtureIdList]
      );
    }

    if (existingPlayerIds.rowCount > 0) {
      const playerIdList = existingPlayerIds.rows.map((row) => row.id);
      await client.query(
        `DELETE FROM audit_event
         WHERE entity_type = 'PLAYER'
           AND entity_id = ANY($1::uuid[])`,
        [playerIdList]
      );
    }

    await client.query('DELETE FROM fixture WHERE team_id = $1', [teamId]);
    await client.query('DELETE FROM player WHERE team_id = $1', [teamId]);
    await client.query('DELETE FROM ruleset WHERE team_id = $1', [teamId]);

    // Insert players
    const playerIdByName = new Map();
    for (const name of uniqueNames) {
      const meta = playerMeta.get(name);
      const id = crypto.randomUUID();
      playerIdByName.set(name, id);
      const preferredPositions = meta ? Array.from(meta.positions) : [];
      await client.query(
        `INSERT INTO player (id, team_id, display_name, preferred_positions, squad_number, status, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NULL, 'ACTIVE', NULL, $5, $5)`,
        [id, teamId, name, preferredPositions, nowIso]
      );
    }

    // Insert fixtures and related data
    for (const match of processedMatches) {
      await client.query('SAVEPOINT match_seed');
      const fixtureId = crypto.randomUUID();
      const fixtureTimestamp = new Date(`${match.date}T12:00:00Z`).toISOString();

      try {
        await client.query(
          `INSERT INTO fixture (id, team_id, season_id, opponent, fixture_date, kickoff_time, venue_type, status, created_by, notes, locked_at, finalised_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NULL, $6, 'FINAL', NULL, NULL, $7, $7, $7, $7)`,
          [fixtureId, teamId, seasonId, match.opponent, match.date, match.venueType, fixtureTimestamp]
        );

        const playersWithMinutes = new Set(Array.from(match.summary.keys()));
        const squadNames = new Set([...match.availablePlayers, ...playersWithMinutes]);

        for (const name of squadNames) {
          const playerId = playerIdByName.get(name);
          if (!playerId) {
            throw new Error(`Unknown player "${name}" while seeding fixture on ${match.date}.`);
          }
          const role = playersWithMinutes.has(name) ? 'STARTER' : 'BENCH';
          await client.query(
            `INSERT INTO fixture_player (id, fixture_id, player_id, role, notes, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NULL, $5, $5)`,
            [crypto.randomUUID(), fixtureId, playerId, role, fixtureTimestamp]
          );
        }

        for (const quarter of match.quarters) {
          for (const slot of quarter.slots) {
            const playerId = playerIdByName.get(slot.playerName);
            if (!playerId) {
              throw new Error(`Unknown player "${slot.playerName}" in lineup for ${match.date}.`);
            }
            if (slot.position === 'GK') {
              await client.query(
                `INSERT INTO lineup_quarter (id, fixture_id, quarter_number, wave, position, player_id, minutes, is_substitution, created_at, updated_at)
                 VALUES ($1, $2, $3, 'FULL', $4, $5, $6, FALSE, $7, $7)`,
                [
                  crypto.randomUUID(),
                  fixtureId,
                  quarter.number,
                  slot.position,
                  playerId,
                  slot.minutes,
                  fixtureTimestamp,
                ]
              );
            } else {
              const split = splitOutfieldMinutes(slot.minutes);
              if (split.first > 0) {
                await client.query(
                  `INSERT INTO lineup_quarter (id, fixture_id, quarter_number, wave, position, player_id, minutes, is_substitution, created_at, updated_at)
                   VALUES ($1, $2, $3, 'FIRST', $4, $5, $6, FALSE, $7, $7)`,
                  [
                    crypto.randomUUID(),
                    fixtureId,
                    quarter.number,
                    slot.position,
                    playerId,
                    split.first,
                    fixtureTimestamp,
                  ]
                );
              }
              if (split.second > 0) {
                await client.query(
                  `INSERT INTO lineup_quarter (id, fixture_id, quarter_number, wave, position, player_id, minutes, is_substitution, created_at, updated_at)
                   VALUES ($1, $2, $3, 'SECOND', $4, $5, $6, FALSE, $7, $7)`,
                  [
                    crypto.randomUUID(),
                    fixtureId,
                    quarter.number,
                    slot.position,
                    playerId,
                    split.second,
                    fixtureTimestamp,
                  ]
                );
              }
            }
          }
        }

        const hasResultDetails =
          match.resultCode !== 'VOID' ||
          match.goalsFor !== null ||
          match.goalsAgainst !== null ||
          match.playerOfMatch;

        if (hasResultDetails) {
          let playerOfMatchId = null;
          if (match.playerOfMatch) {
            playerOfMatchId = playerIdByName.get(match.playerOfMatch) ?? null;
          }

          await client.query(
            `INSERT INTO match_result (id, fixture_id, result_code, team_goals, opponent_goals, player_of_match_id, notes, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $7)`,
            [
              crypto.randomUUID(),
              fixtureId,
              match.resultCode,
              match.goalsFor,
              match.goalsAgainst,
              playerOfMatchId,
              fixtureTimestamp,
            ]
          );
        }

        for (const [name, count] of match.goalCounts.entries()) {
          const playerId = playerIdByName.get(name);
          if (!playerId) continue;
          await client.query(
            `INSERT INTO match_award (id, fixture_id, player_id, award_type, count, created_at)
             VALUES ($1, $2, $3, 'SCORER', $4, $5)`,
            [crypto.randomUUID(), fixtureId, playerId, count, fixtureTimestamp]
          );
        }

        for (const [name, count] of match.honorableCounts.entries()) {
          const playerId = playerIdByName.get(name);
          if (!playerId) continue;
          await client.query(
            `INSERT INTO match_award (id, fixture_id, player_id, award_type, count, created_at)
             VALUES ($1, $2, $3, 'HONORABLE_MENTION', $4, $5)`,
            [crypto.randomUUID(), fixtureId, playerId, count, fixtureTimestamp]
          );
        }

        for (const [name, minutes] of match.summary.entries()) {
          const playerId = playerIdByName.get(name);
          if (!playerId) continue;
          const gkQuarters = match.goalkeeperQuarters.get(name) ?? 0;
          const goals = match.goalCounts.get(name) ?? 0;
          const honorable = match.honorableCounts.get(name) ?? 0;
          const isPlayerOfMatch = match.playerOfMatch === name;

          await client.query(
            `INSERT INTO player_match_stat (id, fixture_id, player_id, total_minutes, goalkeeper_quarters, goals, assists, is_player_of_match, honorable_mentions, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
            [
              crypto.randomUUID(),
              fixtureId,
              playerId,
              minutes,
              gkQuarters,
              goals,
              0,
              isPlayerOfMatch,
              honorable,
              fixtureTimestamp,
            ]
          );
        }

        await client.query('RELEASE SAVEPOINT match_seed');
      } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT match_seed');
        matchIssues.push({
          date: match.date,
          opponent: match.opponent,
          reason: error instanceof Error ? error.message : String(error),
        });
        console.warn(
          `Skipping fixture ${match.date} vs ${match.opponent}: ${error instanceof Error ? error.message : error}`
        );
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }

  if (matchIssues.length > 0) {
    console.warn('\n⚠️  The following records require manual review:');
    matchIssues.forEach((issue) => {
      console.warn(` - ${issue.date} vs ${issue.opponent}: ${issue.reason}`);
    });
    console.warn('   Update data/FOOTBALL LINEUPS.xlsx and rerun the importer when resolved.');
  }

  console.log('\n✅ Seed complete. Backend API now has roster, fixtures, and stats data.\n');
})().catch((error) => {
  console.error('\nSeeding failed:', error);
  process.exit(1);
});
