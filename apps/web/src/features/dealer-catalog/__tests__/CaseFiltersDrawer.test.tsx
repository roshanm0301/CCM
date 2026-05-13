/**
 * CaseFiltersDrawer — unit tests.
 *
 * Covered scenarios:
 * 1. Reset clears pending state only — filter field shows empty, onApply NOT called, drawer still open
 * 2. Close before Apply discards pending — onApply NOT called; re-open shows original appliedFilters
 * 3. Apply calls onApply with pending filters and calls onClose
 * 4. Date range validation — dateFrom after dateTo → error shown, onApply NOT called
 * 5. Activity status filter is bound to activityStatus field (not productType)
 * 6. Department multi-select — two departments selected → onApply called with both
 *
 * Source: CCM_Phase6_Resolution_Activities.md § Dealer Catalog View
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CaseFiltersDrawer } from '../CaseFiltersDrawer';
import type { DealerCatalogFilters } from '../dealerCatalogApi';

// ---------------------------------------------------------------------------
// Mock caseCategoryApi — CaseFiltersDrawer uses useQuery to fetch categories
// ---------------------------------------------------------------------------

vi.mock('@/features/case-category/caseCategoryApi', () => ({
  fetchCategories: vi.fn().mockResolvedValue([]),
  fetchCategory: vi.fn().mockResolvedValue(null),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Open the MUI Select identified by its label text, wait for the listbox to
 * appear, then click the menu item matching `optionText`.
 *
 * MUI Select renders its popup into a portal outside the Drawer Paper, so we
 * query the listbox from `document.body` after opening.
 */
