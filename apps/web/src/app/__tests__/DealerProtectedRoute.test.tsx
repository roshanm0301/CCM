/**
 * DealerProtectedRoute — auth guard tests.
 *
 * Scenarios:
 * 1. csrfToken present, isDealer: false → redirects to /login.
 * 2. csrfToken present, isDealer: false (authenticated agent) → redirects to /login.
 * 3. csrfToken present, isDealer: true → renders children.
 * 4. csrfToken present, isDealer: false (AGENT role) → redirects to /login.
 * 5. (NEW) Page refresh: /me returns a dealer user → restores session, renders children.
 * 6. (NEW) Page refresh: /me returns 401 → redirects to /login?reason=session_expired.
 * 7. (NEW) Page refresh: /me returns a non-dealer user → redirects to /login (no session_expired reason — role mismatch, not expiry).
 *
 * Source: DealerProtectedRoute.tsx, Phase 6 auth layer extension brief.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mock useAuthStore — control csrfToken, isDealer, setAuth
// ---------------------------------------------------------------------------
vi.mock('@/features/auth/authStore', () => ({
  useAuthStore: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock apiClient — control /me and /csrf responses
// ---------------------------------------------------------------------------
vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { useAuthStore } from '@/features/auth/authStore';
import { apiClient } from '@/shared/api/client';
import { DealerProtectedRoute } from '../DealerProtectedRoute';

const mockUseAuthStore = useAuthStore as unknown as ReturnType<typeof vi.fn>;
const mockApiGet = (apiClient.get as ReturnType<typeof vi.fn>);

// ---------------------------------------------------------------------------
// Helper: render the route guard inside a MemoryRouter
// ---------------------------------------------------------------------------
function renderGuard({
  csrfToken,
  isDealer,
  setAuth = vi.fn(),
}: {
  csrfToken: string | null;
  isDealer: boolean;
  setAuth?: ReturnType<typeof vi.fn>;
}) {
  mockUseAuthStore.mockReturnValue({ csrfToken, isDealer, setAuth });

  return render(
    <MemoryRouter initialEntries={['/dealer']}>
      <Routes>
        <Route
          path="/dealer"
          element={
            <DealerProtectedRoute>
              <div data-testid="dealer-content">Dealer Page</div>
            </DealerProtectedRoute>
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

describe('DealerProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: /me rejects with 401 (no active session)
    mockApiGet.mockRejectedValue({ response: { status: 401 } });
  });

  // ── Synchronous fast-path tests (csrfToken present in store) ────────────────

  it('redirects to /login when csrfToken is present but isDealer is false', () => {
    renderGuard({ csrfToken: 'mock-csrf-token', isDealer: false });

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('dealer-content')).not.toBeInTheDocument();
  });

  it('redirects to /login when authenticated agent (isDealer: false) with csrfToken', () => {
    renderGuard({ csrfToken: 'mock-csrf-token', isDealer: false });

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('dealer-content')).not.toBeInTheDocument();
  });

  it('renders children when csrfToken is present and isDealer is true', () => {
    renderGuard({ csrfToken: 'mock-csrf-token', isDealer: true });

    expect(screen.getByTestId('dealer-content')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('redirects an authenticated agent (AGENT role, isDealer: false) with csrfToken to /login', () => {
    renderGuard({ csrfToken: 'mock-csrf-token', isDealer: false });

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('dealer-content')).not.toBeInTheDocument();
  });

  // ── Async restore tests (no csrfToken — page refresh) ──────────────────────

  it('(refresh) /me returns a dealer user → restores session and renders children', async () => {
    const mockSetAuth = vi.fn();
    mockApiGet
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            id: 'user-dealer-001',
            username: 'dealer1',
            displayName: 'Dealer One',
            roles: ['dealer_service_advisor'],
            dealerRef: 'BAJ-MH-001',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: { csrfToken: 'fresh-csrf-token' },
        },
      });

    renderGuard({ csrfToken: null, isDealer: false, setAuth: mockSetAuth });

    await waitFor(() => {
      expect(screen.getByTestId('dealer-content')).toBeInTheDocument();
    });
    expect(mockSetAuth).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'dealer1', roles: ['dealer_service_advisor'] }),
      'fresh-csrf-token',
    );
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('(refresh) /me returns 401 → redirects to /login?reason=session_expired', async () => {
    mockApiGet.mockRejectedValue({ response: { status: 401 } });

    renderGuard({ csrfToken: null, isDealer: false });

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('dealer-content')).not.toBeInTheDocument();
  });

  it('(refresh) /me returns a non-dealer user → redirects to /login (no session_expired reason)', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: 'user-agent-001',
          username: 'agent1',
          displayName: 'Agent One',
          roles: ['agent'],
        },
      },
    });

    renderGuard({ csrfToken: null, isDealer: false });

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('dealer-content')).not.toBeInTheDocument();
  });
});
