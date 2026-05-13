/**
 * SearchPanel — typeahead suggestion tests.
 *
 * Covers the debounced POST /api/v1/search typeahead flow added in the
 * Phase 1 UI redesign wave.
 *
 * Scenarios:
 * 1. Suggestions Popper does not open when input is < 3 characters
 * 2. Suggestions Popper does not open when no text is typed
 * 3. Suggestions appear after >= 3 chars with a filter selected (mock API returns results)
 * 4. Clicking a suggestion fills the input with the correct value
 * 5. When the API returns an empty result set the Popper stays closed
 * 6. Suggestions clear when the filter is changed
 * 7. Suggestions Popper does not open when API call throws
 * 8. Debounce: API is NOT called before the 300 ms window elapses
 *
 * Source: SearchPanel.tsx §typeahead useEffect, §handleSuggestionSelect,
 *         §handleFilterChange
 *
 * Implementation note — why fireEvent.change instead of userEvent.type:
 *   vi.useFakeTimers() replaces globalThis.setTimeout.  userEvent.type() in
 *   v14 internally awaits a zero-delay setTimeout even with { delay: null }.
 *   Under fake timers that setTimeout never fires, causing the test to hang
 *   until the 5 s vitest timeout.  fireEvent.change() is fully synchronous,
 *   so it is safe to use inside act() while fake timers are active.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock apiClient before importing the component under test
// ---------------------------------------------------------------------------
vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock useInteractionStore to supply a valid interactionId
// SearchPanel also calls useInteractionStore.getState() directly for a one-shot
// read of ctiFromNumber; both the hook and getState must be mocked.
// ---------------------------------------------------------------------------
vi.mock('@/features/interaction/interactionStore', () => ({
  useInteractionStore: Object.assign(
    vi.fn(),
    {
      getState: vi.fn(() => ({ ctiFromNumber: null, searchResults: [] })),
    },
  ),
}));

// ---------------------------------------------------------------------------
// Mock SearchResults so we don't pull in its full dependency tree
// ---------------------------------------------------------------------------
vi.mock('../SearchResults', () => ({
  SearchResults: () => <div data-testid="search-results" />,
}));

import { apiClient } from '@/shared/api/client';
import { useInteractionStore } from '@/features/interaction/interactionStore';
import { SearchPanel } from '../SearchPanel';
import type { SearchResultItem } from '@/features/interaction/interactionStore';

// ---------------------------------------------------------------------------
// Typed cast helpers
// ---------------------------------------------------------------------------
const mockPost = apiClient.post as ReturnType<typeof vi.fn>;
const mockUseInteractionStore = useInteractionStore as unknown as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const STORE_MOCK = {
  interactionId: 'ia-test-001',
  searchResults: [],
  setSearchResults: vi.fn(),
};

const SUGGESTION_ITEM: SearchResultItem = {
  customerRef: 'C-001',
  customerName: 'Ravi Kumar',
  primaryMobile: '9876543210',
  email: 'ravi@example.com',
  vehicles: [
    {
      vehicleRef: 'V-001',
      registrationNumber: 'MH12AB1234',
      modelName: 'Activa 6G',
      variant: 'DLX',
      dealerRef: 'DLR-001',
    },
  ],
  sourceSystem: 'INSTALL_BASE',
};

function makeSearchResponse(results: SearchResultItem[]) {
  return {
    data: {
      success: true,
      data: {
        interactionId: 'ia-test-001',
        searchAttemptId: 'sa-001',
        filter: 'MOBILE',
        normalizedValue: '9876543210',
        results,
        resultCount: results.length,
        primarySourceUsed: 'INSTALL_BASE',
        fallbackSourceUsed: false,
        outcomeStatus: results.length > 0 ? 'RESULTS_FOUND' : 'NO_RESULTS',
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: change the Autocomplete input value synchronously.
//
// fireEvent.change is used instead of userEvent.type because userEvent
// deadlocks under vi.useFakeTimers() (see module docstring).
// ---------------------------------------------------------------------------
function typeIntoSearchInput(value: string) {
  const input = document.querySelector('input[name="custume-auto"]') as HTMLInputElement;
  act(() => {
    fireEvent.change(input, { target: { value } });
  });
  return input;
}

// ---------------------------------------------------------------------------
// Helper: advance the debounce clock and flush the resulting Promise chain.
// ---------------------------------------------------------------------------
async function advanceDebounce(ms = 300) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SearchPanel — typeahead suggestions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockUseInteractionStore.mockReturnValue({ ...STORE_MOCK });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // 1. Input < 3 chars — debounce fires but component guard skips API call
  // -------------------------------------------------------------------------
  it('does not open the suggestions Popper when input is fewer than 3 characters', async () => {
    mockPost.mockResolvedValue(makeSearchResponse([SUGGESTION_ITEM]));
    render(<SearchPanel />);

    // Mobile is the default filter — type only 2 chars
    typeIntoSearchInput('98');

    await advanceDebounce(400);

    // Suggestion text must be absent
    expect(screen.queryByText('Ravi Kumar')).not.toBeInTheDocument();
    // API must NOT have been called
    expect(mockPost).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 2. No text typed — typeahead API is not called
  //
  // The component's guard is inputValue.length >= 3.  Mobile is always the
  // default filter so the input is never disabled on mount; this test just
  // verifies that an empty inputValue keeps the API silent.
  // -------------------------------------------------------------------------
  it('does not open the suggestions Popper when no filter is selected', async () => {
    mockPost.mockResolvedValue(makeSearchResponse([SUGGESTION_ITEM]));
    render(<SearchPanel />);

    // inputValue starts as '' — do not type anything
    const input = document.querySelector('input[name="custume-auto"]') as HTMLElement;
    expect(input).toBeInTheDocument();

    await advanceDebounce(400);

    expect(mockPost).not.toHaveBeenCalled();
    expect(screen.queryByText('Ravi Kumar')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 3. Valid state — suggestions appear after debounce fires
  // -------------------------------------------------------------------------
  it('shows suggestions after 3+ characters are typed with a filter selected', async () => {
    mockPost.mockResolvedValue(makeSearchResponse([SUGGESTION_ITEM]));
    render(<SearchPanel />);

    // Mobile is the default filter — type 3 chars
    typeIntoSearchInput('987');

    // Advance past the debounce and flush all pending async work.
    // No extra act() here — adding await act(async()=>{}) after advanceDebounce
    // hangs because React 18 act() waits for pending fake MUI timers.
    // advanceDebounce already flushes microtasks (apiClient.post resolution +
    // setSuggestions state update) so the DOM is settled by this point.
    await advanceDebounce(300);

    expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 4. Clicking a suggestion fills the input with the correct value
  // -------------------------------------------------------------------------
  it('fills the input with the suggestion primary mobile when a Mobile filter suggestion is clicked', async () => {
    mockPost.mockResolvedValue(makeSearchResponse([SUGGESTION_ITEM]));
    render(<SearchPanel />);

    typeIntoSearchInput('987');
    await advanceDebounce(300);

    expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();

    // Click the suggestion item
    act(() => {
      fireEvent.click(screen.getByText('Ravi Kumar'));
    });

    // Input must now show the primary mobile value
    const input = document.querySelector('input[name="custume-auto"]') as HTMLInputElement;
    expect(input.value).toBe('9876543210');
  });

  // -------------------------------------------------------------------------
  // 5. Empty result set — Popper stays closed
  // -------------------------------------------------------------------------
  it('keeps the suggestions Popper closed when the API returns an empty result set', async () => {
    mockPost.mockResolvedValue(makeSearchResponse([]));
    render(<SearchPanel />);

    typeIntoSearchInput('000');
    await advanceDebounce(300);

    // After the API resolves there should be no suggestion items
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 6. Suggestions clear when the filter is changed
  // -------------------------------------------------------------------------
  it('clears suggestions when the filter is changed after suggestions are visible', async () => {
    mockPost.mockResolvedValue(makeSearchResponse([SUGGESTION_ITEM]));
    render(<SearchPanel />);

    typeIntoSearchInput('987');
    await advanceDebounce(300);

    expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();

    // Change filter to Cust.Name by firing a change event on the hidden
    // native select that MUI renders behind the custom Select display.
    // This calls handleSearchTypeChange → handleSelectSearchType (SearchPanel's
    // handleFilterChange) which resets suggestions.
    const hiddenSelect = document.querySelector(
      'input[aria-labelledby="searchVehicleDropDown"]',
    ) as HTMLInputElement | null;

    if (hiddenSelect) {
      act(() => {
        fireEvent.change(hiddenSelect, { target: { value: 'CustomerName' } });
      });
    } else {
      // Fallback: fire directly against the Select's onChange via a custom event
      act(() => {
        const selectEl = document.querySelector('.custume-select-auto input') as HTMLElement;
        if (selectEl) fireEvent.change(selectEl, { target: { value: 'CustomerName' } });
      });
    }

    expect(screen.queryByText('Ravi Kumar')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 7. API error — suggestions stay hidden, no crash
  // -------------------------------------------------------------------------
  it('keeps the suggestions Popper closed when the typeahead API call throws', async () => {
    mockPost.mockRejectedValue(new Error('Network error'));
    render(<SearchPanel />);

    typeIntoSearchInput('987');
    await advanceDebounce(300);

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Ravi Kumar')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 8. Debounce — API is NOT called before 300 ms elapses
  // -------------------------------------------------------------------------
  it('does not call the typeahead API before the 300 ms debounce window elapses', async () => {
    mockPost.mockResolvedValue(makeSearchResponse([SUGGESTION_ITEM]));
    render(<SearchPanel />);

    typeIntoSearchInput('987');

    // Only advance 200 ms — still inside the debounce window
    await advanceDebounce(200);

    expect(mockPost).not.toHaveBeenCalled();
  });
});
