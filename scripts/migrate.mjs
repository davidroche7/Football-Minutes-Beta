#!/usr/bin/env node
/**
 * Run database migrations
 * Used by Procfile release phase and can be run manually
 */

import pkg from 'pg';
const { Pool } = pkg;
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

async function migrate() {
  try {
    console.log('🔄 Running database migrations...\n');

    // Create migrations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✓ Migrations tracking table ready');

    // Check if migration already applied
    const existing = await pool.query(
      `SELECT filename FROM schema_migrations WHERE filename = $1`,
      ['0001_init.sql']
    );

    if (existing.rows.length > 0) {
      console.log('✓ Migration 0001_init.sql already applied');
      console.log('\n✅ Database is up to date!');
      process.exit(0);
    }

    // Read migration file - check both locations (dev and production)
    let migrationPath = path.join(__dirname, '../server/db/migrations/0001_init.sql');
    if (!fs.existsSync(migrationPath)) {
      migrationPath = path.join(__dirname, '../dist/migrations/0001_init.sql');
    }

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found at ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(`✓ Loaded migration: 0001_init.sql (${sql.length} bytes)`);

    // Run migration in transaction
    console.log('🔄 Applying migration...');
    await pool.query('BEGIN');
    await pool.query(sql);
    await pool.query(
      `INSERT INTO schema_migrations (filename) VALUES ($1)`,
      ['0001_init.sql']
    );
    await pool.query('COMMIT');

    console.log('✓ Migration applied successfully');
    console.log('\n✅ Database migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    await pool.query('ROLLBACK').catch(() => {});
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
