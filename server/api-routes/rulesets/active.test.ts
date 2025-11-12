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

type MockResponse = VercelResponse & { statusCode: number; body: unknown; headers: Record<string, string> };

const createResponse = (): MockResponse => {
  const res = {
    statusCode: 200,
    body: null,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string | number | readonly string[]) {
      res.headers[name] = String(value);
      return res as MockResponse;
    },
    status(code: number) {
      res.statusCode = code;
      return res as MockResponse;
    },
    json(payload: unknown) {
      res.body = payload;
      return res as MockResponse;
    },
    send() { return res as MockResponse; },
    redirect() { return res as MockResponse; },
  };
  return res as MockResponse;
};

vi.mock('../../server/services/rulesets', () => ({
  getActiveRuleset: vi.fn(async () => ({
    id: 'ruleset-1',
    teamId: TEAM_ID,
    name: 'Default',
    config: {},
    isActive: true,
    updatedAt: new Date().toISOString(),
    toggles: [],
  })),
}));

describe('/api/rulesets/active security', () => {
  let handler: typeof import('./active').default;

  beforeEach(async () => {
    process.env.FFM_SESSION_SECRET = SECRET;
    vi.resetModules();
    handler = (await import('./active')).default;
  });

  it('returns 401 when session header missing', async () => {
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

  it('returns 400 when teamId missing', async () => {
    const issuedAt = new Date().toISOString();
    const sessionToken = createSessionToken('coach', issuedAt);
    const req = {
      method: 'GET',
      headers: {
        'x-ffm-session': sessionToken,
        'x-ffm-actor': 'coach',
        'x-ffm-roles': 'coach',
      },
      query: {},
    } as unknown as VercelRequest;
    const res = createResponse();

    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'TEAM_ID_REQUIRED' } });
  });

  it('allows GET with valid session and team', async () => {
    const issuedAt = new Date().toISOString();
    const sessionToken = createSessionToken('coach', issuedAt);
    const req = {
      method: 'GET',
      headers: {
        'x-ffm-session': sessionToken,
        'x-ffm-actor': 'coach',
        'x-ffm-roles': 'coach',
        'x-ffm-team': TEAM_ID,
      },
      query: {},
    } as unknown as VercelRequest;
    const res = createResponse();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ data: { name: 'Default' } });
  });
});
