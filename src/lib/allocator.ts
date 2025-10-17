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

const MAX_ALLOCATION_ATTEMPTS = 200;

/**
 * Allocate players fairly across 4 quarters.
 *
 * 1. Calculate target minutes per player based on 4×10 minute quarters.
 * 2. Assign GK (full 10 minutes), then 0-5 and 5-10 minute outfield waves.
 * 3. Track player minutes to minimise variance.
 * 4. Enforce fairness rules (GK outfield requirement, no consecutive subs).
 */
export function allocate(players: string[], manualGKs?: [string, string, string, string]): Allocation {
  if (players.length < 5) {
    throw new Error('Need at least 5 players for a 5-a-side match');
  }

  if (players.length > 15) {
    throw new Error('Maximum 15 players supported');
  }

  if (manualGKs) {
    manualGKs.forEach((gk, index) => {
      if (!players.includes(gk)) {
        throw new Error(`Manual GK for Q${index + 1} (${gk}) is not in the player list`);
      }
    });
  }

  let bestAllocation: Allocation | null = null;
  let bestVariance = Infinity;
  let lastSuccessiveSubError: string | null = null;
  let bestAllocationWarnings: string[] = [];

  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt++) {
    const attemptResult = performAllocationAttempt(players, manualGKs);
    const { allocation, variance, successiveSubError } = attemptResult;

    if (successiveSubError) {
      lastSuccessiveSubError = successiveSubError;
      continue;
    }

    if (variance < bestVariance) {
      bestAllocation = allocation;
      bestVariance = variance;
      bestAllocationWarnings = [];
    }

    if (variance <= CONFIG.RULES.MAX_MINUTE_VARIANCE) {
      return { ...allocation, warnings: [] };
    }
  }

  if (!bestAllocation) {
    throw new Error(
      lastSuccessiveSubError ??
        'Unable to generate a valid allocation. Try adjusting the player list or rules.'
    );
  }

  if (bestVariance <= CONFIG.RULES.MAX_MINUTE_VARIANCE) {
    return { ...bestAllocation, warnings: bestAllocationWarnings };
  }

  const warning =
    `Fairness difference is ${bestVariance} minutes, above the configured limit ` +
    `of ${CONFIG.RULES.MAX_MINUTE_VARIANCE}. Consider adjusting rules for larger rosters.`;
  return {
    ...bestAllocation,
    warnings: [warning],
  };
}

interface AllocationAttemptResult {
  allocation: Allocation;
  variance: number;
  successiveSubError: string | null;
}

function performAllocationAttempt(
  players: string[],
  manualGKs?: [string, string, string, string]
): AllocationAttemptResult {
  const playerMinutes = new Map<string, number>();
  const playerGKCount = new Map<string, number>();
  const playerOutfieldPrimaryWaveCount = new Map<string, number>();
  const consecutiveSubCounts = new Map<string, number>();

  players.forEach((p) => {
    playerMinutes.set(p, 0);
    playerGKCount.set(p, 0);
    playerOutfieldPrimaryWaveCount.set(p, 0);
    consecutiveSubCounts.set(p, 0);
  });

  const quarters: QuarterAllocation[] = [];

  for (let q = 1; q <= CONFIG.QUARTERS; q++) {
    const manualGK = manualGKs ? manualGKs[q - 1] : undefined;
    const mustPlayPlayers = new Set(
      players.filter((p) => (consecutiveSubCounts.get(p) || 0) >= 1)
    );

    const slots = allocateQuarter(
      q as Quarter,
      players,
      playerMinutes,
      playerGKCount,
      playerOutfieldPrimaryWaveCount,
      manualGK,
      mustPlayPlayers
    );
    quarters.push({ quarter: q as Quarter, slots });

    const playingThisQuarter = new Set(slots.map((slot) => slot.player));
    players.forEach((p) => {
      if (playingThisQuarter.has(p)) {
        consecutiveSubCounts.set(p, 0);
      } else {
        consecutiveSubCounts.set(p, (consecutiveSubCounts.get(p) || 0) + 1);
      }
    });
  }

  const summary: Record<string, number> = {};
  players.forEach((p) => {
    summary[p] = playerMinutes.get(p) || 0;
  });

  const allocation = { quarters, summary };
  const stats = calculateVariance(allocation);
  const variance = stats.variance;
  const successiveSubError = validateNoSuccessiveSubs(allocation, players);

  return { allocation, variance, successiveSubError };
}

/**
 * Allocate a single quarter
 */
