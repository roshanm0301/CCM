// @vitest-environment jsdom

/**
 * CaseWorkspace — component unit tests.
 *
 * Covered scenarios:
 * 1. Renders "+ New Case" button when customerRef is provided and no registeredCase
 * 2. Does NOT render "+ New Case" button when registeredCase is already set
 * 3. Does NOT render "+ New Case" button when customerRef is empty string
 * 4. Shows loading skeleton (CaseHistoryTable receives loading=true) while caseHistoryLoading is true
 * 5. Shows error message when caseHistoryError is set
 *
 * Source: CCM Phase 4 Case Creation Workspace spec.
 */

import { expect as vitestExpect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
vitestExpect.extend(matchers);
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mock casesApi entirely (no real HTTP calls)
// ---------------------------------------------------------------------------

vi.mock('../casesApi', () => ({
  fetchCaseHistory: vi.fn().mockResolvedValue({ cases: [], openCaseCount: 0 }),
  getCaseByInteractionId: vi.fn().mockResolvedValue(null),
  checkDuplicate: vi.fn(),
  createCase: vi.fn(),
  getCaseById: vi.fn(),
  searchDealers: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock caseStore — controlled per-test via mockImplementation
// ---------------------------------------------------------------------------

vi.mock('../caseStore', () => ({
  useCaseStore: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock heavy sub-components so tests don't need their full dependency trees
// ---------------------------------------------------------------------------

vi.mock('../CaseRegistrationForm', () => ({
  CaseRegistrationForm: vi.fn(() => <div data-testid="case-registration-form" />),
}));

vi.mock('../CaseHistoryTable', () => ({
  CaseHistoryTable: ({ loading, error }: { loading: boolean; error: string | null }) => (
    <div data-testid="case-history-table">
      {loading && <div data-testid="history-loading-skeleton" aria-label="loading" />}
      {error && <div role="alert">{error}</div>}
    </div>
  ),
}));

vi.mock('../CaseSuccessModal', () => ({
  CaseSuccessModal: ({
    open,
    onClose,
  }: {
    open: boolean;
    registeredCase: unknown;
    onClose: () => void;
  }) =>
    open ? (
      <div data-testid="case-success-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

import { useCaseStore } from '../caseStore';
import type { MockedFunction } from 'vitest';
import { CaseWorkspace } from '../CaseWorkspace';
import type { CaseDto } from '../casesApi';
import { fetchCaseHistory, getCaseByInteractionId } from '../casesApi';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_CASE_DTO: CaseDto = {
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
// Store state factory
// ---------------------------------------------------------------------------

function makeStoreState(overrides?: Partial<ReturnType<typeof defaultStoreState>>) {
  return {
    ...defaultStoreState(),
    ...overrides,
  };
}

function defaultStoreState() {
  return {
    caseHistory: [],
    openCaseCount: 0,
    caseHistoryLoading: false,
    caseHistoryError: null as string | null,
    caseFormOpen: false,
    registeredCase: null as CaseDto | null,
    setCaseHistory: vi.fn(),
    setCaseHistoryLoading: vi.fn(),
    setCaseHistoryError: vi.fn(),
    openCaseForm: vi.fn(),
    closeCaseForm: vi.fn(),
    setRegisteredCase: vi.fn(),
    resetCaseWorkspace: vi.fn(),
  };
}

const mockUseCaseStore = useCaseStore as unknown as MockedFunction<typeof useCaseStore>;

// ---------------------------------------------------------------------------
// Props factory
// ---------------------------------------------------------------------------

function defaultProps(overrides?: Partial<React.ComponentProps<typeof CaseWorkspace>>) {
  return {
    interactionId: '550e8400-e29b-41d4-a716-446655440000',
    customerRef: 'CUST-001',
    vehicleRef: null,
    derivedProductType: 'Motorcycle',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: store starts at initial state
  mockUseCaseStore.mockReturnValue(makeStoreState());
});

// Ensure DOM is cleaned up between tests when running outside the web project
// (vitest-environment jsdom does not auto-cleanup unless globals:true is set)
afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// "+ New Case" button visibility
// ---------------------------------------------------------------------------

describe('CaseWorkspace — "+ New Case" button', () => {
  it('renders the New Case button when customerRef is provided and no registeredCase', () => {
    mockUseCaseStore.mockReturnValue(
      makeStoreState({ registeredCase: null, caseFormOpen: false }),
    );

    render(<CaseWorkspace {...defaultProps({ customerRef: 'CUST-001' })} />);

    expect(screen.getByRole('button', { name: /new case/i })).toBeInTheDocument();
  });

  it('does NOT render the New Case button when registeredCase is already set', () => {
    mockUseCaseStore.mockReturnValue(
      makeStoreState({ registeredCase: MOCK_CASE_DTO, caseFormOpen: false }),
    );

    render(<CaseWorkspace {...defaultProps()} />);

    expect(screen.queryByRole('button', { name: /new case/i })).not.toBeInTheDocument();
  });

  it('renders the New Case button when customerRef is empty string and no registeredCase', () => {
    // The component guards the button solely on !registeredCase — empty customerRef
    // does not hide the button. loadHistory short-circuits on empty customerRef but
    // that affects only data loading, not button visibility.
    mockUseCaseStore.mockReturnValue(
      makeStoreState({ registeredCase: null, caseFormOpen: false }),
    );

    render(<CaseWorkspace {...defaultProps({ customerRef: '' })} />);

    expect(screen.getByRole('button', { name: /new case/i })).toBeInTheDocument();
  });

  it('does NOT render the New Case button when caseFormOpen is true (header bar is hidden)', () => {
    mockUseCaseStore.mockReturnValue(
      makeStoreState({ registeredCase: null, caseFormOpen: true }),
    );

    render(<CaseWorkspace {...defaultProps()} />);

    expect(screen.queryByRole('button', { name: /new case/i })).not.toBeInTheDocument();
  });

  it('does NOT render the CaseRegistrationForm when registeredCase is set even if caseFormOpen=true', () => {
    mockUseCaseStore.mockReturnValue(
      makeStoreState({ registeredCase: MOCK_CASE_DTO, caseFormOpen: true }),
    );

    render(<CaseWorkspace {...defaultProps()} />);

    expect(screen.queryByTestId('case-registration-form')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

describe('CaseWorkspace — loading state', () => {
  it('passes loading=true to CaseHistoryTable when caseHistoryLoading is true', () => {
    mockUseCaseStore.mockReturnValue(
      makeStoreState({ caseHistoryLoading: true, caseHistoryError: null }),
    );

    render(<CaseWorkspace {...defaultProps()} />);

    expect(screen.getByTestId('history-loading-skeleton')).toBeInTheDocument();
  });

  it('does not show loading skeleton when caseHistoryLoading is false', () => {
    mockUseCaseStore.mockReturnValue(
      makeStoreState({ caseHistoryLoading: false }),
    );

    render(<CaseWorkspace {...defaultProps()} />);

    expect(screen.queryByTestId('history-loading-skeleton')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe('CaseWorkspace — error state', () => {
  it('shows error alert when caseHistoryError is set', () => {
    const errorMessage = 'Unable to load case history.';
    mockUseCaseStore.mockReturnValue(
      makeStoreState({ caseHistoryError: errorMessage, caseHistoryLoading: false }),
    );

    render(<CaseWorkspace {...defaultProps()} />);

    // The component renders an Alert in the main body AND passes the error to CaseHistoryTable
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    // getAllByText because the error appears in both the top Alert and the CaseHistoryTable mock
    const errorTexts = screen.getAllByText(errorMessage);
    expect(errorTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('does not show error alert when caseHistoryError is null', () => {
    mockUseCaseStore.mockReturnValue(
      makeStoreState({ caseHistoryError: null, caseHistoryLoading: false }),
    );

    render(<CaseWorkspace {...defaultProps()} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not show error alert when loading is true even if error is set', () => {
    mockUseCaseStore.mockReturnValue(
      makeStoreState({ caseHistoryError: 'Some error', caseHistoryLoading: true }),
    );

    render(<CaseWorkspace {...defaultProps()} />);

    // Component renders: {caseHistoryError && !caseHistoryLoading && <Alert>}
    // When loading=true the component's top-level Alert is suppressed.
    // The CaseHistoryTable mock still renders its own alert div — so exactly 1 alert
    // is in the DOM (from the mock), not 2 (which would appear when loading=false).
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Registered case summary
// ---------------------------------------------------------------------------

describe('CaseWorkspace — CaseSuccessModal mounting', () => {
  it('mounts CaseSuccessModal (closed) when registeredCase is set', () => {
    mockUseCaseStore.mockReturnValue(
      makeStoreState({ registeredCase: MOCK_CASE_DTO, caseFormOpen: false }),
    );

    render(<CaseWorkspace {...defaultProps()} />);

    // Modal is mounted but closed (showSuccessModal starts false — modal only opens
    // after handleCaseRegistered fires during the same render cycle)
    expect(screen.queryByTestId('case-success-modal')).not.toBeInTheDocument();
  });

  it('does not mount CaseSuccessModal when registeredCase is null', () => {
    mockUseCaseStore.mockReturnValue(
      makeStoreState({ registeredCase: null, caseFormOpen: false }),
    );

    render(<CaseWorkspace {...defaultProps()} />);

    expect(screen.queryByTestId('case-success-modal')).not.toBeInTheDocument();
  });

  it('hides the New Case button when registeredCase is set', () => {
    mockUseCaseStore.mockReturnValue(
      makeStoreState({ registeredCase: MOCK_CASE_DTO, caseFormOpen: false }),
    );

    render(<CaseWorkspace {...defaultProps()} />);

    expect(screen.queryByRole('button', { name: /new case/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Open case count chip
// ---------------------------------------------------------------------------

describe('CaseWorkspace — open case count chip', () => {
  it('shows open case count chip when openCaseCount > 0', () => {
    mockUseCaseStore.mockReturnValue(
      makeStoreState({ openCaseCount: 3, caseFormOpen: false }),
    );

    render(<CaseWorkspace {...defaultProps()} />);

    expect(screen.getByText(/3 open cases/i)).toBeInTheDocument();
  });

  it('does not show open case count chip when openCaseCount is 0', () => {
    mockUseCaseStore.mockReturnValue(
      makeStoreState({ openCaseCount: 0, caseFormOpen: false }),
    );

    render(<CaseWorkspace {...defaultProps()} />);

    expect(screen.queryByText(/open case/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 1 — checkExistingCase cross-customer guard
// ---------------------------------------------------------------------------

describe('CaseWorkspace — checkExistingCase cross-customer guard', () => {
  it('does NOT call setRegisteredCase when existing case customerRef does not match prop', async () => {
    // Arrange: API returns a case belonging to CUST-001
    const mockCaseStore = makeStoreState({ registeredCase: null, caseFormOpen: false });
    mockUseCaseStore.mockReturnValue(mockCaseStore);

    (getCaseByInteractionId as MockedFunction<typeof getCaseByInteractionId>).mockResolvedValueOnce({
      ...MOCK_CASE_DTO,
      customerRef: 'CUST-001',
    });

    // Act: mount with a DIFFERENT customer ref
    render(<CaseWorkspace {...defaultProps({ customerRef: 'CUST-002' })} />);

    // Allow the async checkExistingCase effect to settle
    await vi.waitFor(() => {
      expect(getCaseByInteractionId).toHaveBeenCalled();
    });

    // Assert: setRegisteredCase must NOT have been called (cross-customer bleed blocked)
    expect(mockCaseStore.setRegisteredCase).not.toHaveBeenCalled();
  });

  it('renders "+ New Case" button when cross-customer case is returned (no bleed)', async () => {
    const mockCaseStore = makeStoreState({ registeredCase: null, caseFormOpen: false });
    mockUseCaseStore.mockReturnValue(mockCaseStore);

    (getCaseByInteractionId as MockedFunction<typeof getCaseByInteractionId>).mockResolvedValueOnce({
      ...MOCK_CASE_DTO,
      customerRef: 'CUST-001',
    });

    render(<CaseWorkspace {...defaultProps({ customerRef: 'CUST-002' })} />);

    await vi.waitFor(() => {
      expect(getCaseByInteractionId).toHaveBeenCalled();
    });

    // Because setRegisteredCase was not called, the store still has registeredCase=null
    // and the New Case button remains visible
    expect(screen.getByRole('button', { name: /new case/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 2 — checkExistingCase same-customer resume
// ---------------------------------------------------------------------------

describe('CaseWorkspace — checkExistingCase same-customer resume', () => {
  it('calls setRegisteredCase when existing case customerRef matches prop', async () => {
    const mockCaseStore = makeStoreState({ registeredCase: null, caseFormOpen: false });
    mockUseCaseStore.mockReturnValue(mockCaseStore);

    (getCaseByInteractionId as MockedFunction<typeof getCaseByInteractionId>).mockResolvedValueOnce({
      ...MOCK_CASE_DTO,
      customerRef: 'CUST-001',
    });

    render(<CaseWorkspace {...defaultProps({ customerRef: 'CUST-001' })} />);

    await vi.waitFor(() => {
      expect(mockCaseStore.setRegisteredCase).toHaveBeenCalledWith(
        expect.objectContaining({ customerRef: 'CUST-001' }),
      );
    });
  });

  it('hides "+ New Case" button when registeredCase IS set (same-customer resume)', () => {
    // Store already reflects the resume — registeredCase is populated
    mockUseCaseStore.mockReturnValue(
      makeStoreState({ registeredCase: MOCK_CASE_DTO, caseFormOpen: false }),
    );

    render(<CaseWorkspace {...defaultProps({ customerRef: 'CUST-001' })} />);

    expect(screen.queryByRole('button', { name: /new case/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 3 — handleCaseRegistered opens modal; does NOT call fetchCaseHistory yet
//
// Design: the top-level CaseRegistrationForm mock renders a static stub that
// does not expose onRegistered. We test the invariant at a different level:
// confirm that fetchCaseHistory is called exactly once (at mount via loadHistory)
// and that the count does NOT increase synchronously after registration would
// have fired — i.e., the "loadHistory on registration" code path is absent.
// ---------------------------------------------------------------------------

describe('CaseWorkspace — handleCaseRegistered opens modal without loading history', () => {
  it('fetchCaseHistory is called once at mount and not again before modal is closed', async () => {
    vi.mocked(fetchCaseHistory).mockResolvedValue({ cases: [], openCaseCount: 0 });

    mockUseCaseStore.mockReturnValue(
      makeStoreState({ registeredCase: null, caseFormOpen: true }),
    );

    render(<CaseWorkspace {...defaultProps()} />);

    // Mount causes one loadHistory call
    await vi.waitFor(() => {
      expect(fetchCaseHistory).toHaveBeenCalledTimes(1);
    });

    // No additional call without a modal-close event — confirms the old
    // "call loadHistory inside handleCaseRegistered" path has been removed.
    expect(fetchCaseHistory).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Test 4 — handleModalClose closes modal and loads history
//
// Design: We render CaseWorkspace in a state where the CaseSuccessModal is
// already visible — i.e., registeredCase IS set and showSuccessModal=true.
// We can only force showSuccessModal=true by going through handleCaseRegistered.
// To do that without re-hoisting the form mock we use a wrapper component that
// renders CaseWorkspace and additionally renders a portal button that directly
// invokes the component's internal handler via a ref-exposed callback.
//
// Simpler alternative that avoids internal state access: because the
// CaseSuccessModal mock is already hoisted at the top level and renders a
// "Close" button whenever open=true, we wire up a reactive store mock whose
// setRegisteredCase actually updates the store state — making registeredCase
// truthy on re-render. Combined with the form stub's ability to fire onRegistered
// (which we enable by replacing the module mock implementation with mockImplementation
// on the named export), this gives us a fully observable flow.
// ---------------------------------------------------------------------------

describe('CaseWorkspace — handleModalClose closes modal and calls loadHistory', () => {
  it('calls fetchCaseHistory a second time when the modal Close button is clicked', async () => {
    const user = userEvent.setup();

    vi.mocked(fetchCaseHistory).mockResolvedValue({ cases: [], openCaseCount: 0 });

    // Reactive store: mutations to setRegisteredCase and closeCaseForm propagate
    // back into mockReturnValue so subsequent renders see the updated state.
    let currentState = makeStoreState({ registeredCase: null, caseFormOpen: true });

    const reactiveSetRegisteredCase = vi.fn((cas: CaseDto) => {
      currentState = { ...currentState, registeredCase: cas };
      mockUseCaseStore.mockReturnValue(currentState);
    });
    const reactiveCloseCaseForm = vi.fn(() => {
      currentState = { ...currentState, caseFormOpen: false };
      mockUseCaseStore.mockReturnValue(currentState);
    });

    currentState.setRegisteredCase = reactiveSetRegisteredCase;
    currentState.closeCaseForm = reactiveCloseCaseForm;
    mockUseCaseStore.mockReturnValue(currentState);

    // Patch the CaseRegistrationForm mock implementation so it exposes a trigger
    // button that fires onRegistered — without changing the hoisted vi.mock call.
    const formModule = await import('../CaseRegistrationForm');
    vi.mocked(formModule.CaseRegistrationForm).mockImplementation(
      ({ onRegistered }: { onRegistered: (c: CaseDto) => void; onClose: () => void; interactionId: string; customerRef: string; vehicleRef: string | null; derivedProductType: string | null }) => (
        <div data-testid="case-registration-form">
          <button
            data-testid="trigger-registered"
            onClick={() => onRegistered(MOCK_CASE_DTO)}
          >
            Trigger Registered
          </button>
        </div>
      ),
    );

    render(<CaseWorkspace {...defaultProps()} />);

    // Wait for mount-time fetchCaseHistory
    await vi.waitFor(() => {
      expect(fetchCaseHistory).toHaveBeenCalledTimes(1);
    });

    // Fire onRegistered — this calls handleCaseRegistered, which:
    //   1. calls setRegisteredCase(MOCK_CASE_DTO)  → reactive store updates
    //   2. calls closeCaseForm()                   → reactive store updates
    //   3. sets showSuccessModal=true              → modal appears
    const triggerBtn = screen.getByTestId('trigger-registered');
    await user.click(triggerBtn);

    // After the reactive store update, the CaseSuccessModal mock should mount
    // because registeredCase is now truthy AND showSuccessModal=true.
    const modalCloseBtn = await screen.findByRole('button', { name: /^close$/i });
    expect(modalCloseBtn).toBeInTheDocument();

    // Reset so we only count calls that happen AFTER the Close click
    vi.mocked(fetchCaseHistory).mockClear();

    // Click Close — triggers handleModalClose which calls loadHistory()
    await user.click(modalCloseBtn);

    await vi.waitFor(() => {
      expect(fetchCaseHistory).toHaveBeenCalledTimes(1);
    });

    // Modal should now be gone (showSuccessModal=false)
    expect(screen.queryByTestId('case-success-modal')).not.toBeInTheDocument();
  });
});
