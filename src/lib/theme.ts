/**
 * Theme management utility
 * Supports: light, dark, and system (follows OS preference)
 */

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'ffm_theme';

/**
 * Get the current theme preference from localStorage
 */
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }

  return 'system';
}

/**
 * Save theme preference to localStorage
 */
export function saveTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, theme);
}

/**
 * Get the effective theme (resolves 'system' to 'light' or 'dark')
 */
export function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;

  if (typeof window === 'undefined') return 'light';

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Apply theme to the document
 */
export function applyTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;

  const effectiveTheme = getEffectiveTheme(theme);

  if (effectiveTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

/**
 * Initialize theme on app load
 */
export function initTheme(): Theme {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}

/**
 * Set theme and persist to localStorage
 */
export function setTheme(theme: Theme): void {
  saveTheme(theme);
  applyTheme(theme);
}
