// =============================================================================
// CCM API — Agent Status Service Unit Tests
//
// Tests get and update agent status with mocked repository and audit writes.
// Source: CCM_Phase1_Agent_Interaction_Documentation.md §C11, §D11
//         phase1-technical-blueprint.md §5.4–5.5
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';

// ---------------------------------------------------------------------------
// Mock all dependencies before importing the service
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

vi.mock('../agent-status.repository', () => ({
  getAgentStatusByUserId: vi.fn(),
  updateAgentStatus: vi.fn(),
}));

vi.mock('../../audit/audit.repository', () => ({
  writeAuditEvent: vi.fn(),
}));

vi.mock('../../../shared/database/postgres', () => ({
  getPool: vi.fn(),
}));

vi.mock('../../cti/cti.client', () => ({
  setTeleCmiAgentStatus: vi.fn(),
}));

import * as agentStatusRepo from '../agent-status.repository';
import * as auditRepo from '../../audit/audit.repository';
import { getAgentStatusService, updateAgentStatusService } from '../agent-status.service';
import type { AgentStatusRow } from '../agent-status.repository';

// ---------------------------------------------------------------------------
// Typed mocks
// ---------------------------------------------------------------------------
const mockGetAgentStatusByUserId = agentStatusRepo.getAgentStatusByUserId as MockedFunction<typeof agentStatusRepo.getAgentStatusByUserId>;
const mockUpdateAgentStatus = agentStatusRepo.updateAgentStatus as MockedFunction<typeof agentStatusRepo.updateAgentStatus>;
const mockWriteAuditEvent = auditRepo.writeAuditEvent as MockedFunction<typeof auditRepo.writeAuditEvent>;

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

function makeStatusRow(overrides: Partial<AgentStatusRow> = {}): AgentStatusRow {
  return {
    user_id: 'user-001',
    status_code: 'offline',
    previous_status_code: null,
    changed_at: new Date('2026-03-22T10:00:00Z'),
    changed_by_user_id: 'user-001',
    correlation_id: null,
    ...overrides,
  };
}

const USER_ID = 'user-001';
const CORRELATION_ID = 'corr-status-001';

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteAuditEvent.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// getAgentStatusService
// ---------------------------------------------------------------------------

