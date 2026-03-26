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

    // Find migration files
    let migrationsDir = path.join(__dirname, '../server/db/migrations');
    if (!fs.existsSync(migrationsDir)) {
      migrationsDir = path.join(__dirname, '../dist/migrations');
    }
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found`);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    // Get already-applied migrations
    const applied = await pool.query('SELECT filename FROM schema_migrations');
    const appliedSet = new Set(applied.rows.map(r => r.filename));

    const pending = files.filter(f => !appliedSet.has(f));

    if (pending.length === 0) {
      console.log('✓ All migrations already applied');
      console.log('\n✅ Database is up to date!');
      process.exit(0);
    }

    for (const filename of pending) {
      const filePath = path.join(migrationsDir, filename);
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`🔄 Applying ${filename} (${sql.length} bytes)...`);

      // ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL,
      // so run enum migrations outside a transaction block
      if (sql.includes('ADD VALUE')) {
        await pool.query(sql);
        await pool.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
      } else {
        await pool.query('BEGIN');
        await pool.query(sql);
        await pool.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await pool.query('COMMIT');
      }

      console.log(`✓ ${filename} applied`);
    }

    console.log(`\n✅ ${pending.length} migration(s) applied successfully!`);
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
