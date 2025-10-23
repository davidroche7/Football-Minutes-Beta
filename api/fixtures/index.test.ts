import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SECRET = 'test-session-secret';
const TEAM_ID = '11111111-2222-3333-4444-555555555555';

const createSessionToken = (actorId: string, issuedAt: string) => {
  const { createHmac } = require('node:crypto') as typeof import('node:crypto');
  const payload = `${actorId}|${issuedAt}`;
  const signature = createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}|${signature}`).toString('base64');
};

const createResponse = () => {
  const res: Partial<VercelResponse> & { statusCode: number; body: unknown } = {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name: string, value: string) {
      (this.headers as Record<string, string>)[name] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as VercelResponse & { statusCode: number; body: unknown; headers: Record<string, string> };
};

vi.mock('../../server/services/fixtures', () => ({
  listFixtures: vi.fn(async () => []),
  createFixture: vi.fn(async () => ({
    id: 'fixture-1',
    teamId: TEAM_ID,
    seasonId: null,
    opponent: 'Rivals FC',
    fixtureDate: '2024-04-01',
    venueType: 'HOME',
    status: 'LOCKED',
    lockedAt: null,
    finalisedAt: null,
    createdAt: '',
    updatedAt: '',
  })),
}));

describe('/api/fixtures security', () => {
  let handler: typeof import('./index').default;

  beforeEach(async () => {
    process.env.FFM_SESSION_SECRET = SECRET;
    vi.resetModules();
    handler = (await import('./index')).default;
  });

  it('returns 401 when session header missing on GET', async () => {
    const req = {
      method: 'GET',
      headers: {},
      query: { teamId: TEAM_ID },
    } as unknown as VercelRequest;
    const res = createResponse();

    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'SESSION_REQUIRED' } });
  });

  it('returns 403 when CSRF header missing on POST', async () => {
    const issuedAt = new Date().toISOString();
    const sessionToken = createSessionToken('coach', issuedAt);

    const req = {
      method: 'POST',
      headers: {
        'x-ffm-session': sessionToken,
        'x-ffm-actor': 'coach',
        'x-ffm-roles': 'coach',
        'x-ffm-team': TEAM_ID,
        cookie: 'ffm_csrf=csrf-token',
      },
      body: {
        teamId: TEAM_ID,
        opponent: 'Rivals FC',
        fixtureDate: '2024-04-01',
        venueType: 'HOME',
        squad: [{ playerId: '00000000-0000-0000-0000-000000000001', role: 'STARTER' }],
      },
    } as unknown as VercelRequest;
    const res = createResponse();

    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ error: { code: 'CSRF_TOKEN_MISSING' } });
  });

  it('allows POST with valid CSRF token', async () => {
    const issuedAt = new Date().toISOString();
    const sessionToken = createSessionToken('coach', issuedAt);

    const req = {
      method: 'POST',
      headers: {
        'x-ffm-session': sessionToken,
        'x-ffm-actor': 'coach',
        'x-ffm-roles': 'coach',
        'x-ffm-team': TEAM_ID,
        'x-ffm-csrf': 'csrf-token',
        cookie: 'ffm_csrf=csrf-token',
      },
      body: {
        teamId: TEAM_ID,
        opponent: 'Rivals FC',
        fixtureDate: '2024-04-01',
        venueType: 'HOME',
        squad: [{ playerId: '00000000-0000-0000-0000-000000000001', role: 'STARTER' }],
      },
    } as unknown as VercelRequest;
    const res = createResponse();

    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ data: { opponent: 'Rivals FC' } });
  });
});
