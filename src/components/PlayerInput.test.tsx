import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const rosterMocks = vi.hoisted(() => ({
  addPlayer: vi.fn(),
  getRosterAudit: vi.fn(),
  getRosterLastError: vi.fn(() => null),
  getRosterPersistenceMode: vi.fn(() => 'local'),
  listRoster: vi.fn(),
  removePlayer: vi.fn(),
  restorePlayer: vi.fn(),
}));

vi.mock('../lib/roster', () => rosterMocks);

import { addPlayer, getRosterAudit, listRoster, removePlayer, restorePlayer } from '../lib/roster';
import { PlayerInput } from './PlayerInput';

const mockListRoster = listRoster as unknown as vi.Mock;
const mockAddPlayer = addPlayer as unknown as vi.Mock;
const mockRemovePlayer = removePlayer as unknown as vi.Mock;
const mockGetRosterAudit = getRosterAudit as unknown as vi.Mock;
const mockRestorePlayer = restorePlayer as unknown as vi.Mock;

const rosterFixtures = () => [
  { id: '1', name: 'Alex', createdAt: '', updatedAt: '', removedAt: null },
  { id: '2', name: 'Blake', createdAt: '', updatedAt: '', removedAt: null },
];

describe('PlayerInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rosterMocks.getRosterPersistenceMode.mockReturnValue('local');
    rosterMocks.getRosterLastError.mockReturnValue(null);
    mockGetRosterAudit.mockResolvedValue([]);
  });

  it('loads roster and toggles selection contributing to player list', async () => {
    mockListRoster.mockResolvedValue(rosterFixtures());
    const onPlayersChange = vi.fn();

    render(<PlayerInput currentUser="coach" onPlayersChange={onPlayersChange} />);

    await waitFor(() => {
      expect(mockListRoster).toHaveBeenCalledTimes(1);
      expect(mockListRoster).toHaveBeenCalledWith({ includeRemoved: true });
    });
    await waitFor(() => expect(mockGetRosterAudit).toHaveBeenCalledTimes(1));

    const alexCheckbox = await screen.findByLabelText('Alex');
    await userEvent.click(alexCheckbox);

    await waitFor(() => {
      expect(onPlayersChange).toHaveBeenLastCalledWith(['Alex']);
    });

    await userEvent.click(alexCheckbox);
    await waitFor(() => {
      expect(onPlayersChange).toHaveBeenLastCalledWith([]);
    });
  });

  it('adds players to roster and auto-selects them', async () => {
    mockListRoster
      .mockResolvedValueOnce(rosterFixtures())
      .mockResolvedValueOnce([
        ...rosterFixtures(),
        { id: '3', name: 'Casey', createdAt: '', updatedAt: '', removedAt: null },
      ]);
    mockGetRosterAudit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockAddPlayer.mockResolvedValueOnce({
      id: '3',
      name: 'Casey',
      createdAt: '',
      updatedAt: '',
      removedAt: null,
    });

    const onPlayersChange = vi.fn();
    render(<PlayerInput currentUser="coach" onPlayersChange={onPlayersChange} />);

    await waitFor(() => expect(mockListRoster).toHaveBeenCalledTimes(1));

    const input = screen.getByPlaceholderText('Add player to squad');
    await userEvent.type(input, 'Casey');
    await userEvent.click(screen.getByRole('button', { name: /add player to squad/i }));

    await waitFor(() => {
      expect(mockAddPlayer).toHaveBeenCalledWith('Casey', 'coach');
      expect(mockListRoster).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(onPlayersChange).toHaveBeenLastCalledWith(['Casey']);
    });

    const caseyLabels = await screen.findAllByText('Casey');
    expect(caseyLabels.length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText('Added Casey to squad')).toBeInTheDocument();
  });

  it('removes players from roster and deselects them', async () => {
    mockListRoster
      .mockResolvedValueOnce(rosterFixtures())
      .mockResolvedValueOnce([
        { ...rosterFixtures()[0], removedAt: new Date().toISOString() },
        rosterFixtures()[1],
      ]);
    mockGetRosterAudit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockRemovePlayer.mockResolvedValueOnce({
      ...rosterFixtures()[0],
      removedAt: new Date().toISOString(),
    });

    const onPlayersChange = vi.fn();
    render(<PlayerInput currentUser="coach" onPlayersChange={onPlayersChange} />);

    await waitFor(() => expect(mockListRoster).toHaveBeenCalledTimes(1));

    const alexCheckbox = await screen.findByLabelText('Alex');
    await userEvent.click(alexCheckbox);

    await waitFor(() => {
      expect(onPlayersChange).toHaveBeenLastCalledWith(['Alex']);
    });

    const alexRow = (await screen.findAllByText('Alex'))[0]?.closest('li');
    expect(alexRow).toBeTruthy();
    const removeButton = within(alexRow!).getByRole('button', { name: /remove/i });
    await userEvent.click(removeButton);

    await waitFor(() => {
      expect(mockRemovePlayer).toHaveBeenCalledWith('1', 'coach');
      expect(mockListRoster).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(onPlayersChange).toHaveBeenLastCalledWith([]);
    });

    expect(await screen.findByText('Player removed from squad')).toBeInTheDocument();
  });

  it('restores removed players and reselects them', async () => {
    const removedAt = new Date().toISOString();
    mockListRoster
      .mockResolvedValueOnce([
        { id: '1', name: 'Alex', createdAt: '', updatedAt: '', removedAt },
        { id: '2', name: 'Blake', createdAt: '', updatedAt: '', removedAt: null },
      ])
      .mockResolvedValueOnce([
        { id: '1', name: 'Alex', createdAt: '', updatedAt: '', removedAt: null },
        { id: '2', name: 'Blake', createdAt: '', updatedAt: '', removedAt: null },
      ]);
    mockGetRosterAudit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockRestorePlayer.mockResolvedValueOnce({
      id: '1',
      name: 'Alex',
      createdAt: '',
      updatedAt: '',
      removedAt: null,
    });

    const onPlayersChange = vi.fn();
    render(<PlayerInput currentUser="coach" onPlayersChange={onPlayersChange} />);

    await waitFor(() => expect(mockListRoster).toHaveBeenCalledTimes(1));

    const restoreButton = await screen.findByRole('button', { name: /restore/i });
    await userEvent.click(restoreButton);

    await waitFor(() => {
      expect(mockRestorePlayer).toHaveBeenCalledWith('1', 'coach');
      expect(mockListRoster).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(onPlayersChange).toHaveBeenLastCalledWith(['Alex']);
    });

    expect(await screen.findByText('Player restored to squad')).toBeInTheDocument();
  });

  it('shows fallback banner when persistence switches to fallback mode', async () => {
    rosterMocks.getRosterPersistenceMode.mockReturnValue('fallback');
    rosterMocks.getRosterLastError.mockReturnValue(new Error('TEAM_ID environment variable is required when VITE_USE_API is true.'));
    mockListRoster.mockResolvedValue([]);

    render(<PlayerInput currentUser="coach" onPlayersChange={() => {}} />);

    expect(
      await screen.findByText(/API unavailable: TEAM_ID environment variable is required/, { exact: false })
    ).toBeInTheDocument();
  });
});
