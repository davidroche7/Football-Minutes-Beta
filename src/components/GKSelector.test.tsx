import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { GKSelector } from './GKSelector';

describe('GKSelector', () => {
  const mockPlayers = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];
  const mockOnGKsChange = vi.fn();

  beforeEach(() => {
    mockOnGKsChange.mockClear();
  });

  describe('Visibility and warnings', () => {
    it('should show warning message when fewer than 5 players', () => {
      render(
        <GKSelector
          players={['Alice', 'Bob', 'Charlie']}
          selectedGKs={null}
          onGKsChange={mockOnGKsChange}
        />
      );

      expect(screen.getByText(/Select at least 5 players to enable goalkeeper assignment/i)).toBeInTheDocument();
      expect(screen.queryByText(/Manual GK Selection/i)).not.toBeInTheDocument();
    });

    it('should render GK selector when 5+ players are available', () => {
      render(
        <GKSelector
          players={mockPlayers}
          selectedGKs={null}
          onGKsChange={mockOnGKsChange}
        />
      );

      expect(screen.getByText(/Manual GK Selection \(Optional\)/i)).toBeInTheDocument();
      expect(screen.getAllByRole('combobox')).toHaveLength(4); // 4 quarters
    });

    it('should transition from warning to selector when player count increases', () => {
      const { rerender } = render(
        <GKSelector
          players={['Alice', 'Bob']}
          selectedGKs={null}
          onGKsChange={mockOnGKsChange}
        />
      );

      expect(screen.getByText(/Select at least 5 players/i)).toBeInTheDocument();

      rerender(
        <GKSelector
          players={mockPlayers}
          selectedGKs={null}
          onGKsChange={mockOnGKsChange}
        />
      );

      expect(screen.queryByText(/Select at least 5 players/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Manual GK Selection/i)).toBeInTheDocument();
    });
  });

  describe('GK selection interaction', () => {
    it('should allow selecting a GK for each quarter', async () => {
      const user = userEvent.setup();
      render(
        <GKSelector
          players={mockPlayers}
          selectedGKs={null}
          onGKsChange={mockOnGKsChange}
        />
      );

      const quarter1Select = screen.getAllByRole('combobox')[0];
      await user.selectOptions(quarter1Select, 'Alice');

      // When no previous GKs selected, initializes with first player (Alice) for other quarters
      expect(mockOnGKsChange).toHaveBeenCalledWith(['Alice', 'Alice', 'Alice', 'Alice']);
    });

    it('should allow changing GK for a specific quarter', async () => {
      const user = userEvent.setup();
      const initialGKs: [string, string, string, string] = ['Alice', 'Bob', 'Charlie', 'David'];

      render(
        <GKSelector
          players={mockPlayers}
          selectedGKs={initialGKs}
          onGKsChange={mockOnGKsChange}
        />
      );

      const quarter2Select = screen.getAllByRole('combobox')[1];
      await user.selectOptions(quarter2Select, 'Eve');

      expect(mockOnGKsChange).toHaveBeenCalledWith(['Alice', 'Eve', 'Charlie', 'David']);
    });

    it('should allow setting a quarter back to Auto', async () => {
      const user = userEvent.setup();
      const initialGKs: [string, string, string, string] = ['Alice', 'Bob', 'Charlie', 'David'];

      render(
        <GKSelector
          players={mockPlayers}
          selectedGKs={initialGKs}
          onGKsChange={mockOnGKsChange}
        />
      );

      const quarter3Select = screen.getAllByRole('combobox')[2];
      await user.selectOptions(quarter3Select, '');

      expect(mockOnGKsChange).toHaveBeenCalledWith(['Alice', 'Bob', '', 'David']);
    });

    it('should initialize with first player when selecting for the first time', async () => {
      const user = userEvent.setup();
      render(
        <GKSelector
          players={mockPlayers}
          selectedGKs={null}
          onGKsChange={mockOnGKsChange}
        />
      );

      const quarter1Select = screen.getAllByRole('combobox')[0];
      await user.selectOptions(quarter1Select, 'Charlie');

      // When no GKs selected, should initialize array with first player for unselected quarters
      // This is the current behavior: lines 14-19 in GKSelector.tsx
      expect(mockOnGKsChange).toHaveBeenCalledWith(['Charlie', 'Alice', 'Alice', 'Alice']);
    });
  });

  describe('Clear GK selection', () => {
    it('should not show clear button when no GKs are selected', () => {
      render(
        <GKSelector
          players={mockPlayers}
          selectedGKs={null}
          onGKsChange={mockOnGKsChange}
        />
      );

      expect(screen.queryByText(/Clear GK Selection/i)).not.toBeInTheDocument();
    });

    it('should show clear button when GKs are selected', () => {
      const initialGKs: [string, string, string, string] = ['Alice', 'Bob', 'Charlie', 'David'];

      render(
        <GKSelector
          players={mockPlayers}
          selectedGKs={initialGKs}
          onGKsChange={mockOnGKsChange}
        />
      );

      expect(screen.getByText(/Clear GK Selection/i)).toBeInTheDocument();
    });

    it('should clear all GK selections when clear button is clicked', async () => {
      const user = userEvent.setup();
      const initialGKs: [string, string, string, string] = ['Alice', 'Bob', 'Charlie', 'David'];

      render(
        <GKSelector
          players={mockPlayers}
          selectedGKs={initialGKs}
          onGKsChange={mockOnGKsChange}
        />
      );

      const clearButton = screen.getByText(/Clear GK Selection/i);
      await user.click(clearButton);

      expect(mockOnGKsChange).toHaveBeenCalledWith(null);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA label on clear button', () => {
      const initialGKs: [string, string, string, string] = ['Alice', 'Bob', 'Charlie', 'David'];

      render(
        <GKSelector
          players={mockPlayers}
          selectedGKs={initialGKs}
          onGKsChange={mockOnGKsChange}
        />
      );

      const clearButton = screen.getByLabelText(/Clear all manual GK selections/i);
      expect(clearButton).toBeInTheDocument();
    });

    it('should label each quarter selector', () => {
      render(
        <GKSelector
          players={mockPlayers}
          selectedGKs={null}
          onGKsChange={mockOnGKsChange}
        />
      );

      expect(screen.getByText('Quarter 1')).toBeInTheDocument();
      expect(screen.getByText('Quarter 2')).toBeInTheDocument();
      expect(screen.getByText('Quarter 3')).toBeInTheDocument();
      expect(screen.getByText('Quarter 4')).toBeInTheDocument();
    });

    it('should have Auto option for each quarter', () => {
      render(
        <GKSelector
          players={mockPlayers}
          selectedGKs={null}
          onGKsChange={mockOnGKsChange}
        />
      );

      const selects = screen.getAllByRole('combobox');
      selects.forEach((select) => {
        expect(select).toContainHTML('<option value="">Auto</option>');
      });
    });

    it('should display all available players in each dropdown', () => {
      render(
        <GKSelector
          players={mockPlayers}
          selectedGKs={null}
          onGKsChange={mockOnGKsChange}
        />
      );

      const firstSelect = screen.getAllByRole('combobox')[0];
      mockPlayers.forEach((player) => {
        expect(firstSelect).toContainHTML(`<option`);
        expect(firstSelect.textContent).toContain(player);
      });
    });
  });

  describe('State persistence', () => {
    it('should preserve existing GK selections when displayed', () => {
      const initialGKs: [string, string, string, string] = ['Alice', 'Bob', 'Charlie', 'David'];

      render(
        <GKSelector
          players={mockPlayers}
          selectedGKs={initialGKs}
          onGKsChange={mockOnGKsChange}
        />
      );

      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      expect(selects[0].value).toBe('Alice');
      expect(selects[1].value).toBe('Bob');
      expect(selects[2].value).toBe('Charlie');
      expect(selects[3].value).toBe('David');
    });

    it('should handle partial GK selections (some Auto, some selected)', () => {
      const partialGKs: [string, string, string, string] = ['Alice', '', 'Charlie', ''];

      render(
        <GKSelector
          players={mockPlayers}
          selectedGKs={partialGKs}
          onGKsChange={mockOnGKsChange}
        />
      );

      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      expect(selects[0].value).toBe('Alice');
      expect(selects[1].value).toBe('');
      expect(selects[2].value).toBe('Charlie');
      expect(selects[3].value).toBe('');
    });
  });
});
