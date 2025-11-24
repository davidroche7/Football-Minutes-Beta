import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlayerInput } from './components/PlayerInput';
import { AllocationGrid } from './components/AllocationGrid';
import { PlayerSummary } from './components/PlayerSummary';
import { EditModal } from './components/EditModal';
import { GKSelector } from './components/GKSelector';
import { ConfirmTeamModal } from './components/ConfirmTeamModal';
import { AllocationSummaryCard } from './components/AllocationSummaryCard';
import { Tabs } from './components/Tabs';
import { SeasonStatsView } from './components/SeasonStatsView';
import { RulesEngineView } from './components/RulesEngineView';
import { LoginForm } from './components/LoginForm';
import { AuditLogView } from './components/AuditLogView';
import { ThemeToggle } from './components/ThemeToggle';
import { allocate, updateSlot, updateSlotProperties, swapPositions, swapWithSub } from './lib/allocator';
import {
  listMatches,
  saveMatch,
  getMatchPersistenceMode,
  getMatchPersistenceError,
} from './lib/persistence';
import { getRules, persistRules, resetRules } from './lib/rules';
import { clearSession, loadStoredSession, storeSession, type AuthSession } from './lib/auth';
import { ensureSeedData } from './lib/bootstrap';
import { fetchTeamStats, type TeamStats } from './lib/statsClient';
import type { Allocation, Quarter, PlayerSlot } from './lib/types';
import type { MatchRecord } from './lib/persistence';
import type { RuleConfig } from './config/rules';
import { TEAM_ID, USE_API_PERSISTENCE } from './config/environment';

if (typeof window !== 'undefined') {
  ensureSeedData();
}

interface TeamSummarySnapshot {
  matches: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  wins: number;
  draws: number;
  losses: number;
}

