import type { Allocation } from '../lib/types';
import { CONFIG } from '../config/constants';
import { calculateVariance, getPlayerQuarterBreakdown } from '../lib/allocator';

interface PlayerSummaryProps {
  allocation: Allocation;
  allPlayers: string[];
}

/**
 * Component to display the summary of total minutes per player
 */
export function PlayerSummary({ allocation, allPlayers }: PlayerSummaryProps) {
  const stats = calculateVariance(allocation);
  const sortedPlayers = Object.entries(allocation.summary).sort(
    ([, a], [, b]) => b - a
  );

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        Player Summary
      </h2>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded-md">
          <p className="text-xs text-gray-600 dark:text-gray-400">Average</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {stats.mean.toFixed(1)} min
          </p>
        </div>
        <div className="bg-green-50 dark:bg-green-900 p-3 rounded-md">
          <p className="text-xs text-gray-600 dark:text-gray-400">Min</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {stats.min} min
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900 p-3 rounded-md">
          <p className="text-xs text-gray-600 dark:text-gray-400">Max</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {stats.max} min
          </p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900 p-3 rounded-md">
          <p className="text-xs text-gray-600 dark:text-gray-400">Variance</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {stats.variance} min
          </p>
        </div>
      </div>

      {/* Player List */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-300 dark:border-gray-600">
              <th className="text-left py-2 px-4 text-gray-700 dark:text-gray-300">
                Player
              </th>
              <th className="text-left py-2 px-4 text-gray-700 dark:text-gray-300">
                Q1 + Q2 + Q3 + Q4
              </th>
              <th className="text-right py-2 px-4 text-gray-700 dark:text-gray-300">
                Total Minutes
              </th>
              <th className="text-right py-2 px-4 text-gray-700 dark:text-gray-300">
                vs Average
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map(([player, minutes]) => {
              const diff = minutes - stats.mean;
              const diffSign = diff > 0 ? '+' : '';
              const breakdown = getPlayerQuarterBreakdown(
                allocation,
                player,
                allPlayers
              );

              return (
                <tr
                  key={player}
                  className="border-b border-gray-200 dark:border-gray-700"
                >
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                    {player}
                  </td>
                  <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                    <span className="font-mono text-sm">
                      {breakdown.join(' + ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                    {minutes} min
                  </td>
                  <td
                    className={`py-3 px-4 text-right text-sm ${
                      diff > 0
                        ? 'text-green-600 dark:text-green-400'
                        : diff < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {diffSign}
                    {diff.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {stats.variance > CONFIG.RULES.MAX_MINUTE_VARIANCE && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-md">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Note: Fairness difference is above the target of{' '}
            {CONFIG.RULES.MAX_MINUTE_VARIANCE} minutes. This can happen with
            uneven player counts or strict constraints.
          </p>
        </div>
      )}
    </div>
  );
}
