/**
 * Runtime configuration endpoint
 * Returns config that gets injected into frontend at runtime
 */
import type { Request, Response } from 'express';

export async function getConfig(req: Request, res: Response) {
  const config = {
    USE_API: true,
    USE_API_PERSISTENCE: true,
    API_BASE_URL: '/api',
    TEAM_ID: process.env.VITE_TEAM_ID || 'a0b6a1d3-19d7-4630-8b67-eaa8c33e4765',
    ACTOR_ROLES: (process.env.VITE_ACTOR_ROLES || 'coach,analyst').split(','),
    SESSION_SECRET: process.env.VITE_SESSION_SECRET || 'dev-session-secret',
  };

  // Return as JavaScript that sets window.APP_CONFIG
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`window.APP_CONFIG = ${JSON.stringify(config, null, 2)};`);
}
