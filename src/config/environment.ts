// Runtime config loaded from /config.js (injected by server)
declare global {
  interface Window {
    APP_CONFIG?: {
      USE_API: boolean;
      USE_API_PERSISTENCE: boolean;
      API_BASE_URL: string;
      TEAM_ID: string;
      ACTOR_ROLES: string[];
      SESSION_SECRET: string;
    };
  }
}

const toBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
};

const toStringOrNull = (value: string | undefined): string | null => {
  if (value === undefined || value === '') return null;
  return value;
};

// Use runtime config if available, otherwise fall back to build-time env vars
const runtimeConfig = typeof window !== 'undefined' ? window.APP_CONFIG : undefined;

export const USE_API_PERSISTENCE = runtimeConfig?.USE_API ?? toBoolean(import.meta.env.VITE_USE_API ?? undefined, false);
export const API_BASE_URL = runtimeConfig?.API_BASE_URL ?? import.meta.env.VITE_API_BASE_URL ?? '/api';
export const TEAM_ID = runtimeConfig?.TEAM_ID ?? toStringOrNull(import.meta.env.VITE_TEAM_ID ?? undefined);
const SESSION_SECRET_RAW = runtimeConfig?.SESSION_SECRET ?? toStringOrNull(import.meta.env.VITE_SESSION_SECRET ?? undefined);
export const SESSION_SECRET = SESSION_SECRET_RAW ?? 'dev-session-secret';

export const DEFAULT_ACTOR_ROLES = runtimeConfig?.ACTOR_ROLES ??
  import.meta.env.VITE_ACTOR_ROLES?.split(',').map((role) => role.trim()).filter(Boolean) ?? ['coach'];

if (USE_API_PERSISTENCE && !TEAM_ID) {
  throw new Error('USE_API is true but TEAM_ID is not configured.');
}

if (USE_API_PERSISTENCE && !SESSION_SECRET_RAW) {
  throw new Error('USE_API is true but SESSION_SECRET is not configured.');
}
