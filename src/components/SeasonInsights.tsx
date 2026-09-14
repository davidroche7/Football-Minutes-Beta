import { useMemo } from 'react';
import type { Allocation } from '../lib/types';
import type { MatchRecord } from '../lib/matchTypes';

interface SeasonInsightsProps {
  matches: MatchRecord[];
  currentSeasonId: string | null;
  currentAllocation: Allocation | null;
  currentPlayers: string[];
}

interface Insight {
  id: string;
  text: string;
}

/**
 * Season-aware nudge cards — read-only insight, never an allocator input.
 * Shows nothing until there's at least 2 saved matches this season.
 */
export function SeasonInsights({
  matches,
  currentSeasonId,
  currentAllocation,
  currentPlayers,
}: SeasonInsightsProps) {
  const insights = useMemo<Insight[]>(() => {
    if (!currentAllocation || currentPlayers.length === 0) return [];

    const seasonMatches = currentSeasonId
      ? matches.filter((m) => m.metadata?.seasonId === currentSeasonId)
      : matches;
    if (seasonMatches.length < 2) return [];

    const found: Insight[] = [];

    // --- Minutes balance: who's below their season average, getting more today ---
    const totalsByPlayer = new Map<string, { total: number; matchesPlayed: number }>();
    seasonMatches.forEach((m) => {
      Object.entries(m.allocation.summary ?? {}).forEach(([player, minutes]) => {
        const prev = totalsByPlayer.get(player) ?? { total: 0, matchesPlayed: 0 };
        totalsByPlayer.set(player, { total: prev.total + minutes, matchesPlayed: prev.matchesPlayed + 1 });
      });
    });

    const todaysMinutes = currentAllocation.summary ?? {};
    const todaysValues = Object.values(todaysMinutes);
    const todaysAverage =
      todaysValues.length > 0 ? todaysValues.reduce((a, b) => a + b, 0) / todaysValues.length : 0;

    let belowAveragePlayer: { name: string; deficit: number } | null = null;
    currentPlayers.forEach((player) => {
      const history = totalsByPlayer.get(player);
      if (!history || history.matchesPlayed === 0) return;
      const seasonAveragePerMatch = history.total / history.matchesPlayed;
      const allSeasonAverages = Array.from(totalsByPlayer.values()).map(
        (h) => h.total / h.matchesPlayed
      );
      const groupSeasonAverage =
        allSeasonAverages.reduce((a, b) => a + b, 0) / allSeasonAverages.length;
      const deficit = groupSeasonAverage - seasonAveragePerMatch;
      const playingAboveAverageToday = (todaysMinutes[player] ?? 0) >= todaysAverage;
      if (deficit > 3 && playingAboveAverageToday) {
        if (!belowAveragePlayer || deficit > belowAveragePlayer.deficit) {
          belowAveragePlayer = { name: player, deficit };
        }
      }
    });
    if (belowAveragePlayer) {
      const p = belowAveragePlayer as { name: string; deficit: number };
      found.push({
        id: 'minutes-balance',
        text: `${p.name} is ${Math.round(p.deficit)} min below their season average — getting above-average time today.`,
      });
    }

    // --- Bench pattern: absent from the last 2 matches, starting today ---
    const recentTwo = [...seasonMatches]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, 2);
    if (recentTwo.length === 2) {
      const returningPlayer = currentPlayers.find(
        (player) => !recentTwo.some((m) => m.players.includes(player))
      );
      if (returningPlayer) {
        found.push({
          id: 'bench-pattern',
          text: `${returningPlayer} hasn't featured in the last 2 matches — starting today.`,
        });
      }
    }

    // --- GK rotation: who hasn't tried GK yet this season ---
    const gkPlayers = new Set<string>();
    seasonMatches.forEach((m) => {
      m.allocation.quarters.forEach((q) => {
        q.slots.forEach((s) => {
          if (s.position === 'GK') gkPlayers.add(s.player);
        });
      });
    });
    const neverGK = currentPlayers.filter((p) => !gkPlayers.has(p));
    if (neverGK.length > 0 && neverGK.length < currentPlayers.length) {
      const names = neverGK.slice(0, 3).join(', ');
      found.push({
        id: 'gk-rotation',
        text: `${neverGK.length === 1 ? 'Hasn’t' : 'Haven’t'} tried GK yet this season: ${names}${neverGK.length > 3 ? ', ...' : ''}.`,
      });
    }

    return found.slice(0, 3);
  }, [matches, currentSeasonId, currentAllocation, currentPlayers]);

  if (insights.length === 0) return null;

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {insights.map((insight) => (
        <div
          key={insight.id}
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
        >
          <span aria-hidden="true">💡</span>
          <span>{insight.text}</span>
        </div>
      ))}
    </div>
  );
}
