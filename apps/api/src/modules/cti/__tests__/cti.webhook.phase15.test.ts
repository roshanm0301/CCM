// =============================================================================
// CCM API — CTI Webhook Service Phase 1.5 Unit Tests
//
// Tests handleWebhookEvent for live 'started' and 'hangup' events with
// session_mode-based guards for agent status transitions.
// Source: Phase 1.5 — CTI live-event agent status spec
// =============================================================================

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies before importing the service
// ---------------------------------------------------------------------------

vi.mock('../../../shared/database/postgres', () => ({
  getPool: vi.fn(),
}));

vi.mock('../../../shared/logging/logger', () => ({
  logger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    debug: vi.fn(), http: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

vi.mock('../../agent-status/agent-status.service', () => ({
  setSystemStatus: vi.fn(),
}));

import * as postgresModule from '../../../shared/database/postgres';
import * as agentStatusService from '../../agent-status/agent-status.service';
import { logger } from '../../../shared/logging/logger';
import { AgentStatus } from '@ccm/types';
import { handleWebhookEvent } from '../cti.webhook.service';
import type { TeleCmiWebhookLiveEvent } from '../cti.types';

// ---------------------------------------------------------------------------
// Typed mocks
// ---------------------------------------------------------------------------
const mockGetPool = postgresModule.getPool as Mock;
const mockSetSystemStatus = agentStatusService.setSystemStatus as Mock;

// ---------------------------------------------------------------------------
// Pool mock helpers
// ---------------------------------------------------------------------------

interface MockPool {
  query: Mock;
}

function makeMockPool(agentRow?: { id: string; session_mode: string | null; status_code: string | null } | null): MockPool {
  const pool: MockPool = { query: vi.fn() };
  if (agentRow !== undefined) {
    pool.query.mockResolvedValue({ rows: agentRow ? [agentRow] : [] });
  } else {
    pool.query.mockResolvedValue({ rows: [] });
  }
  return pool;
}

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeStartedPayload(from = 'telecmi-agent-001'): TeleCmiWebhookLiveEvent {
  return {
    type: 'event',
    direction: 'inbound',
    status: 'started',
    cmiuuid: 'uuid-started-001',
    from,
    to: '1800123456',
    time: Date.now(),
  } as TeleCmiWebhookLiveEvent;
}

function makeHangupPayload(from = 'telecmi-agent-001', direction: 'inbound' | 'outbound' = 'inbound'): TeleCmiWebhookLiveEvent {
  return {
    type: 'event',
    direction,
    status: 'hangup',
    cmiuuid: 'uuid-hangup-001',
    from,
    to: '1800123456',
    time: Date.now(),
  } as TeleCmiWebhookLiveEvent;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockSetSystemStatus.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// 'started' inbound event — ON_CALL transition
// ---------------------------------------------------------------------------

describe('handleWebhookEvent — started inbound (Phase 1.5)', () => {
  it('should call setSystemStatus(ON_CALL) when agent is found with session_mode=cti and status=ready_for_calls', async () => {
    const pool = makeMockPool({
      id: 'user-001',
      session_mode: 'cti',
      status_code: 'ready_for_calls',
    });
    mockGetPool.mockReturnValue(pool);

    await handleWebhookEvent(makeStartedPayload(), 'corr-started-001');

    expect(mockSetSystemStatus).toHaveBeenCalledOnce();
    expect(mockSetSystemStatus).toHaveBeenCalledWith('user-001', AgentStatus.ON_CALL, 'corr-started-001');
  });

  it('should NOT call setSystemStatus when agent session_mode is "manual"', async () => {
    const pool = makeMockPool({
      id: 'user-001',
      session_mode: 'manual',
      status_code: 'ready_for_calls',
    });
    mockGetPool.mockReturnValue(pool);

    await handleWebhookEvent(makeStartedPayload(), 'corr-started-002');

    expect(mockSetSystemStatus).not.toHaveBeenCalled();
  });

  it('should NOT call setSystemStatus when agent session_mode is null', async () => {
    const pool = makeMockPool({
      id: 'user-001',
      session_mode: null,
      status_code: 'ready_for_calls',
    });
    mockGetPool.mockReturnValue(pool);

    await handleWebhookEvent(makeStartedPayload(), 'corr-started-003');

    expect(mockSetSystemStatus).not.toHaveBeenCalled();
  });

  it('should NOT call setSystemStatus when no agent is found for the telecmi_agent_id', async () => {
    const pool = makeMockPool(null);
    mockGetPool.mockReturnValue(pool);

    await handleWebhookEvent(makeStartedPayload(), 'corr-started-004');

    expect(mockSetSystemStatus).not.toHaveBeenCalled();
  });

  it('should log a warning when no agent is found for the telecmi_agent_id', async () => {
    const pool = makeMockPool(null);
    mockGetPool.mockReturnValue(pool);

    await handleWebhookEvent(makeStartedPayload(), 'corr-started-005');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('agent not found'),
      expect.any(Object),
    );
  });

  it('should NOT call setSystemStatus when started event has no from field', async () => {
    const pool = makeMockPool({
      id: 'user-001',
      session_mode: 'cti',
      status_code: 'ready_for_calls',
    });
    mockGetPool.mockReturnValue(pool);

    const payloadWithoutFrom: TeleCmiWebhookLiveEvent = {
      type: 'event',
      direction: 'inbound',
      status: 'started',
      cmiuuid: 'uuid-started-nofrom',
      time: Date.now(),
    } as TeleCmiWebhookLiveEvent;

    await handleWebhookEvent(payloadWithoutFrom, 'corr-started-006');

    expect(mockSetSystemStatus).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 'hangup' inbound event — WRAP_UP transition
// ---------------------------------------------------------------------------

describe('handleWebhookEvent — hangup inbound (Phase 1.5)', () => {
  it('should call setSystemStatus(WRAP_UP) when agent is on_call with session_mode=cti', async () => {
    const pool = makeMockPool({
      id: 'user-001',
      session_mode: 'cti',
      status_code: 'on_call',
    });
    mockGetPool.mockReturnValue(pool);

    await handleWebhookEvent(makeHangupPayload(), 'corr-hangup-001');

    expect(mockSetSystemStatus).toHaveBeenCalledOnce();
    expect(mockSetSystemStatus).toHaveBeenCalledWith('user-001', AgentStatus.WRAP_UP, 'corr-hangup-001');
  });

  it('should NOT call setSystemStatus for hangup when session_mode is "manual"', async () => {
    const pool = makeMockPool({
      id: 'user-001',
      session_mode: 'manual',
      status_code: 'on_call',
    });
    mockGetPool.mockReturnValue(pool);

    await handleWebhookEvent(makeHangupPayload(), 'corr-hangup-002');

    expect(mockSetSystemStatus).not.toHaveBeenCalled();
  });

  it('should NOT call setSystemStatus for hangup when agent status is NOT on_call (e.g. ready_for_calls)', async () => {
    const pool = makeMockPool({
      id: 'user-001',
      session_mode: 'cti',
      status_code: 'ready_for_calls',
    });
    mockGetPool.mockReturnValue(pool);

    await handleWebhookEvent(makeHangupPayload(), 'corr-hangup-003');

    expect(mockSetSystemStatus).not.toHaveBeenCalled();
  });

  it('should NOT call setSystemStatus when no agent is found for hangup event', async () => {
    const pool = makeMockPool(null);
    mockGetPool.mockReturnValue(pool);

    await handleWebhookEvent(makeHangupPayload(), 'corr-hangup-004');

    expect(mockSetSystemStatus).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 'hangup' outbound event — no agent status change
// ---------------------------------------------------------------------------

describe('handleWebhookEvent — hangup outbound (Phase 1.5)', () => {
  it('should NOT call setSystemStatus for outbound hangup event', async () => {
    const pool = makeMockPool();
    // Outbound hangup does a direct DB UPDATE via getPool — pool returns no rows
    pool.query.mockResolvedValue({ rows: [], rowCount: 1 });
    mockGetPool.mockReturnValue(pool);

    const payload = makeHangupPayload('telecmi-agent-001', 'outbound');
    await handleWebhookEvent(payload, 'corr-hangup-out-001');

    expect(mockSetSystemStatus).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CDR inbound answered — no regression check
// ---------------------------------------------------------------------------

describe('handleWebhookEvent — CDR regression (no Phase 1.5 impact)', () => {
  it('CDR inbound answered event — still inserts into cti_call_logs (setSystemStatus not called)', async () => {
    const pool: MockPool = { query: vi.fn() };
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'interaction-uuid-001' }] })  // SELECT interaction
      .mockResolvedValueOnce({ rows: [] })                                  // UPDATE cti_cmiuuid
      .mockResolvedValueOnce({ rows: [] })                                  // INSERT cti_call_logs
      .mockResolvedValueOnce({ rows: [] });                                 // INSERT interaction_events
    mockGetPool.mockReturnValue(pool);

    await handleWebhookEvent({
      type: 'cdr',
      direction: 'inbound',
      status: 'answered',
      cmiuuid: 'uuid-cdr-regression-001',
      from: '919876543210',
      to: '1800123456',
      time: Date.now(),
      billsec: 60,
    } as unknown as TeleCmiWebhookLiveEvent, 'corr-cdr-regression');

    expect(mockSetSystemStatus).not.toHaveBeenCalled();
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO cti_call_logs'),
      expect.any(Array),
    );
  });
});
