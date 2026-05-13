// =============================================================================
// CCM API — CTI Routing Service Unit Tests
//
// Tests buildRoutingResponse by mocking getPool() and getCtiConfig().
// No real DB or TeleCMI connection required.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies before importing the service
// ---------------------------------------------------------------------------

vi.mock('../../../shared/database/postgres', () => ({
  getPool: vi.fn(),
}));

vi.mock('../cti.config', () => ({
  getCtiConfig: vi.fn(),
}));

vi.mock('../../../shared/logging/logger', () => ({
  logger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    debug: vi.fn(), http: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

import * as postgresModule from '../../../shared/database/postgres';
import * as ctiConfigModule from '../cti.config';
import { buildRoutingResponse } from '../cti.routing.service';
import type { TeleCmiRoutingRequest } from '../cti.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_CONFIG = {
  appId: '1111112',
  appSecret: 'secret',
  sbcUri: 'sbcind.telecmi.com',
  webhookSecret: '',
  baseUrl: 'https://rest.telecmi.com',
};

function makeQueryFn(rows: object[]) {
  return vi.fn().mockResolvedValue({ rows });
}

function setupPool(rows: object[]) {
  (postgresModule.getPool as ReturnType<typeof vi.fn>).mockReturnValue({
    query: makeQueryFn(rows),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (ctiConfigModule.getCtiConfig as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_CONFIG);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildRoutingResponse', () => {
  const validPayload: TeleCmiRoutingRequest = {
    from: '919876543210',
    to: '1800123456',
    cmiuuid: 'uuid-001',
    appid: 1111112,
  };

  it('returns agents when some are ready_for_calls and have telecmi_agent_id', async () => {
    setupPool([
      { telecmi_agent_id: 'agent-id-1', telecmi_phone_number: '919876543210' },
      { telecmi_agent_id: 'agent-id-2', telecmi_phone_number: null },
    ]);

    const result = await buildRoutingResponse(validPayload);

    expect(result.result).toHaveLength(2);
    expect(result.result[0]).toEqual({ agent_id: 'agent-id-1', phone: '919876543210' });
    // When phone is null, falls back to default
    expect(result.result[1]).toEqual({ agent_id: 'agent-id-2', phone: '919000000000' });
  });

  it('returns empty result array when no agents are ready_for_calls', async () => {
    setupPool([]);

    const result = await buildRoutingResponse(validPayload);

    expect(result.result).toHaveLength(0);
  });

  it('returns empty result array when DB has no rows (agents have no telecmi_agent_id filtered at DB level)', async () => {
    // The SQL WHERE clause already filters on telecmi_agent_id IS NOT NULL
    // so this simulates that scenario by returning empty rows
    setupPool([]);

    const result = await buildRoutingResponse(validPayload);

    expect(result.result).toEqual([]);
  });

  it('throws 403 FORBIDDEN when appid does not match config', async () => {
    setupPool([]);

    const badPayload: TeleCmiRoutingRequest = {
      ...validPayload,
      appid: 9999999,
    };

    await expect(buildRoutingResponse(badPayload)).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });

  it('sets followme: false, code: 200, loop: 2, timeout: 20 in all success responses', async () => {
    setupPool([
      { telecmi_agent_id: 'agent-id-1', telecmi_phone_number: '919876543210' },
    ]);

    const result = await buildRoutingResponse(validPayload);

    expect(result.followme).toBe(false);
    expect(result.code).toBe(200);
    expect(result.loop).toBe(2);
    expect(result.timeout).toBe(20);
  });

  it('sets followme: false, code: 200, loop: 2, timeout: 20 even with empty result array', async () => {
    setupPool([]);

    const result = await buildRoutingResponse(validPayload);

    expect(result.followme).toBe(false);
    expect(result.code).toBe(200);
    expect(result.loop).toBe(2);
    expect(result.timeout).toBe(20);
  });

  it('accepts appid as string matching config appId string', async () => {
    // Config returns appId as '1111112' (string), payload has numeric 1111112
    // The service uses String(payload.appid) !== String(config.appId)
    setupPool([]);

    const result = await buildRoutingResponse(validPayload);
    expect(result.code).toBe(200);
  });
});
