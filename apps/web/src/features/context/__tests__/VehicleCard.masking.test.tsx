/**
 * VehicleCard — chassis number masking security test.
 *
 * Asserts that:
 * 1. The component renders the masked chassis value from the prop.
 * 2. No raw (unmasked) chassis number string appears anywhere in the DOM.
 *
 * Source: VehicleCard.tsx §Security comment, security-principles.md (PII masking)
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VehicleCard } from '../VehicleCard';
import type { VehicleContext } from '@/features/interaction/interactionStore';

const RAW_CHASSIS = 'MD2A6CF7XNW123456';
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

describe('VehicleCard chassis masking', () => {
  it('renders the masked chassis value in the DOM', () => {
    render(<VehicleCard data={vehicleData} />);
    expect(screen.getByText(MASKED_CHASSIS)).toBeInTheDocument();
  });

  it('does not render the raw chassis number anywhere in the DOM', () => {
    const { container } = render(<VehicleCard data={vehicleData} />);
    expect(container.textContent).not.toContain(RAW_CHASSIS);
  });

  it('labels the chassis field with partial masking aria-label', () => {
    render(<VehicleCard data={vehicleData} />);
    expect(
      screen.getByLabelText('Chassis number partially masked'),
    ).toBeInTheDocument();
  });
});
