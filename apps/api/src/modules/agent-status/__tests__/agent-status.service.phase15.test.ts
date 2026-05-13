// =============================================================================
// CCM API — Agent Status Service Phase 1.5 Unit Tests
//
// Tests the TeleCMI sync guard for on_call/wrap_up statuses, and the
// setSystemStatus function that bypasses TeleCMI back-sync.
// Source: Phase 1.5 — CTI live-event agent status management
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction, Mock } from 'vitest';

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
import * as postgresModule from '../../../shared/database/postgres';
import * as ctiClient from '../../cti/cti.client';
import { AgentStatus } from '@ccm/types';
import { updateAgentStatusService, setSystemStatus } from '../agent-status.service';
import type { AgentStatusRow } from '../agent-status.repository';

// ---------------------------------------------------------------------------
// Typed mocks
// ---------------------------------------------------------------------------
const mockGetAgentStatusByUserId = agentStatusRepo.getAgentStatusByUserId as MockedFunction<typeof agentStatusRepo.getAgentStatusByUserId>;
const mockUpdateAgentStatus = agentStatusRepo.updateAgentStatus as MockedFunction<typeof agentStatusRepo.updateAgentStatus>;
const mockWriteAuditEvent = auditRepo.writeAuditEvent as MockedFunction<typeof auditRepo.writeAuditEvent>;
const mockGetPool = postgresModule.getPool as Mock;
const mockSetTeleCmiAgentStatus = ctiClient.setTeleCmiAgentStatus as MockedFunction<typeof ctiClient.setTeleCmiAgentStatus>;

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

function makeMockPool(telecmiAgentId: string | null = null) {
  return {
    query: vi.fn().mockResolvedValue({
      rows: telecmiAgentId !== null ? [{ telecmi_agent_id: telecmiAgentId }] : [],
    }),
  };
}

const USER_ID = 'user-001';
const CORRELATION_ID = 'corr-phase15-001';

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteAuditEvent.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// updateAgentStatusService — TeleCMI sync guard for on_call / wrap_up
// ---------------------------------------------------------------------------

describe('updateAgentStatusService — TeleCMI sync guard (Phase 1.5)', () => {
  it('should NOT call setTeleCmiAgentStatus when new status is on_call', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'ready_for_calls' }));
    mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: 'on_call' }));
    // Even if the pool query runs, TeleCMI client must not be called
    mockGetPool.mockReturnValue(makeMockPool('telecmi-agent-001'));

    await updateAgentStatusService(USER_ID, 'on_call', CORRELATION_ID);

    expect(mockSetTeleCmiAgentStatus).not.toHaveBeenCalled();
  });

  it('should NOT call setTeleCmiAgentStatus when new status is wrap_up', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'on_call' }));
    mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: 'wrap_up' }));
    mockGetPool.mockReturnValue(makeMockPool('telecmi-agent-001'));

    await updateAgentStatusService(USER_ID, 'wrap_up', CORRELATION_ID);

    expect(mockSetTeleCmiAgentStatus).not.toHaveBeenCalled();
  });

  it('should return updated status correctly even when on_call TeleCMI guard fires', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'ready_for_calls' }));
    mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: 'on_call' }));
    mockGetPool.mockReturnValue(makeMockPool('telecmi-agent-001'));

    const result = await updateAgentStatusService(USER_ID, 'on_call', CORRELATION_ID);

    expect(result.currentStatus).toBe('on_call');
  });

  it('should return updated status correctly even when wrap_up TeleCMI guard fires', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'on_call' }));
    mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: 'wrap_up' }));
    mockGetPool.mockReturnValue(makeMockPool('telecmi-agent-001'));

    const result = await updateAgentStatusService(USER_ID, 'wrap_up', CORRELATION_ID);

    expect(result.currentStatus).toBe('wrap_up');
  });

  it('should still write audit event before skipping TeleCMI sync for on_call', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'ready_for_calls' }));
    mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: 'on_call' }));
    mockGetPool.mockReturnValue(makeMockPool('telecmi-agent-001'));

    await updateAgentStatusService(USER_ID, 'on_call', CORRELATION_ID);

    expect(mockWriteAuditEvent).toHaveBeenCalledOnce();
    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'agent_status_changed' }),
    );
  });

  it('should still call setTeleCmiAgentStatus for ready_for_calls (no guard)', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'break' }));
    mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: 'ready_for_calls' }));
    mockGetPool.mockReturnValue(makeMockPool('telecmi-agent-001'));
    mockSetTeleCmiAgentStatus.mockResolvedValue(undefined);

    await updateAgentStatusService(USER_ID, 'ready_for_calls', CORRELATION_ID);

    // Allow the fire-and-forget promise to settle
    await vi.runAllTimersAsync().catch(() => undefined);
    // setTeleCmiAgentStatus should eventually be called with 'online'
    // (fire-and-forget — may not be awaited in the test, but it should not throw)
    expect(mockSetTeleCmiAgentStatus).toHaveBeenCalledWith('telecmi-agent-001', 'online');
  });
});

