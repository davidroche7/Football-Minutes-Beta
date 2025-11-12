/* eslint-env node */
import type { VercelRequest } from '@vercel/node';
import type { UserRole } from '../server/db/types';

export interface RequestContext {
  actorId: string | null;
  roles: UserRole[];
  teamIdHeader?: string;
}

export function resolveContext(req: VercelRequest): RequestContext {
  const actor = typeof req.headers['x-ffm-actor'] === 'string' ? req.headers['x-ffm-actor'] : null;
  const rolesHeader = req.headers['x-ffm-roles'];
  const roles =
    typeof rolesHeader === 'string'
      ? (rolesHeader.split(',').map((role) => role.trim()) as UserRole[])
      : [];
  const team = typeof req.headers['x-ffm-team'] === 'string' ? req.headers['x-ffm-team'] : undefined;

  return {
    actorId: actor,
    roles,
    teamIdHeader: team,
  };
}
