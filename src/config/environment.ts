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

// Lazy getter for runtime config - reads window.APP_CONFIG at access time, not module load time
const getRuntimeConfig = () => (typeof window !== 'undefined' ? window.APP_CONFIG : undefined);

// Export lazy getters so values are read when accessed, not when module loads
// This ensures window.APP_CONFIG has loaded from /config.js before being read
export const USE_API_PERSISTENCE = (() => {
  const config = getRuntimeConfig();
  return config?.USE_API ?? toBoolean(import.meta.env.VITE_USE_API ?? undefined, false);
})();

export const API_BASE_URL = (() => {
  const config = getRuntimeConfig();
  return config?.API_BASE_URL ?? import.meta.env.VITE_API_BASE_URL ?? '/api';
})();

export const TEAM_ID = (() => {
  const config = getRuntimeConfig();
  return config?.TEAM_ID ?? toStringOrNull(import.meta.env.VITE_TEAM_ID ?? undefined);
})();

const SESSION_SECRET_RAW = (() => {
  const config = getRuntimeConfig();
  return config?.SESSION_SECRET ?? toStringOrNull(import.meta.env.VITE_SESSION_SECRET ?? undefined);
})();

export const SESSION_SECRET = SESSION_SECRET_RAW ?? 'dev-session-secret';

export const DEFAULT_ACTOR_ROLES = (() => {
  const config = getRuntimeConfig();
  return config?.ACTOR_ROLES ??
    import.meta.env.VITE_ACTOR_ROLES?.split(',').map((role) => role.trim()).filter(Boolean) ?? ['coach'];
})();

if (USE_API_PERSISTENCE && !TEAM_ID) {
  throw new Error('USE_API is true but TEAM_ID is not configured.');
}

if (USE_API_PERSISTENCE && !SESSION_SECRET_RAW) {
  throw new Error('USE_API is true but SESSION_SECRET is not configured.');
}
