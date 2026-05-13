// =============================================================================
// CCM API — CTI Webhook Service Unit Tests
//
// Tests handleWebhookEvent by mocking getPool() and logger.
// No real DB connection required.
// =============================================================================

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies before importing the service
// ---------------------------------------------------------------------------

vi.mock('../../../shared/database/postgres', () => ({
  getPool: vi.fn(),
}));

vi.mock('../../agent-status/agent-status.service', () => ({
  setSystemStatus: vi.fn(),
}));

vi.mock('../../../shared/logging/logger', () => ({
  logger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    debug: vi.fn(), http: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

import * as postgresModule from '../../../shared/database/postgres';
import { logger } from '../../../shared/logging/logger';
import { handleWebhookEvent } from '../cti.webhook.service';
import type { TeleCmiWebhookCdr, TeleCmiWebhookLiveEvent } from '../cti.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockPool {
  query: Mock;
}

function makeMockPool(): MockPool {
  return { query: vi.fn() };
}

function setupPool(pool: MockPool) {
  (postgresModule.getPool as Mock).mockReturnValue(pool);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleWebhookEvent', () => {
  let pool: MockPool;

  beforeEach(() => {
    vi.clearAllMocks();
    pool = makeMockPool();
    setupPool(pool);
  });

  // -------------------------------------------------------------------------
  // CDR answered event
  // -------------------------------------------------------------------------

  it('CDR answered event — inserts row in cti_call_logs with status=answered', async () => {
    // First query: SELECT interaction → no match
    // Second query: INSERT into cti_call_logs
    pool.query
      .mockResolvedValueOnce({ rows: [] })   // SELECT id FROM interactions
      .mockResolvedValueOnce({ rows: [] });   // INSERT INTO cti_call_logs

    const payload: TeleCmiWebhookCdr = {
      type: 'cdr',
      direction: 'inbound',
      status: 'answered',
      cmiuuid: 'uuid-cdr-001',
      from: '919876543210',
      to: '1800123456',
      time: Date.now(),
      billsec: 120,
      answeredsec: 5,
    };

    await handleWebhookEvent(payload);

    // First call: CTE interaction lookup
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('WITH ranked AS'),
      ['uuid-cdr-001', '919876543210'],
    );

    // Second call: INSERT INTO cti_call_logs
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO cti_call_logs'),
      expect.arrayContaining(['uuid-cdr-001', 'answered']),
    );
  });

  it('CDR answered with matching interaction — links interaction_id, writes cti_call_cdr_received event', async () => {
    // First query: SELECT interaction → found
    // Second query: UPDATE interactions SET cti_cmiuuid (fallback stamp)
    // Third query: INSERT into cti_call_logs
    // Fourth query: INSERT into interaction_events
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'interaction-uuid-001' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const payload: TeleCmiWebhookCdr = {
      type: 'cdr',
      direction: 'inbound',
      status: 'answered',
      cmiuuid: 'uuid-cdr-002',
      from: '919876543210',
      to: '1800123456',
      time: Date.now(),
      billsec: 90,
    };

    await handleWebhookEvent(payload);

    // INSERT into cti_call_logs should include interaction_id
    expect(pool.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO cti_call_logs'),
      expect.arrayContaining(['interaction-uuid-001']),
    );

    // INSERT into interaction_events for cti_call_cdr_received
    expect(pool.query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('cti_call_cdr_received'),
      expect.arrayContaining(['interaction-uuid-001']),
    );
  });

  it('CDR webhook: late CDR with CLOSED interaction links via cmiuuid', async () => {
    // The CTE branch 1 (priority=1) matches a CLOSED interaction by cmiuuid.
    // Branch 2 has a status filter so it would not match a CLOSED interaction.
    // The ORDER BY priority ASC guarantees branch 1 wins.
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'interaction-closed-001' }] }) // CTE SELECT
      .mockResolvedValueOnce({ rows: [] })                                  // UPDATE cti_cmiuuid stamp
      .mockResolvedValueOnce({ rows: [] })                                  // INSERT INTO cti_call_logs
      .mockResolvedValueOnce({ rows: [] });                                 // INSERT INTO interaction_events

    const payload: TeleCmiWebhookCdr = {
      type: 'cdr',
      direction: 'inbound',
      status: 'answered',
      cmiuuid: 'uuid-late-cdr-001',
      from: '919876543210',
      to: '1800123456',
      time: Date.now(),
      billsec: 60,
      answeredsec: 4,
    };

    await handleWebhookEvent(payload);

    // Interaction lookup used the CTE
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('WITH ranked AS'),
      ['uuid-late-cdr-001', '919876543210'],
    );

    // INSERT into cti_call_logs must include interaction-closed-001 as interaction_id
    expect(pool.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO cti_call_logs'),
      expect.arrayContaining(['interaction-closed-001']),
    );
  });

  // -------------------------------------------------------------------------
  // CDR missed event
  // -------------------------------------------------------------------------

  it('CDR missed event — inserts row with status=missed, no interaction link attempt', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // Only the INSERT

    const payload: TeleCmiWebhookCdr = {
      type: 'cdr',
      direction: 'inbound',
      status: 'missed',
      cmiuuid: 'uuid-missed-001',
      from: '919876543210',
      to: '1800123456',
      time: Date.now(),
    };

    await handleWebhookEvent(payload);

    // Missed calls do NOT trigger interaction lookup (status !== 'answered')
    // Only one query: the INSERT
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO cti_call_logs'),
      expect.arrayContaining(['uuid-missed-001', 'missed']),
    );
  });

  // -------------------------------------------------------------------------
  // Live waiting event
  // -------------------------------------------------------------------------

  it('Live waiting event — inserts row with status=waiting via ON CONFLICT DO NOTHING', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const payload: TeleCmiWebhookLiveEvent = {
      type: 'event',
      direction: 'inbound',
      status: 'waiting',
      cmiuuid: 'uuid-wait-001',
      from: '919876543210',
      to: '1800123456',
      time: Date.now(),
    };

    await handleWebhookEvent(payload);

    expect(pool.query).toHaveBeenCalledTimes(1);
    // direction='inbound' and status='waiting' are SQL literals, NOT in the values array.
    // The values array contains: [cmiuuid, from_number, to_number, raw_payload, event_at]
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      expect.arrayContaining(['uuid-wait-001', '919876543210', '1800123456']),
    );
  });

  // -------------------------------------------------------------------------
  // No cmiuuid or conversation_uuid
  // -------------------------------------------------------------------------

  it('Event with no cmiuuid or conversation_uuid — logs warning, returns without DB call', async () => {
    const payload = {
      type: 'event' as const,
      direction: 'inbound' as const,
      status: 'waiting' as const,
      // no cmiuuid, no conversation_uuid
      from: '919876543210',
      time: Date.now(),
    };

    await handleWebhookEvent(payload);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('no cmiuuid'),
      expect.any(Object),
    );
    expect(pool.query).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Outbound CDR — logged in cti_call_logs, no interaction linking
  // -------------------------------------------------------------------------

  it('Outbound CDR answered — upserts cti_call_logs with direction=outbound, no interaction created', async () => {
    // Step 1: UPDATE pending row by request_id (returns 0 rows — no pending row)
    pool.query
      .mockResolvedValueOnce({ rowCount: 0 })  // UPDATE by request_id (not found)
      .mockResolvedValueOnce({ rows: [] });      // INSERT/UPSERT by cmiuuid

    const payload: TeleCmiWebhookCdr = {
      type: 'cdr',
      direction: 'outbound',
      status: 'answered',
      cmiuuid: 'uuid-out-001',
      from: '1800123456',
      to: '919876543210',
      time: Date.now(),
      billsec: 45,
      request_id: 'req-abc-001',
    };

    await handleWebhookEvent(payload);

    // Two queries: UPDATE by request_id, then upsert by cmiuuid
    expect(pool.query).toHaveBeenCalledTimes(2);

    // First query: UPDATE pending row
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE cti_call_logs'),
      ['uuid-out-001', 'req-abc-001'],
    );

    // Second query: INSERT/upsert
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO cti_call_logs'),
      expect.arrayContaining(['uuid-out-001', 'answered']),
    );
  });

  it('Outbound CDR answered — when pending row found by request_id, stamps it with real cmiuuid', async () => {
    // Step 1: UPDATE pending row by request_id — 1 row updated
    pool.query
      .mockResolvedValueOnce({ rowCount: 1 })  // UPDATE by request_id (found)
      .mockResolvedValueOnce({ rows: [] });     // upsert by cmiuuid

    const payload: TeleCmiWebhookCdr = {
      type: 'cdr',
      direction: 'outbound',
      status: 'answered',
      cmiuuid: 'uuid-out-002',
      from: '1800123456',
      to: '919876543210',
      time: Date.now(),
      billsec: 60,
      request_id: 'req-abc-002',
    };

    await handleWebhookEvent(payload);

    expect(pool.query).toHaveBeenCalledTimes(2);
    // First query stamped the real cmiuuid on the pending row
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE cti_call_logs'),
      ['uuid-out-002', 'req-abc-002'],
    );
  });

  // -------------------------------------------------------------------------
  // Uses conversation_uuid as fallback when cmiuuid missing
  // -------------------------------------------------------------------------

  it('Uses conversation_uuid when cmiuuid is absent', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const payload: TeleCmiWebhookLiveEvent = {
      type: 'event',
      direction: 'inbound',
      status: 'waiting',
      conversation_uuid: 'conv-uuid-001',
      // no cmiuuid
      from: '919876543210',
      time: Date.now(),
    };

    await handleWebhookEvent(payload);

    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['conv-uuid-001']),
    );
  });
});
