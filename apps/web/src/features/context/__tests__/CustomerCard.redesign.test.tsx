/**
 * CustomerCard — redesign rendering tests.
 *
 * Covers structural and labelling changes introduced in the Phase 1 UI
 * redesign wave:
 * - "Customer Details" section label
 * - Renamed field labels: "Contact Name", "Primary Mobile", "Secondary Mobile"
 * - "360 View" disabled button
 * - "Change" button conditional rendering and callback
 * - maskMobile security contract via rendered output
 *
 * Source: CustomerCard.tsx, security-principles.md (PII masking)
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerCard } from '../CustomerCard';
import type { CustomerContext } from '@/features/interaction/interactionStore';

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const customerData: CustomerContext = {
  customerRef: 'C-001',
  contactName: 'Ravi Kumar',
  primaryMobile: '9876543210',
  secondaryMobile: '9123456780',
  emailId: 'ravi@example.com',
  address: '123 Main St, Mumbai',
  sourceSystem: 'CUSTOMER_MASTER',
};

// ---------------------------------------------------------------------------
// Section label
// ---------------------------------------------------------------------------

describe('CustomerCard — "Customer Details" section label', () => {
  it('renders the "Customer Details" section label', () => {
    render(<CustomerCard data={customerData} />);

    // The label appears twice: once as the section caption and once as the
    // fallback heading text when data is loading. When data is present it
    // appears as the caption only; getAllByText allows either scenario.
    const labels = screen.getAllByText('Customer Details');
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Field label renames
// ---------------------------------------------------------------------------

describe('CustomerCard — renamed field labels', () => {
  it('renders the "Contact Name" label', () => {
    render(<CustomerCard data={customerData} />);
    expect(screen.getByText('Contact Name')).toBeInTheDocument();
  });

  it('does NOT render the old "Contact" label as a standalone field label', () => {
    render(<CustomerCard data={customerData} />);
    // "Contact Name" must be present; a bare "Contact" term must not exist as
    // a standalone dt element. We query by role term (dt renders as 'term').
    const terms = screen.getAllByRole('term');
    const termTexts = terms.map((t) => t.textContent?.trim());
    expect(termTexts).not.toContain('Contact');
  });

  it('renders the "Primary Mobile" label', () => {
    render(<CustomerCard data={customerData} />);
    expect(screen.getByText('Primary Mobile')).toBeInTheDocument();
  });

  it('does NOT render the old "Mobile" label as a standalone field label', () => {
    render(<CustomerCard data={customerData} />);
    const terms = screen.getAllByRole('term');
    const termTexts = terms.map((t) => t.textContent?.trim());
    expect(termTexts).not.toContain('Mobile');
  });

  it('renders the "Secondary Mobile" label when secondaryMobile is provided', () => {
    render(<CustomerCard data={customerData} />);
    expect(screen.getByText('Secondary Mobile')).toBeInTheDocument();
  });

  it('does NOT render the old "Alt Mobile" label', () => {
    render(<CustomerCard data={customerData} />);
    expect(screen.queryByText('Alt Mobile')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// maskMobile security contract — rendered output
// ---------------------------------------------------------------------------

describe('CustomerCard — mobile masking in rendered output', () => {
  it('renders the primary mobile with only the last 4 digits visible', () => {
    render(<CustomerCard data={customerData} />);
    // '9876543210' masked -> 'xxxxxx3210'
    expect(screen.getByText('xxxxxx3210')).toBeInTheDocument();
  });

  it('does not render the raw primary mobile number in the DOM', () => {
    const { container } = render(<CustomerCard data={customerData} />);
    expect(container.textContent).not.toContain('9876543210');
  });

  it('renders the secondary mobile masked when provided', () => {
    render(<CustomerCard data={customerData} />);
    // '9123456780' masked -> 'xxxxxx6780'
    expect(screen.getByText('xxxxxx6780')).toBeInTheDocument();
  });

  it('does not render secondary mobile field when secondaryMobile is null', () => {
    const dataNoSecondary: CustomerContext = {
      ...customerData,
      secondaryMobile: null,
    };
    render(<CustomerCard data={dataNoSecondary} />);
    expect(screen.queryByText('Secondary Mobile')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 360 View button
// ---------------------------------------------------------------------------

describe('CustomerCard — "360 View" button', () => {
  it('renders the "360 View" button', () => {
    render(<CustomerCard data={customerData} />);
    expect(screen.getByRole('button', { name: /360 view/i })).toBeInTheDocument();
  });

  it('"360 View" button is disabled', () => {
    render(<CustomerCard data={customerData} />);
    const btn = screen.getByRole('button', { name: /360 view/i });
    expect(btn).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// "Change" button — conditional rendering and callback
// ---------------------------------------------------------------------------

describe('CustomerCard — "Change" button', () => {
  it('renders the "Change" button when onChangeSelection prop is provided', () => {
    const onChangeMock = vi.fn();
    render(<CustomerCard data={customerData} onChangeSelection={onChangeMock} />);
    expect(
      screen.getByRole('button', { name: /change selected customer/i }),
    ).toBeInTheDocument();
  });

  it('calls onChangeSelection when the "Change" button is clicked', async () => {
    const onChangeMock = vi.fn();
    render(<CustomerCard data={customerData} onChangeSelection={onChangeMock} />);

    await userEvent.click(
      screen.getByRole('button', { name: /change selected customer/i }),
    );

    expect(onChangeMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT render the "Change" button when onChangeSelection is not provided', () => {
    render(<CustomerCard data={customerData} />);
    expect(
      screen.queryByRole('button', { name: /change selected customer/i }),
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Null data guard — buttons must not render when data is null
// ---------------------------------------------------------------------------

describe('CustomerCard — null data state', () => {
  it('does not render "360 View" or "Change" buttons when data is null', () => {
    render(<CustomerCard data={null} onChangeSelection={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /360 view/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /change selected customer/i }),
    ).not.toBeInTheDocument();
  });
});
