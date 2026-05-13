/**
 * authStore — Phase 1.5 session-mode unit tests.
 *
 * Covered scenarios:
 * N17a — setSessionMode('manual') stores mode
 * N17b — setSessionMode('cti') stores mode
 * N17c — clearAuth() resets sessionMode to null
 * N17d — setAuth with sessionMode stores it
 * N17e — setAuth without sessionMode defaults to null
 *
 * Source: authStore.ts, CCM Phase 1.5 spec
 * Pattern: mirrors caseStore.test.ts (direct store action calls, no render)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../authStore';
import type { AuthUser } from '../authStore';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_USER: AuthUser = {
  id: 'usr-001',
  username: 'agent.test',
  displayName: 'Test Agent',
  roles: ['agent'],
  dealerRef: null,
};

// ---------------------------------------------------------------------------
// Reset store to initial state before every test
// ---------------------------------------------------------------------------

beforeEach(() => {
  useAuthStore.getState().clearAuth();
});

// ---------------------------------------------------------------------------
// N17a — setSessionMode stores 'manual'
// ---------------------------------------------------------------------------

describe('N17a — setSessionMode("manual")', () => {
  it('stores "manual" as the sessionMode', () => {
    useAuthStore.getState().setSessionMode('manual');

    expect(useAuthStore.getState().sessionMode).toBe('manual');
  });

  it('does not affect isAuthenticated', () => {
    useAuthStore.getState().setSessionMode('manual');

    // clearAuth ran in beforeEach so isAuthenticated starts false
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('does not affect user', () => {
    useAuthStore.getState().setSessionMode('manual');

    expect(useAuthStore.getState().user).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// N17b — setSessionMode stores 'cti'
// ---------------------------------------------------------------------------

describe('N17b — setSessionMode("cti")', () => {
  it('stores "cti" as the sessionMode', () => {
    useAuthStore.getState().setSessionMode('cti');

    expect(useAuthStore.getState().sessionMode).toBe('cti');
  });

  it('can overwrite an existing "manual" mode with "cti"', () => {
    useAuthStore.getState().setSessionMode('manual');
    useAuthStore.getState().setSessionMode('cti');

    expect(useAuthStore.getState().sessionMode).toBe('cti');
  });
});

// ---------------------------------------------------------------------------
// N17c — clearAuth resets sessionMode to null
// ---------------------------------------------------------------------------

describe('N17c — clearAuth() resets sessionMode to null', () => {
  it('resets sessionMode to null after it was "cti"', () => {
    useAuthStore.getState().setSessionMode('cti');
    expect(useAuthStore.getState().sessionMode).toBe('cti');

    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState().sessionMode).toBeNull();
  });

  it('resets sessionMode to null after it was "manual"', () => {
    useAuthStore.getState().setSessionMode('manual');
    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState().sessionMode).toBeNull();
  });

  it('also resets user to null on clearAuth', () => {
    useAuthStore.getState().setAuth(MOCK_USER, 'csrf-token', 'manual');
    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState().user).toBeNull();
  });

  it('also resets isAuthenticated to false on clearAuth', () => {
    useAuthStore.getState().setAuth(MOCK_USER, 'csrf-token', 'manual');
    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('also resets csrfToken to null on clearAuth', () => {
    useAuthStore.getState().setAuth(MOCK_USER, 'csrf-token', 'manual');
    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState().csrfToken).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// N17d — setAuth with sessionMode stores it
// ---------------------------------------------------------------------------

describe('N17d — setAuth({ sessionMode: "manual" }) stores the sessionMode', () => {
  it('stores "manual" sessionMode when passed to setAuth', () => {
    useAuthStore.getState().setAuth(MOCK_USER, 'csrf-abc', 'manual');

    expect(useAuthStore.getState().sessionMode).toBe('manual');
  });

  it('stores "cti" sessionMode when passed to setAuth', () => {
    useAuthStore.getState().setAuth(MOCK_USER, 'csrf-abc', 'cti');

    expect(useAuthStore.getState().sessionMode).toBe('cti');
  });

  it('also sets isAuthenticated to true', () => {
    useAuthStore.getState().setAuth(MOCK_USER, 'csrf-abc', 'manual');

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('also stores the user object', () => {
    useAuthStore.getState().setAuth(MOCK_USER, 'csrf-abc', 'manual');

    expect(useAuthStore.getState().user).toEqual(MOCK_USER);
  });

  it('also stores the csrfToken', () => {
    useAuthStore.getState().setAuth(MOCK_USER, 'csrf-abc', 'manual');

    expect(useAuthStore.getState().csrfToken).toBe('csrf-abc');
  });
});

// ---------------------------------------------------------------------------
// N17e — setAuth without sessionMode defaults to null
// ---------------------------------------------------------------------------

describe('N17e — setAuth without sessionMode defaults to null', () => {
  it('sessionMode is null when setAuth is called without the third argument', () => {
    useAuthStore.getState().setAuth(MOCK_USER, 'csrf-abc');

    expect(useAuthStore.getState().sessionMode).toBeNull();
  });

  it('sessionMode is null when setAuth is called with explicit undefined', () => {
    useAuthStore.getState().setAuth(MOCK_USER, 'csrf-abc', undefined);

    expect(useAuthStore.getState().sessionMode).toBeNull();
  });

  it('sessionMode is null when setAuth is called with explicit null', () => {
    useAuthStore.getState().setAuth(MOCK_USER, 'csrf-abc', null);

    expect(useAuthStore.getState().sessionMode).toBeNull();
  });

  it('still sets isAuthenticated to true even without sessionMode', () => {
    useAuthStore.getState().setAuth(MOCK_USER, 'csrf-abc');

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('replaces a previously stored sessionMode with null when called without third arg', () => {
    // First set a mode, then call setAuth again without a mode
    useAuthStore.getState().setAuth(MOCK_USER, 'csrf-abc', 'cti');
    expect(useAuthStore.getState().sessionMode).toBe('cti');

    useAuthStore.getState().setAuth(MOCK_USER, 'csrf-new');
    expect(useAuthStore.getState().sessionMode).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isDealer derived flag — not a phase-1.5 gap but verifies setAuth side-effects
// ---------------------------------------------------------------------------

describe('setAuth — isDealer derived from roles', () => {
  it('isDealer is false when roles contain no dealer_ prefix', () => {
    useAuthStore.getState().setAuth(MOCK_USER, 'csrf-abc', 'manual');

    expect(useAuthStore.getState().isDealer).toBe(false);
  });

  it('isDealer is true when a role starts with "dealer_"', () => {
    const dealerUser: AuthUser = { ...MOCK_USER, roles: ['dealer_user'] };
    useAuthStore.getState().setAuth(dealerUser, 'csrf-abc', 'manual');

    expect(useAuthStore.getState().isDealer).toBe(true);
  });
});