function selectOption(labelText: string, optionText: string) {
  // Find the labelled combobox / select trigger element
  const combobox = screen.getByRole('combobox', { name: labelText });
  fireEvent.mouseDown(combobox);

  // The listbox is portalled into document.body — query from there
  const listbox = document.body.querySelector('[role="listbox"]');
  if (!listbox) throw new Error(`Listbox not found after opening "${labelText}"`);

  const option = within(listbox as HTMLElement).getByText(optionText);
  fireEvent.click(option);

  // Close the listbox by pressing Escape so subsequent selects open cleanly
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrap(ui: React.ReactElement, qc = makeQueryClient()) {
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

const defaultProps = {
  open: true,
  appliedFilters: {} as DealerCatalogFilters,
  onApply: vi.fn(),
  onClose: vi.fn(),
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CaseFiltersDrawer', () => {
  // -------------------------------------------------------------------------
  // 1. Reset clears pending state only
  // -------------------------------------------------------------------------

  describe('Reset button', () => {
    it('clears the pending filter value but does NOT call onApply and keeps the drawer open', () => {
      render(wrap(<CaseFiltersDrawer {...defaultProps} />));
      const fromInput = screen.getByLabelText('Registered from date');
      fireEvent.change(fromInput, { target: { value: '2026-01-01' } });
      expect((fromInput as HTMLInputElement).value).toBe('2026-01-01');

      // Click Reset
      fireEvent.click(screen.getByRole('button', { name: /reset filters/i }));

      // Pending state cleared — input returns to empty
      expect((fromInput as HTMLInputElement).value).toBe('');

      // onApply must NOT have been called
      expect(defaultProps.onApply).not.toHaveBeenCalled();

      // Drawer is still open — the Apply button should still be visible
      expect(screen.getByRole('button', { name: /apply filters/i })).toBeInTheDocument();

      // onClose must NOT have been called
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Close before Apply discards pending state
  // -------------------------------------------------------------------------

  describe('Close (X) button', () => {
    it('does NOT call onApply when closed before Apply', () => {
      render(wrap(<CaseFiltersDrawer
          {...defaultProps}
          appliedFilters={{ caseNature: 'Complaint' }}
        />));

      // Change the "Registered From" date so pending state differs from appliedFilters
      const fromInput = screen.getByLabelText('Registered from date');
      fireEvent.change(fromInput, { target: { value: '2026-03-01' } });

      // Click X close button
      fireEvent.click(screen.getByRole('button', { name: /close filters/i }));

      // onApply must NOT have been called
      expect(defaultProps.onApply).not.toHaveBeenCalled();

      // onClose must have been called
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('re-opening the drawer shows the original appliedFilters (pending changes are discarded)', () => {
      const appliedFilters: DealerCatalogFilters = { dateFrom: '2026-01-15' };

      const qc = makeQueryClient();
      const { rerender } = render(wrap(
        <CaseFiltersDrawer {...defaultProps} appliedFilters={appliedFilters} open={true} />,
        qc,
      ));

      // Mutate the pending dateFrom
      const fromInput = screen.getByLabelText('Registered from date');
      expect((fromInput as HTMLInputElement).value).toBe('2026-01-15');
      fireEvent.change(fromInput, { target: { value: '2026-06-01' } });
      expect((fromInput as HTMLInputElement).value).toBe('2026-06-01');

      // Close the drawer (simulate closing)
      fireEvent.click(screen.getByRole('button', { name: /close filters/i }));

      // Re-open: pass open=false then open=true to trigger the useEffect re-sync
      rerender(wrap(
        <CaseFiltersDrawer {...defaultProps} appliedFilters={appliedFilters} open={false} />,
        qc,
      ));
      rerender(wrap(
        <CaseFiltersDrawer {...defaultProps} appliedFilters={appliedFilters} open={true} />,
        qc,
      ));

      // The drawer should now show the original appliedFilters value, not the discarded pending one
      const fromInputAfterReopen = screen.getByLabelText('Registered from date');
      expect((fromInputAfterReopen as HTMLInputElement).value).toBe('2026-01-15');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Apply calls onApply with pending filters and closes the drawer
  // -------------------------------------------------------------------------

  describe('Apply button', () => {
    it('calls onApply with the current pending filters and then calls onClose', () => {
      render(wrap(<CaseFiltersDrawer {...defaultProps} />));

      // Set date filters
      const fromInput = screen.getByLabelText('Registered from date');
      const toInput = screen.getByLabelText('Registered to date');
      fireEvent.change(fromInput, { target: { value: '2026-01-01' } });
      fireEvent.change(toInput, { target: { value: '2026-03-31' } });

      // Click Apply
      fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));

      expect(defaultProps.onApply).toHaveBeenCalledTimes(1);
      expect(defaultProps.onApply).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFrom: '2026-01-01',
          dateTo: '2026-03-31',
        }),
      );

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Date range validation
  // -------------------------------------------------------------------------

  describe('Date range validation', () => {
    it('shows an error and does NOT call onApply when dateFrom is later than dateTo', () => {
      render(wrap(<CaseFiltersDrawer {...defaultProps} />));

      const fromInput = screen.getByLabelText('Registered from date');
      const toInput = screen.getByLabelText('Registered to date');

      // dateFrom AFTER dateTo — invalid range
      fireEvent.change(fromInput, { target: { value: '2026-06-01' } });
      fireEvent.change(toInput, { target: { value: '2026-01-01' } });

      fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));

      // Error message should appear
      expect(
        screen.getByText(/registered from.*must be on or before.*registered to/i),
      ).toBeInTheDocument();

      // onApply must NOT have been called
      expect(defaultProps.onApply).not.toHaveBeenCalled();

      // onClose must NOT have been called
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('clears the date error when Reset is clicked', () => {
      render(wrap(<CaseFiltersDrawer {...defaultProps} />));

      const fromInput = screen.getByLabelText('Registered from date');
      const toInput = screen.getByLabelText('Registered to date');

      fireEvent.change(fromInput, { target: { value: '2026-06-01' } });
      fireEvent.change(toInput, { target: { value: '2026-01-01' } });
      fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));

      // Error is shown
      expect(
        screen.getByText(/registered from.*must be on or before.*registered to/i),
      ).toBeInTheDocument();

      // Reset should clear the error
      fireEvent.click(screen.getByRole('button', { name: /reset filters/i }));

      expect(
        screen.queryByText(/registered from.*must be on or before.*registered to/i),
      ).not.toBeInTheDocument();
    });

    it('does NOT show an error when dateFrom equals dateTo', () => {
      render(wrap(<CaseFiltersDrawer {...defaultProps} />));

      const fromInput = screen.getByLabelText('Registered from date');
      const toInput = screen.getByLabelText('Registered to date');

      // Same date — valid (equal dates are allowed per the > check in the component)
      fireEvent.change(fromInput, { target: { value: '2026-03-15' } });
      fireEvent.change(toInput, { target: { value: '2026-03-15' } });

      fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));

      expect(
        screen.queryByText(/registered from.*must be on or before.*registered to/i),
      ).not.toBeInTheDocument();

      expect(defaultProps.onApply).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Activity Status filter is bound to activityStatus (not productType)
  // -------------------------------------------------------------------------

  describe('Activity Status filter', () => {
    it('calls onApply with activityStatus: "Fresh" when "Fresh" is selected', () => {
      render(wrap(<CaseFiltersDrawer {...defaultProps} />));

      // Open the Activity Status select (single-select) and pick "Fresh"
      // Use direct fireEvent without Escape to avoid single-select timing issues
      const actCombobox = screen.getByRole('combobox', { name: 'Activity Status' });
      fireEvent.mouseDown(actCombobox);
      const actListbox = document.body.querySelector('[role="listbox"]') as HTMLElement;
      expect(actListbox).not.toBeNull();
      fireEvent.click(within(actListbox).getByText('Fresh'));

      fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));

      expect(defaultProps.onApply).toHaveBeenCalledTimes(1);

      const callArg: DealerCatalogFilters = defaultProps.onApply.mock.calls[0][0];

      // activityStatus must be set
      expect(callArg.activityStatus).toBe('Fresh');

      // productType must NOT be set (not accidentally mapped to the wrong field)
      expect(callArg.productType).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 6. Department multi-select
  // -------------------------------------------------------------------------

  describe('Department multi-select', () => {
    it('calls onApply with both selected departments', async () => {
      render(wrap(<CaseFiltersDrawer {...defaultProps} />));

      // Open Department select and click SALES
      const deptCombobox = screen.getByRole('combobox', { name: /^department$/i });
      fireEvent.mouseDown(deptCombobox);

      const listbox = document.body.querySelector('[role="listbox"]') as HTMLElement;
      expect(listbox).not.toBeNull();

      fireEvent.click(within(listbox).getByText('SALES'));
      fireEvent.click(within(listbox).getByText('SERVICE'));

      // Close listbox
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

      fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));

      expect(defaultProps.onApply).toHaveBeenCalledTimes(1);

      const callArg: DealerCatalogFilters = defaultProps.onApply.mock.calls[0][0];
      expect(callArg.department).toEqual(expect.arrayContaining(['SALES', 'SERVICE']));
      expect(callArg.department).toHaveLength(2);
    });
  });
});
