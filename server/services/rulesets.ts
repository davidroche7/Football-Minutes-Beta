/* eslint-env node */
import { query } from '../db/client';
import type { RuleConfig } from '../../src/config/rules';

export interface RulesetDTO {
  id: string;
  teamId: string;
  name: string;
  config: RuleConfig;
  isActive: boolean;
  updatedAt: string;
  toggles: Array<{
    id: string;
    key: string;
    description: string | null;
    enabled: boolean;
  }>;
}

export async function getActiveRuleset(teamId: string): Promise<RulesetDTO | null> {
  const rulesetResult = await query<{
    id: string;
    team_id: string;
    name: string;
    config_json: unknown;
    is_active: boolean;
    updated_at: string;
  }>(
    `SELECT id, team_id, name, config_json, is_active, updated_at
     FROM ruleset
     WHERE team_id = $1
     ORDER BY is_active DESC, updated_at DESC
     LIMIT 1`,
    [teamId]
  );

  if (rulesetResult.rowCount === 0) {
    return null;
  }

  const row = rulesetResult.rows[0]!;
  let config: RuleConfig;
  try {
    config = row.config_json as RuleConfig;
  } catch {
    throw new Error('Invalid ruleset configuration stored in database.');
  }

  const toggleResult = await query<{
    id: string;
    toggle_key: string;
    description: string | null;
    enabled: boolean;
  }>(
    `SELECT id, toggle_key, description, enabled
     FROM rule_toggle
     WHERE ruleset_id = $1
     ORDER BY toggle_key ASC`,
    [row.id]
  );

  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    config,
    isActive: row.is_active,
    updatedAt: row.updated_at,
    toggles: toggleResult.rows.map((toggle) => ({
      id: toggle.id,
      key: toggle.toggle_key,
      description: toggle.description,
      enabled: toggle.enabled,
    })),
  };
}
