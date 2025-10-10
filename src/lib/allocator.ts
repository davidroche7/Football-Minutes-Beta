/**
 * Core allocation algorithm for fair football minutes distribution
 */

import { CONFIG } from '../config/constants';
import type {
  Allocation,
  Quarter,
  PlayerSlot,
  QuarterAllocation,
} from './types';

/**
 * Allocate players fairly across 4 quarters
 *
 * Algorithm approach:
 * 1. Calculate target minutes per player (total slots * 15min / num players)
 * 2. For each quarter, assign GK first (full 15min)
 * 3. Assign outfield positions (2 DEF + 2 ATT per wave)
 * 4. Track player minutes and balance allocations
 * 5. Ensure GK players get at least one 10-min outfield block
 *
 * @param players - Array of player names
 * @param manualGKs - Optional array of 4 GK assignments (one per quarter)
 * @param retryCount - Internal retry counter to prevent infinite loops
 * @returns Complete allocation for all quarters
 */
export function allocate(players: string[], manualGKs?: [string, string, string, string], retryCount: number = 0): Allocation {
  if (players.length < 5) {
    throw new Error('Need at least 5 players for a 5-a-side match');
  }

  if (players.length > 15) {
    throw new Error('Maximum 15 players supported');
  }

  // Validate manual GKs if provided
  if (manualGKs) {
    manualGKs.forEach((gk, index) => {
      if (!players.includes(gk)) {
        throw new Error(`Manual GK for Q${index + 1} (${gk}) is not in the player list`);
      }
    });
  }

  // Initialize tracking
  const playerMinutes = new Map<string, number>();
  const playerGKCount = new Map<string, number>();
  const playerOutfield10MinCount = new Map<string, number>();

  players.forEach((p) => {
    playerMinutes.set(p, 0);
    playerGKCount.set(p, 0);
    playerOutfield10MinCount.set(p, 0);
  });

  const quarters: QuarterAllocation[] = [];

  // Allocate each quarter
  for (let q = 1; q <= CONFIG.QUARTERS; q++) {
    const manualGK = manualGKs ? manualGKs[q - 1] : undefined;
    const slots = allocateQuarter(
      q as Quarter,
      players,
      playerMinutes,
      playerGKCount,
      playerOutfield10MinCount,
      manualGK
    );
    quarters.push({ quarter: q as Quarter, slots });
  }

  // Build summary
  const summary: Record<string, number> = {};
  players.forEach((p) => {
    summary[p] = playerMinutes.get(p) || 0;
  });

  const allocation = { quarters, summary };

  // Validate variance constraint (max ±5 minutes)
  const stats = calculateVariance(allocation);
  if (stats.variance > 10 && retryCount < 100) {
    // If variance is too high, try again with different randomization
    // This is a simple retry mechanism - in rare cases we might need multiple attempts
    return allocate(players, manualGKs, retryCount + 1);
  }

  // Validate no successive subs
  const successiveSubError = validateNoSuccessiveSubs(allocation, players);
  if (successiveSubError && retryCount < 100) {
    // If successive subs detected, try again with different randomization
    return allocate(players, manualGKs, retryCount + 1);
  }

  // If we hit max retries, return the best attempt we have
  return allocation;
}

/**
 * Allocate a single quarter
 */
