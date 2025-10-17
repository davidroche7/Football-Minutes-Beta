import { beforeEach, describe, expect, it } from 'vitest';
import { listMatches, saveMatch, updateMatch } from './persistence';
import { CONFIG } from '../config/constants';

const sampleAllocation = {
  quarters: Array.from({ length: CONFIG.QUARTERS }, (_, quarterIndex) => ({
    quarter: (quarterIndex + 1) as 1 | 2 | 3 | 4,
    slots: [
      { player: 'P1', position: 'GK', minutes: CONFIG.TIME_BLOCKS.GK_FULL as const },
      { player: 'P2', position: 'DEF', minutes: CONFIG.TIME_BLOCKS.OUTFIELD_FIRST as const, wave: 'first' as const },
      { player: 'P3', position: 'DEF', minutes: CONFIG.TIME_BLOCKS.OUTFIELD_FIRST as const, wave: 'first' as const },
      { player: 'P4', position: 'ATT', minutes: CONFIG.TIME_BLOCKS.OUTFIELD_FIRST as const, wave: 'first' as const },
      { player: 'P5', position: 'ATT', minutes: CONFIG.TIME_BLOCKS.OUTFIELD_FIRST as const, wave: 'first' as const },
      { player: 'P6', position: 'DEF', minutes: CONFIG.TIME_BLOCKS.OUTFIELD_SECOND as const, wave: 'second' as const },
      { player: 'P7', position: 'DEF', minutes: CONFIG.TIME_BLOCKS.OUTFIELD_SECOND as const, wave: 'second' as const },
      { player: 'P8', position: 'ATT', minutes: CONFIG.TIME_BLOCKS.OUTFIELD_SECOND as const, wave: 'second' as const },
      { player: 'P9', position: 'ATT', minutes: CONFIG.TIME_BLOCKS.OUTFIELD_SECOND as const, wave: 'second' as const },
    ],
  })),
  summary: {
    P1: CONFIG.TIME_BLOCKS.GK_FULL * CONFIG.QUARTERS,
  },
} as const;

describe('persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves match records to local storage', async () => {
    const saved = await saveMatch({
      date: '2024-01-01',
      opponent: 'Rivals FC',
      players: ['P1', 'P2'],
      allocation: sampleAllocation,
    });

    expect(saved.id).toBeTruthy();
    const stored = await listMatches();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.opponent).toBe('Rivals FC');
  });

  it('updates match metadata and records audit history', async () => {
    const saved = await saveMatch({
      date: '2024-01-01',
      opponent: 'Old Opponent',
      players: ['P1'],
      allocation: sampleAllocation,
    });

    const updated = await updateMatch(saved.id, {
      opponent: 'New Opponent',
      editor: 'coach',
    });

    expect(updated).not.toBeNull();
    expect(updated?.opponent).toBe('New Opponent');
    expect(updated?.editHistory).toHaveLength(1);
    expect(updated?.editHistory[0]?.field).toBe('opponent');
  });
});
