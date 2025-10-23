import { useEffect, useMemo, useState, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import type { Allocation, Quarter, PlayerSlot } from '../lib/types';
import type { MatchRecord, MatchResult, SaveMatchPayload } from '../lib/persistence';
import {
  bulkImportMatches,
  updateMatch,
  type MatchUpdatePayload,
  getMatchPersistenceMode,
  getMatchPersistenceError,
  listMatches,
} from '../lib/persistence';
import { fetchTeamStats, fetchPlayerStats } from '../lib/statsClient';
import { getRules } from '../lib/rules';
import type { RuleConfig } from '../config/rules';
import {
  getRosterAudit,
  listRoster,
  restorePlayer,
  type RosterActionType,
  type RosterAuditEntry,
  type RosterPlayer,
} from '../lib/roster';
import { fetchAuditEvents, type AuditEvent } from '../lib/auditClient';
import { AllocationGrid } from './AllocationGrid';
import { EditModal } from './EditModal';
import { TEAM_ID, USE_API_PERSISTENCE } from '../config/environment';

interface SeasonStatsViewProps {
  matches: MatchRecord[];
  onMatchesChange: (records: MatchRecord[]) => void;
  currentUser: string;
}

interface PlayerSummaryRow {
  player: string;
  totalMinutes: number;
  matchesPlayed: number;
  gkQuarters: number;
  targetMinutes: number;
  goals: number;
  playerOfMatchAwards: number;
  honorableMentions: number;
}

type VenueOption = 'Home' | 'Away' | 'Neutral' | '';
type OutcomeOption = 'Win' | 'Loss' | 'Draw' | '';

interface ResultDraft {
  venue: VenueOption;
  outcome: OutcomeOption;
  goalsFor: string;
  goalsAgainst: string;
  playerOfMatch: string;
  honorableMentions: string;
  scorers: string;
}

interface MatchDraft {
  date: string;
  opponent: string;
  result: ResultDraft;
  allocation: Allocation;
  players: string[];
}

interface MatchFeedback {
  status?: string;
  error?: string;
}

const persistenceBadgeStyles = {
  api: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 border border-green-200 dark:border-green-800/60',
  local: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100 border border-blue-200 dark:border-blue-800/60',
  fallback:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-100 border border-yellow-300 dark:border-yellow-800/60',
} as const;

type SeasonSnapshot = {
  matches: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  wins: number;
  draws: number;
  losses: number;
};

const toTitleCase = (value: string): string => {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const cloneAllocation = (allocation: Allocation): Allocation =>
  JSON.parse(JSON.stringify(allocation)) as Allocation;

const recalcSummary = (allocation: Allocation): Record<string, number> => {
  const summary: Record<string, number> = {};
  allocation.quarters.forEach((quarter) => {
    quarter.slots.forEach((slot) => {
      summary[slot.player] = (summary[slot.player] || 0) + slot.minutes;
    });
  });
  return summary;
};

const derivePlayersFromAllocation = (allocation: Allocation, basePlayers: string[]): string[] => {
  const names = new Set<string>();
  basePlayers.forEach((player) => names.add(player));
  allocation.quarters.forEach((quarter) => {
    quarter.slots.forEach((slot) => names.add(slot.player));
  });
  return Array.from(names).sort((a, b) => a.localeCompare(b));
};

const normaliseVenueOption = (value?: string | null): VenueOption => {
  if (!value) return '';
  const normalised = toTitleCase(value);
  if (normalised === 'Home' || normalised === 'Away' || normalised === 'Neutral') {
    return normalised;
  }
  return '';
};

const normaliseRosterAction = (eventType: string): RosterActionType => {
  const key = eventType.trim().toLowerCase();
  if (key === 'created' || key === 'added') return 'added';
  if (key === 'removed' || key === 'deleted') return 'removed';
  if (key === 'restored') return 'restored';
  return 'updated';
};

const extractAuditPlayerName = (event: AuditEvent): string => {
  const candidates: string[] = [];
  const pushCandidate = (value: unknown) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        candidates.push(trimmed);
      }
    }
  };

  const inspectState = (state: unknown) => {
    if (!state || typeof state !== 'object') return;
    const record = state as Record<string, unknown>;
    pushCandidate(record['displayName']);
    pushCandidate(record['display_name']);
    pushCandidate(record['name']);
    pushCandidate(record['playerName']);
    pushCandidate(record['player_name']);
  };

  inspectState(event.nextState);
  inspectState(event.previousState);
  inspectState(event.metadata);

  return candidates.length > 0 ? candidates[0]! : 'Unknown Player';
};

const mapAuditEventToRosterEntry = (event: AuditEvent): RosterAuditEntry => ({
  id: event.id,
  playerId: event.entityId,
  action: normaliseRosterAction(event.eventType),
  actor: event.actorId ?? 'system',
  timestamp: event.createdAt,
  playerName: extractAuditPlayerName(event),
});

const normaliseOutcomeOption = (value?: string | null): OutcomeOption => {
  if (!value) return '';
  const normalised = toTitleCase(value);
  if (normalised === 'Win' || normalised === 'Loss' || normalised === 'Draw') {
    return normalised;
  }
  return '';
};

const toListString = (items?: string[] | null): string => {
  if (!items || items.length === 0) return '';
  return items.join(', ');
};

const splitList = (value: string, dedupe = false): string[] => {
  const tokens = value
    .split(/[,;\n]+/)
    .map((token) => toTitleCase(token))
    .filter(Boolean);

  if (!dedupe) return tokens;

  const unique = new Set<string>();
  tokens.forEach((token) => unique.add(token));
  return Array.from(unique);
};

