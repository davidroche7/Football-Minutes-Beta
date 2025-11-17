/**
 * Runtime configuration endpoint
 * Returns config that gets injected into frontend at runtime
 */
import type { Request, Response } from 'express';

export async function getConfig(req: Request, res: Response) {
  // Read from environment variables
  const useApi = (process.env.VITE_USE_API || 'true').toLowerCase() === 'true';
  const useApiPersistence = (process.env.VITE_USE_API_PERSISTENCE || process.env.VITE_USE_API || 'true').toLowerCase() === 'true';

  const config = {
    USE_API: useApi,
    USE_API_PERSISTENCE: useApiPersistence,
    API_BASE_URL: (process.env.VITE_API_BASE_URL || '/api').trim(),
    TEAM_ID: (process.env.VITE_TEAM_ID || '').trim(),
    ACTOR_ROLES: (process.env.VITE_ACTOR_ROLES || 'coach,analyst').split(',').map(r => r.trim()),
    SESSION_SECRET: (process.env.VITE_SESSION_SECRET || '').trim(),
  };

  // Warn if critical config is missing
  if (!config.TEAM_ID) {
    console.warn('⚠️  VITE_TEAM_ID environment variable is not set!');
  }
  if (!config.SESSION_SECRET) {
    console.warn('⚠️  VITE_SESSION_SECRET environment variable is not set!');
  }

  // Return as JavaScript that sets window.APP_CONFIG
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`window.APP_CONFIG = ${JSON.stringify(config, null, 2)};`);
}
