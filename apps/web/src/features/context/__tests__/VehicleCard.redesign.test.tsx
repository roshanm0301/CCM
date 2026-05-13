/**
 * VehicleCard — redesign rendering tests.
 *
 * Covers structural and labelling changes introduced in the Phase 1 UI
 * redesign wave:
 * - "Vehicle Details" section label
 * - "Model/Variant" combined label and combined value
 * - Renamed labels: "Chassis Number", "Sold On", "Last Service"
 * - "Dealer" field row with dealerName prop
 * - "Vehicle History" disabled button
 * - Chassis number masking security invariant (reads from chassisNumberMasked)
 *
 * Source: VehicleCard.tsx, security-principles.md (PII masking)
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VehicleCard } from '../VehicleCard';
import type { VehicleContext } from '@/features/interaction/interactionStore';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const MASKED_CHASSIS = 'XXXXXXXXX12345';

const vehicleData: VehicleContext = {
  vehicleRef: 'VEH-001',
  productType: 'Motorcycle',
  modelName: 'Activa 6G',
  variant: 'DLX',
  registrationNumber: 'MH12AB1234',
  chassisNumberMasked: MASKED_CHASSIS,
  soldOnDate: '2023-04-15T00:00:00.000Z',
  lastServiceDate: '2024-01-10T00:00:00.000Z',
  dealerRef: 'DLR-001',
  sourceSystem: 'INSTALL_BASE',
};

// ---------------------------------------------------------------------------
// Section label
// ---------------------------------------------------------------------------

describe('VehicleCard — "Vehicle Details" section label', () => {
  it('renders the "Vehicle Details" section label', () => {
    render(<VehicleCard data={vehicleData} />);
    // Caption label is always in the header regardless of data state.
    const labels = screen.getAllByText('Vehicle Details');
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Model/Variant combined row
// ---------------------------------------------------------------------------

describe('VehicleCard — combined "Model/Variant" field', () => {
  it('renders the "Model/Variant" label', () => {
    render(<VehicleCard data={vehicleData} />);
    expect(screen.getByText('Model/Variant')).toBeInTheDocument();
  });

  it('does NOT render separate "Model" or "Variant" labels', () => {
    render(<VehicleCard data={vehicleData} />);
    const terms = screen.getAllByRole('term');
    const termTexts = terms.map((t) => t.textContent?.trim());
    expect(termTexts).not.toContain('Model');
    expect(termTexts).not.toContain('Variant');
  });

  it('displays the model and variant combined in the single row value', () => {
    render(<VehicleCard data={vehicleData} />);
    expect(screen.getByText('Activa 6G DLX')).toBeInTheDocument();
  });

  it('displays only model name when variant is absent', () => {
    const dataNoVariant: VehicleContext = { ...vehicleData, variant: '' };
    render(<VehicleCard data={dataNoVariant} />);
    expect(screen.getByText('Activa 6G')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Renamed field labels
// ---------------------------------------------------------------------------

describe('VehicleCard — renamed field labels', () => {
  it('renders the "Chassis Number" label', () => {
    render(<VehicleCard data={vehicleData} />);
    expect(screen.getByText('Chassis Number')).toBeInTheDocument();
  });

  it('does NOT render the old "Chassis no." label', () => {
    render(<VehicleCard data={vehicleData} />);
    expect(screen.queryByText('Chassis no.')).not.toBeInTheDocument();
  });

  it('renders the "Sold On" label', () => {
    render(<VehicleCard data={vehicleData} />);
    expect(screen.getByText('Sold On')).toBeInTheDocument();
  });

  it('does NOT render the old "Date of sale" label', () => {
    render(<VehicleCard data={vehicleData} />);
    expect(screen.queryByText('Date of sale')).not.toBeInTheDocument();
  });

  it('renders the "Last Service" label', () => {
    render(<VehicleCard data={vehicleData} />);
    expect(screen.getByText('Last Service')).toBeInTheDocument();
  });

  it('does NOT render the old "Last service date" label', () => {
    render(<VehicleCard data={vehicleData} />);
    expect(screen.queryByText('Last service date')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Dealer field
// ---------------------------------------------------------------------------

describe('VehicleCard — "Dealer" field', () => {
  it('renders the "Dealer" field label when dealerName is provided', () => {
    render(<VehicleCard data={vehicleData} dealerName="Excellent Honda" />);
    expect(screen.getByText('Dealer')).toBeInTheDocument();
  });

  it('displays the provided dealerName value in the "Dealer" field', () => {
    render(<VehicleCard data={vehicleData} dealerName="Excellent Honda" />);
    expect(screen.getByText('Excellent Honda')).toBeInTheDocument();
  });

  it('renders "Not available" in the Dealer field when dealerName is null', () => {
    render(<VehicleCard data={vehicleData} dealerName={null} />);
    // The field is always rendered; when value is null/empty the component
    // falls back to "Not available"
    expect(screen.getByText('Dealer')).toBeInTheDocument();
    // "Not available" may appear for other fields too — just check it's there
    const notAvailableMatches = screen.getAllByText('Not available');
    expect(notAvailableMatches.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// "Vehicle History" button
// ---------------------------------------------------------------------------

describe('VehicleCard — "Vehicle History" button', () => {
  it('renders the "Vehicle History" button', () => {
    render(<VehicleCard data={vehicleData} />);
    expect(
      screen.getByRole('button', { name: /vehicle history/i }),
    ).toBeInTheDocument();
  });

  it('"Vehicle History" button is disabled', () => {
    render(<VehicleCard data={vehicleData} />);
    expect(
      screen.getByRole('button', { name: /vehicle history/i }),
    ).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Chassis masking security invariant
// (These tests duplicate the contract in VehicleCard.masking.test.tsx and
// serve as a regression guard if labels change in future redesign waves.)
// ---------------------------------------------------------------------------

describe('VehicleCard — chassis masking security invariant', () => {
  it('renders the masked chassis value from chassisNumberMasked', () => {
    render(<VehicleCard data={vehicleData} />);
    expect(screen.getByText(MASKED_CHASSIS)).toBeInTheDocument();
  });

  it('carries the aria-label "Chassis number partially masked" on the chassis value element', () => {
    render(<VehicleCard data={vehicleData} />);
    expect(
      screen.getByLabelText('Chassis number partially masked'),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Null data guard — buttons must not render when data is null
// ---------------------------------------------------------------------------

describe('VehicleCard — null data state', () => {
  it('does not render "Vehicle History" button when data is null', () => {
    render(<VehicleCard data={null} />);
    expect(
      screen.queryByRole('button', { name: /vehicle history/i }),
    ).not.toBeInTheDocument();
  });
});