describe('getAgentStatusService', () => {
  it('should return current status when agent_statuses row exists', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'ready_for_calls' }));

    const result = await getAgentStatusService(USER_ID);

    expect(result.userId).toBe(USER_ID);
    expect(result.currentStatus).toBe('ready_for_calls');
    expect(result.updatedAt).toBeDefined();
  });

  it('should return offline status when agent is offline', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'offline' }));

    const result = await getAgentStatusService(USER_ID);

    expect(result.currentStatus).toBe('offline');
  });

  it('should return break status correctly', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'break' }));

    const result = await getAgentStatusService(USER_ID);

    expect(result.currentStatus).toBe('break');
  });

  it('should return training status correctly', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'training' }));

    const result = await getAgentStatusService(USER_ID);

    expect(result.currentStatus).toBe('training');
  });

  it('should throw 404 when agent status record does not exist', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(null);

    await expect(getAgentStatusService(USER_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('should return an ISO 8601 timestamp string in updatedAt', async () => {
    const changedAt = new Date('2026-03-22T09:30:00.000Z');
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ changed_at: changedAt }));

    const result = await getAgentStatusService(USER_ID);

    expect(result.updatedAt).toBe('2026-03-22T09:30:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// updateAgentStatusService
// ---------------------------------------------------------------------------

describe('updateAgentStatusService', () => {
  it('should update agent status to ready_for_calls', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'offline' }));
    mockUpdateAgentStatus.mockResolvedValue(
      makeStatusRow({ status_code: 'ready_for_calls', previous_status_code: 'offline' }),
    );

    const result = await updateAgentStatusService(USER_ID, 'ready_for_calls', CORRELATION_ID);

    expect(result.currentStatus).toBe('ready_for_calls');
    expect(mockUpdateAgentStatus).toHaveBeenCalledWith(USER_ID, 'ready_for_calls', CORRELATION_ID);
  });

  it('should update agent status to break', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'ready_for_calls' }));
    mockUpdateAgentStatus.mockResolvedValue(
      makeStatusRow({ status_code: 'break', previous_status_code: 'ready_for_calls' }),
    );

    const result = await updateAgentStatusService(USER_ID, 'break', CORRELATION_ID);

    expect(result.currentStatus).toBe('break');
  });

  it('should update agent status to offline', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'ready_for_calls' }));
    mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: 'offline' }));

    const result = await updateAgentStatusService(USER_ID, 'offline', CORRELATION_ID);

    expect(result.currentStatus).toBe('offline');
  });

  it('should update agent status to training', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'offline' }));
    mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: 'training' }));

    const result = await updateAgentStatusService(USER_ID, 'training', CORRELATION_ID);

    expect(result.currentStatus).toBe('training');
  });

  it('should write agent_status_changed audit event on successful update', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'offline' }));
    mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: 'ready_for_calls' }));

    await updateAgentStatusService(USER_ID, 'ready_for_calls', CORRELATION_ID);

    expect(mockWriteAuditEvent).toHaveBeenCalledOnce();
    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'agent_status_changed',
        actorUserId: USER_ID,
        interactionId: null, // status events are NOT tied to an interaction
        eventPayload: expect.objectContaining({
          previousStatus: 'offline',
          newStatus: 'ready_for_calls',
        }),
      }),
    );
  });

  it('should set interactionId to null in the audit event (status events are workspace-level)', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'offline' }));
    mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: 'break' }));

    await updateAgentStatusService(USER_ID, 'break', CORRELATION_ID);

    const auditCall = mockWriteAuditEvent.mock.calls[0]?.[0] as { interactionId: unknown };
    expect(auditCall.interactionId).toBeNull();
  });

  it('should still return updated status when audit event write fails (best-effort)', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'offline' }));
    mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: 'ready_for_calls' }));
    mockWriteAuditEvent.mockRejectedValue(new Error('Audit service unavailable'));

    // Must not throw — audit failure is non-blocking for status updates
    const result = await updateAgentStatusService(USER_ID, 'ready_for_calls', CORRELATION_ID);

    expect(result.currentStatus).toBe('ready_for_calls');
  });

  it('should include previous status from DB in the audit event payload', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'training' }));
    mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: 'offline' }));

    await updateAgentStatusService(USER_ID, 'offline', CORRELATION_ID);

    const auditCall = (mockWriteAuditEvent.mock.calls[0]?.[0] as unknown) as {
      eventPayload: { previousStatus: string };
    };
    expect(auditCall.eventPayload.previousStatus).toBe('training');
  });

  it('should handle null previous status when no prior status record exists', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(null); // first time — no existing record
    mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: 'ready_for_calls' }));

    const result = await updateAgentStatusService(USER_ID, 'ready_for_calls', CORRELATION_ID);

    expect(result.currentStatus).toBe('ready_for_calls');
    const auditCall = (mockWriteAuditEvent.mock.calls[0]?.[0] as unknown) as {
      eventPayload: { previousStatus: unknown };
    };
    expect(auditCall.eventPayload.previousStatus).toBeNull();
  });

  it('should allow all transitions from any status to any other status', async () => {
    const statuses = ['ready_for_calls', 'break', 'offline', 'training'];

    for (const fromStatus of statuses) {
      for (const toStatus of statuses) {
        vi.clearAllMocks();
        mockWriteAuditEvent.mockResolvedValue(undefined);
        mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: fromStatus }));
        mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: toStatus }));

        const result = await updateAgentStatusService(USER_ID, toStatus, CORRELATION_ID);

        expect(result.currentStatus).toBe(toStatus);
      }
    }
  });
});
