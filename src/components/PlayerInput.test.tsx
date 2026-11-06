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
  updatePlayerSquad: vi.fn(),
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
      expect(mockAddPlayer).toHaveBeenCalledWith('Casey', 'coach', null);
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

  describe('squads', () => {
    const squadRoster = () => [
      { id: '1', name: 'Ava', createdAt: '', updatedAt: '', removedAt: null, squadGroup: 'REDS' },
      { id: '2', name: 'Bea', createdAt: '', updatedAt: '', removedAt: null, squadGroup: 'BLACKS' },
      { id: '3', name: 'Cat', createdAt: '', updatedAt: '', removedAt: null, squadGroup: null },
      { id: '4', name: 'Dee', createdAt: '', updatedAt: '', removedAt: null, squadGroup: 'BOTH' },
    ];

    it('only offers players eligible for the chosen squad', async () => {
      mockListRoster.mockResolvedValue(squadRoster());
      render(<PlayerInput currentUser="coach" onPlayersChange={() => {}} squad="REDS" />);

      expect(await screen.findByLabelText('Ava')).toBeInTheDocument();
      expect(screen.getByLabelText('Cat')).toBeInTheDocument();
      expect(screen.getByLabelText('Dee')).toBeInTheDocument();
      expect(screen.queryByLabelText('Bea')).not.toBeInTheDocument();
    });

    it('warns, but still allows picking, a player already picked for the other squad', async () => {
      mockListRoster.mockResolvedValue(squadRoster());
      const onPlayersChange = vi.fn();
      render(
        <PlayerInput
          currentUser="coach"
          onPlayersChange={onPlayersChange}
          squad="BLACKS"
          clashes={{ Dee: 'Reds vs Linton' }}
        />
      );

      expect(await screen.findByText('Already picked for Reds vs Linton')).toBeInTheDocument();
      await userEvent.click(screen.getByLabelText('Dee'));
      await waitFor(() => expect(onPlayersChange).toHaveBeenLastCalledWith(['Dee']));
    });

    it('creates players added while picking in the current squad', async () => {
      mockListRoster.mockResolvedValue(squadRoster());
      mockAddPlayer.mockResolvedValueOnce({ id: '5', name: 'Eve', createdAt: '', updatedAt: '', removedAt: null });
      render(<PlayerInput currentUser="coach" onPlayersChange={() => {}} squad="BLACKS" />);

      await screen.findByLabelText('Bea');
      await userEvent.type(screen.getByPlaceholderText('Add player to squad'), 'Eve');
      await userEvent.click(screen.getByRole('button', { name: /add player to squad/i }));

      await waitFor(() => expect(mockAddPlayer).toHaveBeenCalledWith('Eve', 'coach', 'BLACKS'));
    });

    it('lets the roster manager tag players and new players', async () => {
      mockListRoster.mockResolvedValue(squadRoster());
      rosterMocks.updatePlayerSquad.mockResolvedValueOnce({ ...squadRoster()[2], squadGroup: 'BLACKS' });
      mockAddPlayer.mockResolvedValueOnce({ id: '5', name: 'Eve', createdAt: '', updatedAt: '', removedAt: null });
      render(<PlayerInput currentUser="coach" onPlayersChange={() => {}} showMatchSelection={false} />);

      const catSquad = await screen.findByLabelText('Squad for Cat');
      expect(catSquad).toHaveValue('');
      expect(screen.getByLabelText('Squad for Bea')).toHaveValue('BLACKS');

      await userEvent.selectOptions(catSquad, 'BLACKS');
      await waitFor(() => expect(rosterMocks.updatePlayerSquad).toHaveBeenCalledWith('3', 'BLACKS', 'coach'));
      await waitFor(() => expect(screen.getByLabelText('Squad for Cat')).toHaveValue('BLACKS'));

      await userEvent.selectOptions(screen.getByLabelText('Squad for new player'), 'BOTH');
      await userEvent.type(screen.getByPlaceholderText('Add player to squad'), 'Eve');
      await userEvent.click(screen.getByRole('button', { name: /add player to squad/i }));
      await waitFor(() => expect(mockAddPlayer).toHaveBeenCalledWith('Eve', 'coach', 'BOTH'));
    });

    it('explains when a new name matches a player tagged for the other squad', async () => {
      mockListRoster.mockResolvedValue(squadRoster());
      render(<PlayerInput currentUser="coach" onPlayersChange={() => {}} squad="REDS" />);

      await screen.findByLabelText('Ava');
      await userEvent.type(screen.getByPlaceholderText('Add player to squad'), 'bea');
      await userEvent.click(screen.getByRole('button', { name: /add player to squad/i }));

      expect(await screen.findByText(/Bea is tagged Blacks/)).toBeInTheDocument();
      expect(mockAddPlayer).not.toHaveBeenCalled();
    });

    it('saves quick successive tag changes for different players', async () => {
      mockListRoster.mockResolvedValue(squadRoster());
      let release: () => void = () => {};
      rosterMocks.updatePlayerSquad
        .mockImplementationOnce(
          () => new Promise((resolve) => (release = () => resolve({ ...squadRoster()[2], squadGroup: 'REDS' })))
        )
        .mockResolvedValueOnce({ ...squadRoster()[3], squadGroup: 'BLACKS' });
      render(<PlayerInput currentUser="coach" onPlayersChange={() => {}} showMatchSelection={false} />);

      await userEvent.selectOptions(await screen.findByLabelText('Squad for Cat'), 'REDS');
      await userEvent.selectOptions(screen.getByLabelText('Squad for Dee'), 'BLACKS');
      release();

      await waitFor(() => expect(rosterMocks.updatePlayerSquad).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByLabelText('Squad for Dee')).toHaveValue('BLACKS'));
      expect(screen.getByLabelText('Squad for Cat')).toHaveValue('REDS');
    });

    it('shows an error and keeps the old tag if saving a tag fails', async () => {
      mockListRoster.mockResolvedValue(squadRoster());
      rosterMocks.updatePlayerSquad.mockRejectedValueOnce(new Error('Network down'));
      render(<PlayerInput currentUser="coach" onPlayersChange={() => {}} showMatchSelection={false} />);

      await userEvent.selectOptions(await screen.findByLabelText('Squad for Ava'), 'BLACKS');
      expect(await screen.findByText('Network down')).toBeInTheDocument();
      expect(screen.getByLabelText('Squad for Ava')).toHaveValue('REDS');
    });
  });
});
