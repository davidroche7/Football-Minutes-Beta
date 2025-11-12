import { beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'test-session-secret';

const loadModule = async () => {
  process.env.FFM_SESSION_SECRET = SECRET;
  vi.resetModules();
  return import('./security') as Promise<typeof import('./security')>;
};

const createSessionToken = (actorId: string, issuedAt: string) => {
  const { createHmac } = require('node:crypto') as typeof import('node:crypto');
  const payload = `${actorId}|${issuedAt}`;
  const signature = createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}|${signature}`).toString('base64');
};

describe('security middleware', () => {
  beforeEach(() => {
    process.env.FFM_SESSION_SECRET = SECRET;
  });

  it('rejects missing session header', async () => {
    const { enforceSecurity } = await loadModule();
    const req = {
      method: 'GET',
      headers: {},
    } as any;

    expect(() => enforceSecurity(req, { requireAuthentication: true })).toThrowError(/Session token missing/);
  });

  it('rejects missing CSRF token on mutating request', async () => {
    const { enforceSecurity } = await loadModule();
    const issuedAt = new Date().toISOString();
    const sessionToken = createSessionToken('coach', issuedAt);

    const req = {
      method: 'POST',
      headers: {
        'x-ffm-session': sessionToken,
        'x-ffm-actor': 'coach',
        'x-ffm-roles': 'coach',
        'x-ffm-team': 'team-123',
        cookie: 'ffm_csrf=csrf-token',
      },
    } as any;

    expect(() =>
      enforceSecurity(req, { requireAuthentication: true, requireCsrf: true, allowedRoles: ['coach'] })
    ).toThrowError(/CSRF header missing/);
  });

  it('allows valid session and CSRF token', async () => {
    const { enforceSecurity } = await loadModule();
    const issuedAt = new Date().toISOString();
    const sessionToken = createSessionToken('coach', issuedAt);

    const req = {
      method: 'POST',
      headers: {
        'x-ffm-session': sessionToken,
        'x-ffm-actor': 'coach',
        'x-ffm-roles': 'coach',
        'x-ffm-team': 'team-123',
        'x-ffm-csrf': 'csrf-token',
        cookie: 'ffm_csrf=csrf-token',
      },
    } as any;

    const context = enforceSecurity(req, {
      requireAuthentication: true,
      requireCsrf: true,
      allowedRoles: ['coach'],
    });

    expect(context.actorId).toBe('coach');
    expect(context.teamIdHeader).toBe('team-123');
  });
});
