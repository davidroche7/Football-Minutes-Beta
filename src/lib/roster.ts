import { USE_API_PERSISTENCE, TEAM_ID } from '../config/environment';
import { apiRequest } from './apiClient';

const STORAGE_KEY = 'ffm:roster';

export interface RosterPlayer {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  removedAt: string | null;
  squadNumber?: number | null;
  status?: string;
  preferredPositions?: string[];
  notes?: string | null;
}

export type RosterActionType = 'added' | 'removed' | 'restored' | 'updated';

export interface RosterAuditEntry {
  id: string;
  playerId: string;
  action: RosterActionType;
  actor: string;
  timestamp: string;
  playerName: string;
}

interface RosterStorage {
  players: RosterPlayer[];
  audit: RosterAuditEntry[];
}

const isBrowser = typeof window !== 'undefined';
const canUseApi = (teamIdOverride?: string) =>
  USE_API_PERSISTENCE && isBrowser && Boolean(teamIdOverride ?? TEAM_ID);

export type RosterPersistenceMode = 'api' | 'local' | 'fallback';

let lastPersistenceMode: RosterPersistenceMode = canUseApi() ? 'api' : 'local';
let lastPersistenceError: Error | null = null;

const setPersistenceState = (mode: RosterPersistenceMode, error?: unknown) => {
  lastPersistenceMode = mode;
  if (error instanceof Error) {
    lastPersistenceError = error;
  } else if (typeof error === 'string') {
    lastPersistenceError = new Error(error);
  } else if (error) {
    lastPersistenceError = new Error('Unexpected API error');
  } else {
    lastPersistenceError = null;
  }
};

const resolveTeamId = (teamIdOverride?: string) => {
  const resolved = teamIdOverride ?? TEAM_ID;
  if (!resolved) {
    throw new Error('TEAM_ID environment variable is required for API roster operations.');
  }
  return resolved;
};

const ensureLocalPersistenceState = (teamIdOverride?: string) => {
  if (USE_API_PERSISTENCE && isBrowser && !(teamIdOverride ?? TEAM_ID)) {
    setPersistenceState('fallback', 'TEAM_ID environment variable is required when VITE_USE_API is true.');
  } else {
    setPersistenceState('local');
  }
};

if (USE_API_PERSISTENCE && isBrowser && !TEAM_ID) {
  setPersistenceState('fallback', 'TEAM_ID environment variable is required when VITE_USE_API is true.');
}

interface ApiPlayerResponse {
  id: string;
  teamId: string;
  displayName: string;
  preferredPositions: string[];
  squadNumber: number | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  removedAt: string | null;
}

const mapApiPlayerToRoster = (player: ApiPlayerResponse): RosterPlayer => ({
  id: player.id,
  name: player.displayName,
  createdAt: player.createdAt,
  updatedAt: player.updatedAt,
  removedAt: player.removedAt,
  squadNumber: player.squadNumber,
  status: player.status,
  preferredPositions: player.preferredPositions,
  notes: player.notes,
});

const hasLocalStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

