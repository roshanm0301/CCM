// =============================================================================
// CCM API — Auth Service: Session Mode Unit Tests (Phase 1.5)
//
// Covers setSessionModeService, logoutService, and getMeService sessionMode field.
// Source: CCM Phase 1.5 — Mode Selection spec
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
  setSessionMode: vi.fn(),
  clearSessionMode: vi.fn(),
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
import { setSessionModeService, logoutService, getMeService } from '../auth.service';
import type { UserRow, AgentStatusRow } from '../auth.repository';
import type { ActorContext } from '../../../shared/middleware/authenticate';

// ---------------------------------------------------------------------------
// Typed mocks
// ---------------------------------------------------------------------------
const mockSetSessionMode = authRepo.setSessionMode as MockedFunction<typeof authRepo.setSessionMode>;
const mockClearSessionMode = authRepo.clearSessionMode as MockedFunction<typeof authRepo.clearSessionMode>;
const mockGetAgentStatus = authRepo.getAgentStatus as MockedFunction<typeof authRepo.getAgentStatus>;
const mockFindUserDisplayName = authRepo.findUserDisplayName as MockedFunction<typeof authRepo.findUserDisplayName>;
const mockFindUserById = authRepo.findUserById as MockedFunction<typeof authRepo.findUserById>;
const mockWriteAuditEvent = auditRepo.writeAuditEvent as MockedFunction<typeof auditRepo.writeAuditEvent>;

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeUserRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'user-001',
    username: 'agent1',
    display_name: 'Test Agent One',
    password_hash: '$2a$10$hash',
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

const CORRELATION_ID = 'corr-test-sessionmode-001';
const USER_ID = 'user-001';

const actorContext: ActorContext = {
  userId: 'user-001',
  username: 'agent1',
  roles: ['agent'],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteAuditEvent.mockResolvedValue(undefined);
  mockSetSessionMode.mockResolvedValue(undefined);
  mockClearSessionMode.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// setSessionModeService
// ---------------------------------------------------------------------------

describe('setSessionModeService', () => {
  it('should call setSessionMode repo function with userId and manual mode', async () => {
    const result = await setSessionModeService(USER_ID, 'manual', CORRELATION_ID);

    expect(mockSetSessionMode).toHaveBeenCalledOnce();
    expect(mockSetSessionMode).toHaveBeenCalledWith(USER_ID, 'manual');
  });

  it('should return { sessionMode: "manual" } when mode is manual', async () => {
    const result = await setSessionModeService(USER_ID, 'manual', CORRELATION_ID);

    expect(result).toEqual({ sessionMode: 'manual' });
  });

  it('should call setSessionMode repo function with userId and cti mode', async () => {
    const result = await setSessionModeService(USER_ID, 'cti', CORRELATION_ID);

    expect(mockSetSessionMode).toHaveBeenCalledOnce();
    expect(mockSetSessionMode).toHaveBeenCalledWith(USER_ID, 'cti');
  });

  it('should return { sessionMode: "cti" } when mode is cti', async () => {
    const result = await setSessionModeService(USER_ID, 'cti', CORRELATION_ID);

    expect(result).toEqual({ sessionMode: 'cti' });
  });

  it('should propagate errors from the repository', async () => {
    mockSetSessionMode.mockRejectedValue(new Error('DB unavailable'));

    await expect(setSessionModeService(USER_ID, 'manual', CORRELATION_ID)).rejects.toThrow(
      'DB unavailable',
    );
  });
});

// ---------------------------------------------------------------------------
// logoutService
// ---------------------------------------------------------------------------

describe('logoutService', () => {
  it('should call clearSessionMode with userId on logout', async () => {
    await logoutService(USER_ID, CORRELATION_ID);

    expect(mockClearSessionMode).toHaveBeenCalledOnce();
    expect(mockClearSessionMode).toHaveBeenCalledWith(USER_ID);
  });

  it('should write an audit event on logout', async () => {
    await logoutService(USER_ID, CORRELATION_ID);

    expect(mockWriteAuditEvent).toHaveBeenCalledOnce();
    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'agent_status_changed',
        actorUserId: USER_ID,
        eventPayload: expect.objectContaining({ trigger: 'logout' }),
      }),
    );
  });

  it('should complete logout even when clearSessionMode throws (best-effort)', async () => {
    mockClearSessionMode.mockRejectedValue(new Error('DB unavailable'));

    // Should not throw — DB failure on session_mode clear is non-blocking
    await expect(logoutService(USER_ID, CORRELATION_ID)).resolves.toBeUndefined();
  });

  it('should complete logout even when audit event write fails (best-effort)', async () => {
    mockWriteAuditEvent.mockRejectedValue(new Error('Audit DB unavailable'));

    await expect(logoutService(USER_ID, CORRELATION_ID)).resolves.toBeUndefined();
  });

  it('should still call clearSessionMode even when audit event fails', async () => {
    mockWriteAuditEvent.mockRejectedValue(new Error('Audit DB unavailable'));

    await logoutService(USER_ID, CORRELATION_ID);

    expect(mockClearSessionMode).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// getMeService — sessionMode field
// ---------------------------------------------------------------------------

describe('getMeService — sessionMode field', () => {
  it('should return sessionMode: "cti" when user has cti session mode', async () => {
    mockGetAgentStatus.mockResolvedValue(makeAgentStatusRow({ status_code: 'ready_for_calls' }));
    mockFindUserDisplayName.mockResolvedValue('Test Agent One');
    mockFindUserById.mockResolvedValue(makeUserRow({ session_mode: 'cti' }));

    const result = await getMeService(actorContext);

    expect(result.sessionMode).toBe('cti');
  });

  it('should return sessionMode: "manual" when user has manual session mode', async () => {
    mockGetAgentStatus.mockResolvedValue(makeAgentStatusRow());
    mockFindUserDisplayName.mockResolvedValue('Test Agent One');
    mockFindUserById.mockResolvedValue(makeUserRow({ session_mode: 'manual' }));

    const result = await getMeService(actorContext);

    expect(result.sessionMode).toBe('manual');
  });

  it('should return sessionMode: null when user has no session mode set', async () => {
    mockGetAgentStatus.mockResolvedValue(makeAgentStatusRow());
    mockFindUserDisplayName.mockResolvedValue('Test Agent One');
    mockFindUserById.mockResolvedValue(makeUserRow({ session_mode: null }));

    const result = await getMeService(actorContext);

    expect(result.sessionMode).toBeNull();
  });

  it('should return sessionMode: null when user row is not found', async () => {
    mockGetAgentStatus.mockResolvedValue(makeAgentStatusRow());
    mockFindUserDisplayName.mockResolvedValue('Test Agent One');
    mockFindUserById.mockResolvedValue(null);

    const result = await getMeService(actorContext);

    expect(result.sessionMode).toBeNull();
  });

  it('should include all other expected fields alongside sessionMode', async () => {
    mockGetAgentStatus.mockResolvedValue(makeAgentStatusRow({ status_code: 'break' }));
    mockFindUserDisplayName.mockResolvedValue('Test Agent One');
    mockFindUserById.mockResolvedValue(makeUserRow({ session_mode: 'manual' }));

    const result = await getMeService(actorContext);

    expect(result.id).toBe('user-001');
    expect(result.username).toBe('agent1');
    expect(result.displayName).toBe('Test Agent One');
    expect(result.agentStatus).toBe('break');
    expect(result.sessionMode).toBe('manual');
  });
});
