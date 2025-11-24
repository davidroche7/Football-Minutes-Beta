import type { Allocation } from './types';
import { USE_API_PERSISTENCE, TEAM_ID } from '../config/environment';
import { apiRequest } from './apiClient';
import { listRoster } from './roster';
import type {
  MatchEditEvent,
  MatchEditField,
  MatchRecord,
  MatchResult,
  MatchUpdatePayload as MatchUpdatePayloadType,
  SaveMatchPayload,
} from './matchTypes';
export type {
  MatchEditEvent,
  MatchEditField,
  MatchRecord,
  MatchResult,
  MatchUpdatePayload,
  SaveMatchPayload,
} from './matchTypes';

const STORAGE_KEY = 'ffm:matches';
const isBrowser = typeof window !== 'undefined';
const canUseApi = (teamIdOverride?: string) =>
  USE_API_PERSISTENCE && isBrowser && Boolean(teamIdOverride ?? TEAM_ID);

type MatchPersistenceMode = 'api' | 'local' | 'fallback';
let matchPersistenceMode: MatchPersistenceMode = canUseApi() ? 'api' : 'local';
let matchPersistenceError: Error | null = null;

const setMatchPersistenceState = (mode: MatchPersistenceMode, error?: unknown) => {
  matchPersistenceMode = mode;
  if (error instanceof Error) {
    matchPersistenceError = error;
  } else if (typeof error === 'string') {
    matchPersistenceError = new Error(error);
  } else if (error) {
    matchPersistenceError = new Error('Unexpected match persistence error');
  } else {
    matchPersistenceError = null;
  }
};

const logApiFallback = (error: unknown) => {
  console.warn('Match API unavailable, falling back to local persistence.', error);
};

const resolveTeamId = (teamIdOverride?: string) => {
  const resolved = teamIdOverride ?? TEAM_ID;
  if (!resolved) {
    throw new Error('TEAM_ID environment variable is required for API match operations.');
  }
  return resolved;
};

if (USE_API_PERSISTENCE && isBrowser && !TEAM_ID) {
  setMatchPersistenceState(
    'fallback',
    'TEAM_ID environment variable is required when VITE_USE_API is true.'
  );
}

interface ApiFixtureSummary {
  id: string;
  teamId: string;
  seasonId: string | null;
  opponent: string;
  fixtureDate: string;
  venueType: 'HOME' | 'AWAY' | 'NEUTRAL';
  status: 'DRAFT' | 'LOCKED' | 'FINAL';
  lockedAt: string | null;
  finalisedAt: string | null;
  createdAt: string;
  updatedAt: string;
  result?: {
    resultCode: 'WIN' | 'DRAW' | 'LOSS' | 'ABANDONED' | 'VOID';
    teamGoals: number | null;
    opponentGoals: number | null;
  } | null;
}

interface ApiFixturePlayer {
  id: string;
  playerId: string;
  displayName: string;
  role: 'STARTER' | 'BENCH';
  notes: string | null;
  removedAt: string | null;
}

interface ApiLineupSlot {
  id: string;
  quarterNumber: number;
  wave: 'FULL' | 'FIRST' | 'SECOND';
  position: 'GK' | 'DEF' | 'ATT';
  playerId: string;
  playerName: string;
  minutes: number;
  isSubstitution: boolean;
  squadRole: 'STARTER' | 'BENCH' | null;
}

interface ApiMatchAward {
  id: string;
  playerId: string;
  playerName: string;
  awardType: 'SCORER' | 'HONORABLE_MENTION' | 'ASSIST';
  count: number;
}

interface ApiMatchResultDetail {
  id: string;
  fixture_id: string;
  result_code: 'WIN' | 'DRAW' | 'LOSS' | 'ABANDONED' | 'VOID';
  team_goals: number | null;
  opponent_goals: number | null;
  player_of_match_id: string | null;
  player_name: string | null;
  notes: string | null;
}

