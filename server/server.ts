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

// Middleware - CORS only needed in dev (frontend=localhost:3000, backend=localhost:3001)
// In production, frontend and backend are same-origin, no CORS needed
if (isDev) {
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }));
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Runtime config endpoint - MUST be before static file serving
import { getConfig } from './routes/config.js';
app.get('/config.js', getConfig);

// Health check - simple, no database dependency
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Serve static frontend files in production - MUST be after API routes
if (!isDev) {
  const frontendPath = path.join(__dirname, 'public');
  app.use(express.static(frontendPath));
}

// Admin endpoints (TEMPORARY - for initial setup)
import { runMigrations, seedTeam, seedRuleset, recalculateStats } from './routes/admin.js';
app.get('/admin/migrate', runMigrations);
app.get('/admin/seed-team', seedTeam);
app.get('/admin/seed-ruleset', seedRuleset);
app.get('/admin/recalculate-stats', recalculateStats);

// CSRF token endpoint (placeholder)
app.get('/api/session/csrf', (_req: Request, res: Response) => {
  // TODO: Implement real CSRF token generation
  res.cookie('ffm_csrf', 'dev-token', {
    httpOnly: false,  // Must be false so frontend JS can read the token
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
      actorId,
      req.body
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

app.delete('/api/fixtures/:fixtureId', async (req: Request, res: Response) => {
  try {
    const actorId = getActorId(req);
    await FixturesService.deleteFixture(req.params.fixtureId, actorId);
    res.status(204).send(); // 204 No Content on successful deletion
  } catch (error) {
    console.error('DELETE /api/fixtures/:fixtureId error:', error);
    if (error instanceof Error && error.message === 'Fixture not found') {
      return res.status(404).json({ error: 'Fixture not found' });
    }
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to delete fixture' });
  }
});

app.put('/api/fixtures/:fixtureId/lineup', async (req: Request, res: Response) => {
  try {
    const actorId = getActorId(req);
    const fixture = await FixturesService.replaceFixtureLineup(
      req.params.fixtureId,
      actorId,
      req.body
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
      actorId,
      req.body
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
    const seasonId = (req.query.seasonId as string) || undefined;
    const stats = await StatsService.getTeamSeasonSummary(teamId, seasonId);
    res.json({ data: stats });
  } catch (error) {
    console.error('GET /api/stats/team error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to get team stats' });
  }
});

app.get('/api/stats/players', async (req: Request, res: Response) => {
  try {
    const teamId = requireTeamId(req);
    const seasonId = (req.query.seasonId as string) || undefined;
    const stats = await StatsService.getPlayerSeasonSummary(teamId, seasonId);
    res.json({ data: stats });
  } catch (error) {
    console.error('GET /api/stats/players error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to get player stats' });
  }
});

// ============================================================================
// SEASONS ROUTES
// ============================================================================

import * as SeasonsService from './services/seasons.js';

app.get('/api/seasons', async (_req: Request, res: Response) => {
  try {
    const seasons = await SeasonsService.listSeasons();
    res.json({ data: seasons });
  } catch (error) {
    console.error('GET /api/seasons error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to list seasons' });
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

// SPA fallback - serve index.html for all non-API routes in production
// Use middleware instead of app.get('*') for Express 5 compatibility
if (!isDev) {
  app.use((_req: Request, res: Response, _next: NextFunction) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

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

import { getPool } from './db/client.js';
import fs from 'fs';

const HOST = process.env.HOST || '0.0.0.0';

/**
 * Run database migrations automatically on startup.
 * Applies every migration file under migrations/ that isn't already recorded
 * in schema_migrations, not just the first one.
 */
async function autoMigrate() {
  const pool = getPool();

  try {
    console.log('🔄 Checking database migrations...');

    // Create migrations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Migration files - in production they're in dist/migrations
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found at ${migrationsDir}`);
    }

    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    const applied = await pool.query('SELECT filename FROM schema_migrations');
    const appliedSet = new Set(applied.rows.map((r: { filename: string }) => r.filename));
    const pending = files.filter((f) => !appliedSet.has(f));

    if (pending.length === 0) {
      console.log('✓ Database schema is up to date\n');
      return;
    }

    for (const filename of pending) {
      const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
      console.log(`🔄 Applying migration ${filename}...`);

      // ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL,
      // so run enum migrations outside a transaction block.
      if (sql.includes('ADD VALUE')) {
        await pool.query(sql);
        await pool.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [filename]);
      } else {
        await pool.query('BEGIN');
        await pool.query(sql);
        await pool.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [filename]);
        await pool.query('COMMIT');
      }
    }

    console.log(`✅ ${pending.length} migration(s) applied\n`);
  } catch (error: any) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

/**
 * Start server with auto-migration
 */
async function startServer() {
  try {
    // Run migrations first
    await autoMigrate();

    // Then start Express server
    app.listen(PORT, HOST, () => {
      console.log(`🚀 Football Minutes API server running on http://${HOST}:${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔧 Health check: http://${HOST}:${PORT}/api/health\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
