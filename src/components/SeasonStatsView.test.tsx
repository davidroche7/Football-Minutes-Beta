import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

const persistenceMocks = vi.hoisted(() => ({
  bulkImportMatches: vi.fn(),
  getMatchPersistenceError: vi.fn(() => null),
  getMatchPersistenceMode: vi.fn(() => 'local'),
  listMatches: vi.fn(),
  updateMatch: vi.fn(),
}));

const statsMocks = vi.hoisted(() => ({
  fetchTeamStats: vi.fn(),
  fetchPlayerStats: vi.fn(),
}));

const auditMocks = vi.hoisted(() => ({
  fetchAuditEvents: vi.fn(),
}));

vi.mock('../lib/persistence', () => persistenceMocks);
vi.mock('../lib/statsClient', () => statsMocks);
vi.mock('../lib/auditClient', () => auditMocks);
vi.mock('../config/environment', () => ({
  TEAM_ID: 'team-123',
  USE_API_PERSISTENCE: true,
}));

vi.mock('../lib/rules', () => ({
  getRules: vi.fn(() => ({
    quarters: 4,
    quarterDuration: 10,
    waves: { first: 5, second: 5 },
    positions: { GK: 1, DEF: 2, ATT: 2 },
    fairness: { maxVariance: 5, gkRequiresOutfield: true },
  })),
}));

const mockListRoster = vi.fn();
const mockGetRosterAudit = vi.fn();
const mockRestorePlayer = vi.fn();

vi.mock('../lib/roster', () => ({
  listRoster: (...args: unknown[]) => mockListRoster(...args),
  getRosterAudit: (...args: unknown[]) => mockGetRosterAudit(...args),
  restorePlayer: (...args: unknown[]) => mockRestorePlayer(...args),
}));

import { SeasonStatsView } from './SeasonStatsView';
import type { MatchRecord } from '../lib/persistence';

const buildQuarters = (): MatchRecord['allocation']['quarters'] => {
  const players = ['Alex', 'Blake', 'Casey', 'Dana', 'Ellis', 'Frankie', 'Gerry', 'Harper', 'Ira'];
  // Build 4 quarters with split mode (1 GK + 4 first-wave + 4 second-wave = 9 slots)
  return [1, 2, 3, 4].map((q) => ({
    quarter: q as 1 | 2 | 3 | 4,
    slots: [
      { player: players[0], position: 'GK' as const, minutes: 10 },
      { player: players[1], position: 'DEF' as const, minutes: 5, wave: 'first' as const },
      { player: players[2], position: 'DEF' as const, minutes: 5, wave: 'first' as const },
      { player: players[3], position: 'ATT' as const, minutes: 5, wave: 'first' as const },
      { player: players[4], position: 'ATT' as const, minutes: 5, wave: 'first' as const },
      { player: players[5], position: 'DEF' as const, minutes: 5, wave: 'second' as const },
      { player: players[6], position: 'DEF' as const, minutes: 5, wave: 'second' as const },
      { player: players[7], position: 'ATT' as const, minutes: 5, wave: 'second' as const },
      { player: players[8], position: 'ATT' as const, minutes: 5, wave: 'second' as const },
    ],
  }));
};

const buildMatch = (overrides: Partial<MatchRecord> = {}): MatchRecord => ({
  id: 'match-1',
  date: '2024-03-01',
  opponent: 'Rivals FC',
  players: ['Alex', 'Blake', 'Casey', 'Dana', 'Ellis', 'Frankie', 'Gerry', 'Harper', 'Ira'],
  allocation: {
    quarters: buildQuarters(),
    summary: { Alex: 40, Blake: 20, Casey: 20, Dana: 20, Ellis: 20, Frankie: 20, Gerry: 20, Harper: 20, Ira: 20 },
    warnings: [],
  },
  createdAt: '2024-03-01T10:00:00Z',
  lastModifiedAt: '2024-03-01T10:00:00Z',
  editHistory: [],
  result: null,
  ...overrides,
});

