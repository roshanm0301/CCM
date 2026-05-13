/**
 * interactionStore — unit tests.
 *
 * Covered scenarios:
 * 1. resumeInteraction — restores interaction state from a backend payload.
 * 2. resumeInteraction — clears all prior interaction state before restoring.
 *
 * Sources:
 * - interactionStore.ts resumeInteraction action
 * - CCM_Phase1_Agent_Interaction_Documentation.md §Screen 1 (page-refresh auto-resume)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { InteractionStatus } from '@ccm/types';
import { useInteractionStore } from '../interactionStore';
import type { CustomerContext, VehicleContext, DealerContext } from '../interactionStore';

// ---------------------------------------------------------------------------
// Reset the real Zustand store to a clean initial state before every test.
// resetInteraction() is the canonical reset action defined in the store.
// ---------------------------------------------------------------------------

beforeEach(() => {
  act(() => {
    useInteractionStore.getState().resetInteraction();
  });
});

// ---------------------------------------------------------------------------
// resumeInteraction
// ---------------------------------------------------------------------------

describe('resumeInteraction', () => {
  it('restores interaction state from backend response', () => {
    const { result } = renderHook(() => useInteractionStore());

    act(() => {
      result.current.resumeInteraction({
        id: 'resume-id-abc',
        status: InteractionStatus.IDENTIFYING,
        startedAt: '2026-03-23T10:00:00.000Z',
      });
    });

    expect(result.current.interactionId).toBe('resume-id-abc');
    expect(result.current.status).toBe(InteractionStatus.IDENTIFYING);
    expect(result.current.startedAt).toBe('2026-03-23T10:00:00.000Z');
  });

  it('clears previous interaction state before restoring', () => {
    const { result } = renderHook(() => useInteractionStore());

    // Establish prior state via the normal start path
    act(() => {
      result.current.setInteraction(
        'old-id',
        InteractionStatus.WRAPUP,
        '2026-01-01T00:00:00.000Z',
      );
    });

    // Confirm prior state is present
    expect(result.current.interactionId).toBe('old-id');
    expect(result.current.status).toBe(InteractionStatus.WRAPUP);

    // Now resume a different interaction
    act(() => {
      result.current.resumeInteraction({
        id: 'new-id',
        status: InteractionStatus.IDENTIFYING,
        startedAt: '2026-03-23T10:00:00.000Z',
      });
    });

    // New interaction values must be set
    expect(result.current.interactionId).toBe('new-id');
    expect(result.current.status).toBe(InteractionStatus.IDENTIFYING);

    // All search, context, wrapup, and closure state from the prior session
    // must be cleared by the initialState spread inside resumeInteraction.
    expect(result.current.searchResults).toBeNull();
    expect(result.current.selectedCustomerRef).toBeNull();
    expect(result.current.selectedVehicleRef).toBeNull();
    expect(result.current.selectedDealerRef).toBeNull();
    expect(result.current.customerContext).toBeNull();
    expect(result.current.vehicleContext).toBeNull();
    expect(result.current.dealerContext).toBeNull();
    expect(result.current.savedWrapup).toBeNull();
    expect(result.current.closureOutcome).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GAP 9 (F14): Context store setters and null clearing
//
// Verifies that setCustomerContext(null), setVehicleContext(null), and
// setDealerContext(null) correctly clear context when an agent reselects
// a customer or when a card fetch fails.
// Source: SearchResults.tsx loadContextData, interactionStore.ts
// ---------------------------------------------------------------------------

const CUSTOMER_CTX: CustomerContext = {
  customerRef: 'CUST-001',
  contactName: 'Rahul Sharma',
  primaryMobile: '9876543210',
  secondaryMobile: null,
  emailId: null,
  address: null,
  sourceSystem: 'INSTALL_BASE',
};

const VEHICLE_CTX: VehicleContext = {
  vehicleRef: 'VEH-001',
  productType: 'Motorcycle',
  modelName: 'Activa 6G',
  variant: 'DLX',
  registrationNumber: 'MH12AB1234',
  chassisNumberMasked: 'MD2***1234',
  soldOnDate: null,
  lastServiceDate: null,
  dealerRef: 'DLR-001',
  sourceSystem: 'INSTALL_BASE',
};

const DEALER_CTX: DealerContext = {
  dealerRef: 'DLR-001',
  dealerName: 'Excellent Honda',
  dealerCode: 'EH001',
  branchName: 'Andheri Branch',
  asc: null,
  city: 'Mumbai',
  address: '456 Link Road',
  pinCode: '400053',
  dealerType: 'Dealer',
  isActive: true,
  sourceSystem: 'DMS',
};

describe('setCustomerContext — null clears the store (F14)', () => {
  it('setCustomerContext(null) sets customerContext to null', () => {
    const { result } = renderHook(() => useInteractionStore());

    act(() => {
      result.current.setCustomerContext(CUSTOMER_CTX);
    });
    expect(result.current.customerContext).not.toBeNull();

    act(() => {
      result.current.setCustomerContext(null);
    });
    expect(result.current.customerContext).toBeNull();
  });

  it('setCustomerContext(data) stores the provided customer context object', () => {
    const { result } = renderHook(() => useInteractionStore());

    act(() => {
      result.current.setCustomerContext(CUSTOMER_CTX);
    });

    expect(result.current.customerContext?.customerRef).toBe('CUST-001');
    expect(result.current.customerContext?.contactName).toBe('Rahul Sharma');
  });
});

describe('setVehicleContext — null clears the store (F14)', () => {
  it('setVehicleContext(null) sets vehicleContext to null', () => {
    const { result } = renderHook(() => useInteractionStore());

    act(() => {
      result.current.setVehicleContext(VEHICLE_CTX);
    });
    expect(result.current.vehicleContext).not.toBeNull();

    act(() => {
      result.current.setVehicleContext(null);
    });
    expect(result.current.vehicleContext).toBeNull();
  });

  it('setVehicleContext(data) stores the provided vehicle context object', () => {
    const { result } = renderHook(() => useInteractionStore());

    act(() => {
      result.current.setVehicleContext(VEHICLE_CTX);
    });

    expect(result.current.vehicleContext?.vehicleRef).toBe('VEH-001');
    expect(result.current.vehicleContext?.registrationNumber).toBe('MH12AB1234');
  });
});

describe('setDealerContext — null clears the store (F14)', () => {
  it('setDealerContext(null) sets dealerContext to null', () => {
    const { result } = renderHook(() => useInteractionStore());

    act(() => {
      result.current.setDealerContext(DEALER_CTX);
    });
    expect(result.current.dealerContext).not.toBeNull();

    act(() => {
      result.current.setDealerContext(null);
    });
    expect(result.current.dealerContext).toBeNull();
  });

  it('setDealerContext(data) stores the provided dealer context object', () => {
    const { result } = renderHook(() => useInteractionStore());

    act(() => {
      result.current.setDealerContext(DEALER_CTX);
    });

    expect(result.current.dealerContext?.dealerRef).toBe('DLR-001');
    expect(result.current.dealerContext?.dealerName).toBe('Excellent Honda');
  });
});

describe('setStatus — transitions (F14)', () => {
  it('setStatus(IDENTIFYING) transitions from CONTEXT_CONFIRMED to IDENTIFYING', () => {
    const { result } = renderHook(() => useInteractionStore());

    act(() => {
      result.current.setInteraction('int-001', InteractionStatus.CONTEXT_CONFIRMED, '2026-03-24T00:00:00.000Z');
    });
    expect(result.current.status).toBe(InteractionStatus.CONTEXT_CONFIRMED);

    act(() => {
      result.current.setStatus(InteractionStatus.IDENTIFYING);
    });
    expect(result.current.status).toBe(InteractionStatus.IDENTIFYING);
  });

  it('setStatus does not clear context or selectedRefs (context data must survive status changes)', () => {
    const { result } = renderHook(() => useInteractionStore());

    act(() => {
      result.current.setInteraction('int-001', InteractionStatus.CONTEXT_CONFIRMED, '2026-03-24T00:00:00.000Z');
      result.current.setCustomerContext(CUSTOMER_CTX);
      result.current.setVehicleContext(VEHICLE_CTX);
      result.current.setDealerContext(DEALER_CTX);
    });

    act(() => {
      result.current.setStatus(InteractionStatus.WRAPUP);
    });

    // Status updated
    expect(result.current.status).toBe(InteractionStatus.WRAPUP);
    // Context data preserved (setStatus is a targeted update)
    expect(result.current.customerContext?.customerRef).toBe('CUST-001');
    expect(result.current.vehicleContext?.vehicleRef).toBe('VEH-001');
    expect(result.current.dealerContext?.dealerRef).toBe('DLR-001');
  });
});

// ---------------------------------------------------------------------------
// clearSelection — FE-1 fix
// ---------------------------------------------------------------------------

describe('clearSelection — clears refs, searchResults, and context (FE-1 fix)', () => {
  it('clearSelection() resets all selection and context state', () => {
    const { result } = renderHook(() => useInteractionStore());

    // Set up some state
    act(() => {
      result.current.setInteraction('int-001', InteractionStatus.CONTEXT_CONFIRMED, '2026-03-25T00:00:00.000Z');
      result.current.setCustomerContext({
        customerRef: 'CUST-001',
        contactName: 'Test User',
        primaryMobile: '9876543210',
        secondaryMobile: null,
        emailId: null,
        address: null,
        sourceSystem: 'INSTALL_BASE',
      });
      result.current.setVehicleContext({
        vehicleRef: 'VEH-001',
        productType: 'Motorcycle',
        modelName: 'Activa',
        variant: 'DLX',
        registrationNumber: 'MH01AB1234',
        chassisNumberMasked: 'XXX1234',
        soldOnDate: null,
        lastServiceDate: null,
        dealerRef: null,
        sourceSystem: 'INSTALL_BASE',
      });
    });

    expect(result.current.customerContext).not.toBeNull();
    expect(result.current.vehicleContext).not.toBeNull();

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedCustomerRef).toBeNull();
    expect(result.current.selectedVehicleRef).toBeNull();
    expect(result.current.selectedDealerRef).toBeNull();
    expect(result.current.searchResults).toBeNull();
    expect(result.current.customerContext).toBeNull();
    expect(result.current.vehicleContext).toBeNull();
    expect(result.current.dealerContext).toBeNull();

    // Core interaction fields must be preserved (clearSelection is not a full reset)
    expect(result.current.interactionId).toBe('int-001');
    expect(result.current.status).toBe(InteractionStatus.CONTEXT_CONFIRMED);
  });
});

describe('context store — all three contexts null after reselection reset (F14)', () => {
  it('clears all three context values simultaneously when setCustomerContext/setVehicleContext/setDealerContext are called with null', () => {
    const { result } = renderHook(() => useInteractionStore());

    // Load full context
    act(() => {
      result.current.setCustomerContext(CUSTOMER_CTX);
      result.current.setVehicleContext(VEHICLE_CTX);
      result.current.setDealerContext(DEALER_CTX);
    });

    expect(result.current.customerContext).not.toBeNull();
    expect(result.current.vehicleContext).not.toBeNull();
    expect(result.current.dealerContext).not.toBeNull();

    // Simulate reselection — clear all three (as SearchResults does when loadContextData begins)
    act(() => {
      result.current.setCustomerContext(null);
      result.current.setVehicleContext(null);
      result.current.setDealerContext(null);
    });

    expect(result.current.customerContext).toBeNull();
    expect(result.current.vehicleContext).toBeNull();
    expect(result.current.dealerContext).toBeNull();
  });
});
