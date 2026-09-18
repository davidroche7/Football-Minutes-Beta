import { describe, expect, beforeEach, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock('../db/client', () => dbMocks);
vi.mock('./audit', () => ({ recordFixtureAudit: vi.fn() }));

import { createFixture } from './fixtures';

describe('createFixture', () => {
  const client = { query: vi.fn() };

  beforeEach(() => {
    client.query.mockReset();
    dbMocks.withTransaction.mockReset();
    dbMocks.withTransaction.mockImplementation((fn: (c: typeof client) => unknown) => fn(client));
    client.query.mockResolvedValue({
      rows: [{ id: 'f1', team_id: 't1', season_id: 's1', opponent: 'X', fixture_date: '2026-09-19' }],
      rowCount: 1,
    });
  });

  // Regression: fixtures saved with season_id NULL were counted by the stats views
  // (COALESCE with team.season_id) but hidden by the season-filtered games list.
  it('defaults season_id to the team season when none is supplied', async () => {
    await createFixture({
      teamId: 't1',
      opponent: 'X',
      fixtureDate: '2026-09-19',
      venueType: 'HOME',
      squad: [],
      createdBy: null,
    });

    const [sql, params] = client.query.mock.calls[0]!;
    expect(sql).toMatch(/COALESCE\(\$2::uuid, \(SELECT season_id FROM team WHERE id = \$1\)\)/);
    expect(params[1]).toBeNull();
  });

  it('passes an explicit season through unchanged', async () => {
    await createFixture({
      teamId: 't1',
      seasonId: 's-explicit',
      opponent: 'X',
      fixtureDate: '2026-09-19',
      venueType: 'HOME',
      squad: [],
      createdBy: null,
    });

    expect(client.query.mock.calls[0]![1][1]).toBe('s-explicit');
  });
});
