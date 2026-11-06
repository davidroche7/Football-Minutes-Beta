/**
 * Reds / Blacks squads. A match belongs to one squad; a player can be tagged
 * Reds, Blacks or Both. Untagged (null) players count as Both so nobody drops
 * out of the picker before they've been tagged. Matches with no squad were
 * played before the split and keep their original display.
 */
export type Squad = 'REDS' | 'BLACKS';
export type PlayerSquad = Squad | 'BOTH';

export const SQUADS: readonly Squad[] = ['REDS', 'BLACKS'];

export const SQUAD_LABEL: Record<PlayerSquad, string> = {
  REDS: 'Reds',
  BLACKS: 'Blacks',
  BOTH: 'Both',
};

export const isSquad = (value: unknown): value is Squad => value === 'REDS' || value === 'BLACKS';

export const isPlayerSquad = (value: unknown): value is PlayerSquad => isSquad(value) || value === 'BOTH';

export const isEligible = (playerSquad: PlayerSquad | null | undefined, squad: Squad): boolean =>
  !playerSquad || playerSquad === 'BOTH' || playerSquad === squad;

export const matchLabel = (opponent: string, squad?: Squad | null): string =>
  squad ? `${SQUAD_LABEL[squad]} vs ${opponent}` : `vs ${opponent}`;

/**
 * Home team's goals first. Only applied to squad matches: older matches were
 * often saved with a blank venue that silently became HOME, so their venue
 * can't be trusted and they keep "our goals first".
 */
export const formatScore = (
  goalsFor: number | null | undefined,
  goalsAgainst: number | null | undefined,
  venue: string | null | undefined,
  squad: Squad | null | undefined
): string => {
  const ours = goalsFor ?? '—';
  const theirs = goalsAgainst ?? '—';
  const away = Boolean(squad) && venue?.toUpperCase() === 'AWAY';
  return away ? `${theirs} - ${ours}` : `${ours} - ${theirs}`;
};

interface ClashCandidate {
  date: string;
  opponent: string;
  players: string[];
  squad?: Squad | null;
}

/** Players already picked for the other squad's match on the same date → that match's label. */
export const findSquadClashes = (
  matches: ClashCandidate[],
  date: string,
  squad: Squad,
  players: string[]
): Record<string, string> => {
  const clashes: Record<string, string> = {};
  const wanted = new Set(players);
  matches
    .filter((m) => m.date === date && m.squad && m.squad !== squad)
    .forEach((m) => {
      m.players.forEach((player) => {
        if (wanted.has(player) && !clashes[player]) clashes[player] = matchLabel(m.opponent, m.squad);
      });
    });
  return clashes;
};

export const filterBySquad = <T extends { squad?: Squad | null }>(matches: T[], squad: Squad | ''): T[] =>
  squad ? matches.filter((m) => m.squad === squad) : matches;
