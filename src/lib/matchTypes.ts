import type { Allocation } from './types';
import type { Squad } from './squads';

export interface MatchResult {
  venue?: string;
  result?: string;
  goalsFor?: number | null;
  goalsAgainst?: number | null;
  playerOfMatch?: string;
  honorableMentions?: string[];
  scorers?: string[];
}

export interface SaveMatchPayload {
  date: string;
  time?: string; // HH:mm format, e.g., "14:30"
  opponent: string;
  players: string[];
  allocation: Allocation;
  result?: MatchResult | null;
  createdBy?: string;
  /** Reds or Blacks; null/absent for matches played before the squad split. */
  squad?: Squad | null;
}

export type MatchEditField =
  | 'opponent'
  | 'date'
  | 'time'
  | 'squad'
  | 'result.venue'
  | 'result.result'
  | 'result.goalsFor'
  | 'result.goalsAgainst'
  | 'result.playerOfMatch'
  | 'result.honorableMentions'
  | 'result.scorers'
  | 'allocation';

export interface MatchEditEvent {
  id: string;
  field: MatchEditField;
  previousValue: string;
  newValue: string;
  editedAt: string;
  editedBy: string;
}

export interface MatchRecord extends SaveMatchPayload {
  id: string;
  createdAt: string;
  lastModifiedAt: string;
  editHistory?: MatchEditEvent[]; // Optional - lazy loaded from audit API or stored in localStorage
  metadata?: {
    playerIdLookup?: Record<string, string>;
    venueType?: string | null;
    seasonId?: string | null;
    status?: string;
  };
}

export interface MatchUpdatePayload {
  opponent?: string;
  date?: string;
  time?: string;
  result?: MatchResult | null;
  allocation?: Allocation;
  players?: string[];
  squad?: Squad | null;
  editor: string;
}
