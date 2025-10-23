import { beforeEach, describe, expect, it } from 'vitest';
import {
  addPlayer,
  clearRosterMemoryCache,
  getRosterAudit,
  listRoster,
  removePlayer,
  restorePlayer,
} from './roster';

describe('roster', () => {
  beforeEach(() => {
    localStorage.clear();
    clearRosterMemoryCache();
  });

  it('adds players and records audit events', async () => {
    const player = await addPlayer(' Alice ', 'coach');
    expect(player.name).toBe('Alice');
    expect(player.removedAt).toBeNull();

    const roster = await listRoster();
    expect(roster).toHaveLength(1);
    expect(roster[0]?.name).toBe('Alice');

    const audit = await getRosterAudit();
    expect(audit).toHaveLength(1);
    expect(audit[0]?.action).toBe('added');
    expect(audit[0]?.playerName).toBe('Alice');
  });

  it('prevents duplicate active names', async () => {
    await addPlayer('Jordan', 'coach');
    await expect(addPlayer('jordan', 'coach')).rejects.toThrow(
      'Player "jordan" already exists'
    );
  });

  it('marks players as removed and keeps them out of active roster', async () => {
    const player = await addPlayer('Taylor', 'manager');
    await removePlayer(player.id, 'manager');

    const activeOnly = await listRoster();
    expect(activeOnly).toHaveLength(0);

    const withRemoved = await listRoster({ includeRemoved: true });
    expect(withRemoved).toHaveLength(1);
    expect(withRemoved[0]?.removedAt).not.toBeNull();

    const audit = await getRosterAudit();
    expect(audit).toHaveLength(2);
    expect(audit[1]?.action).toBe('removed');
  });

  it('restores removed players and records audit', async () => {
    const player = await addPlayer('Morgan', 'coach');
    await removePlayer(player.id, 'coach');
    await restorePlayer(player.id, 'coach');

    const roster = await listRoster();
    expect(roster).toHaveLength(1);
    expect(roster[0]?.removedAt).toBeNull();

    const audit = await getRosterAudit();
    const actions = audit.map((entry) => entry.action);
    expect(actions).toEqual(['added', 'removed', 'restored']);
  });

  it('migrates legacy name arrays stored in localStorage', async () => {
    localStorage.setItem('ffm:roster', JSON.stringify(['Sam', 'Chris']));
    const roster = await listRoster();
    expect(roster.map((player) => player.name)).toEqual(['Chris', 'Sam']);

    const audit = await getRosterAudit();
    expect(audit).toHaveLength(0);
  });
});
