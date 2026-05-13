/**
 * caseStore — Zustand store unit tests.
 *
 * Covered scenarios:
 * 1. Initial state: caseFormOpen false, caseHistory [], registeredCase null
 * 2. openCaseForm() sets caseFormOpen to true
 * 3. closeCaseForm() sets caseFormOpen to false
 * 4. setRegisteredCase(case) stores the case object
 * 5. setCaseHistory([...]) stores the history array and openCaseCount
 * 6. setCaseHistoryLoading(true/false) toggles the loading flag
 * 7. setCaseHistoryError sets and clears the error string
 * 8. resetCaseWorkspace() resets all fields to initial values
 *
 * Source: CCM Phase 4 Case Creation Workspace spec.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCaseStore } from '../caseStore';
import type { CaseDto, CaseHistoryItem } from '../casesApi';

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

const MOCK_HISTORY_ITEMS: CaseHistoryItem[] = [
  {
    id: '507f1f77bcf86cd799439011',
    caseId: 'ISR-001',
    caseNature: 'Complaint',
    caseStatus: 'Open',
    activityStatus: 'Fresh',
    registeredAt: '2026-03-20T10:00:00.000Z',
  },
  {
    id: '507f1f77bcf86cd799439012',
    caseId: 'ISR-002',
    caseNature: 'Inquiry',
    caseStatus: 'Pending Verification',
    activityStatus: 'In Progress',
    registeredAt: '2026-03-19T08:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Setup — reset store to initial state before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  useCaseStore.getState().resetCaseWorkspace();
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('initial state', () => {
  it('caseFormOpen is false initially', () => {
    const { caseFormOpen } = useCaseStore.getState();
    expect(caseFormOpen).toBe(false);
  });

  it('caseHistory is an empty array initially', () => {
    const { caseHistory } = useCaseStore.getState();
    expect(caseHistory).toEqual([]);
  });

  it('registeredCase is null initially', () => {
    const { registeredCase } = useCaseStore.getState();
    expect(registeredCase).toBeNull();
  });

  it('openCaseCount is 0 initially', () => {
    const { openCaseCount } = useCaseStore.getState();
    expect(openCaseCount).toBe(0);
  });

  it('caseHistoryLoading is false initially', () => {
    const { caseHistoryLoading } = useCaseStore.getState();
    expect(caseHistoryLoading).toBe(false);
  });

  it('caseHistoryError is null initially', () => {
    const { caseHistoryError } = useCaseStore.getState();
    expect(caseHistoryError).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// openCaseForm / closeCaseForm
// ---------------------------------------------------------------------------

describe('openCaseForm()', () => {
  it('sets caseFormOpen to true', () => {
    useCaseStore.getState().openCaseForm();
    expect(useCaseStore.getState().caseFormOpen).toBe(true);
  });

  it('does not affect other state fields', () => {
    useCaseStore.getState().openCaseForm();
    expect(useCaseStore.getState().registeredCase).toBeNull();
    expect(useCaseStore.getState().caseHistory).toEqual([]);
  });
});

describe('closeCaseForm()', () => {
  it('sets caseFormOpen to false after it was true', () => {
    useCaseStore.getState().openCaseForm();
    expect(useCaseStore.getState().caseFormOpen).toBe(true);

    useCaseStore.getState().closeCaseForm();
    expect(useCaseStore.getState().caseFormOpen).toBe(false);
  });

  it('is idempotent: closeCaseForm when already false keeps it false', () => {
    useCaseStore.getState().closeCaseForm();
    expect(useCaseStore.getState().caseFormOpen).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// setRegisteredCase
// ---------------------------------------------------------------------------

describe('setRegisteredCase()', () => {
  it('stores the case object', () => {
    useCaseStore.getState().setRegisteredCase(MOCK_CASE_DTO);
    expect(useCaseStore.getState().registeredCase).toEqual(MOCK_CASE_DTO);
  });

  it('stores the correct caseId', () => {
    useCaseStore.getState().setRegisteredCase(MOCK_CASE_DTO);
    expect(useCaseStore.getState().registeredCase?.caseId).toBe('ISR-001');
  });

  it('stores the correct interactionId', () => {
    useCaseStore.getState().setRegisteredCase(MOCK_CASE_DTO);
    expect(useCaseStore.getState().registeredCase?.interactionId).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('replaces a previously stored case with the new one', () => {
    useCaseStore.getState().setRegisteredCase(MOCK_CASE_DTO);

    const newCase: CaseDto = { ...MOCK_CASE_DTO, caseId: 'ISR-002', id: '507f1f77bcf86cd799439099' };
    useCaseStore.getState().setRegisteredCase(newCase);

    expect(useCaseStore.getState().registeredCase?.caseId).toBe('ISR-002');
  });
});

// ---------------------------------------------------------------------------
// setCaseHistory
// ---------------------------------------------------------------------------

describe('setCaseHistory()', () => {
  it('stores the history array', () => {
    useCaseStore.getState().setCaseHistory(MOCK_HISTORY_ITEMS, 2);
    expect(useCaseStore.getState().caseHistory).toEqual(MOCK_HISTORY_ITEMS);
  });

  it('stores the openCaseCount alongside the items', () => {
    useCaseStore.getState().setCaseHistory(MOCK_HISTORY_ITEMS, 2);
    expect(useCaseStore.getState().openCaseCount).toBe(2);
  });

  it('clears caseHistoryError when setCaseHistory is called', () => {
    useCaseStore.getState().setCaseHistoryError('Some error');
    useCaseStore.getState().setCaseHistory(MOCK_HISTORY_ITEMS, 2);
    expect(useCaseStore.getState().caseHistoryError).toBeNull();
  });

  it('stores an empty array when called with []', () => {
    useCaseStore.getState().setCaseHistory(MOCK_HISTORY_ITEMS, 2);
    useCaseStore.getState().setCaseHistory([], 0);
    expect(useCaseStore.getState().caseHistory).toEqual([]);
    expect(useCaseStore.getState().openCaseCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// setCaseHistoryLoading
// ---------------------------------------------------------------------------

describe('setCaseHistoryLoading()', () => {
  it('sets loading to true', () => {
    useCaseStore.getState().setCaseHistoryLoading(true);
    expect(useCaseStore.getState().caseHistoryLoading).toBe(true);
  });

  it('sets loading to false', () => {
    useCaseStore.getState().setCaseHistoryLoading(true);
    useCaseStore.getState().setCaseHistoryLoading(false);
    expect(useCaseStore.getState().caseHistoryLoading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// setCaseHistoryError
// ---------------------------------------------------------------------------

describe('setCaseHistoryError()', () => {
  it('stores an error string', () => {
    useCaseStore.getState().setCaseHistoryError('Unable to load case history.');
    expect(useCaseStore.getState().caseHistoryError).toBe('Unable to load case history.');
  });

  it('clears the error by setting null', () => {
    useCaseStore.getState().setCaseHistoryError('Some error');
    useCaseStore.getState().setCaseHistoryError(null);
    expect(useCaseStore.getState().caseHistoryError).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resetCaseWorkspace
// ---------------------------------------------------------------------------

describe('resetCaseWorkspace()', () => {
  it('resets caseFormOpen to false', () => {
    useCaseStore.getState().openCaseForm();
    useCaseStore.getState().resetCaseWorkspace();
    expect(useCaseStore.getState().caseFormOpen).toBe(false);
  });

  it('resets caseHistory to empty array', () => {
    useCaseStore.getState().setCaseHistory(MOCK_HISTORY_ITEMS, 2);
    useCaseStore.getState().resetCaseWorkspace();
    expect(useCaseStore.getState().caseHistory).toEqual([]);
  });

  it('resets registeredCase to null', () => {
    useCaseStore.getState().setRegisteredCase(MOCK_CASE_DTO);
    useCaseStore.getState().resetCaseWorkspace();
    expect(useCaseStore.getState().registeredCase).toBeNull();
  });

  it('resets openCaseCount to 0', () => {
    useCaseStore.getState().setCaseHistory(MOCK_HISTORY_ITEMS, 5);
    useCaseStore.getState().resetCaseWorkspace();
    expect(useCaseStore.getState().openCaseCount).toBe(0);
  });

  it('resets caseHistoryLoading to false', () => {
    useCaseStore.getState().setCaseHistoryLoading(true);
    useCaseStore.getState().resetCaseWorkspace();
    expect(useCaseStore.getState().caseHistoryLoading).toBe(false);
  });

  it('resets caseHistoryError to null', () => {
    useCaseStore.getState().setCaseHistoryError('Some error');
    useCaseStore.getState().resetCaseWorkspace();
    expect(useCaseStore.getState().caseHistoryError).toBeNull();
  });

  it('resets all fields simultaneously', () => {
    // Set multiple fields to non-initial values
    useCaseStore.getState().openCaseForm();
    useCaseStore.getState().setRegisteredCase(MOCK_CASE_DTO);
    useCaseStore.getState().setCaseHistory(MOCK_HISTORY_ITEMS, 2);
    useCaseStore.getState().setCaseHistoryLoading(true);
    useCaseStore.getState().setCaseHistoryError('error');

    useCaseStore.getState().resetCaseWorkspace();

    const state = useCaseStore.getState();
    expect(state.caseFormOpen).toBe(false);
    expect(state.registeredCase).toBeNull();
    expect(state.caseHistory).toEqual([]);
    expect(state.openCaseCount).toBe(0);
    expect(state.caseHistoryLoading).toBe(false);
    expect(state.caseHistoryError).toBeNull();
  });
});
