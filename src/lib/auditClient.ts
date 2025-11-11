import { API_BASE_URL, TEAM_ID } from '../config/environment';
import { apiRequest } from './apiClient';

export interface AuditEvent {
  id: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  eventType: string;
  previousState: unknown;
  nextState: unknown;
  metadata: unknown;
  createdAt: string;
}

interface AuditQuery {
  entityType?: string;
  entityId?: string;
  limit?: number;
  teamId?: string;
}

export async function fetchAuditEvents(query: AuditQuery = {}): Promise<AuditEvent[]> {
  const params: Record<string, string> = {};
  const teamId = query.teamId ?? TEAM_ID;
  if (teamId) params.teamId = teamId;
  if (query.entityType) params.entityType = query.entityType;
  if (query.entityId) params.entityId = query.entityId;
  if (typeof query.limit === 'number') params.limit = String(query.limit);

  const response = await apiRequest<{ data: AuditEvent[] }>(`${API_BASE_URL}/audit`, {
    query: params,
  });
  return Array.isArray(response?.data) ? response.data : [];
}

/**
 * Fetch audit events for a specific fixture (match)
 * @param fixtureId - ID of the fixture
 * @param limit - Maximum number of events to return (default: 50)
 */
export async function fetchFixtureAuditEvents(
  fixtureId: string,
  limit: number = 50
): Promise<AuditEvent[]> {
  return fetchAuditEvents({
    entityType: 'FIXTURE',
    entityId: fixtureId,
    limit,
  });
}

/**
 * Fetch audit events for a specific player
 * @param playerId - ID of the player
 * @param limit - Maximum number of events to return (default: 50)
 */
export async function fetchPlayerAuditEvents(
  playerId: string,
  limit: number = 50
): Promise<AuditEvent[]> {
  return fetchAuditEvents({
    entityType: 'PLAYER',
    entityId: playerId,
    limit,
  });
}

/**
 * Fetch all audit events for the configured team
 * @param limit - Maximum number of events to return (default: 100)
 */
export async function fetchTeamAuditEvents(limit: number = 100): Promise<AuditEvent[]> {
  return fetchAuditEvents({ limit });
}

/**
 * Format an audit event into a human-readable summary
 */
export function formatAuditEventSummary(event: AuditEvent): string {
  const timestamp = new Date(event.createdAt).toLocaleString();
  const actor = event.actorId || 'System';
  const entityType = event.entityType.toLowerCase();
  const action = event.eventType.toLowerCase().replace(/_/g, ' ');

  return `[${timestamp}] ${actor} ${action} ${entityType}`;
}

/**
 * Format audit event changes as a diff
 * @param event - The audit event
 * @returns Array of change descriptions
 */
export function formatAuditEventChanges(event: AuditEvent): string[] {
  const changes: string[] = [];

  if (typeof event.previousState === 'object' && typeof event.nextState === 'object') {
    const prev = event.previousState as Record<string, unknown>;
    const next = event.nextState as Record<string, unknown>;

    const allKeys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);

    allKeys.forEach((key) => {
      const oldValue = prev?.[key];
      const newValue = next?.[key];

      if (oldValue !== newValue) {
        const oldStr = oldValue === undefined ? '(none)' : JSON.stringify(oldValue);
        const newStr = newValue === undefined ? '(deleted)' : JSON.stringify(newValue);
        changes.push(`${key}: ${oldStr} → ${newStr}`);
      }
    });
  }

  return changes;
}
