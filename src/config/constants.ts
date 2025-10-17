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
  RULES: RuleConfig['fairness'];
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
  RULES: rulesConfig.fairness,
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
