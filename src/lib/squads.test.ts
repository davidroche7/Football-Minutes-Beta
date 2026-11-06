import { describe, expect, it } from 'vitest';
import {
  filterBySquad,
  findSquadClashes,
  formatScore,
  isEligible,
  isPlayerSquad,
  isSquad,
  matchLabel,
} from './squads';

describe('squads', () => {
  it('validates squad values', () => {
    expect(isSquad('REDS')).toBe(true);
    expect(isSquad('BOTH')).toBe(false);
    expect(isSquad('reds')).toBe(false);
    expect(isPlayerSquad('BOTH')).toBe(true);
    expect(isPlayerSquad('PURPLE')).toBe(false);
    expect(isPlayerSquad(null)).toBe(false);
  });

  it('treats untagged and Both players as eligible for either squad', () => {
    expect(isEligible(null, 'REDS')).toBe(true);
    expect(isEligible(undefined, 'BLACKS')).toBe(true);
    expect(isEligible('BOTH', 'BLACKS')).toBe(true);
    expect(isEligible('REDS', 'REDS')).toBe(true);
    expect(isEligible('REDS', 'BLACKS')).toBe(false);
  });

  it('prefixes the squad on match labels only when the match has one', () => {
    expect(matchLabel('Linton', 'REDS')).toBe('Reds vs Linton');
    expect(matchLabel('Linton', 'BLACKS')).toBe('Blacks vs Linton');
    expect(matchLabel('Linton', null)).toBe('vs Linton');
    expect(matchLabel('Linton')).toBe('vs Linton');
  });

  it('shows home goals first for squad matches only', () => {
    expect(formatScore(3, 1, 'Away', 'REDS')).toBe('1 - 3');
    expect(formatScore(3, 1, 'AWAY', 'BLACKS')).toBe('1 - 3');
    expect(formatScore(3, 1, 'Home', 'BLACKS')).toBe('3 - 1');
    expect(formatScore(3, 1, 'Neutral', 'REDS')).toBe('3 - 1');
    // Pre-split match: unchanged, our goals first even when away
    expect(formatScore(3, 1, 'Away', null)).toBe('3 - 1');
    expect(formatScore(2, null, 'Neutral', 'REDS')).toBe('2 - —');
    expect(formatScore(null, 2, 'Away', 'REDS')).toBe('2 - —');
  });

  it('finds Both players already picked for the other squad on the same day', () => {
    const matches = [
      { date: '2026-11-14', opponent: 'Linton', players: ['Ella', 'Syd'], squad: 'REDS' as const },
      { date: '2026-11-14', opponent: 'Haverhill', players: ['India'], squad: 'BLACKS' as const },
      { date: '2026-11-21', opponent: 'Stansted', players: ['Charlotte'], squad: 'REDS' as const },
      { date: '2026-11-14', opponent: 'Old', players: ['Charlotte'], squad: null },
    ];

    expect(findSquadClashes(matches, '2026-11-14', 'BLACKS', ['Ella', 'India', 'Charlotte'])).toEqual({
      Ella: 'Reds vs Linton',
    });
    expect(findSquadClashes(matches, '2026-11-14', 'REDS', ['Ella'])).toEqual({});
    expect(findSquadClashes(matches, '2026-11-21', 'BLACKS', ['Ella'])).toEqual({});
  });

  it('filters matches by squad, empty meaning everything', () => {
    const matches = [{ squad: 'REDS' as const }, { squad: 'BLACKS' as const }, { squad: null }, {}];
    expect(filterBySquad(matches, '')).toHaveLength(4);
    expect(filterBySquad(matches, 'REDS')).toEqual([{ squad: 'REDS' }]);
  });
});
