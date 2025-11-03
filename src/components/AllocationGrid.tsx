import { useState, type DragEvent } from 'react';
import type { Allocation, Quarter, PlayerSlot } from '../lib/types';
import { getSubsForQuarter } from '../lib/allocator';

interface AllocationGridProps {
  allocation: Allocation;
  allPlayers: string[];
  onSlotClick?: (quarter: Quarter, slotIndex: number, slot: PlayerSlot) => void;
  onDragStart?: (quarter: Quarter, slotIndex: number) => void;
  onSubDragStart?: (quarter: Quarter, playerName: string) => void;
  onDrop?: (quarter: Quarter, slotIndex: number) => void;
  onDragEnd?: () => void;
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
}: AllocationGridProps) {
  // Enhanced drag state tracking for visual feedback
  const [dragState, setDragState] = useState<DragState>({
    type: null,
    quarter: null,
  });
  const [dropTarget, setDropTarget] = useState<{ quarter: Quarter; slotIndex: number } | null>(null);
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
      stateClasses = 'opacity-40 ring-2 ring-blue-400 ring-offset-2';
    } else if (isDropTarget) {
      stateClasses = 'ring-2 ring-green-500 ring-offset-2 scale-105 shadow-lg';
    } else if (isValidDropZone) {
      stateClasses = 'ring-2 ring-gray-300 ring-offset-1';
    }

    return `${baseClasses} ${clickable} ${draggable} ${stateClasses}`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Quarter Allocation
        </h2>
        <div className="text-sm text-gray-600 dark:text-gray-400 text-right">
          {onSlotClick && <p>Click any slot to edit</p>}
          {onDragStart && <p>Drag outfield players to swap positions and minutes within quarter</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {allocation.quarters.map((quarter) => {
          const quarterNumber = quarter.quarter;
          const subs = getSubsForQuarter(allocation, quarterNumber, allPlayers);

          const getSlotIndex = (slot: PlayerSlot) =>
            quarter.slots.findIndex((candidate) => candidate === slot);

          return (
            <div
              key={quarter.quarter}
              className="border border-gray-300 dark:border-gray-600 rounded-lg p-4"
            >
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                Quarter {quarter.quarter}
              </h3>

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
                              {slot.minutes} min
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
                            10 min
                          </span>
                        </div>
                      </div>
                    );
                  }
                })()}

                {/* First Wave - 0-5 minutes */}
                {quarter.slots.filter((s) => s.wave === 'first').length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      0-5 minutes
                    </p>
                    {quarter.slots
                      .filter((s) => s.wave === 'first')
                      .map((slot) => {
                        const currentIndex = getSlotIndex(slot);
                        if (currentIndex < 0) return null;
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
                              `px-3 py-2 rounded-md mb-1 ${
                                slot.position === 'DEF'
                                  ? 'bg-blue-100 dark:bg-blue-900'
                                  : 'bg-red-100 dark:bg-red-900'
                              }`,
                              quarterNumber,
                              currentIndex
                            )}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {slot.position}
                              </span>
                              <span className="text-gray-700 dark:text-gray-300">
                                {slot.player}
                              </span>
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {slot.minutes} min
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Second Wave - 5-10 minutes */}
                {quarter.slots.filter((s) => s.wave === 'second').length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      5-10 minutes
                    </p>
                    {quarter.slots
                      .filter((s) => s.wave === 'second')
                      .map((slot) => {
                        const currentIndex = getSlotIndex(slot);
                        if (currentIndex < 0) return null;
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
                              `px-3 py-2 rounded-md mb-1 ${
                                slot.position === 'DEF'
                                  ? 'bg-blue-50 dark:bg-blue-950'
                                  : 'bg-red-50 dark:bg-red-950'
                              }`,
                              quarterNumber,
                              currentIndex
                            )}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {slot.position}
                              </span>
                              <span className="text-gray-700 dark:text-gray-300">
                                {slot.player}
                              </span>
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {slot.minutes} min
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Players without wave property (legacy data) */}
                {quarter.slots.filter((s) => s.position !== 'GK' && !s.wave).length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Other Players
                    </p>
                    {quarter.slots
                      .filter((s) => s.position !== 'GK' && !s.wave)
                      .map((slot) => {
                        const currentIndex = getSlotIndex(slot);
                        if (currentIndex < 0) return null;
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
                              `px-3 py-2 rounded-md mb-1 ${
                                slot.position === 'DEF'
                                  ? 'bg-blue-100 dark:bg-blue-900'
                                  : 'bg-red-100 dark:bg-red-900'
                              }`,
                              quarterNumber,
                              currentIndex
                            )}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {slot.position}
                              </span>
                              <span className="text-gray-700 dark:text-gray-300">
                                {slot.player}
                              </span>
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {slot.minutes} min
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

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
                            } ${isSubBeingDragged ? 'opacity-40 ring-2 ring-blue-400' : ''}`}
                          >
                            {sub}
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
