import { describe, it, expect } from 'vitest';
import {
  allocate,
  validateAllocation,
  calculateVariance,
  swapPositions,
  swapWithSub,
  getSubsForQuarter,
  getPlayerQuarterBreakdown,
} from './allocator';
import { CONFIG } from '../config/constants';
import type { Allocation, Quarter, QuarterMode } from './types';

const expectFairnessRespectingWarnings = (allocation: Allocation) => {
  const stats = calculateVariance(allocation);
  if (allocation.warnings?.length) {
    expect(stats.variance).toBeGreaterThan(CONFIG.RULES.MAX_MINUTE_VARIANCE);
  } else {
    expect(stats.variance).toBeLessThanOrEqual(CONFIG.RULES.MAX_MINUTE_VARIANCE);
  }
  return stats;
};

describe('allocator', () => {
  describe('allocate', () => {
    it('should throw error with less than 5 players', () => {
      expect(() => allocate(['P1', 'P2', 'P3', 'P4'])).toThrow(
        'Need at least 5 players'
      );
    });

    it('should throw error with more than 15 players', () => {
      const players = Array.from({ length: 16 }, (_, i) => `P${i + 1}`);
      expect(() => allocate(players)).toThrow('Maximum 15 players');
    });

    it('should allocate exactly 5 players', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5'];
      const allocation = allocate(players);

      expect(allocation.quarters).toHaveLength(CONFIG.QUARTERS);
      expect(Object.keys(allocation.summary)).toHaveLength(5);

      // Each quarter should have 9 slots (1 GK + 4 DEF + 4 ATT)
      allocation.quarters.forEach((q) => {
        expect(q.slots).toHaveLength(9);
      });
    });

    it('should allocate 8 players fairly', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const allocation = allocate(players);

      expect(allocation.quarters).toHaveLength(CONFIG.QUARTERS);
      expect(Object.keys(allocation.summary)).toHaveLength(8);

      // Validate structure
      const errors = validateAllocation(allocation);
      expect(errors).toHaveLength(0);
    });

    it('should allocate 10 players and report fairness status', () => {
      const players = Array.from({ length: 10 }, (_, i) => `P${i + 1}`);
      const allocation = allocate(players);

      expect(allocation.quarters).toHaveLength(CONFIG.QUARTERS);

      expectFairnessRespectingWarnings(allocation);
      if (allocation.warnings?.length) {
        expect(allocation.warnings[0]).toContain('Fairness difference');
      }

      // Validate structure
      const errors = validateAllocation(allocation);
      expect(errors).toHaveLength(0);
    });

    it('should ensure each quarter has correct positions', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const allocation = allocate(players);

      allocation.quarters.forEach((q) => {
        const gkCount = q.slots.filter((s) => s.position === 'GK').length;
        const defCount = q.slots.filter((s) => s.position === 'DEF').length;
        const midCount = q.slots.filter((s) => s.position === 'MID').length;
        const fwdCount = q.slots.filter((s) => s.position === 'FWD').length;

        expect(gkCount).toBe(1);
        expect(defCount).toBe(2); // 1 first wave + 1 second wave
        expect(midCount).toBe(2); // 1 first wave + 1 second wave
        expect(fwdCount).toBe(4); // 2 first wave + 2 second wave
      });
    });

    it('should give GK players at least one five-minute outfield block', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];
      const allocation = allocate(players);

      const errors = validateAllocation(allocation);
      expect(errors).toHaveLength(0);

      // Find all GK players
      const gkPlayers = new Set<string>();
      allocation.quarters.forEach((q) => {
        q.slots.forEach((s) => {
          if (s.position === 'GK') gkPlayers.add(s.player);
        });
      });

      // Each GK player should have at least one first-wave outfield slot
      gkPlayers.forEach((gkPlayer) => {
        const hasPrimaryOutfield = allocation.quarters.some((q) =>
          q.slots.some(
            (s) =>
              s.player === gkPlayer &&
              s.position !== 'GK' &&
              s.wave === 'first'
          )
        );
        expect(hasPrimaryOutfield).toBe(true);
      });
    });

    it('should distribute minutes reasonably fairly for 8 players', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const allocation = allocate(players);

      const stats = expectFairnessRespectingWarnings(allocation);
      expect(stats.min).toBeGreaterThan(0); // Everyone plays
    });

    it('should allocate the expected total player minutes for the match', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const allocation = allocate(players);

      const totalMinutes = Object.values(allocation.summary).reduce(
        (sum, minutes) => sum + minutes,
        0
      );

      const expectedTotalMinutes = CONFIG.QUARTERS * CONFIG.QUARTER_DURATION * 5;
      expect(totalMinutes).toBe(expectedTotalMinutes);
    });

    it('should assign only 5-minute outfield blocks and 10-minute GK blocks', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const allocation = allocate(players);

      allocation.quarters.forEach((quarter) => {
        quarter.slots.forEach((slot) => {
          if (slot.position === 'GK') {
            expect(slot.minutes).toBe(CONFIG.TIME_BLOCKS.GK_FULL);
          } else {
            expect([
              CONFIG.TIME_BLOCKS.OUTFIELD_FIRST,
              CONFIG.TIME_BLOCKS.OUTFIELD_SECOND,
            ]).toContain(slot.minutes);
          }
        });
      });
    });
  });

  describe('validateAllocation', () => {
    it('should return no errors for valid allocation', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
      const allocation = allocate(players);
      const errors = validateAllocation(allocation);

      expect(errors).toHaveLength(0);
    });

    it('should detect missing quarters', () => {
      const allocation = {
        quarters: [
          {
            quarter: 1 as const,
            slots: [
              { player: 'P1', position: 'GK' as const, minutes: 10 as const },
            ],
          },
        ],
        summary: { P1: 10 },
      };

      const errors = validateAllocation(allocation);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Expected 4 quarters');
    });
  });

  describe('calculateVariance', () => {
    it('should calculate variance correctly', () => {
      const allocation = {
        quarters: [],
        summary: {
          P1: 30,
          P2: 35,
          P3: 25,
        },
      };

      const stats = calculateVariance(allocation);

      expect(stats.min).toBe(25);
      expect(stats.max).toBe(35);
      expect(stats.variance).toBe(10);
      expect(stats.mean).toBe(30);
    });

    it('should handle equal distribution', () => {
      const allocation = {
        quarters: [],
        summary: {
          P1: 30,
          P2: 30,
          P3: 30,
        },
      };

      const stats = calculateVariance(allocation);

      expect(stats.variance).toBe(0);
    });
  });

  describe('allocate with manual GKs', () => {
    it('should use manual GK assignments', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
      const manualGKs: [string, string, string, string] = ['P1', 'P2', 'P3', 'P4'];
      const allocation = allocate(players, manualGKs);

      expect(allocation.quarters[0]!.slots.find((s) => s.position === 'GK')!.player).toBe('P1');
      expect(allocation.quarters[1]!.slots.find((s) => s.position === 'GK')!.player).toBe('P2');
      expect(allocation.quarters[2]!.slots.find((s) => s.position === 'GK')!.player).toBe('P3');
      expect(allocation.quarters[3]!.slots.find((s) => s.position === 'GK')!.player).toBe('P4');
    });

    it('should throw error if manual GK is not in player list', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5'];
      const manualGKs: [string, string, string, string] = ['P1', 'P2', 'P3', 'P6'];

      expect(() => allocate(players, manualGKs)).toThrow(
        'Manual GK for Q4 (P6) is not in the player list'
      );
    });

    it('should allow same player as GK multiple times', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5'];
      const manualGKs: [string, string, string, string] = ['P1', 'P1', 'P1', 'P1'];
      const allocation = allocate(players, manualGKs);

      expect(allocation.quarters[0]!.slots.find((s) => s.position === 'GK')!.player).toBe('P1');
      expect(allocation.quarters[1]!.slots.find((s) => s.position === 'GK')!.player).toBe('P1');
      expect(allocation.quarters[2]!.slots.find((s) => s.position === 'GK')!.player).toBe('P1');
      expect(allocation.quarters[3]!.slots.find((s) => s.position === 'GK')!.player).toBe('P1');
    });
  });

  describe('swapPositions', () => {
    it('should swap players between two outfield slots with same minutes', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
      const allocation = allocate(players);

      // Find two outfield slots in the same quarter with same minutes
      const quarter = allocation.quarters[0]!;
      const firstWaveSlots = quarter.slots
        .map((s, index) => ({ slot: s, index }))
        .filter((s) => s.slot.wave === 'first');

      const defSlot = firstWaveSlots.find((s) => s.slot.position === 'DEF');
      const attSlot = firstWaveSlots.find((s) => s.slot.position === 'ATT');

      if (defSlot && attSlot) {
        const originalDefPlayer = defSlot.slot.player;
        const originalAttPlayer = attSlot.slot.player;

        const updatedAllocation = swapPositions(allocation, 1, defSlot.index, attSlot.index);

        // Players should be swapped
        expect(updatedAllocation.quarters[0]!.slots[defSlot.index]!.player).toBe(originalAttPlayer);
        expect(updatedAllocation.quarters[0]!.slots[attSlot.index]!.player).toBe(originalDefPlayer);

        // Positions should stay the same (players take on the slot's position)
        expect(updatedAllocation.quarters[0]!.slots[defSlot.index]!.position).toBe('DEF');
        expect(updatedAllocation.quarters[0]!.slots[attSlot.index]!.position).toBe('ATT');

        // Summary should be unchanged (same minutes)
        expect(updatedAllocation.summary).toEqual(allocation.summary);
      }
    });

    it('should swap players between waves with matching minutes and keep totals stable', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const allocation = allocate(players);

      const firstWaveIndex = allocation.quarters[0]!.slots.findIndex(
        (s) => s.wave === 'first' && s.position === 'DEF'
      );
      const secondWaveIndex = allocation.quarters[0]!.slots.findIndex(
        (s) => s.wave === 'second' && s.position === 'DEF'
      );

      expect(firstWaveIndex).toBeGreaterThan(-1);
      expect(secondWaveIndex).toBeGreaterThan(-1);

      const firstWavePlayer = allocation.quarters[0]!.slots[firstWaveIndex]!.player;
      const secondWavePlayer = allocation.quarters[0]!.slots[secondWaveIndex]!.player;

      const updatedAllocation = swapPositions(allocation, 1, firstWaveIndex, secondWaveIndex);

      expect(updatedAllocation.quarters[0]!.slots[firstWaveIndex]!.player).toBe(secondWavePlayer);
      expect(updatedAllocation.quarters[0]!.slots[secondWaveIndex]!.player).toBe(firstWavePlayer);
      expect(updatedAllocation.summary).toEqual(allocation.summary);
    });

    it('should throw error when swapping GK position', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5'];
      const allocation = allocate(players);

      const gkIndex = allocation.quarters[0]!.slots.findIndex((s) => s.position === 'GK');
      const outfieldIndex = allocation.quarters[0]!.slots.findIndex(
        (s) => s.position === 'DEF'
      );

      expect(() => swapPositions(allocation, 1, gkIndex, outfieldIndex)).toThrow(
        'Cannot swap GK positions'
      );
    });

    it('should keep variance within limits across repeated swaps', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5'];
      const allocation = allocate(players);

      const firstWaveIndex = allocation.quarters[0]!.slots.findIndex(
        (s) => s.wave === 'first' && s.position === 'DEF'
      );
      const secondWaveIndex = allocation.quarters[0]!.slots.findIndex(
        (s) => s.wave === 'second' && s.position === 'DEF'
      );

      expect(firstWaveIndex).toBeGreaterThan(-1);
    expect(secondWaveIndex).toBeGreaterThan(-1);

      const baseStats = calculateVariance(allocation);
      const allowedVariance = Math.max(CONFIG.RULES.MAX_MINUTE_VARIANCE, baseStats.variance);

      let tempAllocation = allocation;
      for (let i = 0; i < 10; i++) {
        tempAllocation = swapPositions(tempAllocation, 1, firstWaveIndex, secondWaveIndex);
      }

      const stats = calculateVariance(tempAllocation);
      expect(stats.variance).toBeLessThanOrEqual(allowedVariance);
    });

    it('should enforce variance constraint on allocation', () => {
      // Test with various player counts
      // Note: With successive sub constraint, some player counts may need slightly higher variance
      const testCases = [5, 7, 8, 10, 12, 15];

      testCases.forEach((count) => {
        const players = Array.from({ length: count }, (_, i) => `P${i + 1}`);
        const allocation = allocate(players);
        expectFairnessRespectingWarnings(allocation);
      });
    });
  });

  describe('swapWithSub', () => {
    it('should swap a playing player with a substitute', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const allocation = allocate(players);

      // Find a substitute in Q1
      const quarter = allocation.quarters[0]!;
      const playingPlayers = quarter.slots.map((s) => s.player);
      const subs = players.filter((p) => !playingPlayers.includes(p));

      if (subs.length > 0) {
        const sub = subs[0]!;
        const outfieldSlotIndex = quarter.slots.findIndex((s) => s.position !== 'GK');
        const originalPlayer = quarter.slots[outfieldSlotIndex]!.player;
        const originalPosition = quarter.slots[outfieldSlotIndex]!.position;
        const originalMinutes = quarter.slots[outfieldSlotIndex]!.minutes;

        const updatedAllocation = swapWithSub(allocation, 1, outfieldSlotIndex, sub, players);

        // Sub should now be playing in that slot
        expect(updatedAllocation.quarters[0]!.slots[outfieldSlotIndex]!.player).toBe(sub);
        expect(updatedAllocation.quarters[0]!.slots[outfieldSlotIndex]!.position).toBe(originalPosition);
        expect(updatedAllocation.quarters[0]!.slots[outfieldSlotIndex]!.minutes).toBe(originalMinutes);

        // Original player should have 0 minutes now (became sub)
        expect(updatedAllocation.summary[originalPlayer]).toBeLessThan(allocation.summary[originalPlayer]!);
        // Sub should have gained minutes
        expect(updatedAllocation.summary[sub]).toBe(originalMinutes);
      }
    });

    it('should throw error when swapping GK with sub', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
      const allocation = allocate(players);

      const quarter = allocation.quarters[0]!;
      const playingPlayers = quarter.slots.map((s) => s.player);
      const subs = players.filter((p) => !playingPlayers.includes(p));
      const gkIndex = quarter.slots.findIndex((s) => s.position === 'GK');

      if (subs.length > 0) {
        expect(() => swapWithSub(allocation, 1, gkIndex, subs[0]!, players)).toThrow(
          'Cannot swap GK with substitute'
        );
      }
    });

    it('should enforce variance constraint when swapping with sub', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5'];
      const allocation = allocate(players);

      const quarter = allocation.quarters[0]!;
      const playingPlayers = quarter.slots.map((s) => s.player);
      const subs = players.filter((p) => !playingPlayers.includes(p));

      if (subs.length > 0) {
        const outfieldSlotIndex = quarter.slots.findIndex((s) => s.position !== 'GK');

        try {
          const updatedAllocation = swapWithSub(allocation, 1, outfieldSlotIndex, subs[0]!, players);
          const stats = calculateVariance(updatedAllocation);
          const baseStats = calculateVariance(allocation);
          const allowedVariance = Math.max(CONFIG.RULES.MAX_MINUTE_VARIANCE, baseStats.variance);
          expect(stats.variance).toBeLessThanOrEqual(allowedVariance);
        } catch (err) {
          // If it throws variance error, that's also valid
          if (err instanceof Error && err.message.includes('variance')) {
            expect(err.message).toContain('variance');
          } else {
            throw err;
          }
        }
      }
    });

    it('should update substitutes list when swapping with a sub', () => {
      const players = Array.from({ length: 10 }, (_, i) => `P${i + 1}`);
      const allocation = allocate(players);

      const quarterEntry = allocation.quarters.find((qtr) => {
        const subs = getSubsForQuarter(allocation, qtr.quarter, players);
        return subs.length > 0;
      });

      expect(quarterEntry).toBeDefined();
      if (!quarterEntry) return;

      const quarterNumber: Quarter = quarterEntry.quarter;
      const subsBefore = getSubsForQuarter(allocation, quarterNumber, players);
      const quarter = quarterEntry;

      const sub = subsBefore[0]!;
      const playingIndex = quarter.slots.findIndex((slot) => slot.position !== 'GK');
      const playingPlayer = quarter.slots[playingIndex]!.player;

      const updatedAllocation = swapWithSub(allocation, quarterNumber, playingIndex, sub, players);
      const subsAfter = getSubsForQuarter(updatedAllocation, quarterNumber, players);

      expect(subsAfter).toContain(playingPlayer);
      expect(subsAfter).not.toContain(sub);
    });
  });

  describe('allocate with custom sub points', () => {
    it('should use per-quarter sub points for wave durations', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const subPoints = [7, 3, 6, 4];
      const allocation = allocate(players, undefined, subPoints);

      expect(allocation.subPoints).toEqual(subPoints);

      allocation.quarters.forEach((q, i) => {
        const expectedFirst = subPoints[i]!;
        const expectedSecond = CONFIG.QUARTER_DURATION - expectedFirst;

        q.slots.forEach((slot) => {
          if (slot.position === 'GK') {
            expect(slot.minutes).toBe(CONFIG.TIME_BLOCKS.GK_FULL);
          } else if (slot.wave === 'first') {
            expect(slot.minutes).toBe(expectedFirst);
          } else if (slot.wave === 'second') {
            expect(slot.minutes).toBe(expectedSecond);
          }
        });
      });
    });

    it('should produce correct total minutes with asymmetric sub points', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const subPoints = [7, 7, 7, 7];
      const allocation = allocate(players, undefined, subPoints);

      const totalMinutes = Object.values(allocation.summary).reduce(
        (sum, minutes) => sum + minutes,
        0
      );
      const expectedTotalMinutes = CONFIG.QUARTERS * CONFIG.QUARTER_DURATION * 5;
      expect(totalMinutes).toBe(expectedTotalMinutes);
    });

    it('should handle extreme sub points (1/9 split)', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const subPoints = [1, 1, 1, 1];
      const allocation = allocate(players, undefined, subPoints);

      allocation.quarters.forEach((q) => {
        q.slots.filter((s) => s.wave === 'first').forEach((s) => {
          expect(s.minutes).toBe(1);
        });
        q.slots.filter((s) => s.wave === 'second').forEach((s) => {
          expect(s.minutes).toBe(9);
        });
      });
    });

    it('should handle extreme sub points (9/1 split)', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const subPoints = [9, 9, 9, 9];
      const allocation = allocate(players, undefined, subPoints);

      allocation.quarters.forEach((q) => {
        q.slots.filter((s) => s.wave === 'first').forEach((s) => {
          expect(s.minutes).toBe(9);
        });
        q.slots.filter((s) => s.wave === 'second').forEach((s) => {
          expect(s.minutes).toBe(1);
        });
      });
    });

    it('should default to 5/5 split when subPoints not provided', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const allocation = allocate(players);

      allocation.quarters.forEach((q) => {
        q.slots.filter((s) => s.wave === 'first').forEach((s) => {
          expect(s.minutes).toBe(5);
        });
        q.slots.filter((s) => s.wave === 'second').forEach((s) => {
          expect(s.minutes).toBe(5);
        });
      });
    });

    it('should allow different sub points per quarter', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const subPoints = [3, 5, 7, 9];
      const allocation = allocate(players, undefined, subPoints);

      expect(allocation.quarters[0]!.slots.find((s) => s.wave === 'first')!.minutes).toBe(3);
      expect(allocation.quarters[1]!.slots.find((s) => s.wave === 'first')!.minutes).toBe(5);
      expect(allocation.quarters[2]!.slots.find((s) => s.wave === 'first')!.minutes).toBe(7);
      expect(allocation.quarters[3]!.slots.find((s) => s.wave === 'first')!.minutes).toBe(9);
    });

    it('should pass validation with asymmetric sub points', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];
      const subPoints = [7, 3, 7, 3];
      const allocation = allocate(players, undefined, subPoints);

      const errors = validateAllocation(allocation);
      expect(errors).toHaveLength(0);
    });

    it('should work with manual GKs and sub points combined', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
      const manualGKs: [string, string, string, string] = ['P1', 'P2', 'P3', 'P4'];
      const subPoints = [7, 3, 6, 4];
      const allocation = allocate(players, manualGKs, subPoints);

      expect(allocation.quarters[0]!.slots.find((s) => s.position === 'GK')!.player).toBe('P1');
      expect(allocation.quarters[0]!.slots.find((s) => s.wave === 'first')!.minutes).toBe(7);
      expect(allocation.subPoints).toEqual(subPoints);
    });
  });

  describe('successive substitutes constraint', () => {
    it('should not allow players to be sub for two consecutive quarters', () => {
      // Test with various player counts
      const testCases = [6, 7, 8, 9, 10];

      testCases.forEach((count) => {
        const players = Array.from({ length: count }, (_, i) => `P${i + 1}`);
        const allocation = allocate(players);

        // Check each player
        players.forEach((player) => {
          let consecutiveSubs = 0;

          for (let q = 1; q <= 4; q++) {
            const quarter = allocation.quarters.find((qtr) => qtr.quarter === q);
            if (!quarter) continue;

            const isPlaying = quarter.slots.some((s) => s.player === player);

            if (!isPlaying) {
              consecutiveSubs++;
              expect(consecutiveSubs).toBeLessThan(2);
            } else {
              consecutiveSubs = 0;
            }
          }
        });
      });
    });
  });

  describe('allocate with quarter modes', () => {
    it('should produce 5 slots (1 GK + 4 outfield) for full-mode quarters', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const quarterModes: QuarterMode[] = ['full', 'split', 'full', 'split'];
      const allocation = allocate(players, undefined, undefined, quarterModes);

      // Full quarters: 5 slots (1 GK + 2 DEF + 2 ATT)
      expect(allocation.quarters[0]!.slots).toHaveLength(5);
      expect(allocation.quarters[2]!.slots).toHaveLength(5);

      // Split quarters: 9 slots (1 GK + 4 DEF + 4 ATT)
      expect(allocation.quarters[1]!.slots).toHaveLength(9);
      expect(allocation.quarters[3]!.slots).toHaveLength(9);
    });

    it('should give outfield players full 10 minutes in full-mode quarters', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const quarterModes: QuarterMode[] = ['full', 'full', 'full', 'full'];
      const allocation = allocate(players, undefined, undefined, quarterModes);

      allocation.quarters.forEach((q) => {
        q.slots.forEach((slot) => {
          expect(slot.minutes).toBe(CONFIG.QUARTER_DURATION);
        });
      });
    });

    it('should not assign wave property to outfield slots in full-mode quarters', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const quarterModes: QuarterMode[] = ['full', 'full', 'full', 'full'];
      const allocation = allocate(players, undefined, undefined, quarterModes);

      allocation.quarters.forEach((q) => {
        q.slots.forEach((slot) => {
          expect(slot.wave).toBeUndefined();
        });
      });
    });

    it('should produce correct total minutes with all-full quarters', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const quarterModes: QuarterMode[] = ['full', 'full', 'full', 'full'];
      const allocation = allocate(players, undefined, undefined, quarterModes);

      const totalMinutes = Object.values(allocation.summary).reduce(
        (sum, minutes) => sum + minutes,
        0
      );
      const expectedTotalMinutes = CONFIG.QUARTERS * CONFIG.QUARTER_DURATION * 5;
      expect(totalMinutes).toBe(expectedTotalMinutes);
    });

    it('should produce correct total minutes with mixed modes', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const quarterModes: QuarterMode[] = ['full', 'split', 'full', 'split'];
      const allocation = allocate(players, undefined, undefined, quarterModes);

      const totalMinutes = Object.values(allocation.summary).reduce(
        (sum, minutes) => sum + minutes,
        0
      );
      const expectedTotalMinutes = CONFIG.QUARTERS * CONFIG.QUARTER_DURATION * 5;
      expect(totalMinutes).toBe(expectedTotalMinutes);
    });

    it('should pass validation with full-mode quarters', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const quarterModes: QuarterMode[] = ['full', 'full', 'full', 'full'];
      const allocation = allocate(players, undefined, undefined, quarterModes);

      const errors = validateAllocation(allocation);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with mixed modes', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
      const quarterModes: QuarterMode[] = ['full', 'split', 'split', 'full'];
      const allocation = allocate(players, undefined, undefined, quarterModes);

      const errors = validateAllocation(allocation);
      expect(errors).toHaveLength(0);
    });

    it('should store quarterModes on the allocation', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const quarterModes: QuarterMode[] = ['full', 'split', 'full', 'split'];
      const allocation = allocate(players, undefined, undefined, quarterModes);

      expect(allocation.quarterModes).toEqual(quarterModes);
    });

    it('should work with manual GKs and full-mode quarters', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
      const manualGKs: [string, string, string, string] = ['P1', 'P2', 'P3', 'P4'];
      const quarterModes: QuarterMode[] = ['full', 'full', 'split', 'split'];
      const allocation = allocate(players, manualGKs, undefined, quarterModes);

      expect(allocation.quarters[0]!.slots.find((s) => s.position === 'GK')!.player).toBe('P1');
      expect(allocation.quarters[0]!.slots).toHaveLength(5);
      expect(allocation.quarters[2]!.slots.find((s) => s.position === 'GK')!.player).toBe('P3');
      expect(allocation.quarters[2]!.slots).toHaveLength(9);
    });

    it('should default to split mode when quarterModes not provided', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const allocation = allocate(players);

      // All quarters should have 9 slots (split mode default)
      allocation.quarters.forEach((q) => {
        expect(q.slots).toHaveLength(9);
      });
    });

    it('should show "10" in player breakdown for full-mode quarters', () => {
      const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
      const quarterModes: QuarterMode[] = ['full', 'split', 'full', 'split'];
      const allocation = allocate(players, undefined, undefined, quarterModes);

      // Find an outfield player in Q1 (full mode)
      const q1Outfield = allocation.quarters[0]!.slots.find((s) => s.position !== 'GK');
      expect(q1Outfield).toBeDefined();

      const breakdown = getPlayerQuarterBreakdown(allocation, q1Outfield!.player, players);
      // Q1 is full mode — player has one 10-min slot, so breakdown should show "10"
      expect(breakdown[0]).toBe('10');
    });
  });

  describe('validateAllocation full-mode structural checks', () => {
    const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
    const fullModes: QuarterMode[] = ['full', 'full', 'full', 'full'];

    it('rejects full-mode quarter with wave properties on outfield slots', () => {
      const allocation = allocate(players, undefined, undefined, fullModes);
      // Corrupt Q1: add wave to an outfield slot
      const outfield = allocation.quarters[0]!.slots.find((s) => s.position !== 'GK');
      outfield!.wave = 'first';
      const errors = validateAllocation(allocation);
      expect(errors.some((e) => e.includes('wave property'))).toBe(true);
    });

    it('rejects full-mode quarter with wrong minutes', () => {
      const allocation = allocate(players, undefined, undefined, fullModes);
      // Corrupt Q1: set an outfield slot to 5 minutes
      const outfield = allocation.quarters[0]!.slots.find((s) => s.position !== 'GK');
      outfield!.minutes = 5;
      const errors = validateAllocation(allocation);
      expect(errors.some((e) => e.includes('not set to 10 minutes'))).toBe(true);
    });

    it('rejects full-mode quarter with wrong slot count', () => {
      const allocation = allocate(players, undefined, undefined, fullModes);
      // Corrupt Q1: add extra slot
      allocation.quarters[0]!.slots.push({ player: 'Extra', position: 'DEF', minutes: 10 });
      const errors = validateAllocation(allocation);
      expect(errors.some((e) => e.includes('Expected 5 slots'))).toBe(true);
    });

    it('passes validation for correctly formed full-mode quarter', () => {
      const allocation = allocate(players, undefined, undefined, fullModes);
      const errors = validateAllocation(allocation);
      expect(errors).toEqual([]);
    });
  });
});
