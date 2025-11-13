#!/usr/bin/env node
/**
 * Export all data from Beta database to JSON for migration to SW
 */

import { sql } from '@vercel/postgres';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function exportData() {
  console.log('🔄 Starting data export from Beta database...\n');

  try {
    // Export players
    console.log('📋 Exporting players...');
    const players = await sql`
      SELECT
        id,
        team_id,
        display_name,
        preferred_positions,
        squad_number,
        status,
        notes,
        created_at,
        updated_at,
        removed_at
      FROM player
      ORDER BY created_at ASC
    `;
    console.log(`   ✅ Exported ${players.rows.length} players`);

    // Export fixtures
    console.log('📋 Exporting fixtures...');
    const fixtures = await sql`
      SELECT
        id,
        team_id,
        opponent,
        fixture_date,
        location,
        duration_minutes,
        status,
        notes,
        goals_for,
        goals_against,
        result,
        allocation,
        gk_plan,
        scorers,
        assists,
        honorable_mentions,
        created_at,
        updated_at
      FROM fixture
      ORDER BY fixture_date ASC
    `;
    console.log(`   ✅ Exported ${fixtures.rows.length} fixtures`);

    // Export appearances (if they exist)
    console.log('📋 Exporting appearances...');
    let appearances = { rows: [] };
    try {
      appearances = await sql`
        SELECT
          id,
          fixture_id,
          player_id,
          minutes_played,
          started,
          position,
          notes,
          created_at,
          updated_at
        FROM appearance
        ORDER BY created_at ASC
      `;
      console.log(`   ✅ Exported ${appearances.rows.length} appearances`);
    } catch (err) {
      console.log(`   ⚠️  No appearances table (this is okay)`);
    }

    // Export audit events
    console.log('📋 Exporting audit events...');
    let auditEvents = { rows: [] };
    try {
      auditEvents = await sql`
        SELECT
          id,
          team_id,
          fixture_id,
          entity_type,
          entity_id,
          event_type,
          actor_id,
          actor_type,
          timestamp,
          changes
        FROM audit_event
        ORDER BY timestamp ASC
      `;
      console.log(`   ✅ Exported ${auditEvents.rows.length} audit events`);
    } catch (err) {
      console.log(`   ⚠️  No audit_event table (this is okay)`);
    }

    // Export rulesets (team config)
    console.log('📋 Exporting rulesets...');
    let rulesets = { rows: [] };
    try {
      rulesets = await sql`
        SELECT
          id,
          team_id,
          name,
          rules,
          created_at,
          updated_at
        FROM ruleset
        ORDER BY created_at ASC
      `;
      console.log(`   ✅ Exported ${rulesets.rows.length} rulesets`);
    } catch (err) {
      console.log(`   ⚠️  No ruleset table (this is okay)`);
    }

    // Build export object
    const exportData = {
      exportDate: new Date().toISOString(),
      source: 'Football-Minutes-Beta',
      teamId: process.env.VITE_TEAM_ID || '00000000-0000-0000-0000-000000000001',
      counts: {
        players: players.rows.length,
        fixtures: fixtures.rows.length,
        appearances: appearances.rows.length,
        auditEvents: auditEvents.rows.length,
        rulesets: rulesets.rows.length,
      },
      data: {
        players: players.rows,
        fixtures: fixtures.rows,
        appearances: appearances.rows,
        auditEvents: auditEvents.rows,
        rulesets: rulesets.rows,
      }
    };

    // Write to file
    const outputPath = join(__dirname, '..', 'migration-data.json');
    writeFileSync(outputPath, JSON.stringify(exportData, null, 2));

    console.log('\n✅ Export complete!');
    console.log(`📁 Data saved to: ${outputPath}`);
    console.log('\n📊 Summary:');
    console.log(`   Players:       ${exportData.counts.players}`);
    console.log(`   Fixtures:      ${exportData.counts.fixtures}`);
    console.log(`   Appearances:   ${exportData.counts.appearances}`);
    console.log(`   Audit Events:  ${exportData.counts.auditEvents}`);
    console.log(`   Rulesets:      ${exportData.counts.rulesets}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Export failed:', error);
    process.exit(1);
  }
}

exportData();
