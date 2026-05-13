/**
 * AgentStatusWidget — component tests.
 *
 * Covered scenarios:
 * 1. Hydrates store from GET /api/v1/agent/status on mount.
 * 2. Renders the correct label for each AgentStatus value.
 * 3. Clicking the chip opens the status selection menu.
 * 4. Selecting a different status calls PATCH and updates the store on success.
 * 5. On PATCH failure: store reverts to the previous status and error toast appears.
 * 6. Two widget instances share the same store — status change via one reflects in both.
 *
 * Source: AgentStatusWidget.tsx, agentStatusStore.ts
 * Traceability: CCM_Phase1_Agent_Interaction_Documentation.md §C11
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AgentStatus } from '@ccm/types';

// ---------------------------------------------------------------------------
// Mock apiClient before any component import
// ---------------------------------------------------------------------------

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

import { apiClient } from '@/shared/api/client';
import { useAgentStatusStore } from '../agentStatusStore';
import { AgentStatusWidget } from '../AgentStatusWidget';

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockPatch = apiClient.patch as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a GET /agent/status success response. */
function makeGetResponse(status: AgentStatus) {
  return {
    data: {
      success: true,
      data: { currentStatus: status },
    },
  };
}

/** Build a PATCH /agent/status success response. */
function makePatchResponse(status: AgentStatus) {
  return {
    data: {
      success: true,
      data: { currentStatus: status },
    },
  };
}

/**
 * Render the widget and wait for the mount GET promise to fully settle so that
 * no state updates land outside an act boundary.
 */
async function renderWidget(props?: React.ComponentProps<typeof AgentStatusWidget>) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(<AgentStatusWidget {...props} />);
  });
  return result;
}

// ---------------------------------------------------------------------------
// Reset store and mocks before every test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  useAgentStatusStore.setState({
    currentStatus: AgentStatus.OFFLINE,
    updating: false,
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentStatusWidget — mount hydration', () => {
  it('calls GET /api/v1/agent/status on mount and updates the store', async () => {
    mockGet.mockResolvedValueOnce(makeGetResponse(AgentStatus.READY_FOR_CALLS));

    await renderWidget();

    expect(mockGet).toHaveBeenCalledWith('/api/v1/agent/status');
    expect(useAgentStatusStore.getState().currentStatus).toBe(AgentStatus.READY_FOR_CALLS);
  });

  it('leaves the store unchanged when GET /api/v1/agent/status fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('network error'));

    await renderWidget();

    expect(mockGet).toHaveBeenCalledWith('/api/v1/agent/status');
    // Store must still hold the reset value — no crash, no state corruption
    expect(useAgentStatusStore.getState().currentStatus).toBe(AgentStatus.OFFLINE);
  });
});

describe('AgentStatusWidget — status label rendering', () => {
  it('shows "Ready for Calls" when store status is READY_FOR_CALLS', async () => {
    mockGet.mockResolvedValueOnce(makeGetResponse(AgentStatus.READY_FOR_CALLS));
    useAgentStatusStore.setState({ currentStatus: AgentStatus.READY_FOR_CALLS });

    await renderWidget();

    // Chip aria-label always contains the full label text.
    expect(
      screen.getByRole('button', { name: /Ready for Calls/i }),
    ).toBeInTheDocument();
  });

  it('shows "Break" when store status is BREAK', async () => {
    mockGet.mockResolvedValueOnce(makeGetResponse(AgentStatus.BREAK));
    useAgentStatusStore.setState({ currentStatus: AgentStatus.BREAK });

    await renderWidget();

    expect(
      screen.getByRole('button', { name: /Break/i }),
    ).toBeInTheDocument();
  });

  it('shows "Offline" when store status is OFFLINE', async () => {
    // Store is already OFFLINE from beforeEach; GET also returns OFFLINE.
    mockGet.mockResolvedValueOnce(makeGetResponse(AgentStatus.OFFLINE));

    await renderWidget();

    expect(
      screen.getByRole('button', { name: /Offline/i }),
    ).toBeInTheDocument();
  });

  it('shows "Training" when store status is TRAINING', async () => {
    mockGet.mockResolvedValueOnce(makeGetResponse(AgentStatus.TRAINING));
    useAgentStatusStore.setState({ currentStatus: AgentStatus.TRAINING });

    await renderWidget();

    expect(
      screen.getByRole('button', { name: /Training/i }),
    ).toBeInTheDocument();
  });
});

