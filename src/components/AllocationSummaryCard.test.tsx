import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
import { AllocationSummaryCard } from './AllocationSummaryCard';
import type { Allocation } from '../lib/types';
import { CONFIG } from '../config/constants';

const buildAllocation = (overrides: Partial<Allocation> = {}): Allocation => ({
  quarters: [],
  summary: {
    Alex: CONFIG.TIME_BLOCKS.GK_FULL * 2,
    Blake: CONFIG.TIME_BLOCKS.GK_FULL * 2,
    Casey: CONFIG.TIME_BLOCKS.OUTFIELD_FIRST * 2,
    Devin: CONFIG.TIME_BLOCKS.OUTFIELD_FIRST,
  },
  warnings: [],
  ...overrides,
});

describe('AllocationSummaryCard', () => {
  it('shows placeholder when no allocation and no selected players', () => {
    render(<AllocationSummaryCard allocation={null} selectedPlayers={[]} />);
    expect(screen.getByText('Matchday Overview')).toBeInTheDocument();
    expect(screen.getByText(/No allocation yet/i)).toBeInTheDocument();
  });

  it('lists selected players when allocation is pending', () => {
    render(
      <AllocationSummaryCard allocation={null} selectedPlayers={['Alex', 'Blake', 'Casey']} />
    );
    expect(
      screen.getByText((content) => content.startsWith('3 players selected.'), {
        selector: 'p',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('Blake')).toBeInTheDocument();
    expect(screen.getByText('Casey')).toBeInTheDocument();
  });

  it('summarises allocation stats and warnings', () => {
    const allocation: Allocation = buildAllocation({
      summary: { Alex: 30, Blake: 25, Casey: 20, Devin: 15 },
      warnings: ['Variance exceeds target'],
    });

    render(<AllocationSummaryCard allocation={allocation} selectedPlayers={[]} />);

    expect(screen.getByText('Fairness review needed')).toBeInTheDocument();
    expect(screen.getByText(/Δ 15 \/ target/i)).toBeInTheDocument();
    expect(screen.getByText('Variance exceeds target')).toBeInTheDocument();
    expect(screen.getAllByText('Alex').length).toBeGreaterThan(0);
    expect(screen.getAllByText('30 min').length).toBeGreaterThan(0);
  });
});
