/* eslint-env node */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { issueCsrfToken, enforceSecurity } from '../_lib/security';
import { ApiError, handleError } from '../_lib/errors';
import { ok } from '../_lib/responses';

export async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Unsupported method: ${req.method}`);
    }

    // Ensure the caller has a valid session before issuing a CSRF token.
    enforceSecurity(req, { requireAuthentication: true, requireCsrf: false });

    const token = issueCsrfToken();
    const cookie = serializeCookie('ffm_csrf', token, {
      httpOnly: false,
      sameSite: 'Strict',
      secure: process.env.NODE_ENV !== 'development',
      path: '/',
      maxAge: 60 * 60 * 12,
    });

    res.setHeader('Set-Cookie', cookie);
    ok(res, { data: { token } });
  } catch (error) {
    handleError(res, error);
  }
}

interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  path?: string;
  maxAge?: number;
}

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge) {
    segments.push(`Max-Age=${Math.floor(options.maxAge)}`);
  }
  segments.push(`Path=${options.path ?? '/'}`);
  if (options.httpOnly) {
    segments.push('HttpOnly');
  }
  if (options.secure) {
    segments.push('Secure');
  }
  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }
  return segments.join('; ');
}
