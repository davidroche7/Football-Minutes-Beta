const STORAGE_KEY = 'ffm:rules';

export function loadRulesOverride(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function saveRulesOverride(configJson: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, configJson);
}

export function clearRulesOverride() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