function allocateQuarter(
  _quarter: Quarter,
  players: string[],
  playerMinutes: Map<string, number>,
  playerGKCount: Map<string, number>,
  playerOutfield10MinCount: Map<string, number>,
  manualGK?: string
): PlayerSlot[] {
  const slots: PlayerSlot[] = [];
  const usedThisQuarter = new Set<string>();

  // 1. Assign GK (full 15 minutes)
  const gk = manualGK || selectGK(players, playerMinutes, playerGKCount, playerOutfield10MinCount);
  slots.push({ player: gk, position: 'GK', minutes: 15 });
  usedThisQuarter.add(gk);
  playerMinutes.set(gk, (playerMinutes.get(gk) || 0) + 15);
  playerGKCount.set(gk, (playerGKCount.get(gk) || 0) + 1);

  // 2. Assign first wave (10 minutes): 2 DEF + 2 ATT
  const firstWave = selectOutfieldWave(
    players,
    playerMinutes,
    usedThisQuarter,
    4,
    true, // Allow reuse if needed
    playerGKCount,
    playerOutfield10MinCount,
    true // This is the first wave (10 min blocks)
  );

  // Assign 2 DEF, 2 ATT
  firstWave.slice(0, 2).forEach((p) => {
    slots.push({ player: p, position: 'DEF', minutes: 10, wave: 'first' });
    playerMinutes.set(p, (playerMinutes.get(p) || 0) + 10);
    playerOutfield10MinCount.set(p, (playerOutfield10MinCount.get(p) || 0) + 1);
    usedThisQuarter.add(p);
  });

  firstWave.slice(2, 4).forEach((p) => {
    slots.push({ player: p, position: 'ATT', minutes: 10, wave: 'first' });
    playerMinutes.set(p, (playerMinutes.get(p) || 0) + 10);
    playerOutfield10MinCount.set(p, (playerOutfield10MinCount.get(p) || 0) + 1);
    usedThisQuarter.add(p);
  });

  // 3. Assign second wave (5 minutes): 2 DEF + 2 ATT
  const secondWave = selectOutfieldWave(
    players,
    playerMinutes,
    usedThisQuarter,
    4,
    true // Allow reuse if needed
  );

  secondWave.slice(0, 2).forEach((p) => {
    slots.push({ player: p, position: 'DEF', minutes: 5, wave: 'second' });
    playerMinutes.set(p, (playerMinutes.get(p) || 0) + 5);
  });

  secondWave.slice(2, 4).forEach((p) => {
    slots.push({ player: p, position: 'ATT', minutes: 5, wave: 'second' });
    playerMinutes.set(p, (playerMinutes.get(p) || 0) + 5);
  });

  return slots;
}

/**
 * Select goalkeeper for this quarter
 * Priority: least GK time, then least total minutes
 * Must eventually give outfield time to GK players (enforced elsewhere)
 */
function selectGK(
  players: string[],
  playerMinutes: Map<string, number>,
  playerGKCount: Map<string, number>,
  _playerOutfield10MinCount: Map<string, number>
): string {
  // Sort by: fewest GK quarters, then fewest total minutes
  const sorted = [...players].sort((a, b) => {
    const aGK = playerGKCount.get(a) || 0;
    const bGK = playerGKCount.get(b) || 0;

    if (aGK !== bGK) return aGK - bGK;

    const aMin = playerMinutes.get(a) || 0;
    const bMin = playerMinutes.get(b) || 0;
    const diff = aMin - bMin;

    // Add small randomness for variety when minutes are close
    if (Math.abs(diff) <= 5) {
      return Math.random() - 0.5;
    }
    return diff;
  });

  return sorted[0]!;
}

/**
 * Select players for an outfield wave
 * Priority:
 * 1. Players who played GK but haven't got their 10-min outfield block yet
 * 2. Players with least total minutes
 * 3. Add randomization for variety
 */
function selectOutfieldWave(
  players: string[],
  playerMinutes: Map<string, number>,
  usedThisQuarter: Set<string>,
  count: number,
  allowReuse: boolean = false,
  playerGKCount?: Map<string, number>,
  playerOutfield10MinCount?: Map<string, number>,
  isFirstWave: boolean = false
): string[] {
  let available = players.filter((p) => !usedThisQuarter.has(p));

  // If not enough available players and reuse is allowed, use all players
  if (available.length < count && allowReuse) {
    available = players;
  }

  // Sort by priority
  const sorted = available.sort((a, b) => {
    // Priority 1: If this is first wave (10 min), prioritize GK players who need outfield time
    if (isFirstWave && playerGKCount && playerOutfield10MinCount) {
      const aIsGK = (playerGKCount.get(a) || 0) > 0;
      const bIsGK = (playerGKCount.get(b) || 0) > 0;
      const aHasOutfield = (playerOutfield10MinCount.get(a) || 0) > 0;
      const bHasOutfield = (playerOutfield10MinCount.get(b) || 0) > 0;

      // Prioritize GK players who don't have outfield time yet
      if (aIsGK && !aHasOutfield && (!bIsGK || bHasOutfield)) return -1;
      if (bIsGK && !bHasOutfield && (!aIsGK || aHasOutfield)) return 1;
    }

    // Priority 2: Fewest total minutes
    const aMin = playerMinutes.get(a) || 0;
    const bMin = playerMinutes.get(b) || 0;
    const diff = aMin - bMin;

    // If within 5 minutes of each other, add randomness
    if (Math.abs(diff) <= 5) {
      return Math.random() - 0.5;
    }
    return diff;
  });

  return sorted.slice(0, count);
}

