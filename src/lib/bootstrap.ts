import importedData from '../../data/imported-matches.json';
import type { Allocation, Quarter } from './types';
import type { MatchRecord, MatchResult } from './persistence';
import type { RosterPlayer, RosterAuditEntry } from './roster';

const MATCHES_KEY = 'ffm:matches';
const ROSTER_KEY = 'ffm:roster';

interface ImportedMatch {
  date?: string;
  opponent?: string;
  venue?: string;
  availablePlayers?: string[];
  quarters?: Array<{
    quarter?: number;
    slots?: Array<{
      player?: string;
      position?: string;
      minutes?: number;
    }>;
  }>;
  summary?: Record<string, number>;
  result?: {
    venue?: string;
    result?: string;
    goalsFor?: number;
    goalsAgainst?: number;
    playerOfMatch?: string;
    honorableMentions?: string[];
    scorers?: string[];
  } | null;
}

interface ImportedFile {
  matches?: ImportedMatch[];
}

const toTitleCase = (value: string): string => {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const normaliseName = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return toTitleCase(trimmed);
};

const normalisePlayers = (names: unknown): string[] => {
  if (!Array.isArray(names)) return [];
  const seen = new Set<string>();
  names.forEach((name) => {
    const normalised = normaliseName(name);
    if (normalised) {
      seen.add(normalised);
    }
  });
  return Array.from(seen);
};

const createId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const clampQuarter = (value: number): Quarter => {
  const clamped = Math.min(Math.max(Math.round(value), 1), 4);
  return clamped as Quarter;
};

const convertMatch = (match: ImportedMatch): MatchRecord | null => {
  const date = typeof match.date === 'string' ? match.date : null;
  const opponent = normaliseName(match.opponent) ?? 'Unknown Opponent';
  if (!date) {
    return null;
  }

  const quarters = Array.isArray(match.quarters)
    ? match.quarters
        .map((quarter, index) => {
          const quarterNumber = clampQuarter(
            typeof quarter?.quarter === 'number' ? quarter.quarter : index + 1
          );
          const slots = Array.isArray(quarter?.slots)
            ? quarter!.slots!
                .map((slot) => {
                  const player = normaliseName(slot?.player);
                  const position = typeof slot?.position === 'string' ? slot.position.toUpperCase() : null;
                  const minutes = typeof slot?.minutes === 'number' ? slot.minutes : 10;
                  if (!player) return null;
                  if (position !== 'GK' && position !== 'DEF' && position !== 'ATT') return null;
                  return {
                    player,
                    position,
                    minutes,
                  };
                })
                .filter((slot): slot is Allocation['quarters'][number]['slots'][number] => Boolean(slot))
            : [];
          if (slots.length === 0) {
            return null;
          }
          return {
            quarter: quarterNumber,
            slots,
          };
        })
        .filter((quarter): quarter is Allocation['quarters'][number] => Boolean(quarter))
    : [];

  if (quarters.length === 0) {
    return null;
  }

  const summary: Record<string, number> = {};
  if (match.summary && typeof match.summary === 'object') {
    Object.entries(match.summary).forEach(([name, minutes]) => {
      const normalised = normaliseName(name);
      const value = typeof minutes === 'number' ? minutes : Number(minutes);
      if (normalised && Number.isFinite(value)) {
        summary[normalised] = value;
      }
    });
  }

  if (Object.keys(summary).length === 0) {
    quarters.forEach((quarter) => {
      quarter.slots.forEach((slot) => {
        summary[slot.player] = (summary[slot.player] || 0) + slot.minutes;
      });
    });
  }

  if (Object.keys(summary).length === 0) {
    return null;
  }

  const allocation: Allocation = {
    quarters,
    summary,
  };

  const result: MatchResult | null =
    match.result && typeof match.result === 'object'
      ? {
          venue: normaliseName(match.result.venue) ?? undefined,
          result: match.result.result ? toTitleCase(match.result.result) : undefined,
          goalsFor:
            typeof match.result.goalsFor === 'number'
              ? match.result.goalsFor
              : Number.isFinite(Number(match.result.goalsFor))
              ? Number(match.result.goalsFor)
              : null,
          goalsAgainst:
            typeof match.result.goalsAgainst === 'number'
              ? match.result.goalsAgainst
              : Number.isFinite(Number(match.result.goalsAgainst))
              ? Number(match.result.goalsAgainst)
              : null,
          playerOfMatch: normaliseName(match.result.playerOfMatch) ?? undefined,
          honorableMentions: normalisePlayers(match.result.honorableMentions),
          scorers: normalisePlayers(match.result.scorers),
        }
      : null;

  const players = Array.from(
    new Set([
      ...normalisePlayers(match.availablePlayers),
      ...Object.keys(summary),
    ])
  ).sort((a, b) => a.localeCompare(b));

  const now = new Date().toISOString();
  return {
    id: createId('match'),
    date,
    opponent,
    players,
    allocation,
    createdAt: now,
    lastModifiedAt: now,
    editHistory: [],
    result,
  };
};

const buildRosterPayload = (matches: MatchRecord[]): { players: RosterPlayer[]; audit: RosterAuditEntry[] } => {
  const playerSet = new Set<string>();
  matches.forEach((match) => {
    match.players.forEach((player) => playerSet.add(player));
  });

  const now = new Date().toISOString();
  const players: RosterPlayer[] = Array.from(playerSet)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      id: createId('player'),
      name,
      createdAt: now,
      updatedAt: now,
      removedAt: null,
    }));

  return { players, audit: [] };
};

export function ensureSeedData() {
  if (typeof window === 'undefined') return;

  const importedFile = importedData as unknown as ImportedFile;
  if (!importedFile.matches || importedFile.matches.length === 0) {
    return;
  }

  const existingMatches = window.localStorage.getItem(MATCHES_KEY);
  const existingRoster = window.localStorage.getItem(ROSTER_KEY);

  if (existingMatches && existingRoster) {
    return;
  }

  const convertedMatches = importedFile.matches
    .map((match) => convertMatch(match))
    .filter((match): match is MatchRecord => Boolean(match));

  if (!existingMatches) {
    window.localStorage.setItem(MATCHES_KEY, JSON.stringify(convertedMatches));
  }

  if (!existingRoster) {
    const rosterPayload = buildRosterPayload(convertedMatches);
    window.localStorage.setItem(ROSTER_KEY, JSON.stringify(rosterPayload));
  }
}
