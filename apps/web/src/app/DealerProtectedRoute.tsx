/**
 * DealerProtectedRoute — gates dealer-only screens.
 *
 * Behavior:
 * 1. If a CSRF token is in the Zustand store AND the user is a dealer → render
 *    children immediately (fast-path — same-session navigation).
 * 2. If a CSRF token is in store but the user is NOT a dealer → redirect to /login.
 * 3. If no CSRF token (page refresh) → restore session via GET /api/v1/auth/me
 *    then GET /api/v1/auth/csrf.
 *    - /me returns a dealer user → setAuth + render children.
 *    - /me returns a non-dealer user → redirect to /login.
 *    - /me fails (401/403/network) → redirect to /login?reason=session_expired.
 *
 * Source: Phase 6 auth layer extension brief; mirrors ProtectedRoute.tsx pattern.
 */

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { apiClient } from '@/shared/api/client';
import { useAuthStore, type AuthUser } from '@/features/auth/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MeResponse {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  dealerRef?: string | null;
  agentStatus?: string;
}

interface CsrfResponse {
  success: true;
  data: {
    csrfToken: string;
  };
}

// 'invalid'    = session expired / auth failure → /login?reason=session_expired
// 'not-dealer' = session valid but user is not a dealer → /login (no reason)
type ValidationState = 'pending' | 'valid' | 'invalid' | 'not-dealer';

interface DealerProtectedRouteProps {
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DealerProtectedRoute({ children }: DealerProtectedRouteProps) {
  const { csrfToken, isDealer, setAuth } = useAuthStore();
  const location = useLocation();

  // Initialise synchronously when we already have a token in memory.
  const [validation, setValidation] = useState<ValidationState>(() => {
    if (csrfToken && isDealer) return 'valid';
    if (csrfToken && !isDealer) return 'not-dealer'; // logged in as agent/other role
    return 'pending'; // no token — page refresh, must validate via /me
  });

  useEffect(() => {
    // If we have a CSRF token in memory, resolve synchronously without /me.
    if (csrfToken) {
      setValidation(isDealer ? 'valid' : 'not-dealer');
      return;
    }

    // No CSRF token (page refresh) → attempt to restore the session.
    let cancelled = false;

    async function restoreSession() {
      try {
        // Step 1: validate the session cookie and retrieve user profile.
        const meRes = await apiClient.get<{ success: true; data: MeResponse }>('/api/v1/auth/me');
        if (cancelled) return;

        const meData = meRes.data.data;
        const roles = meData.roles ?? [];

        // Step 2: verify the restored user is a dealer.
        const isDealerUser = roles.some((r) => r.startsWith('dealer_'));
        if (!isDealerUser) {
          // Session cookie is valid but belongs to a non-dealer user — not a
          // session expiry, so redirect without the session_expired reason.
          setValidation('not-dealer');
          return;
        }

        // Step 3: obtain a fresh CSRF token.
        const csrfRes = await apiClient.get<CsrfResponse>('/api/v1/auth/csrf');
        if (cancelled) return;

        const user: AuthUser = {
          id: meData.id,
          username: meData.username,
          displayName: meData.displayName,
          roles,
          dealerRef: meData.dealerRef ?? null,
        };
        setAuth(user, csrfRes.data.data.csrfToken);
        setValidation('valid');
      } catch {
        if (!cancelled) {
          setValidation('invalid');
        }
      }
    }

    void restoreSession();

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

  if (validation === 'not-dealer') {
    // Valid session but user lacks dealer role — redirect without session_expired reason.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (validation === 'invalid') {
    // Auth failure or expired session — show session_expired message on login page.
    return <Navigate to="/login?reason=session_expired" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
