// =============================================================================
// CCM API — Dealer Auth Service Unit Tests
//
// Tests business rules by mocking common-login helpers (verifyCredentials,
// signJwt, generateCsrfToken), auth.repository (findUserRoles), PostgreSQL
// pool (external_user_ref lookup), and audit repository.
//
// After the Wave 3 refactor, dealer-auth.service.ts no longer imports
// bcryptjs, jsonwebtoken, or crypto directly — those responsibilities are
// encapsulated in common-login.ts. This test file therefore mocks the
// common-login module directly at the correct seam rather than relying on
// transitive interception of its deep dependencies.
//
// Covered scenarios:
//   - 401 user not found (no enumeration difference)
//   - 401 password mismatch
//   - 403 account inactive
//   - 403 user has no role starting with 'dealer_' (agent role only)
//   - Success: dealer_ role present → JWT + CSRF + dealerRef returned
//   - dealerRef null when external_user_ref not set
//   - Audit event written as 'dealer_login' (not 'agent_status_changed')
//   - Audit failure is non-fatal
//   - No agent_statuses upsert ever called
// Source: CCM_Phase6_Resolution_Activities.md § Dealer Login
// =============================================================================

import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock function references
//
// vi.mock() is hoisted to the top of the file. Variables referenced directly
// inside a factory (not inside a nested function) must be created with
// vi.hoisted() to avoid temporal dead zone errors. Additionally, vi.resetAllMocks()
// clears mockReturnValue implementations set in factories — by keeping the fn
// reference external and re-applying it in beforeEach we survive the reset.
// ---------------------------------------------------------------------------