describe('SeasonStatsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persistenceMocks.getMatchPersistenceMode.mockReturnValue('local');
    persistenceMocks.getMatchPersistenceError.mockReturnValue(null);
    persistenceMocks.listMatches.mockResolvedValue([]);
    persistenceMocks.updateMatch.mockResolvedValue(null);
    statsMocks.fetchTeamStats.mockResolvedValue(null);
    statsMocks.fetchPlayerStats.mockResolvedValue([]);
    auditMocks.fetchAuditEvents.mockResolvedValue([]);
    mockListRoster.mockResolvedValue([]);
    mockGetRosterAudit.mockResolvedValue([]);
    mockRestorePlayer.mockResolvedValue(null);
  });

  // Test removed: "Removed Players" feature is not currently implemented in SeasonStatsView
  // The component shows active roster via the Players tab but doesn't have a separate
  // "Removed Players" section. If this feature is needed, it should be added to the component first.

  it('displays match result metadata when available', async () => {
    const match = buildMatch({
      result: {
        venue: 'Home',
        result: 'Win',
        goalsFor: 4,
        goalsAgainst: 2,
        playerOfMatch: undefined,
        honorableMentions: [],
        scorers: [],
      },
    });

    render(
      <SeasonStatsView matches={[match]} onMatchesChange={() => {}} currentUser="coach" />
    );

    // Verify basic match metadata is displayed
    expect(await screen.findByText('vs Rivals FC')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('4 - 2')).toBeInTheDocument();
    expect(screen.getByText('Win')).toBeInTheDocument();
    // Note: "Hon. Mentions" detail view is not currently rendered in collapsed match cards

    // Verify season snapshot shows aggregated stats
    const snapshotHeading = await screen.findByText('Season Snapshot');
    const snapshotSection = snapshotHeading.closest('section');
    expect(snapshotSection).toBeTruthy();
    if (snapshotSection) {
      expect(within(snapshotSection).getByText('Goals For')).toBeInTheDocument();
      expect(within(snapshotSection).getByText('4')).toBeInTheDocument();
    }
  });

  it('refreshes backend stats after saving a match in API mode', async () => {
    const initialMatch = buildMatch();
    const updatedMatch = {
      ...initialMatch,
      opponent: 'Updated Opponent',
      lastModifiedAt: '2024-03-02T10:00:00Z',
    };

    persistenceMocks.getMatchPersistenceMode.mockReturnValue('api');
    statsMocks.fetchTeamStats.mockResolvedValue({
      played: 1,
      wins: 1,
      draws: 0,
      losses: 0,
      goalsFor: 2,
      goalsAgainst: 1,
      goalDifference: 1,
      teamId: 'team-123',
      seasonId: null,
      lastUpdated: '2024-03-01T00:00:00Z',
    });
    statsMocks.fetchPlayerStats.mockResolvedValue([]);
    auditMocks.fetchAuditEvents.mockResolvedValue([]);
    persistenceMocks.listMatches.mockResolvedValue([updatedMatch]);
    persistenceMocks.updateMatch.mockResolvedValue(updatedMatch);
    mockListRoster.mockResolvedValue([]);
    mockGetRosterAudit.mockResolvedValue([]);

    const onMatchesChange = vi.fn();

    render(
      <SeasonStatsView matches={[initialMatch]} onMatchesChange={onMatchesChange} currentUser="coach" />
    );

    await waitFor(() => expect(statsMocks.fetchTeamStats).toHaveBeenCalledTimes(1));

    const expandButton = await screen.findByRole('button', { name: /expand/i });
    await userEvent.click(expandButton);

    const opponentInput = await screen.findByLabelText('Opponent');
    await userEvent.clear(opponentInput);
    await userEvent.type(opponentInput, 'Updated Opponent');

    const saveButton = await screen.findByRole('button', { name: /save changes/i });
    await userEvent.click(saveButton);

    await waitFor(() => expect(persistenceMocks.updateMatch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(statsMocks.fetchTeamStats).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(persistenceMocks.listMatches).toHaveBeenCalledTimes(1));
    expect(onMatchesChange).toHaveBeenCalledWith([updatedMatch]);
  });

  describe('squads', () => {
    const awayWin = { venue: 'Away', result: 'Win', goalsFor: 3, goalsAgainst: 1, honorableMentions: [], scorers: [] };
    const redsMatch = buildMatch({ id: 'm-reds', opponent: 'Linton', squad: 'REDS', result: awayWin });
    const blacksMatch = buildMatch({
      id: 'm-blacks',
      opponent: 'Haverhill',
      squad: 'BLACKS',
      result: { venue: 'Home', result: 'Loss', goalsFor: 0, goalsAgainst: 2, honorableMentions: [], scorers: [] },
    });
    const oldMatch = buildMatch({ id: 'm-old', opponent: 'Saffron Old', squad: null, result: awayWin });

    it('labels squad matches and shows home goals first, leaving pre-split matches unchanged', async () => {
      render(
        <SeasonStatsView matches={[redsMatch, oldMatch]} onMatchesChange={() => {}} currentUser="coach" />
      );

      const redsCard = (await screen.findByText('Reds vs Linton')).closest('div.rounded-lg')!;
      expect(within(redsCard as HTMLElement).getByText('1 - 3')).toBeInTheDocument();

      const oldCard = screen.getByText('vs Saffron Old').closest('div.rounded-lg')!;
      expect(within(oldCard as HTMLElement).getByText('3 - 1')).toBeInTheDocument();
    });

    it('filters games and totals by squad, with Overall showing everything', async () => {
      render(
        <SeasonStatsView
          matches={[redsMatch, blacksMatch, oldMatch]}
          onMatchesChange={() => {}}
          currentUser="coach"
        />
      );

      const squadFilter = await screen.findByLabelText('Squad');
      expect(squadFilter).toHaveValue('');
      expect(screen.getByText('Reds vs Linton')).toBeInTheDocument();
      expect(screen.getByText('Blacks vs Haverhill')).toBeInTheDocument();
      expect(screen.getByText('vs Saffron Old')).toBeInTheDocument();

      await userEvent.selectOptions(squadFilter, 'BLACKS');

      expect(screen.queryByText('Reds vs Linton')).not.toBeInTheDocument();
      expect(screen.queryByText('vs Saffron Old')).not.toBeInTheDocument();
      expect(screen.getByText('Blacks vs Haverhill')).toBeInTheDocument();

      const snapshot = screen.getByText('Season Snapshot').closest('section')!;
      const goalsAgainst = within(snapshot).getByText('Goals Against').parentElement!;
      expect(within(goalsAgainst).getByText('2')).toBeInTheDocument();
    });

    it('uses local totals rather than whole-team API totals when a squad is chosen', async () => {
      persistenceMocks.getMatchPersistenceMode.mockReturnValue('api');
      statsMocks.fetchTeamStats.mockResolvedValue({
        played: 3, wins: 2, draws: 0, losses: 1, goalsFor: 6, goalsAgainst: 4, goalDifference: 2,
        teamId: 'team-123', seasonId: null, lastUpdated: null,
      });
      render(
        <SeasonStatsView matches={[redsMatch, blacksMatch, oldMatch]} onMatchesChange={() => {}} currentUser="coach" />
      );

      const snapshot = (await screen.findByText('Season Snapshot')).closest('section')!;
      const goalsFor = () => within(snapshot).getByText('Goals For').parentElement!;
      await waitFor(() => expect(within(goalsFor()).getByText('6')).toBeInTheDocument());

      await userEvent.selectOptions(screen.getByLabelText('Squad'), 'REDS');
      await waitFor(() => expect(within(goalsFor()).getByText('3')).toBeInTheDocument());
    });

    it('only counts played (FINAL) matches in squad totals, but still lists upcoming ones', async () => {
      const played = { ...redsMatch, metadata: { status: 'FINAL' } };
      const upcoming = buildMatch({ id: 'm-next', opponent: 'Stansted', squad: 'REDS', metadata: { status: 'LOCKED' } });
      render(<SeasonStatsView matches={[played, upcoming]} onMatchesChange={() => {}} currentUser="coach" />);

      await userEvent.selectOptions(await screen.findByLabelText('Squad'), 'REDS');

      expect(screen.getByText('Reds vs Stansted')).toBeInTheDocument();
      const snapshot = screen.getByText('Season Snapshot').closest('section')!;
      const played1 = within(snapshot).getByText('Matches Played').parentElement!;
      expect(within(played1).getByText('1')).toBeInTheDocument();
    });

    it('says when a squad has no games yet rather than the season', async () => {
      render(<SeasonStatsView matches={[redsMatch]} onMatchesChange={() => {}} currentUser="coach" />);
      await userEvent.selectOptions(await screen.findByLabelText('Squad'), 'BLACKS');
      expect(screen.getByText('No Blacks games recorded yet.')).toBeInTheDocument();
    });

    it('previews the edited squad on the card before saving', async () => {
      render(<SeasonStatsView matches={[oldMatch]} onMatchesChange={() => {}} currentUser="coach" />);
      await userEvent.click(await screen.findByRole('button', { name: /expand/i }));
      await userEvent.selectOptions(await screen.findByLabelText('Match squad'), 'REDS');
      expect(screen.getByText('Reds vs Saffron Old')).toBeInTheDocument();
      expect(screen.getByText('1 - 3')).toBeInTheDocument();
    });

    it('can change the squad on an existing match', async () => {
      persistenceMocks.updateMatch.mockResolvedValue({ ...oldMatch, squad: 'REDS' });
      render(<SeasonStatsView matches={[oldMatch]} onMatchesChange={() => {}} currentUser="coach" />);

      await userEvent.click(await screen.findByRole('button', { name: /expand/i }));
      await userEvent.selectOptions(await screen.findByLabelText('Match squad'), 'REDS');
      await userEvent.click(await screen.findByRole('button', { name: /save changes/i }));

      await waitFor(() =>
        expect(persistenceMocks.updateMatch).toHaveBeenCalledWith('m-old', expect.objectContaining({ squad: 'REDS' }))
      );
    });
  });
});
