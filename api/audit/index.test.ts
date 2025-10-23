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

vi.mock('../../server/services/audit', () => ({
  listAuditEvents: vi.fn(async () => []),
}));

describe('/api/audit security', () => {
  let handler: typeof import('./index').default;

  beforeEach(async () => {
    process.env.FFM_SESSION_SECRET = SECRET;
    vi.resetModules();
    handler = (await import('./index')).default;
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

  it('returns 400 when teamId missing and no entityId provided', async () => {
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
    expect(res.body).toMatchObject({ error: { code: 'TEAM_OR_ENTITY_REQUIRED' } });
  });

  it('allows GET with valid session and team header', async () => {
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
      query: { limit: '10' },
    } as unknown as VercelRequest;
    const res = createResponse();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ data: [] });
  });
});
