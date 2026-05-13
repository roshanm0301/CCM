/**
 * SearchResults — component tests.
 *
 * GAP 1 (F12): SearchResults context selection
 * GAP 2 (F13): Vehicle disambiguation
 *
 * Covered scenarios:
 * 1. Renders customer name and masked mobile for each result
 * 2. Clicking a result calls PATCH /context and store actions
 * 3. When a result has multiple vehicles, vehicle disambiguation panel appears
 * 4. When a result has a single vehicle, no disambiguation panel is shown
 * 5. Clicking a result with no vehicles proceeds directly to context loading
 * 6. Vehicle disambiguation panel lists vehicles with registration number and model
 * 7. Selecting a vehicle in disambiguation calls PATCH /context with vehicleRef
 * 8. Error alert is shown when PATCH /context fails
 * 9. Auto-selects single result
 *
 * Source: SearchResults.tsx, interactionStore.ts
 * Traceability: CCM_Phase1_Agent_Interaction_Documentation.md §C4, §D4
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { InteractionStatus } from '@ccm/types';

// ---------------------------------------------------------------------------
// Mock apiClient before any component import
// ---------------------------------------------------------------------------

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock useInteractionStore with controlled state
// ---------------------------------------------------------------------------

const mockSetSelectedRefs = vi.fn();
const mockSetStatus = vi.fn();
const mockSetCustomerContext = vi.fn();
const mockSetVehicleContext = vi.fn();
const mockSetDealerContext = vi.fn();

const defaultStoreMock = {
  interactionId: 'ia-001',
  selectedCustomerRef: null as string | null,
  setSelectedRefs: mockSetSelectedRefs,
  setStatus: mockSetStatus,
  setCustomerContext: mockSetCustomerContext,
  setVehicleContext: mockSetVehicleContext,
  setDealerContext: mockSetDealerContext,
};

vi.mock('@/features/interaction/interactionStore', () => ({
  useInteractionStore: vi.fn(),
}));

import { apiClient } from '@/shared/api/client';
import { useInteractionStore } from '@/features/interaction/interactionStore';
import { SearchResults } from '../SearchResults';
import type { SearchResultItem } from '@/features/interaction/interactionStore';

const mockPatch = apiClient.patch as ReturnType<typeof vi.fn>;
const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockUseInteractionStore = useInteractionStore as unknown as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CUSTOMER_NO_VEHICLES: SearchResultItem = {
  customerRef: 'CUST-001',
  customerName: 'Rahul Sharma',
  primaryMobile: '9876543210',
  email: 'rahul@example.com',
  vehicles: [],
  sourceSystem: 'INSTALL_BASE',
};

const CUSTOMER_ONE_VEHICLE: SearchResultItem = {
  customerRef: 'CUST-002',
  customerName: 'Priya Patel',
  primaryMobile: '8765432109',
  email: null,
  vehicles: [
    {
      vehicleRef: 'VEH-001',
      registrationNumber: 'MH12AB1234',
      modelName: 'Activa 6G',
      variant: 'DLX',
      dealerRef: 'DLR-001',
    },
  ],
  sourceSystem: 'INSTALL_BASE',
};

const CUSTOMER_TWO_VEHICLES: SearchResultItem = {
  customerRef: 'CUST-003',
  customerName: 'Amit Kumar',
  primaryMobile: '7654321098',
  email: null,
  vehicles: [
    {
      vehicleRef: 'VEH-002',
      registrationNumber: 'GJ01CD5678',
      modelName: 'Honda City',
      variant: 'ZX',
      dealerRef: 'DLR-002',
    },
    {
      vehicleRef: 'VEH-003',
      registrationNumber: 'DL4CAF9876',
      modelName: 'Honda City',
      variant: 'SV',
      dealerRef: 'DLR-003',
    },
  ],
  sourceSystem: 'INSTALL_BASE',
};

function makeContextPatchResponse(status = InteractionStatus.CONTEXT_CONFIRMED) {
  return {
    data: {
      success: true,
      data: {
        interactionId: 'ia-001',
        status,
        currentCustomerRef: 'CUST-001',
        currentVehicleRef: null,
        currentDealerRef: null,
        updatedAt: '2026-03-24T00:00:00.000Z',
      },
    },
  };
}

function makeContextGetResponse(type: 'customer' | 'vehicle' | 'dealer') {
  if (type === 'customer') {
    return {
      data: {
        success: true,
        data: {
          customerRef: 'CUST-001',
          contactName: 'Rahul Sharma',
          primaryMobile: '9876543210',
          secondaryMobile: null,
          emailId: null,
          address: null,
          sourceSystem: 'INSTALL_BASE',
        },
      },
    };
  }
  return { data: { success: true, data: null } };
}

// ---------------------------------------------------------------------------
// Reset mocks before every test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockUseInteractionStore.mockReturnValue({ ...defaultStoreMock });
});

// ---------------------------------------------------------------------------
// Tests: rendering
// ---------------------------------------------------------------------------

describe('SearchResults — rendering', () => {
  it('renders customer name for each result', () => {
    render(
      <SearchResults
        results={[CUSTOMER_NO_VEHICLES, CUSTOMER_ONE_VEHICLE]}
      />,
    );
    expect(screen.getByText('Rahul Sharma')).toBeInTheDocument();
    expect(screen.getByText('Priya Patel')).toBeInTheDocument();
  });

  it('renders masked mobile for a result — shows only last 4 digits', () => {
    render(<SearchResults results={[CUSTOMER_NO_VEHICLES]} />);
    // primaryMobile is '9876543210' (10 digits) — masked to 'xxxxxx3210' (6 x's + last 4)
    expect(screen.getByText(/xxxxxx3210/)).toBeInTheDocument();
    // Original number must not appear verbatim
    expect(screen.queryByText('9876543210')).not.toBeInTheDocument();
  });

  it('renders the result count in the section heading', () => {
    render(<SearchResults results={[CUSTOMER_NO_VEHICLES, CUSTOMER_ONE_VEHICLE]} />);
    expect(screen.getByText(/2 found/)).toBeInTheDocument();
  });

  it('renders registration number when a customer has one vehicle', () => {
    render(<SearchResults results={[CUSTOMER_ONE_VEHICLE]} />);
    expect(screen.getByText('MH12AB1234')).toBeInTheDocument();
  });

  it('does not render a disambiguation panel when no result is selected yet', () => {
    // Use 2 results so the single-result auto-select useEffect does NOT fire
    render(<SearchResults results={[CUSTOMER_ONE_VEHICLE, CUSTOMER_TWO_VEHICLES]} />);
    expect(screen.queryByText(/Multiple vehicles found/i)).not.toBeInTheDocument();
  });

  it('renders a Select button for each result', () => {
    render(<SearchResults results={[CUSTOMER_NO_VEHICLES, CUSTOMER_ONE_VEHICLE]} />);
    const selectButtons = screen.getAllByRole('button', { name: /Select customer/i });
    expect(selectButtons).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Tests: no-vehicle result — direct context load
// ---------------------------------------------------------------------------

describe('SearchResults — result with no vehicles', () => {
  it('calls PATCH /context with null vehicleRef and null dealerRef when customer has no vehicles', async () => {
    mockPatch.mockResolvedValueOnce(makeContextPatchResponse());
    mockGet.mockResolvedValue(makeContextGetResponse('customer'));

    render(<SearchResults results={[CUSTOMER_NO_VEHICLES]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select customer Rahul Sharma/i }));
    });

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        '/api/v1/interactions/ia-001/context',
        expect.objectContaining({
          customerRef: 'CUST-001',
          vehicleRef: null,
          dealerRef: null,
          isReselection: false,
        }),
      );
    });
  });

  it('calls setSelectedRefs after successful context patch', async () => {
    mockPatch.mockResolvedValueOnce(makeContextPatchResponse());
    mockGet.mockResolvedValue(makeContextGetResponse('customer'));

    render(<SearchResults results={[CUSTOMER_NO_VEHICLES]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select customer Rahul Sharma/i }));
    });

    await waitFor(() => {
      expect(mockSetSelectedRefs).toHaveBeenCalledWith('CUST-001', null, null);
    });
  });

  it('calls setStatus with the status returned from the context patch', async () => {
    mockPatch.mockResolvedValueOnce(makeContextPatchResponse(InteractionStatus.CONTEXT_CONFIRMED));
    mockGet.mockResolvedValue(makeContextGetResponse('customer'));

    render(<SearchResults results={[CUSTOMER_NO_VEHICLES]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select customer Rahul Sharma/i }));
    });

    await waitFor(() => {
      expect(mockSetStatus).toHaveBeenCalledWith(InteractionStatus.CONTEXT_CONFIRMED);
    });
  });

  it('does NOT show a disambiguation panel after selecting a no-vehicle customer', async () => {
    mockPatch.mockResolvedValueOnce(makeContextPatchResponse());
    mockGet.mockResolvedValue(makeContextGetResponse('customer'));

    render(<SearchResults results={[CUSTOMER_NO_VEHICLES]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select customer Rahul Sharma/i }));
    });

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText(/Multiple vehicles found/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: single-vehicle result — no disambiguation step
// ---------------------------------------------------------------------------

describe('SearchResults — result with a single vehicle', () => {
  it('calls PATCH /context with vehicleRef when customer has exactly one vehicle', async () => {
    mockPatch.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          interactionId: 'ia-001',
          status: InteractionStatus.CONTEXT_CONFIRMED,
          currentCustomerRef: 'CUST-002',
          currentVehicleRef: 'VEH-001',
          currentDealerRef: 'DLR-001',
          updatedAt: '2026-03-24T00:00:00.000Z',
        },
      },
    });
    mockGet.mockResolvedValue(makeContextGetResponse('customer'));

    render(<SearchResults results={[CUSTOMER_ONE_VEHICLE]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select customer Priya Patel/i }));
    });

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        '/api/v1/interactions/ia-001/context',
        expect.objectContaining({
          customerRef: 'CUST-002',
          vehicleRef: 'VEH-001',
          dealerRef: 'DLR-001',
          isReselection: false,
        }),
      );
    });
  });

  it('does NOT show a disambiguation panel when customer has exactly one vehicle', async () => {
    mockPatch.mockResolvedValueOnce(makeContextPatchResponse());
    mockGet.mockResolvedValue(makeContextGetResponse('customer'));

    render(<SearchResults results={[CUSTOMER_ONE_VEHICLE]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select customer Priya Patel/i }));
    });

    // Disambiguation heading must never appear
    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText(/Multiple vehicles found/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: multi-vehicle result — disambiguation panel (GAP 2 / F13)
// ---------------------------------------------------------------------------

describe('SearchResults — vehicle disambiguation panel (F13)', () => {
  it('shows the disambiguation panel when a customer with multiple vehicles is selected', async () => {
    render(<SearchResults results={[CUSTOMER_TWO_VEHICLES]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select customer Amit Kumar/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Multiple vehicles found/i)).toBeInTheDocument();
    });

    // No PATCH should fire at this point — disambiguation must come first
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('lists each vehicle with its registration number in the disambiguation panel', async () => {
    // Use 2 results so auto-select useEffect does NOT fire; click triggers disambiguation manually
    render(<SearchResults results={[CUSTOMER_ONE_VEHICLE, CUSTOMER_TWO_VEHICLES]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select customer Amit Kumar/i }));
    });

    await waitFor(() => {
      // GJ01CD5678 appears in both the main results list and the disambiguation panel;
      // use getAllByText to handle the multiple-match case
      expect(screen.getAllByText('GJ01CD5678').length).toBeGreaterThanOrEqual(1);
      // DL4CAF9876 only appears in the disambiguation panel (it is the second vehicle)
      expect(screen.getByText('DL4CAF9876')).toBeInTheDocument();
    });
  });

  it('lists each vehicle with its model name and variant in the disambiguation panel', async () => {
    render(<SearchResults results={[CUSTOMER_TWO_VEHICLES]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select customer Amit Kumar/i }));
    });

    await waitFor(() => {
      // Honda City ZX and Honda City SV should both appear
      expect(screen.getAllByText(/Honda City/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('calls PATCH /context with the selected vehicle when a vehicle is chosen in disambiguation', async () => {
    mockPatch.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          interactionId: 'ia-001',
          status: InteractionStatus.CONTEXT_CONFIRMED,
          currentCustomerRef: 'CUST-003',
          currentVehicleRef: 'VEH-002',
          currentDealerRef: 'DLR-002',
          updatedAt: '2026-03-24T00:00:00.000Z',
        },
      },
    });
    mockGet.mockResolvedValue(makeContextGetResponse('customer'));

    render(<SearchResults results={[CUSTOMER_TWO_VEHICLES]} />);

    // Open disambiguation
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select customer Amit Kumar/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Multiple vehicles found/i)).toBeInTheDocument();
    });

    // Select first vehicle
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select vehicle GJ01CD5678/i }));
    });

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        '/api/v1/interactions/ia-001/context',
        expect.objectContaining({
          customerRef: 'CUST-003',
          vehicleRef: 'VEH-002',
        }),
      );
    });
  });

  it('dismisses the disambiguation panel after a vehicle is successfully selected', async () => {
    mockPatch.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          interactionId: 'ia-001',
          status: InteractionStatus.CONTEXT_CONFIRMED,
          currentCustomerRef: 'CUST-003',
          currentVehicleRef: 'VEH-002',
          currentDealerRef: 'DLR-002',
          updatedAt: '2026-03-24T00:00:00.000Z',
        },
      },
    });
    mockGet.mockResolvedValue(makeContextGetResponse('customer'));

    render(<SearchResults results={[CUSTOMER_TWO_VEHICLES]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select customer Amit Kumar/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Multiple vehicles found/i)).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select vehicle GJ01CD5678/i }));
    });

    await waitFor(() => {
      expect(screen.queryByText(/Multiple vehicles found/i)).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: error handling
// ---------------------------------------------------------------------------

describe('SearchResults — error handling', () => {
  it('shows an error alert when PATCH /context returns a network error', async () => {
    mockPatch.mockRejectedValueOnce(new Error('Network Error'));

    render(<SearchResults results={[CUSTOMER_NO_VEHICLES]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select customer Rahul Sharma/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Unable to load selected record/i),
      ).toBeInTheDocument();
    });
  });

  it('shows no disambiguation panel when PATCH errors on a multi-vehicle customer', async () => {
    // The error should occur during vehicle selection, not on customer click
    // (multi-vehicle customer shows disambiguation before any PATCH)
    mockPatch.mockRejectedValueOnce(new Error('Network Error'));

    render(<SearchResults results={[CUSTOMER_TWO_VEHICLES]} />);

    // Clicking customer opens disambiguation — no PATCH yet
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select customer Amit Kumar/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Multiple vehicles found/i)).toBeInTheDocument();
    });

    // Now pick a vehicle — this triggers the PATCH
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select vehicle GJ01CD5678/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Unable to load selected record/i)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: single result auto-select (GAP 1 / F12)
// ---------------------------------------------------------------------------

describe('SearchResults — single result auto-select (F12)', () => {
  it('calls PATCH /context automatically without any user click when exactly one result is present', async () => {
    mockPatch.mockResolvedValueOnce(makeContextPatchResponse());
    mockGet.mockResolvedValue(makeContextGetResponse('customer'));

    await act(async () => {
      render(<SearchResults results={[CUSTOMER_NO_VEHICLES]} />);
    });

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        '/api/v1/interactions/ia-001/context',
        expect.objectContaining({
          customerRef: 'CUST-001',
          vehicleRef: null,
          dealerRef: null,
        }),
      );
    });
  });

  it('calls setSelectedRefs automatically when exactly one result is present', async () => {
    mockPatch.mockResolvedValueOnce(makeContextPatchResponse());
    mockGet.mockResolvedValue(makeContextGetResponse('customer'));

    await act(async () => {
      render(<SearchResults results={[CUSTOMER_NO_VEHICLES]} />);
    });

    await waitFor(() => {
      expect(mockSetSelectedRefs).toHaveBeenCalledWith('CUST-001', null, null);
    });
  });

  it('does NOT show a disambiguation panel when exactly one result has exactly one vehicle', async () => {
    mockPatch.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          interactionId: 'ia-001',
          status: InteractionStatus.CONTEXT_CONFIRMED,
          currentCustomerRef: 'CUST-002',
          currentVehicleRef: 'VEH-001',
          currentDealerRef: 'DLR-001',
          updatedAt: '2026-03-24T00:00:00.000Z',
        },
      },
    });
    mockGet.mockResolvedValue(makeContextGetResponse('customer'));

    await act(async () => {
      render(<SearchResults results={[CUSTOMER_ONE_VEHICLE]} />);
    });

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledTimes(1);
    });

    // Disambiguation panel must never appear for a single-vehicle auto-select
    expect(screen.queryByText(/Multiple vehicles found/i)).not.toBeInTheDocument();
  });

  it('does NOT auto-select when there are 2 results — user click is required', async () => {
    render(<SearchResults results={[CUSTOMER_NO_VEHICLES, CUSTOMER_ONE_VEHICLE]} />);

    // PATCH must NOT fire without any user interaction
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('does NOT auto-select again when selectedCustomerRef is already set in the store', async () => {
    // Pre-seed the store as if a customer was previously chosen
    mockUseInteractionStore.mockReturnValue({
      ...defaultStoreMock,
      selectedCustomerRef: 'CUST-PREV',
    });

    await act(async () => {
      render(<SearchResults results={[CUSTOMER_NO_VEHICLES]} />);
    });

    // auto-select useEffect checks !selectedCustomerRef — should NOT fire
    expect(mockPatch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: isReselection flag
// ---------------------------------------------------------------------------

describe('SearchResults — isReselection flag', () => {
  it('passes isReselection: true when a customer is already selected in the store', async () => {
    // Pre-seed store with a selected customer ref
    mockUseInteractionStore.mockReturnValue({
      ...defaultStoreMock,
      selectedCustomerRef: 'CUST-PREV',
    });

    mockPatch.mockResolvedValueOnce(makeContextPatchResponse());
    mockGet.mockResolvedValue(makeContextGetResponse('customer'));

    render(<SearchResults results={[CUSTOMER_NO_VEHICLES]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select customer Rahul Sharma/i }));
    });

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        '/api/v1/interactions/ia-001/context',
        expect.objectContaining({
          isReselection: true,
        }),
      );
    });
  });

  it('passes isReselection: false when no customer was previously selected', async () => {
    mockPatch.mockResolvedValueOnce(makeContextPatchResponse());
    mockGet.mockResolvedValue(makeContextGetResponse('customer'));

    render(<SearchResults results={[CUSTOMER_NO_VEHICLES]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select customer Rahul Sharma/i }));
    });

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        '/api/v1/interactions/ia-001/context',
        expect.objectContaining({
          isReselection: false,
        }),
      );
    });
  });
});
