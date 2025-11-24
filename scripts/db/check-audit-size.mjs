#!/usr/bin/env node
import { Client } from 'pg';
import { config } from 'dotenv';
config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

try {
  await client.connect();

  // Count total audit events
  const countResult = await client.query(`
    SELECT COUNT(*) as total_events,
           MIN(created_at) as oldest,
           MAX(created_at) as newest
    FROM audit_event
  `);

  console.log('\n=== Audit Log Size ===');
  console.log(`Total events: ${countResult.rows[0].total_events}`);
  console.log(`Oldest event: ${countResult.rows[0].oldest}`);
  console.log(`Newest event: ${countResult.rows[0].newest}`);

  // Count by entity type
  const typeResult = await client.query(`
    SELECT entity_type, event_type, COUNT(*) as count
    FROM audit_event
    GROUP BY entity_type, event_type
    ORDER BY entity_type, event_type
  `);

  console.log('\n=== Events by Type ===');
  console.log('Entity      | Event    | Count');
  console.log('------------+----------+------');
  for (const row of typeResult.rows) {
    const entity = row.entity_type.padEnd(11);
    const event = row.event_type.padEnd(8);
    console.log(`${entity} | ${event} | ${row.count}`);
  }

  // Check table size
  const sizeResult = await client.query(`
    SELECT pg_size_pretty(pg_total_relation_size('audit_event')) as table_size
  `);

  console.log(`\n=== Database Size ===`);
  console.log(`audit_event table: ${sizeResult.rows[0].table_size}`);

  // Sample recent events
  const recentResult = await client.query(`
    SELECT entity_type, event_type, created_at
    FROM audit_event
    ORDER BY created_at DESC
    LIMIT 5
  `);

  console.log(`\n=== Recent Events (Last 5) ===`);
  for (const row of recentResult.rows) {
    console.log(`${row.created_at.toISOString().substring(0, 19)} | ${row.entity_type} ${row.event_type}`);
  }

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
