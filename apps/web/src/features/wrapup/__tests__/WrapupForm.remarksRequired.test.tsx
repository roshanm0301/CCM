/**
 * WrapupForm — remarksRequired validation tests.
 *
 * Business rule: when the selected disposition has remarksRequired === true,
 * clicking Save without remarks must surface the validation error
 * "Enter remarks for the selected disposition."
 *
 * When remarksRequired === false the Save call proceeds to the API
 * (no client-side remarks validation error is raised).
 *
 * Also covers GAP 2 (F19): Close Interaction button gating.
 * The "Close Interaction" button is only rendered after the wrap-up has been
 * successfully saved. Before save the button is absent; after save it is present
 * and enabled. Attempting to save without selecting a disposition surfaces a
 * validation error and keeps the button absent.
 *
 * Source: WrapupForm.tsx §handleSave, phase1-technical-blueprint §5.9
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mock apiClient before importing the component under test
// ---------------------------------------------------------------------------
vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock useInteractionStore so the component has a stable interactionId
// ---------------------------------------------------------------------------
vi.mock('@/features/interaction/interactionStore', () => ({
  useInteractionStore: vi.fn(),
}));

import { apiClient } from '@/shared/api/client';
import { useInteractionStore } from '@/features/interaction/interactionStore';
import { WrapupForm } from '../WrapupForm';

// ---------------------------------------------------------------------------
// Typed cast helpers
// ---------------------------------------------------------------------------
const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockPatch = apiClient.patch as ReturnType<typeof vi.fn>;
const mockUseInteractionStore = useInteractionStore as unknown as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Shared master-data fixture
// ---------------------------------------------------------------------------
const contactReasonsResponse = {
  data: {
    success: true,
    data: {
      type: 'contact-reasons',
      items: [{ code: 'CR01', label: 'Service Query', sortOrder: 1 }],
    },
  },
};

const idOutcomesResponse = {
  data: {
    success: true,
    data: {
      type: 'identification-outcomes',
      items: [{ code: 'IO01', label: 'Identified', sortOrder: 1 }],
    },
  },
};

function makeDispositionsResponse(items: { code: string; label: string; remarksRequired: boolean }[]) {
  return {
    data: {
      success: true,
      data: {
        type: 'interaction-dispositions',
        items: items.map((item, idx) => ({ ...item, sortOrder: idx + 1 })),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Store mock shape
// ---------------------------------------------------------------------------
const storeMock = {
  interactionId: 'test-id',
  setSavedWrapup: vi.fn(),
  setStatus: vi.fn(),
  setWrapupPending: vi.fn(),
};

// ---------------------------------------------------------------------------
// Helper: open a MUI Select and click an option
// ---------------------------------------------------------------------------
async function selectOption(labelText: string, optionText: string) {
  // MUI Select: fireEvent.mouseDown opens the listbox; fireEvent.click selects the option.
  // Using fireEvent instead of userEvent.click avoids the ~700ms/click overhead in forks pool.
  const combobox = screen.getByRole('combobox', { name: new RegExp(labelText, 'i') });
  fireEvent.mouseDown(combobox);
  const option = await screen.findByRole('option', { name: optionText });
  fireEvent.click(option);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WrapupForm — remarksRequired validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseInteractionStore.mockReturnValue(storeMock);
  });

  it('does not show a remarks validation error when remarksRequired is false and Save is clicked', async () => {
    mockGet
      .mockResolvedValueOnce(contactReasonsResponse)
      .mockResolvedValueOnce(idOutcomesResponse)
      .mockResolvedValueOnce(
        makeDispositionsResponse([
          { code: 'DISP_NO_REMARKS', label: 'Resolved — no remarks', remarksRequired: false },
        ]),
      );

    // Patch returns a valid saved response so the component does not throw
    mockPatch.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          interactionId: 'test-id',
          status: 'WRAPUP',
          wrapup: {
            contactReasonCode: 'CR01',
            identificationOutcomeCode: 'IO01',
            interactionDispositionCode: 'DISP_NO_REMARKS',
            remarks: null,
          },
        },
      },
    });

    render(<WrapupForm onInteractionClosed={vi.fn()} />);

    // Wait for master data to load (loading spinner disappears)
    await waitFor(() => {
      expect(screen.queryByText('Loading form…')).not.toBeInTheDocument();
    });

    // Fill in required fields
    await selectOption('Contact Reason', 'Service Query');
    await selectOption('Identification Outcome', 'Identified');
    await selectOption('Interaction Disposition', 'Resolved — no remarks');

    // Click Save without entering remarks
    const saveBtn = screen.getByRole('button', { name: /save wrap-up/i });
    fireEvent.click(saveBtn);

    // The remarks error must NOT appear
    await waitFor(() => {
      expect(
        screen.queryByText('Enter remarks for the selected disposition.'),
      ).not.toBeInTheDocument();
    });
  });

  it('shows the remarks validation error when remarksRequired is true and Save is clicked without remarks', async () => {
    mockGet
      .mockResolvedValueOnce(contactReasonsResponse)
      .mockResolvedValueOnce(idOutcomesResponse)
      .mockResolvedValueOnce(
        makeDispositionsResponse([
          { code: 'DISP_NEEDS_REMARKS', label: 'Escalated — remarks needed', remarksRequired: true },
        ]),
      );

    render(<WrapupForm onInteractionClosed={vi.fn()} />);

    // Wait for master data to load
    await waitFor(() => {
      expect(screen.queryByText('Loading form…')).not.toBeInTheDocument();
    });

    // Fill in all required dropdowns but leave remarks empty
    await selectOption('Contact Reason', 'Service Query');
    await selectOption('Identification Outcome', 'Identified');
    await selectOption('Interaction Disposition', 'Escalated — remarks needed');

    // Remarks textarea should be empty — do not type anything

    // Click Save
    const saveBtn = screen.getByRole('button', { name: /save wrap-up/i });
    fireEvent.click(saveBtn);

    // The specific validation message must appear
    await waitFor(() => {
      expect(
        screen.getByText('Enter remarks for the selected disposition.'),
      ).toBeInTheDocument();
    });

    // The patch API must NOT have been called (validation blocked it)
    expect(mockPatch).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // GAP 2 (F19): Close Interaction button disabled before wrapup is saved
  // ---------------------------------------------------------------------------

  it('does not render the "Close Interaction" button before the wrap-up form is saved', async () => {
    mockGet
      .mockResolvedValueOnce(contactReasonsResponse)
      .mockResolvedValueOnce(idOutcomesResponse)
      .mockResolvedValueOnce(
        makeDispositionsResponse([
          { code: 'DISP_BASIC', label: 'Resolved', remarksRequired: false },
        ]),
      );

    render(<WrapupForm onInteractionClosed={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading form…')).not.toBeInTheDocument();
    });

    // Before any save attempt, the Close Interaction button must be absent
    expect(screen.queryByRole('button', { name: /Close this interaction/i })).not.toBeInTheDocument();
  });

  it('still does not render "Close Interaction" after clicking Save without selecting a disposition', async () => {
    mockGet
      .mockResolvedValueOnce(contactReasonsResponse)
      .mockResolvedValueOnce(idOutcomesResponse)
      .mockResolvedValueOnce(
        makeDispositionsResponse([
          { code: 'DISP_BASIC', label: 'Resolved', remarksRequired: false },
        ]),
      );

    render(<WrapupForm onInteractionClosed={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading form…')).not.toBeInTheDocument();
    });

    // Click Save without filling in any fields — validation should block the save
    const saveBtn = screen.getByRole('button', { name: /save wrap-up/i });
    fireEvent.click(saveBtn);

    // Validation error for missing disposition must appear
    await waitFor(() => {
      expect(screen.getByText('Select Interaction Disposition.')).toBeInTheDocument();
    });

    // API must NOT have been called
    expect(mockPatch).not.toHaveBeenCalled();

    // Close Interaction button must still be absent (save was blocked)
    expect(screen.queryByRole('button', { name: /Close this interaction/i })).not.toBeInTheDocument();
  });

  it('renders the "Close Interaction" button and hides "Save Wrap-up" after a successful save', async () => {
    mockGet
      .mockResolvedValueOnce(contactReasonsResponse)
      .mockResolvedValueOnce(idOutcomesResponse)
      .mockResolvedValueOnce(
        makeDispositionsResponse([
          { code: 'DISP_BASIC', label: 'Resolved', remarksRequired: false },
        ]),
      );

    mockPatch.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          interactionId: 'test-id',
          status: 'WRAPUP',
          wrapup: {
            contactReasonCode: 'CR01',
            identificationOutcomeCode: 'IO01',
            interactionDispositionCode: 'DISP_BASIC',
            remarks: null,
          },
        },
      },
    });

    render(<WrapupForm onInteractionClosed={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading form…')).not.toBeInTheDocument();
    });

    // Fill all required fields
    await selectOption('Contact Reason', 'Service Query');
    await selectOption('Identification Outcome', 'Identified');
    await selectOption('Interaction Disposition', 'Resolved');

    // Save
    const saveBtn = screen.getByRole('button', { name: /save wrap-up/i });
    fireEvent.click(saveBtn);

    // After successful save: Close Interaction button must be present and enabled
    await waitFor(() => {
      const closeBtn = screen.getByRole('button', { name: /Close this interaction/i });
      expect(closeBtn).toBeInTheDocument();
      expect(closeBtn).not.toBeDisabled();
    });

    // Save Wrap-up button must no longer be visible
    expect(screen.queryByRole('button', { name: /save wrap-up/i })).not.toBeInTheDocument();
  });

  it('renders the "Mark Incomplete" button (not "Close Interaction") after saving with incomplete_interaction disposition', async () => {
    mockGet
      .mockResolvedValueOnce(contactReasonsResponse)
      .mockResolvedValueOnce(idOutcomesResponse)
      .mockResolvedValueOnce(
        makeDispositionsResponse([
          { code: 'incomplete_interaction', label: 'Incomplete Interaction', remarksRequired: true },
        ]),
      );

    mockPatch.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          interactionId: 'test-id',
          status: 'WRAPUP',
          wrapup: {
            contactReasonCode: 'CR01',
            identificationOutcomeCode: 'IO01',
            interactionDispositionCode: 'incomplete_interaction',
            remarks: 'Customer could not be verified',
          },
        },
      },
    });

    render(<WrapupForm onInteractionClosed={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading form…')).not.toBeInTheDocument();
    });

    await selectOption('Contact Reason', 'Service Query');
    await selectOption('Identification Outcome', 'Identified');
    await selectOption('Interaction Disposition', 'Incomplete Interaction');

    // Fill remarks (required for this disposition)
    const remarksInput = screen.getByRole('textbox', { name: /remarks/i });
    fireEvent.change(remarksInput, { target: { value: 'Customer could not be verified' } });

    const saveBtn = screen.getByRole('button', { name: /save wrap-up/i });
    fireEvent.click(saveBtn);

    // After successful save: Mark Incomplete button must appear, Close Interaction must NOT
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Mark this interaction as incomplete/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Close this interaction/i })).not.toBeInTheDocument();
  });

  it('clicking Mark Incomplete button calls POST /incomplete and invokes onInteractionClosed with "INCOMPLETE"', async () => {
    const mockPost = apiClient.post as ReturnType<typeof vi.fn>;

    mockGet
      .mockResolvedValueOnce(contactReasonsResponse)
      .mockResolvedValueOnce(idOutcomesResponse)
      .mockResolvedValueOnce(
        makeDispositionsResponse([
          { code: 'incomplete_interaction', label: 'Incomplete Interaction', remarksRequired: true },
        ]),
      );

    mockPatch.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          interactionId: 'test-id',
          status: 'WRAPUP',
          wrapup: {
            contactReasonCode: 'CR01',
            identificationOutcomeCode: 'IO01',
            interactionDispositionCode: 'incomplete_interaction',
            remarks: 'Could not identify',
          },
        },
      },
    });

    // Mark Incomplete API succeeds
    mockPost.mockResolvedValueOnce({ data: { success: true } });

    const onInteractionClosed = vi.fn();
    render(<WrapupForm onInteractionClosed={onInteractionClosed} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading form…')).not.toBeInTheDocument();
    });

    await selectOption('Contact Reason', 'Service Query');
    await selectOption('Identification Outcome', 'Identified');
    await selectOption('Interaction Disposition', 'Incomplete Interaction');

    const remarksInput = screen.getByRole('textbox', { name: /remarks/i });
    fireEvent.change(remarksInput, { target: { value: 'Could not identify' } });

    const saveBtn = screen.getByRole('button', { name: /save wrap-up/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Mark this interaction as incomplete/i })).toBeInTheDocument();
    });

    // Click Mark Incomplete
    const markBtn = screen.getByRole('button', { name: /Mark this interaction as incomplete/i });
    fireEvent.click(markBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/v1/interactions/test-id/incomplete');
    });

    expect(onInteractionClosed).toHaveBeenCalledWith('INCOMPLETE');
  });

  it('Mark Incomplete button is absent before wrap-up is saved (requires WRAPUP save first)', async () => {
    mockGet
      .mockResolvedValueOnce(contactReasonsResponse)
      .mockResolvedValueOnce(idOutcomesResponse)
      .mockResolvedValueOnce(
        makeDispositionsResponse([
          { code: 'incomplete_interaction', label: 'Incomplete Interaction', remarksRequired: true },
        ]),
      );

    render(<WrapupForm onInteractionClosed={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading form…')).not.toBeInTheDocument();
    });

    // Before any save, the button must not be rendered
    expect(
      screen.queryByRole('button', { name: /Mark this interaction as incomplete/i }),
    ).not.toBeInTheDocument();
  });

  it('blocks Save with remarks error when incomplete_interaction disposition is chosen but remarks are empty', async () => {
    mockGet
      .mockResolvedValueOnce(contactReasonsResponse)
      .mockResolvedValueOnce(idOutcomesResponse)
      .mockResolvedValueOnce(
        makeDispositionsResponse([
          { code: 'incomplete_interaction', label: 'Incomplete Interaction', remarksRequired: true },
        ]),
      );

    render(<WrapupForm onInteractionClosed={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading form…')).not.toBeInTheDocument();
    });

    await selectOption('Contact Reason', 'Service Query');
    await selectOption('Identification Outcome', 'Identified');
    await selectOption('Interaction Disposition', 'Incomplete Interaction');

    // Leave remarks empty and try to save
    const saveBtn = screen.getByRole('button', { name: /save wrap-up/i });
    fireEvent.click(saveBtn);

    // Validation error must appear
    await waitFor(() => {
      expect(
        screen.getByText('Enter remarks for the selected disposition.'),
      ).toBeInTheDocument();
    });

    // API must NOT be called
    expect(mockPatch).not.toHaveBeenCalled();

    // Mark Incomplete button must NOT appear (save was blocked)
    expect(
      screen.queryByRole('button', { name: /Mark this interaction as incomplete/i }),
    ).not.toBeInTheDocument();
  });

  it('clears the remarks error when a non-required disposition is selected after a required one', async () => {
    mockGet
      .mockResolvedValueOnce(contactReasonsResponse)
      .mockResolvedValueOnce(idOutcomesResponse)
      .mockResolvedValueOnce(
        makeDispositionsResponse([
          { code: 'DISP_NEEDS_REMARKS', label: 'Escalated — remarks needed', remarksRequired: true },
          { code: 'DISP_NO_REMARKS', label: 'Resolved — no remarks', remarksRequired: false },
        ]),
      );

    render(<WrapupForm onInteractionClosed={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading form…')).not.toBeInTheDocument();
    });

    await selectOption('Contact Reason', 'Service Query');
    await selectOption('Identification Outcome', 'Identified');
    await selectOption('Interaction Disposition', 'Escalated — remarks needed');

    // Trigger the validation error
    const saveBtn = screen.getByRole('button', { name: /save wrap-up/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Enter remarks for the selected disposition.'),
      ).toBeInTheDocument();
    });

    // Switch to a disposition that does not require remarks
    await selectOption('Interaction Disposition', 'Resolved — no remarks');

    // The error must be cleared automatically
    await waitFor(() => {
      expect(
        screen.queryByText('Enter remarks for the selected disposition.'),
      ).not.toBeInTheDocument();
    });
  });
});
