/**
 * Core configuration constants for Fair Football Minutes allocation
 */

export const CONFIG = {
  /** Number of quarters in a match */
  QUARTERS: 4,

  /** Duration of each quarter in minutes */
  QUARTER_DURATION: 15,

  /** Number of players per position in each quarter */
  POSITIONS: {
    GK: 1,
    DEF: 2,
    ATT: 2,
  },

  /** Time block durations for different slots */
  TIME_BLOCKS: {
    /** GK plays full quarter */
    GK_FULL: 15,
    /** Outfield first wave */
    OUTFIELD_LONG: 10,
    /** Outfield second wave */
    OUTFIELD_SHORT: 5,
    /** Substitute (not playing) */
    SUB: 0,
  },

  /** Fairness and allocation rules */
  RULES: {
    /** Players who play GK must get at least one 10-min outfield block */
    GK_REQUIRES_OUTFIELD: true,
    /** Maximum acceptable minute variance between players */
    MAX_MINUTE_VARIANCE: 5,
  },
} as const;

/**
 * Get total slots per quarter
 */
export const getSlotsPerQuarter = () => {
  return (
    CONFIG.POSITIONS.GK +
    CONFIG.POSITIONS.DEF * 2 + // 2 waves of DEF
    CONFIG.POSITIONS.ATT * 2 // 2 waves of ATT
  );
};

/**
 * Get total unique players needed per quarter (excluding substitutions)
 */
export const getPlayersPerQuarter = () => {
  return CONFIG.POSITIONS.GK + CONFIG.POSITIONS.DEF + CONFIG.POSITIONS.ATT;
};
