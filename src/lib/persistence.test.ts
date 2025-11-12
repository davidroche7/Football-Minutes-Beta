import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listMatches, saveMatch, updateMatch } from './persistence';
import { CONFIG } from '../config/constants';

// Mock environment to force localStorage mode for these tests
vi.mock('../config/environment', () => ({
  USE_API_PERSISTENCE: false,
  API_BASE_URL: '/api',
  TEAM_ID: 'test-team',
  SESSION_SECRET: 'test-secret',
}));

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
      date: '2024-01-02',
      editor: 'coach',
    });

    expect(updated).not.toBeNull();
    expect(updated?.opponent).toBe('New Opponent');
    expect(updated?.date).toBe('2024-01-02');
    expect(updated?.editHistory).toHaveLength(2);
    expect(updated?.editHistory.map((e) => e.field)).toEqual(['opponent', 'date']);
  });

  it('updates match results and allocation with audit entries', async () => {
    const saved = await saveMatch({
      date: '2024-01-01',
      opponent: 'Rivals FC',
      players: ['P1', 'P2', 'P3'],
      allocation: {
        quarters: [
          {
            quarter: 1,
            slots: [
              { player: 'P1', position: 'GK', minutes: 10 },
              { player: 'P2', position: 'DEF', minutes: 10 },
              { player: 'P3', position: 'DEF', minutes: 10 },
              { player: 'P1', position: 'ATT', minutes: 10 },
              { player: 'P2', position: 'ATT', minutes: 10 },
            ],
          },
        ],
        summary: { P1: 20, P2: 20, P3: 10 },
      },
      result: null,
    });

    const newAllocation = {
      quarters: [
        {
          quarter: 1,
          slots: [
            { player: 'P2', position: 'GK', minutes: 10 },
            { player: 'P1', position: 'DEF', minutes: 10 },
            { player: 'P3', position: 'DEF', minutes: 10 },
            { player: 'P4', position: 'ATT', minutes: 10 },
            { player: 'P5', position: 'ATT', minutes: 10 },
          ],
        },
      ],
      summary: { P1: 10, P2: 10, P3: 10, P4: 10, P5: 10 },
    } as const;

    const updated = await updateMatch(saved.id, {
      result: {
        venue: 'Home',
        result: 'Win',
        goalsFor: 4,
        goalsAgainst: 2,
        playerOfMatch: 'P1',
        honorableMentions: ['P2'],
        scorers: ['P1', 'P4', 'P5', 'P1'],
      },
      allocation: newAllocation,
      editor: 'manager',
    });

    expect(updated).not.toBeNull();
    expect(updated?.result?.venue).toBe('Home');
    expect(updated?.result?.goalsFor).toBe(4);
    expect(updated?.allocation.summary).toEqual(newAllocation.summary);
    expect(updated?.players.sort()).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);
    const editedFields = updated?.editHistory.map((event) => event.field) ?? [];
    expect(editedFields).toContain('result.venue');
    expect(editedFields).toContain('result.scorers');
    expect(editedFields).toContain('allocation');
  });
});
