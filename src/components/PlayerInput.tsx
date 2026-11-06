import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  addPlayer,
  getRosterAudit,
  getRosterLastError,
  getRosterPersistenceMode,
  listRoster,
  removePlayer,
  restorePlayer,
  updatePlayerSquad,
  type RosterAuditEntry,
  type RosterPersistenceMode,
  type RosterPlayer,
} from '../lib/roster';
import { TEAM_ID, USE_API_PERSISTENCE } from '../config/environment';
import { isEligible, isPlayerSquad, SQUAD_LABEL, type PlayerSquad, type Squad } from '../lib/squads';

interface PlayerInputProps {
  onPlayersChange: (players: string[]) => void;
  currentUser: string;
  showMatchSelection?: boolean;
  /** When picking for a squad, only that squad's players (plus Both/untagged) are offered. */
  squad?: Squad;
  /** Player name → label of the other squad's match they're already picked for that day. */
  clashes?: Record<string, string>;
}

function SquadSelect({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: PlayerSquad | null | undefined;
  onChange: (value: PlayerSquad | null) => void;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      aria-label={label}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(isPlayerSquad(e.target.value) ? e.target.value : null)}
      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
    >
      <option value="">Not set</option>
      <option value="REDS">{SQUAD_LABEL.REDS}</option>
      <option value="BLACKS">{SQUAD_LABEL.BLACKS}</option>
      <option value="BOTH">{SQUAD_LABEL.BOTH}</option>
    </select>
  );
}

/**
 * Component for inputting and managing the list of players
 */
