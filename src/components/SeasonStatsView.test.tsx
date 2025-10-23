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

const buildMatch = (overrides: Partial<MatchRecord> = {}): MatchRecord => ({
  id: 'match-1',
  date: '2024-03-01',
  opponent: 'Rivals FC',
  players: ['Alex', 'Blake'],
  allocation: {
    quarters: [],
    summary: { Alex: 20, Blake: 20 },
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

  it('renders roster overview and allows restoring removed players', async () => {
    mockListRoster
      .mockResolvedValueOnce([
        { id: '1', name: 'Alex', createdAt: '', updatedAt: '', removedAt: null },
        { id: '2', name: 'Casey', createdAt: '', updatedAt: '', removedAt: '2024-01-01T00:00:00Z' },
      ])
      .mockResolvedValueOnce([
        { id: '1', name: 'Alex', createdAt: '', updatedAt: '', removedAt: null },
        { id: '2', name: 'Casey', createdAt: '', updatedAt: '', removedAt: null },
      ]);
    mockGetRosterAudit.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'audit-1',
        playerId: '2',
        playerName: 'Casey',
        action: 'restored',
        actor: 'coach',
        timestamp: '2024-01-02T00:00:00Z',
      },
    ]);
    mockRestorePlayer.mockResolvedValue({ id: '2' });

    render(
      <SeasonStatsView matches={[]} onMatchesChange={() => {}} currentUser="coach" />
    );

    await waitFor(() => expect(mockListRoster).toHaveBeenCalledWith({ includeRemoved: true }));
    expect(await screen.findByText('Removed Players')).toBeInTheDocument();
    expect(screen.getByText('Casey')).toBeInTheDocument();

    const restoreButton = screen.getByRole('button', { name: /restore/i });
    await userEvent.click(restoreButton);

    await waitFor(() => expect(mockRestorePlayer).toHaveBeenCalledWith('2', 'coach'));
    await waitFor(() => expect(mockListRoster).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/restored to active squad/i)).toBeInTheDocument();
  });

  it('displays match result metadata when available', async () => {
    mockListRoster.mockResolvedValueOnce([]);
    mockGetRosterAudit.mockResolvedValueOnce([]);

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

    await waitFor(() => expect(mockListRoster).toHaveBeenCalled());

    expect(await screen.findByText('vs Rivals FC')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('4 - 2')).toBeInTheDocument();
    expect(screen.getByText('Win')).toBeInTheDocument();
    expect(screen.getByText('Hon. Mentions')).toBeInTheDocument();

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
});
