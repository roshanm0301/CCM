/**
 * DealerCard — redesign rendering tests.
 *
 * Covers structural and labelling changes introduced in the Phase 1 UI
 * redesign wave:
 * - "Dealer Details" section label
 * - Renamed field labels: "Type" (was "Dealer Type"), "Branch" (was "Branch Name"),
 *   "City" (was "Contact")
 * - Removal of the "ASC" row
 *
 * Source: DealerCard.tsx, ux-specification-v2.md Screen 6 §DealerCard
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DealerCard } from '../DealerCard';
import type { DealerContext } from '@/features/interaction/interactionStore';

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const dealerData: DealerContext = {
  dealerRef: 'DLR-001',
  dealerName: 'Excellent Honda',
  dealerCode: 'EH001',
  branchName: 'Andheri Branch',
  asc: 'ASC-ANDHERI',     // present in data but must NOT be rendered as a row
  city: 'Mumbai',
  address: '456 Link Road, Andheri West',
  pinCode: '400053',
  dealerType: 'Dealer',
  isActive: true,
  sourceSystem: 'DMS',
};

// ---------------------------------------------------------------------------
// Section label
// ---------------------------------------------------------------------------

describe('DealerCard — "Dealer Details" section label', () => {
  it('renders the "Dealer Details" section label', () => {
    render(<DealerCard data={dealerData} />);
    // Caption appears in header; name also used as h3 fallback when data is absent.
    const labels = screen.getAllByText('Dealer Details');
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Renamed field labels
// ---------------------------------------------------------------------------

describe('DealerCard — renamed field labels', () => {
  it('renders the "Type" label (previously "Dealer Type")', () => {
    render(<DealerCard data={dealerData} />);
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('does NOT render the old "Dealer Type" label', () => {
    render(<DealerCard data={dealerData} />);
    expect(screen.queryByText('Dealer Type')).not.toBeInTheDocument();
  });

  it('renders the "Branch" label (previously "Branch Name")', () => {
    render(<DealerCard data={dealerData} />);
    expect(screen.getByText('Branch')).toBeInTheDocument();
  });

  it('does NOT render the old "Branch Name" label', () => {
    render(<DealerCard data={dealerData} />);
    expect(screen.queryByText('Branch Name')).not.toBeInTheDocument();
  });

  it('renders the "City" label (previously "Contact")', () => {
    render(<DealerCard data={dealerData} />);
    expect(screen.getByText('City')).toBeInTheDocument();
  });

  it('does NOT render the old "Contact" label as a field term', () => {
    render(<DealerCard data={dealerData} />);
    const terms = screen.getAllByRole('term');
    const termTexts = terms.map((t) => t.textContent?.trim());
    expect(termTexts).not.toContain('Contact');
  });
});

// ---------------------------------------------------------------------------
// Removed "ASC" row
// ---------------------------------------------------------------------------

describe('DealerCard — removed "ASC" row', () => {
  it('does NOT render an "ASC" field label', () => {
    render(<DealerCard data={dealerData} />);
    expect(screen.queryByText('ASC')).not.toBeInTheDocument();
  });

  it('does NOT render the ASC value in the DOM even when asc is populated in data', () => {
    const { container } = render(<DealerCard data={dealerData} />);
    // asc value is 'ASC-ANDHERI' — must not appear anywhere in rendered output
    expect(container.textContent).not.toContain('ASC-ANDHERI');
  });
});

// ---------------------------------------------------------------------------
// Retained field labels — regression guard
// ---------------------------------------------------------------------------

describe('DealerCard — retained field labels', () => {
  it('still renders the "Code" label', () => {
    render(<DealerCard data={dealerData} />);
    expect(screen.getByText('Code')).toBeInTheDocument();
  });

  it('still renders the "Address" label', () => {
    render(<DealerCard data={dealerData} />);
    expect(screen.getByText('Address')).toBeInTheDocument();
  });

  it('renders the dealer name in the header', () => {
    render(<DealerCard data={dealerData} />);
    expect(screen.getByRole('heading', { name: 'Excellent Honda' })).toBeInTheDocument();
  });

  it('renders the Active status chip when isActive is true', () => {
    render(<DealerCard data={dealerData} />);
    expect(
      screen.getByLabelText('Dealer status: Active'),
    ).toBeInTheDocument();
  });

  it('renders the Inactive status chip when isActive is false', () => {
    const inactiveDealer: DealerContext = { ...dealerData, isActive: false };
    render(<DealerCard data={inactiveDealer} />);
    expect(
      screen.getByLabelText('Dealer status: Inactive'),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Null data guard
// ---------------------------------------------------------------------------

describe('DealerCard — null data state', () => {
  it('shows the unavailable alert when data is null', () => {
    render(<DealerCard data={null} />);
    expect(screen.getByText('Dealer details are unavailable.')).toBeInTheDocument();
  });

  it('does not render the field list when data is null', () => {
    render(<DealerCard data={null} />);
    expect(screen.queryByRole('term')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// F16: Missing dealer does not block — explicit gap coverage
// ---------------------------------------------------------------------------

describe('DealerCard — missing dealer state (F16)', () => {
  it('renders the unavailable message when dealer prop is null without crashing', () => {
    // Must not throw; must show the unavailable state
    expect(() => render(<DealerCard data={null} />)).not.toThrow();
    expect(screen.getByText('Dealer details are unavailable.')).toBeInTheDocument();
  });

  it('does not render dealer name, code, or city when data is null', () => {
    render(<DealerCard data={null} />);

    // None of the data fields from the fixture must appear
    expect(screen.queryByText('Excellent Honda')).not.toBeInTheDocument();
    expect(screen.queryByText('EH001')).not.toBeInTheDocument();
    expect(screen.queryByText('Mumbai')).not.toBeInTheDocument();
  });

  it('does not render any field labels (Code, Type, Branch, City, Address) when data is null', () => {
    render(<DealerCard data={null} />);

    // Field labels only render inside the <dl> block that requires data to be non-null
    expect(screen.queryByText('Code')).not.toBeInTheDocument();
    expect(screen.queryByText('Type')).not.toBeInTheDocument();
    expect(screen.queryByText('Branch')).not.toBeInTheDocument();
    expect(screen.queryByText('City')).not.toBeInTheDocument();
    expect(screen.queryByText('Address')).not.toBeInTheDocument();
  });

  it('does not render the Active/Inactive chip when data is null', () => {
    render(<DealerCard data={null} />);

    expect(screen.queryByLabelText(/Dealer status:/i)).not.toBeInTheDocument();
  });
});
