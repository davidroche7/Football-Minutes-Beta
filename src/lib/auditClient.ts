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
