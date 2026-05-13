// @vitest-environment jsdom

/**
 * CaseSuccessModal — component unit tests.
 *
 * Covered scenarios:
 * 5. Modal renders all 4 fields (Case ID, Case Nature, Status chip, Registered At)
 * 6. Backdrop click does NOT call onClose
 * 7. Escape key does NOT call onClose (disableEscapeKeyDown)
 * 8. "Close" button calls onClose once
 * 9. "View Case" navigates to /cases/:caseId and calls onClose
 *
 * Source: CCM Phase 4 Case Creation Workspace spec.
 */

import { expect as vitestExpect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
vitestExpect.extend(matchers);

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mock react-router-dom's useNavigate
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ---------------------------------------------------------------------------
// Mock formatDateTime so tests are locale-independent
// ---------------------------------------------------------------------------

vi.mock('@/shared/utils/dateFormatter', () => ({
  formatDateTime: (iso: string) => `formatted:${iso}`,
}));

// ---------------------------------------------------------------------------
// Import component after mocks are established
// ---------------------------------------------------------------------------

import { CaseSuccessModal } from '../CaseSuccessModal';
import type { CaseDto } from '../casesApi';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_CASE: CaseDto = {
  id: '507f1f77bcf86cd799439011',
  caseId: 'ISR-001',
  interactionId: '550e8400-e29b-41d4-a716-446655440000',
  customerRef: 'CUST-001',
  vehicleRef: 'VH-001',
  dealerRef: '507f1f77bcf86cd799439020',
  caseNature: 'Complaint',
  department: 'Sales',
  priority: 'High',
  productType: 'Motorcycle',
  productTypeSource: 'Derived',
  caseCategoryId: '507f1f77bcf86cd799439030',
  caseSubcategoryId: '507f1f77bcf86cd799439040',
  customerRemarks: 'Customer is not happy',
  agentRemarks: 'Escalated to manager',
  caseStatus: 'Open',
  activityStatus: 'Fresh',
  registeredAt: '2026-03-20T10:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderModal(open: boolean, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <CaseSuccessModal open={open} registeredCase={MOCK_CASE} onClose={onClose} />
    </MemoryRouter>,
  );
}

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
// Test 5 — Modal renders all 4 required fields
// ---------------------------------------------------------------------------

describe('CaseSuccessModal — field rendering', () => {
  it('displays Case ID, Case Nature, Status chip, and Registered At when open=true', () => {
    renderModal(true);

    // Case ID
    expect(screen.getByText('ISR-001')).toBeInTheDocument();

    // Case Nature
    expect(screen.getByText('Complaint')).toBeInTheDocument();

    // Status chip — the Chip renders its label as text
    expect(screen.getByText('Open')).toBeInTheDocument();

    // Registered At — formatDateTime mock prefixes with "formatted:"
    expect(screen.getByText('formatted:2026-03-20T10:00:00.000Z')).toBeInTheDocument();
  });

  it('does not render modal content when open=false', () => {
    renderModal(false);

    // MUI Dialog with open=false keeps the DOM detached (or hidden)
    // The Case ID text should not be accessible
    expect(screen.queryByText('ISR-001')).not.toBeInTheDocument();
  });

  it('renders the dialog title "Case Registered Successfully"', () => {
    renderModal(true);

    expect(screen.getByText(/case registered successfully/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 6 — Backdrop click does NOT call onClose
// ---------------------------------------------------------------------------

describe('CaseSuccessModal — backdrop click', () => {
  it('does NOT call onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    renderModal(true, onClose);

    // The MUI Dialog backdrop has the class MuiBackdrop-root.
    // fireEvent.click on it with reason='backdropClick' triggers the Dialog's
    // onClose handler, but the component guards against it.
    // We simulate the internal MUI behavior: the Dialog calls its onClose
    // with (event, 'backdropClick') — our component returns early for that reason.
    const backdrop = document.querySelector('.MuiBackdrop-root');
    if (backdrop) {
      fireEvent.click(backdrop);
    }

    expect(onClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 7 — Escape key does NOT call onClose
// ---------------------------------------------------------------------------

describe('CaseSuccessModal — Escape key', () => {
  it('does NOT call onClose when the Escape key is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(true, onClose);

    // Focus something inside the dialog so keyboard events are dispatched
    const closeBtn = screen.getByRole('button', { name: /^close$/i });
    closeBtn.focus();

    await user.keyboard('{Escape}');

    // disableEscapeKeyDown + the reason guard both prevent closure
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 8 — "Close" button calls onClose
// ---------------------------------------------------------------------------

describe('CaseSuccessModal — Close button', () => {
  it('calls onClose exactly once when the Close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(true, onClose);

    const closeBtn = screen.getByRole('button', { name: /^close$/i });
    await user.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Test 9 — "View Case" navigates and calls onClose
// ---------------------------------------------------------------------------

describe('CaseSuccessModal — View Case button', () => {
  it('navigates to /cases/:caseId and calls onClose when View Case is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(true, onClose);

    const viewCaseBtn = screen.getByRole('button', { name: /view case ISR-001/i });
    await user.click(viewCaseBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/cases/ISR-001');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls navigate before onClose (order check)', async () => {
    const user = userEvent.setup();
    const callOrder: string[] = [];

    const onClose = vi.fn(() => callOrder.push('onClose'));
    mockNavigate.mockImplementation(() => callOrder.push('navigate'));

    renderModal(true, onClose);

    const viewCaseBtn = screen.getByRole('button', { name: /view case ISR-001/i });
    await user.click(viewCaseBtn);

    expect(callOrder).toEqual(['navigate', 'onClose']);
  });
});
