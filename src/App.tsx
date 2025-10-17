import { useEffect, useState } from 'react';
import { PlayerInput } from './components/PlayerInput';
import { AllocationGrid } from './components/AllocationGrid';
import { PlayerSummary } from './components/PlayerSummary';
import { EditModal } from './components/EditModal';
import { GKSelector } from './components/GKSelector';
import { ConfirmTeamModal } from './components/ConfirmTeamModal';
import { Tabs } from './components/Tabs';
import { SeasonStatsView } from './components/SeasonStatsView';
import { RulesEngineView } from './components/RulesEngineView';
import { LoginForm } from './components/LoginForm';
import { allocate, updateSlot, swapPositions, swapWithSub } from './lib/allocator';
import { listMatches, saveMatch } from './lib/persistence';
import { getRules, persistRules, resetRules } from './lib/rules';
import { clearSession, loadStoredSession, storeSession, type AuthSession } from './lib/auth';
import type { Allocation, Quarter, PlayerSlot } from './lib/types';
import type { MatchRecord } from './lib/persistence';
import type { RuleConfig } from './config/rules';

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => loadStoredSession());
  const [players, setPlayers] = useState<string[]>([]);
  const [allocation, setAllocation] = useState<Allocation | null>(null);
  const [error, setError] = useState<string>('');
  const [manualGKs, setManualGKs] = useState<[string, string, string, string] | null>(null);

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
  const [activeTab, setActiveTab] = useState<'match' | 'season' | 'rules'>('match');
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [rules, setRules] = useState<RuleConfig>(() => getRules());

  useEffect(() => {
    storeSession(session);
  }, [session]);

  useEffect(() => {
    if (!session) {
      setMatches([]);
      return;
    }
    listMatches().then(setMatches).catch(() => setMatches([]));
  }, [session]);

  const handlePlayersChange = (newPlayers: string[]) => {
    setPlayers(newPlayers);
    setError('');
    setManualGKs(null); // Reset manual GKs when players change

    // Auto-generate allocation if we have enough players
    if (newPlayers.length >= 5 && newPlayers.length <= 15) {
      try {
        const newAllocation = allocate(newPlayers);
        setAllocation(newAllocation);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to allocate');
        setAllocation(null);
      }
    } else {
      setAllocation(null);
    }
  };

  const handleGenerateAllocation = () => {
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
  };

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

  const handleGKsChange = (gks: [string, string, string, string] | null) => {
    setManualGKs(gks);
    // Auto-regenerate if allocation exists
    if (allocation && players.length >= 5) {
      try {
        const newAllocation = allocate(players, gks || undefined);
        setAllocation(newAllocation);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to allocate');
      }
    }
  };

  const handleOpenConfirm = () => {
    setConfirmError('');
    setConfirmModalOpen(true);
  };

  const handleConfirmMatch = async ({ date, opponent }: { date: string; opponent: string }) => {
    if (!allocation || !session) return;
    setIsSavingMatch(true);
    setConfirmError('');
    try {
      const record = await saveMatch({
        date,
        opponent,
        players,
        allocation,
      });
      setSaveStatus(`Match saved for ${date} vs ${opponent}.`);
      setConfirmModalOpen(false);
      setMatches((prev) => [...prev, record]);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : 'Failed to save match');
    } finally {
      setIsSavingMatch(false);
    }
  };

  const initialDate = new Date().toISOString().slice(0, 10);

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
              Fair Football Minutes
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Sign in to manage match setups, season stats, and rules.
            </p>
          </header>
          <LoginForm
            onSuccess={(authSession) => {
              setSession(authSession);
              setSaveStatus('');
              setError('');
            }}
          />
          <div className="max-w-sm rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <p className="mb-2 font-medium">Sample Accounts</p>
            <ul className="space-y-1">
              <li>
                <span className="font-mono">coach / CoachSecure1!</span>
              </li>
              <li>
                <span className="font-mono">manager / ManagerSecure2@</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-8 flex flex-col items-center gap-2 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            Fair Football Minutes
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Calculate fair playing time distribution for 5-a-side football
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
            { id: 'match', label: 'Match Setup' },
            { id: 'season', label: 'Season Stats' },
            { id: 'rules', label: 'Rules Engine' },
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

        {activeTab === 'match' && (
          <>
            <div className="mb-8">
              <PlayerInput onPlayersChange={handlePlayersChange} />
            </div>

            {players.length >= 5 && (
              <GKSelector
                players={players}
                selectedGKs={manualGKs}
                onGKsChange={handleGKsChange}
              />
            )}

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
                <div className="mb-8 flex justify-center gap-4">
                  <button
                    onClick={handleGenerateAllocation}
                    className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-semibold"
                  >
                    Re-Generate Allocation
                  </button>
                  <button
                    onClick={handleOpenConfirm}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold disabled:cursor-not-allowed disabled:bg-blue-400"
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
                  initialDate={initialDate}
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
            />

            {players.length === 0 && (
              <div className="text-center mt-16 text-gray-500 dark:text-gray-400">
                <p className="text-lg mb-2">Get started by adding players above</p>
                <p className="text-sm">Add 5-15 players to generate a fair allocation</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'season' && (
          <SeasonStatsView
            matches={matches}
            onMatchesChange={setMatches}
            currentUser={session.username}
          />
        )}
        {activeTab === 'rules' && (
          <RulesEngineView rules={rules} onSave={handleRulesSave} onReset={handleRulesReset} />
        )}
      </div>
    </div>
  );
}

export default App;