const computeLocalTeamSummary = (records: MatchRecord[]): TeamSummarySnapshot => {
  let goalsFor = 0;
  let goalsAgainst = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;

  records.forEach((match) => {
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
    matches: records.length,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    wins,
    draws,
    losses,
  };
};

interface SummaryCardProps {
  label: string;
  value: number;
}

function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <div className="rounded-md bg-gray-50 px-4 py-3 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => loadStoredSession());
  const [players, setPlayers] = useState<string[]>([]);
  const [allocation, setAllocation] = useState<Allocation | null>(null);
  const [error, setError] = useState<string>('');
  const [manualGKs, setManualGKs] = useState<[string, string, string, string] | null>(null);
  const [matchPersistenceMode, setMatchPersistenceMode] = useState(() => getMatchPersistenceMode());
  const [matchPersistenceError, setMatchPersistenceError] = useState(
    () => getMatchPersistenceError()?.message ?? null
  );
  const [teamSummaryApi, setTeamSummaryApi] = useState<TeamStats | null>(null);
  const [teamStatsError, setTeamStatsError] = useState<string | null>(null);
  const [isTeamStatsLoading, setIsTeamStatsLoading] = useState(false);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const localTeamSummary = useMemo(() => computeLocalTeamSummary(matches), [matches]);
  const teamSummary: TeamSummarySnapshot = teamSummaryApi
    ? {
        matches: teamSummaryApi.played,
        goalsFor: teamSummaryApi.goalsFor,
        goalsAgainst: teamSummaryApi.goalsAgainst,
        goalDifference: teamSummaryApi.goalDifference,
        wins: teamSummaryApi.wins,
        draws: teamSummaryApi.draws,
        losses: teamSummaryApi.losses,
      }
    : localTeamSummary;
  const configuredTeamId = TEAM_ID;
  const showTeamConfigurationWarning = USE_API_PERSISTENCE && !configuredTeamId;

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<PlayerSlot | null>(null);
  const [editingQuarter, setEditingQuarter] = useState<Quarter | null>(null);
  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null);

  // Drag and drop state
  const [draggedSlot, setDraggedSlot] = useState<{ quarter: Quarter; slotIndex: number } | null>(null);
  const [draggedSub, setDraggedSub] = useState<{ quarter: Quarter; playerName: string } | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [confirmError, setConfirmError] = useState<string>('');
  const [isSavingMatch, setIsSavingMatch] = useState(false);
  const [activeTab, setActiveTab] = useState<'match' | 'season' | 'management'>('match');
  const [matchJustSaved, setMatchJustSaved] = useState(false);
  const [rules, setRules] = useState<RuleConfig>(() => getRules());

  // Match setup state (NEW - at the beginning of flow)
  const [matchSetupComplete, setMatchSetupComplete] = useState(false);
  const [matchDetails, setMatchDetails] = useState<{
    date: string;
    time: string;
    venue: 'Home' | 'Away' | 'Neutral';
    opponent: string;
  }>({
    date: new Date().toISOString().split('T')[0] || '',
    time: '',
    venue: 'Home',
    opponent: '',
  });

  const refreshMatchPersistenceState = useCallback(() => {
    const mode = getMatchPersistenceMode();
    setMatchPersistenceMode(mode);
    setMatchPersistenceError(getMatchPersistenceError()?.message ?? null);
    return mode;
  }, []);

  const syncMatchesFromSource = useCallback(async () => {
    if (!session) {
      setMatches([]);
      setTeamSummaryApi(null);
      setTeamStatsError(null);
      setIsTeamStatsLoading(false);
      return;
    }

    try {
      const records = await listMatches(
        configuredTeamId ? { teamId: configuredTeamId } : undefined
      );
      setMatches(records);
      const mode = refreshMatchPersistenceState();

      if (mode === 'api') {
        setIsTeamStatsLoading(true);
        try {
          const summary = await fetchTeamStats({
            teamId: configuredTeamId ?? undefined,
          });
          setTeamSummaryApi(summary ?? null);
          setTeamStatsError(null);
        } catch (err) {
          setTeamSummaryApi(null);
          setTeamStatsError(err instanceof Error ? err.message : 'Failed to load season summary.');
        } finally {
          setIsTeamStatsLoading(false);
        }
      } else {
        setTeamSummaryApi(null);
        setTeamStatsError(null);
        setIsTeamStatsLoading(false);
      }
    } catch (error) {
      setMatches([]);
      const mode = refreshMatchPersistenceState();
      if (mode === 'api') {
        setTeamSummaryApi(null);
        setTeamStatsError(error instanceof Error ? error.message : 'Failed to load matches.');
      }
      setIsTeamStatsLoading(false);
    }
  }, [configuredTeamId, refreshMatchPersistenceState, session]);

  useEffect(() => {
    storeSession(session);
  }, [session]);

  useEffect(() => {
    syncMatchesFromSource();
  }, [session, syncMatchesFromSource]);

  const handleMatchesChange = useCallback(
    (records: MatchRecord[]) => {
      setMatches(records);
      if (matchPersistenceMode === 'api') {
        syncMatchesFromSource();
      }
    },
    [matchPersistenceMode, syncMatchesFromSource]
  );

  const handlePlayersChange = useCallback((newPlayers: string[]) => {
    setPlayers(newPlayers);
    setError('');

    // Only reset manual GKs if selected GKs are no longer in the player list
    setManualGKs(prev => {
      if (!prev) return null;
      const invalidGKs = prev.some(gk => gk && !newPlayers.includes(gk));
      return invalidGKs ? null : prev;
    });

    // Only auto-generate allocation if we DON'T have one yet (first time)
    setAllocation(prev => {
      // Keep existing allocation - user may have edited it
      if (prev !== null) return prev;

      // Generate new allocation only if we have enough players
      if (newPlayers.length >= 5 && newPlayers.length <= 15) {
        try {
          return allocate(newPlayers);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to allocate');
          return null;
        }
      }

      return null;
    });
  }, []); // Empty deps - uses functional setState for all state access


  const handleGenerateAllocation = useCallback(() => {
    if (players.length < 5) {
      setError('Need at least 5 players');
      return;
    }
    if (players.length > 15) {
      setError('Maximum 15 players supported');
      return;
    }

    try {
      const newAllocation = allocate(players, manualGKs || undefined);
      setAllocation(newAllocation);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to allocate');
      setAllocation(null);
    }
  }, [players, manualGKs]); // Depends on both - needed for allocate()

  const handleSlotClick = (quarter: Quarter, slotIndex: number, slot: PlayerSlot) => {
    setEditingQuarter(quarter);
    setEditingSlotIndex(slotIndex);
    setEditingSlot(slot);
    setEditModalOpen(true);
  };

  const handleSaveEdit = (quarter: Quarter, slotIndex: number, newPlayer: string) => {
    if (!allocation) return;

    try {
      const updatedAllocation = updateSlot(allocation, quarter, slotIndex, newPlayer);
      setAllocation(updatedAllocation);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update slot');
    }
  };

  const handleSaveSlotProperties = (
    quarter: Quarter,
    slotIndex: number,
    updates: Partial<Pick<PlayerSlot, 'wave'>>
  ) => {
    if (!allocation) return;

    try {
      const updatedAllocation = updateSlotProperties(allocation, quarter, slotIndex, updates);
      setAllocation(updatedAllocation);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update slot properties');
    }
  };

  const handleCloseModal = () => {
    setEditModalOpen(false);
    setEditingSlot(null);
    setEditingQuarter(null);
    setEditingSlotIndex(null);
  };

  const handleDragStart = (quarter: Quarter, slotIndex: number) => {
    setDraggedSlot({ quarter, slotIndex });
    setDraggedSub(null);
  };

  const handleSubDragStart = (quarter: Quarter, playerName: string) => {
    setDraggedSub({ quarter, playerName });
    setDraggedSlot(null);
  };

  const handleDrop = (quarter: Quarter, slotIndex: number) => {
    if (!allocation) return;

    // Handle drop from substitute
    if (draggedSub) {
      if (draggedSub.quarter !== quarter) {
        setError('Can only swap positions within the same quarter');
        setDraggedSub(null);
        return;
      }

      try {
        const updatedAllocation = swapWithSub(
          allocation,
          quarter,
          slotIndex,
          draggedSub.playerName,
          players
        );
        setAllocation(updatedAllocation);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to swap with substitute');
      }

      setDraggedSub(null);
      return;
    }

    // Handle drop from slot
    if (!draggedSlot) return;

    // Only allow swapping within the same quarter
    if (draggedSlot.quarter !== quarter) {
      setError('Can only swap positions within the same quarter');
      setDraggedSlot(null);
      return;
    }

    // Don't swap with itself
    if (draggedSlot.slotIndex === slotIndex) {
      setDraggedSlot(null);
      return;
    }

    try {
      const updatedAllocation = swapPositions(
        allocation,
        quarter,
        draggedSlot.slotIndex,
        slotIndex,
        players
      );
      setAllocation(updatedAllocation);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to swap positions');
    }

    setDraggedSlot(null);
  };

  const handleDragEnd = () => {
    setDraggedSlot(null);
    setDraggedSub(null);
  };

  const handleGKsChange = useCallback((gks: [string, string, string, string] | null) => {
    setManualGKs(gks);
    setError('');

    // Always regenerate allocation with new GK selection (if we have one)
    setAllocation(prev => {
      // Only regenerate if we have an existing allocation and valid player count
      if (!prev || players.length < 5 || players.length > 15) {
        return prev;
      }

      try {
        return allocate(players, gks || undefined);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to regenerate with GK selection');
        return prev; // Keep previous allocation on error
      }
    });
  }, [players]); // Depends on players - needed for allocate()

  const handleOpenConfirm = () => {
    setConfirmError('');
    setConfirmModalOpen(true);
  };

  const handleConfirmMatch = async ({
    date,
    time,
    opponent,
    venue,
    goalsFor,
    goalsAgainst,
    outcome,
    playerOfMatch,
    honorableMentions,
    scorers,
  }: {
    date: string;
    time: string;
    opponent: string;
    venue: 'Home' | 'Away' | 'Neutral';
    goalsFor: number | null;
    goalsAgainst: number | null;
    outcome: 'Win' | 'Loss' | 'Draw' | '';
    playerOfMatch: string;
    honorableMentions: string;
    scorers: string;
  }) => {
    if (!allocation || !session) return;
    setIsSavingMatch(true);
    setConfirmError('');
    try {
      const hasResultDetails =
        venue ||
        outcome ||
        goalsFor !== null ||
        goalsAgainst !== null ||
        playerOfMatch.trim() ||
        honorableMentions.trim() ||
        scorers.trim();

      const toTitleCase = (value: string) =>
        value
          .trim()
          .split(/\s+/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');

      const parseList = (value: string, dedupe = false) => {
        const tokens = value
          .split(/[,;\n]+/)
          .map((token) => toTitleCase(token))
          .filter(Boolean);
        if (!dedupe) return tokens;
        const set = new Set(tokens);
        return Array.from(set);
      };

      await saveMatch({
        date,
        time: time.trim() || undefined,
        opponent,
        players,
        allocation,
        result: hasResultDetails
          ? {
              venue,
              result: outcome || undefined,
              goalsFor,
              goalsAgainst,
              playerOfMatch: playerOfMatch.trim() ? toTitleCase(playerOfMatch) : undefined,
              honorableMentions: parseList(honorableMentions, true),
              scorers: parseList(scorers, false),
            }
          : null,
        createdBy: session.username,
      });
      setSaveStatus(`Match saved for ${date} vs ${opponent}.`);
      setConfirmModalOpen(false);
      setMatchJustSaved(true);
      await syncMatchesFromSource();

      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : 'Failed to save match');
      refreshMatchPersistenceState();
    } finally {
      setIsSavingMatch(false);
    }
  };

  // Initial date moved to matchDetails state

  const handleLogout = () => {
    setSession(null);
    clearSession();
    setPlayers([]);
    setAllocation(null);
    setManualGKs(null);
    setMatches([]);
    setActiveTab('match');
    setSaveStatus('');
    setError('');
  };

  const handleRulesSave = (updated: RuleConfig) => {
    persistRules(updated);
    setRules(updated);
    window.location.reload();
  };

  const handleRulesReset = () => {
    resetRules();
    setRules(getRules());
    window.location.reload();
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 py-10 px-4 dark:bg-gray-900">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6">
          <header className="text-center">
            <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">
              Football Minutes
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Track lineups, stats, and fair playing time
            </p>
          </header>
          <LoginForm
            onSuccess={(authSession) => {
              setSession(authSession);
              setSaveStatus('');
              setError('');
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="mx-auto max-w-7xl relative">
        {/* Theme toggle in top right */}
        <div className="absolute top-0 right-0">
          <ThemeToggle />
        </div>

        {/* Header */}
        <header className="mb-8 flex flex-col items-center gap-2 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            Football Minutes
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track lineups, stats, and playing time
          </p>
          <div className="mt-2 flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
            <span>
              Signed in as <span className="font-semibold">{session.username}</span>
            </span>
            <button
              onClick={handleLogout}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Sign out
            </button>
          </div>
        </header>

        <Tabs
          tabs={[
            { id: 'match', label: 'Next Match' },
            { id: 'season', label: 'Season Stats' },
            { id: 'management', label: 'Player List & Rules' },
          ]}
          activeTab={activeTab}
          onSelect={(id) => setActiveTab(id as typeof activeTab)}
        />

        {/* Status Display */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
        {saveStatus && (
          <div className="max-w-2xl mx-auto mb-8 rounded-md border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-900/40 dark:text-green-200">
            {saveStatus}
          </div>
        )}

        {activeTab === 'match' && !matchSetupComplete && (
          <section className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
              Match Setup
            </h2>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
              Enter match details before selecting your lineup
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!matchDetails.opponent.trim()) {
                alert('Please enter opponent name');
                return;
              }
              setMatchSetupComplete(true);
            }} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="setup-date" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Match Date *
                  </label>
                  <input
                    id="setup-date"
                    type="date"
                    value={matchDetails.date}
                    onChange={(e) => setMatchDetails({ ...matchDetails, date: e.target.value })}
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label htmlFor="setup-time" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Kickoff Time
                  </label>
                  <input
                    id="setup-time"
                    type="time"
                    value={matchDetails.time}
                    onChange={(e) => setMatchDetails({ ...matchDetails, time: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="setup-venue" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Venue *
                  </label>
                  <select
                    id="setup-venue"
                    value={matchDetails.venue}
                    onChange={(e) => setMatchDetails({ ...matchDetails, venue: e.target.value as typeof matchDetails.venue })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="Home">Home</option>
                    <option value="Away">Away</option>
                    <option value="Neutral">Neutral</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="setup-opponent" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Opponent *
                  </label>
                  <input
                    id="setup-opponent"
                    type="text"
                    value={matchDetails.opponent}
                    onChange={(e) => setMatchDetails({ ...matchDetails, opponent: e.target.value })}
                    placeholder="e.g., Eastside Eagles"
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="submit"
                  className="rounded-md bg-green-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                >
                  Continue to Player Selection
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === 'match' && matchSetupComplete && !matchJustSaved && (
          <>
            <div className="mb-4 flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 dark:bg-blue-900/20">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {matchDetails.date} {matchDetails.time && `at ${matchDetails.time}`}
                </span>
                {' vs '}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {matchDetails.opponent}
                </span>
                {' ('}
                <span>{matchDetails.venue}</span>
                {')'}
              </div>
              <button
                onClick={() => setMatchSetupComplete(false)}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Edit Match Details
              </button>
            </div>

            <section className="mx-auto mb-8 w-full max-w-5xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <header className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Season Snapshot
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Overview of confirmed fixtures this season.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>Data source:</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 font-semibold ${
                      matchPersistenceMode === 'api'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 border border-green-200 dark:border-green-800/60'
                        : matchPersistenceMode === 'fallback'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-100 border border-yellow-300 dark:border-yellow-800/60'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100 border border-blue-200 dark:border-blue-800/60'
                    }`}
                  >
                    {teamSummaryApi
                      ? 'API backend'
                      : matchPersistenceMode === 'fallback'
                      ? 'Local fallback'
                      : 'Local storage'}
                  </span>
                </div>
              </header>

              {matchPersistenceMode === 'api' && isTeamStatsLoading && !teamStatsError && (
                <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                  Loading latest season statistics…
                </p>
              )}
              {matchPersistenceMode === 'api' && teamStatsError && (
                <div className="mb-3 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-xs text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-100">
                  Unable to retrieve backend stats: {teamStatsError}. Showing local calculations instead.
                </div>
              )}
              {showTeamConfigurationWarning && (
                <div className="mb-3 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-xs text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-100">
                  API persistence is enabled but no team ID is configured (
                  <code className="font-mono">VITE_TEAM_ID</code>). Working from local data until a
                  team is assigned.
                </div>
              )}
              {matchPersistenceMode === 'fallback' && matchPersistenceError && !showTeamConfigurationWarning && (
                <div className="mb-3 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-xs text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-100">
                  API unavailable: {matchPersistenceError}. Falling back to local data.
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard label="Matches Played" value={teamSummary.matches} />
                <SummaryCard label="Goals For" value={teamSummary.goalsFor} />
                <SummaryCard label="Goals Against" value={teamSummary.goalsAgainst} />
                <div className="rounded-md bg-gray-50 px-4 py-3 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200">
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Goal Difference
                  </p>
                  <p className="mt-1 text-2xl font-semibold">{teamSummary.goalDifference}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Record: {teamSummary.wins}-{teamSummary.draws}-{teamSummary.losses}
                  </p>
                </div>
              </div>
            </section>

            <AllocationSummaryCard allocation={allocation} selectedPlayers={players} />
            <div className="mb-8">
              <PlayerInput
                onPlayersChange={handlePlayersChange}
                currentUser={session.username}
              />
            </div>

            <GKSelector
              players={players}
              selectedGKs={manualGKs}
              onGKsChange={handleGKsChange}
            />

            {players.length >= 5 && players.length <= 15 && !allocation && (
              <div className="text-center mb-8">
                <button
                  onClick={handleGenerateAllocation}
                  className="px-8 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-lg font-semibold"
                >
                  Generate Allocation
                </button>
              </div>
            )}

            {allocation && (
              <>
                <div className="mb-8 flex justify-center">
                  <button
                    onClick={handleOpenConfirm}
                    className="px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold text-lg disabled:cursor-not-allowed disabled:bg-blue-400"
                    disabled={players.length < 5 || isSavingMatch}
                  >
                    Confirm Team
                  </button>
                </div>

                <div className="mb-8">
                  <AllocationGrid
                    allocation={allocation}
                    allPlayers={players}
                    onSlotClick={handleSlotClick}
                    onDragStart={handleDragStart}
                    onSubDragStart={handleSubDragStart}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                  />
                </div>

                <div className="mb-8">
                  <PlayerSummary allocation={allocation} allPlayers={players} />
                </div>

                <ConfirmTeamModal
                  isOpen={confirmModalOpen}
                  initialDate={matchDetails.date}
                  initialTime={matchDetails.time || ''}
                  initialVenue={matchDetails.venue}
                  initialOpponent={matchDetails.opponent}
                  onClose={() => setConfirmModalOpen(false)}
                  onConfirm={handleConfirmMatch}
                  allocation={allocation}
                  players={players}
                  isSaving={isSavingMatch}
                  error={confirmError}
                />
              </>
            )}

            <EditModal
              isOpen={editModalOpen}
              onClose={handleCloseModal}
              slot={editingSlot}
              quarter={editingQuarter}
              slotIndex={editingSlotIndex}
              availablePlayers={players}
              onSave={handleSaveEdit}
              onSaveProperties={handleSaveSlotProperties}
            />

            {players.length === 0 && (
              <div className="text-center mt-16 text-gray-500 dark:text-gray-400">
                <p className="text-lg mb-2">Add players above to begin</p>
                <p className="text-sm">Requires 5-15 players to generate allocation</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'match' && matchJustSaved && allocation && (
          <div className="mx-auto max-w-5xl space-y-6">
            {/* Matchday Overview */}
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
                Matchday Overview
              </h2>

              {/* Match Details Summary */}
              <div className="mb-6 rounded-md bg-gray-50 p-4 dark:bg-gray-800">
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Date:</span>{' '}
                    <span className="text-gray-900 dark:text-white">{matchDetails.date}</span>
                    {matchDetails.time && (
                      <>
                        {' '}
                        <span className="text-gray-600 dark:text-gray-400">at {matchDetails.time}</span>
                      </>
                    )}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Opponent:</span>{' '}
                    <span className="text-gray-900 dark:text-white">{matchDetails.opponent}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Venue:</span>{' '}
                    <span className="text-gray-900 dark:text-white">{matchDetails.venue}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Squad Size:</span>{' '}
                    <span className="text-gray-900 dark:text-white">{players.length} players</span>
                  </div>
                </div>
              </div>

              {/* Allocation Summary */}
              <div className="mb-6">
                <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                  Quarter Allocation
                </h3>
                <AllocationSummaryCard allocation={allocation} selectedPlayers={players} />
              </div>

              {/* Player Minutes Summary */}
              <div>
                <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                  Player Minutes
                </h3>
                <PlayerSummary allocation={allocation} allPlayers={players} />
              </div>
            </section>

            {/* Navigation Actions */}
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <button
                onClick={() => {
                  setMatchJustSaved(false);
                  setMatchSetupComplete(false);
                  setAllocation(null);
                  setPlayers([]);
                  setManualGKs(null);
                  setSaveStatus('');
                  setMatchDetails({
                    date: new Date().toISOString().split('T')[0] || '',
                    time: '',
                    opponent: '',
                    venue: 'Home',
                  });
                }}
                className="rounded-md bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                Create Another Match
              </button>
              <button
                onClick={() => {
                  setActiveTab('season');
                  setMatchJustSaved(false);
                }}
                className="rounded-md border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                View Season Stats
              </button>
            </div>
          </div>
        )}

        {activeTab === 'season' && (
          <SeasonStatsView
            matches={matches}
            onMatchesChange={handleMatchesChange}
            currentUser={session.username}
          />
        )}
        {activeTab === 'management' && (
          <div className="space-y-8">
            <section className="mx-auto max-w-5xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Player Roster Management
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Add, edit, or remove players. Players added here are available in Next Match.
              </p>
              <PlayerInput
                onPlayersChange={handlePlayersChange}
                currentUser={session.username}
                showMatchSelection={false}
              />
            </section>
            <section className="mx-auto max-w-5xl">
              <RulesEngineView rules={rules} onSave={handleRulesSave} onReset={handleRulesReset} />
            </section>
            <section className="mx-auto max-w-5xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Audit Log
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                View all team activity including player changes, match updates, and rule modifications.
              </p>
              <AuditLogView limit={100} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
