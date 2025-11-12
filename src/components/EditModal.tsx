import { useState, useEffect } from 'react';
import type { Quarter, PlayerSlot, Wave } from '../lib/types';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: PlayerSlot | null;
  quarter: Quarter | null;
  slotIndex: number | null;
  availablePlayers: string[];
  onSave: (quarter: Quarter, slotIndex: number, newPlayer: string) => void;
  onSaveProperties?: (quarter: Quarter, slotIndex: number, updates: Partial<Pick<PlayerSlot, 'wave'>>) => void;
}

/**
 * Modal for editing a single player slot
 */
export function EditModal({
  isOpen,
  onClose,
  slot,
  quarter,
  slotIndex,
  availablePlayers,
  onSave,
  onSaveProperties,
}: EditModalProps) {
  const [selectedWave, setSelectedWave] = useState<Wave | undefined>(slot?.wave);

  useEffect(() => {
    setSelectedWave(slot?.wave);
  }, [slot]);

  if (!isOpen || !slot || quarter === null || slotIndex === null) {
    return null;
  }

  const handlePlayerSelect = (newPlayer: string) => {
    onSave(quarter, slotIndex, newPlayer);
    onClose();
  };

  const handleWaveChange = (wave: Wave | undefined) => {
    setSelectedWave(wave);
    if (onSaveProperties) {
      onSaveProperties(quarter, slotIndex, { wave });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Edit Slot
        </h2>

        <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-md">
          <p className="text-sm text-gray-600 dark:text-gray-400">Quarter {quarter}</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {slot.position} - {slot.minutes} minutes
            {selectedWave && ` (${selectedWave} wave)`}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Current: {slot.player}
          </p>
        </div>

        {/* Wave selector for outfield players */}
        {slot.position !== 'GK' && onSaveProperties && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Wave Assignment
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleWaveChange('first')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedWave === 'first'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                First Wave (0-5 min)
              </button>
              <button
                onClick={() => handleWaveChange('second')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedWave === 'second'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                Second Wave (5-10 min)
              </button>
            </div>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select New Player
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
            {availablePlayers.map((player) => (
              <button
                key={player}
                onClick={() => handlePlayerSelect(player)}
                className={`px-4 py-2 rounded-md text-left transition-colors ${
                  player === slot.player
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                {player}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
