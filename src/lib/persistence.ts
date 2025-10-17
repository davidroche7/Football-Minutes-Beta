import type { Allocation } from './types';

const STORAGE_KEY = 'ffm:matches';

export interface SaveMatchPayload {
  date: string;
  opponent: string;
  players: string[];
  allocation: Allocation;
  result?: MatchResult | null;
}

export interface MatchResult {
  venue?: string;
  result?: string;
  goalsFor?: number | null;
  goalsAgainst?: number | null;
  playerOfMatch?: string;
  honorableMentions?: string[];
  scorers?: string[];
}

export interface MatchEditEvent {
  id: string;
  field: 'opponent' | 'date';
  previousValue: string;
  newValue: string;
  editedAt: string;
  editedBy: string;
}

export interface MatchRecord extends SaveMatchPayload {
  id: string;
  createdAt: string;
  lastModifiedAt: string;
  editHistory: MatchEditEvent[];
}

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `match_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export async function saveMatch(payload: SaveMatchPayload): Promise<MatchRecord> {
  const record: MatchRecord = {
    ...payload,
    id: createId(),
    createdAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
    editHistory: [],
    result: payload.result ?? null,
  };

  const existingRaw = localStorage.getItem(STORAGE_KEY);
  const matches: MatchRecord[] = existingRaw ? JSON.parse(existingRaw) : [];
  matches.push(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));

  return record;
}

export async function listMatches(): Promise<MatchRecord[]> {
  const existingRaw = localStorage.getItem(STORAGE_KEY);
  if (!existingRaw) return [];
  try {
    return JSON.parse(existingRaw) as MatchRecord[];
  } catch {
    return [];
  }
}

export async function updateMatch(
  matchId: string,
  updates: Partial<Pick<MatchRecord, 'opponent' | 'date'>> & { editor: string }
): Promise<MatchRecord | null> {
  const existingRaw = localStorage.getItem(STORAGE_KEY);
  if (!existingRaw) return null;
  const matches: MatchRecord[] = JSON.parse(existingRaw);
  const index = matches.findIndex((match) => match.id === matchId);
  if (index === -1) return null;

  const match = matches[index]!;
  const now = new Date().toISOString();
  const editEvents: MatchEditEvent[] = [];

  if (updates.opponent && updates.opponent !== match.opponent) {
    editEvents.push({
      id: createId(),
      field: 'opponent',
      previousValue: match.opponent,
      newValue: updates.opponent,
      editedAt: now,
      editedBy: updates.editor,
    });
    match.opponent = updates.opponent;
  }

  if (updates.date && updates.date !== match.date) {
    editEvents.push({
      id: createId(),
      field: 'date',
      previousValue: match.date,
      newValue: updates.date,
      editedAt: now,
      editedBy: updates.editor,
    });
    match.date = updates.date;
  }

  if (editEvents.length === 0) {
    return match;
  }

  match.lastModifiedAt = now;
  match.editHistory = [...match.editHistory, ...editEvents];
  matches[index] = match;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
  return match;
}

export async function bulkImportMatches(
  payloads: SaveMatchPayload[]
): Promise<{ added: MatchRecord[]; skipped: number }> {
  if (payloads.length === 0) {
    return { added: [], skipped: 0 };
  }

  const existingRaw = localStorage.getItem(STORAGE_KEY);
  const matches: MatchRecord[] = existingRaw ? JSON.parse(existingRaw) : [];

  const now = new Date().toISOString();
  const existingKeys = new Set(matches.map((match) => `${match.date}|${match.opponent}`));
  const added: MatchRecord[] = [];
  let skipped = 0;

  payloads.forEach((payload) => {
    const key = `${payload.date}|${payload.opponent}`;
    if (existingKeys.has(key)) {
      skipped += 1;
      return;
    }

    const record: MatchRecord = {
      ...payload,
      id: createId(),
      createdAt: now,
      lastModifiedAt: now,
      editHistory: [],
      result: payload.result ?? null,
    };

    matches.push(record);
    existingKeys.add(key);
    added.push(record);
  });

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
  } catch (error) {
    console.warn('bulkImportMatches: unable to persist imported matches', error);
  }

  return { added, skipped };
}
