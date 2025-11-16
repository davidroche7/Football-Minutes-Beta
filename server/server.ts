/**
 * Express server for Football Minutes API
 * Works for both development and production
 */
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || process.env.API_PORT || 3001;
const isDev = process.env.NODE_ENV !== 'production';

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files in production
if (!isDev) {
  const frontendPath = path.join(__dirname, 'public');
  app.use(express.static(frontendPath));
}

// Request logging
if (isDev) {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// Helper to extract teamId from query
const requireTeamId = (req: Request): string => {
  const teamId = req.query.teamId as string;
  if (!teamId) {
    throw new Error('teamId query parameter is required');
  }
  return teamId;
};

// Helper to extract actorId from headers (session-based auth)
const getActorId = (req: Request): string | null => {
  // TODO: Extract from session when auth is implemented
  return req.headers['x-actor-id'] as string || null;
};

// ============================================================================
// ROUTES
// ============================================================================

// Health check - simple, no database dependency
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Root path health check (for Railway)
app.get('/', (_req: Request, res: Response) => {
  res.status(200).send('Football Minutes API - Server is running');
});

// Admin endpoints (TEMPORARY - for initial setup)
import { runMigrations, seedTeam, seedRuleset } from './routes/admin.js';
app.get('/admin/migrate', runMigrations);
app.get('/admin/seed-team', seedTeam);
app.get('/admin/seed-ruleset', seedRuleset);

// CSRF token endpoint (placeholder)
app.get('/api/session/csrf', (_req: Request, res: Response) => {
  // TODO: Implement real CSRF token generation
  res.cookie('ffm_csrf', 'dev-token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: !isDev
  });
  res.json({ token: 'dev-token' });
});

// ============================================================================
// PLAYERS ROUTES
// ============================================================================

import * as PlayersService from './services/players.js';

app.get('/api/players', async (req: Request, res: Response) => {
  try {
    const teamId = requireTeamId(req);
    const includeRemoved = req.query.includeRemoved === 'true';
    const players = await PlayersService.listPlayers(teamId, { includeRemoved });
    res.json({ data: players });
  } catch (error) {
    console.error('GET /api/players error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to list players' });
  }
});

app.post('/api/players', async (req: Request, res: Response) => {
  try {
    const teamId = requireTeamId(req);
    const actorId = getActorId(req);
    const player = await PlayersService.createPlayer({
      ...req.body,
      teamId,
      actorId,
    });
    res.status(201).json({ data: player });
  } catch (error) {
    console.error('POST /api/players error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create player' });
  }
});

app.get('/api/players/:playerId', async (req: Request, res: Response) => {
  try {
    const player = await PlayersService.getPlayer(req.params.playerId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json({ data: player });
  } catch (error) {
    console.error('GET /api/players/:playerId error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to get player' });
  }
});

app.patch('/api/players/:playerId', async (req: Request, res: Response) => {
  try {
    const actorId = getActorId(req);
    const player = await PlayersService.updatePlayer(req.params.playerId, {
      ...req.body,
      actorId,
    });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json({ data: player });
  } catch (error) {
    console.error('PATCH /api/players/:playerId error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update player' });
  }
});

app.delete('/api/players/:playerId', async (req: Request, res: Response) => {
  try {
    const actorId = getActorId(req);
    const player = await PlayersService.softDeletePlayer(req.params.playerId, actorId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json({ data: player });
  } catch (error) {
    console.error('DELETE /api/players/:playerId error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to delete player' });
  }
});

app.post('/api/players/:playerId/restore', async (req: Request, res: Response) => {
  try {
    const actorId = getActorId(req);
    const player = await PlayersService.restorePlayer(req.params.playerId, actorId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json({ data: player });
  } catch (error) {
    console.error('POST /api/players/:playerId/restore error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to restore player' });
  }
});

// ============================================================================
// FIXTURES ROUTES
// ============================================================================

import * as FixturesService from './services/fixtures.js';

app.get('/api/fixtures', async (req: Request, res: Response) => {
  try {
    const teamId = requireTeamId(req);
    const fixtures = await FixturesService.listFixtures({ teamId });
    res.json({ data: fixtures });
  } catch (error) {
    console.error('GET /api/fixtures error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to list fixtures' });
  }
});

app.post('/api/fixtures', async (req: Request, res: Response) => {
  try {
    const teamId = requireTeamId(req);
    const actorId = getActorId(req);
    const fixture = await FixturesService.createFixture({
      ...req.body,
      teamId,
      actorId,
    });
    res.status(201).json({ data: fixture });
  } catch (error) {
    console.error('POST /api/fixtures error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create fixture' });
  }
});

app.get('/api/fixtures/:fixtureId', async (req: Request, res: Response) => {
  try {
    const fixture = await FixturesService.getFixtureDetail(req.params.fixtureId);
    if (!fixture) {
      return res.status(404).json({ error: 'Fixture not found' });
    }
    res.json({ data: fixture });
  } catch (error) {
    console.error('GET /api/fixtures/:fixtureId error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to get fixture' });
  }
});