let memoryStorage: RosterStorage | null = null;

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `roster_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const cloneStorage = (storage: RosterStorage): RosterStorage => ({
  players: storage.players.map((player) => ({ ...player })),
  audit: storage.audit.map((entry) => ({ ...entry })),
});

const toRosterPlayer = (player: Partial<RosterPlayer> & { name?: unknown }): RosterPlayer | null => {
  if (typeof player.name !== 'string') return null;
  const trimmed = player.name.trim();
  if (!trimmed) return null;

  const createdAt = typeof player.createdAt === 'string' ? player.createdAt : new Date().toISOString();
  const updatedAt = typeof player.updatedAt === 'string' ? player.updatedAt : createdAt;

  return {
    id: typeof player.id === 'string' ? player.id : createId(),
    name: trimmed,
    createdAt,
    updatedAt,
    removedAt: typeof player.removedAt === 'string' ? player.removedAt : null,
  };
};

const toRosterAuditEntry = (
  entry: Partial<RosterAuditEntry> & { action?: unknown; timestamp?: unknown }
): RosterAuditEntry | null => {
  if (typeof entry.playerId !== 'string' || typeof entry.actor !== 'string') {
    return null;
  }

  if (entry.action !== 'added' && entry.action !== 'removed' && entry.action !== 'restored') {
    return null;
  }

  if (typeof entry.playerName !== 'string' || !entry.playerName.trim()) {
    return null;
  }

  const timestamp =
    typeof entry.timestamp === 'string' ? entry.timestamp : new Date().toISOString();

  return {
    id: typeof entry.id === 'string' ? entry.id : createId(),
    playerId: entry.playerId,
    action: entry.action,
    actor: entry.actor,
    timestamp,
    playerName: entry.playerName,
  };
};

const emptyStorage = (): RosterStorage => ({
  players: [],
  audit: [],
});

const ensureStorageShape = (value: unknown): RosterStorage => {
  if (!value) {
    return emptyStorage();
  }

  if (Array.isArray(value)) {
    const now = new Date().toISOString();
    const players = value
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((name) => ({
        id: createId(),
        name: name.trim(),
        createdAt: now,
        updatedAt: now,
        removedAt: null,
      }));
    return { players, audit: [] };
  }

  if (typeof value === 'object') {
    const maybeStorage = value as Partial<RosterStorage>;
    const players = Array.isArray(maybeStorage.players)
      ? maybeStorage.players
          .map((player) => toRosterPlayer(player))
          .filter((player): player is RosterPlayer => Boolean(player))
      : [];
    const audit = Array.isArray(maybeStorage.audit)
      ? maybeStorage.audit
          .map((entry) => toRosterAuditEntry(entry))
          .filter((entry): entry is RosterAuditEntry => Boolean(entry))
      : [];
    return { players, audit };
  }

  return emptyStorage();
};

const readStorage = (): RosterStorage => {
  if (hasLocalStorage()) {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return emptyStorage();
    }

    try {
      const parsed = JSON.parse(rawValue);
      return ensureStorageShape(parsed);
    } catch {
      return emptyStorage();
    }
  }

  if (!memoryStorage) {
    memoryStorage = emptyStorage();
  }

  return cloneStorage(memoryStorage);
};

const writeStorage = (storage: RosterStorage) => {
  if (hasLocalStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    return;
  }

  memoryStorage = cloneStorage(storage);
};

const sortPlayers = (players: RosterPlayer[]) =>
  [...players].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

async function listRosterLocal(options: { includeRemoved?: boolean } = {}): Promise<RosterPlayer[]> {
  const storage = readStorage();
  const filtered = options.includeRemoved
    ? storage.players
    : storage.players.filter((player) => player.removedAt === null);
  return sortPlayers(filtered).map((player) => ({ ...player }));
}

async function getRosterAuditLocal(): Promise<RosterAuditEntry[]> {
  const storage = readStorage();
  return storage.audit
    .slice()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((entry) => ({ ...entry }));
}

async function addPlayerLocal(name: string, actor: string): Promise<RosterPlayer> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Player name cannot be empty');
  }

  const storage = readStorage();
  const duplicate = storage.players.find(
    (player) => player.removedAt === null && player.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`Player "${trimmedName}" already exists`);
  }

  const now = new Date().toISOString();
  const player: RosterPlayer = {
    id: createId(),
    name: trimmedName,
    createdAt: now,
    updatedAt: now,
    removedAt: null,
  };

  const audit: RosterAuditEntry = {
    id: createId(),
    playerId: player.id,
    action: 'added',
    actor,
    timestamp: now,
    playerName: player.name,
  };

  storage.players.push(player);
  storage.audit.push(audit);
  writeStorage(storage);

  return { ...player };
}

async function removePlayerLocal(playerId: string, actor: string): Promise<RosterPlayer | null> {
  const storage = readStorage();
  const player = storage.players.find((item) => item.id === playerId);
  if (!player) {
    return null;
  }

  if (player.removedAt) {
    return { ...player };
  }

  const now = new Date().toISOString();
  player.removedAt = now;
  player.updatedAt = now;

  const audit: RosterAuditEntry = {
    id: createId(),
    playerId: player.id,
    action: 'removed',
    actor,
    timestamp: now,
    playerName: player.name,
  };
  storage.audit.push(audit);
  writeStorage(storage);

  return { ...player };
}

async function restorePlayerLocal(playerId: string, actor: string): Promise<RosterPlayer | null> {
  const storage = readStorage();
  const player = storage.players.find((item) => item.id === playerId);
  if (!player) {
    return null;
  }

  if (!player.removedAt) {
    return { ...player };
  }

  const now = new Date().toISOString();
  player.removedAt = null;
  player.updatedAt = now;

  const audit: RosterAuditEntry = {
    id: createId(),
    playerId: player.id,
    action: 'restored',
    actor,
    timestamp: now,
    playerName: player.name,
  };
  storage.audit.push(audit);
  writeStorage(storage);

  return { ...player };
}

async function listRosterApi(
  options: { includeRemoved?: boolean } = {},
  teamIdOverride?: string
): Promise<RosterPlayer[]> {
  const teamId = resolveTeamId(teamIdOverride);
  const response = await apiRequest<{ data: ApiPlayerResponse[] }>('/players', {
    query: {
      teamId,
      includeRemoved: options.includeRemoved ?? false,
    },
  });
  const players = Array.isArray(response?.data) ? response.data : [];
  return players.map(mapApiPlayerToRoster);
}

async function getRosterAuditApi(teamIdOverride?: string): Promise<RosterAuditEntry[]> {
  const teamId = teamIdOverride ?? TEAM_ID;
  if (!teamId) {
    return [];
  }
  try {
    const response = await apiRequest<{ data: RosterAuditEntry[] }>('/audit', {
      query: {
        teamId,
        entityType: 'player',
      },
    });
    return Array.isArray(response?.data) ? response.data : [];
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 404) {
      return [];
    }
    throw error;
  }
}

async function addPlayerApi(name: string, actor: string, teamIdOverride?: string): Promise<RosterPlayer> {
  const teamId = resolveTeamId(teamIdOverride);
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Player name cannot be empty');
  }
  const response = await apiRequest<{ data: ApiPlayerResponse }>('/players', {
    method: 'POST',
    body: {
      teamId,
      displayName: trimmedName,
    },
    actorId: actor,
  });
  if (!response || !response.data) {
    throw new Error('Unexpected response when creating player');
  }
  return mapApiPlayerToRoster(response.data);
}

async function removePlayerApi(playerId: string, actor: string): Promise<null> {
  await apiRequest(`/players/${playerId}`, {
    method: 'DELETE',
    actorId: actor,
  });
  return null;
}

async function restorePlayerApi(playerId: string, actor: string): Promise<RosterPlayer | null> {
  const response = await apiRequest<{ data: ApiPlayerResponse }>(`/players/${playerId}/restore`, {
    method: 'POST',
    actorId: actor,
  });
  if (!response || !response.data) {
    return null;
  }
  return mapApiPlayerToRoster(response.data);
}

const logApiFallback = (error: unknown) => {
  setPersistenceState('fallback', error);
  console.warn('Roster API unavailable, falling back to local storage implementation.', error);
};

export async function listRoster(options: { includeRemoved?: boolean; teamId?: string } = {}): Promise<RosterPlayer[]> {
  const { includeRemoved, teamId } = options;
  if (canUseApi(teamId)) {
    try {
      const players = await listRosterApi({ includeRemoved }, teamId);
      setPersistenceState('api');
      return players;
    } catch (error) {
      logApiFallback(error);
      return listRosterLocal(options);
    }
  }
  ensureLocalPersistenceState(teamId);
  return listRosterLocal(options);
}

export async function getRosterAudit(): Promise<RosterAuditEntry[]> {
  if (canUseApi()) {
    try {
      const audit = await getRosterAuditApi();
      setPersistenceState('api');
      return audit;
    } catch (error) {
      logApiFallback(error);
      return getRosterAuditLocal();
    }
  }
  ensureLocalPersistenceState();
  return getRosterAuditLocal();
}

export async function addPlayer(name: string, actor: string): Promise<RosterPlayer> {
  if (canUseApi()) {
    try {
      const player = await addPlayerApi(name, actor);
      setPersistenceState('api');
      return player;
    } catch (error) {
      logApiFallback(error);
      return addPlayerLocal(name, actor);
    }
  }
  ensureLocalPersistenceState();
  return addPlayerLocal(name, actor);
}

export async function removePlayer(playerId: string, actor: string): Promise<RosterPlayer | null> {
  if (canUseApi()) {
    try {
      await removePlayerApi(playerId, actor);
       setPersistenceState('api');
      return null;
    } catch (error) {
      logApiFallback(error);
      return removePlayerLocal(playerId, actor);
    }
  }
  ensureLocalPersistenceState();
  return removePlayerLocal(playerId, actor);
}

export async function restorePlayer(playerId: string, actor: string): Promise<RosterPlayer | null> {
  if (canUseApi()) {
    try {
      const player = await restorePlayerApi(playerId, actor);
      setPersistenceState('api');
      return player;
    } catch (error) {
      logApiFallback(error);
      return restorePlayerLocal(playerId, actor);
    }
  }
  ensureLocalPersistenceState();
  return restorePlayerLocal(playerId, actor);
}

export function clearRosterMemoryCache() {
  memoryStorage = emptyStorage();
}

export function getRosterPersistenceMode(): RosterPersistenceMode {
  return lastPersistenceMode;
}

export function getRosterLastError(): Error | null {
  return lastPersistenceError;
}
