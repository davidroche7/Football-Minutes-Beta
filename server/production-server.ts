/**
 * Express production server
 * Full-featured server for non-Vercel deployments
 */
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const app = express();
const PORT = process.env.PORT || process.env.API_PORT || 3001;

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'FFM_SESSION_SECRET'];
for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`ERROR: ${varName} environment variable is required`);
    process.exit(1);
  }
}

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (production-friendly)
if (process.env.NODE_ENV !== 'production') {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// Serve static frontend files
const frontendDist = join(projectRoot, 'dist');
app.use(express.static(frontendDist));

// Vercel function wrapper
interface VercelHandler {
  default: (req: Request, res: Response) => Promise<void> | void;
}

async function loadVercelFunction(filePath: string): Promise<VercelHandler> {
  const fullPath = join(projectRoot, 'api', filePath);
  try {
    return await import(fullPath) as VercelHandler;
  } catch (error) {
    console.error(`Failed to load API function: ${filePath}`, error);
    throw error;
  }
}

// API Routes - Dynamic imports for Vercel functions
const apiRoutes = [
  { method: 'get', path: '/health', handler: 'health.ts' },
  { method: 'get', path: '/session/csrf', handler: 'session/csrf.ts' },

  // Players
  { method: 'get', path: '/players', handler: 'players/index.ts' },
  { method: 'post', path: '/players', handler: 'players/index.ts' },
  { method: 'get', path: '/players/:playerId', handler: 'players/[playerId].ts' },
  { method: 'patch', path: '/players/:playerId', handler: 'players/[playerId].ts' },
  { method: 'delete', path: '/players/:playerId', handler: 'players/[playerId].ts' },
  { method: 'post', path: '/players/:playerId/restore', handler: 'players/[playerId]/restore.ts' },

  // Fixtures
  { method: 'get', path: '/fixtures', handler: 'fixtures/index.ts' },
  { method: 'post', path: '/fixtures', handler: 'fixtures/index.ts' },
  { method: 'get', path: '/fixtures/:fixtureId', handler: 'fixtures/[fixtureId].ts' },
  { method: 'patch', path: '/fixtures/:fixtureId', handler: 'fixtures/[fixtureId].ts' },
  { method: 'delete', path: '/fixtures/:fixtureId', handler: 'fixtures/[fixtureId].ts' },
  { method: 'put', path: '/fixtures/:fixtureId/lineup', handler: 'fixtures/[fixtureId]/lineup.ts' },
  { method: 'post', path: '/fixtures/:fixtureId/lock', handler: 'fixtures/[fixtureId]/lock.ts' },
  { method: 'put', path: '/fixtures/:fixtureId/result', handler: 'fixtures/[fixtureId]/result.ts' },

  // Stats
  { method: 'get', path: '/stats/team', handler: 'stats/team.ts' },
  { method: 'get', path: '/stats/players', handler: 'stats/players.ts' },

  // Rulesets
  { method: 'get', path: '/rulesets/active', handler: 'rulesets/active.ts' },

  // Audit
  { method: 'get', path: '/audit', handler: 'audit/index.ts' },
];

// Register API routes
for (const route of apiRoutes) {
  app[route.method as keyof typeof app](`/api${route.path}`, async (req: Request, res: Response) => {
    try {
      const handler = await loadVercelFunction(route.handler);

      // Transform Express req to Vercel Request format
      const vercelReq: any = {
        ...req,
        query: req.query,
        headers: req.headers,
        body: req.body,
        method: req.method,
        url: req.url,
      };

      // Transform Express res to Vercel Response format
      const vercelRes: any = res;

      await handler.default(vercelReq, vercelRes);
    } catch (error) {
      console.error(`Error handling ${route.method.toUpperCase()} ${route.path}:`, error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        });
      }
    }
  });
}

// Health check for the server itself
app.get('/dev/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    server: 'express-production-server',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
  });
});

// Serve frontend for all other routes (SPA fallback)
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(join(frontendDist, 'index.html'));
});

// Error handler
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', error);
  if (!res.headersSent) {
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Express production server running on port ${PORT}`);
  console.log(`📡 API endpoints available at /api/*`);
  console.log(`🌐 Frontend served from ${frontendDist}`);
  console.log(`🔧 Health check: /dev/health\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
