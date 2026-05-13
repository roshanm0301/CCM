// =============================================================================
// CCM API — Auth Service Unit Tests
//
// Tests login and session resolution logic in isolation.
// Source: CCM_Phase1_Agent_Interaction_Documentation.md §B1, §C1, §D1
//         security-principles.md § no username enumeration
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies before importing the service
// ---------------------------------------------------------------------------

vi.mock('../../../shared/logging/logger', () => ({
  logger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    debug: vi.fn(), http: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
  createContextLogger: vi.fn().mockReturnValue({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    debug: vi.fn(), http: vi.fn(),
  }),
}));

vi.mock('../auth.repository', () => ({
  findUserByUsername: vi.fn(),
  findUserRoles: vi.fn(),
  upsertAgentStatusOffline: vi.fn(),
  getAgentStatus: vi.fn(),
  findUserDisplayName: vi.fn(),
  findUserById: vi.fn(),
}));

vi.mock('../../audit/audit.repository', () => ({
  writeAuditEvent: vi.fn(),
}));

vi.mock('../../../config/index', () => ({
  config: {
    jwtSecret: 'test-secret-that-is-at-least-32-characters-long',
    jwtExpiry: '8h',
  },
}));

import * as authRepo from '../auth.repository';
import * as auditRepo from '../../audit/audit.repository';
import { loginService, getMeService, getCsrfService } from '../auth.service';
import type { UserRow, AgentStatusRow } from '../auth.repository';
import type { ActorContext } from '../../../shared/middleware/authenticate';

// ---------------------------------------------------------------------------
// Typed mocks
// ---------------------------------------------------------------------------
const mockFindUserByUsername = authRepo.findUserByUsername as MockedFunction<typeof authRepo.findUserByUsername>;
const mockFindUserRoles = authRepo.findUserRoles as MockedFunction<typeof authRepo.findUserRoles>;
const mockUpsertAgentStatusOffline = authRepo.upsertAgentStatusOffline as MockedFunction<typeof authRepo.upsertAgentStatusOffline>;
const mockGetAgentStatus = authRepo.getAgentStatus as MockedFunction<typeof authRepo.getAgentStatus>;
const mockFindUserDisplayName = authRepo.findUserDisplayName as MockedFunction<typeof authRepo.findUserDisplayName>;
const mockFindUserById = authRepo.findUserById as MockedFunction<typeof authRepo.findUserById>;
const mockWriteAuditEvent = auditRepo.writeAuditEvent as MockedFunction<typeof auditRepo.writeAuditEvent>;

// ---------------------------------------------------------------------------
// Fixture: bcryptjs hash of 'Agent@123' at cost 10
// Generated via: bcryptjs.hash('Agent@123', 10)
// ---------------------------------------------------------------------------
const VALID_PASSWORD_HASH = '$2a$10$qwyJ0mTVIAGZ1lUBhS45bOn2eYazsbwdXUfX.mA7AnxH1iGdG.NKa';
const VALID_PASSWORD = 'Agent@123';

function makeUserRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'user-001',
    username: 'agent1',
    display_name: 'Test Agent One',
    password_hash: VALID_PASSWORD_HASH,
    is_active: true,
    session_mode: null,
    ...overrides,
  };
}

function makeAgentStatusRow(overrides: Partial<AgentStatusRow> = {}): AgentStatusRow {
  return {
    user_id: 'user-001',
    status_code: 'offline',
    changed_at: new Date('2026-03-22T10:00:00Z'),
    ...overrides,
  };
}

const CORRELATION_ID = 'corr-test-auth-001';

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteAuditEvent.mockResolvedValue(undefined);
  mockUpsertAgentStatusOffline.mockResolvedValue(makeAgentStatusRow());
});

// ---------------------------------------------------------------------------
// loginService
// ---------------------------------------------------------------------------