describe('AgentStatusWidget — menu interaction', () => {
  it('opens the status menu when the chip is clicked', async () => {
    mockGet.mockResolvedValueOnce(makeGetResponse(AgentStatus.OFFLINE));

    await renderWidget();

    fireEvent.click(screen.getByRole('button', { name: /Offline/i }));

    // All four statuses should appear as menu items
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /Ready for Calls/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Break/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Offline/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Training/i })).toBeInTheDocument();
    });
  });
});

describe('AgentStatusWidget — successful status change via PATCH', () => {
  it('calls PATCH and updates the store when a different status is selected', async () => {
    mockGet.mockResolvedValueOnce(makeGetResponse(AgentStatus.OFFLINE));
    mockPatch.mockResolvedValueOnce(makePatchResponse(AgentStatus.READY_FOR_CALLS));

    await renderWidget();

    // Open menu
    fireEvent.click(screen.getByRole('button', { name: /Offline/i }));

    // Select READY_FOR_CALLS
    const menuItem = await screen.findByRole('menuitem', { name: /Ready for Calls/i });
    await act(async () => {
      fireEvent.click(menuItem);
    });

    expect(mockPatch).toHaveBeenCalledWith('/api/v1/agent/status', {
      status: AgentStatus.READY_FOR_CALLS,
    });
    expect(useAgentStatusStore.getState().currentStatus).toBe(AgentStatus.READY_FOR_CALLS);
  });

  it('does not call PATCH when the currently-selected status is clicked again', async () => {
    mockGet.mockResolvedValueOnce(makeGetResponse(AgentStatus.OFFLINE));

    await renderWidget();

    fireEvent.click(screen.getByRole('button', { name: /Offline/i }));

    // Click on the already-selected Offline item (aria-label includes "(current)")
    const menuItem = await screen.findByRole('menuitem', { name: /Offline \(current\)/i });
    await act(async () => {
      fireEvent.click(menuItem);
    });

    expect(mockPatch).not.toHaveBeenCalled();
  });
});

