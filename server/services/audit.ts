/* eslint-env node */
import { query } from '../db/client';

export interface AuditEventDTO {
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

export interface AuditQueryOptions {
  entityType?: string;
  entityId?: string;
  limit?: number;
  teamId?: string;
}

export async function listAuditEvents(options: AuditQueryOptions = {}): Promise<AuditEventDTO[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.entityType) {
    params.push(options.entityType.toUpperCase());
    conditions.push(`ae.entity_type = $${params.length}`);
  }

  if (options.entityId) {
    params.push(options.entityId);
    conditions.push(`ae.entity_id = $${params.length}`);
  }

  if (options.teamId) {
    params.push(options.teamId);
    conditions.push(`COALESCE(
        p.team_id::text,
        f.team_id::text,
        fl.team_id::text,
        r.team_id::text,
        NULLIF(ae.next_state->>'team_id', ''),
        NULLIF(ae.previous_state->>'team_id', ''),
        NULLIF(ae.metadata->>'teamId', '')
      ) = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = typeof options.limit === 'number' ? `LIMIT ${Math.max(options.limit, 1)}` : '';

  const result = await query<{
    id: string;
    actor_id: string | null;
    entity_type: string;
    entity_id: string;
    event_type: string;
    previous_state: unknown;
    next_state: unknown;
    metadata: unknown;
    created_at: string;
  }>(
    `SELECT ae.id,
            ae.actor_id,
            ae.entity_type,
            ae.entity_id,
            ae.event_type,
            ae.previous_state,
            ae.next_state,
            ae.metadata,
            ae.created_at
     FROM audit_event ae
     LEFT JOIN player p ON ae.entity_type = 'PLAYER' AND ae.entity_id = p.id
     LEFT JOIN fixture f ON ae.entity_type = 'FIXTURE' AND ae.entity_id = f.id
     LEFT JOIN lineup_quarter lq ON ae.entity_type = 'LINEUP' AND ae.entity_id = lq.id
     LEFT JOIN fixture fl ON lq.fixture_id = fl.id
     LEFT JOIN ruleset r ON ae.entity_type = 'RULESET' AND ae.entity_id = r.id
     ${whereClause}
     ORDER BY ae.created_at DESC
     ${limitClause}`,
    params
  );

  return result.rows.map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    eventType: row.event_type,
    previousState: row.previous_state,
    nextState: row.next_state,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}
