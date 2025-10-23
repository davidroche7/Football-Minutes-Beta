/**
 * Core configuration constants for Fair Football Minutes allocation
 */

import { DEFAULT_RULES, type RuleConfig } from './rules';

export interface ConfigValues {
  QUARTERS: number;
  QUARTER_DURATION: number;
  POSITIONS: RuleConfig['positions'];
  TIME_BLOCKS: {
    GK_FULL: number;
    OUTFIELD_FIRST: number;
    OUTFIELD_SECOND: number;
    SUB: number;
  };
  RULES: {
    MAX_MINUTE_VARIANCE: number;
    GK_REQUIRES_OUTFIELD: boolean;
    maxVariance: number;
    gkRequiresOutfield: boolean;
  };
}

export const computeConfig = (rulesConfig: RuleConfig = DEFAULT_RULES): ConfigValues => ({
  QUARTERS: rulesConfig.quarters,
  QUARTER_DURATION: rulesConfig.quarterDuration,
  POSITIONS: rulesConfig.positions,
  TIME_BLOCKS: {
    GK_FULL: rulesConfig.quarterDuration,
    OUTFIELD_FIRST: rulesConfig.waves.first,
    OUTFIELD_SECOND: rulesConfig.waves.second,
    SUB: 0,
  },
  RULES: {
    MAX_MINUTE_VARIANCE: rulesConfig.fairness.maxVariance,
    GK_REQUIRES_OUTFIELD: rulesConfig.fairness.gkRequiresOutfield,
    maxVariance: rulesConfig.fairness.maxVariance,
    gkRequiresOutfield: rulesConfig.fairness.gkRequiresOutfield,
  },
});

export const CONFIG = computeConfig();

export const getSlotsPerQuarter = (rulesConfig: RuleConfig = DEFAULT_RULES) => {
  const positions = rulesConfig.positions;
  return positions.GK + positions.DEF * 2 + positions.ATT * 2;
};

export const getPlayersPerQuarter = (rulesConfig: RuleConfig = DEFAULT_RULES) => {
  const positions = rulesConfig.positions;
  return positions.GK + positions.DEF + positions.ATT;
};
