/* eslint-env node */
// Force rebuild - fixed server/api-routes imports
import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';

// Import individual route handlers from server/api-routes (named exports)
import { handler as healthHandler } from '../server/api-routes/health';
import { handler as csrfHandler } from '../server/api-routes/session/csrf';
import { handler as playersIndexHandler } from '../server/api-routes/players/index';
import { handler as playerByIdHandler } from '../server/api-routes/players/[playerId]';
import { handler as playerRestoreHandler } from '../server/api-routes/players/[playerId]/restore';
import { handler as fixturesIndexHandler } from '../server/api-routes/fixtures/index';
import { handler as fixtureByIdHandler } from '../server/api-routes/fixtures/[fixtureId]';
import { handler as fixtureLineupHandler } from '../server/api-routes/fixtures/[fixtureId]/lineup';
import { handler as fixtureLockHandler } from '../server/api-routes/fixtures/[fixtureId]/lock';
import { handler as fixtureResultHandler } from '../server/api-routes/fixtures/[fixtureId]/result';
import { handler as teamStatsHandler } from '../server/api-routes/stats/team';
import { handler as playerStatsHandler } from '../server/api-routes/stats/players';
import { handler as rulesetsActiveHandler } from '../server/api-routes/rulesets/active';
import { handler as auditIndexHandler } from '../server/api-routes/audit/index';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://football-minutes-beta.vercel.app', 'https://football-minutes-beta-dave-roches-projects.vercel.app']
    : '*',
  credentials: true,
}));
app.use(express.json());

// Helper to wrap Vercel handlers for Express
const wrapHandler = (handler: (req: VercelRequest, res: VercelResponse) => Promise<void>) => {
  return async (req: express.Request, res: express.Response) => {
    try {
      // Convert Express req/res to Vercel types
      const vercelReq = req as unknown as VercelRequest;
      const vercelRes = res as unknown as VercelResponse;

      await handler(vercelReq, vercelRes);

      // Ensure response is sent
      if (!res.headersSent) {
        res.end();
      }
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
};

// Register routes
app.get('/api/health', wrapHandler(healthHandler));
app.get('/api/session/csrf', wrapHandler(csrfHandler));

// Players routes
app.get('/api/players', wrapHandler(playersIndexHandler));
app.post('/api/players', wrapHandler(playersIndexHandler));
app.get('/api/players/:playerId', wrapHandler(playerByIdHandler));
app.put('/api/players/:playerId', wrapHandler(playerByIdHandler));
app.delete('/api/players/:playerId', wrapHandler(playerByIdHandler));
app.post('/api/players/:playerId/restore', wrapHandler(playerRestoreHandler));

// Fixtures routes
app.get('/api/fixtures', wrapHandler(fixturesIndexHandler));
app.post('/api/fixtures', wrapHandler(fixturesIndexHandler));
app.get('/api/fixtures/:fixtureId', wrapHandler(fixtureByIdHandler));
app.put('/api/fixtures/:fixtureId', wrapHandler(fixtureByIdHandler));
app.delete('/api/fixtures/:fixtureId', wrapHandler(fixtureByIdHandler));
app.put('/api/fixtures/:fixtureId/lineup', wrapHandler(fixtureLineupHandler));
app.post('/api/fixtures/:fixtureId/lock', wrapHandler(fixtureLockHandler));
app.put('/api/fixtures/:fixtureId/result', wrapHandler(fixtureResultHandler));

// Stats routes
app.get('/api/stats/team', wrapHandler(teamStatsHandler));
app.get('/api/stats/players', wrapHandler(playerStatsHandler));

// Rulesets routes
app.get('/api/rulesets/active', wrapHandler(rulesetsActiveHandler));

// Audit routes
app.get('/api/audit', wrapHandler(auditIndexHandler));

// Export for Vercel
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return new Promise((resolve, reject) => {
    // Set up completion tracking
    let completed = false;

    const complete = () => {
      if (!completed) {
        completed = true;
        resolve(undefined);
      }
    };

    // Track response completion
    res.on('finish', complete);
    res.on('close', complete);
    res.on('error', (error) => {
      if (!completed) {
        completed = true;
        reject(error);
      }
    });

    // Handle the request with Express
    app(req as any, res as any, (err?: any) => {
      if (err) {
        reject(err);
      } else {
        complete();
      }
    });
  });
}
