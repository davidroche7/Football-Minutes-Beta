import { TEAM_ID } from '../config/environment';
import { apiRequest } from './apiClient';
import type { RuleConfig } from '../config/rules';

export interface RulesetResponse {
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

export async function fetchActiveRuleset(teamIdOverride?: string): Promise<RulesetResponse | null> {
  const teamId = teamIdOverride ?? TEAM_ID;
  if (!teamId) {
    throw new Error('TEAM_ID environment variable is required to fetch ruleset.');
  }

  const response = await apiRequest<{ data: RulesetResponse | null }>('/rulesets/active', {
    query: { teamId },
  });
  return response?.data ?? null;
}
