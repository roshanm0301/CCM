/**
 * Case store — Zustand.
 * Holds client-side state for the Case Creation Workspace.
 * Source: CCM Phase 4 Case Creation Workspace spec.
 */

import { create } from 'zustand';
import type { CaseDto, CaseHistoryItem } from './casesApi';

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface CaseState {
  // Case history
  caseHistory: CaseHistoryItem[];
  openCaseCount: number;
  caseHistoryLoading: boolean;
  caseHistoryError: string | null;

  // Form state
  caseFormOpen: boolean;

  // Post-registration: the registered case (read-only view)
  registeredCase: CaseDto | null;

  // Actions
  setCaseHistory: (items: CaseHistoryItem[], openCount: number) => void;
  setCaseHistoryLoading: (loading: boolean) => void;
  setCaseHistoryError: (err: string | null) => void;
  openCaseForm: () => void;
  closeCaseForm: () => void;
  setRegisteredCase: (c: CaseDto) => void;
  resetCaseWorkspace: () => void;
}

const initialCaseState = {
  caseHistory: [] as CaseHistoryItem[],
  openCaseCount: 0,
  caseHistoryLoading: false,
  caseHistoryError: null as string | null,
  caseFormOpen: false,
  registeredCase: null as CaseDto | null,
};

export const useCaseStore = create<CaseState>((set) => ({
  ...initialCaseState,

  setCaseHistory: (items, openCount) =>
    set({ caseHistory: items, openCaseCount: openCount, caseHistoryError: null }),

  setCaseHistoryLoading: (loading) => set({ caseHistoryLoading: loading }),

  setCaseHistoryError: (err) => set({ caseHistoryError: err }),

  openCaseForm: () => set({ caseFormOpen: true }),

  closeCaseForm: () => set({ caseFormOpen: false }),

  setRegisteredCase: (c) => set({ registeredCase: c }),

  resetCaseWorkspace: () => set({ ...initialCaseState }),
}));