const parseGoalValue = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildResultFromDraft = (draft: ResultDraft): MatchResult | null => {
  const goalsFor = parseGoalValue(draft.goalsFor);
  const goalsAgainst = parseGoalValue(draft.goalsAgainst);
  const honorableMentions = splitList(draft.honorableMentions, true);
  const scorers = splitList(draft.scorers, false);
  const playerOfMatch = draft.playerOfMatch.trim()
    ? toTitleCase(draft.playerOfMatch)
    : undefined;

  const venue = draft.venue ? draft.venue : undefined;
  const outcome = draft.outcome ? draft.outcome : undefined;

  const hasAny =
    venue ||
    outcome ||
    playerOfMatch ||
    honorableMentions.length > 0 ||
    scorers.length > 0 ||
    goalsFor !== null ||
    goalsAgainst !== null;

  if (!hasAny) {
    return null;
  }

  const result: MatchResult = {
    venue,
    result: outcome,
    goalsFor,
    goalsAgainst,
    playerOfMatch,
    honorableMentions: honorableMentions.length > 0 ? honorableMentions : undefined,
    scorers: scorers.length > 0 ? scorers : undefined,
  };

  return result;
};

const createDraftFromMatch = (match: MatchRecord): MatchDraft => {
  const allocation = cloneAllocation(match.allocation);
  return {
    date: match.date,
    opponent: match.opponent,
    result: {
      venue: normaliseVenueOption(match.result?.venue),
      outcome: normaliseOutcomeOption(match.result?.result),
      goalsFor:
        match.result?.goalsFor === null || match.result?.goalsFor === undefined
          ? ''
          : String(match.result.goalsFor),
      goalsAgainst:
        match.result?.goalsAgainst === null || match.result?.goalsAgainst === undefined
          ? ''
          : String(match.result.goalsAgainst),
      playerOfMatch: match.result?.playerOfMatch ?? '',
      honorableMentions: toListString(match.result?.honorableMentions),
      scorers: toListString(match.result?.scorers),
    },
    allocation,
    players: derivePlayersFromAllocation(allocation, match.players),
  };
};

const normaliseAllocationForSave = (allocation: Allocation): Allocation => {
  const copy = cloneAllocation(allocation);
  copy.summary = recalcSummary(copy);
  return copy;
};

const isDraftDirty = (match: MatchRecord, draft: MatchDraft): boolean => {
  if (match.date !== draft.date) return true;
  if (match.opponent !== draft.opponent) return true;

  const savedResultString = JSON.stringify(match.result ?? null);
  const draftResultString = JSON.stringify(buildResultFromDraft(draft.result));
  if (savedResultString !== draftResultString) return true;

  const savedAllocationString = JSON.stringify(match.allocation);
  const draftAllocationString = JSON.stringify(normaliseAllocationForSave(draft.allocation));
  if (savedAllocationString !== draftAllocationString) return true;

  const savedPlayersString = JSON.stringify([...match.players].sort());
  const draftPlayersString = JSON.stringify([...draft.players].sort());
  return savedPlayersString !== draftPlayersString;
};

