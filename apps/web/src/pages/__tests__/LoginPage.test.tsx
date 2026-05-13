/**
 * LoginPage — authentication flow tests.
 *
 * Scenarios:
 * 1. Renders username + password fields and Submit button.
 * 2. Agent login success → calls /api/v1/auth/login, then /api/v1/auth/csrf,
 *    then setAuth, then navigates to /workspace.
 * 3. Agent login 401 (wrong password) → shows error message, does NOT call
 *    /api/v1/dealer-auth/login.
 * 4. Agent login 403 (role mismatch) → tries /api/v1/dealer-auth/login;
 *    on dealer success → calls /api/v1/auth/csrf, then setAuth, then navigates
 *    to /dealer-catalog.
 * 5. Dealer login failure after 403 → shows dealer error, does NOT navigate.
 * 6. Already authenticated (isAuthenticated: true) → redirects to /workspace.
 *
 * Source: LoginPage.tsx, ux-specification.md Screen 1.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Hoisted mock variables — must be created before vi.mock() factories run.
// ---------------------------------------------------------------------------
const mockNavigate = vi.hoisted(() => vi.fn());
const mockSetAuth = vi.hoisted(() => vi.fn());

// ---------------------------------------------------------------------------
// Helper: create a minimal Axios-like error that passes axios.isAxiosError().
// axios.isAxiosError checks for the `isAxiosError` property on the object.
// ---------------------------------------------------------------------------
function axiosError(status: number, data?: unknown) {
  return Object.assign(new Error(`Request failed with status ${status}`), {
    isAxiosError: true,
    response: { status, data },
  });
}

// ---------------------------------------------------------------------------
// Mock apiClient
// ---------------------------------------------------------------------------
vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock useAuthStore
// ---------------------------------------------------------------------------
vi.mock('@/features/auth/authStore', () => ({
  useAuthStore: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock react-router-dom — keep MemoryRouter/Routes/Route real; only
// replace useNavigate so we can assert navigation calls.
// ---------------------------------------------------------------------------
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/features/auth/authStore';
import { LoginPage } from '../LoginPage';

const mockPost = apiClient.post as ReturnType<typeof vi.fn>;
const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockUseAuthStore = useAuthStore as unknown as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helper: render LoginPage wrapped in a MemoryRouter (needed for
// useSearchParams which is used inside the component).
// ---------------------------------------------------------------------------
function renderLoginPage(isAuthenticated = false) {
  mockUseAuthStore.mockReturnValue({
    isAuthenticated,
    setAuth: mockSetAuth,
    user: null,
    csrfToken: null,
    isDealer: false,
    clearAuth: vi.fn(),
  });

  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Shared CSRF mock response
// ---------------------------------------------------------------------------
const csrfSuccess = {
  data: {
    success: true,
    data: { csrfToken: 'test-csrf-token' },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Scenario 1: renders the form fields
  // -------------------------------------------------------------------------

  describe('form rendering', () => {
    it('renders User ID field, Password field, and Sign In button', () => {
      renderLoginPage();

      expect(screen.getByLabelText('User ID')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Sign in to CCM/i }),
      ).toBeInTheDocument();
    });

    it('shows the Call Centre Management heading', () => {
      renderLoginPage();

      expect(screen.getByText('Call Centre Management')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 2: agent login success → /login → /csrf → setAuth → navigate /workspace
  // -------------------------------------------------------------------------

  describe('agent login success', () => {
    it('calls /auth/login, then /auth/csrf, then setAuth, then navigates to /workspace', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            user: {
              id: 'agent-1',
              username: 'agent1',
              displayName: 'Agent One',
              roles: ['AGENT'],
            },
          },
        },
      });
      mockGet.mockResolvedValueOnce(csrfSuccess);

      renderLoginPage();

      fireEvent.change(screen.getByLabelText('User ID'), {
        target: { value: 'agent1' },
      });
      fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'Agent@123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Sign in to CCM/i }));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/login', {
          username: 'agent1',
          password: 'Agent@123',
        });
      });

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/api/v1/auth/csrf');
      });

      await waitFor(() => {
        expect(mockSetAuth).toHaveBeenCalledWith(
          {
            id: 'agent-1',
            username: 'agent1',
            displayName: 'Agent One',
            roles: ['AGENT'],
            dealerRef: null,
          },
          'test-csrf-token',
        );
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/workspace', { replace: true });
      });

      // Dealer endpoint must not have been called.
      expect(mockPost).not.toHaveBeenCalledWith(
        '/api/v1/dealer-auth/login',
        expect.anything(),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 3: agent login 401 → shows error, does NOT try dealer endpoint
  // -------------------------------------------------------------------------

  describe('agent login 401', () => {
    it('shows error message and does not call dealer-auth/login on 401', async () => {
      const authFailedError = {
        response: {
          status: 401,
          data: {
            success: false,
            error: { code: 'AUTH_FAILED', message: 'Invalid credentials' },
          },
        },
      };
      mockPost.mockRejectedValueOnce(authFailedError);

      renderLoginPage();

      fireEvent.change(screen.getByLabelText('User ID'), {
        target: { value: 'agent1' },
      });
      fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'wrong-password' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Sign in to CCM/i }));

      await waitFor(() => {
        expect(
          screen.getByText('Unable to sign in. Please try again.'),
        ).toBeInTheDocument();
      });

      // Dealer endpoint must not have been tried.
      expect(mockPost).not.toHaveBeenCalledWith(
        '/api/v1/dealer-auth/login',
        expect.anything(),
      );

      // Must not navigate away.
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('shows generic error when response body is absent on 401', async () => {
      mockPost.mockRejectedValueOnce({
        response: { status: 401 },
      });

      renderLoginPage();

      fireEvent.change(screen.getByLabelText('User ID'), {
        target: { value: 'agent1' },
      });
      fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'bad-pass' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Sign in to CCM/i }));

      await waitFor(() => {
        expect(
          screen.getByText('Unable to sign in. Please try again.'),
        ).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 4: agent login 403 → dealer login success → setAuth → /dealer-catalog
  // -------------------------------------------------------------------------

  describe('agent login 403 → dealer fallback success', () => {
    it('tries dealer-auth/login on 403, then csrf, then setAuth, then navigates to /dealer-catalog', async () => {
      // Step 1: Agent endpoint returns 403 (user is not an agent).
      mockPost
        .mockRejectedValueOnce(axiosError(403))
        // Step 2: Dealer endpoint succeeds.
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              user: {
                id: 'dealer-1',
                username: 'dealer1',
                displayName: 'Dealer One',
                roles: ['dealer_user'],
                dealerRef: 'DLR-001',
              },
            },
          },
        });

      // Step 3: CSRF call succeeds.
      mockGet.mockResolvedValueOnce(csrfSuccess);

      renderLoginPage();

      fireEvent.change(screen.getByLabelText('User ID'), {
        target: { value: 'dealer1' },
      });
      fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'Dealer@123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Sign in to CCM/i }));

      // Agent login must have been attempted first.
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/login', {
          username: 'dealer1',
          password: 'Dealer@123',
        });
      });

      // Dealer login must then be attempted.
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/api/v1/dealer-auth/login', {
          username: 'dealer1',
          password: 'Dealer@123',
        });
      });

      // CSRF must have been fetched.
      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/api/v1/auth/csrf');
      });

      // setAuth must be called with dealer user profile.
      await waitFor(() => {
        expect(mockSetAuth).toHaveBeenCalledWith(
          {
            id: 'dealer-1',
            username: 'dealer1',
            displayName: 'Dealer One',
            roles: ['dealer_user'],
            dealerRef: 'DLR-001',
          },
          'test-csrf-token',
        );
      });

      // Must navigate to dealer catalog.
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dealer-catalog', { replace: true });
      });
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 5: dealer login fails after 403 → shows error, does NOT navigate
  // -------------------------------------------------------------------------

  describe('agent login 403 → dealer fallback failure', () => {
    it('shows dealer error message and does not navigate when dealer login also fails', async () => {
      // Agent endpoint returns 403.
      mockPost
        .mockRejectedValueOnce(axiosError(403))
        // Dealer endpoint also fails.
        .mockRejectedValueOnce({
          response: {
            status: 401,
            data: {
              success: false,
              error: { code: 'AUTH_FAILED', message: 'Invalid dealer credentials' },
            },
          },
        });

      renderLoginPage();

      fireEvent.change(screen.getByLabelText('User ID'), {
        target: { value: 'dealer1' },
      });
      fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'wrong-password' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Sign in to CCM/i }));

      await waitFor(() => {
        expect(
          screen.getByText('Unable to sign in. Please try again.'),
        ).toBeInTheDocument();
      });

      // Must not navigate anywhere.
      expect(mockNavigate).not.toHaveBeenCalled();

      // CSRF must not have been fetched.
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('shows generic error when dealer response body is absent', async () => {
      mockPost
        .mockRejectedValueOnce(axiosError(403))
        .mockRejectedValueOnce(axiosError(500));

      renderLoginPage();

      fireEvent.change(screen.getByLabelText('User ID'), {
        target: { value: 'dealer1' },
      });
      fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'bad-pass' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Sign in to CCM/i }));

      await waitFor(() => {
        expect(
          screen.getByText('Unable to sign in. Please try again.'),
        ).toBeInTheDocument();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 6: already authenticated → redirects to /workspace immediately
  // -------------------------------------------------------------------------

  describe('already authenticated', () => {
    it('navigates to /workspace on mount when isAuthenticated is true', async () => {
      renderLoginPage(true);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/workspace', { replace: true });
      });
    });
  });

  // -------------------------------------------------------------------------
  // Client-side validation
  // -------------------------------------------------------------------------

  describe('client-side validation', () => {
    it('shows field errors without calling the API when both fields are empty', async () => {
      renderLoginPage();

      fireEvent.click(screen.getByRole('button', { name: /Sign in to CCM/i }));

      await waitFor(() => {
        expect(screen.getByText('Enter User ID.')).toBeInTheDocument();
        expect(screen.getByText('Enter Password.')).toBeInTheDocument();
      });

      expect(mockPost).not.toHaveBeenCalled();
    });

    it('shows password error without calling the API when only username is filled', async () => {
      renderLoginPage();

      fireEvent.change(screen.getByLabelText('User ID'), {
        target: { value: 'agent1' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Sign in to CCM/i }));

      await waitFor(() => {
        expect(screen.getByText('Enter Password.')).toBeInTheDocument();
      });

      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // userEvent-based smoke test (uses @testing-library/user-event v14)
  // -------------------------------------------------------------------------

  describe('form interaction with userEvent', () => {
    it('accepts typed values and submits on button click', async () => {
      const user = userEvent.setup();

      mockPost.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            user: {
              id: 'agent-2',
              username: 'agentB',
              displayName: 'Agent B',
              role: 'AGENT',
            },
          },
        },
      });
      mockGet.mockResolvedValueOnce(csrfSuccess);

      renderLoginPage();

      await user.type(screen.getByLabelText('User ID'), 'agentB');
      await user.type(screen.getByLabelText('Password'), 'Pass@456');
      await user.click(screen.getByRole('button', { name: /Sign in to CCM/i }));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/login', {
          username: 'agentB',
          password: 'Pass@456',
        });
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/workspace', { replace: true });
      });
    });
  });
});