export function PlayerInput({
  onPlayersChange,
  currentUser,
  showMatchSelection = true,
  squad,
  clashes,
}: PlayerInputProps) {
  const [playerName, setPlayerName] = useState('');
  const [newPlayerSquad, setNewPlayerSquad] = useState<PlayerSquad | null>(null);
  const [squadSavingIds, setSquadSavingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [auditEntries, setAuditEntries] = useState<RosterAuditEntry[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(true);
  const [persistenceMode, setPersistenceMode] = useState<RosterPersistenceMode>(
    getRosterPersistenceMode()
  );
  const [persistenceError, setPersistenceError] = useState<string | null>(
    getRosterLastError()?.message ?? null
  );
  const showTeamConfigurationWarning = USE_API_PERSISTENCE && !TEAM_ID;

  const refreshPersistenceState = useCallback(() => {
    setPersistenceMode(getRosterPersistenceMode());
    setPersistenceError(getRosterLastError()?.message ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadRoster() {
      setIsLoading(true);
      setError(null);
      try {
        const players = await listRoster({ includeRemoved: true });
        if (!mounted) return;
        setRoster(players);
        setSelectedPlayerIds((prev) =>
          prev.filter((id) =>
            players.some((player) => player.id === id && player.removedAt === null)
          )
        );
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load squad roster');
      } finally {
        if (mounted) {
          setIsLoading(false);
          refreshPersistenceState();
        }
      }
    }

    async function loadAudit() {
      setIsAuditLoading(true);
      try {
        const entries = await getRosterAudit();
        if (!mounted) return;
        setAuditEntries(entries);
      } catch (err) {
        if (!mounted) return;
        setError((prev) => prev ?? (err instanceof Error ? err.message : 'Failed to load roster log'));
      } finally {
        if (mounted) {
          setIsAuditLoading(false);
          refreshPersistenceState();
        }
      }
    }

    loadRoster();
    loadAudit();
    return () => {
      mounted = false;
    };
  }, [refreshPersistenceState]);

  useEffect(() => {
    if (!showMatchSelection) {
      onPlayersChange([]);
      return;
    }
    const selectedNames = selectedPlayerIds
      .map((id) => roster.find((player) => player.id === id && player.removedAt === null))
      .filter((player): player is RosterPlayer => Boolean(player))
      .map((player) => player.name);
    onPlayersChange(selectedNames);
  }, [selectedPlayerIds, roster, onPlayersChange, showMatchSelection]);

  const selectedPlayers = useMemo(
    () =>
      selectedPlayerIds
        .map((id) => roster.find((player) => player.id === id && player.removedAt === null))
        .filter((player): player is RosterPlayer => Boolean(player)),
    [selectedPlayerIds, roster]
  );

  const handleAddPlayer = async () => {
    const trimmed = playerName.trim();
    if (!trimmed || isSubmitting) return;

    // Check for duplicate name before making API call
    const existingPlayer = roster.find(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase() && p.removedAt === null
    );
    if (existingPlayer) {
      setError(
        showMatchSelection && squad && !isEligible(existingPlayer.squadGroup, squad)
          ? `${existingPlayer.name} is tagged ${SQUAD_LABEL[existingPlayer.squadGroup!]}. Change their squad under Management to pick them for ${SQUAD_LABEL[squad]}.`
          : `Player "${trimmed}" already exists in squad`
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      // While picking for a squad, a new player joins that squad.
      const squadForNew = showMatchSelection && squad ? squad : newPlayerSquad;
      const created = await addPlayer(trimmed, currentUser, squadForNew);
      const players = await listRoster({ includeRemoved: true });
      setRoster(players);
      setSelectedPlayerIds((prev) => [...prev, created.id]);
      setPlayerName('');
      const audit = await getRosterAudit();
      setAuditEntries(audit);
      setMessage(`Added ${created.name} to squad`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add player');
    } finally {
      setIsSubmitting(false);
      refreshPersistenceState();
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    if (actionTargetId || isSubmitting) return;

    setActionTargetId(playerId);
    setError(null);
    setMessage(null);
    try {
      await removePlayer(playerId, currentUser);
      const players = await listRoster({ includeRemoved: true });
      setRoster(players);
      setSelectedPlayerIds((prev) => prev.filter((id) => id !== playerId));
      const audit = await getRosterAudit();
      setAuditEntries(audit);
      setMessage('Player removed from squad');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove player');
    } finally {
      setActionTargetId(null);
      refreshPersistenceState();
    }
  };

  const handleRestorePlayer = async (playerId: string) => {
    if (actionTargetId || isSubmitting) return;

    setActionTargetId(playerId);
    setError(null);
    setMessage(null);
    try {
      await restorePlayer(playerId, currentUser);
      const players = await listRoster({ includeRemoved: true });
      setRoster(players);
      const restored = players.find((player) => player.id === playerId && player.removedAt === null);
      if (restored) {
        setSelectedPlayerIds((prev) =>
          prev.includes(restored.id) ? prev : [...prev, restored.id]
        );
      }
      const audit = await getRosterAudit();
      setAuditEntries(audit);
      setMessage('Player restored to squad');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore player');
    } finally {
      setActionTargetId(null);
      refreshPersistenceState();
    }
  };

  const handleSquadChange = async (playerId: string, squadGroup: PlayerSquad | null) => {
    if (squadSavingIds.has(playerId)) return;

    setSquadSavingIds((prev) => new Set(prev).add(playerId));
    setError(null);
    setMessage(null);
    try {
      const updated = await updatePlayerSquad(playerId, squadGroup, currentUser);
      if (updated) {
        setRoster((prev) =>
          prev.map((player) => (player.id === playerId ? { ...player, squadGroup: updated.squadGroup ?? null } : player))
        );
        setMessage(
          `${updated.name} is now ${squadGroup ? SQUAD_LABEL[squadGroup] : 'not set (available to both squads)'}`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update squad');
    } finally {
      setSquadSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(playerId);
        return next;
      });
      refreshPersistenceState();
    }
  };

  const toggleSelection = (playerId: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    );
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddPlayer();
    }
  };

  const activeRoster = useMemo(
    () =>
      roster.filter(
        (player) =>
          player.removedAt === null && (!showMatchSelection || !squad || isEligible(player.squadGroup, squad))
      ),
    [roster, showMatchSelection, squad]
  );

  const removedPlayers = useMemo(
    () => roster.filter((player) => player.removedAt !== null),
    [roster]
  );

  const persistenceDisplay = useMemo(() => {
    if (showTeamConfigurationWarning) {
      return {
        label: 'Local fallback',
        badgeClass:
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-100 border border-yellow-300 dark:border-yellow-800/60',
        helper: 'API mode enabled but no team configured. Using browser storage.',
      };
    }

    switch (persistenceMode) {
      case 'api':
        return {
          label: 'API backend',
          badgeClass:
            'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 border border-green-200 dark:border-green-800/60',
          helper: 'Changes sync to the server immediately.',
        };
      case 'fallback':
        return {
          label: 'Local fallback',
          badgeClass:
            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-100 border border-yellow-300 dark:border-yellow-800/60',
          helper: 'Unable to reach the API. Working from browser storage.',
        };
      default:
        return {
          label: 'Local storage',
          badgeClass:
            'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-100 border border-red-200 dark:border-red-800/60',
          helper: 'Data stored in this browser until backend sync is enabled.',
        };
    }
  }, [persistenceMode, showTeamConfigurationWarning]);

  return (
    <div className="w-full max-w-3xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        Squad Selection
      </h2>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-600 dark:text-gray-300">Persistence Mode:</span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${persistenceDisplay.badgeClass}`}
          >
            {persistenceDisplay.label}
          </span>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">{persistenceDisplay.helper}</span>
      </div>

      {showTeamConfigurationWarning && (
        <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-100">
          API persistence is enabled but no team ID is configured (<code className="font-mono text-xs">VITE_TEAM_ID</code>). Working
          from local storage until a team is assigned.
        </div>
      )}

      {persistenceMode === 'fallback' && persistenceError && !showTeamConfigurationWarning && (
        <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-100">
          API unavailable: {persistenceError}. Continuing with local storage until connectivity returns.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/60 dark:text-red-200">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/60 dark:text-green-200">
          {message}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {!showMatchSelection && (
          <SquadSelect
            id="new-player-squad"
            label="Squad for new player"
            value={newPlayerSquad}
            onChange={setNewPlayerSquad}
          />
        )}
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Add player to squad"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        <button
          onClick={handleAddPlayer}
          disabled={!playerName.trim() || isSubmitting}
          aria-label="Add player to squad"
          className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Adding…' : 'Add'}
        </button>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex-1">
          <h3 className="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-200">
            {showMatchSelection && squad ? `${SQUAD_LABEL[squad]} Roster` : 'Squad Roster'}
          </h3>
          {isLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading roster…</p>
          ) : activeRoster.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No players in the squad yet. Add players above to build your roster.
            </p>
          ) : (
            <ul className="space-y-2">
              {activeRoster.map((player) => {
                const selected = selectedPlayerIds.includes(player.id);
                const disabling = actionTargetId === player.id;
                return (
                  <li
                    key={player.id}
                    className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40"
                  >
                    {showMatchSelection ? (
                      <div className="flex flex-col">
                        <label className="flex items-center gap-3 text-gray-900 dark:text-white">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={selected}
                            onChange={() => toggleSelection(player.id)}
                          />
                          <span>{player.name}</span>
                        </label>
                        {clashes?.[player.name] && (
                          <span className="ml-7 text-xs font-medium text-amber-700 dark:text-amber-300">
                            Already picked for {clashes[player.name]}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-gray-900 dark:text-white">{player.name}</span>
                        <SquadSelect
                          id={`squad-${player.id}`}
                          label={`Squad for ${player.name}`}
                          value={player.squadGroup}
                          disabled={squadSavingIds.has(player.id)}
                          onChange={(value) => handleSquadChange(player.id, value)}
                        />
                      </div>
                    )}
                    <button
                      onClick={() => handleRemovePlayer(player.id)}
                      disabled={disabling}
                      className="text-xs font-medium text-red-600 hover:text-red-700 disabled:text-gray-400 dark:text-red-400 dark:hover:text-red-300"
                    >
                      {disabling ? 'Removing…' : 'Remove'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {showMatchSelection && (
          <div className="flex-1">
            <h3 className="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-200">
              Selected for this match ({selectedPlayers.length})
            </h3>
            {selectedPlayers.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select players from your roster to build the match squad.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedPlayers.map((player) => (
                  <span
                    key={player.id}
                    className="flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-sm text-red-800 dark:bg-red-900/40 dark:text-red-200"
                  >
                    {player.name}
                    <button
                      onClick={() => toggleSelection(player.id)}
                      className="text-red-800 hover:text-red-900 dark:text-red-200 dark:hover:text-white"
                      aria-label={`Remove ${player.name} from match squad`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              {selectedPlayers.length < 5 && (
                <p className="text-red-600 dark:text-red-400">
                  Select at least 5 players to generate an allocation.
                </p>
              )}
              {selectedPlayers.length >= 5 && selectedPlayers.length <= 15 && (
                <p className="text-green-600 dark:text-green-400">
                  Ready to generate allocation.
                </p>
              )}
              {selectedPlayers.length > 15 && (
                <p className="text-red-600 dark:text-red-400">
                  Maximum 15 players can be selected for a match.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          Roster history &amp; removed players
          {removedPlayers.length > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              {removedPlayers.length} removed
            </span>
          )}
        </summary>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-200">
              Removed Players
            </h3>
            {isLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
            ) : removedPlayers.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">No removed players.</p>
            ) : (
              <ul className="space-y-2">
                {removedPlayers.map((player) => {
                  const disabling = actionTargetId === player.id;
                  return (
                    <li
                      key={player.id}
                      className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{player.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Removed{' '}
                          {player.removedAt ? new Date(player.removedAt).toLocaleString() : '—'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRestorePlayer(player.id)}
                        disabled={disabling}
                        className="text-xs font-medium text-red-600 hover:text-red-700 disabled:text-gray-400 dark:text-red-300 dark:hover:text-red-200"
                      >
                        {disabling ? 'Restoring…' : 'Restore'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-200">
              Roster Changes
            </h3>
            {isAuditLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading audit log…</p>
            ) : auditEntries.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Roster history will appear here once changes are made.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {auditEntries
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/50"
                    >
                      <p className="text-gray-800 dark:text-gray-200">
                        <span className="font-semibold">{entry.playerName}</span> was{' '}
                        <span className="font-semibold">
                          {entry.action === 'added'
                            ? 'added'
                            : entry.action === 'removed'
                            ? 'removed'
                            : 'restored'}
                        </span>{' '}
                        by {entry.actor}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(entry.timestamp).toLocaleString()}
                      </p>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
