import { useState } from 'react';

interface PlayerInputProps {
  onPlayersChange: (players: string[]) => void;
}

/**
 * Component for inputting and managing the list of players
 */
export function PlayerInput({ onPlayersChange }: PlayerInputProps) {
  const [playerName, setPlayerName] = useState('');
  const [players, setPlayers] = useState<string[]>([]);

  const handleAddPlayer = () => {
    const trimmed = playerName.trim();
    if (!trimmed) return;

    if (players.includes(trimmed)) {
      alert('Player already added');
      return;
    }

    const newPlayers = [...players, trimmed];
    setPlayers(newPlayers);
    onPlayersChange(newPlayers);
    setPlayerName('');
  };

  const handleRemovePlayer = (index: number) => {
    const newPlayers = players.filter((_, i) => i !== index);
    setPlayers(newPlayers);
    onPlayersChange(newPlayers);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddPlayer();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        Add Players
      </h2>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter player name"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        <button
          onClick={handleAddPlayer}
          disabled={!playerName.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
      </div>

      {players.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-700 dark:text-gray-300">
            Players ({players.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {players.map((player, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-md"
              >
                <span className="text-gray-900 dark:text-white">{player}</span>
                <button
                  onClick={() => handleRemovePlayer(index)}
                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 ml-2"
                  aria-label={`Remove ${player}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {players.length > 0 && (
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          {players.length < 5 && (
            <p className="text-red-600 dark:text-red-400">
              Add at least 5 players to generate allocation
            </p>
          )}
          {players.length >= 5 && players.length <= 15 && (
            <p className="text-green-600 dark:text-green-400">
              Ready to generate allocation
            </p>
          )}
          {players.length > 15 && (
            <p className="text-red-600 dark:text-red-400">
              Maximum 15 players supported
            </p>
          )}
        </div>
      )}
    </div>
  );
}
