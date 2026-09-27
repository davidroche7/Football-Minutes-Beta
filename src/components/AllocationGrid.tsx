import { useRef, useState, type DragEvent } from 'react';
import { toPng } from 'html-to-image';
import type { Allocation, Quarter, QuarterMode, PlayerSlot } from '../lib/types';
import { POSITION_DISPLAY, POSITION_COLOUR } from '../lib/types';
import { getSubsForQuarter } from '../lib/allocator';
import { CONFIG } from '../config/constants';

interface AllocationGridProps {
  allocation: Allocation;
  allPlayers: string[];
  onSlotClick?: (quarter: Quarter, slotIndex: number, slot: PlayerSlot) => void;
  onDragStart?: (quarter: Quarter, slotIndex: number) => void;
  onSubDragStart?: (quarter: Quarter, playerName: string) => void;
  onDrop?: (quarter: Quarter, slotIndex: number) => void;
  onDragEnd?: () => void;
  onSubPointChange?: (quarter: number, subPoint: number) => void;
  quarterModes?: QuarterMode[];
  onQuarterModeChange?: (quarter: number, mode: QuarterMode) => void;
}

type DragState = {
  type: 'slot' | 'sub' | null;
  quarter: Quarter | null;
  slotIndex?: number;
  playerName?: string;
};

/**
 * Component to display the quarter-by-quarter allocation grid with enhanced drag-and-drop
 */
