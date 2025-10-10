import { useState } from 'react';
import { PlayerInput } from './components/PlayerInput';
import { AllocationGrid } from './components/AllocationGrid';
import { PlayerSummary } from './components/PlayerSummary';
import { EditModal } from './components/EditModal';
import { GKSelector } from './components/GKSelector';
import { allocate, updateSlot, swapPositions, swapWithSub } from './lib/allocator';
import type { Allocation, Quarter, PlayerSlot } from './lib/types';

function App() {
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Fair Football Minutes
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Calculate fair playing time distribution for 5-a-side football
          </p>
        </header>

        {/* Player Input */}
        <div className="mb-8">
          <PlayerInput onPlayersChange={handlePlayersChange} />
        </div>

        {/* GK Selector */}
        {players.length >= 5 && (
          <GKSelector
            players={players}
            selectedGKs={manualGKs}
            onGKsChange={handleGKsChange}
          />
        )}

        {/* Error Display */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Generate Button */}
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

        {/* Allocation Display */}
        {allocation && (
          <>
            <div className="mb-8 flex justify-center">
              <button
                onClick={handleGenerateAllocation}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-semibold"
              >
                Re-Generate Allocation
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

            {/* Edit Modal */}
            <EditModal
              isOpen={editModalOpen}
              onClose={handleCloseModal}
              slot={editingSlot}
              quarter={editingQuarter}
              slotIndex={editingSlotIndex}
              availablePlayers={players}
              onSave={handleSaveEdit}
            />

            {/* TODO: Add export button */}
            {/* <div className="text-center">
              <button className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                Export to Excel
              </button>
            </div> */}
          </>
        )}

        {/* Empty State */}
        {players.length === 0 && (
          <div className="text-center mt-16 text-gray-500 dark:text-gray-400">
            <p className="text-lg mb-2">Get started by adding players above</p>
            <p className="text-sm">Add 5-15 players to generate a fair allocation</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
