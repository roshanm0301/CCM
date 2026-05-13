/**
 * ProtectedRoute — session validation tests.
 *
 * Scenarios:
 * 1. csrfToken null + isDealer false → shows loading spinner, calls /me + /csrf,
 *    then setAuth and renders children on success.
 * 2. csrfToken set + isDealer false → renders children immediately (no /me call).
 * 3. csrfToken null + /me returns 401 → redirects to /login.
 * 4. isDealer true (no csrfToken) → redirects to /login (CRITICAL-3 fix).
 * 5. isDealer true AND csrfToken set → redirects to /login (dealer bypass not possible).
 *
 * Source: ProtectedRoute.tsx, security-principles.md §Session restoration,
 *         CRITICAL-3 dealer role exclusion fix.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Hoisted mock variables — must exist before vi.mock() factories execute.
// ---------------------------------------------------------------------------
const mockSetAuth = vi.hoisted(() => vi.fn());
const mockClearAuth = vi.hoisted(() => vi.fn());

// ---------------------------------------------------------------------------
// Mock apiClient before importing the component under test.
// ---------------------------------------------------------------------------
vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock useAuthStore so we control csrfToken / isDealer without real Zustand state.
// ---------------------------------------------------------------------------
vi.mock('@/features/auth/authStore', () => ({
  useAuthStore: vi.fn(),
}));

import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/features/auth/authStore';
import { ProtectedRoute } from '../ProtectedRoute';

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockUseAuthStore = useAuthStore as unknown as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RenderOptions {
  csrfToken: string | null;
  isDealer?: boolean;
}

function renderInRouter({ csrfToken, isDealer = false }: RenderOptions) {
  mockUseAuthStore.mockReturnValue({
    csrfToken,
    isDealer,
    setAuth: mockSetAuth,
    clearAuth: mockClearAuth,
    user: null,
    isAuthenticated: false,
  });

  return render(
    <MemoryRouter initialEntries={['/workspace']}>
      <Routes>
        <Route
          path="/workspace"
          element={
            <ProtectedRoute>
              <div data-testid="protected-content">Protected</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Scenario 1: no csrfToken, not a dealer → calls /me + /csrf, then renders
  // -------------------------------------------------------------------------

  it('shows loading spinner while session is being validated', () => {
    // Hang both calls indefinitely so we can assert the pending UI.
    mockGet.mockReturnValue(new Promise(() => {}));

    renderInRouter({ csrfToken: null, isDealer: false });

    expect(screen.getByLabelText('Loading session')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('calls /me then /csrf, then setAuth and renders children on success', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            id: 'agent-1',
            username: 'john.doe',
            displayName: 'John Doe',
            role: 'AGENT',
            defaultAgentStatus: 'AVAILABLE',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: { csrfToken: 'fresh-csrf-token' },
        },
      });

    renderInRouter({ csrfToken: null, isDealer: false });

    // Initially shows the loading spinner.
    expect(screen.getByLabelText('Loading session')).toBeInTheDocument();

    // After both API calls resolve, children should be visible.
    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    expect(mockGet).toHaveBeenCalledWith('/api/v1/auth/me');
    expect(mockGet).toHaveBeenCalledWith('/api/v1/auth/csrf');
    expect(mockSetAuth).toHaveBeenCalledWith(
      {
        id: 'agent-1',
        username: 'john.doe',
        displayName: 'John Doe',
        roles: ['AGENT'],
        dealerRef: null,
      },
      'fresh-csrf-token',
      null,
    );
  });

  // -------------------------------------------------------------------------
  // Scenario 2: csrfToken already present, not a dealer → skip /me call
  // -------------------------------------------------------------------------

  it('renders children immediately when csrfToken is already in the store', async () => {
    renderInRouter({ csrfToken: 'existing-csrf-token', isDealer: false });

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    // No API calls should have been made — session is already hydrated.
    expect(mockGet).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Scenario 3: no csrfToken + /me returns 401 → redirect to /login
  // -------------------------------------------------------------------------

  it('redirects to /login when /me returns a 401 error', async () => {
    const unauthorizedError = Object.assign(new Error('Unauthorized'), {
      response: { status: 401 },
    });
    mockGet.mockRejectedValueOnce(unauthorizedError);

    renderInRouter({ csrfToken: null, isDealer: false });

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(mockSetAuth).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Scenario 4: isDealer true, no csrfToken → must redirect to /login
  // (CRITICAL-3: dealers must never access agent-only routes)
  // -------------------------------------------------------------------------

  it('redirects to /login when isDealer is true and csrfToken is null', async () => {
    renderInRouter({ csrfToken: null, isDealer: true });

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    // Must not attempt session restoration for a dealer.
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockSetAuth).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Scenario 5: isDealer true AND csrfToken set → still redirects to /login
  // (CRITICAL-3: a present csrfToken must not bypass the dealer check)
  // -------------------------------------------------------------------------

  it('redirects to /login when isDealer is true even if csrfToken is set', async () => {
    renderInRouter({ csrfToken: 'dealer-csrf-token', isDealer: true });

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    // No session restoration API calls must have been made.
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockSetAuth).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Additional: /csrf call fails after /me succeeds → redirect to /login
  // -------------------------------------------------------------------------

  it('redirects to /login when /csrf call fails after /me succeeds', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            id: 'agent-1',
            username: 'john.doe',
            displayName: 'John Doe',
            role: 'AGENT',
            defaultAgentStatus: 'AVAILABLE',
          },
        },
      })
      .mockRejectedValueOnce(new Error('CSRF endpoint unavailable'));

    renderInRouter({ csrfToken: null, isDealer: false });

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    expect(mockSetAuth).not.toHaveBeenCalled();
  });
});
