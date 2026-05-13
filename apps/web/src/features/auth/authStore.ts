/**
 * Auth store — Zustand-based.
 *
 * Security rules:
 * - JWT is httpOnly cookie — never stored here.
 * - Only csrfToken (for X-CSRF-Token header injection) and user profile are stored.
 * - NOT persisted to localStorage or sessionStorage.
 * - On 401 from any API: clearAuth() and redirect to /login.
 *
 * Source: security-principles.md, task brief CSRF rules
 */

import { create } from 'zustand';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  dealerRef: string | null;
}

/** Session mode selected by the agent at session start. null = not yet chosen. */
export type SessionMode = 'manual' | 'cti';

interface AuthState {
  user: AuthUser | null;
  csrfToken: string | null;
  isAuthenticated: boolean;
  isDealer: boolean;
  /**
   * The work mode chosen by the agent for this session.
   * null = agent has not yet selected a mode (CtiModeSelectionDialog will be shown).
   */
  sessionMode: SessionMode | null;
  /** Set on successful login or /me validation. */
  setAuth: (user: AuthUser, csrfToken: string, sessionMode?: SessionMode | null) => void;
  /** Clear on logout or 401. */
  clearAuth: () => void;
  /** Explicitly set the session mode after the agent selects one. */
  setSessionMode: (mode: SessionMode) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  csrfToken: null,
  isAuthenticated: false,
  isDealer: false,
  sessionMode: null,

  setAuth: (user: AuthUser, csrfToken: string, sessionMode?: SessionMode | null) =>
    set({
      user,
      csrfToken,
      isAuthenticated: true,
      isDealer: user.roles.some((r) => r.startsWith('dealer_')),
      sessionMode: sessionMode ?? null,
    }),

  clearAuth: () =>
    set({
      user: null,
      csrfToken: null,
      isAuthenticated: false,
      isDealer: false,
      sessionMode: null,
    }),

  setSessionMode: (mode: SessionMode) => set({ sessionMode: mode }),
}));
