/**
 * Admin endpoints for setup/maintenance
 * REMOVE THESE IN PRODUCTION!
 */
import type { Request, Response } from 'express';
import { getPool } from '../db/client.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(req: Request, res: Response) {
  const pool = getPool();

  try {
    // Create migrations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Check if migration already applied
    const existing = await pool.query(
      `SELECT filename FROM schema_migrations WHERE filename = $1`,
      ['0001_init.sql']
    );

    if (existing.rows.length > 0) {
      return res.json({
        success: true,
        message: 'Migration already applied',
        migration: '0001_init.sql'
      });
    }

    // Read migration file - in production it's in dist/migrations
    const migrationPath = path.join(__dirname, 'migrations/0001_init.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Run migration in transaction
    await pool.query('BEGIN');
    await pool.query(sql);
    await pool.query(
      `INSERT INTO schema_migrations (filename) VALUES ($1)`,
      ['0001_init.sql']
    );
    await pool.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration applied successfully',
      migration: '0001_init.sql'
    });
  } catch (error: any) {
    await pool.query('ROLLBACK').catch(() => {});
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}

export async function seedTeam(req: Request, res: Response) {
  const pool = getPool();

  try {
    // Check if team exists first
    const existing = await pool.query(`SELECT id, name FROM team LIMIT 1`);

    if (existing.rows.length > 0) {
      const team = existing.rows[0];
      return res.json({
        success: true,
        team: {
          id: team.id,
          name: team.name
        },
        message: `Team already exists with ID: ${team.id}`,
        alreadyExists: true
      });
    }

    const result = await pool.query(`
      INSERT INTO team (name)
      VALUES ('Test Team')
      RETURNING id, name
    `);

    const team = result.rows[0];

    res.json({
      success: true,
      team: {
        id: team.id,
        name: team.name
      },
      message: `Team created with ID: ${team.id}`,
      alreadyExists: false
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}

export async function seedRuleset(req: Request, res: Response) {
  const pool = getPool();

  try {
    // Get team ID
    const teamResult = await pool.query(`SELECT id FROM team LIMIT 1`);
    if (teamResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No team found. Run /admin/seed-team first.'
      });
    }
    const teamId = teamResult.rows[0].id;

    // Check if ruleset exists
    const existing = await pool.query(
      `SELECT id, name, is_active FROM ruleset WHERE team_id = $1 AND is_active = TRUE LIMIT 1`,
      [teamId]
    );

    if (existing.rows.length > 0) {
      const ruleset = existing.rows[0];
      return res.json({
        success: true,
        ruleset: {
          id: ruleset.id,
          name: ruleset.name,
          isActive: ruleset.is_active
        },
        message: `Active ruleset already exists with ID: ${ruleset.id}`,
        alreadyExists: true
      });
    }

    // Create default ruleset
    const defaultConfig = {
      quarters: 4,
      quarterDuration: 10,
      waves: { first: 5, second: 5 },
      positions: { GK: 1, DEF: 2, ATT: 2 },
      fairness: { maxVariance: 5, gkRequiresOutfield: true }
    };

    const result = await pool.query(`
      INSERT INTO ruleset (team_id, name, config_json, is_active)
      VALUES ($1, 'Default Rules', $2, TRUE)
      RETURNING id, name, is_active
    `, [teamId, JSON.stringify(defaultConfig)]);

    const ruleset = result.rows[0];

    res.json({
      success: true,
      ruleset: {
        id: ruleset.id,
        name: ruleset.name,
        isActive: ruleset.is_active
      },
      message: `Ruleset created with ID: ${ruleset.id}`,
      alreadyExists: false
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}
