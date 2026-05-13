/**
 * ResolutionActivityForm — unit tests.
 *
 * Scenarios:
 * 1. Form disabled when closed — caseStatus contains "Closed": fields & Save disabled, info chip shown.
 * 2. File size rejection — file > 5 MB: error shown, FileReader NOT invoked, file state not set.
 * 3. File size accepted — file ≤ 5 MB: no file error shown.
 * 4. 409 conflict — API throws 409: "Data has changed. Please refresh and try again." shown.
 * 5. 422 validation — API throws 422 with message: that message shown.
 * 6. version in payload — version prop value included in the POST body on save.
 * 7. Outcome required — Save without outcome: error shown, API NOT called.
 * 8. Successful save calls onSaved — happy-path save triggers onSaved with the API result.
 *
 * Source: ResolutionActivityForm.tsx, CCM Phase 6 Resolution Activities spec.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// vi.hoisted — create mock refs before vi.mock factory runs
// ---------------------------------------------------------------------------
const { mockApiPost } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock apiClient
// ---------------------------------------------------------------------------
vi.mock('@/shared/api/client', () => ({
  apiClient: {
    post: mockApiPost,
    get: vi.fn(),
  },
}));

import { ResolutionActivityForm } from '../ResolutionActivityForm';

// ---------------------------------------------------------------------------
// Shared fixture — current activity
// ---------------------------------------------------------------------------
const mockActivity = {
  activityId: 'act-001',
  stepNo: 1,
  assignedRole: 'agent',
  isMandatory: false,
  slaValue: null,
  slaUnit: null,
  outcomes: [
    { outcomeName: 'Resolved', outcomeType: 'Close' as const, nextStepNo: null, roleOverride: null },
    { outcomeName: 'Escalate', outcomeType: 'MoveForward' as const, nextStepNo: 2, roleOverride: null },
  ],
};

// ---------------------------------------------------------------------------
// Default API success responses
// ---------------------------------------------------------------------------
const attachmentSuccessResponse = {
  data: { success: true, data: { id: 'attach-id-1' } },
};

const resolutionSuccessResponse = {
  data: {
    success: true,
    data: {
      updatedState: { currentStepNo: 2, caseStatus: 'Open', activityStatus: 'In Progress', version: 2 },
      caseClosed: false,
    },
  },
};

// ---------------------------------------------------------------------------
// Default props factory
// ---------------------------------------------------------------------------
function defaultProps(overrides?: Partial<Parameters<typeof ResolutionActivityForm>[0]>) {
  return {
    caseId: 'case-123',
    templateId: 'tpl-001',
    currentActivity: mockActivity,
    version: 1,
    caseStatus: 'Open',
    userRoles: ['agent'],
    onSaved: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helper: select a MUI outcome option
// ---------------------------------------------------------------------------
async function selectOutcome(optionText: string) {
  const combobox = screen.getByRole('combobox', { name: /outcome/i });
  fireEvent.mouseDown(combobox);
  const option = await screen.findByRole('option', { name: new RegExp(optionText, 'i') });
  fireEvent.click(option);
}

// ---------------------------------------------------------------------------
// Helper: fill valid form fields (outcome + remarks)
// ---------------------------------------------------------------------------
async function fillValidForm() {
  await selectOutcome('Resolved');
  const remarksInput = screen.getByRole('textbox', { name: /remarks/i });
  fireEvent.change(remarksInput, { target: { value: 'Test remarks text' } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResolutionActivityForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1: Form disabled when closed ─────────────────────────────────────
  it('disables outcome select, remarks field, and save button when case is closed; shows info chip', () => {
    render(<ResolutionActivityForm {...defaultProps({ caseStatus: 'Closed – Verified' })} />);

    // Outcome select FormControl is disabled — MUI marks the combobox as disabled
    const combobox = screen.getByRole('combobox', { name: /outcome/i });
    expect(combobox).toHaveAttribute('aria-disabled', 'true');

    // Remarks text field is disabled
    const remarksInput = screen.getByRole('textbox', { name: /remarks/i });
    expect(remarksInput).toBeDisabled();

    // Save button is disabled
    const saveBtn = screen.getByRole('button', { name: /save activity/i });
    expect(saveBtn).toBeDisabled();

    // Info chip is shown
    expect(screen.getByText('Closed')).toBeInTheDocument();

    // Info alert is shown
    expect(screen.getByText(/this case is closed/i)).toBeInTheDocument();
  });

  // ── Test 2: File size rejection ────────────────────────────────────────────
  it('shows a file size error and does NOT invoke FileReader when file exceeds 5 MB', () => {
    const mockFileReaderInstance = {
      onload: null as ((e: ProgressEvent<FileReader>) => void) | null,
      readAsDataURL: vi.fn(),
      result: '',
    };
    const FileReaderSpy = vi.spyOn(globalThis, 'FileReader').mockImplementation(
      () => mockFileReaderInstance as unknown as FileReader,
    );

    render(<ResolutionActivityForm {...defaultProps()} />);

    const fileInput = document.getElementById('resolution-file-input') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    // Create a file just over 5 MB
    const oversizedFile = new File(['x'.repeat(5 * 1024 * 1024 + 1)], 'big.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    // Error message must be visible
    expect(screen.getByText('File exceeds 5 MB limit.')).toBeInTheDocument();

    // FileReader constructor must NOT have been called
    expect(FileReaderSpy).not.toHaveBeenCalled();
    expect(mockFileReaderInstance.readAsDataURL).not.toHaveBeenCalled();

    FileReaderSpy.mockRestore();
  });

  // ── Test 3: File size accepted ─────────────────────────────────────────────
  it('does not show a file error when file is within the 5 MB limit', () => {
    // Provide a working FileReader mock so onload fires
    const mockFileReaderInstance = {
      onload: null as ((e: unknown) => void) | null,
      readAsDataURL: vi.fn().mockImplementation(function (this: typeof mockFileReaderInstance) {
        if (this.onload) {
          (this.onload as (e: { target: { result: string } }) => void)({
            target: { result: 'data:application/pdf;base64,dGVzdA==' },
          });
        }
      }),
      result: 'data:application/pdf;base64,dGVzdA==',
    };
    vi.spyOn(globalThis, 'FileReader').mockImplementation(
      () => mockFileReaderInstance as unknown as FileReader,
    );

    render(<ResolutionActivityForm {...defaultProps()} />);

    const fileInput = document.getElementById('resolution-file-input') as HTMLInputElement;

    const validFile = new File(['a'.repeat(1024)], 'small.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    // No file error should be shown
    expect(screen.queryByText('File exceeds 5 MB limit.')).not.toBeInTheDocument();

    vi.restoreAllMocks();
  });

  // ── Test 4: 409 conflict ───────────────────────────────────────────────────
  it('shows a conflict message when the save API returns 409', async () => {
    const conflictError = Object.assign(new Error('conflict'), {
      isAxiosError: true,
      response: { status: 409 },
    });
    mockApiPost.mockRejectedValueOnce(conflictError);

    render(<ResolutionActivityForm {...defaultProps()} />);

    await fillValidForm();
    const saveBtn = screen.getByRole('button', { name: /save activity/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Data has changed. Please refresh and try again.'),
      ).toBeInTheDocument();
    });
  });

  // ── Test 5: 422 validation ────────────────────────────────────────────────
  it('shows the API message when the save API returns 422', async () => {
    const validationError = Object.assign(new Error('validation'), {
      isAxiosError: true,
      response: { status: 422, data: { message: 'Step is mandatory.' } },
    });
    mockApiPost.mockRejectedValueOnce(validationError);

    render(<ResolutionActivityForm {...defaultProps()} />);

    await fillValidForm();
    const saveBtn = screen.getByRole('button', { name: /save activity/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Step is mandatory.')).toBeInTheDocument();
    });
  });

  // ── Test 6: version in payload ────────────────────────────────────────────
  it('includes the version prop in the resolution activity POST body', async () => {
    mockApiPost.mockResolvedValueOnce(resolutionSuccessResponse);

    const onSaved = vi.fn();
    render(<ResolutionActivityForm {...defaultProps({ version: 7, onSaved })} />);

    await fillValidForm();
    const saveBtn = screen.getByRole('button', { name: /save activity/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });

    // The first (and only) call should be to the resolution-activities endpoint
    const [, payload] = mockApiPost.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload).toMatchObject({ version: 7 });
  });

  // ── Test 7: Outcome required validation ───────────────────────────────────
  it('shows an outcome validation error and does NOT call the API when Save is clicked without an outcome', async () => {
    render(<ResolutionActivityForm {...defaultProps()} />);

    // Fill remarks but leave outcome empty
    const remarksInput = screen.getByRole('textbox', { name: /remarks/i });
    fireEvent.change(remarksInput, { target: { value: 'Some remarks' } });

    const saveBtn = screen.getByRole('button', { name: /save activity/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Please select an outcome.')).toBeInTheDocument();
    });

    expect(mockApiPost).not.toHaveBeenCalled();
  });

  // ── Test 8: Successful save calls onSaved ─────────────────────────────────
  it('calls onSaved with the API result after a successful save', async () => {
    mockApiPost.mockResolvedValueOnce(resolutionSuccessResponse);

    const onSaved = vi.fn();
    render(<ResolutionActivityForm {...defaultProps({ onSaved })} />);

    await fillValidForm();
    const saveBtn = screen.getByRole('button', { name: /save activity/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });

    expect(onSaved).toHaveBeenCalledWith(
      resolutionSuccessResponse.data.data,
    );
  });
});
