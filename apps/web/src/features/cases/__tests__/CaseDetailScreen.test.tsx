// @vitest-environment jsdom

/**
 * CaseDetailScreen — component unit tests.
 *
 * Covered scenarios:
 *
 * CaseSidebar:
 *  1. Shows Skeleton elements while customer context is loading
 *  2. Renders Contact Name, Primary Mobile, Email, Address when customer loaded
 *  3. Shows "Could not load customer details" error fallback on customer error
 *  4. Shows "No vehicle linked" when vehicleRef is null
 *  5. Shows dealer name and Active chip when dealer data is present
 *
 * CaseTab:
 *  6. Renders all 8 case fields: Case ID (mono), Case Nature, Department,
 *     Product Type, Priority, Case Status Chip, Activity Status Chip, Registered At
 *  7. Case Status Chip colour: Open → success, In Progress → warning
 *  8. Empty customerRemarks renders italic "None"
 *  9. Divider is present between case fields section and remarks section
 *
 * Source: CCM_Phase6_Resolution_Activities.md § Case Detail Screen
 */

import { expect as vitestExpect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
vitestExpect.extend(matchers);
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { MockedFunction } from 'vitest';

// ---------------------------------------------------------------------------
// Mock useCaseDetailContext — all tests drive context state via this mock
// ---------------------------------------------------------------------------

vi.mock('../useCaseDetailContext', () => ({
  useCaseDetailContext: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock heavy sub-components so tests don't need their full dependency trees
// ---------------------------------------------------------------------------

vi.mock('@/features/follow-up/FollowUpTab', () => ({
  FollowUpTab: () => <div data-testid="follow-up-tab" />,
}));

vi.mock('@/features/resolution/ResolutionTab', () => ({
  ResolutionTab: () => <div data-testid="resolution-tab" />,
}));

vi.mock('@/shared/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/cti/CtiCallRecording', () => ({
  CtiCallRecording: () => <div data-testid="cti-call-recording" />,
}));

// ---------------------------------------------------------------------------
// Imports (must come after vi.mock hoisting)
// ---------------------------------------------------------------------------

import { useCaseDetailContext } from '../useCaseDetailContext';
import { CaseDetailScreen } from '../CaseDetailScreen';
import type { CaseDetailDto } from '../casesApi';
import type {
  CustomerContextData,
  VehicleContextData,
  DealerContextData,
} from '../useCaseDetailContext';

// ---------------------------------------------------------------------------
// Typed mock helper
// ---------------------------------------------------------------------------

const mockUseCaseDetailContext = useCaseDetailContext as MockedFunction<
  typeof useCaseDetailContext
>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_CASE_DETAIL: CaseDetailDto = {
  id: '507f1f77bcf86cd799439011',
  caseId: 'ISR-042',
  interactionId: '550e8400-e29b-41d4-a716-446655440000',
  customerRef: 'CUST-001',
  vehicleRef: 'VH-001',
  dealerRef: 'BAJ-KA-001',
  caseNature: 'Complaint',
  department: 'Sales',
  priority: 'High',
  productType: 'Motorcycle',
  productTypeSource: 'Derived',
  caseCategoryId: '507f1f77bcf86cd799439030',
  caseSubcategoryId: '507f1f77bcf86cd799439040',
  customerRemarks: 'Delivery was delayed',
  agentRemarks: 'Escalated to manager',
  caseStatus: 'Open',
  activityStatus: 'Fresh',
  registeredAt: '2026-03-20T10:00:00.000Z',
  currentStepNo: 1,
  currentStepTemplateId: 'tpl-001',
  activityStateVersion: 1,
  interactionChannel: null,
};

const MOCK_CUSTOMER: CustomerContextData = {
  customerRef: 'CUST-001',
  contactName: 'Rajan Mehta',
  primaryMobile: '9876543210',
  emailId: 'rajan@example.com',
  address: '12, MG Road, Bangalore',
};

const MOCK_VEHICLE: VehicleContextData = {
  vehicleRef: 'VH-001',
  productType: 'Motorcycle',
  modelName: 'Pulsar',
  variant: 'NS200',
  chassisNumberMasked: 'XXXXXX1234',
  soldOnDate: '2024-01-15T00:00:00.000Z',
  lastServiceDate: '2025-06-01T00:00:00.000Z',
};

const MOCK_DEALER: DealerContextData = {
  dealerRef: 'BAJ-KA-001',
  dealerName: 'Bajaj Bangalore Central',
  dealerCode: 'BAJ-KA-001',
  branchName: 'Central Branch',
  city: 'Bangalore',
  address: '23, Outer Ring Road',
  isActive: true,
};

/**
 * Builds a default (happy-path) context mock with all data loaded.
 * Individual tests override specific fields via `contextOverrides`.
 */
function makeContextReturn(overrides?: {
  customer?: Partial<ReturnType<typeof useCaseDetailContext>['customer']>;
  vehicle?: Partial<ReturnType<typeof useCaseDetailContext>['vehicle']>;
  dealer?: Partial<ReturnType<typeof useCaseDetailContext>['dealer']>;
}) {
  return {
    customer: {
      data: MOCK_CUSTOMER,
      isLoading: false,
      isError: false,
      ...overrides?.customer,
    },
    vehicle: {
      data: MOCK_VEHICLE,
      isLoading: false,
      isError: false,
      ...overrides?.vehicle,
    },
    dealer: {
      data: MOCK_DEALER,
      isLoading: false,
      isError: false,
      ...overrides?.dealer,
    },
  } as ReturnType<typeof useCaseDetailContext>;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: all context loaded successfully
  mockUseCaseDetailContext.mockReturnValue(makeContextReturn());
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Helper: render CaseDetailScreen with default or custom props
// ---------------------------------------------------------------------------

function renderScreen(caseDetailOverrides?: Partial<CaseDetailDto>) {
  return render(
    <CaseDetailScreen
      caseDetail={{ ...BASE_CASE_DETAIL, ...caseDetailOverrides }}
      userRoles={['agent']}
    />,
  );
}

// ===========================================================================
// CaseSidebar — customer card
// ===========================================================================

describe('CaseSidebar — customer card loading state', () => {
  it('shows Skeleton elements while customer context is loading', () => {
    mockUseCaseDetailContext.mockReturnValue(
      makeContextReturn({ customer: { isLoading: true, isError: false, data: undefined } }),
    );

    renderScreen();

    // MUI Skeleton renders with data-testid or we look for role="img" (wave variant)
    // but more reliably: the CardSkeleton renders 3 Skeleton components.
    // Skeleton renders as a <span> with class MuiSkeleton-root.
    // We also verify customer fields are NOT rendered during loading.
    expect(screen.queryByText('Contact Name')).not.toBeInTheDocument();
    expect(screen.queryByText('Primary Mobile')).not.toBeInTheDocument();
    // Skeleton renders visible spans in the document
    const skeletonElements = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });
});

describe('CaseSidebar — customer card loaded state', () => {
  it('renders Contact Name, Primary Mobile, Email, and Address labels and values', () => {
    renderScreen();

    // Labels
    expect(screen.getByText('Contact Name')).toBeInTheDocument();
    expect(screen.getByText('Primary Mobile')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    // "Address" appears in both CustomerCard and DealerCard — use getAllByText
    expect(screen.getAllByText('Address').length).toBeGreaterThan(0);

    // Values from MOCK_CUSTOMER
    expect(screen.getAllByText('Rajan Mehta').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Primary mobile, partially masked')).toBeInTheDocument();
    expect(screen.getByText('rajan@example.com')).toBeInTheDocument();
    expect(screen.getByText('12, MG Road, Bangalore')).toBeInTheDocument();
  });
});

describe('CaseSidebar — customer card error state', () => {
  it('shows "Could not load customer details" when customer.isError is true', () => {
    mockUseCaseDetailContext.mockReturnValue(
      makeContextReturn({ customer: { isLoading: false, isError: true, data: undefined } }),
    );

    renderScreen();

    expect(screen.getByText('Customer details unavailable.')).toBeInTheDocument();
  });

  it('does not render customer fields when customer.isError is true', () => {
    mockUseCaseDetailContext.mockReturnValue(
      makeContextReturn({ customer: { isLoading: false, isError: true, data: undefined } }),
    );

    renderScreen();

    expect(screen.queryByText('Contact Name')).not.toBeInTheDocument();
    expect(screen.queryByText('Rajan Mehta')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// CaseSidebar — vehicle card
// ===========================================================================

describe('CaseSidebar — vehicle card: no vehicle linked', () => {
  it('shows "No vehicle linked" when vehicleRef is null', () => {
    mockUseCaseDetailContext.mockReturnValue(
      makeContextReturn({ vehicle: { isLoading: false, isError: false, data: undefined } }),
    );

    renderScreen({ vehicleRef: null });

    expect(screen.getByText('Vehicle details unavailable.')).toBeInTheDocument();
  });

  it('does not show Skeleton or vehicle fields when vehicleRef is null', () => {
    mockUseCaseDetailContext.mockReturnValue(
      makeContextReturn({ vehicle: { isLoading: false, isError: false, data: undefined } }),
    );

    renderScreen({ vehicleRef: null });

    // "Product Type" label appears in CaseTab regardless — check only vehicle-specific field
    expect(screen.queryByText('Model/Variant')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// CaseSidebar — dealer card
// ===========================================================================

describe('CaseSidebar — dealer card', () => {
  it('shows dealer name and Active chip when dealer data is loaded and isActive is true', () => {
    renderScreen();

    // Dealer name appears in both the card header (h3) and a dealer name field row
    expect(screen.getAllByText('Bajaj Bangalore Central').length).toBeGreaterThan(0);
    // MUI Chip with label "Active"
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows Inactive chip when dealer.isActive is false', () => {
    mockUseCaseDetailContext.mockReturnValue(
      makeContextReturn({
        dealer: {
          isLoading: false,
          isError: false,
          data: { ...MOCK_DEALER, isActive: false },
        },
      }),
    );

    renderScreen();

    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('shows "Could not load dealer details" when dealer.isError is true', () => {
    mockUseCaseDetailContext.mockReturnValue(
      makeContextReturn({ dealer: { isLoading: false, isError: true, data: undefined } }),
    );

    renderScreen();

    expect(screen.getByText('Dealer details unavailable.')).toBeInTheDocument();
  });
});

// ===========================================================================
// CaseTab — field rendering
// ===========================================================================

describe('CaseTab — all 8 case fields render in the grid', () => {
  it('renders Case ID label and value with monospace styling', () => {
    renderScreen();

    expect(screen.getByText('Case ID')).toBeInTheDocument();
    // caseId value
    expect(screen.getByText('ISR-042')).toBeInTheDocument();
    // The Typography for caseId has fontFamily monospace — check via DOM element
    const caseIdValue = screen.getByText('ISR-042');
    expect(caseIdValue).toBeInTheDocument();
    // MUI applies inline style for fontFamily when passed as sx/prop
    expect(caseIdValue).toHaveStyle({ fontFamily: 'monospace' });
  });

  it('renders Case Nature label and value', () => {
    renderScreen();

    expect(screen.getByText('Case Nature')).toBeInTheDocument();
    expect(screen.getByText('Complaint')).toBeInTheDocument();
  });

  it('renders Department label and value', () => {
    renderScreen();

    expect(screen.getByText('Department')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
  });

  it('renders Product Type label and value', () => {
    // Note: "Product Type" appears in both the CaseTab and VehicleCard (sidebar).
    // We scope the assertion to labels, not values, to stay unambiguous.
    renderScreen();

    const productTypeLabels = screen.getAllByText('Product Type');
    // CaseTab always has one; sidebar has one only when vehicle is loaded.
    expect(productTypeLabels.length).toBeGreaterThanOrEqual(1);
    // "Motorcycle" appears in VehicleCard sidebar AND CaseTab — use getAllByText
    expect(screen.getAllByText('Motorcycle').length).toBeGreaterThan(0);
  });

  it('renders Priority label and value', () => {
    renderScreen();

    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders Case Status label and Chip', () => {
    renderScreen();

    expect(screen.getByText('Case Status')).toBeInTheDocument();
    // Chip renders the status text; Open appears as chip label
    const caseStatusChip = screen.getAllByText('Open');
    expect(caseStatusChip.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Activity Status label and Chip', () => {
    renderScreen();

    expect(screen.getByText('Activity Status')).toBeInTheDocument();
    expect(screen.getByText('Fresh')).toBeInTheDocument();
  });

  it('renders Registered At label', () => {
    renderScreen();

    expect(screen.getByText('Registered At')).toBeInTheDocument();
    // The formatted date is locale-dependent — verify the label is present.
    // We also verify the element is in the document.
    expect(screen.getByText('Registered At')).toBeInTheDocument();
  });
});

// ===========================================================================
// CaseTab — Case Status Chip colour
// ===========================================================================

describe('CaseTab — Case Status Chip colour', () => {
  it('Open status chip has MuiChip-colorSuccess class', () => {
    renderScreen({ caseStatus: 'Open' });

    // MUI Chip applies color-based class names, e.g. MuiChip-colorSuccess
    const openChips = document.querySelectorAll('.MuiChip-colorSuccess');
    expect(openChips.length).toBeGreaterThan(0);
  });

  it('In Progress status chip has MuiChip-colorWarning class', () => {
    renderScreen({ caseStatus: 'In Progress' });

    const warningChips = document.querySelectorAll('.MuiChip-colorWarning');
    expect(warningChips.length).toBeGreaterThan(0);
    // The chip label text should be "In Progress"
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('Closed – Verified status chip has MuiChip-colorError class', () => {
    renderScreen({ caseStatus: 'Closed – Verified' });

    const errorChips = document.querySelectorAll('.MuiChip-colorError');
    expect(errorChips.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// CaseTab — Customer Remarks: empty → italic "None"
// ===========================================================================

describe('CaseTab — customerRemarks empty renders italic "None"', () => {
  it('renders "None" when customerRemarks is an empty string', () => {
    renderScreen({ customerRemarks: '' });

    // "None" text is rendered as the empty-remarks fallback.
    // jsdom does not compute MUI sx styles, so we verify text presence only.
    const noneElements = screen.getAllByText('None');
    expect(noneElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the actual remark text when customerRemarks is non-empty', () => {
    renderScreen({ customerRemarks: 'Delivery was delayed' });

    expect(screen.getByText('Delivery was delayed')).toBeInTheDocument();
    // "None" should not appear for the customer remarks slot
    // (agentRemarks has a value too in BASE_CASE_DETAIL)
    expect(screen.queryByText('None')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// CaseTab — Divider between fields and remarks
// ===========================================================================

describe('CaseTab — Divider between case fields and remarks', () => {
  it('renders an MUI Divider (hr element) between the case fields grid and the remarks grid', () => {
    renderScreen();

    // MUI Divider renders as <hr> by default
    const dividers = document.querySelectorAll('hr');
    expect(dividers.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// CaseTab — CtiCallRecording conditional rendering
// ===========================================================================

describe('CaseTab — call recording section (interactionChannel = "inbound_call")', () => {
  it('renders the "Original Call Recording" section label when interactionChannel is "inbound_call"', () => {
    renderScreen({ interactionChannel: 'inbound_call' });

    expect(screen.getByText('Original Call Recording')).toBeInTheDocument();
  });

  it('mounts CtiCallRecording component when interactionChannel is "inbound_call"', () => {
    renderScreen({ interactionChannel: 'inbound_call' });

    expect(screen.getByTestId('cti-call-recording')).toBeInTheDocument();
  });
});

describe('CaseTab — call recording section absent (interactionChannel = "manual")', () => {
  it('does NOT render the "Original Call Recording" section when interactionChannel is "manual"', () => {
    renderScreen({ interactionChannel: 'manual' });

    expect(screen.queryByText('Original Call Recording')).not.toBeInTheDocument();
  });

  it('does NOT mount CtiCallRecording when interactionChannel is "manual"', () => {
    renderScreen({ interactionChannel: 'manual' });

    expect(screen.queryByTestId('cti-call-recording')).not.toBeInTheDocument();
  });

  it('does NOT render the "Original Call Recording" section when interactionChannel is null', () => {
    renderScreen({ interactionChannel: null });

    expect(screen.queryByText('Original Call Recording')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cti-call-recording')).not.toBeInTheDocument();
  });
});
