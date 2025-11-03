import { useState, useMemo } from 'react';
import type { MatchRecord } from '../lib/persistence';
import {
  calculatePlayerPositionDistribution,
  getPlayersWithMatchTime,
} from '../lib/heatMapUtils';

interface PlayerHeatMapProps {
  matches: MatchRecord[];
}

/**
 * Get heat map color and opacity based on percentage
 * Returns red for high activity, fading to transparent for low
 * Intensified opacity values for better visibility against pitch
 */
function getHeatMapColor(percentage: number): { color: string; opacity: number } {
  if (percentage === 0) return { color: '#ef4444', opacity: 0 };
  if (percentage <= 20) return { color: '#fbbf24', opacity: 0.6 }; // Yellow, stronger
  if (percentage <= 40) return { color: '#f59e0b', opacity: 0.75 }; // Orange, stronger
  if (percentage <= 60) return { color: '#f97316', opacity: 0.85 }; // Deep orange, stronger
  if (percentage <= 80) return { color: '#dc2626', opacity: 0.92 }; // Red, stronger
  return { color: '#b91c1c', opacity: 1.0 }; // Dark red, maximum
}

/**
 * Component displaying a visual heat map of where a player has played across the season
 */
export function PlayerHeatMap({ matches }: PlayerHeatMapProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');

  const playersWithTime = useMemo(() => getPlayersWithMatchTime(matches), [matches]);

  const distribution = useMemo(() => {
    if (!selectedPlayer) {
      return null;
    }
    return calculatePlayerPositionDistribution(selectedPlayer, matches);
  }, [selectedPlayer, matches]);

  const gkHeat = distribution ? getHeatMapColor(distribution.GK) : null;
  const defHeat = distribution ? getHeatMapColor(distribution.DEF) : null;
  const attHeat = distribution ? getHeatMapColor(distribution.ATT) : null;

  return (
    <div className="w-full rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
        Player Position Heat Map
      </h3>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Visualize where a player has spent their time on the pitch across all matches this season.
      </p>

      {/* Player Selector */}
      <div className="mb-6">
        <label htmlFor="player-select" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
          Select Player
        </label>
        <select
          id="player-select"
          value={selectedPlayer}
          onChange={(e) => setSelectedPlayer(e.target.value)}
          className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option value="">-- Select a player --</option>
          {playersWithTime.map((player) => (
            <option key={player} value={player}>
              {player}
            </option>
          ))}
        </select>
      </div>

      {/* Heat Map Visualization */}
      {distribution && distribution.totalMinutes > 0 ? (
        <div className="flex flex-col items-center gap-6">
          {/* Football Pitch Visualization */}
          <div className="w-full max-w-xl">
            <svg
              viewBox="0 0 400 600"
              className="w-full rounded-lg border-2 border-gray-400 shadow-lg dark:border-gray-600"
            >
              {/* Defs for gradients and patterns */}
              <defs>
                {/* Grass pattern (stripes) */}
                <pattern id="grass-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                  <rect x="0" y="0" width="20" height="40" fill="#2d7a2d" />
                  <rect x="20" y="0" width="20" height="40" fill="#2a6e2a" />
                </pattern>

                {/* Radial gradient for GK zone - positioned at penalty spot */}
                <radialGradient id="gk-gradient" cx="50%" cy="15%" r="100%">
                  <stop offset="0%" stopColor={gkHeat?.color || '#ef4444'} stopOpacity={gkHeat?.opacity || 0} />
                  <stop offset="50%" stopColor={gkHeat?.color || '#ef4444'} stopOpacity={(gkHeat?.opacity || 0) * 0.3} />
                  <stop offset="100%" stopColor={gkHeat?.color || '#ef4444'} stopOpacity="0" />
                </radialGradient>

                {/* Radial gradient for DEF zone - positioned at midfield */}
                <radialGradient id="def-gradient" cx="50%" cy="50%" r="95%">
                  <stop offset="0%" stopColor={defHeat?.color || '#ef4444'} stopOpacity={defHeat?.opacity || 0} />
                  <stop offset="50%" stopColor={defHeat?.color || '#ef4444'} stopOpacity={(defHeat?.opacity || 0) * 0.3} />
                  <stop offset="100%" stopColor={defHeat?.color || '#ef4444'} stopOpacity="0" />
                </radialGradient>

                {/* Radial gradient for ATT zone - positioned at attacking penalty spot */}
                <radialGradient id="att-gradient" cx="50%" cy="85%" r="100%">
                  <stop offset="0%" stopColor={attHeat?.color || '#ef4444'} stopOpacity={attHeat?.opacity || 0} />
                  <stop offset="50%" stopColor={attHeat?.color || '#ef4444'} stopOpacity={(attHeat?.opacity || 0) * 0.3} />
                  <stop offset="100%" stopColor={attHeat?.color || '#ef4444'} stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Grass background */}
              <rect x="0" y="0" width="400" height="600" fill="url(#grass-pattern)" />

              {/* Outer pitch lines */}
              <rect
                x="10"
                y="10"
                width="380"
                height="580"
                fill="none"
                stroke="white"
                strokeWidth="3"
                opacity="0.9"
              />

              {/* Halfway line */}
              <line x1="10" y1="300" x2="390" y2="300" stroke="white" strokeWidth="3" opacity="0.9" />

              {/* Center circle */}
              <circle cx="200" cy="300" r="60" fill="none" stroke="white" strokeWidth="3" opacity="0.9" />
              <circle cx="200" cy="300" r="3" fill="white" opacity="0.9" />

              {/* Top goal area (GK zone) */}
              <rect
                x="140"
                y="10"
                width="120"
                height="40"
                fill="none"
                stroke="white"
                strokeWidth="2"
                opacity="0.9"
              />

              {/* Top penalty area */}
              <rect
                x="90"
                y="10"
                width="220"
                height="110"
                fill="none"
                stroke="white"
                strokeWidth="2"
                opacity="0.9"
              />

              {/* Top penalty spot */}
              <circle cx="200" cy="90" r="3" fill="white" opacity="0.9" />

              {/* Bottom goal area */}
              <rect
                x="140"
                y="550"
                width="120"
                height="40"
                fill="none"
                stroke="white"
                strokeWidth="2"
                opacity="0.9"
              />

              {/* Bottom penalty area */}
              <rect
                x="90"
                y="480"
                width="220"
                height="110"
                fill="none"
                stroke="white"
                strokeWidth="2"
                opacity="0.9"
              />

              {/* Bottom penalty spot */}
              <circle cx="200" cy="510" r="3" fill="white" opacity="0.9" />

              {/* Goal posts */}
              <rect x="170" y="5" width="60" height="5" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1" />
              <rect x="170" y="590" width="60" height="5" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1" />

              {/* Heat map overlays - overlapping zones for connected blobs */}

              {/* GK zone heat - extended down to connect with DEF */}
              {gkHeat && gkHeat.opacity > 0 && (
                <rect x="10" y="10" width="380" height="250" fill="url(#gk-gradient)" />
              )}

              {/* DEF zone heat - full height to connect GK and ATT */}
              {defHeat && defHeat.opacity > 0 && (
                <rect x="10" y="10" width="380" height="580" fill="url(#def-gradient)" />
              )}

              {/* ATT zone heat - extended up to connect with DEF */}
              {attHeat && attHeat.opacity > 0 && (
                <rect x="10" y="340" width="380" height="250" fill="url(#att-gradient)" />
              )}
            </svg>
          </div>

          {/* Summary Stats */}
          <div className="grid w-full max-w-xl grid-cols-3 gap-4 text-center">
            <div className="rounded-md bg-gradient-to-br from-yellow-100 to-orange-100 px-3 py-4 dark:from-yellow-900/30 dark:to-orange-900/30">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Goalkeeper
              </p>
              <p className="mt-1 text-3xl font-bold text-yellow-700 dark:text-yellow-300">
                {distribution.GK}%
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <div
                  className="h-3 w-20 rounded-full"
                  style={{
                    backgroundColor: gkHeat?.color || '#ef4444',
                    opacity: gkHeat?.opacity || 0,
                  }}
                />
              </div>
            </div>

            <div className="rounded-md bg-gradient-to-br from-blue-100 to-indigo-100 px-3 py-4 dark:from-blue-900/30 dark:to-indigo-900/30">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Defender
              </p>
              <p className="mt-1 text-3xl font-bold text-blue-700 dark:text-blue-300">
                {distribution.DEF}%
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <div
                  className="h-3 w-20 rounded-full"
                  style={{
                    backgroundColor: defHeat?.color || '#ef4444',
                    opacity: defHeat?.opacity || 0,
                  }}
                />
              </div>
            </div>

            <div className="rounded-md bg-gradient-to-br from-red-100 to-pink-100 px-3 py-4 dark:from-red-900/30 dark:to-pink-900/30">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Attacker
              </p>
              <p className="mt-1 text-3xl font-bold text-red-700 dark:text-red-300">
                {distribution.ATT}%
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <div
                  className="h-3 w-20 rounded-full"
                  style={{
                    backgroundColor: attHeat?.color || '#ef4444',
                    opacity: attHeat?.opacity || 0,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Heat Map Legend */}
          <div className="w-full max-w-xl rounded-md bg-gray-50 p-4 dark:bg-gray-900/50">
            <p className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
              Heat Map Intensity Guide
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-600 dark:text-gray-400">Low Activity</span>
              <div className="flex flex-1 items-center gap-1">
                <div className="h-4 flex-1 rounded-l" style={{ backgroundColor: '#fbbf24', opacity: 0.6 }} />
                <div className="h-4 flex-1" style={{ backgroundColor: '#f59e0b', opacity: 0.75 }} />
                <div className="h-4 flex-1" style={{ backgroundColor: '#f97316', opacity: 0.85 }} />
                <div className="h-4 flex-1" style={{ backgroundColor: '#dc2626', opacity: 0.92 }} />
                <div className="h-4 flex-1 rounded-r" style={{ backgroundColor: '#b91c1c', opacity: 1.0 }} />
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400">High Activity</span>
            </div>
          </div>

          {/* Total Minutes */}
          <div className="rounded-md bg-gradient-to-r from-green-100 to-emerald-100 px-6 py-3 dark:from-green-900/30 dark:to-emerald-900/30">
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              Total playing time:{' '}
              <span className="font-bold text-green-700 dark:text-green-300">
                {distribution.totalMinutes} minutes
              </span>
            </p>
          </div>
        </div>
      ) : selectedPlayer ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
          No match data found for {selectedPlayer}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
          Select a player above to view their position heat map
        </div>
      )}
    </div>
  );
}
