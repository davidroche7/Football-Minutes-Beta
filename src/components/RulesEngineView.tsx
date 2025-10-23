import { useEffect, useMemo, useState } from 'react';
import type { RuleConfig } from '../config/rules';
import { USE_API_PERSISTENCE } from '../config/environment';
import { fetchActiveRuleset } from '../lib/rulesClient';
import { getMatchPersistenceMode } from '../lib/persistence';

interface RulesEngineViewProps {
  rules: RuleConfig;
  onSave: (rules: RuleConfig) => void;
  onReset: () => void;
}

export function RulesEngineView({ rules, onSave, onReset }: RulesEngineViewProps) {
  const [localRules, setLocalRules] = useState<RuleConfig>(rules);
  const [status, setStatus] = useState<'idle' | 'dirty' | 'saved'>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'api' | 'local'>('local');

  useEffect(() => {
    setLocalRules(rules);
    setStatus('idle');
  }, [rules]);

  useEffect(() => {
    if (!USE_API_PERSISTENCE || getMatchPersistenceMode() !== 'api') {
      setDataSource('local');
      setError(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    fetchActiveRuleset()
      .then((response) => {
        if (!active) return;
        if (response?.config) {
          setLocalRules(response.config);
          setDataSource('api');
          setStatus('idle');
        } else {
          setDataSource('local');
        }
      })
      .catch((err) => {
        if (!active) return;
        setDataSource('local');
        setError(err instanceof Error ? err.message : 'Failed to load rules from API.');
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleNumberChange = (path: string[], value: number) => {
    setLocalRules((prev) => {
      const next = structuredClone(prev);
      let cursor: any = next;
      for (let i = 0; i < path.length - 1; i++) {
        cursor = cursor[path[i]!];
      }
      cursor[path[path.length - 1]!] = value;
      return next;
    });
    setStatus('dirty');
  };

  const handleBooleanChange = (path: string[], value: boolean) => {
    setLocalRules((prev) => {
      const next = structuredClone(prev);
      let cursor: any = next;
      for (let i = 0; i < path.length - 1; i++) {
        cursor = cursor[path[i]!];
      }
      cursor[path[path.length - 1]!] = value;
      return next;
    });
    setStatus('dirty');
  };

  const hasChanges = useMemo(() => JSON.stringify(localRules) !== JSON.stringify(rules), [localRules, rules]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-200">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span>
            Adjust wave durations or fairness thresholds to test new scheduling rules.
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
              dataSource === 'api'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 border border-green-200 dark:border-green-800/60'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100 border border-blue-200 dark:border-blue-800/60'
            }`}
          >
            Source: {dataSource === 'api' ? 'API backend' : 'Local defaults'}
          </span>
        </div>
        <p className="text-xs text-yellow-700 dark:text-yellow-200">
          Changes are stored locally and require a refresh to apply across the allocator.
        </p>
        {isLoading && (
          <p className="mt-2 text-xs text-yellow-700 dark:text-yellow-200">
            Loading rules from backend…
          </p>
        )}
        {error && (
          <p className="mt-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Timing</h3>
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <label className="flex items-center justify-between gap-3">
              <span>Quarter Duration</span>
              <input
                type="number"
                min={5}
                value={localRules.quarterDuration}
                onChange={(e) => handleNumberChange(['quarterDuration'], Number(e.target.value))}
                className="w-24 rounded-md border border-gray-300 px-2 py-1 text-right text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>First Wave</span>
              <input
                type="number"
                min={1}
                value={localRules.waves.first}
                onChange={(e) => handleNumberChange(['waves', 'first'], Number(e.target.value))}
                className="w-24 rounded-md border border-gray-300 px-2 py-1 text-right text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>Second Wave</span>
              <input
                type="number"
                min={1}
                value={localRules.waves.second}
                onChange={(e) => handleNumberChange(['waves', 'second'], Number(e.target.value))}
                className="w-24 rounded-md border border-gray-300 px-2 py-1 text-right text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Fairness</h3>
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <label className="flex items-center justify-between gap-3">
              <span>Max Variance</span>
              <input
                type="number"
                min={0}
                value={localRules.fairness.maxVariance}
                onChange={(e) => handleNumberChange(['fairness', 'maxVariance'], Number(e.target.value))}
                className="w-24 rounded-md border border-gray-300 px-2 py-1 text-right text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>GK Requires Outfield</span>
              <input
                type="checkbox"
                checked={localRules.fairness.gkRequiresOutfield}
                onChange={(e) => handleBooleanChange(['fairness', 'gkRequiresOutfield'], e.target.checked)}
                className="h-4 w-4"
              />
            </label>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            onSave(localRules);
            setStatus('saved');
          }}
          disabled={!hasChanges}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400"
        >
          Save Rules
        </button>
        <button
          type="button"
          onClick={() => {
            onReset();
          }}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Reset to Default
        </button>
        {status === 'saved' && (
          <span className="text-sm text-green-700 dark:text-green-400">
            Saved. Refresh to apply new rules across the app.
          </span>
        )}
      </div>
    </div>
  );
}
