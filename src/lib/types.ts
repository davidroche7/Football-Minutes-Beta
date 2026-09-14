/**
 * Type definitions for football lineup allocation
 */

/** Position on the field (ATT is legacy — kept for stored data compatibility) */
export type Position = 'GK' | 'DEF' | 'MID' | 'FWD' | 'ATT';

/** Display name for a position — maps legacy ATT to FWD */
export const POSITION_DISPLAY: Record<Position, string> = {
  GK: 'GK',
  DEF: 'DEF',
  MID: 'MID',
  FWD: 'FWD',
  ATT: 'FWD',
};

/** Slot colour class for a position (primary/secondary variant for wave shading) */
export const POSITION_COLOUR: Record<Position, { primary: string; secondary: string }> = {
  GK: { primary: 'bg-amber-100 dark:bg-amber-900', secondary: 'bg-amber-50 dark:bg-amber-950' },
  DEF: { primary: 'bg-sky-100 dark:bg-sky-900', secondary: 'bg-sky-50 dark:bg-sky-950' },
  MID: { primary: 'bg-emerald-100 dark:bg-emerald-900', secondary: 'bg-emerald-50 dark:bg-emerald-950' },
  FWD: { primary: 'bg-violet-100 dark:bg-violet-900', secondary: 'bg-violet-50 dark:bg-violet-950' },
  ATT: { primary: 'bg-violet-100 dark:bg-violet-900', secondary: 'bg-violet-50 dark:bg-violet-950' },
};

/** Time block a player can be assigned (in minutes) */
export type TimeBlock = number;

/** Quarter number (1-4) */
export type Quarter = 1 | 2 | 3 | 4;

/** Wave within a quarter (for outfield players) */
export type Wave = 'first' | 'second';

/** Quarter substitution mode — full team stays on, or split into two waves */
export type QuarterMode = 'full' | 'split';

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
  /** Per-quarter sub points [Q1, Q2, Q3, Q4] — minute within quarter when subs happen */
  subPoints?: number[];
  /** Per-quarter mode [Q1, Q2, Q3, Q4] — 'full' = same team all quarter, 'split' = two waves */
  quarterModes?: QuarterMode[];
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