describe('loginService', () => {
  it('should return csrfToken and jwtToken when credentials are correct', async () => {
    mockFindUserByUsername.mockResolvedValue(makeUserRow());
    mockFindUserRoles.mockResolvedValue(['agent']);

    const result = await loginService('agent1', VALID_PASSWORD, CORRELATION_ID);

    expect(result.csrfToken).toBeTruthy();
    expect(result.csrfToken).toHaveLength(64); // 32 bytes hex = 64 chars
    expect(result.jwtToken).toBeTruthy();
    expect(result.user.username).toBe('agent1');
    expect(result.user.roles).toContain('agent');
    expect(result.user.agentStatus).toBe('offline');
  });

  it('should call upsertAgentStatusOffline on successful login', async () => {
    mockFindUserByUsername.mockResolvedValue(makeUserRow());
    mockFindUserRoles.mockResolvedValue(['agent']);

    await loginService('agent1', VALID_PASSWORD, CORRELATION_ID);

    expect(mockUpsertAgentStatusOffline).toHaveBeenCalledWith('user-001');
  });

  it('should write agent_status_changed audit event on successful login', async () => {
    mockFindUserByUsername.mockResolvedValue(makeUserRow());
    mockFindUserRoles.mockResolvedValue(['agent']);

    await loginService('agent1', VALID_PASSWORD, CORRELATION_ID);

    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'agent_status_changed',
        actorUserId: 'user-001',
      }),
    );
  });

  it('should throw 401 with generic message when password is wrong', async () => {
    mockFindUserByUsername.mockResolvedValue(makeUserRow());

    await expect(loginService('agent1', 'WrongPassword!', CORRELATION_ID)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid credentials. Please try again.',
    });
  });

  it('should throw 401 with identical message when user does not exist (no enumeration)', async () => {
    mockFindUserByUsername.mockResolvedValue(null);

    const error = await loginService('nonexistent', 'whatever', CORRELATION_ID).catch((e) => e);

    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Invalid credentials. Please try again.');
  });

  it('should use the same error message for wrong password and unknown user', async () => {
    mockFindUserByUsername.mockResolvedValue(null);
    const unknownUserError = await loginService('nouser', 'pass', CORRELATION_ID).catch((e) => e);

    mockFindUserByUsername.mockResolvedValue(makeUserRow());
    const wrongPasswordError = await loginService('agent1', 'wrong', CORRELATION_ID).catch((e) => e);

    expect(unknownUserError.message).toBe(wrongPasswordError.message);
    expect(unknownUserError.statusCode).toBe(wrongPasswordError.statusCode);
  });

  it('should throw 403 when user account is inactive', async () => {
    mockFindUserByUsername.mockResolvedValue(makeUserRow({ is_active: false }));

    await expect(loginService('agent1', VALID_PASSWORD, CORRELATION_ID)).rejects.toMatchObject({
      statusCode: 403,
      message: 'Your account is inactive.',
    });
  });

  it('should throw 403 when user does not have the agent role', async () => {
    mockFindUserByUsername.mockResolvedValue(makeUserRow());
    mockFindUserRoles.mockResolvedValue([]); // no roles

    await expect(loginService('agent1', VALID_PASSWORD, CORRELATION_ID)).rejects.toMatchObject({
      statusCode: 403,
      message: 'You are not authorized for Agent workspace.',
    });
  });

  it('should throw 403 when user has a different role but not agent', async () => {
    mockFindUserByUsername.mockResolvedValue(makeUserRow());
    mockFindUserRoles.mockResolvedValue(['supervisor']);

    await expect(loginService('agent1', VALID_PASSWORD, CORRELATION_ID)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('should still complete login when audit event write fails', async () => {
    mockFindUserByUsername.mockResolvedValue(makeUserRow());
    mockFindUserRoles.mockResolvedValue(['agent']);
    mockWriteAuditEvent.mockRejectedValue(new Error('Audit DB unavailable'));

    // Login must succeed even if audit write fails (non-blocking per spec)
    const result = await loginService('agent1', VALID_PASSWORD, CORRELATION_ID);

    expect(result.jwtToken).toBeTruthy();
    expect(result.csrfToken).toBeTruthy();
  });

  it('should return a display name in user object', async () => {
    mockFindUserByUsername.mockResolvedValue(makeUserRow({ display_name: 'Test Agent One' }));
    mockFindUserRoles.mockResolvedValue(['agent']);

    const result = await loginService('agent1', VALID_PASSWORD, CORRELATION_ID);

    expect(result.user.displayName).toBe('Test Agent One');
  });
});

// ---------------------------------------------------------------------------
// getMeService
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// getCsrfService
// ---------------------------------------------------------------------------

describe('getCsrfService', () => {
  it('should return a csrfToken of 64 hex characters', () => {
    const result = getCsrfService();
    expect(result.csrfToken).toBeTruthy();
    expect(result.csrfToken).toHaveLength(64);
    expect(result.csrfToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should return a different token on each call (randomness)', () => {
    const first = getCsrfService();
    const second = getCsrfService();
    expect(first.csrfToken).not.toBe(second.csrfToken);
  });
});

describe('getMeService', () => {
  const actorContext: ActorContext = {
    userId: 'user-001',
    username: 'agent1',
    roles: ['agent'],
  };

  it('should return user details with current agent status', async () => {
    mockGetAgentStatus.mockResolvedValue(makeAgentStatusRow({ status_code: 'ready_for_calls' }));
    mockFindUserDisplayName.mockResolvedValue('Test Agent One');

    const result = await getMeService(actorContext);

    expect(result.id).toBe('user-001');
    expect(result.username).toBe('agent1');
    expect(result.displayName).toBe('Test Agent One');
    expect(result.agentStatus).toBe('ready_for_calls');
    expect(result.roles).toContain('agent');
  });

  it('should default to offline when agent status record does not exist', async () => {
    mockGetAgentStatus.mockResolvedValue(null);
    mockFindUserDisplayName.mockResolvedValue('Test Agent One');

    const result = await getMeService(actorContext);

    expect(result.agentStatus).toBe('offline');
  });

  it('should fallback to username when display name is not found in DB', async () => {
    mockGetAgentStatus.mockResolvedValue(makeAgentStatusRow());
    mockFindUserDisplayName.mockResolvedValue(null);

    const result = await getMeService(actorContext);

    expect(result.displayName).toBe('agent1');
  });
});
