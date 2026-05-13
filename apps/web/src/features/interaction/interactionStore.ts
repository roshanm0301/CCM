/**
 * Interaction store — Zustand.
 *
 * Holds all client-side state for the active interaction lifecycle:
 * IDENTIFYING → CONTEXT_CONFIRMED → WRAPUP → CLOSED/INCOMPLETE.
 *
 * Source: ux-specification.md Screens 3–7, enums.ts InteractionStatus
 *         CCM_Phase1_Agent_Interaction_Documentation.md
 */

import { create } from 'zustand';
import { InteractionStatus } from '@ccm/types';

// ---------------------------------------------------------------------------
// Search types (mirrors SearchResponse from phase1-technical-blueprint §5.12)
// ---------------------------------------------------------------------------

export interface SearchResultVehicle {
  vehicleRef: string;
  registrationNumber: string;
  modelName: string;
  variant: string;
  dealerRef: string | null;
}

export interface SearchResultItem {
  customerRef: string;
  customerName: string;
  primaryMobile: string;
  email: string | null;
  vehicles: SearchResultVehicle[];
  sourceSystem: 'INSTALL_BASE' | 'CUSTOMER_MASTER';
}

// ---------------------------------------------------------------------------
// Context types (mirrors context API responses)
// ---------------------------------------------------------------------------

export interface CustomerContext {
  customerRef: string;
  contactName: string;
  primaryMobile: string;
  secondaryMobile: string | null;
  emailId: string | null;
  address: string | null;
  sourceSystem: string;
}

export interface VehicleContext {
  vehicleRef: string;
  productType: string | null;
  modelName: string;
  variant: string;
  registrationNumber: string;
  chassisNumberMasked: string;
  soldOnDate: string | null;
  lastServiceDate: string | null;
  dealerRef: string | null;
  sourceSystem: string;
}

export interface DealerContext {
  dealerRef: string;
  dealerName: string;
  dealerCode: string;
  branchName: string | null;
  asc: string | null;
  city: string | null;
  address: string | null;
  pinCode: string | null;
  dealerType: string | null;
  isActive: boolean;
  sourceSystem: string;
}

// ---------------------------------------------------------------------------
// Wrapup types
// ---------------------------------------------------------------------------

export interface WrapupData {
  contactReasonCode: string;
  identificationOutcomeCode: string;
  interactionDispositionCode: string;
  remarks: string | null;
}

// ---------------------------------------------------------------------------
// Closure outcome for Screen 7
// ---------------------------------------------------------------------------

export type ClosureOutcome = 'CLOSED' | 'INCOMPLETE' | null;

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface InteractionState {
  // Core interaction
  interactionId: string | null;
  status: InteractionStatus | null;
  startedAt: string | null;
  channel: 'manual' | 'inbound_call' | null;
  /** The caller's PSTN number — populated for inbound_call interactions only. */
  ctiFromNumber: string | null;

  // Search
  searchResults: SearchResultItem[] | null;
  selectedCustomerRef: string | null;
  selectedVehicleRef: string | null;
  selectedDealerRef: string | null;

  // Context data
  customerContext: CustomerContext | null;
  vehicleContext: VehicleContext | null;
  dealerContext: DealerContext | null;

  // Wrapup
  savedWrapup: WrapupData | null;

  // Closure
  closureOutcome: ClosureOutcome;

  // Wrapup enforcement lock
  /** True when the call has ended and the agent must complete wrapup before navigating away. */
  isWrapupPending: boolean;

  // Actions
  setInteraction: (id: string, status: InteractionStatus, startedAt: string, channel?: 'manual') => void;
  /**
   * Open an inbound_call interaction created from a live TeleCMI call.
   * Sets channel to 'inbound_call', stores the caller's PSTN number, and
   * optionally seeds searchResults in the SAME atomic store write so that
   * SearchPanel's lazy useState initializer can read both ctiFromNumber and
   * searchResults in the very first render — avoiding a second render cycle.
   */
  setInboundCallInteraction: (
    id: string,
    status: InteractionStatus,
    startedAt: string,
    fromNumber: string,
    initialSearchResults?: SearchResultItem[] | null,
  ) => void;
  /**
   * Restore an existing interaction into the store after a page refresh (409 auto-resume).
   * `channel` and `ctiFromNumber` are included so the InteractionMetaBar can show the
   * inbound-call badge correctly when an agent refreshes during an active inbound call.
   */
  resumeInteraction: (payload: {
    id: string;
    status: InteractionStatus;
    startedAt: string;
    channel?: 'manual' | 'inbound_call';
    ctiFromNumber?: string | null;
  }) => void;
  setStatus: (status: InteractionStatus) => void;
  setSearchResults: (results: SearchResultItem[]) => void;
  setSelectedRefs: (customerRef: string, vehicleRef: string | null, dealerRef: string | null) => void;
  /** Clears all selected refs and search results — used when the agent changes their selection. */
  clearSelection: () => void;
  setCustomerContext: (ctx: CustomerContext | null) => void;
  setVehicleContext: (ctx: VehicleContext | null) => void;
  setDealerContext: (ctx: DealerContext | null) => void;
  setSavedWrapup: (wrapup: WrapupData) => void;
  setClosure: (outcome: ClosureOutcome) => void;
  setWrapupPending: (pending: boolean) => void;
  resetInteraction: () => void;
}

