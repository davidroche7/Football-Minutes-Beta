/**
 * Type definitions for Fair Football Minutes
 */

/** Position on the field */
export type Position = 'GK' | 'DEF' | 'ATT';

/** Time block a player can be assigned (in minutes) */
export type TimeBlock = number;

/** Quarter number (1-4) */
export type Quarter = 1 | 2 | 3 | 4;

/** Wave within a quarter (for outfield players) */
export type Wave = 'first' | 'second';

/**
 * Represents a single player slot in a quarter
 */
export interface PlayerSlot {
  /** Player name */
  player: string;
  /** Position being played */
  position: Position;
  /** Minutes playing in this slot */
  minutes: TimeBlock;
  /** For outfield positions: which wave (first 10min or last 5min) */
  wave?: Wave;
}

/**
 * All player assignments for a single quarter
 */
export interface QuarterAllocation {
  /** Quarter number */
  quarter: Quarter;
  /** All slots for this quarter */
  slots: PlayerSlot[];
}

/**
 * Complete allocation for all quarters
 */
export interface Allocation {
  /** Allocations for all 4 quarters */
  quarters: QuarterAllocation[];
  /** Summary: player name -> total minutes */
  summary: Record<string, number>;
  /** Optional warnings generated during allocation */
  warnings?: string[];
}

/**
 * Configuration for allocation algorithm
 */
export interface AllocationConfig {
  /** Number of quarters */
  quarters: number;
  /** Minutes per quarter */
  quarterDuration: number;
  /** Whether GK players must get outfield time */
  gkRequiresOutfield: boolean;
  /** Max variance allowed */
  maxVariance: number;
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Result of validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
