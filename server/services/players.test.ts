import { describe, expect, beforeEach, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock('../db/client', () => dbMocks);

import { createPlayer, updatePlayer } from './players';

const row = { id: 'p1', team_id: 't1', display_name: 'Ella', squad_group: 'BLACKS' };

describe('player squad', () => {
  const client = { query: vi.fn() };

  beforeEach(() => {
    client.query.mockReset();
    dbMocks.query.mockReset();
    dbMocks.withTransaction.mockReset();
    dbMocks.withTransaction.mockImplementation((fn: (c: typeof client) => unknown) => fn(client));
    client.query.mockResolvedValue({ rows: [row], rowCount: 1 });
    dbMocks.query.mockResolvedValue({ rows: [row], rowCount: 1 });
  });

  it('stores the squad on create and returns it', async () => {
    const player = await createPlayer({ teamId: 't1', displayName: 'Ella', squadGroup: 'BLACKS' });

    const [sql, params] = client.query.mock.calls[0]!;
    expect(sql).toMatch(/squad_group/);
    expect(params).toContain('BLACKS');
    expect(player.squadGroup).toBe('BLACKS');
  });

  it('creates untagged players with a NULL squad', async () => {
    await createPlayer({ teamId: 't1', displayName: 'Ella' });
    const params = client.query.mock.calls[0]![1] as unknown[];
    expect(params[params.length - 1]).toBeNull();
  });

  it('updates the squad, including clearing it', async () => {
    await updatePlayer('p1', { squadGroup: 'BOTH' });
    let [sql, params] = client.query.mock.calls[0]!;
    expect(sql).toMatch(/squad_group = \$1/);
    expect(params[0]).toBe('BOTH');

    client.query.mockClear();
    await updatePlayer('p1', { squadGroup: null });
    [sql, params] = client.query.mock.calls[0]!;
    expect(sql).toMatch(/squad_group = \$1/);
    expect(params[0]).toBeNull();
  });

  it('rejects an unknown squad without touching the database', async () => {
    await expect(createPlayer({ teamId: 't1', displayName: 'Ella', squadGroup: 'PURPLE' as never })).rejects.toThrow(
      'Invalid squad: PURPLE'
    );
    await expect(updatePlayer('p1', { squadGroup: 'reds' as never })).rejects.toThrow('Invalid squad: reds');
    expect(client.query).not.toHaveBeenCalled();
  });
});
