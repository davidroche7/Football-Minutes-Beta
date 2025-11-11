/**
 * Single Vercel serverless function wrapping all API routes
 * Consolidates multiple endpoints into one function for Hobby plan compatibility
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { type Request, type Response } from 'express';
import cors from 'cors';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Vercel function loader
interface VercelHandler {
  default: (req: VercelRequest, res: VercelResponse) => Promise<void> | void;
}

async function loadVercelFunction(filePath: string): Promise<VercelHandler> {
  try {
    return await import(`./${filePath}`) as VercelHandler;
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
  app[route.method as keyof typeof app](route.path, async (req: Request, res: Response) => {
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

// Export as Vercel serverless function
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Convert Vercel request to Express request and handle
  return new Promise<void>((resolve, reject) => {
    app(req as any, res as any, (err?: any) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
