/**
 * The app is dark-mode only — no light/dark toggle.
 */

/**
 * Apply dark mode to the document. Call before first render to avoid a flash.
 */
export function initTheme(): void {
  if (typeof window === 'undefined') return;
  document.documentElement.classList.add('dark');
}
