import type { Quarter } from '../lib/types';

interface GKSelectorProps {
  players: string[];
  selectedGKs: [string, string, string, string] | null;
  onGKsChange: (gks: [string, string, string, string] | null) => void;
}

/**
 * Component to manually select GK for each quarter
 */
export function GKSelector({ players, selectedGKs, onGKsChange }: GKSelectorProps) {
  const handleGKChange = (quarter: Quarter, player: string) => {
    const newGKs: [string, string, string, string] = selectedGKs || [
      players[0] || '',
      players[0] || '',
      players[0] || '',
      players[0] || '',
    ];
    newGKs[quarter - 1] = player;
    onGKsChange(newGKs);
  };

  const handleClear = () => {
    onGKsChange(null);
  };

  if (players.length < 5) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg mb-8">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          <span className="font-semibold">GK Selection:</span> Select at least 5 players to enable goalkeeper assignment.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Manual GK Selection (Optional)
        </h2>
        {selectedGKs && (
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
            aria-label="Clear all manual GK selections and use automatic allocation"
          >
            Clear GK Selection
          </button>
        )}
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Select specific players to be GK for each quarter. Leave set to "Auto" for automatic allocation based on playing time.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {([1, 2, 3, 4] as Quarter[]).map((quarter) => (
          <div key={quarter}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quarter {quarter}
            </label>
            <select
              value={selectedGKs?.[quarter - 1] || ''}
              onChange={(e) => handleGKChange(quarter, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Auto</option>
              {players.map((player) => (
                <option key={player} value={player}>
                  {player}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
