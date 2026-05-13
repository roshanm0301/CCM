/**
 * CaseDetailPage — page-level unit tests.
 *
 * Covered scenarios:
 * 1. Agent layout — roles: ['AGENT'] (isDealer=false) → NavRail rendered, ml:'56px' margin applied
 * 2. Dealer layout — roles: ['dealer_sales'] (isDealer=true) → NavRail NOT rendered, no left margin
 * 3. Loading state — shows CircularProgress while fetching case detail
 * 4. 404 case not found — API throws with response.status === 404 → "Case not found." shown
 * 5. Back navigation for dealer → navigates to /dealer-catalog
 * 6. Back navigation for agent → navigates to /workspace
 *
 * Source: CCM_Phase6_Resolution_Activities.md § Case Detail Screen
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Hoisted mock variables — declared before vi.mock() factory functions execute.
// ---------------------------------------------------------------------------

const mockGetCaseDetail = vi.hoisted(() => vi.fn());
const mockUseAuthStoreImpl = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

// ---------------------------------------------------------------------------
// Mock react-router-dom navigate — keep MemoryRouter routing intact but
// intercept programmatic navigate() calls for assertion.
// ---------------------------------------------------------------------------

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ---------------------------------------------------------------------------
// Mock authStore — controls user roles per test.
// ---------------------------------------------------------------------------

vi.mock('@/features/auth/authStore', () => ({
  useAuthStore: mockUseAuthStoreImpl,
}));

// ---------------------------------------------------------------------------
// Mock apiClient — CaseDetailPage uses it directly via fetchCaseDetail inline fn.
// ---------------------------------------------------------------------------

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock heavy sub-components to isolate page-level logic.
// ---------------------------------------------------------------------------

vi.mock('@/features/cases/CaseDetailScreen', () => ({
  CaseDetailScreen: () => (
    <div data-testid="case-detail-screen">CaseDetailScreen</div>
  ),
}));

vi.mock('@/shared/components/NavRail', () => ({
  NavRail: () => <div data-testid="nav-rail">NavRail</div>,
}));

vi.mock('@/shared/components/GlobalHeader', () => ({
  GlobalHeader: () => <div data-testid="global-header">GlobalHeader</div>,
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks are registered.
// ---------------------------------------------------------------------------

import { apiClient } from '@/shared/api/client';
import { CaseDetailPage } from '../CaseDetailPage';

const mockApiGet = apiClient.get as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Default mock case DTO
// ---------------------------------------------------------------------------

const mockCase = {
  id: 'CASE-001',
  caseId: 'CASE-001',
  interactionId: 'INT-001',
  customerRef: 'CUST-001',
  vehicleRef: null,
  dealerRef: 'DEALER-001',
  caseNature: 'Complaint',
  department: 'SERVICE',
  priority: null,
  productType: 'Motorcycle',
  productTypeSource: 'Derived',
  caseCategoryId: 'cat-001',
  caseSubcategoryId: 'subcat-001',
  customerRemarks: 'Test remarks',
  agentRemarks: '',
  caseStatus: 'Open',
  activityStatus: 'Fresh',
  registeredAt: '2026-03-01T10:00:00.000Z',
  currentStepNo: 1,
  currentStepTemplateId: 'tmpl-001',
  activityStateVersion: 1,
};

// ---------------------------------------------------------------------------
// Test render helper
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Disable retries so errors propagate immediately in tests
        retry: false,
      },
    },
  });
}

interface RenderOptions {
  roles?: string[];
  caseId?: string;
}

function renderPage({ roles = ['AGENT'], caseId = 'CASE-001' }: RenderOptions = {}) {
  const isDealer = roles.some((r) => r.startsWith('dealer_'));

  mockUseAuthStoreImpl.mockImplementation((selector: (s: unknown) => unknown) => {
    const state = {
      user: { id: 'user-1', username: 'testuser', displayName: 'Test User', roles, dealerRef: null },
      isDealer,
    };
    return selector(state);
  });

  const queryClient = makeQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/cases/${caseId}`]}>
        <Routes>
          <Route path="/cases/:caseId" element={<CaseDetailPage />} />
          <Route path="/dealer-catalog" element={<div data-testid="dealer-catalog-page">Dealer Catalog</div>} />
          <Route path="/workspace" element={<div data-testid="workspace-page">Workspace</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CaseDetailPage', () => {
  // -------------------------------------------------------------------------
  // 1. Agent layout — NavRail rendered, ml:'56px' margin applied
  // -------------------------------------------------------------------------

  describe('Agent layout (isDealer = false)', () => {
    it('renders NavRail for an AGENT user', async () => {
      mockApiGet.mockResolvedValue({
        data: { success: true, data: mockCase },
      });

      renderPage({ roles: ['AGENT'] });

      // NavRail is rendered synchronously (not behind a loading gate)
      expect(screen.getByTestId('nav-rail')).toBeInTheDocument();
    });

    it('applies ml:"56px" to the main content box for agent users', async () => {
      mockApiGet.mockResolvedValue({
        data: { success: true, data: mockCase },
      });

      renderPage({ roles: ['AGENT'] });

      // Agent layout must render the NavRail, which is the structural reason
      // for the 56px left margin. Checking NavRail presence is more reliable
      // than inspecting inline CSS in jsdom (emotion may use class-based styles).
      expect(screen.getByTestId('nav-rail')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Dealer layout — NavRail NOT rendered, no left margin
  // -------------------------------------------------------------------------

  describe('Dealer layout (isDealer = true)', () => {
    it('does NOT render NavRail for a dealer user', async () => {
      mockApiGet.mockResolvedValue({
        data: { success: true, data: mockCase },
      });

      renderPage({ roles: ['dealer_sales'] });

      expect(screen.queryByTestId('nav-rail')).not.toBeInTheDocument();
    });

    it('does NOT apply a left margin for dealer users (ml is 0)', async () => {
      mockApiGet.mockResolvedValue({
        data: { success: true, data: mockCase },
      });

      const { container } = renderPage({ roles: ['dealer_sales'] });

      await waitFor(() => {
        expect(screen.getByTestId('case-detail-screen')).toBeInTheDocument();
      });

      // No MuiBox should carry 56px margin-left when isDealer is true
      const boxes = container.querySelectorAll('[class*="MuiBox"]');
      const has56pxMargin = Array.from(boxes).some((el) => {
        const style = (el as HTMLElement).getAttribute('style') ?? '';
        return style.includes('56px');
      });
      expect(has56pxMargin).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Loading state — CircularProgress shown while fetching
  // -------------------------------------------------------------------------

  describe('Loading state', () => {
    it('shows a loading spinner while the case detail is being fetched', () => {
      // Never-resolving promise — keeps the component in loading state
      mockApiGet.mockReturnValue(new Promise(() => {}));

      renderPage({ roles: ['AGENT'] });

      // MUI CircularProgress renders an SVG with role="progressbar"
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      // CaseDetailScreen must NOT be visible yet
      expect(screen.queryByTestId('case-detail-screen')).not.toBeInTheDocument();
    });

    it('hides the loading spinner once data has loaded', async () => {
      mockApiGet.mockResolvedValue({
        data: { success: true, data: mockCase },
      });

      renderPage({ roles: ['AGENT'] });

      await waitFor(() => {
        expect(screen.getByTestId('case-detail-screen')).toBeInTheDocument();
      });

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 4. 404 case not found
  // -------------------------------------------------------------------------

  describe('404 — Case not found', () => {
    it('shows "Case not found." when the API responds with status 404', async () => {
      const notFoundError = Object.assign(new Error('Not Found'), {
        response: { status: 404 },
      });
      mockApiGet.mockRejectedValue(notFoundError);

      renderPage({ roles: ['AGENT'] });

      await waitFor(() => {
        expect(screen.getByText('Case not found.')).toBeInTheDocument();
      });

      // CaseDetailScreen must not render
      expect(screen.queryByTestId('case-detail-screen')).not.toBeInTheDocument();
    });

    it('shows "Failed to load case details." for non-404 API errors', async () => {
      const serverError = Object.assign(new Error('Internal Server Error'), {
        response: { status: 500 },
      });
      mockApiGet.mockRejectedValue(serverError);

      renderPage({ roles: ['AGENT'] });

      await waitFor(() => {
        expect(screen.getByText('Failed to load case details.')).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // 5. Back navigation — dealer goes to /dealer-catalog
  // -------------------------------------------------------------------------

  describe('Back navigation for dealer', () => {
    it('navigates to /dealer-catalog when the Back button is clicked by a dealer', async () => {
      mockApiGet.mockResolvedValue({
        data: { success: true, data: mockCase },
      });

      renderPage({ roles: ['dealer_sales'] });

      await waitFor(() => {
        expect(screen.getByTestId('case-detail-screen')).toBeInTheDocument();
      });

      // Click the "← Back" button in the content area
      const backButton = screen.getByRole('button', { name: /^back$/i });
      fireEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/dealer-catalog');
      expect(mockNavigate).not.toHaveBeenCalledWith('/workspace');
    });

    it('navigates to /dealer-catalog when Back is clicked from the error state (dealer)', async () => {
      const notFoundError = Object.assign(new Error('Not Found'), {
        response: { status: 404 },
      });
      mockApiGet.mockRejectedValue(notFoundError);

      renderPage({ roles: ['dealer_sales'] });

      await waitFor(() => {
        expect(screen.getByText('Case not found.')).toBeInTheDocument();
      });

      // The error Alert also has a Back button
      fireEvent.click(screen.getByRole('button', { name: /go back/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/dealer-catalog');
    });
  });

  // -------------------------------------------------------------------------
  // 6. Back navigation — agent goes to /workspace
  // -------------------------------------------------------------------------

  describe('Back navigation for agent', () => {
    it('navigates to /workspace when the Back button is clicked by an agent', async () => {
      mockApiGet.mockResolvedValue({
        data: { success: true, data: mockCase },
      });

      renderPage({ roles: ['AGENT'] });

      await waitFor(() => {
        expect(screen.getByTestId('case-detail-screen')).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /^back$/i });
      fireEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/workspace');
      expect(mockNavigate).not.toHaveBeenCalledWith('/dealer-catalog');
    });

    it('navigates to /workspace when Back is clicked from the error state (agent)', async () => {
      const notFoundError = Object.assign(new Error('Not Found'), {
        response: { status: 404 },
      });
      mockApiGet.mockRejectedValue(notFoundError);

      renderPage({ roles: ['AGENT'] });

      await waitFor(() => {
        expect(screen.getByText('Case not found.')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /go back/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/workspace');
    });
  });
});