/**
 * Validate an allocation meets all constraints
 *
 * @param allocation - The allocation to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateAllocation(allocation: Allocation): string[] {
  const errors: string[] = [];

  // Check all quarters are present
  if (allocation.quarters.length !== CONFIG.QUARTERS) {
    errors.push(`Expected ${CONFIG.QUARTERS} quarters, got ${allocation.quarters.length}`);
  }

  // Check each quarter has correct structure
  allocation.quarters.forEach((q) => {
    const gkCount = q.slots.filter((s) => s.position === 'GK').length;
    if (gkCount !== CONFIG.POSITIONS.GK) {
      errors.push(`Quarter ${q.quarter}: Expected ${CONFIG.POSITIONS.GK} GK, got ${gkCount}`);
    }

    // Count DEF positions
    const defCount = q.slots.filter((s) => s.position === 'DEF').length;
    if (defCount !== CONFIG.POSITIONS.DEF * 2) {
      errors.push(
        `Quarter ${q.quarter}: Expected ${CONFIG.POSITIONS.DEF * 2} DEF slots, got ${defCount}`
      );
    }

    // Count ATT positions
    const attCount = q.slots.filter((s) => s.position === 'ATT').length;
    if (attCount !== CONFIG.POSITIONS.ATT * 2) {
      errors.push(
        `Quarter ${q.quarter}: Expected ${CONFIG.POSITIONS.ATT * 2} ATT slots, got ${attCount}`
      );
    }
  });

  // Check GK players have outfield time (if configured)
  if (CONFIG.RULES.GK_REQUIRES_OUTFIELD) {
    const gkPlayers = new Set<string>();
    allocation.quarters.forEach((q) => {
      q.slots.forEach((s) => {
        if (s.position === 'GK') gkPlayers.add(s.player);
      });
    });

    gkPlayers.forEach((gkPlayer) => {
      const hasOutfield10Min = allocation.quarters.some((q) =>
        q.slots.some(
          (s) =>
            s.player === gkPlayer &&
            s.position !== 'GK' &&
            s.minutes === CONFIG.TIME_BLOCKS.OUTFIELD_LONG
        )
      );

      if (!hasOutfield10Min) {
        errors.push(`Player ${gkPlayer} played GK but has no 10-min outfield block`);
      }
    });
  }

  return errors;
}

/**
 * Calculate variance statistics for an allocation
 */
export function calculateVariance(allocation: Allocation): {
  min: number;
  max: number;
  variance: number;
  mean: number;
} {
  const minutes = Object.values(allocation.summary);
  const min = Math.min(...minutes);
  const max = Math.max(...minutes);
  const mean = minutes.reduce((a, b) => a + b, 0) / minutes.length;
  const variance = max - min;

  return { min, max, variance, mean };
}

/**
 * Get players who are substitutes (not playing) for a specific quarter
 */
export function getSubsForQuarter(
  allocation: Allocation,
  quarter: Quarter,
  allPlayers: string[]
): string[] {
  const quarterAllocation = allocation.quarters.find((q) => q.quarter === quarter);
  if (!quarterAllocation) return allPlayers;

  const playingPlayers = new Set(quarterAllocation.slots.map((s) => s.player));
  return allPlayers.filter((p) => !playingPlayers.has(p));
}

/**
 * Get quarter-by-quarter breakdown for a player
 * Returns array of [Q1, Q2, Q3, Q4] with format like "GK", "10", "5", "sub"
 */
export function getPlayerQuarterBreakdown(
  allocation: Allocation,
  playerName: string,
  _allPlayers: string[]
): string[] {
  const breakdown: string[] = [];

  allocation.quarters.forEach((quarter) => {
    const playerSlot = quarter.slots.find((s) => s.player === playerName);

    if (!playerSlot) {
      // Player is a sub this quarter
      breakdown.push('sub');
    } else if (playerSlot.position === 'GK') {
      breakdown.push('GK');
    } else {
      // Outfield player - show minutes
      breakdown.push(playerSlot.minutes.toString());
    }
  });

  return breakdown;
}

/**
 * Validate that no player has two successive quarters as a substitute
 * @param allocation - The allocation to validate
 * @param allPlayers - All players in the game
 * @returns Error message if validation fails, null otherwise
 */
