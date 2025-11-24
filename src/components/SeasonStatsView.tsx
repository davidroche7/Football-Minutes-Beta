import { useEffect, useMemo, useState, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import type { Allocation, Quarter, PlayerSlot } from '../lib/types';
import type { MatchRecord, MatchResult, SaveMatchPayload } from '../lib/persistence';
import {
  bulkImportMatches,
  updateMatch,
  deleteMatch,
  type MatchUpdatePayload,
  getMatchPersistenceMode,
  listMatches,
} from '../lib/persistence';
import { fetchTeamStats, fetchPlayerStats } from '../lib/statsClient';
import { getRules } from '../lib/rules';
import type { RuleConfig } from '../config/rules';
import { AllocationGrid } from './AllocationGrid';
import { EditModal } from './EditModal';
import { PlayerHeatMap } from './PlayerHeatMap';
import { TEAM_ID } from '../config/environment';

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

const createDraftFromMatch = (match: MatchRecord): MatchDraft | null => {
  try {
    // Validate required data exists
    if (!match || !match.allocation || !match.allocation.quarters || match.allocation.quarters.length === 0) {
      console.error('Invalid match data - missing or empty allocation:', match?.id, match?.opponent);
      return null;
    }

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
      players: derivePlayersFromAllocation(allocation, match.players || []),
    };
  } catch (error) {
    console.error('Failed to create draft for match:', match?.id, match?.opponent, error);
    return null;
  }
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

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    matchId: string;
    opponent: string;
  } | null>(null);
  const [apiSeasonSummary, setApiSeasonSummary] = useState<SeasonSnapshot | null>(null);
  const [apiPlayerSummaries, setApiPlayerSummaries] = useState<PlayerSummaryRow[] | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [matchPersistenceMode, setMatchPersistenceMode] = useState(() => getMatchPersistenceMode());
  const configuredTeamId = TEAM_ID;

  const [seasonStatsTab, setSeasonStatsTab] = useState<'games' | 'players'>('games');

  // Player stats sorting state
  type SortField = 'player' | 'totalMinutes' | 'matchesPlayed' | 'gkQuarters' | 'goals' | 'playerOfMatchAwards' | 'honorableMentions';
  const [sortField, setSortField] = useState<SortField>('totalMinutes');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const rules = useMemo(() => getRules(), []);
  const perMatchTarget = rules.quarterDuration * rules.quarters;

  const refreshMatchPersistenceState = useCallback(() => {
    const mode = getMatchPersistenceMode();
    setMatchPersistenceMode(mode);
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
      const draft = createDraftFromMatch(match);
      if (draft) {
        nextDrafts[match.id] = draft;
      }
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
            goals: 0,
            playerOfMatchAwards: 0,
            honorableMentions: 0,
          });

        entry.totalMinutes += total;
        entry.matchesPlayed += 1;
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

  const unsortedPlayerSummaries = apiPlayerSummaries ?? derivedPlayerSummaries;
  const seasonSummary = apiSeasonSummary ?? derivedSeasonSummary;

  // Sort player summaries based on current sort field and direction
  const playerSummaries = useMemo(() => {
    const sorted = [...unsortedPlayerSummaries];
    sorted.sort((a, b) => {
      let comparison = 0;

      if (sortField === 'player') {
        comparison = a.player.localeCompare(b.player);
      } else {
        comparison = a[sortField] - b[sortField];
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [unsortedPlayerSummaries, sortField, sortDirection]);

  const handleSortColumn = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with default descending for numbers, ascending for names
      setSortField(field);
      setSortDirection(field === 'player' ? 'asc' : 'desc');
    }
  };

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

      // Handle adding new slot (slotIndex === -1 signals adding a new GK)
      if (slotIndex === -1) {
        const newGkSlot: PlayerSlot = {
          player: toTitleCase(newPlayer),
          position: 'GK',
          minutes: 10,
        };
        // Insert GK at the beginning of slots array
        targetQuarter.slots.unshift(newGkSlot);
      } else {
        // Handle editing existing slot
        if (!targetQuarter.slots[slotIndex]) return draft;
        targetQuarter.slots[slotIndex] = {
          ...targetQuarter.slots[slotIndex]!,
          player: toTitleCase(newPlayer),
        };
      }

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
    const draft = createDraftFromMatch(match);
    if (draft) {
      setDrafts((prev) => ({ ...prev, [match.id]: draft }));
    }
    setMatchFeedback((prev) => ({ ...prev, [match.id]: {} }));
  };

  const handleDeleteFixture = async (matchId: string) => {
    try {
      setSavingMatchId(matchId);
      await deleteMatch(matchId);

      // Remove from local state
      const updatedMatches = matches.filter(m => m.id !== matchId);
      onMatchesChange(updatedMatches);

      // Clear drafts and expanded state
      setDrafts(prev => {
        const updated = { ...prev };
        delete updated[matchId];
        return updated;
      });
      setExpandedMatches(prev => prev.filter(id => id !== matchId));

      setDeleteConfirmation(null);
      setMatchFeedback(prev => ({
        ...prev,
        [matchId]: { status: 'Fixture deleted successfully' },
      }));
    } catch (error) {
      setMatchFeedback(prev => ({
        ...prev,
        [matchId]: { error: error instanceof Error ? error.message : 'Failed to delete fixture' },
      }));
    } finally {
      setSavingMatchId(null);
    }
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
      const updatedDraft = createDraftFromMatch(updated);
      if (updatedDraft) {
        setDrafts((prev) => ({ ...prev, [match.id]: updatedDraft }));
      }
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
    ? (drafts[modalState.matchId]?.players ?? []).sort((a, b) => a.localeCompare(b))
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

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setSeasonStatsTab('games')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
              seasonStatsTab === 'games'
                ? 'border-green-500 text-green-600 dark:text-green-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Games
          </button>
          <button
            onClick={() => setSeasonStatsTab('players')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
              seasonStatsTab === 'players'
                ? 'border-green-500 text-green-600 dark:text-green-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Players
          </button>
        </nav>
      </div>

      {seasonStatsTab === 'games' && hasMatches && (
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

      {seasonStatsTab === 'games' && hasMatches && (
          <section className="space-y-4">
            {matches.map((match) => {
              const isExpanded = expandedMatches.includes(match.id);
              const warnings = match.allocation.warnings ?? [];
              const draft = drafts[match.id];

              // Show error UI for matches that failed draft creation
              if (!draft) {
                return (
                  <div
                    key={match.id}
                    className="rounded-lg border-2 border-red-300 bg-red-50 p-4 shadow-sm dark:border-red-800 dark:bg-red-900/20"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-red-800 dark:text-red-300">
                          Error Loading Match Data
                        </h3>
                        <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                          vs {match.opponent} on {match.date}
                        </p>
                        <p className="mt-2 text-sm text-red-600 dark:text-red-300">
                          This match is missing required lineup data. Check the browser console for details.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => console.log('Match data:', match)}
                            className="rounded-md border border-red-400 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
                          >
                            Show Debug Info
                          </button>
                          <span className="text-xs text-red-500 dark:text-red-400 font-mono">
                            ID: {match.id}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
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
                      {resultPayload && resultPayload.scorers && resultPayload.scorers.length > 0 && (
                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-semibold">Goalscorers:</span> {resultPayload.scorers.join(', ')}
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
                        onClick={() => setDeleteConfirmation({ matchId: match.id, opponent: draft.opponent })}
                        className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                        disabled={isSaving}
                      >
                        Delete
                      </button>
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
                            Goalscorers <span className="text-xs text-gray-500 dark:text-gray-400">(Add goal counts in parentheses if needed)</span>
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
                              placeholder="e.g., John Smith (3), Jane Doe (2), Bob Jones (1), Alice Brown (1)"
                              rows={3}
                              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500"
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

                      {match.editHistory && match.editHistory.length > 0 && (
                        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                          <p className="mb-2 font-medium text-gray-700 dark:text-gray-200">Change Log</p>
                          <ul className="space-y-1">
                            {match.editHistory.map((event) => (
                              <li key={event.id}>
                                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                                  {event.editedAt}
                                </span>{' '}
                                {event.editedBy} changed {event.field} from "{event.previousValue || '—'}" to "{event.newValue || '—'}"
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
      )}

      {seasonStatsTab === 'players' && hasMatches && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Player Statistics
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                <tr>
                  <th
                    onClick={() => handleSortColumn('player')}
                    className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                  >
                    <div className="flex items-center gap-1">
                      Player
                      {sortField === 'player' && (
                        <span className="text-xs">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortColumn('totalMinutes')}
                    className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Total Minutes
                      {sortField === 'totalMinutes' && (
                        <span className="text-xs">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortColumn('matchesPlayed')}
                    className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Matches
                      {sortField === 'matchesPlayed' && (
                        <span className="text-xs">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortColumn('gkQuarters')}
                    className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                  >
                    <div className="flex items-center justify-end gap-1">
                      GK Quarters
                      {sortField === 'gkQuarters' && (
                        <span className="text-xs">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortColumn('goals')}
                    className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Goals
                      {sortField === 'goals' && (
                        <span className="text-xs">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortColumn('playerOfMatchAwards')}
                    className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                  >
                    <div className="flex items-center justify-end gap-1">
                      POTM
                      {sortField === 'playerOfMatchAwards' && (
                        <span className="text-xs">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortColumn('honorableMentions')}
                    className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                  >
                    <div className="flex items-center justify-end gap-1">
                      H.M.
                      {sortField === 'honorableMentions' && (
                        <span className="text-xs">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {playerSummaries.map((row) => (
                    <tr key={row.player} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {row.player}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        {row.totalMinutes}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        {row.matchesPlayed}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        {row.gkQuarters}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        {row.goals}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        {row.playerOfMatchAwards}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        {row.honorableMentions}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {seasonStatsTab === 'players' && hasMatches && (
        <section className="mt-6">
          <PlayerHeatMap matches={matches} />
        </section>
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

      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              Delete Fixture
            </h2>

            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Are you sure you want to delete the fixture against <strong>{deleteConfirmation.opponent}</strong>?
            </p>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-md p-3 mb-6">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 font-semibold mb-2">
                This will permanently delete:
              </p>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-1">
                <li>Lineup data for all 4 quarters</li>
                <li>Match result and awards</li>
                <li>Player statistics for this fixture</li>
              </ul>
              <p className="text-sm text-yellow-800 dark:text-yellow-200 font-semibold mt-2">
                This cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                disabled={savingMatchId === deleteConfirmation.matchId}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteFixture(deleteConfirmation.matchId)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={savingMatchId === deleteConfirmation.matchId}
              >
                {savingMatchId === deleteConfirmation.matchId ? 'Deleting...' : 'Delete Fixture'}
              </button>
            </div>
          </div>
        </div>
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
