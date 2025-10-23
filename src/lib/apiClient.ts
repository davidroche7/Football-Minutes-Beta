import { API_BASE_URL, DEFAULT_ACTOR_ROLES, TEAM_ID, USE_API_PERSISTENCE } from '../config/environment';
import { loadStoredSession } from './auth';

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  actorId?: string | null;
  roles?: string[];
  teamId?: string | null;
  signal?: AbortSignal;
}

const buildUrl = (path: string, query?: ApiRequestOptions['query']) => {
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${trimmedPath}`, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
};

const parseJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_COOKIE_NAME = 'ffm_csrf';
let pendingCsrfPromise: Promise<string | null> | null = null;

const isBrowser = typeof window !== 'undefined';

const readCookie = (name: string): string | null => {
  if (!isBrowser) return null;
  const cookies = document.cookie ? document.cookie.split(';') : [];
  for (const cookie of cookies) {
    const [rawKey, rawValue] = cookie.split('=');
    if (!rawKey) continue;
    if (rawKey.trim() === name) {
      return decodeURIComponent(rawValue ?? '');
    }
  }
  return null;
};

const fetchCsrfToken = async (headers: Record<string, string>): Promise<string | null> => {
  const csrfHeaders: Record<string, string> = {};
  Object.entries(headers).forEach(([key, value]) => {
    if (key.toLowerCase() === 'content-type') return;
    csrfHeaders[key] = value;
  });

  const response = await fetch(buildUrl('/session/csrf'), {
    method: 'GET',
    headers: csrfHeaders,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to obtain CSRF token.');
  }

  await response.json().catch(() => undefined);
  return readCookie(CSRF_COOKIE_NAME);
};

const ensureCsrfToken = async (headers: Record<string, string>): Promise<string | null> => {
  if (!isBrowser) return null;
  const existing = readCookie(CSRF_COOKIE_NAME);
  if (existing) {
    return existing;
  }
  if (!pendingCsrfPromise) {
    pendingCsrfPromise = fetchCsrfToken(headers)
      .then((token) => token ?? readCookie(CSRF_COOKIE_NAME))
      .finally(() => {
        pendingCsrfPromise = null;
      });
  }
  try {
    return await pendingCsrfPromise;
  } catch (error) {
    if (USE_API_PERSISTENCE && console) {
      console.warn('Unable to obtain CSRF token. Falling back to local mode until resolved.', error);
    }
    return null;
  }
};

export async function apiRequest<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, actorId, roles, teamId, signal } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const actorRoles = roles && roles.length > 0 ? roles : DEFAULT_ACTOR_ROLES;
  if (actorRoles.length > 0) {
    headers['x-ffm-roles'] = actorRoles.join(',');
  }

  const session = loadStoredSession();
  const resolvedActor = actorId ?? session?.username ?? null;
  if (resolvedActor) {
    headers['x-ffm-actor'] = resolvedActor;
  }

  const resolvedTeam = teamId ?? TEAM_ID;
  if (resolvedTeam) {
    headers['x-ffm-team'] = resolvedTeam;
  }

  if (session?.token) {
    headers['x-ffm-session'] = session.token;
  }

  const url = buildUrl(path, query);

  if (MUTATION_METHODS.has(method) && isBrowser) {
    const csrfToken = await ensureCsrfToken(headers);
    if (!csrfToken) {
      throw new Error('Unable to establish CSRF protection for request.');
    }
    headers['x-ffm-csrf'] = csrfToken;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
    signal,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await parseJson(response);

  if (!response.ok) {
    const errorMessage =
      data && typeof data === 'object' && 'error' in data && data.error && typeof (data as any).error.message === 'string'
        ? (data as any).error.message
        : `Request failed with status ${response.status}`;
    const error = new Error(errorMessage);
    (error as Error & { status?: number; payload?: unknown }).status = response.status;
    (error as Error & { status?: number; payload?: unknown }).payload = data;
    throw error;
  }

  return data as T;
}