const { mockVerifyCredentials, mockSignJwt, mockGenerateCsrfToken } = vi.hoisted(() => ({
  mockVerifyCredentials:   vi.fn(),
  mockSignJwt:             vi.fn(),
  mockGenerateCsrfToken:   vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock common-login (the direct dependency of dealer-auth.service after W3-1)
//
// Mocking at this seam is explicit and stable: if common-login.ts is refactored
// internally (e.g., its own deep dependencies change), this test remains correct
// because it validates the dealer-auth.service contract, not the helper internals.
// ---------------------------------------------------------------------------

vi.mock('../../auth/common-login', () => ({
  verifyCredentials:  mockVerifyCredentials,
  signJwt:            mockSignJwt,
  generateCsrfToken:  mockGenerateCsrfToken,
}));

// ---------------------------------------------------------------------------
// Mock config
// ---------------------------------------------------------------------------

vi.mock('../../../config/index', () => ({
  config: { jwtSecret: 'test-secret', jwtExpiry: '8h' },
}));

// ---------------------------------------------------------------------------
// Mock auth repository (shared with agent login)
// ---------------------------------------------------------------------------

vi.mock('../../auth/auth.repository', () => ({
  findUserByUsername: vi.fn(),
  findUserRoles:      vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock PostgreSQL pool (used for external_user_ref lookup)
// ---------------------------------------------------------------------------

const mockPoolQuery = vi.fn();

vi.mock('../../../shared/database/postgres', () => ({
  getPool: () => ({ query: mockPoolQuery }),
}));

// ---------------------------------------------------------------------------
// Mock audit repository
// ---------------------------------------------------------------------------

vi.mock('../../audit/audit.repository', () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Mock logger (suppress output during tests)
// ---------------------------------------------------------------------------

vi.mock('../../../shared/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import * as authRepo from '../../auth/auth.repository';
import { writeAuditEvent } from '../../audit/audit.repository';
import { dealerLoginService } from '../dealer-auth.service';

// ---------------------------------------------------------------------------
// Typed mock helpers
//
// mockFindUser is kept to support UserRow type derivation and for tests that
// need to control findUserRoles. Credential verification (user lookup, bcrypt,
// active check) is now mocked at the verifyCredentials level via common-login.
// ---------------------------------------------------------------------------

const mockFindUser  = authRepo.findUserByUsername as MockedFunction<typeof authRepo.findUserByUsername>;
const mockFindRoles = authRepo.findUserRoles      as MockedFunction<typeof authRepo.findUserRoles>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type UserRow = Awaited<ReturnType<typeof authRepo.findUserByUsername>>;

const dealerUserRow: NonNullable<UserRow> = {
  id:            'd1000000-0000-0000-0000-000000000001',
  username:      'dealer1',
  password_hash: '$2a$10$hashed',
  display_name:  'Dealer One',
  is_active:     true,
  session_mode:  null,
};

const agentUserRow: NonNullable<UserRow> = {
  id:            'a1000000-0000-0000-0000-000000000001',
  username:      'agent1',
  password_hash: '$2a$10$hashed',
  display_name:  'Agent One',
  is_active:     true,
  session_mode:  null,
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();

  // Restore implementations cleared by resetAllMocks.
  // common-login helpers are mocked at the direct seam (see vi.mock above).
  mockVerifyCredentials.mockResolvedValue(dealerUserRow);
  mockSignJwt.mockReturnValue('mock.jwt.token');
  mockGenerateCsrfToken.mockReturnValue('mock-csrf-token-32-hex');

  // Default repository / pool responses
  // Note: mockFindUser is not needed in beforeEach since verifyCredentials
  // (mocked at common-login) controls the user-lookup + credential path.
  mockFindRoles.mockResolvedValue(['dealer_service_advisor']);
  mockPoolQuery.mockResolvedValue({ rows: [{ external_user_ref: 'DLR-001' }] });
  vi.mocked(writeAuditEvent).mockResolvedValue(undefined);
});

// ===========================================================================
// Failure paths — 401
// ===========================================================================

describe('dealerLoginService — 401 failures', () => {
  it('user not found → throws 401 with generic message (no enumeration)', async () => {
    const { AppError } = await import('../../../shared/errors/AppError');
    mockVerifyCredentials.mockRejectedValueOnce(
      new AppError('INVALID_CREDENTIALS', 'Invalid credentials. Please try again.', 401),
    );

    await expect(
      dealerLoginService('unknown', 'pass', 'corr-001'),
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('password mismatch → throws 401 with same message as user-not-found (no enumeration)', async () => {
    const { AppError } = await import('../../../shared/errors/AppError');
    mockVerifyCredentials.mockRejectedValueOnce(
      new AppError('INVALID_CREDENTIALS', 'Invalid credentials. Please try again.', 401),
    );

    await expect(
      dealerLoginService('dealer1', 'WrongPass', 'corr-001'),
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('password mismatch and user-not-found produce the same error message', async () => {
    const { AppError } = await import('../../../shared/errors/AppError');
    const credErr = new AppError('INVALID_CREDENTIALS', 'Invalid credentials. Please try again.', 401);

    // user not found
    mockVerifyCredentials.mockRejectedValueOnce(credErr);
    let notFoundMsg = '';
    try { await dealerLoginService('unknown2', 'pass', 'corr-002'); }
    catch (e) { notFoundMsg = (e as { message: string }).message; }

    // password mismatch
    mockVerifyCredentials.mockRejectedValueOnce(credErr);
    let pwMsg = '';
    try { await dealerLoginService('dealer1', 'WrongPass', 'corr-003'); }
    catch (e) { pwMsg = (e as { message: string }).message; }

    expect(notFoundMsg).toBeTruthy();
    expect(notFoundMsg).toBe(pwMsg);
  });
});

// ===========================================================================
// Failure paths — 403
// ===========================================================================

describe('dealerLoginService — 403 failures', () => {
  it('account inactive → throws 403 FORBIDDEN', async () => {
    const { AppError } = await import('../../../shared/errors/AppError');
    mockVerifyCredentials.mockRejectedValueOnce(
      new AppError('FORBIDDEN', 'Your account is inactive.', 403),
    );

    await expect(
      dealerLoginService('dealer1', 'Dealer@123', 'corr-001'),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('user with agent role only (no dealer_ prefix) → throws 403', async () => {
    mockFindRoles.mockResolvedValue(['agent', 'ccm_agent']);

    await expect(
      dealerLoginService('agent1', 'Agent@123', 'corr-001'),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('user with no roles at all → throws 403', async () => {
    mockFindRoles.mockResolvedValue([]);

    await expect(
      dealerLoginService('dealer1', 'Dealer@123', 'corr-001'),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('user with role that almost matches (dealer without underscore) → throws 403', async () => {
    mockFindRoles.mockResolvedValue(['dealer']); // does not start with 'dealer_'

    await expect(
      dealerLoginService('dealer1', 'Dealer@123', 'corr-001'),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });
});

// ===========================================================================
// Success path
// ===========================================================================

describe('dealerLoginService — success', () => {
  it('returns JWT, CSRF token, user payload, and dealerRef', async () => {
    const result = await dealerLoginService('dealer1', 'Dealer@123', 'corr-001');

    expect(result.jwtToken).toBe('mock.jwt.token');
    expect(result.csrfToken).toBe('mock-csrf-token-32-hex');
    expect(result.user.id).toBe(dealerUserRow.id);
    expect(result.user.username).toBe('dealer1');
    expect(result.user.displayName).toBe('Dealer One');
    expect(result.user.roles).toEqual(['dealer_service_advisor']);
    expect(result.user.dealerRef).toBe('DLR-001');
  });

  it('any role starting with dealer_ passes the guard', async () => {
    mockFindRoles.mockResolvedValue(['dealer_workshop_controller']);

    const result = await dealerLoginService('dealer1', 'Dealer@123', 'corr-001');
    expect(result.user.roles).toContain('dealer_workshop_controller');
  });

  it('dealerRef is null when external_user_ref not set in PG', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [{ external_user_ref: null }] });

    const result = await dealerLoginService('dealer1', 'Dealer@123', 'corr-001');
    expect(result.user.dealerRef).toBeNull();
  });

  it('dealerRef is null when PG returns no rows', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const result = await dealerLoginService('dealer1', 'Dealer@123', 'corr-001');
    expect(result.user.dealerRef).toBeNull();
  });
});

// ===========================================================================
// dealer_ role prefix check — all 8 dealer roles pass
// ===========================================================================

describe('dealerLoginService — dealer_ prefix accepts all configured dealer roles', () => {
  const dealerRoles = [
    'dealer_service_advisor',
    'dealer_workshop_controller',
    'dealer_parts_executive',
    'dealer_crm_executive',
    'dealer_warranty_executive',
    'dealer_service_manager',
    'dealer_bodyshop_advisor',
    'dealer_ev_technician',
  ] as const;

  for (const role of dealerRoles) {
    it(`role '${role}' → login succeeds`, async () => {
      mockFindRoles.mockResolvedValue([role]);
      await expect(
        dealerLoginService('dealer1', 'Dealer@123', 'corr-001'),
      ).resolves.toBeDefined();
    });
  }
});

// ===========================================================================
// Audit event
// ===========================================================================

describe('dealerLoginService — audit event', () => {
  it('writes dealer_login audit event on success', async () => {
    await dealerLoginService('dealer1', 'Dealer@123', 'corr-001');

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'dealer_login' }),
    );
  });

  it('does NOT write agent_status_changed or any agent-specific event', async () => {
    await dealerLoginService('dealer1', 'Dealer@123', 'corr-001');

    const calls = vi.mocked(writeAuditEvent).mock.calls;
    const agentEvent = calls.find(([e]) =>
      e.eventName === 'agent_status_changed' || (e.eventName as string) === 'agent_login',
    );
    expect(agentEvent).toBeUndefined();
  });

  it('audit failure is non-fatal — login still succeeds', async () => {
    vi.mocked(writeAuditEvent).mockRejectedValueOnce(new Error('Audit DB down'));

    const result = await dealerLoginService('dealer1', 'Dealer@123', 'corr-001');
    expect(result.jwtToken).toBe('mock.jwt.token');
  });
});

// ===========================================================================
// No agent_statuses upsert
// ===========================================================================

describe('dealerLoginService — no agent_statuses side-effect', () => {
  it('PG pool is only queried for external_user_ref — never for agent_statuses', async () => {
    await dealerLoginService('dealer1', 'Dealer@123', 'corr-001');

    // pool.query must have been called (for external_user_ref)
    expect(mockPoolQuery).toHaveBeenCalled();

    // None of the calls should mention agent_statuses
    const calls = mockPoolQuery.mock.calls as Array<[string, ...unknown[]]>;
    const agentStatusCall = calls.find(([sql]) =>
      typeof sql === 'string' && sql.toLowerCase().includes('agent_statuses'),
    );
    expect(agentStatusCall).toBeUndefined();
  });
});