function allocateQuarter(
  _quarter: Quarter,
  players: string[],
  playerMinutes: Map<string, number>,
  playerGKCount: Map<string, number>,
  playerOutfieldPrimaryWaveCount: Map<string, number>,
  manualGK?: string,
  mustPlayPlayers?: Set<string>
): PlayerSlot[] {
  const slots: PlayerSlot[] = [];
  const usedThisQuarter = new Set<string>();

  // 1. Assign GK (full 10 minutes)
  const gk =
    manualGK ||
    selectGK(players, playerMinutes, playerGKCount, mustPlayPlayers);
  slots.push({ player: gk, position: 'GK', minutes: CONFIG.TIME_BLOCKS.GK_FULL });
  usedThisQuarter.add(gk);
  playerMinutes.set(gk, (playerMinutes.get(gk) || 0) + CONFIG.TIME_BLOCKS.GK_FULL);
  playerGKCount.set(gk, (playerGKCount.get(gk) || 0) + 1);

  // 2. Assign first wave (0-5 minutes): 2 DEF + 2 ATT
  const firstWave = selectOutfieldWave(
    players,
    playerMinutes,
    usedThisQuarter,
    4,
    true, // Allow reuse if needed
    playerGKCount,
    playerOutfieldPrimaryWaveCount,
    mustPlayPlayers,
    true, // This is the first wave (0-5 min block)
    gk
  );

  // Assign 2 DEF, 2 ATT
  firstWave.slice(0, 2).forEach((p) => {
    slots.push({ player: p, position: 'DEF', minutes: CONFIG.TIME_BLOCKS.OUTFIELD_FIRST, wave: 'first' });
    playerMinutes.set(p, (playerMinutes.get(p) || 0) + CONFIG.TIME_BLOCKS.OUTFIELD_FIRST);
    playerOutfieldPrimaryWaveCount.set(p, (playerOutfieldPrimaryWaveCount.get(p) || 0) + 1);
    usedThisQuarter.add(p);
  });

  firstWave.slice(2, 4).forEach((p) => {
    slots.push({ player: p, position: 'ATT', minutes: CONFIG.TIME_BLOCKS.OUTFIELD_FIRST, wave: 'first' });
    playerMinutes.set(p, (playerMinutes.get(p) || 0) + CONFIG.TIME_BLOCKS.OUTFIELD_FIRST);
    playerOutfieldPrimaryWaveCount.set(p, (playerOutfieldPrimaryWaveCount.get(p) || 0) + 1);
    usedThisQuarter.add(p);
  });

  // 3. Assign second wave (5-10 minutes): 2 DEF + 2 ATT
  const secondWave = selectOutfieldWave(
    players,
    playerMinutes,
    usedThisQuarter,
    4,
    true, // Allow reuse if needed
    undefined,
    undefined,
    mustPlayPlayers,
    false,
    gk
  );

  secondWave.slice(0, 2).forEach((p) => {
    slots.push({ player: p, position: 'DEF', minutes: CONFIG.TIME_BLOCKS.OUTFIELD_SECOND, wave: 'second' });
    playerMinutes.set(p, (playerMinutes.get(p) || 0) + CONFIG.TIME_BLOCKS.OUTFIELD_SECOND);
  });

  secondWave.slice(2, 4).forEach((p) => {
    slots.push({ player: p, position: 'ATT', minutes: CONFIG.TIME_BLOCKS.OUTFIELD_SECOND, wave: 'second' });
    playerMinutes.set(p, (playerMinutes.get(p) || 0) + CONFIG.TIME_BLOCKS.OUTFIELD_SECOND);
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
  mustPlayPlayers?: Set<string>
): string {
  // Sort by: fewest GK quarters, then fewest total minutes
  const sorted = [...players].sort((a, b) => {
    const aGK = playerGKCount.get(a) || 0;
    const bGK = playerGKCount.get(b) || 0;

    const aMustPlay = mustPlayPlayers?.has(a) ? 1 : 0;
    const bMustPlay = mustPlayPlayers?.has(b) ? 1 : 0;
    if (aMustPlay !== bMustPlay) {
      return bMustPlay - aMustPlay;
    }

    if (aGK !== bGK) return aGK - bGK;

    const aMin = playerMinutes.get(a) || 0;
    const bMin = playerMinutes.get(b) || 0;
    const diff = aMin - bMin;

    return diff;
  });

  return sorted[0]!;
}

/**
 * Select players for an outfield wave
 * Priority:
 * 1. Players who played GK but haven't got their primary outfield block yet
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
  playerOutfieldPrimaryWaveCount?: Map<string, number>,
  mustPlayPlayers?: Set<string>,
  isFirstWave: boolean = false,
  currentQuarterGK?: string
): string[] {
  const filterCurrentQuarterGK = (player: string) =>
    currentQuarterGK ? player !== currentQuarterGK : true;

  let available = players.filter(
    (p) => !usedThisQuarter.has(p) && filterCurrentQuarterGK(p)
  );

  if (available.length < count && allowReuse) {
    const pool = players.filter(filterCurrentQuarterGK);
    const candidates = pool
      .filter((p) => !available.includes(p))
      .sort((a, b) => comparePlayers(a, b, playerMinutes));

    available = [
      ...available,
      ...candidates.slice(0, count - available.length),
    ];
  }

  const sorted = available.sort((a, b) => {
    if (isFirstWave && playerGKCount && playerOutfieldPrimaryWaveCount) {
      const aIsGK = (playerGKCount.get(a) || 0) > 0;
      const bIsGK = (playerGKCount.get(b) || 0) > 0;
      const aHasOutfield = (playerOutfieldPrimaryWaveCount.get(a) || 0) > 0;
      const bHasOutfield = (playerOutfieldPrimaryWaveCount.get(b) || 0) > 0;

      if (aIsGK && !aHasOutfield && (!bIsGK || bHasOutfield)) return -1;
      if (bIsGK && !bHasOutfield && (!aIsGK || aHasOutfield)) return 1;
    }

    if (mustPlayPlayers) {
      const aMustPlay = mustPlayPlayers.has(a);
      const bMustPlay = mustPlayPlayers.has(b);
      if (aMustPlay !== bMustPlay) {
        return aMustPlay ? -1 : 1;
      }
    }

    return comparePlayers(a, b, playerMinutes);
  });

  return sorted.slice(0, count);
}

function comparePlayers(
  a: string,
  b: string,
  playerMinutes: Map<string, number>
): number {
  const aMin = playerMinutes.get(a) || 0;
  const bMin = playerMinutes.get(b) || 0;
  const diff = aMin - bMin;
  if (diff !== 0) {
    return diff;
  }
  return a.localeCompare(b);
}

/**
 * Validate an allocation meets all constraints
 *
 * @param allocation - The allocation to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateAllocation(allocation: Allocation): string[] {
  const config = CONFIG;
  const errors: string[] = [];

  // Check all quarters are present
  if (allocation.quarters.length !== config.QUARTERS) {
    errors.push(`Expected ${config.QUARTERS} quarters, got ${allocation.quarters.length}`);
  }

  // Check each quarter has correct structure
  allocation.quarters.forEach((q) => {
    const gkCount = q.slots.filter((s) => s.position === 'GK').length;
    if (gkCount !== config.POSITIONS.GK) {
      errors.push(`Quarter ${q.quarter}: Expected ${config.POSITIONS.GK} GK, got ${gkCount}`);
    }

    // Count DEF positions
    const defCount = q.slots.filter((s) => s.position === 'DEF').length;
    if (defCount !== config.POSITIONS.DEF * 2) {
      errors.push(
        `Quarter ${q.quarter}: Expected ${config.POSITIONS.DEF * 2} DEF slots, got ${defCount}`
      );
    }

    // Count ATT positions
    const attCount = q.slots.filter((s) => s.position === 'ATT').length;
    if (attCount !== config.POSITIONS.ATT * 2) {
      errors.push(
        `Quarter ${q.quarter}: Expected ${config.POSITIONS.ATT * 2} ATT slots, got ${attCount}`
      );
    }
  });

  // Check GK players have outfield time (if configured)
  if (config.RULES.GK_REQUIRES_OUTFIELD) {
    const gkPlayers = new Set<string>();
    allocation.quarters.forEach((q) => {
      q.slots.forEach((s) => {
        if (s.position === 'GK') gkPlayers.add(s.player);
      });
    });

    gkPlayers.forEach((gkPlayer) => {
      const hasOutfieldPrimaryWave = allocation.quarters.some((q) =>
        q.slots.some(
          (s) =>
            s.player === gkPlayer &&
            s.position !== 'GK' &&
            s.minutes === config.TIME_BLOCKS.OUTFIELD_FIRST
        )
      );

      if (!hasOutfieldPrimaryWave) {
        errors.push(`Player ${gkPlayer} played GK but has no 0-5 minute outfield block`);
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
  const currentMinutes = Object.values(allocation.summary);
  const currentVariance =
    currentMinutes.length > 0
      ? Math.max(...currentMinutes) - Math.min(...currentMinutes)
      : 0;
  const maxVariance = Math.max(CONFIG.RULES.MAX_MINUTE_VARIANCE, currentVariance);

  if (variance > maxVariance) {
    throw new Error(
      `Swap would create too much variance (${variance} minutes). Maximum allowed difference is ${maxVariance} minutes.`
    );
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

  // Validate variance constraint (respect current allocation variance if already higher)
  const minutes = Object.values(summary);
  const min = Math.min(...minutes);
  const max = Math.max(...minutes);
  const variance = max - min;
  const currentMinutes = Object.values(allocation.summary);
  const currentVariance =
    currentMinutes.length > 0
      ? Math.max(...currentMinutes) - Math.min(...currentMinutes)
      : 0;
  const maxVariance = Math.max(CONFIG.RULES.MAX_MINUTE_VARIANCE, currentVariance);
  if (variance > maxVariance) {
    throw new Error(
      `Swap would create too much variance (${variance} minutes). Maximum allowed difference is ${maxVariance} minutes.`
    );
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
