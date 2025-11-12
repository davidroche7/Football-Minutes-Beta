/* eslint-env node */
import type { VercelRequest } from '@vercel/node';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { UserRole } from '../../server/db/types';
import { resolveContext } from './context';
import { ApiError } from './errors';

const SESSION_HEADER = 'x-ffm-session';
const CSRF_HEADER = 'x-ffm-csrf';
const CSRF_COOKIE = 'ffm_csrf';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

function getSessionSecret(): string {
  const sessionSecret = process.env.FFM_SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error('FFM_SESSION_SECRET environment variable must be set for API authentication.');
  }
  return sessionSecret;
}

const sessionSecret = getSessionSecret();

interface ParsedSession {
  actorId: string;
  issuedAt: string;
}

interface SecurityOptions {
  requireAuthentication?: boolean;
  requireCsrf?: boolean;
  allowedRoles?: UserRole[];
}

export interface SecurityContext {
  actorId: string | null;
  roles: UserRole[];
  teamIdHeader?: string;
  issuedAt?: string;
}

export function enforceSecurity(req: VercelRequest, options: SecurityOptions = {}): SecurityContext {
  const context = resolveContext(req);
  const requireAuth = options.requireAuthentication ?? true;
  let session: ParsedSession | null = null;

  if (requireAuth) {
    session = verifySession(req);
    if (context.actorId && session.actorId !== context.actorId) {
      throw new ApiError(403, 'SESSION_ACTOR_MISMATCH', 'Session actor does not match request actor header.');
    }
    context.actorId = session.actorId;
  }

  if (options.allowedRoles && options.allowedRoles.length > 0) {
    if (!context.roles.some((role) => options.allowedRoles!.includes(role))) {
      throw new ApiError(403, 'ROLE_FORBIDDEN', 'Insufficient permissions for this operation.');
    }
  }

  if (options.requireCsrf) {
    validateCsrf(req);
  }

  return {
    actorId: context.actorId ?? null,
    roles: context.roles,
    teamIdHeader: context.teamIdHeader,
    issuedAt: session?.issuedAt,
  };
}

export function issueCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

function verifySession(req: VercelRequest): ParsedSession {
  const headerValue = req.headers[SESSION_HEADER];
  if (typeof headerValue !== 'string' || headerValue.trim() === '') {
    throw new ApiError(401, 'SESSION_REQUIRED', 'Session token missing.');
  }

  let decoded: string;
  try {
    decoded = Buffer.from(headerValue, 'base64').toString('utf8');
  } catch {
    throw new ApiError(401, 'SESSION_INVALID', 'Invalid session token.');
  }

  const parts = decoded.split('|');
  if (parts.length !== 3) {
    throw new ApiError(401, 'SESSION_INVALID', 'Invalid session token structure.');
  }

  const [actorId, issuedAt, signature] = parts;
  if (!actorId || !issuedAt || !signature) {
    throw new ApiError(401, 'SESSION_INVALID', 'Incomplete session token.');
  }

  const expectedSignature = createHmac('sha256', sessionSecret).update(`${actorId}|${issuedAt}`).digest('hex');
  if (!secureCompare(signature, expectedSignature)) {
    throw new ApiError(401, 'SESSION_INVALID', 'Session signature mismatch.');
  }

  const issuedTime = Date.parse(issuedAt);
  if (Number.isNaN(issuedTime)) {
    throw new ApiError(401, 'SESSION_INVALID', 'Invalid session timestamp.');
  }

  const ageSeconds = (Date.now() - issuedTime) / 1000;
  if (ageSeconds > SESSION_MAX_AGE_SECONDS) {
    throw new ApiError(401, 'SESSION_EXPIRED', 'Session has expired.');
  }

  return { actorId, issuedAt };
}

function validateCsrf(req: VercelRequest) {
  const headerToken = req.headers[CSRF_HEADER];
  if (typeof headerToken !== 'string' || headerToken.trim() === '') {
    throw new ApiError(403, 'CSRF_TOKEN_MISSING', 'CSRF header missing.');
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[CSRF_COOKIE];
  if (!cookieToken) {
    throw new ApiError(403, 'CSRF_COOKIE_MISSING', 'CSRF cookie missing.');
  }

  if (!secureCompare(headerToken, cookieToken)) {
    throw new ApiError(403, 'CSRF_TOKEN_MISMATCH', 'CSRF token mismatch.');
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  const parts = cookieHeader.split(';');
  parts.forEach((part) => {
    const [rawKey, rawValue] = part.split('=');
    if (!rawKey) return;
    const key = rawKey.trim();
    if (!key) return;
    const value = rawValue ? rawValue.trim() : '';
    result[key] = decodeURIComponent(value);
  });
  return result;
}

function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return timingSafeEqual(aBuffer, bBuffer);
}
