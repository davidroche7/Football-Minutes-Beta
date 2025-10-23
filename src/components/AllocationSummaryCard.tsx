import { CONFIG } from '../config/constants';
import { calculateVariance } from '../lib/allocator';
import type { Allocation } from '../lib/types';

interface AllocationSummaryCardProps {
  allocation: Allocation | null;
  selectedPlayers: string[];
}

const formatMinutes = (minutes: number) => `${minutes} min`;

export function AllocationSummaryCard({
  allocation,
  selectedPlayers,
}: AllocationSummaryCardProps) {
  if (!allocation) {
    return (
      <section className="mx-auto mb-8 w-full max-w-3xl rounded-lg border border-dashed border-gray-300 bg-white/70 p-6 text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Matchday Overview
        </h2>
        {selectedPlayers.length === 0 ? (
          <p className="mt-2 text-sm">
            No allocation yet. Select players from your squad to generate this week&apos;s lineup.
          </p>
        ) : (
          <div className="mt-3">
            <p className="text-sm">
              {selectedPlayers.length} player{selectedPlayers.length === 1 ? '' : 's'} selected.
              Generate an allocation to preview fairness and roles.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedPlayers.map((player) => (
                <span
                  key={player}
                  className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
                >
                  {player}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  const stats = calculateVariance(allocation);
  const allowedVariance = CONFIG.RULES.MAX_MINUTE_VARIANCE;
  const exceedsTarget = stats.variance > allowedVariance;

  const summaryEntries = Object.entries(allocation.summary)
    .map(([name, minutes]) => ({ name, minutes }))
    .sort((a, b) => b.minutes - a.minutes);

  return (
    <section className="mx-auto mb-8 w-full max-w-5xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Matchday Overview
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {summaryEntries.length} player{summaryEntries.length === 1 ? '' : 's'} allocated ·{' '}
            {formatMinutes(stats.mean)} average minutes
          </p>
        </div>
        <div
          className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
            exceedsTarget
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
          }`}
        >
          <span>{exceedsTarget ? 'Fairness review needed' : 'Fairness within target'}</span>
          <span className="text-xs">
            Δ {stats.variance} / target {allowedVariance}
          </span>
        </div>
      </header>

      {allocation.warnings?.length ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <h3 className="mb-2 font-semibold">Warnings</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {allocation.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Highest minutes
          </p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {summaryEntries[0]?.name ?? '—'}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {summaryEntries[0] ? formatMinutes(summaryEntries[0].minutes) : 'Pending allocation'}
          </p>
        </div>
        <div className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Lowest minutes
          </p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {summaryEntries[summaryEntries.length - 1]?.name ?? '—'}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {summaryEntries[summaryEntries.length - 1]
              ? formatMinutes(summaryEntries[summaryEntries.length - 1]?.minutes ?? 0)
              : 'Pending allocation'}
          </p>
        </div>
        <div className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Variance trend
          </p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {stats.variance} minutes
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Allowed difference: {allowedVariance} minutes
          </p>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Player minutes
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {summaryEntries.map((entry) => (
            <div
              key={entry.name}
              className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
            >
              <span className="font-medium text-gray-800 dark:text-gray-200">{entry.name}</span>
              <span className="text-gray-600 dark:text-gray-400">{formatMinutes(entry.minutes)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
