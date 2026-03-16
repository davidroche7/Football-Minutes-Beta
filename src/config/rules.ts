export interface RuleConfig {
  quarters: number;
  quarterDuration: number;
  waves: {
    first: number;
    second: number;
  };
  positions: {
    GK: number;
    DEF: number;
    MID: number;
    FWD: number;
  };
  fairness: {
    maxVariance: number;
    gkRequiresOutfield: boolean;
  };
}

export const DEFAULT_RULES: RuleConfig = {
  quarters: 4,
  quarterDuration: 10,
  waves: {
    first: 5,
    second: 5,
  },
  positions: {
    GK: 1,
    DEF: 1,
    MID: 1,
    FWD: 2,
  },
  fairness: {
    maxVariance: 5,
    gkRequiresOutfield: true,
  },
};
