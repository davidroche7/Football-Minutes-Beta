import { DEFAULT_RULES, type RuleConfig } from '../config/rules';
import { clearRulesOverride, loadRulesOverride, saveRulesOverride } from './rulesStore';

export function getRules(): RuleConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_RULES;
  }

  const override = loadRulesOverride();
  if (!override) {
    return DEFAULT_RULES;
  }

  try {
    const parsed = JSON.parse(override) as Partial<RuleConfig>;
    return {
      quarters: parsed.quarters ?? DEFAULT_RULES.quarters,
      quarterDuration: parsed.quarterDuration ?? DEFAULT_RULES.quarterDuration,
      waves: {
        first: parsed.waves?.first ?? DEFAULT_RULES.waves.first,
        second: parsed.waves?.second ?? DEFAULT_RULES.waves.second,
      },
      positions: {
        GK: parsed.positions?.GK ?? DEFAULT_RULES.positions.GK,
        DEF: parsed.positions?.DEF ?? DEFAULT_RULES.positions.DEF,
        ATT: parsed.positions?.ATT ?? DEFAULT_RULES.positions.ATT,
      },
      fairness: {
        maxVariance: parsed.fairness?.maxVariance ?? DEFAULT_RULES.fairness.maxVariance,
        gkRequiresOutfield:
          parsed.fairness?.gkRequiresOutfield ?? DEFAULT_RULES.fairness.gkRequiresOutfield,
      },
    };
  } catch {
    return DEFAULT_RULES;
  }
}

export function persistRules(config: RuleConfig) {
  const serialised = JSON.stringify(config);
  saveRulesOverride(serialised);
}

export function resetRules() {
  clearRulesOverride();
}