function validateNoSuccessiveSubs(allocation: Allocation, allPlayers: string[]): string | null {
  for (const player of allPlayers) {
    let consecutiveSubs = 0;

    for (let q = 1; q <= 4; q++) {
      const quarter = allocation.quarters.find((quarter) => quarter.quarter === q);
      if (!quarter) continue;

      const isPlaying = quarter.slots.some((s) => s.player === player);

      if (!isPlaying) {
        consecutiveSubs++;
        if (consecutiveSubs >= 2) {
          return `Player ${player} would be a substitute for ${consecutiveSubs} consecutive quarters (Q${q - consecutiveSubs + 1}-Q${q}). Maximum allowed is 1 quarter.`;
        }
      } else {
        consecutiveSubs = 0;
      }
    }
  }

  return null;
}

/**
 * Swap a playing slot with a substitute player
 * The substitute takes the position/minutes of the slot, the playing player becomes a sub
 *
 * @param allocation - Current allocation
 * @param quarter - Quarter number
 * @param slotIndex - Index of the slot to swap
 * @param subPlayer - Name of the substitute player
 * @param allPlayers - All players in the game
 * @returns Updated allocation
 */
export function swapWithSub(
  allocation: Allocation,
  quarter: Quarter,
  slotIndex: number,
  subPlayer: string,
  allPlayers: string[]
): Allocation {
  // Clone the allocation
  const newQuarters = allocation.quarters.map((q) => ({
    ...q,
    slots: [...q.slots],
  }));

  // Find the quarter
  const quarterAllocation = newQuarters.find((q) => q.quarter === quarter);
  if (!quarterAllocation) {
    throw new Error(`Quarter ${quarter} not found`);
  }

  // Validate slot index
  if (slotIndex < 0 || slotIndex >= quarterAllocation.slots.length) {
    throw new Error(`Invalid slot index ${slotIndex}`);
  }

  const slot = quarterAllocation.slots[slotIndex];
  if (!slot) {
    throw new Error('Slot not found');
  }

  // Cannot swap GK with sub
  if (slot.position === 'GK') {
    throw new Error('Cannot swap GK with substitute');
  }

  // Verify subPlayer is actually a sub
  const playingPlayers = quarterAllocation.slots.map((s) => s.player);
  if (playingPlayers.includes(subPlayer)) {
    throw new Error('Player is already playing this quarter');
  }

  if (!allPlayers.includes(subPlayer)) {
    throw new Error('Player not in game');
  }

  // Swap: sub takes the slot, playing player becomes sub
  quarterAllocation.slots[slotIndex] = {
    ...slot,
    player: subPlayer,
  };

  // Recalculate summary
  const summary: Record<string, number> = {};
  newQuarters.forEach((q) => {
    q.slots.forEach((s) => {
      const playerName = s.player;
      if (!summary[playerName]) {
        summary[playerName] = 0;
      }
      summary[playerName]! += s.minutes;
    });
  });

  // Ensure all players are in summary
  allPlayers.forEach((p) => {
    if (!summary[p]) {
      summary[p] = 0;
    }
  });

  // Validate variance constraint
  const minutes = Object.values(summary);
  const min = Math.min(...minutes);
  const max = Math.max(...minutes);
  const variance = max - min;

  if (variance > 10) {
    throw new Error(`Swap would create too much variance (${variance} minutes). Maximum allowed is 10 minutes difference (±5 from mean).`);
  }

  // Validate no player has two successive quarters as sub
  const tempAllocation = { quarters: newQuarters, summary };
  const successiveSubError = validateNoSuccessiveSubs(tempAllocation, allPlayers);
  if (successiveSubError) {
    throw new Error(successiveSubError);
  }

  return {
    quarters: newQuarters,
    summary,
  };
}

/**
 * Swap players between two slots in the same quarter
 * Allows swapping any non-GK players, even with different minute allocations
 * Validates that the swap doesn't create variance > 5 minutes
 *
 * @param allocation - Current allocation
 * @param quarter - Quarter number
 * @param slotIndex1 - First slot index
 * @param slotIndex2 - Second slot index
 * @param allPlayers - All players in the game (optional, for successive sub validation)
 * @returns Updated allocation
 */