app.patch('/api/fixtures/:fixtureId', async (req: Request, res: Response) => {
  try {
    const actorId = getActorId(req);
    const fixture = await FixturesService.updateFixtureMetadata(
      req.params.fixtureId,
      req.body,
      actorId
    );
    if (!fixture) {
      return res.status(404).json({ error: 'Fixture not found' });
    }
    res.json({ data: fixture });
  } catch (error) {
    console.error('PATCH /api/fixtures/:fixtureId error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update fixture' });
  }
});

app.put('/api/fixtures/:fixtureId/lineup', async (req: Request, res: Response) => {
  try {
    const actorId = getActorId(req);
    const fixture = await FixturesService.replaceFixtureLineup(
      req.params.fixtureId,
      req.body,
      actorId
    );
    if (!fixture) {
      return res.status(404).json({ error: 'Fixture not found' });
    }
    res.json({ data: fixture });
  } catch (error) {
    console.error('PUT /api/fixtures/:fixtureId/lineup error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update lineup' });
  }
});

app.post('/api/fixtures/:fixtureId/lock', async (req: Request, res: Response) => {
  try {
    const actorId = getActorId(req);
    const fixture = await FixturesService.lockFixture(req.params.fixtureId, actorId);
    if (!fixture) {
      return res.status(404).json({ error: 'Fixture not found' });
    }
    res.json({ data: fixture });
  } catch (error) {
    console.error('POST /api/fixtures/:fixtureId/lock error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to lock fixture' });
  }
});

app.put('/api/fixtures/:fixtureId/result', async (req: Request, res: Response) => {
  try {
    const actorId = getActorId(req);
    const fixture = await FixturesService.setFixtureResult(
      req.params.fixtureId,
      req.body,
      actorId
    );
    if (!fixture) {
      return res.status(404).json({ error: 'Fixture not found' });
    }
    res.json({ data: fixture });
  } catch (error) {
    console.error('PUT /api/fixtures/:fixtureId/result error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to set result' });
  }
});

// ============================================================================
// STATS ROUTES
// ============================================================================

import * as StatsService from './services/stats.js';

app.get('/api/stats/team', async (req: Request, res: Response) => {
  try {
    const teamId = requireTeamId(req);
    const stats = await StatsService.getTeamSeasonSummary(teamId);
    res.json({ data: stats });
  } catch (error) {
    console.error('GET /api/stats/team error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to get team stats' });
  }
});

app.get('/api/stats/players', async (req: Request, res: Response) => {
  try {
    const teamId = requireTeamId(req);
    const stats = await StatsService.getPlayerSeasonSummary(teamId);
    res.json({ data: stats });
  } catch (error) {
    console.error('GET /api/stats/players error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to get player stats' });
  }
});

// ============================================================================
// RULESETS ROUTES
// ============================================================================

import * as RulesetsService from './services/rulesets.js';

app.get('/api/rulesets/active', async (req: Request, res: Response) => {
  try {
    const teamId = requireTeamId(req);
    const ruleset = await RulesetsService.getActiveRuleset(teamId);
    if (!ruleset) {
      return res.status(404).json({ error: 'No active ruleset found' });
    }
    res.json({ data: ruleset });
  } catch (error) {
    console.error('GET /api/rulesets/active error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to get ruleset' });
  }
});

// ============================================================================
// AUDIT ROUTES
// ============================================================================

import * as AuditService from './services/audit.js';

app.get('/api/audit', async (req: Request, res: Response) => {
  try {
    const options: any = {};
    if (req.query.teamId) options.teamId = req.query.teamId as string;
    if (req.query.entityType) options.entityType = req.query.entityType as string;
    if (req.query.entityId) options.entityId = req.query.entityId as string;
    if (req.query.limit) options.limit = parseInt(req.query.limit as string, 10);

    const events = await AuditService.listAuditEvents(options);
    res.json({ data: events });
  } catch (error) {
    console.error('GET /api/audit error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to list audit events' });
  }
});

// ============================================================================
// SPA FALLBACK (Production only - serve index.html for client-side routes)
// ============================================================================

if (!isDev) {
  // Catch-all route for SPA - must be last
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Skip API routes
    if (req.path.startsWith('/api/') || req.path.startsWith('/admin/')) {
      return next();
    }
    // For non-API routes, serve index.html (SPA routing)
    if (!req.path.includes('.')) {
      return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
    next();
  });
}

// ============================================================================
// ERROR HANDLERS
// ============================================================================

// 404 handler for API routes only
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin/')) {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: 'The requested endpoint does not exist',
    });
  } else {
    next();
  }
});

// Error handler
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', error);
  if (!res.headersSent) {
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      details: isDev ? error.message : undefined,
    });
  }
});

// ============================================================================
// START SERVER
// ============================================================================

const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`\n🚀 Football Minutes API server running on http://${HOST}:${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 Health check: http://${HOST}:${PORT}/api/health\n`);
});