interface ApiFixtureDetail {
  fixture: ApiFixtureSummary;
  squad: ApiFixturePlayer[];
  quarters: ApiLineupSlot[];
  result: ApiMatchResultDetail | null;
  awards: ApiMatchAward[];
  stats: Array<{
    player_id: string;
    total_minutes: number;
    goals: number;
    assists: number;
    is_player_of_match: boolean;
    honorable_mentions: number;
  }>;
}

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `match_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

async function saveMatchLocal(payload: SaveMatchPayload): Promise<MatchRecord> {
  if (!isBrowser) {
    throw new Error('localStorage unavailable in this environment');
  }
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

async function listMatchesLocal(): Promise<MatchRecord[]> {
  if (!isBrowser) return [];
  const existingRaw = localStorage.getItem(STORAGE_KEY);
  if (!existingRaw) return [];
  try {
    return JSON.parse(existingRaw) as MatchRecord[];
  } catch {
    return [];
  }
}

async function updateMatchLocal(
  matchId: string,
  updates: MatchUpdatePayloadType
): Promise<MatchRecord | null> {
  if (!isBrowser) return null;
  const existingRaw = localStorage.getItem(STORAGE_KEY);
  if (!existingRaw) return null;
  const matches: MatchRecord[] = JSON.parse(existingRaw);
  const index = matches.findIndex((match) => match.id === matchId);
  if (index === -1) return null;

  const match = matches[index]!;
  const now = new Date().toISOString();
  const editEvents: MatchEditEvent[] = [];

  if (typeof updates.opponent === 'string' && updates.opponent !== match.opponent) {
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

  if (typeof updates.date === 'string' && updates.date !== match.date) {
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

  if (typeof updates.time === 'string' && updates.time !== match.time) {
    editEvents.push({
      id: createId(),
      field: 'time',
      previousValue: match.time || '',
      newValue: updates.time,
      editedAt: now,
      editedBy: updates.editor,
    });
    match.time = updates.time;
  }

  if ('result' in updates) {
    const previousResult = match.result ?? null;
    const nextResult = updates.result ?? null;

    const serializeArray = (value: string[] | undefined | null) => (value && value.length > 0 ? value.join(', ') : '');
    const serializeNumber = (value: number | null | undefined) =>
      value === null || value === undefined ? '' : String(value);

    const changes: Array<{ field: MatchEditField; prev: string; next: string }> = [];

    const compareStringField = (
      field: MatchEditField,
      prev: string | undefined | null,
      next: string | undefined | null
    ) => {
      const prevValue = prev ?? '';
      const nextValue = next ?? '';
      if (prevValue !== nextValue) {
        changes.push({ field, prev: prevValue, next: nextValue });
      }
    };

    const compareArrayField = (
      field: MatchEditField,
      prev: string[] | undefined | null,
      next: string[] | undefined | null
    ) => {
      const prevValue = serializeArray(prev ?? undefined);
      const nextValue = serializeArray(next ?? undefined);
      if (prevValue !== nextValue) {
        changes.push({ field, prev: prevValue, next: nextValue });
      }
    };

    const compareNumberField = (
      field: MatchEditField,
      prev: number | null | undefined,
      next: number | null | undefined
    ) => {
      const prevValue = serializeNumber(prev ?? undefined);
      const nextValue = serializeNumber(next ?? undefined);
      if (prevValue !== nextValue) {
        changes.push({ field, prev: prevValue, next: nextValue });
      }
    };

    compareStringField('result.venue', previousResult?.venue, nextResult?.venue);
    compareStringField('result.result', previousResult?.result, nextResult?.result);
    compareNumberField('result.goalsFor', previousResult?.goalsFor, nextResult?.goalsFor);
    compareNumberField('result.goalsAgainst', previousResult?.goalsAgainst, nextResult?.goalsAgainst);
    compareStringField('result.playerOfMatch', previousResult?.playerOfMatch, nextResult?.playerOfMatch);
    compareArrayField('result.honorableMentions', previousResult?.honorableMentions ?? null, nextResult?.honorableMentions ?? null);
    compareArrayField('result.scorers', previousResult?.scorers ?? null, nextResult?.scorers ?? null);

    if (changes.length > 0) {
      changes.forEach(({ field, prev, next }) => {
        editEvents.push({
          id: createId(),
          field,
          previousValue: prev,
          newValue: next,
          editedAt: now,
          editedBy: updates.editor,
        });
      });
    }

    match.result = nextResult;
  }

  if (updates.allocation) {
    const serializedPrev = JSON.stringify(match.allocation);
    const serializedNext = JSON.stringify(updates.allocation);
    if (serializedPrev !== serializedNext) {
      editEvents.push({
        id: createId(),
        field: 'allocation',
        previousValue: serializedPrev,
        newValue: serializedNext,
        editedAt: now,
        editedBy: updates.editor,
      });
      match.allocation = updates.allocation;
      if (updates.players && updates.players.length > 0) {
        match.players = [...updates.players];
      } else {
        match.players = Object.keys(updates.allocation.summary).sort((a, b) => a.localeCompare(b));
      }
    }
  } else if (updates.players && updates.players.length > 0) {
    match.players = updates.players;
  }

  if (editEvents.length === 0) {
    return match;
  }

  match.lastModifiedAt = now;
  match.editHistory = [...(match.editHistory || []), ...editEvents];
  matches[index] = match;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
  return match;
}

async function bulkImportMatchesLocal(
  payloads: SaveMatchPayload[]
): Promise<{ added: MatchRecord[]; skipped: number }> {
  if (!isBrowser) {
    return { added: [], skipped: 0 };
  }
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

const toTitleCase = (value: string): string =>
  value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

const normaliseNameKey = (value: string) => value.trim().toLowerCase();

const mapVenueToApi = (venue?: string): 'HOME' | 'AWAY' | 'NEUTRAL' => {
  const key = venue ? venue.trim().toLowerCase() : '';
  if (key === 'away') return 'AWAY';
  if (key === 'neutral') return 'NEUTRAL';
  return 'HOME';
};

const mapVenueToDisplay = (venue?: string | null): string | undefined => {
  if (!venue) return undefined;
  if (venue === 'HOME' || venue === 'AWAY' || venue === 'NEUTRAL') {
    return venue.charAt(0) + venue.slice(1).toLowerCase();
  }
  return toTitleCase(venue);
};

const mapResultCodeToOutcome = (code: string | undefined | null): string | undefined => {
  if (!code) return undefined;
  const upper = code.toUpperCase();
  if (upper === 'WIN') return 'Win';
  if (upper === 'LOSS') return 'Loss';
  if (upper === 'DRAW') return 'Draw';
  if (upper === 'ABANDONED') return 'Abandoned';
  if (upper === 'VOID') return 'Void';
  return toTitleCase(code);
};

const mapOutcomeToResultCode = (outcome?: string | null): 'WIN' | 'DRAW' | 'LOSS' | 'ABANDONED' | 'VOID' => {
  if (!outcome) return 'VOID';
  const key = outcome.trim().toLowerCase();
  if (key === 'win') return 'WIN';
  if (key === 'loss') return 'LOSS';
  if (key === 'draw') return 'DRAW';
  if (key === 'abandoned') return 'ABANDONED';
  return 'VOID';
};

const hasResultDetails = (result?: MatchResult | null): result is MatchResult => {
  if (!result) return false;
  return Boolean(
    result.result ||
      result.goalsFor !== undefined ||
      result.goalsAgainst !== undefined ||
      (result.playerOfMatch && result.playerOfMatch.trim()) ||
      (Array.isArray(result.scorers) && result.scorers.length > 0) ||
      (Array.isArray(result.honorableMentions) && result.honorableMentions.length > 0)
  );
};

const convertAllocationToSlots = (allocation: Allocation, idMap: Map<string, string>) => {
  const slots: Array<{
    quarterNumber: number;
    wave: 'FULL' | 'FIRST' | 'SECOND';
    position: 'GK' | 'DEF' | 'ATT';
    playerId: string;
    minutes: number;
    isSubstitution: boolean;
  }> = [];

  allocation.quarters.forEach((quarter) => {
    quarter.slots.forEach((slot) => {
      const key = normaliseNameKey(slot.player);
      const playerId = idMap.get(key);
      if (!playerId) {
        throw new Error(`Unknown player "${slot.player}" when building lineup payload`);
      }
      let wave: 'FULL' | 'FIRST' | 'SECOND' = 'FULL';
      if (slot.position !== 'GK') {
        if (slot.wave === 'first') wave = 'FIRST';
        else if (slot.wave === 'second') wave = 'SECOND';
      }
      slots.push({
        quarterNumber: quarter.quarter,
        wave,
        position: slot.position,
        playerId,
        minutes: slot.minutes,
        isSubstitution: false,
      });
    });
  });

  return slots;
};

const buildResultPayload = (result: MatchResult, idMap: Map<string, string>) => {
  const resultCode = mapOutcomeToResultCode(result.result);
  const awards: Array<{ playerId: string; awardType: 'SCORER' | 'HONORABLE_MENTION' | 'ASSIST'; count: number }>
    = [];

  if (Array.isArray(result.scorers)) {
    const scorerCounts = new Map<string, number>();
    result.scorers.forEach((name) => {
      const key = normaliseNameKey(name);
      const count = scorerCounts.get(key) ?? 0;
      scorerCounts.set(key, count + 1);
    });
    scorerCounts.forEach((count, key) => {
      const playerId = idMap.get(key);
      if (!playerId) {
        throw new Error(`Unknown scorer "${key}"`);
      }
      awards.push({ playerId, awardType: 'SCORER', count });
    });
  }

  if (Array.isArray(result.honorableMentions)) {
    const seen = new Set<string>();
    result.honorableMentions.forEach((name) => {
      const key = normaliseNameKey(name);
      if (seen.has(key)) return;
      seen.add(key);
      const playerId = idMap.get(key);
      if (!playerId) {
        throw new Error(`Unknown Honorable Mention "${name}"`);
      }
      awards.push({ playerId, awardType: 'HONORABLE_MENTION', count: 1 });
    });
  }

  let playerOfMatchId: string | null = null;
  if (result.playerOfMatch) {
    const key = normaliseNameKey(result.playerOfMatch);
    playerOfMatchId = idMap.get(key) ?? null;
    if (!playerOfMatchId) {
      throw new Error(`Unknown Player of the Match "${result.playerOfMatch}"`);
    }
  }

  const teamGoals = result.goalsFor ?? null;
  const opponentGoals = result.goalsAgainst ?? null;

  return {
    resultCode,
    teamGoals,
    opponentGoals,
    playerOfMatchId,
    awards,
  };
};

const convertFixtureDetailToMatch = (detail: ApiFixtureDetail): MatchRecord => {
  const quarterMap = new Map<number, Allocation['quarters'][number]>();
  const summary: Record<string, number> = {};
  const warnings: string[] = [];
  const playerIdLookup: Record<string, string> = {};

  detail.quarters.forEach((slot) => {
    const key = normaliseNameKey(slot.playerName);
    if (slot.playerId) {
      playerIdLookup[key] = slot.playerId;
    }
    if (!quarterMap.has(slot.quarterNumber)) {
      quarterMap.set(slot.quarterNumber, {
        quarter: slot.quarterNumber as Allocation['quarters'][number]['quarter'],
        slots: [],
      });
    }
    const target = quarterMap.get(slot.quarterNumber)!;
    const playerSlot: Allocation['quarters'][number]['slots'][number] = {
      player: slot.playerName,
      position: slot.position,
      minutes: slot.minutes,
    };
    if (slot.wave === 'FIRST') playerSlot.wave = 'first';
    else if (slot.wave === 'SECOND') playerSlot.wave = 'second';
    target.slots.push(playerSlot);

    summary[slot.playerName] = (summary[slot.playerName] ?? 0) + slot.minutes;
  });

  const quarters = Array.from(quarterMap.values()).sort((a, b) => a.quarter - b.quarter);

  const squadNames = detail.squad.map((player) => {
    const key = normaliseNameKey(player.displayName);
    if (!playerIdLookup[key]) {
      playerIdLookup[key] = player.playerId;
    }
    return player.displayName;
  });

  const allocation: Allocation = {
    quarters,
    summary,
    warnings,
  };

  const playersSet = new Set<string>([...squadNames, ...Object.keys(summary)]);
  const players = Array.from(playersSet).sort((a, b) => a.localeCompare(b));

  const venueDisplay = mapVenueToDisplay(detail.fixture.venueType) ?? undefined;
  let matchResult: MatchResult | null = null;
  if (detail.result || venueDisplay) {
    matchResult = {
      venue: venueDisplay,
    };
    if (detail.result) {
      matchResult.result = mapResultCodeToOutcome(detail.result.result_code);
      if (detail.result.team_goals !== null) {
        matchResult.goalsFor = detail.result.team_goals;
      }
      if (detail.result.opponent_goals !== null) {
        matchResult.goalsAgainst = detail.result.opponent_goals;
      }
      if (detail.result.player_name) {
        matchResult.playerOfMatch = detail.result.player_name;
      }
    }

    const scorerAwards = detail.awards.filter((award) => award.awardType === 'SCORER');
    const scorers: string[] = [];
    scorerAwards.forEach((award) => {
      for (let i = 0; i < award.count; i += 1) {
        scorers.push(award.playerName);
      }
    });
    if (scorers.length > 0) {
      matchResult.scorers = scorers;
    }

    const hmAwards = detail.awards.filter((award) => award.awardType === 'HONORABLE_MENTION');
    const hmSet = new Set<string>();
    hmAwards.forEach((award) => hmSet.add(award.playerName));
    if (hmSet.size > 0) {
      matchResult.honorableMentions = Array.from(hmSet);
    }
  }

  // Convert ISO timestamp to yyyy-MM-dd format for HTML date inputs
  const dateOnly = detail.fixture.fixtureDate.substring(0, 10);

  return {
    id: detail.fixture.id,
    date: dateOnly,
    opponent: detail.fixture.opponent,
    players,
    allocation,
    result: matchResult,
    createdAt: detail.fixture.createdAt,
    lastModifiedAt: detail.fixture.updatedAt,
    // editHistory is lazy-loaded via fetchFixtureAuditEvents when needed
    metadata: {
      playerIdLookup,
      venueType: detail.fixture.venueType,
      seasonId: detail.fixture.seasonId,
      status: detail.fixture.status,
    },
  };
};

const resolvePlayerIds = async (
  names: Iterable<string>,
  existingLookup?: Record<string, string>
): Promise<Map<string, string>> => {
  const map = new Map<string, string>();
  if (existingLookup) {
    Object.entries(existingLookup).forEach(([name, id]) => {
      if (name && id) {
        map.set(normaliseNameKey(name), id);
      }
    });
  }

  const pending = new Set<string>();
  Array.from(names).forEach((name) => {
    const key = normaliseNameKey(name);
    if (!key) return;
    if (!map.has(key)) {
      pending.add(key);
    }
  });

  if (pending.size === 0) {
    return map;
  }

  const roster = await listRoster({ includeRemoved: true });
  roster.forEach((player) => {
    const key = normaliseNameKey(player.name);
    if (pending.has(key) && !map.has(key)) {
      map.set(key, player.id);
      pending.delete(key);
    }
  });

  if (pending.size > 0) {
    throw new Error(`Unable to resolve player(s): ${Array.from(pending).join(', ')}`);
  }

  return map;
};

const fetchFixtureDetail = async (fixtureId: string): Promise<ApiFixtureDetail> => {
  const response = await apiRequest<{ data: ApiFixtureDetail }>(`/fixtures/${fixtureId}`);
  if (!response || !response.data) {
    throw new Error('Unable to load fixture detail');
  }
  return response.data;
};

const saveMatchApi = async (payload: SaveMatchPayload): Promise<MatchRecord> => {
  const teamId = resolveTeamId();

  const namesForLookup = new Set<string>(payload.players);
  payload.allocation.quarters.forEach((quarter) => {
    quarter.slots.forEach((slot) => namesForLookup.add(slot.player));
  });
  if (payload.result) {
    if (payload.result.playerOfMatch) namesForLookup.add(payload.result.playerOfMatch);
    payload.result.scorers?.forEach((name) => namesForLookup.add(name));
    payload.result.honorableMentions?.forEach((name) => namesForLookup.add(name));
  }

  const playerIdMap = await resolvePlayerIds(namesForLookup);

  const squad = payload.players.map((name) => {
    const playerId = playerIdMap.get(normaliseNameKey(name));
    if (!playerId) {
      throw new Error(`Unknown player "${name}" while creating fixture`);
    }
    return { playerId, role: 'STARTER' as const };
  });

  const fixtureResponse = await apiRequest<{ data: ApiFixtureSummary }>('/fixtures', {
    method: 'POST',
    query: { teamId },
    body: {
      seasonId: null,
      opponent: payload.opponent,
      fixtureDate: payload.date,
      kickoffTime: payload.time || null,
      venueType: mapVenueToApi(payload.result?.venue),
      squad,
      notes: null,
    },
    actorId: payload.createdBy ?? undefined,
  });

  const fixture = fixtureResponse.data;

  const slots = convertAllocationToSlots(payload.allocation, playerIdMap);
  if (slots.length > 0) {
    await apiRequest(`/fixtures/${fixture.id}/lineup`, {
      method: 'PUT',
      body: { slots },
      actorId: payload.createdBy ?? undefined,
    });
  }

  await apiRequest(`/fixtures/${fixture.id}/lock`, {
    method: 'POST',
    actorId: payload.createdBy ?? undefined,
  });

  if (hasResultDetails(payload.result)) {
    const resultPayload = buildResultPayload(payload.result!, playerIdMap);
    await apiRequest(`/fixtures/${fixture.id}/result`, {
      method: 'PUT',
      body: resultPayload,
      actorId: payload.createdBy ?? undefined,
    });
  }

  const detail = await fetchFixtureDetail(fixture.id);
  return convertFixtureDetailToMatch(detail);
};

const listMatchesApi = async (teamIdOverride?: string): Promise<MatchRecord[]> => {
  const teamId = resolveTeamId(teamIdOverride);
  const response = await apiRequest<{ data: ApiFixtureSummary[] }>('/fixtures', {
    query: { teamId },
  });
  const summaries = response?.data ?? [];
  if (summaries.length === 0) {
    return [];
  }

  // Use Promise.allSettled to continue even if individual fixtures fail
  const results = await Promise.allSettled(
    summaries.map(async (summary) => {
      const detail = await fetchFixtureDetail(summary.id);
      return convertFixtureDetailToMatch(detail);
    })
  );

  // Filter successful results, log failures
  const matches: MatchRecord[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      matches.push(result.value);
    } else {
      console.warn(
        `Failed to load fixture ${summaries[index]?.id} (${summaries[index]?.opponent}):`,
        result.reason
      );
    }
  });

  return matches;
};

const updateMatchApi = async (
  matchId: string,
  updates: MatchUpdatePayloadType
): Promise<MatchRecord | null> => {
  resolveTeamId();

  const detail = await fetchFixtureDetail(matchId).catch(() => null);
  if (!detail) {
    return null;
  }

  const existingMatch = convertFixtureDetailToMatch(detail);
  const metadata = existingMatch.metadata ?? {};

  const metadataUpdates: Record<string, unknown> = {};
  if (typeof updates.opponent === 'string' && updates.opponent.trim()) {
    metadataUpdates.opponent = updates.opponent.trim();
  }
  if (typeof updates.date === 'string') {
    metadataUpdates.fixtureDate = updates.date;
  }
  if (updates.result?.venue) {
    metadataUpdates.venueType = mapVenueToApi(updates.result.venue);
  }

  if (Object.keys(metadataUpdates).length > 0) {
    await apiRequest(`/fixtures/${matchId}`, {
      method: 'PATCH',
      body: metadataUpdates,
      actorId: updates.editor,
    });
  }

  const namesForLookup = new Set<string>();
  updates.players?.forEach((name) => namesForLookup.add(name));
  if (updates.allocation) {
    updates.allocation.quarters.forEach((quarter) => {
      quarter.slots.forEach((slot) => namesForLookup.add(slot.player));
    });
  }
  if (updates.result) {
    if (updates.result.playerOfMatch) namesForLookup.add(updates.result.playerOfMatch);
    updates.result.scorers?.forEach((name) => namesForLookup.add(name));
    updates.result.honorableMentions?.forEach((name) => namesForLookup.add(name));
  }

  const playerIdMap = namesForLookup.size
    ? await resolvePlayerIds(namesForLookup, metadata.playerIdLookup)
    : new Map<string, string>();

  if (updates.allocation) {
    const slots = convertAllocationToSlots(updates.allocation, playerIdMap);
    await apiRequest(`/fixtures/${matchId}/lineup`, {
      method: 'PUT',
      body: { slots },
      actorId: updates.editor,
    });
  }

  if (updates.result !== undefined) {
    if (updates.result && hasResultDetails(updates.result)) {
      const payload = buildResultPayload(updates.result, playerIdMap);
      await apiRequest(`/fixtures/${matchId}/result`, {
        method: 'PUT',
        body: payload,
        actorId: updates.editor,
      });
    } else {
      await apiRequest(`/fixtures/${matchId}/result`, {
        method: 'PUT',
        body: {
          resultCode: 'VOID',
          teamGoals: null,
          opponentGoals: null,
          playerOfMatchId: null,
          awards: [],
        },
        actorId: updates.editor,
      });
    }
  }

  const updatedDetail = await fetchFixtureDetail(matchId);
  return convertFixtureDetailToMatch(updatedDetail);
};

export async function saveMatch(payload: SaveMatchPayload): Promise<MatchRecord> {
  if (canUseApi()) {
    try {
      const record = await saveMatchApi(payload);
      setMatchPersistenceState('api');
      return record;
    } catch (error) {
      logApiFallback(error);
      setMatchPersistenceState('fallback', error);
      return saveMatchLocal(payload);
    }
  }

  if (USE_API_PERSISTENCE && isBrowser && !TEAM_ID) {
    setMatchPersistenceState(
      'fallback',
      'TEAM_ID environment variable is required when VITE_USE_API is true.'
    );
  } else {
    setMatchPersistenceState('local');
  }
  return saveMatchLocal(payload);
}

export async function listMatches(options: { teamId?: string } = {}): Promise<MatchRecord[]> {
  const { teamId } = options;
  if (canUseApi(teamId)) {
    try {
      const matches = await listMatchesApi(teamId);
      setMatchPersistenceState('api');
      return matches;
    } catch (error) {
      logApiFallback(error);
      setMatchPersistenceState('fallback', error);
      return listMatchesLocal();
    }
  }

  if (USE_API_PERSISTENCE && isBrowser && !(teamId ?? TEAM_ID)) {
    setMatchPersistenceState(
      'fallback',
      'TEAM_ID environment variable is required when VITE_USE_API is true.'
    );
  } else {
    setMatchPersistenceState('local');
  }
  return listMatchesLocal();
}

export async function updateMatch(
  matchId: string,
  updates: MatchUpdatePayloadType
): Promise<MatchRecord | null> {
  if (canUseApi()) {
    try {
      const record = await updateMatchApi(matchId, updates);
      setMatchPersistenceState('api');
      return record;
    } catch (error) {
      logApiFallback(error);
      setMatchPersistenceState('fallback', error);
      return updateMatchLocal(matchId, updates);
    }
  }

  if (USE_API_PERSISTENCE && isBrowser && !TEAM_ID) {
    setMatchPersistenceState(
      'fallback',
      'TEAM_ID environment variable is required when VITE_USE_API is true.'
    );
  } else {
    setMatchPersistenceState('local');
  }
  return updateMatchLocal(matchId, updates);
}

export async function bulkImportMatches(
  payloads: SaveMatchPayload[]
): Promise<{ added: MatchRecord[]; skipped: number }> {
  if (canUseApi()) {
    setMatchPersistenceState('fallback');
  } else if (USE_API_PERSISTENCE && isBrowser && !TEAM_ID) {
    setMatchPersistenceState(
      'fallback',
      'TEAM_ID environment variable is required when VITE_USE_API is true.'
    );
  } else {
    setMatchPersistenceState('local');
  }
  return bulkImportMatchesLocal(payloads);
}

export function getMatchPersistenceMode(): MatchPersistenceMode {
  return matchPersistenceMode;
}

export function getMatchPersistenceError(): Error | null {
  return matchPersistenceError;
}
