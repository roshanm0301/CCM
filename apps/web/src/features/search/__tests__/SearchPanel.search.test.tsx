/**
 * SearchPanel — search submission and empty-state tests.
 *
 * GAP 8 (F11): Empty state display
 *
 * Covered scenarios:
 * 1. When the API returns 0 results, "No results found." text is displayed
 * 2. The SearchResults list component is not rendered when result count is 0
 * 3. When the API returns results, SearchResults is rendered and "No results found" is absent
 * 4. Error alert is shown when API returns a non-422 error
 * 5. When API returns 422, input validation error is shown (not generic error)
 * 6. Search button is disabled until >= 3 characters are entered
 * 7. Search button is enabled once a filter is selected and >= 3 characters are present
 *
 * Source: SearchPanel.tsx handleSearch, noResults state, SearchResults render guard
 * Traceability: CCM_Phase1_Agent_Interaction_Documentation.md §C3
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mock apiClient before component import
// ---------------------------------------------------------------------------

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock useInteractionStore
// SearchPanel calls useInteractionStore() (the hook) for reactive state and
// also calls useInteractionStore.getState() directly for a one-shot read of
// ctiFromNumber on mount. Both must be mocked.
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
// Mock SearchResults to isolate the panel from child state
// ---------------------------------------------------------------------------

vi.mock('../SearchResults', () => ({
  SearchResults: ({ results }: { results: unknown[] }) => (
    <div data-testid="search-results" data-count={results.length} />
  ),
}));

import { apiClient } from '@/shared/api/client';
import { useInteractionStore } from '@/features/interaction/interactionStore';
import { SearchPanel } from '../SearchPanel';
import type { SearchResultItem } from '@/features/interaction/interactionStore';

const mockPost = apiClient.post as ReturnType<typeof vi.fn>;
const mockUseInteractionStore = useInteractionStore as unknown as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Reactive store mock: setSearchResults actually updates what the store returns
// so the component re-renders with the new results.
let storeSearchResults: SearchResultItem[] = [];

function buildStoreMock() {
  const setSearchResults = vi.fn((results: SearchResultItem[]) => {
    storeSearchResults = results;
  });
  return {
    interactionId: 'ia-test-001',
    get searchResults() { return storeSearchResults; },
    setSearchResults,
  };
}

const RESULT_ITEM: SearchResultItem = {
  customerRef: 'CUST-001',
  customerName: 'Ravi Kumar',
  primaryMobile: '9876543210',
  email: null,
  vehicles: [],
  sourceSystem: 'INSTALL_BASE',
};

function makeSearchResponse(results: SearchResultItem[], outcomeStatus = 'RESULTS_FOUND') {
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
        outcomeStatus: results.length === 0 ? 'NO_RESULTS' : outcomeStatus,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: type a search value and submit
//
// Mobile is the default filter (searchType initialises to 'MobileNumber'), so
// there is no need to open the Select dropdown before typing.  The text input
// is identified by its stable name attribute ("custume-auto") because the MUI
// Autocomplete element does not expose an accessible label matching the old
// placeholder text.
// ---------------------------------------------------------------------------

async function fillAndSubmit(value: string) {
  const input = document.querySelector('input[name="custume-auto"]') as HTMLElement;
  fireEvent.change(input, { target: { value } });

  const searchButton = screen.getByRole('button', { name: /^Search$/i });
  fireEvent.click(searchButton);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  storeSearchResults = [];
  mockUseInteractionStore.mockImplementation(() => buildStoreMock());
  // Default fallback: typeahead debounce calls return empty suggestions without
  // consuming Once mocks that are meant for main search assertions.
  mockPost.mockResolvedValue(makeSearchResponse([]));
});

// ---------------------------------------------------------------------------
// Tests: empty state (F11)
// ---------------------------------------------------------------------------

describe('SearchPanel — empty state when API returns 0 results (F11)', () => {
  it('displays "No results found." when the API returns an empty results array', async () => {
    mockPost.mockResolvedValueOnce(makeSearchResponse([]));

    render(<SearchPanel />);

    await act(async () => {
      await fillAndSubmit('9999999999');
    });

    await waitFor(() => {
      expect(screen.getByText('No results found.')).toBeInTheDocument();
    });
  });

  it('does NOT render the SearchResults component when result count is 0', async () => {
    mockPost.mockResolvedValueOnce(makeSearchResponse([]));

    render(<SearchPanel />);

    await act(async () => {
      await fillAndSubmit('0000000000');
    });

    await waitFor(() => {
      expect(screen.queryByTestId('search-results')).not.toBeInTheDocument();
    });
  });

  it('does NOT show "No results found." before any search has been performed', () => {
    render(<SearchPanel />);
    expect(screen.queryByText('No results found.')).not.toBeInTheDocument();
  });

  it('clears "No results found." text when a new search is triggered', async () => {
    // Use mockImplementation so the response is determined by the search value,
    // regardless of whether the typeahead debounce fires and in what order calls arrive.
    mockPost.mockImplementation(async (_url: string, body: Record<string, unknown>) => {
      if (body.value === '9876543210') return makeSearchResponse([RESULT_ITEM]);
      return makeSearchResponse([]);
    });

    render(<SearchPanel />);

    // First search
    await act(async () => {
      await fillAndSubmit('0000000000');
    });

    await waitFor(() => {
      expect(screen.getByText('No results found.')).toBeInTheDocument();
    });

    // Second search — re-type a new value and submit
    const input = document.querySelector('input[name="custume-auto"]') as HTMLElement;
    fireEvent.change(input, { target: { value: '9876543210' } });
    const searchButton = screen.getByRole('button', { name: /^Search$/i });

    await act(async () => {
      fireEvent.click(searchButton);
    });

    await waitFor(() => {
      // "No results found." must be gone, replaced by results
      expect(screen.queryByText('No results found.')).not.toBeInTheDocument();
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: results present
// ---------------------------------------------------------------------------

describe('SearchPanel — SearchResults rendered when API returns results', () => {
  it('renders the SearchResults component when resultCount > 0', async () => {
    mockPost.mockResolvedValueOnce(makeSearchResponse([RESULT_ITEM]));

    render(<SearchPanel />);

    await act(async () => {
      await fillAndSubmit('9876543210');
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
    });
  });

  it('does NOT show "No results found." when results are present', async () => {
    mockPost.mockResolvedValueOnce(makeSearchResponse([RESULT_ITEM]));

    render(<SearchPanel />);

    await act(async () => {
      await fillAndSubmit('9876543210');
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
    });

    expect(screen.queryByText('No results found.')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: API error handling
// ---------------------------------------------------------------------------

describe('SearchPanel — API error states', () => {
  it('shows a generic error alert when the API returns a 500 error', async () => {
    const err = Object.assign(new Error('Server Error'), { response: { status: 500 } });
    mockPost.mockRejectedValueOnce(err);

    render(<SearchPanel />);

    await act(async () => {
      await fillAndSubmit('9876543210');
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Search is temporarily unavailable/i),
      ).toBeInTheDocument();
    });
  });

  it('shows input validation error text when the API returns 422', async () => {
    const err = Object.assign(new Error('Validation Error'), { response: { status: 422 } });
    mockPost.mockRejectedValueOnce(err);

    render(<SearchPanel />);

    await act(async () => {
      await fillAndSubmit('9876543210');
    });

    await waitFor(() => {
      expect(screen.getByText(/Enter at least 3 characters/i)).toBeInTheDocument();
    });

    // Generic error must NOT appear for a 422
    expect(screen.queryByText(/Search is temporarily unavailable/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: search button enabled/disabled state
// ---------------------------------------------------------------------------

describe('SearchPanel — search button enabled state', () => {
  it('search button is disabled when no filter is selected', () => {
    render(<SearchPanel />);
    const searchButton = screen.getByRole('button', { name: /^Search$/i });
    // Mobile is always selected by default; button is disabled because inputValue is empty (< 3 chars)
    expect(searchButton).toBeDisabled();
  });

  it('search button is disabled when filter is selected but fewer than 3 characters entered', async () => {
    render(<SearchPanel />);

    // Mobile filter is already selected by default — no dropdown interaction needed
    const input = document.querySelector('input[name="custume-auto"]') as HTMLElement;
    fireEvent.change(input, { target: { value: '98' } });

    const searchButton = screen.getByRole('button', { name: /^Search$/i });
    expect(searchButton).toBeDisabled();
  });

  it('search button is enabled when filter is selected and 3 or more characters are typed', async () => {
    render(<SearchPanel />);

    // Mobile filter is already selected by default — no dropdown interaction needed
    const input = document.querySelector('input[name="custume-auto"]') as HTMLElement;
    fireEvent.change(input, { target: { value: '987' } });

    const searchButton = screen.getByRole('button', { name: /^Search$/i });
    expect(searchButton).not.toBeDisabled();
  });
});
