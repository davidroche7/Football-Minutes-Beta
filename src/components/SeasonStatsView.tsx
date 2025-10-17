import { useMemo, useState } from 'react';
import type { MatchRecord, MatchResult, SaveMatchPayload } from '../lib/persistence';
import { bulkImportMatches, updateMatch } from '../lib/persistence';
import { getRules } from '../lib/rules';
import type { RuleConfig } from '../config/rules';
import type { Quarter } from '../lib/types';

interface SeasonStatsViewProps {
  matches: MatchRecord[];
  onMatchesChange: (records: MatchRecord[]) => void;
  currentUser: string;
}

interface PlayerSummaryRow {
  player: string;
  totalMinutes: number;
  matchesPlayed: number;
  gkQuarters: number;
  targetMinutes: number;
  warningCount: number;
}

export function SeasonStatsView({ matches, onMatchesChange, currentUser }: SeasonStatsViewProps) {
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ opponent: string; date: string }>({
    opponent: '',
    date: '',
  });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const rules = useMemo(() => getRules(), []);
  const perMatchTarget = rules.quarterDuration * rules.quarters;

  const playerSummaries = useMemo<PlayerSummaryRow[]>(() => {
    const rows: Record<string, PlayerSummaryRow> = {};

    matches.forEach((match) => {
      const warnings = match.allocation.warnings ?? [];

      Object.entries(match.allocation.summary).forEach(([player, total]) => {
        const entry =
          rows[player] ??
          (rows[player] = {
            player,
            totalMinutes: 0,
            matchesPlayed: 0,
            gkQuarters: 0,
            targetMinutes: 0,
            warningCount: 0,
          });

        entry.totalMinutes += total;
        entry.matchesPlayed += 1;
        entry.targetMinutes += perMatchTarget;
        entry.warningCount += warnings.length;
      });

      match.allocation.quarters.forEach((quarter) => {
        quarter.slots.forEach((slot) => {
          if (slot.position === 'GK') {
            const entry =
              rows[slot.player] ??
              (rows[slot.player] = {
                player: slot.player,
                totalMinutes: 0,
                matchesPlayed: 0,
                gkQuarters: 0,
                targetMinutes: 0,
                warningCount: 0,
              });
            entry.gkQuarters += 1;
          }
        });
      });
    });

    return Object.values(rows).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [matches]);

  const startEditing = (match: MatchRecord) => {
    setEditingMatchId(match.id);
    setEditForm({ opponent: match.opponent, date: match.date });
    setError('');
  };

  const handleSaveEdit = async () => {
    if (!editingMatchId) return;
    setIsSaving(true);
    setError('');
    try {
      const updated = await updateMatch(editingMatchId, {
        opponent: editForm.opponent,
        date: editForm.date,
        editor: currentUser,
      });
      if (!updated) {
        setError('Unable to update match.');
      } else {
        onMatchesChange(matches.map((m) => (m.id === updated.id ? updated : m)));
        setEditingMatchId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update match');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLegacyImport: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportMessage(null);

    try {
      const text = await file.text();
      const { payloads, skipped: skippedInvalid } = parseLegacyImportFile(text, rules);

      if (payloads.length === 0) {
        setImportError('No valid matches found in the selected file.');
        return;
      }

      const { added, skipped } = await bulkImportMatches(payloads);

      const totalSkipped = skipped + skippedInvalid;

      if (added.length === 0) {
        if (totalSkipped > 0) {
          setImportMessage(
            `No new matches imported (${totalSkipped} item${totalSkipped === 1 ? '' : 's'} skipped as duplicates or invalid).`
          );
        } else {
          setImportMessage('No new matches imported.');
        }
      } else {
        onMatchesChange([...matches, ...added]);
        setImportMessage(
          `Imported ${added.length} match${added.length === 1 ? '' : 'es'}${
            totalSkipped > 0
              ? ` (${totalSkipped} duplicate/invalid item${totalSkipped === 1 ? '' : 's'} skipped).`
              : '.'
          }`
        );
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import legacy data.');
    } finally {
      event.target.value = '';
    }
  };

  const importControls = (
    <div className="flex flex-wrap items-center gap-3">
      <label className="cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
        Import Legacy JSON
        <input
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleLegacyImport}
        />
      </label>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        Use the exported JSON from <code>npm run import:legacy</code>
      </span>
    </div>
  );

  const hasMatches = matches.length > 0;

  if (!hasMatches) {
    return (
      <div className="space-y-4">
        {importControls}
        {importMessage && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200">
            {importMessage}
          </div>
        )}
        {importError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200">
            {importError}
          </div>
        )}
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Confirmed matches will appear here once you start saving lineups.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {importControls}
      {importMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200">
          {importMessage}
        </div>
      )}
      {importError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200">
          {importError}
        </div>
      )}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Fair Minutes Tracking</h3>
        {playerSummaries.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No player data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-300">Player</th>
                  <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">Total Minutes</th>
                  <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">Matches</th>
                  <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">GK Quarters</th>
                  <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">Target Minutes</th>
                  <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">Warnings</th>
                </tr>
              </thead>
              <tbody>
                {playerSummaries.map((row) => (
                  <tr key={row.player} className="border-b border-gray-100 dark:border-gray-700/60">
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{row.player}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{row.totalMinutes}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{row.matchesPlayed}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{row.gkQuarters}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{row.targetMinutes}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{row.warningCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        {matches.map((match) => {
          const warnings = match.allocation.warnings ?? [];
          const isEditing = editingMatchId === match.id;
          return (
            <div
              key={match.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  {isEditing ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="date"
                        value={editForm.date}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                      <input
                        type="text"
                        value={editForm.opponent}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, opponent: e.target.value }))}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{match.date}</p>
                      <p className="text-xl font-semibold text-gray-900 dark:text-white">
                        vs {match.opponent}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {warnings.length > 0 && (
                    <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-1 text-sm text-yellow-700 dark:border-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-200">
                      Fairness warning active
                    </div>
                  )}
                  {isEditing ? (
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        className="rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingMatchId(null)}
                        className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditing(match)}
                      className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
              {error && isEditing && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              {match.editHistory.length > 0 && (
                <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  <p className="mb-2 font-medium text-gray-700 dark:text-gray-200">Change Log</p>
                  <ul className="space-y-1">
                    {match.editHistory.map((event) => (
                      <li key={event.id}>
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                          {event.editedAt}
                        </span>{' '}
                        {event.editedBy} changed {event.field} from “{event.previousValue}” to “{event.newValue}”
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

interface LegacyImportFile {
  matches?: LegacyMatch[];
}

interface LegacyMatch {
  date?: string;
  opponent?: string;
  venue?: string;
  availablePlayers?: unknown;
  quarters?: LegacyQuarter[];
  summary?: Record<string, number>;
  result?: LegacyResult;
}

interface LegacyQuarter {
  quarter?: number;
  slots?: LegacySlot[];
  substitutes?: unknown;
}

interface LegacySlot {
  player?: string;
  position?: string;
  minutes?: number;
}

interface LegacyResult {
  venue?: string;
  result?: string;
  goalsFor?: number;
  goalsAgainst?: number;
  playerOfMatch?: string;
  honorableMentions?: unknown;
  scorers?: unknown;
}

function parseLegacyImportFile(text: string, rules: RuleConfig): { payloads: SaveMatchPayload[]; skipped: number } {
  let data: unknown;
  try {
    data = JSON.parse(text) as LegacyImportFile;
  } catch (error) {
    throw new Error('The selected file is not valid JSON.');
  }

  if (!data || typeof data !== 'object' || !Array.isArray((data as LegacyImportFile).matches)) {
    throw new Error('JSON must include a "matches" array.');
  }

  const payloads: SaveMatchPayload[] = [];
  let skipped = 0;

  for (const legacyMatch of (data as LegacyImportFile).matches ?? []) {
    const payload = convertLegacyMatch(legacyMatch, rules);
    if (payload) {
      payloads.push(payload);
    } else {
      skipped += 1;
    }
  }

  return { payloads, skipped };
}

function convertLegacyMatch(match: LegacyMatch, rules: RuleConfig): SaveMatchPayload | null {
  const date = typeof match.date === 'string' && match.date.trim().length > 0 ? match.date.trim() : null;
  if (!date) {
    return null;
  }

  const quarters = Array.isArray(match.quarters) ? match.quarters : [];
  if (quarters.length === 0) {
    return null;
  }

  const parsedQuarters = quarters
    .map((quarter, index) => normaliseQuarter(quarter, index, rules))
    .filter((quarter) => quarter.slots.length > 0);

  if (parsedQuarters.length === 0) {
    return null;
  }

  const summaryFromSheet = normaliseSummary(match.summary);
  const summary = Object.keys(summaryFromSheet).length > 0 ? summaryFromSheet : computeSummary(parsedQuarters);

  if (Object.keys(summary).length === 0) {
    return null;
  }

  const players = Array.from(
    new Set([
      ...normaliseStringArray(match.availablePlayers),
      ...parsedQuarters.flatMap((quarter) => [
        ...quarter.slots.map((slot) => slot.player),
        ...quarter.substitutes,
      ]),
      ...Object.keys(summary),
    ])
  ).sort();

  if (players.length === 0) {
    return null;
  }

  const result = match.result ? normaliseResult(match.result) : null;

  return {
    date,
    opponent: normaliseName(match.opponent) || 'Unknown Opponent',
    players,
    allocation: {
      quarters: parsedQuarters,
      summary,
    },
    result,
  };
}

function normaliseQuarter(quarter: LegacyQuarter, index: number, rules: RuleConfig) {
  const quarterNumber = clampQuarterNumber(typeof quarter.quarter === 'number' ? quarter.quarter : index + 1);
  const slots = Array.isArray(quarter.slots)
    ? quarter.slots
        .map((slot) => {
          const player = normaliseName(slot.player);
          const position = normalisePosition(slot.position);
          if (!player || !position) return null;
          const minutes = typeof slot.minutes === 'number' && slot.minutes > 0 ? slot.minutes : rules.quarterDuration;
          return { player, position, minutes };
        })
        .filter((slot): slot is { player: string; position: 'GK' | 'DEF' | 'ATT'; minutes: number } => Boolean(slot))
    : [];

  const substitutes = normaliseStringArray(quarter.substitutes);

  return {
    quarter: quarterNumber,
    slots,
    substitutes,
  };
}

function normaliseSummary(summary: Record<string, number> | undefined): Record<string, number> {
  if (!summary || typeof summary !== 'object') {
    return {};
  }

  const result: Record<string, number> = {};
  Object.entries(summary).forEach(([player, value]) => {
    const name = normaliseName(player);
    const minutes = typeof value === 'number' ? value : Number(value);
    if (name && !Number.isNaN(minutes)) {
      result[name] = minutes;
    }
  });
  return result;
}

function computeSummary(quarters: Array<{ slots: { player: string; minutes: number }[] }>): Record<string, number> {
  const totals: Record<string, number> = {};
  quarters.forEach((quarter) => {
    quarter.slots.forEach((slot) => {
      totals[slot.player] = (totals[slot.player] || 0) + slot.minutes;
    });
  });
  return totals;
}

function normaliseResult(result: LegacyResult): MatchResult | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const goalsFor = toNumberOrNull(result.goalsFor);
  const goalsAgainst = toNumberOrNull(result.goalsAgainst);
  const playerOfMatch = normaliseName(result.playerOfMatch);
  const honorableMentions = normaliseStringArray(result.honorableMentions);
  const scorers = normaliseStringArray(result.scorers);

  if (
    !result.venue &&
    !result.result &&
    goalsFor === null &&
    goalsAgainst === null &&
    !playerOfMatch &&
    honorableMentions.length === 0 &&
    scorers.length === 0
  ) {
    return null;
  }

  return {
    venue: normaliseName(result.venue),
    result: result.result ? String(result.result).trim() : undefined,
    goalsFor,
    goalsAgainst,
    playerOfMatch,
    honorableMentions,
    scorers,
  };
}

function normaliseName(value: unknown): string {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function normaliseStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => normaliseName(item)).filter(Boolean)));
  }
  if (typeof value === 'string') {
    return normaliseStringArray(value.split(','));
  }
  return [];
}

function normalisePosition(value: unknown): 'GK' | 'DEF' | 'ATT' | null {
  if (!value) return null;
  const upper = String(value).trim().toUpperCase();
  if (upper === 'GK') return 'GK';
  if (upper === 'D' || upper === 'DEF') return 'DEF';
  if (upper === 'F' || upper === 'ATT') return 'ATT';
  return null;
}

function clampQuarterNumber(value: number): Quarter {
  const clamped = Math.min(Math.max(Math.round(value), 1), 4);
  return clamped as Quarter;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
