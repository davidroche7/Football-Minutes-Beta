import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/environment', () => ({
  USE_API_PERSISTENCE: true,
  API_BASE_URL: '/api',
  TEAM_ID: 'team-1',
  SESSION_SECRET: 'test-secret',
}));

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('./apiClient', () => ({ apiRequest }));
vi.mock('./roster', () => ({
  listRoster: vi.fn(async () => [{ id: 'p1', name: 'Ella', removedAt: null }]),
}));

import { saveMatch, updateMatch } from './persistence';

const fixtureDetail = (squadGroup: string | null) => ({
  fixture: {
    id: 'f1',
    teamId: 'team-1',
    seasonId: 's1',
    opponent: 'Linton',
    fixtureDate: '2026-11-14',
    venueType: 'AWAY',
    squadGroup,
    status: 'LOCKED',
    lockedAt: null,
    finalisedAt: null,
    createdAt: '2026-11-06T00:00:00Z',
    updatedAt: '2026-11-06T00:00:00Z',
    result: null,
  },
  squad: [{ id: 'fp1', playerId: 'p1', displayName: 'Ella', role: 'STARTER', notes: null, removedAt: null }],
  quarters: [
    {
      id: 'q1',
      quarterNumber: 1,
      wave: 'FULL',
      position: 'GK',
      playerId: 'p1',
      playerName: 'Ella',
      minutes: 10,
      isSubstitution: false,
      squadRole: 'STARTER',
    },
  ],
  result: null,
  awards: [],
  stats: [],
});

describe('persistence squad (API mode)', () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it('sends the squad when creating a fixture and maps it back', async () => {
    apiRequest.mockImplementation(async (path: string, opts?: { method?: string }) => {
      if (path === '/fixtures' && opts?.method === 'POST') return { data: fixtureDetail('REDS').fixture };
      if (path === '/fixtures/f1') return { data: fixtureDetail('REDS') };
      return { data: null };
    });

    const saved = await saveMatch({
      date: '2026-11-14',
      opponent: 'Linton',
      players: ['Ella'],
      allocation: { quarters: [{ quarter: 1, slots: [{ player: 'Ella', position: 'GK', minutes: 10 }] }], summary: { Ella: 10 } },
      result: { venue: 'Away' },
      squad: 'REDS',
    });

    const post = apiRequest.mock.calls.find(([path, opts]) => path === '/fixtures' && opts?.method === 'POST')!;
    expect(post[1].body.squadGroup).toBe('REDS');
    expect(saved.squad).toBe('REDS');
  });

  it('maps a pre-split fixture to no squad and PATCHes a squad change', async () => {
    apiRequest.mockImplementation(async (path: string) => {
      if (path === '/fixtures/f1') return { data: fixtureDetail(null) };
      return { data: null };
    });

    await updateMatch('f1', { squad: 'BLACKS', editor: 'coach' });

    const patch = apiRequest.mock.calls.find(([path, opts]) => path === '/fixtures/f1' && opts?.method === 'PATCH')!;
    expect(patch[1].body).toEqual({ squadGroup: 'BLACKS' });
  });
});