const initialState = {
  interactionId: null,
  status: null,
  startedAt: null,
  channel: null as 'manual' | 'inbound_call' | null,
  ctiFromNumber: null as string | null,
  // Search
  searchResults: null,
  selectedCustomerRef: null,
  selectedVehicleRef: null,
  selectedDealerRef: null,
  // Context
  customerContext: null,
  vehicleContext: null,
  dealerContext: null,
  // Wrapup / Closure
  savedWrapup: null,
  closureOutcome: null as ClosureOutcome,
  isWrapupPending: false,
};

export const useInteractionStore = create<InteractionState>((set) => ({
  ...initialState,

  setInteraction: (id, status, startedAt, channel) =>
    set({ ...initialState, interactionId: id, status, startedAt, channel: channel ?? 'manual' }),

  setInboundCallInteraction: (id, status, startedAt, fromNumber, initialSearchResults) =>
    set({
      ...initialState,
      interactionId: id,
      status,
      startedAt,
      channel: 'inbound_call',
      ctiFromNumber: fromNumber,
      // Seed search results in the same atomic write so the store is fully
      // consistent at mount time — SearchPanel's lazy useState initializer
      // reads both ctiFromNumber and searchResults in one render.
      searchResults: initialSearchResults ?? null,
    }),

  resumeInteraction: ({ id, status, startedAt, channel, ctiFromNumber }) =>
    set({
      ...initialState,
      interactionId: id,
      status,
      startedAt,
      channel: channel ?? 'manual',
      ctiFromNumber: ctiFromNumber ?? null,
    }),

  setStatus: (status) =>
    set({ status }),

  setSearchResults: (results) =>
    set({ searchResults: results }),

  setSelectedRefs: (customerRef, vehicleRef, dealerRef) =>
    set({
      selectedCustomerRef: customerRef,
      selectedVehicleRef: vehicleRef,
      selectedDealerRef: dealerRef,
    }),

  clearSelection: () =>
    set({
      selectedCustomerRef: null,
      selectedVehicleRef: null,
      selectedDealerRef: null,
      searchResults: null,
      customerContext: null,
      vehicleContext: null,
      dealerContext: null,
    }),

  setCustomerContext: (ctx) => set({ customerContext: ctx }),
  setVehicleContext: (ctx) => set({ vehicleContext: ctx }),
  setDealerContext: (ctx) => set({ dealerContext: ctx }),

  setSavedWrapup: (wrapup) => set({ savedWrapup: wrapup }),

  setClosure: (outcome) => set({ closureOutcome: outcome }),

  setWrapupPending: (pending) => set({ isWrapupPending: pending }),

  resetInteraction: () => set({ ...initialState }),
}));
