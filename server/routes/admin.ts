/**
 * Admin endpoints for setup/maintenance
 * REMOVE THESE IN PRODUCTION!
 */
import type { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function runMigrations(req: Request, res: Response) {
  try {
    const { stdout, stderr } = await execAsync('node scripts/db/migrate.cjs');
    res.json({
      success: true,
      stdout,
      stderr,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr,
    });
  }
}

export async function seedTeam(req: Request, res: Response) {
  try {
    const { stdout, stderr } = await execAsync('node scripts/seed-team.cjs');
    res.json({
      success: true,
      stdout,
      stderr,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr,
    });
  }
}
