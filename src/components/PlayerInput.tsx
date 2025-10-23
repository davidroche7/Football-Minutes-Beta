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
  type RosterAuditEntry,
  type RosterPersistenceMode,
  type RosterPlayer,
} from '../lib/roster';
import { TEAM_ID, USE_API_PERSISTENCE } from '../config/environment';

interface PlayerInputProps {
  onPlayersChange: (players: string[]) => void;
  currentUser: string;
}

/**
 * Component for inputting and managing the list of players
 */
export function PlayerInput({ onPlayersChange, currentUser }: PlayerInputProps) {
  const [playerName, setPlayerName] = useState('');
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
    const selectedNames = selectedPlayerIds
      .map((id) => roster.find((player) => player.id === id && player.removedAt === null))
      .filter((player): player is RosterPlayer => Boolean(player))
      .map((player) => player.name);
    onPlayersChange(selectedNames);
  }, [selectedPlayerIds, roster, onPlayersChange]);

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

    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const created = await addPlayer(trimmed, currentUser);
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
    () => roster.filter((player) => player.removedAt === null),
    [roster]
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
            'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100 border border-blue-200 dark:border-blue-800/60',
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
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Add player to squad"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        <button
          onClick={handleAddPlayer}
          disabled={!playerName.trim() || isSubmitting}
          aria-label="Add player to squad"
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Adding…' : 'Add'}
        </button>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex-1">
          <h3 className="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-200">
            Squad Roster
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
                    <label className="flex items-center gap-3 text-gray-900 dark:text-white">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selected}
                        onChange={() => toggleSelection(player.id)}
                      />
                      <span>{player.name}</span>
                    </label>
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
                  className="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                >
                  {player.name}
                  <button
                    onClick={() => toggleSelection(player.id)}
                    className="text-blue-800 hover:text-blue-900 dark:text-blue-200 dark:hover:text-white"
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
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
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
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400 dark:text-blue-300 dark:hover:text-blue-200"
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
    </div>
  );
}
