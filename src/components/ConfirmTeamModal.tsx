import { useEffect, useState, type FormEvent } from 'react';
import type { Allocation } from '../lib/types';

interface ConfirmTeamModalProps {
  isOpen: boolean;
  initialDate: string;
  initialTime?: string;
  initialVenue?: 'Home' | 'Away' | 'Neutral';
  initialOpponent?: string;
  onClose: () => void;
  onConfirm: (details: {
    date: string;
    time: string;
    opponent: string;
    venue: 'Home' | 'Away' | 'Neutral';
    goalsFor: number | null;
    goalsAgainst: number | null;
    outcome: 'Win' | 'Loss' | 'Draw' | '';
    playerOfMatch: string;
    honorableMentions: string;
    scorers: string;
  }) => Promise<void>;
  allocation: Allocation | null;
  players: string[];
  isSaving: boolean;
  error: string;
}

export function ConfirmTeamModal({
  isOpen,
  initialDate,
  initialTime = '',
  initialVenue = 'Home',
  initialOpponent = '',
  onClose,
  onConfirm,
  allocation,
  players,
  isSaving,
  error,
}: ConfirmTeamModalProps) {
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [opponent, setOpponent] = useState(initialOpponent);
  const [venue, setVenue] = useState<'Home' | 'Away' | 'Neutral'>(initialVenue);
  const [goalsFor, setGoalsFor] = useState('');
  const [goalsAgainst, setGoalsAgainst] = useState('');
  const [outcome, setOutcome] = useState<'Win' | 'Loss' | 'Draw' | ''>('');
  const [playerOfMatch, setPlayerOfMatch] = useState('');
  const [honorableMentions, setHonorableMentions] = useState('');
  const [scorers, setScorers] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDate(initialDate);
      setTime(initialTime);
      setOpponent(initialOpponent);
      setVenue(initialVenue);
      setGoalsFor('');
      setGoalsAgainst('');
      setOutcome('');
      setPlayerOfMatch('');
      setHonorableMentions('');
      setScorers('');
    }
  }, [initialDate, initialTime, initialVenue, initialOpponent, isOpen]);

  if (!isOpen || !allocation || players.length === 0) {
    return null;
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsedGoalsFor = goalsFor.trim() === '' ? null : Number(goalsFor);
    const parsedGoalsAgainst = goalsAgainst.trim() === '' ? null : Number(goalsAgainst);
    await onConfirm({
      date,
      time: time.trim(),
      opponent,
      venue,
      goalsFor: Number.isFinite(parsedGoalsFor) ? parsedGoalsFor : null,
      goalsAgainst: Number.isFinite(parsedGoalsAgainst) ? parsedGoalsAgainst : null,
      outcome,
      playerOfMatch,
      honorableMentions,
      scorers,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Confirm Match
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close confirm team modal"
          >
            ×
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Save the current allocation for this fixture. You can edit match
          details later from Season Stats.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="match-date"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                Match Date *
              </label>
              <input
                id="match-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="match-time"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                Kickoff Time
              </label>
              <input
                id="match-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="e.g., 14:30"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="match-venue"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                Venue
              </label>
              <select
                id="match-venue"
                value={venue}
                onChange={(e) => setVenue(e.target.value as typeof venue)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="Home">Home</option>
                <option value="Away">Away</option>
                <option value="Neutral">Neutral</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="match-outcome"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                Result
              </label>
              <select
                id="match-outcome"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as typeof outcome)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Not set</option>
                <option value="Win">Win</option>
                <option value="Draw">Draw</option>
                <option value="Loss">Loss</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="match-goals-for"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                Goals For
              </label>
              <input
                id="match-goals-for"
                type="number"
                min={0}
                value={goalsFor}
                onChange={(e) => setGoalsFor(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="match-goals-against"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                Goals Against
              </label>
              <input
                id="match-goals-against"
                type="number"
                min={0}
                value={goalsAgainst}
                onChange={(e) => setGoalsAgainst(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="match-opponent"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              Opponent
            </label>
            <input
              id="match-opponent"
              type="text"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              placeholder="e.g. Eastside Eagles"
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="match-player-of-match"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                Player of the Match
              </label>
              <input
                id="match-player-of-match"
                type="text"
                value={playerOfMatch}
                onChange={(e) => setPlayerOfMatch(e.target.value)}
                placeholder="Optional"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="match-scorers"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                Goalscorers
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Format: "Player: Goals" (e.g. "Isla: 1, Lottie W: 2")
                </span>
              </label>
              <textarea
                id="match-scorers"
                rows={2}
                value={scorers}
                onChange={(e) => setScorers(e.target.value)}
                placeholder="e.g. Isla: 1, Lottie W: 2, Emma: 1"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="match-honorable-mentions"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              Honorable Mentions
              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">(comma separated)</span>
            </label>
            <textarea
              id="match-honorable-mentions"
              rows={2}
              value={honorableMentions}
              onChange={(e) => setHonorableMentions(e.target.value)}
              placeholder="Optional"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/50 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400"
            >
              {isSaving ? 'Saving…' : 'Confirm Match'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
