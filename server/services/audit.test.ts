import { describe, expect, beforeEach, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('../db/client', () => dbMocks);

import { listAuditEvents } from './audit';

describe('listAuditEvents', () => {
  beforeEach(() => {
    dbMocks.query.mockReset();
  });

  it('uppercases entity type and applies team filter when provided', async () => {
    dbMocks.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'evt-1',
          actor_id: 'actor-1',
          entity_type: 'PLAYER',
          entity_id: 'player-1',
          event_type: 'updated',
          previous_state: null,
          next_state: { display_name: 'Alex' },
          metadata: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
    });

    const result = await listAuditEvents({ entityType: 'player', teamId: 'team-123' });

    expect(dbMocks.query).toHaveBeenCalledTimes(1);
    const [sql, params] = dbMocks.query.mock.calls[0]!;
    expect(sql).toContain('COALESCE(');
    expect(params).toEqual(['PLAYER', 'team-123']);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'evt-1',
      actorId: 'actor-1',
      entityType: 'PLAYER',
      entityId: 'player-1',
      eventType: 'updated',
      previousState: null,
      nextState: { display_name: 'Alex' },
      metadata: null,
      createdAt: '2024-01-01T00:00:00Z',
    });
  });
});
