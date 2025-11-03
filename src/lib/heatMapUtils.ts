import type { Position } from './types';
import type { MatchRecord } from './persistence';

/**
 * Position distribution for a player
 */
export interface PositionDistribution {
  GK: number; // Percentage
  DEF: number; // Percentage
  ATT: number; // Percentage
  totalMinutes: number;
}

/**
 * Calculate the percentage distribution of positions played by a player across all matches
 */
export function calculatePlayerPositionDistribution(
  playerName: string,
  matches: MatchRecord[]
): PositionDistribution {
  const minutesByPosition: Record<Position, number> = {
    GK: 0,
    DEF: 0,
    ATT: 0,
  };

  // Loop through all matches and quarters to count minutes per position
  matches.forEach((match) => {
    match.allocation.quarters.forEach((quarter) => {
      quarter.slots.forEach((slot) => {
        if (slot.player === playerName) {
          minutesByPosition[slot.position] += slot.minutes;
        }
      });
    });
  });

  const totalMinutes = minutesByPosition.GK + minutesByPosition.DEF + minutesByPosition.ATT;

  // Calculate percentages
  if (totalMinutes === 0) {
    return {
      GK: 0,
      DEF: 0,
      ATT: 0,
      totalMinutes: 0,
    };
  }

  return {
    GK: Math.round((minutesByPosition.GK / totalMinutes) * 100),
    DEF: Math.round((minutesByPosition.DEF / totalMinutes) * 100),
    ATT: Math.round((minutesByPosition.ATT / totalMinutes) * 100),
    totalMinutes,
  };
}

/**
 * Get color intensity based on percentage (0-100)
 * Returns opacity value for green overlay
 */
export function getHeatMapOpacity(percentage: number): number {
  if (percentage === 0) return 0;
  if (percentage <= 20) return 0.2;
  if (percentage <= 40) return 0.4;
  if (percentage <= 60) return 0.6;
  if (percentage <= 80) return 0.8;
  return 1.0;
}

/**
 * Get all unique player names from matches who have played
 */
export function getPlayersWithMatchTime(matches: MatchRecord[]): string[] {
  const playerSet = new Set<string>();

  matches.forEach((match) => {
    match.allocation.quarters.forEach((quarter) => {
      quarter.slots.forEach((slot) => {
        if (slot.player) {
          playerSet.add(slot.player);
        }
      });
    });
  });

  return Array.from(playerSet).sort((a, b) => a.localeCompare(b));
}