export function SeasonStatsView({ matches, onMatchesChange, currentUser }: SeasonStatsViewProps) {
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [expandedMatches, setExpandedMatches] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, MatchDraft>>({});
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [matchFeedback, setMatchFeedback] = useState<Record<string, MatchFeedback>>({});
  const [modalState, setModalState] = useState<{
    matchId: string;
    quarter: Quarter;
    slotIndex: number;
    slot: PlayerSlot;
  } | null>(null);

  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterMessage, setRosterMessage] = useState<string | null>(null);
  const [auditEntries, setAuditEntries] = useState<RosterAuditEntry[]>([]);
  const [isRosterLoading, setIsRosterLoading] = useState(true);
  const [isAuditLoading, setIsAuditLoading] = useState(true);
  const [restorePendingId, setRestorePendingId] = useState<string | null>(null);
  const [apiSeasonSummary, setApiSeasonSummary] = useState<SeasonSnapshot | null>(null);
  const [apiPlayerSummaries, setApiPlayerSummaries] = useState<PlayerSummaryRow[] | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [matchPersistenceMode, setMatchPersistenceMode] = useState(() => getMatchPersistenceMode());
  const [matchPersistenceError, setMatchPersistenceError] = useState(() =>
    getMatchPersistenceError()?.message ?? null
  );
  const configuredTeamId = TEAM_ID;
  const showTeamConfigurationWarning = USE_API_PERSISTENCE && !configuredTeamId;

  const rules = useMemo(() => getRules(), []);
  const perMatchTarget = rules.quarterDuration * rules.quarters;

  const refreshMatchPersistenceState = useCallback(() => {
    const mode = getMatchPersistenceMode();
    const error = getMatchPersistenceError();
    setMatchPersistenceMode(mode);
    setMatchPersistenceError(error?.message ?? null);
    return mode;
  }, []);

  const loadStatsFromApi = useCallback(
    async (signal?: AbortSignal) => {
      if (!configuredTeamId) {
        setApiSeasonSummary(null);
        setApiPlayerSummaries(null);
        setStatsError('TEAM_ID environment variable is required for backend stats.');
        setIsStatsLoading(false);
        return;
      }

      setIsStatsLoading(true);
      setStatsError(null);
      try {
        const [teamSummary, playerStats] = await Promise.all([
          fetchTeamStats({ signal, teamId: configuredTeamId }),
          fetchPlayerStats({ signal, teamId: configuredTeamId }),
        ]);

        if (signal?.aborted) return;

        const mappedSummary: SeasonSnapshot | null = teamSummary
          ? {
              matches: teamSummary.played,
              goalsFor: teamSummary.goalsFor,
              goalsAgainst: teamSummary.goalsAgainst,
              goalDifference: teamSummary.goalDifference,
              wins: teamSummary.wins,
              draws: teamSummary.draws,
              losses: teamSummary.losses,
            }
          : null;

        const mappedPlayers: PlayerSummaryRow[] = playerStats.map((player) => ({
          player: player.displayName,
          totalMinutes: player.totalMinutes,
          matchesPlayed: player.appearances,
          gkQuarters: player.goalkeeperQuarters,
          targetMinutes: player.appearances * perMatchTarget,
          goals: player.goals,
          playerOfMatchAwards: player.playerOfMatch,
          honorableMentions: player.honorableMentions,
        }));

        mappedPlayers.sort((a, b) => b.totalMinutes - a.totalMinutes);

        setApiSeasonSummary(mappedSummary);
        setApiPlayerSummaries(mappedPlayers);
        setStatsError(null);
      } catch (error) {
        if (signal?.aborted) return;
        setStatsError(error instanceof Error ? error.message : 'Failed to load season stats.');
        setApiSeasonSummary(null);
        setApiPlayerSummaries(null);
      } finally {
        if (!signal?.aborted) {
          setIsStatsLoading(false);
        }
      }
    },
    [configuredTeamId, perMatchTarget]
  );

  const refreshMatchesFromSource = useCallback(async () => {
    try {
      const records = await listMatches(
        configuredTeamId ? { teamId: configuredTeamId } : undefined
      );
      onMatchesChange(records);
      const mode = refreshMatchPersistenceState();
      if (mode === 'api') {
        await loadStatsFromApi();
      }
    } catch (error) {
      setMatchFeedback((prev) => ({
        ...prev,
        reload: {
          error: error instanceof Error ? error.message : 'Failed to reload matches',
        },
      }));
    }
  }, [configuredTeamId, loadStatsFromApi, onMatchesChange, refreshMatchPersistenceState]);

  useEffect(() => {
    if (matchPersistenceMode !== 'api') {
      setApiSeasonSummary(null);
      setApiPlayerSummaries(null);
      setStatsError(null);
      setIsStatsLoading(false);
      return;
    }

    const controller = new AbortController();
    loadStatsFromApi(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadStatsFromApi, matchPersistenceMode]);

  useEffect(() => {
    const nextDrafts: Record<string, MatchDraft> = {};
    matches.forEach((match) => {
      nextDrafts[match.id] = createDraftFromMatch(match);
    });
    setDrafts(nextDrafts);
  }, [matches]);

  const derivedPlayerSummaries = useMemo<PlayerSummaryRow[]>(() => {
    const rows: Record<string, PlayerSummaryRow> = {};

    matches.forEach((match) => {
      Object.entries(match.allocation.summary).forEach(([player, total]) => {
        const entry =
          rows[player] ??
          (rows[player] = {
            player,
            totalMinutes: 0,
            matchesPlayed: 0,
            gkQuarters: 0,
            targetMinutes: 0,
            goals: 0,
            playerOfMatchAwards: 0,
            honorableMentions: 0,
          });

        entry.totalMinutes += total;
        entry.matchesPlayed += 1;
        entry.targetMinutes += perMatchTarget;
      });

      match.allocation.quarters.forEach((quarter) => {
        quarter.slots.forEach((slot) => {
          if (slot.position === 'GK') {
            const entry =
              rows[slot.player] ??
              (rows[slot.player] = {
                player: slot.player,
                totalMinutes: 0,
                matchesPlayed: 0,
                gkQuarters: 0,
                targetMinutes: 0,
                goals: 0,
                playerOfMatchAwards: 0,
                honorableMentions: 0,
              });
            entry.gkQuarters += 1;
          }
        });
      });

      const result = match.result;
      if (!result) {
        return;
      }

      if (Array.isArray(result.scorers)) {
        result.scorers.forEach((name) => {
          const scorer = toTitleCase(name);
          const entry =
            rows[scorer] ??
            (rows[scorer] = {
              player: scorer,
              totalMinutes: 0,
              matchesPlayed: 0,
              gkQuarters: 0,
              targetMinutes: 0,
              goals: 0,
              playerOfMatchAwards: 0,
              honorableMentions: 0,
            });
          entry.goals += 1;
        });
      }

      if (result.playerOfMatch) {
        const pom = toTitleCase(result.playerOfMatch);
        const entry =
          rows[pom] ??
          (rows[pom] = {
            player: pom,
            totalMinutes: 0,
            matchesPlayed: 0,
            gkQuarters: 0,
            targetMinutes: 0,
            goals: 0,
            playerOfMatchAwards: 0,
            honorableMentions: 0,
          });
        entry.playerOfMatchAwards += 1;
      }

      if (Array.isArray(result.honorableMentions)) {
        result.honorableMentions.forEach((name) => {
          const mention = toTitleCase(name);
          const entry =
            rows[mention] ??
            (rows[mention] = {
              player: mention,
              totalMinutes: 0,
              matchesPlayed: 0,
              gkQuarters: 0,
              targetMinutes: 0,
              goals: 0,
              playerOfMatchAwards: 0,
              honorableMentions: 0,
            });
          entry.honorableMentions += 1;
        });
      }
    });

    return Object.values(rows).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [matches, perMatchTarget]);

  const derivedSeasonSummary = useMemo<SeasonSnapshot>(() => {
    let goalsFor = 0;
    let goalsAgainst = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;

    matches.forEach((match) => {
      const result = match.result;
      if (!result) return;

      if (typeof result.goalsFor === 'number') {
        goalsFor += result.goalsFor;
      }
      if (typeof result.goalsAgainst === 'number') {
        goalsAgainst += result.goalsAgainst;
      }

      const outcome = result.result ? result.result.toLowerCase() : '';
      if (outcome === 'win') wins += 1;
      else if (outcome === 'draw') draws += 1;
      else if (outcome === 'loss') losses += 1;
    });

    return {
      matches: matches.length,
      goalsFor,
      goalsAgainst,
      goalDifference: goalsFor - goalsAgainst,
      wins,
      draws,
      losses,
    };
  }, [matches]);

  const playerSummaries = apiPlayerSummaries ?? derivedPlayerSummaries;
  const seasonSummary = apiSeasonSummary ?? derivedSeasonSummary;

  const rosterOptions = useMemo(
    () =>
      roster
        .filter((player) => player.removedAt === null)
        .map((player) => player.name)
        .sort((a, b) => a.localeCompare(b)),
    [roster]
  );

  const handleToggleExpand = (matchId: string) => {
    setExpandedMatches((prev) =>
      prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [...prev, matchId]
    );
    setMatchFeedback((prev) => ({ ...prev, [matchId]: {} }));
  };

  const handleDraftFieldChange = (
    matchId: string,
    updater: (draft: MatchDraft) => MatchDraft
  ) => {
    setDrafts((prev) => {
      const current = prev[matchId];
      if (!current) return prev;
      return { ...prev, [matchId]: updater(current) };
    });
    setMatchFeedback((prev) => ({ ...prev, [matchId]: {} }));
  };

  const handleSlotEdit = (matchId: string, quarter: Quarter, slotIndex: number, newPlayer: string) => {
    handleDraftFieldChange(matchId, (draft) => {
      const allocation = cloneAllocation(draft.allocation);
      const targetQuarter = allocation.quarters.find((q) => q.quarter === quarter);
      if (!targetQuarter) return draft;
      if (!targetQuarter.slots[slotIndex]) return draft;
      targetQuarter.slots[slotIndex] = {
        ...targetQuarter.slots[slotIndex]!,
        player: toTitleCase(newPlayer),
      };
      allocation.summary = recalcSummary(allocation);
      const players = derivePlayersFromAllocation(allocation, draft.players);
      return {
        ...draft,
        allocation,
        players,
      };
    });
  };

  const handleResetDraft = (match: MatchRecord) => {
    setDrafts((prev) => ({ ...prev, [match.id]: createDraftFromMatch(match) }));
    setMatchFeedback((prev) => ({ ...prev, [match.id]: {} }));
  };

  const handleSaveMatch = async (match: MatchRecord) => {
    const draft = drafts[match.id];
    if (!draft) return;

    const resultPayload = buildResultFromDraft(draft.result);
    const allocationPayload = normaliseAllocationForSave(draft.allocation);
    const playersPayload = derivePlayersFromAllocation(allocationPayload, draft.players);

    const payload: MatchUpdatePayload = {
      opponent: draft.opponent,
      date: draft.date,
      result: resultPayload,
      allocation: allocationPayload,
      players: playersPayload,
      editor: currentUser,
    };

    setSavingMatchId(match.id);
    try {
      const updated = await updateMatch(match.id, payload);
      if (!updated) {
        setMatchFeedback((prev) => ({
          ...prev,
          [match.id]: { error: 'Unable to update match.' },
        }));
        return;
      }
      await refreshMatchesFromSource();
      setDrafts((prev) => ({ ...prev, [match.id]: createDraftFromMatch(updated) }));
      setMatchFeedback((prev) => ({
        ...prev,
        [match.id]: { status: 'Match updated.' },
      }));
      refreshMatchPersistenceState();
    } catch (err) {
      setMatchFeedback((prev) => ({
        ...prev,
        [match.id]: {
          error: err instanceof Error ? err.message : 'Failed to update match',
        },
      }));
      refreshMatchPersistenceState();
    } finally {
      setSavingMatchId(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function loadRoster() {
      setIsRosterLoading(true);
      setRosterError(null);
      try {
        const players = await listRoster({ includeRemoved: true });
        if (!mounted) return;
        setRoster(players);
      } catch (err) {
        if (!mounted) return;
        setRosterError(err instanceof Error ? err.message : 'Failed to load squad roster');
      } finally {
        if (mounted) setIsRosterLoading(false);
      }
    }

    async function loadAudit() {
      setIsAuditLoading(true);
      try {
        if (matchPersistenceMode === 'api') {
          const events = await fetchAuditEvents({
            entityType: 'PLAYER',
            limit: 50,
            teamId: configuredTeamId ?? undefined,
          });
          if (!mounted) return;
          setAuditEntries(events.map(mapAuditEventToRosterEntry));
        } else {
          const entries = await getRosterAudit();
          if (!mounted) return;
          setAuditEntries(entries);
        }
      } catch (err) {
        if (!mounted) return;
        setRosterError((prev) => prev ?? (err instanceof Error ? err.message : 'Failed to load roster log'));
      } finally {
        if (mounted) setIsAuditLoading(false);
      }
    }

    loadRoster();
    loadAudit();
    return () => {
      mounted = false;
    };
  }, [configuredTeamId, matchPersistenceMode]);

  const handleRestoreSquadPlayer = async (playerId: string) => {
    setRestorePendingId(playerId);
    setRosterError(null);
    setRosterMessage(null);
    try {
      await restorePlayer(playerId, currentUser);
      const [players, entries] = await Promise.all([
        listRoster({ includeRemoved: true }),
        matchPersistenceMode === 'api'
          ? fetchAuditEvents({
              entityType: 'PLAYER',
              limit: 50,
              teamId: configuredTeamId ?? undefined,
            }).then((events) => events.map(mapAuditEventToRosterEntry))
          : getRosterAudit(),
      ]);
      setRoster(players);
      setAuditEntries(entries);
      const restored = players.find((player) => player.id === playerId);
      if (restored) {
        setRosterMessage(`${restored.name} restored to active squad.`);
      }
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : 'Failed to restore player');
    } finally {
      setRestorePendingId(null);
    }
  };

  const handleLegacyImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportMessage(null);

    try {
      const text = await file.text();
      const { payloads, skipped: skippedInvalid } = parseLegacyImportFile(text, rules);

      if (payloads.length === 0) {
        setImportError('No valid matches found in the selected file.');
        return;
      }

      const { added, skipped } = await bulkImportMatches(payloads);

      const totalSkipped = skipped + skippedInvalid;

      if (added.length === 0) {
        if (totalSkipped > 0) {
          setImportMessage(
            `No new matches imported (${totalSkipped} item${totalSkipped === 1 ? '' : 's'} skipped as duplicates or invalid).`
          );
        } else {
          setImportMessage('No new matches imported.');
        }
      } else {
        if (matchPersistenceMode === 'api') {
          await refreshMatchesFromSource();
        } else {
          onMatchesChange([...matches, ...added]);
        }
        setImportMessage(
          `Imported ${added.length} match${added.length === 1 ? '' : 'es'}${
            totalSkipped > 0
              ? ` (${totalSkipped} duplicate/invalid item${totalSkipped === 1 ? '' : 's'} skipped).`
              : '.'
          }`
        );
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import legacy data.');
    } finally {
      event.target.value = '';
    }
  };

  const importControls = (
    <div className="flex flex-wrap items-center gap-3">
      <label className="cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
        Import Legacy JSON
        <input
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleLegacyImport}
        />
      </label>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        Use the exported JSON from <code>npm run import:legacy</code>
      </span>
    </div>
  );

  const hasMatches = matches.length > 0 || seasonSummary.matches > 0;
  const modalAvailablePlayers = modalState
    ? Array.from(
        new Set([
          ...rosterOptions,
          ...(drafts[modalState.matchId]?.players ?? []),
        ])
      ).sort((a, b) => a.localeCompare(b))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {importControls}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 dark:text-gray-400">Match data:</span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 font-semibold ${
              persistenceBadgeStyles[matchPersistenceMode]
            }`}
          >
            {matchPersistenceMode === 'api'
              ? 'API backend'
              : matchPersistenceMode === 'fallback'
              ? 'Local fallback'
              : 'Local storage'}
          </span>
        </div>
      </div>
      {matchPersistenceMode === 'api' && isStatsLoading && !statsError && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Refreshing season statistics from the backend…
        </div>
      )}
      {importMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200">
          {importMessage}
        </div>
      )}
      {importError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200">
          {importError}
        </div>
      )}

      {showTeamConfigurationWarning && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-100">
          API persistence is enabled but no team ID is configured (
          <code className="font-mono text-xs">VITE_TEAM_ID</code>). Continuing with local data until a
          team is assigned.
        </div>
      )}
      {matchPersistenceMode === 'fallback' && matchPersistenceError && !showTeamConfigurationWarning && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-100">
          API unavailable: {matchPersistenceError}. Working from local data until connectivity returns.
        </div>
      )}
      {matchPersistenceMode === 'api' && statsError && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-100">
          Unable to load backend season stats: {statsError}. Displaying local calculations instead.
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Squad Overview
          </h3>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Active: {roster.filter((player) => player.removedAt === null).length} · Removed:{' '}
            {roster.filter((player) => player.removedAt !== null).length}
          </div>
        </div>
        {rosterError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200">
            {rosterError}
          </div>
        )}
        {rosterMessage && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200">
            {rosterMessage}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Active Players
            </h4>
            {isRosterLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading squad…</p>
            ) : rosterOptions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No active players yet.</p>
            ) : (
              <ul className="space-y-1 text-sm text-gray-800 dark:text-gray-200">
                {rosterOptions.map((player) => (
                  <li key={player} className="rounded-md bg-gray-50 px-3 py-1 dark:bg-gray-900/40">
                    {player}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lg:col-span-1">
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Removed Players
            </h4>
            {isRosterLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
            ) : roster.filter((player) => player.removedAt !== null).length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No removed players.</p>
            ) : (
              <ul className="space-y-2 text-sm text-gray-800 dark:text-gray-200">
                {roster
                  .filter((player) => player.removedAt !== null)
                  .map((player) => {
                    const pending = restorePendingId === player.id;
                    return (
                      <li
                        key={player.id}
                        className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40"
                      >
                        <div>
                          <p className="font-medium">{player.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Removed{' '}
                            {player.removedAt ? new Date(player.removedAt).toLocaleString() : 'unknown'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRestoreSquadPlayer(player.id)}
                          disabled={pending}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:text-gray-400 dark:text-blue-300 dark:hover:text-blue-200"
                        >
                          {pending ? 'Restoring…' : 'Restore'}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>

          <div className="lg:col-span-1">
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Roster Change Log
            </h4>
            {isAuditLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading history…</p>
            ) : auditEntries.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Activity will appear here after squad changes.
              </p>
            ) : (
              <ul className="space-y-2 text-xs text-gray-700 dark:text-gray-300">
                {auditEntries
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40"
                    >
                      <p>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {entry.playerName}
                        </span>{' '}
                        was{' '}
                        <span className="font-semibold">
                          {entry.action === 'added'
                            ? 'added'
                            : entry.action === 'removed'
                            ? 'removed'
                            : entry.action === 'restored'
                            ? 'restored'
                            : 'updated'}
                        </span>{' '}
                        by {entry.actor}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-gray-500 dark:text-gray-400">
                        {new Date(entry.timestamp).toLocaleString()}
                      </p>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {hasMatches && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Season Snapshot
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md bg-gray-50 px-4 py-3 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Matches Played
              </p>
              <p className="mt-1 text-2xl font-semibold">{seasonSummary.matches}</p>
            </div>
            <div className="rounded-md bg-gray-50 px-4 py-3 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Goals For
              </p>
              <p className="mt-1 text-2xl font-semibold">{seasonSummary.goalsFor}</p>
            </div>
            <div className="rounded-md bg-gray-50 px-4 py-3 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Goals Against
              </p>
              <p className="mt-1 text-2xl font-semibold">{seasonSummary.goalsAgainst}</p>
            </div>
            <div className="rounded-md bg-gray-50 px-4 py-3 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Goal Difference
              </p>
              <p className="mt-1 text-2xl font-semibold">{seasonSummary.goalDifference}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Record: {seasonSummary.wins}-{seasonSummary.draws}-{seasonSummary.losses}
              </p>
            </div>
          </div>
        </section>
      )}

      {!hasMatches && (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Confirmed matches will appear here once you start saving lineups.
        </div>
      )}

      {hasMatches && (
        <>
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Fair Minutes Tracking</h3>
            {playerSummaries.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No player data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-300">Player</th>
                  <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">Total Minutes</th>
                  <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">Matches</th>
                  <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">GK Quarters</th>
                  <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">Target Minutes</th>
                  <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">Goals</th>
                  <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">POTM</th>
                  <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">Hon. Mentions</th>
                </tr>
              </thead>
              <tbody>
                {playerSummaries.map((row) => (
                  <tr key={row.player} className="border-b border-gray-100 dark:border-gray-700/60">
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{row.player}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{row.totalMinutes}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{row.matchesPlayed}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{row.gkQuarters}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{row.targetMinutes}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{row.goals}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{row.playerOfMatchAwards}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{row.honorableMentions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
              </div>
            )}
          </section>

          <section className="space-y-4">
            {matches.map((match) => {
              const isExpanded = expandedMatches.includes(match.id);
              const warnings = match.allocation.warnings ?? [];
              const draft = drafts[match.id];
              if (!draft) {
                return null;
              }
              const feedback = matchFeedback[match.id];
              const isDirty = isDraftDirty(match, draft);
              const isSaving = savingMatchId === match.id;
              const resultDraft = draft.result;
              const resultPayload = buildResultFromDraft(resultDraft);
              const showScore =
                resultPayload && (resultPayload.goalsFor !== null || resultPayload.goalsAgainst !== null);

              return (
                <div
                  key={match.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{draft.date}</p>
                      <p className="text-xl font-semibold text-gray-900 dark:text-white">
                        vs {draft.opponent}
                      </p>
                      {resultPayload && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          {resultPayload.venue && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-gray-700 dark:bg-gray-900/40 dark:text-gray-200">
                              {resultPayload.venue}
                            </span>
                          )}
                          {showScore && (
                            <span className="font-semibold text-gray-800 dark:text-gray-100">
                              {resultPayload.goalsFor ?? '—'} - {resultPayload.goalsAgainst ?? '—'}
                            </span>
                          )}
                          {resultPayload.result && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                resultPayload.result === 'Win'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200'
                                  : resultPayload.result === 'Loss'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
                              }`}
                            >
                              {resultPayload.result}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {warnings.length > 0 && (
                        <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-1 text-sm text-yellow-700 dark:border-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-200">
                          Fairness warning active
                        </div>
                      )}
                      <button
                        onClick={() => handleToggleExpand(match.id)}
                        className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        {isExpanded ? 'Collapse' : 'Expand'}
                      </button>
                    </div>
                  </div>
                  {feedback?.error && (
                    <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200">
                      {feedback.error}
                    </div>
                  )}
                  {feedback?.status && (
                    <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                      {feedback.status}
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-6 space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                            Match Date
                            <input
                              type="date"
                              value={draft.date}
                              onChange={(e) =>
                                handleDraftFieldChange(match.id, (current) => ({
                                  ...current,
                                  date: e.target.value,
                                }))
                              }
                              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                          </label>

                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                            Opponent
                            <input
                              type="text"
                              value={draft.opponent}
                              onChange={(e) =>
                                handleDraftFieldChange(match.id, (current) => ({
                                  ...current,
                                  opponent: e.target.value,
                                }))
                              }
                              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                          </label>

                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                            Venue
                            <select
                              value={resultDraft.venue}
                              onChange={(e) =>
                                handleDraftFieldChange(match.id, (current) => ({
                                  ...current,
                                  result: {
                                    ...current.result,
                                    venue: e.target.value as VenueOption,
                                  },
                                }))
                              }
                              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            >
                              <option value="">Not set</option>
                              <option value="Home">Home</option>
                              <option value="Away">Away</option>
                              <option value="Neutral">Neutral</option>
                            </select>
                          </label>

                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                            Result
                            <select
                              value={resultDraft.outcome}
                              onChange={(e) =>
                                handleDraftFieldChange(match.id, (current) => ({
                                  ...current,
                                  result: {
                                    ...current.result,
                                    outcome: e.target.value as OutcomeOption,
                                  },
                                }))
                              }
                              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            >
                              <option value="">Not set</option>
                              <option value="Win">Win</option>
                              <option value="Draw">Draw</option>
                              <option value="Loss">Loss</option>
                            </select>
                          </label>
                        </div>

                        <div className="space-y-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                              Goals For
                              <input
                                type="number"
                                min={0}
                                value={resultDraft.goalsFor}
                                onChange={(e) =>
                                  handleDraftFieldChange(match.id, (current) => ({
                                    ...current,
                                    result: {
                                      ...current.result,
                                      goalsFor: e.target.value,
                                    },
                                  }))
                                }
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                              />
                            </label>

                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                              Goals Against
                              <input
                                type="number"
                                min={0}
                                value={resultDraft.goalsAgainst}
                                onChange={(e) =>
                                  handleDraftFieldChange(match.id, (current) => ({
                                    ...current,
                                    result: {
                                      ...current.result,
                                      goalsAgainst: e.target.value,
                                    },
                                  }))
                                }
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                              />
                            </label>
                          </div>

                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                            Player of the Match
                            <input
                              type="text"
                              value={resultDraft.playerOfMatch}
                              onChange={(e) =>
                                handleDraftFieldChange(match.id, (current) => ({
                                  ...current,
                                  result: {
                                    ...current.result,
                                    playerOfMatch: e.target.value,
                                  },
                                }))
                              }
                              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                          </label>

                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                            Honorable Mentions <span className="text-xs text-gray-500 dark:text-gray-400">(comma separated)</span>
                            <textarea
                              value={resultDraft.honorableMentions}
                              onChange={(e) =>
                                handleDraftFieldChange(match.id, (current) => ({
                                  ...current,
                                  result: {
                                    ...current.result,
                                    honorableMentions: e.target.value,
                                  },
                                }))
                              }
                              rows={2}
                              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                          </label>

                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                            Goalscorers <span className="text-xs text-gray-500 dark:text-gray-400">(comma separated, duplicates allowed)</span>
                            <textarea
                              value={resultDraft.scorers}
                              onChange={(e) =>
                                handleDraftFieldChange(match.id, (current) => ({
                                  ...current,
                                  result: {
                                    ...current.result,
                                    scorers: e.target.value,
                                  },
                                }))
                              }
                              rows={3}
                              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                          </label>
                        </div>
                      </div>

                      {resultPayload && (
                        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200">
                          <div className="flex flex-wrap gap-3">
                            {resultPayload.playerOfMatch && (
                              <span>
                                <span className="font-semibold">Player of the Match:</span>{' '}
                                {resultPayload.playerOfMatch}
                              </span>
                            )}
                            {Array.isArray(resultPayload.honorableMentions) &&
                              resultPayload.honorableMentions.length > 0 && (
                                <span>
                                  <span className="font-semibold">Honorable Mentions:</span>{' '}
                                  {resultPayload.honorableMentions.join(', ')}
                                </span>
                              )}
                            {Array.isArray(resultPayload.scorers) && resultPayload.scorers.length > 0 && (
                              <span>
                                <span className="font-semibold">Goalscorers:</span>{' '}
                                {resultPayload.scorers.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <AllocationGrid
                        allocation={draft.allocation}
                        allPlayers={draft.players}
                        onSlotClick={(quarter, slotIndex, slot) =>
                          setModalState({
                            matchId: match.id,
                            quarter,
                            slotIndex,
                            slot,
                          })
                        }
                      />

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveMatch(match)}
                            disabled={isSaving || !isDirty}
                            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400"
                          >
                            {isSaving ? 'Saving…' : 'Save changes'}
                          </button>
                          <button
                            onClick={() => handleResetDraft(match)}
                            disabled={isSaving}
                            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            Reset
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Last modified: {new Date(match.lastModifiedAt).toLocaleString()}
                        </p>
                      </div>

                      {match.editHistory.length > 0 && (
                        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                          <p className="mb-2 font-medium text-gray-700 dark:text-gray-200">Change Log</p>
                          <ul className="space-y-1">
                            {match.editHistory.map((event) => (
                              <li key={event.id}>
                                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                                  {event.editedAt}
                                </span>{' '}
                                {event.editedBy} changed {event.field} from “{event.previousValue || '—'}” to “{event.newValue || '—'}”
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}

      {modalState && (
        <EditModal
          isOpen={true}
          onClose={() => setModalState(null)}
          slot={modalState.slot}
          quarter={modalState.quarter}
          slotIndex={modalState.slotIndex}
          availablePlayers={modalAvailablePlayers}
          onSave={(quarter, slotIndex, newPlayer) => {
            handleSlotEdit(modalState.matchId, quarter, slotIndex, newPlayer);
            setModalState(null);
          }}
        />
      )}
    </div>
  );
}

interface LegacyImportFile {
  matches?: LegacyMatch[];
}

interface LegacyMatch {
  date?: string;
  opponent?: string;
  venue?: string;
  availablePlayers?: unknown;
  quarters?: LegacyQuarter[];
  summary?: Record<string, number>;
  result?: LegacyResult;
}

interface LegacyQuarter {
  quarter?: number;
  slots?: LegacySlot[];
  substitutes?: unknown;
}

interface LegacySlot {
  player?: string;
  position?: string;
  minutes?: number;
}

interface LegacyResult {
  venue?: string;
  result?: string;
  goalsFor?: number;
  goalsAgainst?: number;
  playerOfMatch?: string;
  honorableMentions?: unknown;
  scorers?: unknown;
}

function parseLegacyImportFile(text: string, rules: RuleConfig): { payloads: SaveMatchPayload[]; skipped: number } {
  let data: unknown;
  try {
    data = JSON.parse(text) as LegacyImportFile;
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  if (!data || typeof data !== 'object' || !Array.isArray((data as LegacyImportFile).matches)) {
    throw new Error('JSON must include a "matches" array.');
  }

  const payloads: SaveMatchPayload[] = [];
  let skipped = 0;

  for (const legacyMatch of (data as LegacyImportFile).matches ?? []) {
    const payload = convertLegacyMatch(legacyMatch, rules);
    if (payload) {
      payloads.push(payload);
    } else {
      skipped += 1;
    }
  }

  return { payloads, skipped };
}

function convertLegacyMatch(match: LegacyMatch, rules: RuleConfig): SaveMatchPayload | null {
  const date = typeof match.date === 'string' && match.date.trim().length > 0 ? match.date.trim() : null;
  if (!date) {
    return null;
  }

  const quarters = Array.isArray(match.quarters) ? match.quarters : [];
  if (quarters.length === 0) {
    return null;
  }

  const parsedQuarters = quarters
    .map((quarter, index) => normaliseQuarter(quarter, index, rules))
    .filter((quarter) => quarter.slots.length > 0);

  if (parsedQuarters.length === 0) {
    return null;
  }

  const summaryFromSheet = normaliseSummary(match.summary);
  const summary = Object.keys(summaryFromSheet).length > 0 ? summaryFromSheet : computeSummary(parsedQuarters);

  if (Object.keys(summary).length === 0) {
    return null;
  }

  const players = Array.from(
    new Set([
      ...normaliseStringArray(match.availablePlayers),
      ...parsedQuarters.flatMap((quarter) => [
        ...quarter.slots.map((slot) => slot.player),
        ...quarter.substitutes,
      ]),
      ...Object.keys(summary),
    ])
  ).sort();

  if (players.length === 0) {
    return null;
  }

  const result = match.result ? normaliseResult(match.result) : null;

  return {
    date,
    opponent: normaliseName(match.opponent) || 'Unknown Opponent',
    players,
    allocation: {
      quarters: parsedQuarters,
      summary,
    },
    result,
  };
}

function normaliseQuarter(quarter: LegacyQuarter, index: number, rules: RuleConfig) {
  const quarterNumber = clampQuarterNumber(typeof quarter.quarter === 'number' ? quarter.quarter : index + 1);
  const slots = Array.isArray(quarter.slots)
    ? quarter.slots
        .map((slot) => {
          const player = normaliseName(slot.player);
          const position = normalisePosition(slot.position);
          if (!player || !position) return null;
          const minutes = typeof slot.minutes === 'number' && slot.minutes > 0 ? slot.minutes : rules.quarterDuration;
          return { player, position, minutes };
        })
        .filter((slot): slot is { player: string; position: 'GK' | 'DEF' | 'ATT'; minutes: number } => Boolean(slot))
    : [];

  const substitutes = normaliseStringArray(quarter.substitutes);

  return {
    quarter: quarterNumber,
    slots,
    substitutes,
  };
}

function normaliseSummary(summary: Record<string, number> | undefined): Record<string, number> {
  if (!summary || typeof summary !== 'object') {
    return {};
  }

  const result: Record<string, number> = {};
  Object.entries(summary).forEach(([player, value]) => {
    const name = normaliseName(player);
    const minutes = typeof value === 'number' ? value : Number(value);
    if (name && !Number.isNaN(minutes)) {
      result[name] = minutes;
    }
  });
  return result;
}

function computeSummary(quarters: Array<{ slots: { player: string; minutes: number }[] }>): Record<string, number> {
  const totals: Record<string, number> = {};
  quarters.forEach((quarter) => {
    quarter.slots.forEach((slot) => {
      totals[slot.player] = (totals[slot.player] || 0) + slot.minutes;
    });
  });
  return totals;
}

function normaliseResult(result: LegacyResult): MatchResult | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const goalsFor = toNumberOrNull(result.goalsFor);
  const goalsAgainst = toNumberOrNull(result.goalsAgainst);
  const playerOfMatch = normaliseName(result.playerOfMatch);
  const honorableMentions = normaliseStringArray(result.honorableMentions);
  const scorers = normaliseStringArray(result.scorers);

  if (
    !result.venue &&
    !result.result &&
    goalsFor === null &&
    goalsAgainst === null &&
    !playerOfMatch &&
    honorableMentions.length === 0 &&
    scorers.length === 0
  ) {
    return null;
  }

  return {
    venue: normaliseName(result.venue),
    result: result.result ? String(result.result).trim() : undefined,
    goalsFor,
    goalsAgainst,
    playerOfMatch,
    honorableMentions,
    scorers,
  };
}

function normaliseName(value: unknown): string {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function normaliseStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => normaliseName(item)).filter(Boolean)));
  }
  if (typeof value === 'string') {
    return normaliseStringArray(value.split(','));
  }
  return [];
}

function normalisePosition(value: unknown): 'GK' | 'DEF' | 'ATT' | null {
  if (!value) return null;
  const upper = String(value).trim().toUpperCase();
  if (upper === 'GK') return 'GK';
  if (upper === 'D' || upper === 'DEF') return 'DEF';
  if (upper === 'F' || upper === 'ATT') return 'ATT';
  return null;
}

function clampQuarterNumber(value: number): Quarter {
  const clamped = Math.min(Math.max(Math.round(value), 1), 4);
  return clamped as Quarter;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
