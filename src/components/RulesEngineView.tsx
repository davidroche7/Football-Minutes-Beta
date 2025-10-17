import { useEffect, useMemo, useState } from 'react';
import type { RuleConfig } from '../config/rules';

interface RulesEngineViewProps {
  rules: RuleConfig;
  onSave: (rules: RuleConfig) => void;
  onReset: () => void;
}

export function RulesEngineView({ rules, onSave, onReset }: RulesEngineViewProps) {
  const [localRules, setLocalRules] = useState<RuleConfig>(rules);
  const [status, setStatus] = useState<'idle' | 'dirty' | 'saved'>('idle');

  useEffect(() => {
    setLocalRules(rules);
    setStatus('idle');
  }, [rules]);

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
        Adjust wave durations or fairness thresholds to test new scheduling rules. Changes are stored locally and require
        a refresh to apply across the allocator.
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
