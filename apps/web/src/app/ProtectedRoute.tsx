/**
 * ProtectedRoute — gates all authenticated screens.
 *
 * Behavior:
 * 1. If csrfToken is already in the Zustand store (in-memory, post-login),
 *    render children immediately.
 * 2. If no csrfToken (page refresh), call GET /api/v1/auth/me — if the httpOnly
 *    session cookie is still valid the server will return the user profile.
 * 3. If /me succeeds: call GET /api/v1/auth/csrf to obtain a fresh CSRF token.
 * 4. If both succeed: setAuth(user, csrfToken) and render children.
 * 5. If /me fails (401) or /csrf fails: redirect to /login.
 *    Children are not shown until both calls resolve successfully.
 *
 * Source: task brief §4, security-principles.md
 */

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { apiClient } from '@/shared/api/client';
import { useAuthStore, type AuthUser, type SessionMode } from '@/features/auth/authStore';

interface MeResponse {
  id: string;
  username: string;
  displayName: string;
  role: 'AGENT';
  roles?: string[];
  defaultAgentStatus: string;
  /** The agent's previously-saved work mode — returned by the backend on every /me call. */
  sessionMode?: SessionMode | null;
}

interface CsrfResponse {
  success: true;
  data: {
    csrfToken: string;
  };
}

type ValidationState = 'pending' | 'valid' | 'invalid';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { csrfToken, isDealer, setAuth } = useAuthStore();
  const location = useLocation();
  const [validation, setValidation] = useState<ValidationState>(
    csrfToken && !isDealer ? 'valid' : 'pending',
  );

  useEffect(() => {
    // Dealers must not access agent-only routes. If the user in the Zustand
    // store is a dealer (has a dealer_ role), redirect to /login regardless
    // of whether a csrfToken is present. This prevents a dealer from browsing
    // to /workspace during the same browser session after dealer login.
    if (isDealer) {
      setValidation('invalid');
      return;
    }

    // If already authenticated as an agent in store, skip /me call
    if (csrfToken) {
      setValidation('valid');
      return;
    }

    let cancelled = false;

    async function restoreSession() {
      try {
        // Step 1: validate the session cookie and retrieve user profile
        const meRes = await apiClient.get<{ success: true; data: MeResponse }>('/api/v1/auth/me');
        if (cancelled) return;

        const meData = meRes.data.data;
        const user: AuthUser = {
          id: meData.id,
          username: meData.username,
          displayName: meData.displayName,
          roles: meData.roles ?? [meData.role],
          dealerRef: null,
        };

        // Step 2: obtain a fresh CSRF token — required for all state-mutating calls
        const csrfRes = await apiClient.get<CsrfResponse>('/api/v1/auth/csrf');
        if (cancelled) return;

        const csrfToken = csrfRes.data.data.csrfToken;
        // Restore the agent's previously-saved work mode so the
        // CtiModeSelectionDialog does not reappear on every page refresh.
        // On first login setAuth is called without sessionMode (→ null) so
        // the dialog correctly appears once.  Subsequent refreshes restore
        // the saved choice here.
        setAuth(user, csrfToken, meData.sessionMode ?? null);
        setValidation('valid');
      } catch {
        if (!cancelled) {
          setValidation('invalid');
        }
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, [csrfToken, isDealer, setAuth]);

  if (validation === 'pending') {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        aria-label="Loading session"
        aria-live="polite"
      >
        <CircularProgress size={40} aria-label="Validating session" />
      </Box>
    );
  }

  if (validation === 'invalid') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