export function swapPositions(
  allocation: Allocation,
  quarter: Quarter,
  slotIndex1: number,
  slotIndex2: number,
  allPlayers?: string[]
): Allocation {
  // Clone the allocation
  const newQuarters = allocation.quarters.map((q) => ({
    ...q,
    slots: [...q.slots],
  }));

  // Find the quarter
  const quarterAllocation = newQuarters.find((q) => q.quarter === quarter);
  if (!quarterAllocation) {
    throw new Error(`Quarter ${quarter} not found`);
  }

  // Validate slot indices
  if (slotIndex1 < 0 || slotIndex1 >= quarterAllocation.slots.length) {
    throw new Error(`Invalid slot index ${slotIndex1}`);
  }
  if (slotIndex2 < 0 || slotIndex2 >= quarterAllocation.slots.length) {
    throw new Error(`Invalid slot index ${slotIndex2}`);
  }

  const slot1 = quarterAllocation.slots[slotIndex1];
  const slot2 = quarterAllocation.slots[slotIndex2];

  if (!slot1 || !slot2) {
    throw new Error('Slots not found');
  }

  // Validate swap rules - cannot swap GK positions
  if (slot1.position === 'GK' || slot2.position === 'GK') {
    throw new Error('Cannot swap GK positions');
  }

  // Swap the players completely - they take on each other's position, minutes, and wave
  const tempPlayer = slot1.player;
  quarterAllocation.slots[slotIndex1] = {
    ...slot1,
    player: slot2.player,
  };
  quarterAllocation.slots[slotIndex2] = {
    ...slot2,
    player: tempPlayer,
  };

  // Recalculate summary
  const summary: Record<string, number> = {};
  newQuarters.forEach((q) => {
    q.slots.forEach((slot) => {
      const playerName = slot.player;
      if (!summary[playerName]) {
        summary[playerName] = 0;
      }
      summary[playerName]! += slot.minutes;
    });
  });

  // Ensure all players are in summary (if allPlayers provided)
  if (allPlayers) {
    allPlayers.forEach((p) => {
      if (!summary[p]) {
        summary[p] = 0;
      }
    });
  }

  // Validate variance constraint (max ±5 minutes)
  const minutes = Object.values(summary);
  const min = Math.min(...minutes);
  const max = Math.max(...minutes);
  const variance = max - min;

  if (variance > 10) {
    // Max difference of 10 means ±5 from mean
    throw new Error(`Swap would create too much variance (${variance} minutes). Maximum allowed is 10 minutes difference (±5 from mean).`);
  }

  // Validate no successive subs (if allPlayers provided)
  if (allPlayers) {
    const tempAllocation = { quarters: newQuarters, summary };
    const successiveSubError = validateNoSuccessiveSubs(tempAllocation, allPlayers);
    if (successiveSubError) {
      throw new Error(successiveSubError);
    }
  }

  return {
    quarters: newQuarters,
    summary,
  };
}

/**
 * Update a single slot in an allocation
 * This updates the slot and recalculates the summary
 *
 * @param allocation - Current allocation
 * @param quarter - Quarter number to update
 * @param slotIndex - Index of slot within the quarter
 * @param newPlayer - New player name to assign
 * @returns Updated allocation
 */
export function updateSlot(
  allocation: Allocation,
  quarter: Quarter,
  slotIndex: number,
  newPlayer: string
): Allocation {
  // Clone the allocation
  const newQuarters = allocation.quarters.map((q) => ({
    ...q,
    slots: [...q.slots],
  }));

  // Find the quarter
  const quarterAllocation = newQuarters.find((q) => q.quarter === quarter);
  if (!quarterAllocation) {
    throw new Error(`Quarter ${quarter} not found`);
  }

  if (slotIndex < 0 || slotIndex >= quarterAllocation.slots.length) {
    throw new Error(`Invalid slot index ${slotIndex}`);
  }

  // Update the slot
  const currentSlot = quarterAllocation.slots[slotIndex];
  if (!currentSlot) {
    throw new Error(`Slot not found at index ${slotIndex}`);
  }

  quarterAllocation.slots[slotIndex] = {
    ...currentSlot,
    player: newPlayer,
  };

  // Recalculate summary
  const summary: Record<string, number> = {};

  newQuarters.forEach((q) => {
    q.slots.forEach((slot) => {
      const playerName = slot.player;
      if (!summary[playerName]) {
        summary[playerName] = 0;
      }
      summary[playerName]! += slot.minutes;
    });
  });

  return {
    quarters: newQuarters,
    summary,
  };
}
