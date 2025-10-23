import type { DragEvent } from 'react';
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

/**
 * Component to display the quarter-by-quarter allocation grid
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
    if (onDragStart) {
      onDragStart(quarter, slotIndex);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent, quarter: Quarter, slotIndex: number, slot: PlayerSlot) => {
    e.preventDefault();
    // Only allow dropping on outfield positions
    if (slot.position === 'GK') {
      return;
    }
    if (onDrop) {
      onDrop(quarter, slotIndex);
    }
  };

  const getSlotClasses = (slot: PlayerSlot, baseClasses: string) => {
    const clickable = onSlotClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : '';
    const draggable = onDragStart && slot.position !== 'GK' ? 'cursor-move' : '';
    return `${baseClasses} ${clickable} ${draggable}`;
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
                {quarter.slots
                  .filter((s) => s.position === 'GK')
                  .map((slot) => {
                    const currentIndex = getSlotIndex(slot);
                    if (currentIndex < 0) return null;
                    return (
                      <div
                        key={`${quarterNumber}-slot-${currentIndex}`}
                        onClick={() => handleSlotClick(quarterNumber, currentIndex, slot)}
                        className={getSlotClasses(slot, 'bg-yellow-100 dark:bg-yellow-900 px-3 py-2 rounded-md')}
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
                  })}

                {/* First Wave - 0-5 minutes */}
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
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, quarterNumber, currentIndex, slot)}
                          onDragEnd={onDragEnd}
                          onClick={() => handleSlotClick(quarterNumber, currentIndex, slot)}
                          className={getSlotClasses(
                            slot,
                            `px-3 py-2 rounded-md mb-1 ${
                              slot.position === 'DEF'
                                ? 'bg-blue-100 dark:bg-blue-900'
                                : 'bg-red-100 dark:bg-red-900'
                            }`
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

                {/* Second Wave - 5-10 minutes */}
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
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, quarterNumber, currentIndex, slot)}
                          onDragEnd={onDragEnd}
                          onClick={() => handleSlotClick(quarterNumber, currentIndex, slot)}
                          className={getSlotClasses(
                            slot,
                            `px-3 py-2 rounded-md mb-1 ${
                              slot.position === 'DEF'
                                ? 'bg-blue-50 dark:bg-blue-950'
                                : 'bg-red-50 dark:bg-red-950'
                            }`
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

                {/* Subs */}
                {subs.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Substitutes {onSubDragStart && '(drag to swap)'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {subs.map((sub) => (
                        <span
                          key={sub}
                          draggable={!!onSubDragStart}
                          onDragStart={(e) => {
                            e.stopPropagation();
                            if (onSubDragStart) {
                              onSubDragStart(quarterNumber, sub);
                            }
                          }}
                          onDragEnd={onDragEnd}
                          className={`px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm ${
                            onSubDragStart ? 'cursor-move hover:bg-gray-300 dark:hover:bg-gray-600' : ''
                          }`}
                        >
                          {sub}
                        </span>
                      ))}
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