export function AllocationGrid({
  allocation,
  allPlayers,
  onSlotClick,
  onDragStart,
  onSubDragStart,
  onDrop,
  onDragEnd,
  onSubPointChange,
  quarterModes,
  onQuarterModeChange,
}: AllocationGridProps) {
  // Enhanced drag state tracking for visual feedback
  const [dragState, setDragState] = useState<DragState>({
    type: null,
    quarter: null,
  });
  const [dropTarget, setDropTarget] = useState<{ quarter: Quarter; slotIndex: number } | null>(null);
  const [isSharingPhoto, setIsSharingPhoto] = useState(false);
  const quartersGridRef = useRef<HTMLDivElement>(null);

  // Renders the 4 quarter cards as one PNG and hands it to the OS share sheet
  // (WhatsApp, Messages, etc). On a phone the grid is normally a single narrow
  // column, so for the capture we force it wide enough for a readable 2x2 —
  // forcing column count alone squeezes each card to the phone's full width
  // ÷ 2 (~190px), which is why text was overlapping/wrapping. Editing-only
  // controls (mode toggle, sub-point stepper) are stripped via `filter` —
  // they mean nothing in a static photo and just eat space.
  const CAPTURE_WIDTH_PX = 1400;

  const handleShareAsPhoto = async () => {
    const node = quartersGridRef.current;
    if (!node || isSharingPhoto) return;

    setIsSharingPhoto(true);
    const previousWidth = node.style.width;
    const previousColumns = node.style.gridTemplateColumns;
    node.style.width = `${CAPTURE_WIDTH_PX}px`;
    node.style.gridTemplateColumns = 'repeat(2, 1fr)';
    // Let the browser reflow at the new width before we read it into the capture.
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const restoreLayout = () => {
      node.style.width = previousWidth;
      node.style.gridTemplateColumns = previousColumns;
    };

    try {
      const dataUrl = await toPng(node, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        width: CAPTURE_WIDTH_PX,
        filter: (el) => !(el instanceof HTMLElement && el.dataset.captureHide === 'true'),
      });
      restoreLayout();

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `lineup-q1-4.png`, { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Quarter Lineup' });
      } else {
        // Desktop / unsupported browsers: fall back to a plain download so it
        // can still be attached to WhatsApp Web (or anywhere else) by hand.
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'lineup-q1-4.png';
        link.click();
      }
    } catch (err) {
      // AbortError when the user just cancels the native share sheet — not a real failure.
      if (!(err instanceof Error) || err.name !== 'AbortError') {
        console.error('Share as photo failed', err);
      }
    } finally {
      restoreLayout();
      setIsSharingPhoto(false);
    }
  };

  const handleSlotClick = (quarter: Quarter, slotIndex: number, slot: PlayerSlot) => {
    if (onSlotClick) {
      onSlotClick(quarter, slotIndex, slot);
    }
  };

  const handleDragStart = (e: DragEvent, quarter: Quarter, slotIndex: number, slot: PlayerSlot) => {
    // Only allow dragging outfield positions
    if (slot.position === 'GK') {
      e.preventDefault();
      return;
    }

    // Set drag data for enhanced visual feedback
    setDragState({
      type: 'slot',
      quarter,
      slotIndex,
      playerName: slot.player,
    });

    // Set custom drag image text
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', slot.player);

    if (onDragStart) {
      onDragStart(quarter, slotIndex);
    }
  };

  const handleSubDragStart = (e: DragEvent, quarter: Quarter, playerName: string) => {
    setDragState({
      type: 'sub',
      quarter,
      playerName,
    });

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', playerName);
  };

  const handleDragOver = (e: DragEvent, quarter: Quarter, slotIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Update drop target for visual feedback
    setDropTarget({ quarter, slotIndex });
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = (e: DragEvent, quarter: Quarter, slotIndex: number, slot: PlayerSlot) => {
    e.preventDefault();

    // Only allow dropping on outfield positions
    if (slot.position === 'GK') {
      setDragState({ type: null, quarter: null });
      setDropTarget(null);
      return;
    }

    if (onDrop) {
      onDrop(quarter, slotIndex);
    }

    // Clear drag state
    setDragState({ type: null, quarter: null });
    setDropTarget(null);
  };

  const handleDragEndLocal = () => {
    setDragState({ type: null, quarter: null });
    setDropTarget(null);
    if (onDragEnd) {
      onDragEnd();
    }
  };

  const getSlotClasses = (
    slot: PlayerSlot,
    baseClasses: string,
    quarter: Quarter,
    slotIndex: number
  ) => {
    const clickable = onSlotClick ? 'cursor-pointer hover:opacity-80 transition-all' : '';
    const draggable = onDragStart && slot.position !== 'GK' ? 'cursor-move' : '';

    // Visual feedback for dragging
    const isDragging = dragState.type === 'slot' &&
                       dragState.quarter === quarter &&
                       dragState.slotIndex === slotIndex;
    const isDropTarget = dropTarget?.quarter === quarter &&
                         dropTarget?.slotIndex === slotIndex &&
                         !isDragging;
    const isValidDropZone = dragState.type !== null &&
                            dragState.quarter === quarter &&
                            slot.position !== 'GK' &&
                            !isDragging;

    let stateClasses = '';
    if (isDragging) {
      stateClasses = 'opacity-40 ring-2 ring-red-400 ring-offset-2';
    } else if (isDropTarget) {
      stateClasses = 'ring-2 ring-green-500 ring-offset-2 scale-105 shadow-lg';
    } else if (isValidDropZone) {
      stateClasses = 'ring-2 ring-gray-300 ring-offset-1';
    }

    return `${baseClasses} ${clickable} ${draggable} ${stateClasses}`;
  };

  // Compute fairness: mean minutes and which players are too far off
  const summaryValues = Object.values(allocation.summary);
  const meanMinutes = summaryValues.length > 0
    ? summaryValues.reduce((a, b) => a + b, 0) / summaryValues.length
    : 0;
  const maxVariance = CONFIG.RULES.MAX_MINUTE_VARIANCE;
  const isPlayerOverThreshold = (playerName: string) => {
    const playerTotal = allocation.summary[playerName] ?? 0;
    return Math.abs(playerTotal - meanMinutes) > maxVariance;
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-3 sm:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          Quarter Allocation
        </h2>
        <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400 sm:text-right">
          {onSlotClick && <p>Click any slot to edit</p>}
          {onDragStart && <p className="hidden sm:block">Drag outfield players to swap</p>}
          <button
            onClick={handleShareAsPhoto}
            disabled={isSharingPhoto}
            className="px-3 py-1.5 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-wait"
            title="Turns all 4 quarters into one photo you can share (e.g. on WhatsApp)"
          >
            {isSharingPhoto ? 'Preparing…' : 'Share as Photo'}
          </button>
        </div>
      </div>

      <div ref={quartersGridRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {allocation.quarters.map((quarter) => {
          const quarterNumber = quarter.quarter;
          const subs = getSubsForQuarter(allocation, quarterNumber, allPlayers);
          const mode = quarterModes?.[quarterNumber - 1] ?? 'split';

          const getSlotIndex = (slot: PlayerSlot) =>
            quarter.slots.findIndex((candidate) => candidate === slot);

          // Derive sub point from first-wave slot minutes, falling back to allocation.subPoints or 5
          const firstWaveSlot = quarter.slots.find((s) => s.wave === 'first');
          const subPoint = firstWaveSlot?.minutes
            ?? allocation.subPoints?.[quarterNumber - 1]
            ?? 5;
          const quarterDuration = CONFIG.QUARTER_DURATION;

          return (
            <div
              key={quarter.quarter}
              className="border border-gray-300 dark:border-gray-600 rounded-lg p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                  Q{quarter.quarter}
                </h3>
                <div data-capture-hide="true" className="flex flex-wrap items-center gap-2">
                  {/* Mode toggle */}
                  {onQuarterModeChange && (
                    <div className="flex items-center gap-1 text-xs">
                      <button
                        onClick={() => onQuarterModeChange(quarterNumber, 'full')}
                        className={`px-2 py-1 rounded transition-colors ${
                          mode === 'full'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                        }`}
                      >
                        No subs
                      </button>
                      <button
                        onClick={() => onQuarterModeChange(quarterNumber, 'split')}
                        className={`px-2 py-1 rounded transition-colors ${
                          mode === 'split'
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                        }`}
                      >
                        Sub halfway
                      </button>
                    </div>
                  )}
                  {/* Sub-point stepper — only visible in split mode */}
                  {onSubPointChange && mode === 'split' && (
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-gray-500 dark:text-gray-400 mr-1">Subs at:</span>
                      <button
                        onClick={() => subPoint > 1 && onSubPointChange(quarterNumber, subPoint - 1)}
                        disabled={subPoint <= 1}
                        className="w-6 h-6 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-semibold text-gray-900 dark:text-white">
                        {subPoint}
                      </span>
                      <button
                        onClick={() => subPoint < quarterDuration - 1 && onSubPointChange(quarterNumber, subPoint + 1)}
                        disabled={subPoint >= quarterDuration - 1}
                        className="w-6 h-6 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        +
                      </button>
                      <span className="text-gray-500 dark:text-gray-400 ml-1">min</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {/* GK */}
                {(() => {
                  const gkSlots = quarter.slots.filter((s) => s.position === 'GK');
                  if (gkSlots.length > 0) {
                    // Render existing GK slots
                    return gkSlots.map((slot) => {
                      const currentIndex = getSlotIndex(slot);
                      if (currentIndex < 0) return null;
                      return (
                        <div
                          key={`${quarterNumber}-slot-${currentIndex}`}
                          onClick={() => handleSlotClick(quarterNumber, currentIndex, slot)}
                          className={getSlotClasses(slot, 'bg-yellow-100 dark:bg-yellow-900 px-3 py-2 rounded-md', quarterNumber, currentIndex)}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-gray-900 dark:text-white">
                              GK
                            </span>
                            <span className="text-gray-700 dark:text-gray-300">
                              {slot.player}
                            </span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {allocation.summary[slot.player] ?? slot.minutes} min total
                            </span>
                          </div>
                        </div>
                      );
                    });
                  } else {
                    // Render empty GK slot placeholder
                    return (
                      <div
                        key={`${quarterNumber}-gk-empty`}
                        onClick={() => {
                          if (onSlotClick) {
                            // Create a temporary slot for the modal
                            const emptyGkSlot: PlayerSlot = {
                              player: '',
                              position: 'GK',
                              minutes: 10,
                            };
                            // We'll use index -1 to signal this is a new slot
                            // The parent will need to handle adding it
                            onSlotClick(quarterNumber, -1, emptyGkSlot);
                          }
                        }}
                        className={`bg-yellow-50 dark:bg-yellow-950 px-3 py-2 rounded-md border-2 border-dashed border-yellow-300 dark:border-yellow-700 ${
                          onSlotClick ? 'cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-all' : ''
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-900 dark:text-white">
                            GK
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 italic">
                            Click to add goalkeeper
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {CONFIG.QUARTER_DURATION} min
                          </span>
                        </div>
                      </div>
                    );
                  }
                })()}

                {/* Outfield sections — grouped by wave/mode */}
                {(() => {
                  // Build sections: each has a label, a filter, and colour variant
                  type Section = { label: string; filter: (s: PlayerSlot) => boolean; variant: 'primary' | 'secondary' };
                  const sections: Section[] = mode === 'full'
                    ? [{ label: `Full quarter (0-${quarterDuration} min)`, filter: (s) => s.position !== 'GK', variant: 'primary' }]
                    : [
                        { label: `0-${subPoint} minutes`, filter: (s) => s.wave === 'first', variant: 'primary' },
                        { label: `${subPoint}-${quarterDuration} minutes`, filter: (s) => s.wave === 'second', variant: 'secondary' },
                        { label: 'Other Players', filter: (s) => s.position !== 'GK' && !s.wave, variant: 'primary' },
                      ];

                  return sections.map(({ label, filter, variant }) => {
                    const slots = quarter.slots.filter(filter);
                    if (slots.length === 0) return null;
                    return (
                      <div key={label} className="border-t border-gray-200 dark:border-gray-700 pt-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{label}</p>
                        {slots.map((slot) => {
                          const currentIndex = getSlotIndex(slot);
                          if (currentIndex < 0) return null;
                          const colours = POSITION_COLOUR[slot.position];
                          const bgClass = variant === 'secondary' ? colours.secondary : colours.primary;
                          return (
                            <div
                              key={`${quarterNumber}-slot-${currentIndex}`}
                              draggable={onDragStart && slot.position !== 'GK'}
                              onDragStart={(e) => handleDragStart(e, quarterNumber, currentIndex, slot)}
                              onDragOver={(e) => handleDragOver(e, quarterNumber, currentIndex)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, quarterNumber, currentIndex, slot)}
                              onDragEnd={handleDragEndLocal}
                              onClick={() => handleSlotClick(quarterNumber, currentIndex, slot)}
                              className={getSlotClasses(
                                slot,
                                `px-3 py-2 rounded-md mb-1 ${bgClass}`,
                                quarterNumber,
                                currentIndex
                              )}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {POSITION_DISPLAY[slot.position]}
                                </span>
                                <span className="text-gray-700 dark:text-gray-300">
                                  {slot.player}
                                  {isPlayerOverThreshold(slot.player) && (
                                    <span className="ml-1 text-amber-500 dark:text-amber-400" title={`${slot.player} is ${Math.abs((allocation.summary[slot.player] ?? 0) - meanMinutes).toFixed(0)} min from average (${meanMinutes.toFixed(0)} min)`}>&#9888;</span>
                                  )}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {allocation.summary[slot.player] ?? slot.minutes} min total
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
                })()}

                {/* Subs */}
                {subs.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Substitutes {onSubDragStart && '(drag to swap)'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {subs.map((sub) => {
                        const isSubBeingDragged = dragState.type === 'sub' &&
                                                  dragState.quarter === quarterNumber &&
                                                  dragState.playerName === sub;
                        return (
                          <span
                            key={sub}
                            draggable={!!onSubDragStart}
                            onDragStart={(e) => {
                              e.stopPropagation();
                              handleSubDragStart(e, quarterNumber, sub);
                              if (onSubDragStart) {
                                onSubDragStart(quarterNumber, sub);
                              }
                            }}
                            onDragEnd={handleDragEndLocal}
                            className={`px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm transition-all ${
                              onSubDragStart ? 'cursor-move hover:bg-gray-300 dark:hover:bg-gray-600' : ''
                            } ${isSubBeingDragged ? 'opacity-40 ring-2 ring-red-400' : ''}`}
                          >
                            {sub} · {allocation.summary[sub] ?? 0} min total
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
