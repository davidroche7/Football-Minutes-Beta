/**
 * Theme management utility
 * Supports: light and dark
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ffm_theme';

/**
 * Get the current theme preference from localStorage.
 * Defaults to dark — light is available via the toggle, not the default.
 */
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  return 'dark';
}

/**
 * Save theme preference to localStorage
 */
export function saveTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, theme);
}

/**
 * Apply theme to the document
 */
export function applyTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;

  if (theme === 'dark') {
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
