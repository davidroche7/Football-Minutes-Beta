import { useState } from 'react';
import type { Allocation, Quarter, QuarterMode, PlayerSlot, Position } from '../lib/types';
import { POSITION_DISPLAY } from '../lib/types';
import { CONFIG } from '../config/constants';

interface PitchViewProps {
  allocation: Allocation;
  allPlayers: string[];
  quarterModes?: QuarterMode[];
}

type Band = 'gk' | 'def' | 'mid' | 'fwd';

const BAND_FOR_POSITION: Record<Position, Band> = {
  GK: 'gk',
  DEF: 'def',
  MID: 'mid',
  FWD: 'fwd',
  ATT: 'fwd',
};

// Vertical position (%) within the pitch frame, attacking end at the top.
const BAND_TOP: Record<Band, number> = { fwd: 20, mid: 46, def: 68, gk: 90 };

const QUARTERS: Quarter[] = [1, 2, 3, 4];

/**
 * Read-only pitch diagram for a single quarter/wave of an allocation —
 * a visual companion to AllocationGrid, not a replacement (no editing).
 */
export function PitchView({ allocation, allPlayers, quarterModes }: PitchViewProps) {
  const [quarter, setQuarter] = useState<Quarter>(1);
  const [wave, setWave] = useState<'first' | 'second'>('first');

  const quarterData = allocation.quarters.find((q) => q.quarter === quarter);
  const mode = quarterModes?.[quarter - 1] ?? 'split';
  const quarterDuration = CONFIG.QUARTER_DURATION;

  const gkSlot = quarterData?.slots.find((s) => s.position === 'GK');
  const allOutfield = quarterData?.slots.filter((s) => s.position !== 'GK') ?? [];
  const outfieldSlots =
    mode === 'full' ? allOutfield : allOutfield.filter((s) => !s.wave || s.wave === wave);

  const firstWaveSlot = allOutfield.find((s) => s.wave === 'first');
  const subPoint = firstWaveSlot?.minutes ?? allocation.subPoints?.[quarter - 1] ?? 5;

  // Group by pitch band, then spread each band's players evenly left-to-right.
  const byBand = new Map<Band, PlayerSlot[]>();
  outfieldSlots.forEach((slot) => {
    const band = BAND_FOR_POSITION[slot.position];
    byBand.set(band, [...(byBand.get(band) ?? []), slot]);
  });

  const pins = Array.from(byBand.entries()).flatMap(([band, slots]) =>
    slots.map((slot, i) => ({
      slot,
      left: ((i + 1) / (slots.length + 1)) * 100,
      top: BAND_TOP[band],
    }))
  );
  if (gkSlot) {
    pins.push({ slot: gkSlot, left: 50, top: BAND_TOP.gk });
  }

  const onPitchNames = new Set(pins.map((p) => p.slot.player));
  const bench = allPlayers.filter((p) => !onPitchNames.has(p));

  return (
    <div className="w-full max-w-3xl mx-auto p-3 sm:p-6 bg-white dark:bg-stone-800 rounded-lg shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          Pitch View
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {QUARTERS.map((q) => (
              <button
                key={q}
                onClick={() => setQuarter(q)}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
                  quarter === q
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Q{q}
              </button>
            ))}
          </div>
          {mode === 'split' && (
            <div className="flex gap-1 text-sm">
              <button
                onClick={() => setWave('first')}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  wave === 'first'
                    ? 'bg-stone-800 dark:bg-stone-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                0-{subPoint} min
              </button>
              <button
                onClick={() => setWave('second')}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  wave === 'second'
                    ? 'bg-stone-800 dark:bg-stone-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {subPoint}-{quarterDuration} min
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-4">
        <div
          className="relative rounded-lg overflow-hidden bg-emerald-800"
          style={{ aspectRatio: '2 / 3' }}
        >
          <svg viewBox="0 0 600 900" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            <rect x="20" y="20" width="560" height="860" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
            <line x1="20" y1="450" x2="580" y2="450" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
            <circle cx="300" cy="450" r="70" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
            <rect x="150" y="20" width="300" height="120" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
            <rect x="220" y="20" width="160" height="50" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
            <rect x="150" y="760" width="300" height="120" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
            <rect x="220" y="830" width="160" height="50" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
          </svg>

          {pins.map(({ slot, left, top }) => (
            <div
              key={`${slot.position}-${slot.player}`}
              className="absolute flex flex-col items-center gap-1 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <div
                className="w-10 h-10 rounded-t-lg rounded-b-md flex items-center justify-center text-white font-extrabold text-xs shadow-lg border-2 border-black/30"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(90deg, #d21e3a 0 7px, #171010 7px 14px)',
                }}
                title={`${slot.player} — ${slot.minutes} min`}
              >
                {POSITION_DISPLAY[slot.position]}
              </div>
              <span className="text-[10px] sm:text-xs font-semibold bg-black/70 text-white px-1.5 py-0.5 rounded whitespace-nowrap max-w-[80px] truncate">
                {slot.player}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {bench.length > 0 ? 'On the bench' : 'Full squad on'}
          </h3>
          {bench.map((name) => (
            <div
              key={name}
              className="px-2 py-1.5 rounded bg-gray-100 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