// ---------------------------------------------------------------------------
// setSystemStatus — does NOT call TeleCMI back-sync for any status
// ---------------------------------------------------------------------------

describe('setSystemStatus (Phase 1.5)', () => {
  it('should call updateAgentStatus with ON_CALL and not call TeleCMI', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'ready_for_calls' }));
    mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: AgentStatus.ON_CALL }));
    mockGetPool.mockReturnValue(makeMockPool('telecmi-agent-001'));

    await setSystemStatus(USER_ID, AgentStatus.ON_CALL, CORRELATION_ID);

    expect(mockUpdateAgentStatus).toHaveBeenCalledWith(USER_ID, AgentStatus.ON_CALL, CORRELATION_ID);
    expect(mockSetTeleCmiAgentStatus).not.toHaveBeenCalled();
  });

  it('should call updateAgentStatus with WRAP_UP and not call TeleCMI', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: AgentStatus.ON_CALL }));
    mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: AgentStatus.WRAP_UP }));
    mockGetPool.mockReturnValue(makeMockPool('telecmi-agent-001'));

    await setSystemStatus(USER_ID, AgentStatus.WRAP_UP, CORRELATION_ID);

    expect(mockUpdateAgentStatus).toHaveBeenCalledWith(USER_ID, AgentStatus.WRAP_UP, CORRELATION_ID);
    expect(mockSetTeleCmiAgentStatus).not.toHaveBeenCalled();
  });

  it('should call updateAgentStatus with READY_FOR_CALLS and not call TeleCMI', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: AgentStatus.WRAP_UP }));
    mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: AgentStatus.READY_FOR_CALLS }));
    mockGetPool.mockReturnValue(makeMockPool('telecmi-agent-001'));

    await setSystemStatus(USER_ID, AgentStatus.READY_FOR_CALLS, CORRELATION_ID);

    expect(mockUpdateAgentStatus).toHaveBeenCalledWith(USER_ID, AgentStatus.READY_FOR_CALLS, CORRELATION_ID);
    expect(mockSetTeleCmiAgentStatus).not.toHaveBeenCalled();
  });

  it('should write a best-effort audit event with trigger: system_cti', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'ready_for_calls' }));
    mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: AgentStatus.ON_CALL }));
    mockGetPool.mockReturnValue(makeMockPool(null));

    await setSystemStatus(USER_ID, AgentStatus.ON_CALL, CORRELATION_ID);

    expect(mockWriteAuditEvent).toHaveBeenCalledOnce();
    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'agent_status_changed',
        actorUserId: USER_ID,
        eventPayload: expect.objectContaining({
          trigger: 'system_cti',
          newStatus: AgentStatus.ON_CALL,
        }),
      }),
    );
  });

  it('should still complete when audit event write fails (best-effort)', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'ready_for_calls' }));
    mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: AgentStatus.ON_CALL }));
    mockGetPool.mockReturnValue(makeMockPool(null));
    mockWriteAuditEvent.mockRejectedValue(new Error('Audit unavailable'));

    await expect(setSystemStatus(USER_ID, AgentStatus.ON_CALL, CORRELATION_ID)).resolves.toBeUndefined();
  });

  it('should record previous status in the audit payload', async () => {
    mockGetAgentStatusByUserId.mockResolvedValue(makeStatusRow({ status_code: 'ready_for_calls' }));
    mockUpdateAgentStatus.mockResolvedValue(makeStatusRow({ status_code: AgentStatus.ON_CALL }));
    mockGetPool.mockReturnValue(makeMockPool(null));

    await setSystemStatus(USER_ID, AgentStatus.ON_CALL, CORRELATION_ID);

    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventPayload: expect.objectContaining({ previousStatus: 'ready_for_calls' }),
      }),
    );
  });
});