describe('AgentStatusWidget — PATCH failure handling', () => {
  it('reverts store to previous status and shows error toast when PATCH fails', async () => {
    // Seed the store as BREAK so we have a meaningful previous state to revert to.
    useAgentStatusStore.setState({ currentStatus: AgentStatus.BREAK });
    mockGet.mockResolvedValueOnce(makeGetResponse(AgentStatus.BREAK));
    mockPatch.mockRejectedValueOnce(new Error('500 Internal Server Error'));

    await renderWidget();

    // Open menu
    fireEvent.click(screen.getByRole('button', { name: /Break/i }));

    // Select READY_FOR_CALLS — this PATCH will fail
    const menuItem = await screen.findByRole('menuitem', { name: /Ready for Calls/i });
    await act(async () => {
      fireEvent.click(menuItem);
    });

    // PATCH must have been attempted
    expect(mockPatch).toHaveBeenCalledWith('/api/v1/agent/status', {
      status: AgentStatus.READY_FOR_CALLS,
    });

    // Store must have reverted back to BREAK
    expect(useAgentStatusStore.getState().currentStatus).toBe(AgentStatus.BREAK);

    // Error toast must be visible
    expect(
      screen.getByText('Unable to update status. Please try again.'),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// GAP 7 (F24): No optimistic update — UI must NOT reflect new status until
// PATCH resolves. The chip must stay on the previous status while in-flight
// and must be disabled so a second selection cannot be triggered.
// ---------------------------------------------------------------------------

describe('AgentStatusWidget — no optimistic update during PATCH in-flight (F24)', () => {
  it('chip still shows the OLD status while PATCH is in flight', async () => {
    // Arrange: widget starts as OFFLINE, PATCH is slow (never resolves in this test)
    useAgentStatusStore.setState({ currentStatus: AgentStatus.OFFLINE });
    mockGet.mockResolvedValueOnce(makeGetResponse(AgentStatus.OFFLINE));

    // Use a promise that never resolves to simulate a long-running PATCH
    mockPatch.mockReturnValueOnce(new Promise(() => undefined));

    await renderWidget();

    // Open menu and click a new status
    fireEvent.click(screen.getByRole('button', { name: /Offline/i }));
    const menuItem = await screen.findByRole('menuitem', { name: /Ready for Calls/i });
    fireEvent.click(menuItem);

    // The chip must still show OFFLINE — NOT "Ready for Calls" — before PATCH resolves
    expect(useAgentStatusStore.getState().currentStatus).toBe(AgentStatus.OFFLINE);
    // The chip element should be disabled (updating=true is set synchronously)
    // and render with the old status label still in the accessible name
    await waitFor(() => {
      const chip = screen.getByRole('button', { name: /Offline/i });
      expect(chip).toBeInTheDocument();
    });
  });

  it('chip is disabled (updating=true) while PATCH is in flight', async () => {
    useAgentStatusStore.setState({ currentStatus: AgentStatus.OFFLINE });
    mockGet.mockResolvedValueOnce(makeGetResponse(AgentStatus.OFFLINE));

    let resolvePatch!: (value: unknown) => void;
    mockPatch.mockReturnValueOnce(new Promise((resolve) => { resolvePatch = resolve; }));

    await renderWidget();

    // Trigger the status change
    fireEvent.click(screen.getByRole('button', { name: /Offline/i }));
    const menuItem = await screen.findByRole('menuitem', { name: /Ready for Calls/i });

    await act(async () => {
      fireEvent.click(menuItem);
    });

    // Chip must be disabled while updating
    await waitFor(() => {
      expect(useAgentStatusStore.getState().updating).toBe(true);
    });

    // Now resolve the PATCH so no pending state is left after the test
    await act(async () => {
      resolvePatch(makePatchResponse(AgentStatus.READY_FOR_CALLS));
    });
  });

  it('chip updates to the NEW status only after PATCH resolves successfully', async () => {
    useAgentStatusStore.setState({ currentStatus: AgentStatus.OFFLINE });
    mockGet.mockResolvedValueOnce(makeGetResponse(AgentStatus.OFFLINE));
    mockPatch.mockResolvedValueOnce(makePatchResponse(AgentStatus.READY_FOR_CALLS));

    await renderWidget();

    // Before click — shows OFFLINE
    expect(useAgentStatusStore.getState().currentStatus).toBe(AgentStatus.OFFLINE);

    // Open menu and select READY_FOR_CALLS
    fireEvent.click(screen.getByRole('button', { name: /Offline/i }));
    const menuItem = await screen.findByRole('menuitem', { name: /Ready for Calls/i });

    await act(async () => {
      fireEvent.click(menuItem);
    });

    // After PATCH resolves — store must have the new status
    await waitFor(() => {
      expect(useAgentStatusStore.getState().currentStatus).toBe(AgentStatus.READY_FOR_CALLS);
    });

    // And updating must be reset to false
    expect(useAgentStatusStore.getState().updating).toBe(false);
  });

  it('chip does not open the menu when clicked while updating is true', async () => {
    // Simulate a mid-flight update state
    useAgentStatusStore.setState({ currentStatus: AgentStatus.BREAK, updating: true });
    mockGet.mockResolvedValueOnce(makeGetResponse(AgentStatus.BREAK));

    await renderWidget();

    // Chip is disabled when updating=true — clicking it must not open the menu
    const chip = screen.getByRole('button', { name: /Break/i });
    fireEvent.click(chip);

    // No menu items should appear
    expect(screen.queryByRole('menuitem', { name: /Ready for Calls/i })).not.toBeInTheDocument();
  });
});

describe('AgentStatusWidget — shared store across two instances', () => {
  it('status change via the first instance is reflected in the second instance', async () => {
    // Both widgets share the same module-level Zustand store.
    // mockGet uses mockResolvedValue (not Once) so both mount GETs are served.
    mockGet.mockResolvedValue(makeGetResponse(AgentStatus.OFFLINE));
    mockPatch.mockResolvedValueOnce(makePatchResponse(AgentStatus.TRAINING));

    await act(async () => {
      render(
        <>
          <AgentStatusWidget />
          <AgentStatusWidget />
        </>,
      );
    });

    // Both chips show Offline initially
    const chips = screen.getAllByRole('button', { name: /Offline/i });
    expect(chips).toHaveLength(2);

    // Change status via the first chip
    fireEvent.click(chips[0]);
    const menuItem = await screen.findByRole('menuitem', { name: /Training/i });
    await act(async () => {
      fireEvent.click(menuItem);
    });

    // Store must reflect Training
    expect(useAgentStatusStore.getState().currentStatus).toBe(AgentStatus.TRAINING);

    // Both chips must now show Training — the store is shared
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Training/i })).toHaveLength(2);
    });
  });
});
