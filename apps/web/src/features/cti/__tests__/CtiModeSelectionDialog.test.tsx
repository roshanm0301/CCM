/**
 * CtiModeSelectionDialog — component tests.
 *
 * Covered scenarios:
 * N10 — Dialog renders when sessionMode is null (title and both option labels visible)
 * N11 — Continue button is disabled until a selection is made
 * N12 — PATCH called with correct body on Continue click; setSessionMode invoked on success
 * N13 — Dialog cannot be dismissed by Escape key (disableEscapeKeyDown)
 * N13b — API error state shows an error Alert and re-enables the Continue button
 *
 * Source: CtiModeSelectionDialog.tsx, CCM Phase 1.5 Mode Selection spec
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mock apiClient before any component import
// ---------------------------------------------------------------------------

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    patch: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock useAuthStore
// The component reads sessionMode from the store and calls getState().setSessionMode
// directly (not through the hook), so we mock both the hook and getState.
// ---------------------------------------------------------------------------

const mockSetSessionMode = vi.fn();

vi.mock('@/features/auth/authStore', () => ({
  useAuthStore: Object.assign(
    vi.fn(() => ({ sessionMode: null })),
    {
      getState: vi.fn(() => ({
        setSessionMode: mockSetSessionMode,
      })),
    },
  ),
}));

import { apiClient } from '@/shared/api/client';
import { CtiModeSelectionDialog } from '../CtiModeSelectionDialog';

const mockPatch = apiClient.patch as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPatchSuccess(mode: 'manual' | 'cti') {
  return {
    data: { success: true, data: { sessionMode: mode } },
  };
}

// ---------------------------------------------------------------------------
// Reset mocks before every test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// N10 — Dialog renders when sessionMode is null
// ---------------------------------------------------------------------------

describe('N10 — CtiModeSelectionDialog renders correctly', () => {
  it('shows the dialog title "Choose Your Work Mode"', () => {
    render(<CtiModeSelectionDialog />);

    expect(
      screen.getByText('Choose Your Work Mode'),
    ).toBeInTheDocument();
  });

  it('shows the "Manual" option label', () => {
    render(<CtiModeSelectionDialog />);

    expect(screen.getByText('Manual')).toBeInTheDocument();
  });

  it('shows the "CTI — Telephony Connected" option label', () => {
    render(<CtiModeSelectionDialog />);

    expect(screen.getByText('CTI — Telephony Connected')).toBeInTheDocument();
  });

  it('renders both radio inputs — manual and cti — in the document', () => {
    render(<CtiModeSelectionDialog />);

    // Hidden radio inputs are in the DOM even if opacity:0
    const manualRadio = screen.getByRole('radio', { name: 'Manual mode' });
    const ctiRadio = screen.getByRole('radio', { name: 'CTI telephony connected mode' });

    expect(manualRadio).toBeInTheDocument();
    expect(ctiRadio).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// N11 — Continue button disabled until selection made
// ---------------------------------------------------------------------------

describe('N11 — Continue button disabled until a selection is made', () => {
  it('Continue button is disabled when no mode is selected', () => {
    render(<CtiModeSelectionDialog />);

    const continueBtn = screen.getByRole('button', {
      name: /Confirm selected work mode and continue/i,
    });
    expect(continueBtn).toBeDisabled();
  });

  it('Continue button is enabled after selecting Manual', async () => {
    const user = userEvent.setup();
    render(<CtiModeSelectionDialog />);

    const manualRadio = screen.getByRole('radio', { name: 'Manual mode' });
    await user.click(manualRadio);

    const continueBtn = screen.getByRole('button', {
      name: /Confirm selected work mode and continue/i,
    });
    expect(continueBtn).toBeEnabled();
  });

  it('Continue button is enabled after selecting CTI', async () => {
    const user = userEvent.setup();
    render(<CtiModeSelectionDialog />);

    const ctiRadio = screen.getByRole('radio', { name: 'CTI telephony connected mode' });
    await user.click(ctiRadio);

    const continueBtn = screen.getByRole('button', {
      name: /Confirm selected work mode and continue/i,
    });
    expect(continueBtn).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// N12 — PATCH called with correct body; setSessionMode called on success
// ---------------------------------------------------------------------------

describe('N12 — PATCH /api/v1/auth/session-mode on Continue click', () => {
  it('calls PATCH with { sessionMode: "manual" } when Manual is selected', async () => {
    const user = userEvent.setup();
    mockPatch.mockResolvedValueOnce(buildPatchSuccess('manual'));

    render(<CtiModeSelectionDialog />);

    await user.click(screen.getByRole('radio', { name: 'Manual mode' }));
    await user.click(
      screen.getByRole('button', { name: /Confirm selected work mode and continue/i }),
    );

    expect(mockPatch).toHaveBeenCalledWith('/api/v1/auth/session-mode', {
      sessionMode: 'manual',
    });
  });

  it('calls PATCH with { sessionMode: "cti" } when CTI is selected', async () => {
    const user = userEvent.setup();
    mockPatch.mockResolvedValueOnce(buildPatchSuccess('cti'));

    render(<CtiModeSelectionDialog />);

    await user.click(screen.getByRole('radio', { name: 'CTI telephony connected mode' }));
    await user.click(
      screen.getByRole('button', { name: /Confirm selected work mode and continue/i }),
    );

    expect(mockPatch).toHaveBeenCalledWith('/api/v1/auth/session-mode', {
      sessionMode: 'cti',
    });
  });

  it('calls setSessionMode("manual") after PATCH resolves successfully', async () => {
    const user = userEvent.setup();
    mockPatch.mockResolvedValueOnce(buildPatchSuccess('manual'));

    render(<CtiModeSelectionDialog />);

    await user.click(screen.getByRole('radio', { name: 'Manual mode' }));
    await act(async () => {
      await user.click(
        screen.getByRole('button', { name: /Confirm selected work mode and continue/i }),
      );
    });

    await waitFor(() => {
      expect(mockSetSessionMode).toHaveBeenCalledWith('manual');
    });
  });

  it('calls setSessionMode("cti") after PATCH resolves for CTI selection', async () => {
    const user = userEvent.setup();
    mockPatch.mockResolvedValueOnce(buildPatchSuccess('cti'));

    render(<CtiModeSelectionDialog />);

    await user.click(screen.getByRole('radio', { name: 'CTI telephony connected mode' }));
    await act(async () => {
      await user.click(
        screen.getByRole('button', { name: /Confirm selected work mode and continue/i }),
      );
    });

    await waitFor(() => {
      expect(mockSetSessionMode).toHaveBeenCalledWith('cti');
    });
  });
});

// ---------------------------------------------------------------------------
// N13 — Dialog cannot be dismissed by Escape key
// ---------------------------------------------------------------------------

describe('N13 — Dialog cannot be dismissed by Escape or backdrop', () => {
  it('dialog title remains visible after pressing Escape (disableEscapeKeyDown)', async () => {
    const user = userEvent.setup();
    render(<CtiModeSelectionDialog />);

    expect(screen.getByText('Choose Your Work Mode')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    // Dialog must still be present — disableEscapeKeyDown prevents closure
    expect(screen.getByText('Choose Your Work Mode')).toBeInTheDocument();
  });

  it('Continue button is still present after pressing Escape', async () => {
    const user = userEvent.setup();
    render(<CtiModeSelectionDialog />);

    await user.keyboard('{Escape}');

    expect(
      screen.getByRole('button', { name: /Confirm selected work mode and continue/i }),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// N13b — API error shows Alert and re-enables Continue
// ---------------------------------------------------------------------------

describe('N13b — API error state shows error Alert and re-enables Continue', () => {
  it('shows error Alert after PATCH rejects', async () => {
    const user = userEvent.setup();
    mockPatch.mockRejectedValueOnce({
      response: { data: { error: { message: 'Server error' } } },
    });

    render(<CtiModeSelectionDialog />);

    await user.click(screen.getByRole('radio', { name: 'CTI telephony connected mode' }));
    await act(async () => {
      await user.click(
        screen.getByRole('button', { name: /Confirm selected work mode and continue/i }),
      );
    });

    await waitFor(() => {
      expect(
        screen.getByRole('alert'),
      ).toBeInTheDocument();
    });

    // Verify alert text matches the component's error message
    expect(
      screen.getByText('Unable to save your work mode. Please try again.'),
    ).toBeInTheDocument();
  });

  it('Continue button is re-enabled after PATCH error (not stuck in loading)', async () => {
    const user = userEvent.setup();
    mockPatch.mockRejectedValueOnce({
      response: { data: { error: { message: 'Server error' } } },
    });

    render(<CtiModeSelectionDialog />);

    await user.click(screen.getByRole('radio', { name: 'Manual mode' }));
    await act(async () => {
      await user.click(
        screen.getByRole('button', { name: /Confirm selected work mode and continue/i }),
      );
    });

    await waitFor(() => {
      const continueBtn = screen.getByRole('button', {
        name: /Confirm selected work mode and continue/i,
      });
      expect(continueBtn).toBeEnabled();
    });
  });

  it('setSessionMode is NOT called when PATCH rejects', async () => {
    const user = userEvent.setup();
    mockPatch.mockRejectedValueOnce(new Error('Network error'));

    render(<CtiModeSelectionDialog />);

    await user.click(screen.getByRole('radio', { name: 'Manual mode' }));
    await act(async () => {
      await user.click(
        screen.getByRole('button', { name: /Confirm selected work mode and continue/i }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(mockSetSessionMode).not.toHaveBeenCalled();
  });
});
