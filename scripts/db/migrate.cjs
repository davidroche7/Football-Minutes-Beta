#!/usr/bin/env node
/**
 * Lightweight migration runner for Football Minutes backend schema.
 *
 * - Looks for SQL files under server/db/migrations
 * - Applies them in lexical order
 * - Records applied filenames in schema_migrations table
 *
 * Usage:
 *   DATABASE_URL=postgres://... npm run db:migrate
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../server/db/migrations');

function getDatabaseUrl() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL_NON_POOLING,
  ];
  const url = candidates.find((value) => typeof value === 'string' && value.length > 0);
  if (!url) {
    throw new Error('DATABASE_URL (or POSTGRES_URL*) environment variable is required.');
  }
  return url;
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

async function appliedMigrations(client) {
  const { rows } = await client.query('SELECT filename FROM schema_migrations ORDER BY filename ASC;');
  return new Set(rows.map((row) => row.filename));
}

async function applyMigration(client, filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`→ Applying ${filename}`);
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1);', [filename]);
    await client.query('COMMIT');
    console.log(`✓ Applied ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`✗ Failed ${filename}`);
    throw error;
  }
}

async function run() {
  const databaseUrl = getDatabaseUrl();
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    await ensureMigrationsTable(client);

    const files = listMigrationFiles();
    const done = await appliedMigrations(client);

    const pending = files.filter((file) => !done.has(file));
    if (pending.length === 0) {
      console.log('No pending migrations.');
      return;
    }

    for (const file of pending) {
      await applyMigration(client, file);
    }
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
