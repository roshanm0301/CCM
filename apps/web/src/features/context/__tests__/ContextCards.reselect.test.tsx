/**
 * ContextCards — visual refresh on context reselection tests (F14).
 *
 * Verifies that CustomerCard and VehicleCard re-render with fresh data when
 * context props change in the Zustand store (simulating a reselection).
 *
 * ContextCards reads all context exclusively from useInteractionStore; the
 * test swaps the store return value between renders to simulate a reselection.
 *
 * Source: ContextCards.tsx, CustomerCard.tsx, VehicleCard.tsx
 * Traceability: CCM_Phase1_Agent_Interaction_Documentation.md §C4, §D4 — F14
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock useInteractionStore before importing any component
// ---------------------------------------------------------------------------

vi.mock('@/features/interaction/interactionStore', () => ({
  useInteractionStore: vi.fn(),
}));

import { useInteractionStore } from '@/features/interaction/interactionStore';
import { ContextCards } from '../ContextCards';
import type { CustomerContext, VehicleContext, DealerContext } from '@/features/interaction/interactionStore';

const mockUseInteractionStore = useInteractionStore as unknown as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CUSTOMER_A: CustomerContext = {
  customerRef: 'CUST-A',
  contactName: 'Rahul Sharma',
  primaryMobile: '9876543210',
  secondaryMobile: null,
  emailId: 'rahul@example.com',
  address: '10 Main St, Mumbai',
  sourceSystem: 'INSTALL_BASE',
};

const CUSTOMER_B: CustomerContext = {
  customerRef: 'CUST-B',
  contactName: 'Priya Patel',
  primaryMobile: '8765432109',
  secondaryMobile: null,
  emailId: null,
  address: null,
  sourceSystem: 'INSTALL_BASE',
};

const VEHICLE_A: VehicleContext = {
  vehicleRef: 'VEH-A',
  productType: null,
  modelName: 'Activa 6G',
  variant: 'DLX',
  registrationNumber: 'MH12AB1234',
  chassisNumberMasked: 'MD2*******0001',
  soldOnDate: null,
  lastServiceDate: null,
  dealerRef: 'DLR-001',
  sourceSystem: 'INSTALL_BASE',
};

const VEHICLE_B: VehicleContext = {
  vehicleRef: 'VEH-B',
  productType: null,
  modelName: 'Honda City',
  variant: 'ZX',
  registrationNumber: 'GJ01CD5678',
  chassisNumberMasked: 'MD2*******0002',
  soldOnDate: null,
  lastServiceDate: null,
  dealerRef: 'DLR-002',
  sourceSystem: 'INSTALL_BASE',
};

const DEALER_A: DealerContext = {
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

function makeStoreMock(
  customerContext: CustomerContext | null,
  vehicleContext: VehicleContext | null,
  dealerContext: DealerContext | null,
) {
  return {
    customerContext,
    vehicleContext,
    dealerContext,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Tests: CustomerCard re-renders with new customer on reselection
// ---------------------------------------------------------------------------

describe('ContextCards — CustomerCard re-renders on context reselection (F14)', () => {
  it('shows the initial customer name when context is first set', () => {
    mockUseInteractionStore.mockReturnValue(
      makeStoreMock(CUSTOMER_A, VEHICLE_A, DEALER_A),
    );

    render(<ContextCards />);

    // contactName is rendered in both the card <h3> header and the Contact Name field row;
    // use getByRole('heading') to target the unique <h3> element.
    expect(screen.getByRole('heading', { name: 'Rahul Sharma' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Priya Patel' })).not.toBeInTheDocument();
  });

  it('re-renders CustomerCard with new customer name when context props change (reselection)', () => {
    // First render: CUSTOMER_A
    mockUseInteractionStore.mockReturnValue(
      makeStoreMock(CUSTOMER_A, VEHICLE_A, DEALER_A),
    );
    const { rerender } = render(<ContextCards />);
    expect(screen.getByRole('heading', { name: 'Rahul Sharma' })).toBeInTheDocument();

    // Simulate reselection: store returns CUSTOMER_B on next render
    mockUseInteractionStore.mockReturnValue(
      makeStoreMock(CUSTOMER_B, VEHICLE_B, null),
    );
    rerender(<ContextCards />);

    expect(screen.getByRole('heading', { name: 'Priya Patel' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Rahul Sharma' })).not.toBeInTheDocument();
  });

  it('does not show stale customer name after context props update to a new customer', () => {
    mockUseInteractionStore.mockReturnValue(
      makeStoreMock(CUSTOMER_A, VEHICLE_A, DEALER_A),
    );
    const { rerender } = render(<ContextCards />);

    mockUseInteractionStore.mockReturnValue(
      makeStoreMock(CUSTOMER_B, VEHICLE_B, null),
    );
    rerender(<ContextCards />);

    // Original name must be gone — no stale data preserved
    expect(screen.queryByText('Rahul Sharma')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: VehicleCard re-renders with new vehicle on reselection
// ---------------------------------------------------------------------------

describe('ContextCards — VehicleCard re-renders on context reselection (F14)', () => {
  it('shows the initial vehicle registration number when context is first set', () => {
    mockUseInteractionStore.mockReturnValue(
      makeStoreMock(CUSTOMER_A, VEHICLE_A, DEALER_A),
    );

    render(<ContextCards />);

    expect(screen.getByText('MH12AB1234')).toBeInTheDocument();
    expect(screen.queryByText('GJ01CD5678')).not.toBeInTheDocument();
  });

  it('re-renders VehicleCard with new registration number when context props change (reselection)', () => {
    mockUseInteractionStore.mockReturnValue(
      makeStoreMock(CUSTOMER_A, VEHICLE_A, DEALER_A),
    );
    const { rerender } = render(<ContextCards />);
    expect(screen.getByText('MH12AB1234')).toBeInTheDocument();

    // Simulate reselection with a different vehicle
    mockUseInteractionStore.mockReturnValue(
      makeStoreMock(CUSTOMER_B, VEHICLE_B, null),
    );
    rerender(<ContextCards />);

    expect(screen.getByText('GJ01CD5678')).toBeInTheDocument();
    expect(screen.queryByText('MH12AB1234')).not.toBeInTheDocument();
  });

  it('does not preserve stale vehicle registration after context props update', () => {
    mockUseInteractionStore.mockReturnValue(
      makeStoreMock(CUSTOMER_A, VEHICLE_A, DEALER_A),
    );
    const { rerender } = render(<ContextCards />);

    mockUseInteractionStore.mockReturnValue(
      makeStoreMock(CUSTOMER_B, VEHICLE_B, null),
    );
    rerender(<ContextCards />);

    // Original registration must not appear anywhere
    expect(screen.queryByText('MH12AB1234')).not.toBeInTheDocument();
  });
});
