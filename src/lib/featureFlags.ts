/**
 * Feature flag utility for enabling/disabling features during development and rollout
 *
 * Flags can be controlled via:
 * 1. Environment variables (VITE_FEATURE_*)
 * 2. localStorage overrides (for local development/testing)
 * 3. Default values (hardcoded in this file)
 *
 * Priority: localStorage > env vars > defaults
 */

export interface FeatureFlags {
  /**
   * Enable centralized audit log instead of inline per-game change logs
   * Default: true (new behavior)
   */
  auditLogCentralized: boolean;

  /**
   * Enable refactored player selection flow with improved GK selector
   * Default: true (new behavior)
   */
  playerSelectionRefactor: boolean;

  /**
   * Enable API persistence for match data (vs local storage only)
   * Default: based on VITE_USE_API_PERSISTENCE env var
   */
  apiPersistence: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  auditLogCentralized: true,
  playerSelectionRefactor: true,
  apiPersistence: import.meta.env.VITE_USE_API_PERSISTENCE === 'true',
};

/**
 * Get value of a feature flag
 * Checks localStorage override first, then env var, then default
 */
function getFlagValue(flagName: keyof FeatureFlags): boolean {
  // Check localStorage override (for local dev/testing)
  const localStorageKey = `ffm:feature:${flagName}`;
  const localValue = localStorage.getItem(localStorageKey);
  if (localValue !== null) {
    return localValue === 'true';
  }

  // Check environment variable
  const envKey = `VITE_FEATURE_${flagName.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
  const envValue = import.meta.env[envKey];
  if (envValue !== undefined) {
    return envValue === 'true';
  }

  // Return default
  return DEFAULT_FLAGS[flagName];
}

/**
 * Get all feature flags
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    auditLogCentralized: getFlagValue('auditLogCentralized'),
    playerSelectionRefactor: getFlagValue('playerSelectionRefactor'),
    apiPersistence: getFlagValue('apiPersistence'),
  };
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(flagName: keyof FeatureFlags): boolean {
  return getFlagValue(flagName);
}

/**
 * Set a feature flag override in localStorage (for testing)
 * Pass null to remove the override
 */
export function setFeatureFlagOverride(
  flagName: keyof FeatureFlags,
  value: boolean | null
): void {
  const localStorageKey = `ffm:feature:${flagName}`;
  if (value === null) {
    localStorage.removeItem(localStorageKey);
  } else {
    localStorage.setItem(localStorageKey, String(value));
  }
}

/**
 * Clear all feature flag overrides
 */
export function clearAllFeatureFlagOverrides(): void {
  const keys = Object.keys(DEFAULT_FLAGS) as Array<keyof FeatureFlags>;
  keys.forEach((key) => {
    const localStorageKey = `ffm:feature:${key}`;
    localStorage.removeItem(localStorageKey);
  });
}

/**
 * Get a summary of all flags and their sources
 * Useful for debugging
 */
export function getFeatureFlagDebugInfo(): Record<
  keyof FeatureFlags,
  { value: boolean; source: 'localStorage' | 'env' | 'default' }
> {
  const keys = Object.keys(DEFAULT_FLAGS) as Array<keyof FeatureFlags>;
  const result = {} as Record<
    keyof FeatureFlags,
    { value: boolean; source: 'localStorage' | 'env' | 'default' }
  >;

  keys.forEach((flagName) => {
    const localStorageKey = `ffm:feature:${flagName}`;
    const localValue = localStorage.getItem(localStorageKey);

    if (localValue !== null) {
      result[flagName] = { value: localValue === 'true', source: 'localStorage' };
      return;
    }

    const envKey = `VITE_FEATURE_${flagName.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
    const envValue = import.meta.env[envKey];

    if (envValue !== undefined) {
      result[flagName] = { value: envValue === 'true', source: 'env' };
      return;
    }

    result[flagName] = { value: DEFAULT_FLAGS[flagName], source: 'default' };
  });

  return result;
}
