// =============================================================================
// CCM API — CTI Call Service Unit Tests
//
// Tests callerLookupService, getSdkConfigService, createInteractionFromCallService.
// All external dependencies are mocked — no real DB or network required.
// =============================================================================

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies before any import that resolves them
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

vi.mock('../../integration/adapterFactory', () => ({
  getInstallBaseAdapter: vi.fn(),
  getCustomerMasterAdapter: vi.fn(),
}));

vi.mock('../../interaction/interaction.repository', () => ({
  createInteraction: vi.fn(),
  findOpenInteractionForAgent: vi.fn(),
}));

vi.mock('../../agent-status/agent-status.repository', () => ({
  getAgentStatusByUserId: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are set up)
// ---------------------------------------------------------------------------

import * as postgresModule from '../../../shared/database/postgres';
import * as ctiConfigModule from '../cti.config';
import * as adapterFactory from '../../integration/adapterFactory';
import * as interactionRepo from '../../interaction/interaction.repository';
import * as agentStatusRepo from '../../agent-status/agent-status.repository';
import { callerLookupService, getSdkConfigService, createInteractionFromCallService, getCallerContextService } from '../cti.call.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_CONFIG = {
  appId: 1111112,   // number — config schema now uses z.coerce.number().int().positive()
  appSecret: 'secret',
  sbcUri: 'sbcind.telecmi.com',
  webhookCustomValue: '',
  baseUrl: 'https://rest.telecmi.com',
  callerId: '',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupConfig() {
  (ctiConfigModule.getCtiConfig as Mock).mockReturnValue(MOCK_CONFIG);
}

function makePoolClient() {
  const client = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  };
  return client;
}

function setupPool(rows: object[] = [], clientOverride?: ReturnType<typeof makePoolClient>) {
  const client = clientOverride ?? makePoolClient();
  (postgresModule.getPool as Mock).mockReturnValue({
    query: vi.fn().mockResolvedValue({ rows }),
    connect: vi.fn().mockResolvedValue(client),
  });
  return client;
}

// ---------------------------------------------------------------------------
// callerLookupService tests
// ---------------------------------------------------------------------------

describe('callerLookupService', () => {
  let mockIbAdapter: { search: Mock };
  let mockCmAdapter: { search: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIbAdapter = { search: vi.fn() };
    mockCmAdapter = { search: vi.fn() };
    (adapterFactory.getInstallBaseAdapter as Mock).mockReturnValue(mockIbAdapter);
    (adapterFactory.getCustomerMasterAdapter as Mock).mockReturnValue(mockCmAdapter);
  });

  it('returns { found: true, name, customerId } when IB adapter finds single match', async () => {
    mockIbAdapter.search.mockResolvedValue([
      { customerName: 'John Doe', customerRef: 'CUST-001' },
    ]);

    const result = await callerLookupService('9876543210');

    expect(result).toEqual({ found: true, name: 'John Doe', customerId: 'CUST-001' });
  });

  it('returns { found: false } when no match in IB or CM adapters', async () => {
    mockIbAdapter.search.mockResolvedValue([]);
    mockCmAdapter.search.mockResolvedValue([]);

    const result = await callerLookupService('9876543210');

    expect(result).toEqual({ found: false });
  });

  it('falls back to Customer Master when IB returns nothing, single CM match', async () => {
    mockIbAdapter.search.mockResolvedValue([]);
    mockCmAdapter.search.mockResolvedValue([
      { customerName: 'Jane Doe', customerRef: 'CUST-CM-002' },
    ]);

    const result = await callerLookupService('9876543210');

    expect(result).toEqual({ found: true, name: 'Jane Doe', customerId: 'CUST-CM-002' });
  });

  it('returns { found: true } (no name/customerId) when multiple matches found', async () => {
    mockIbAdapter.search.mockResolvedValue([
      { customerName: 'John A', customerRef: 'CUST-001' },
      { customerName: 'John B', customerRef: 'CUST-002' },
    ]);

    const result = await callerLookupService('9876543210');

    // results.length > 0 but !== 1 → returns { found: results.length > 0 } = { found: true }
    expect(result.found).toBe(true);
    expect(result.name).toBeUndefined();
    expect(result.customerId).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Number normalization
  // -------------------------------------------------------------------------

  it('normalizes +919876543210 → searches with last 10 digits: 9876543210', async () => {
    mockIbAdapter.search.mockResolvedValue([]);
    mockCmAdapter.search.mockResolvedValue([]);

    await callerLookupService('+919876543210');

    expect(mockIbAdapter.search).toHaveBeenCalledWith(
      expect.anything(),
      '9876543210',
    );
  });

  it('normalizes 09876543210 → searches with last 10 digits: 9876543210', async () => {
    mockIbAdapter.search.mockResolvedValue([]);
    mockCmAdapter.search.mockResolvedValue([]);

    await callerLookupService('09876543210');

    expect(mockIbAdapter.search).toHaveBeenCalledWith(
      expect.anything(),
      '9876543210',
    );
  });

  it('normalizes 9876543210 → searches as-is: 9876543210', async () => {
    mockIbAdapter.search.mockResolvedValue([]);
    mockCmAdapter.search.mockResolvedValue([]);

    await callerLookupService('9876543210');

    expect(mockIbAdapter.search).toHaveBeenCalledWith(
      expect.anything(),
      '9876543210',
    );
  });

  it('returns { found: false } and does not call adapters when number has no digits', async () => {
    const result = await callerLookupService('+++');

    expect(result).toEqual({ found: false });
    expect(mockIbAdapter.search).not.toHaveBeenCalled();
  });

  it('returns { found: false } when adapter throws', async () => {
    mockIbAdapter.search.mockRejectedValue(new Error('Adapter failure'));

    const result = await callerLookupService('9876543210');

    expect(result).toEqual({ found: false });
  });
});

// ---------------------------------------------------------------------------
// getSdkConfigService tests
// ---------------------------------------------------------------------------

describe('getSdkConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupConfig();
  });

  it('returns { telecmiAgentId, telecmiSipPassword, sbcUri } when user has telecmi_extension set', async () => {
    // telecmiAgentId returned to browser must be "{extension}_{appId}" for piopiy.login()
    setupPool([{ telecmi_agent_id: 'agent-001', telecmi_extension: 101, telecmi_sip_password: 'SipPass123' }]);

    const result = await getSdkConfigService('user-uuid-001');

    expect(result).toEqual({
      telecmiAgentId: '101_1111112',   // {extension}_{appId} format — NOT raw telecmi_agent_id
      telecmiSipPassword: 'SipPass123',
      sbcUri: 'sbcind.telecmi.com',
    });
  });

  it('returns empty string for telecmiSipPassword when sip_password is null', async () => {
    setupPool([{ telecmi_agent_id: 'agent-001', telecmi_extension: 102, telecmi_sip_password: null }]);

    const result = await getSdkConfigService('user-uuid-001');

    expect(result.telecmiSipPassword).toBe('');
    expect(result.telecmiAgentId).toBe('102_1111112');
  });

  it('throws 404 AppError when user has no telecmi_extension', async () => {
    // telecmi_extension is required for WebRTC login — agent_id alone is not sufficient
    setupPool([{ telecmi_agent_id: 'agent-001', telecmi_extension: null, telecmi_sip_password: 'pass' }]);

    await expect(getSdkConfigService('user-uuid-001')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('throws 404 AppError when user row is not found at all', async () => {
    setupPool([]); // no rows

    await expect(getSdkConfigService('user-uuid-unknown')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });
});

// ---------------------------------------------------------------------------
// createInteractionFromCallService tests
// ---------------------------------------------------------------------------

describe('createInteractionFromCallService', () => {
  let mockIbAdapter: { search: Mock };
  let mockCmAdapter: { search: Mock };

  const MOCK_INTERACTION_ROW = {
    id: 'interaction-uuid-001',
    status: 'active',
    channel: 'inbound_call',
    mode: 'inbound_call',
    started_at: new Date('2026-03-29T10:00:00Z'),
    cti_cmiuuid: 'uuid-call-001',
    cti_from_number: '9876543210',
  };

  const MOCK_AGENT_STATUS_READY = {
    user_id: 'user-uuid-001',
    status_code: 'ready_for_calls',
    previous_status_code: null,
    changed_at: new Date(),
    changed_by_user_id: 'user-uuid-001',
    correlation_id: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupConfig();

    mockIbAdapter = { search: vi.fn().mockResolvedValue([]) };
    mockCmAdapter = { search: vi.fn().mockResolvedValue([]) };
    (adapterFactory.getInstallBaseAdapter as Mock).mockReturnValue(mockIbAdapter);
    (adapterFactory.getCustomerMasterAdapter as Mock).mockReturnValue(mockCmAdapter);

    (interactionRepo.findOpenInteractionForAgent as Mock).mockResolvedValue(null);
    (interactionRepo.createInteraction as Mock).mockResolvedValue(MOCK_INTERACTION_ROW);
    // Default: agent is ready — individual tests override as needed
    (agentStatusRepo.getAgentStatusByUserId as Mock).mockResolvedValue(MOCK_AGENT_STATUS_READY);
  });

  it('creates interaction with channel=inbound_call, cti_cmiuuid set, cti_from_number set', async () => {
    const client = makePoolClient();
    setupPool([], client);

    const result = await createInteractionFromCallService(
      'user-uuid-001',
      { cmiuuid: 'uuid-call-001', fromNumber: '9876543210' },
      'corr-001',
    );

    expect(interactionRepo.createInteraction).toHaveBeenCalledWith(
      'user-uuid-001',
      'corr-001',
      expect.any(Object),
      expect.objectContaining({
        channel: 'inbound_call',
        ctiCmiuuid: 'uuid-call-001',
        ctiFromNumber: '9876543210',
      }),
    );

    expect(result.channel).toBe('inbound_call');
    expect(result.interactionId).toBe('interaction-uuid-001');
  });

  it('when caller lookup finds single match: returns customerContext with found=true', async () => {
    mockIbAdapter.search.mockResolvedValue([
      { customerName: 'Test Customer', customerRef: 'CUST-123' },
    ]);

    const client = makePoolClient();
    setupPool([], client);

    const result = await createInteractionFromCallService(
      'user-uuid-001',
      { cmiuuid: 'uuid-call-001', fromNumber: '9876543210' },
      'corr-001',
    );

    expect(result.customerContext).toEqual({
      found: true,
      name: 'Test Customer',
      customerId: 'CUST-123',
    });
  });

  it('when caller lookup finds no match: returns customerContext with found=false', async () => {
    mockIbAdapter.search.mockResolvedValue([]);
    mockCmAdapter.search.mockResolvedValue([]);

    const client = makePoolClient();
    setupPool([], client);

    const result = await createInteractionFromCallService(
      'user-uuid-001',
      { cmiuuid: 'uuid-call-002', fromNumber: '9876543210' },
      'corr-002',
    );

    expect(result.customerContext).toEqual({ found: false });
  });

  it('throws AGENT_NOT_AVAILABLE (422) when agent status is not ready_for_calls', async () => {
    // Simulate agent on break
    (agentStatusRepo.getAgentStatusByUserId as Mock).mockResolvedValue({
      ...{ user_id: 'user-uuid-001', previous_status_code: null, changed_at: new Date(), changed_by_user_id: 'user-uuid-001', correlation_id: null },
      status_code: 'break',
    });

    await expect(
      createInteractionFromCallService(
        'user-uuid-001',
        { cmiuuid: 'uuid-call-005', fromNumber: '9876543210' },
        'corr-005',
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'AGENT_NOT_AVAILABLE',
    });

    // Neither interaction creation nor DB transaction should proceed
    expect(interactionRepo.createInteraction).not.toHaveBeenCalled();
  });

  it('throws AGENT_NOT_AVAILABLE (422) when agent status row does not exist', async () => {
    // No row in agent_statuses for this user
    (agentStatusRepo.getAgentStatusByUserId as Mock).mockResolvedValue(null);

    await expect(
      createInteractionFromCallService(
        'user-uuid-001',
        { cmiuuid: 'uuid-call-006', fromNumber: '9876543210' },
        'corr-006',
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'AGENT_NOT_AVAILABLE',
    });

    expect(interactionRepo.createInteraction).not.toHaveBeenCalled();
  });

  it('returns interactionId and startedAt as ISO string in result', async () => {
    const client = makePoolClient();
    setupPool([], client);

    const result = await createInteractionFromCallService(
      'user-uuid-001',
      { cmiuuid: 'uuid-call-001', fromNumber: '9876543210' },
      'corr-001',
    );

    expect(result.interactionId).toBe('interaction-uuid-001');
    expect(typeof result.startedAt).toBe('string');
    expect(result.startedAt).toBe('2026-03-29T10:00:00.000Z');
  });

  it('re-throws non-exclusion-violation DB errors from createInteraction', async () => {
    (interactionRepo.createInteraction as Mock).mockRejectedValue(
      new Error('DB connection lost'),
    );

    const client = makePoolClient();
    // client.query for BEGIN/COMMIT/ROLLBACK
    client.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockRejectedValueOnce(new Error('DB connection lost')); // createInteraction inner call

    // Since createInteraction is mocked at module level and throws, expect the error to propagate
    await expect(
      createInteractionFromCallService(
        'user-uuid-001',
        { cmiuuid: 'uuid-call-004', fromNumber: '9876543210' },
        'corr-004',
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getCallerContextService tests
// ---------------------------------------------------------------------------

describe('getCallerContextService', () => {
  let mockIbAdapter: { search: Mock };
  let mockCmAdapter: { search: Mock };

  // Full mock record matching the Install Base adapter shape
  const MOCK_IB_RECORD = {
    customerRef: 'CUST-IB-007',
    customerName: 'Roshan',
    primaryMobile: '8554982643',
    email: 'roshanm@excellonsoft.com',
    vehicles: [
      {
        vehicleRef: 'VEH-IB-008',
        registrationNumber: 'KL07AS6677',
        modelName: 'Bajaj Dominar 250',
        variant: 'Dominar 250 ABS',
        chassisNumber: 'MD2A25BZ4NCA00008',
        dealerRef: 'DLR-006',
      },
    ],
    sourceSystem: 'INSTALL_BASE' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIbAdapter = { search: vi.fn() };
    mockCmAdapter = { search: vi.fn() };
    (adapterFactory.getInstallBaseAdapter as Mock).mockReturnValue(mockIbAdapter);
    (adapterFactory.getCustomerMasterAdapter as Mock).mockReturnValue(mockCmAdapter);
  });

  it('returns full SearchResultItemDto[] when IB adapter finds a match', async () => {
    mockIbAdapter.search.mockResolvedValue([MOCK_IB_RECORD]);

    const result = await getCallerContextService('8554982643');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      customerRef: 'CUST-IB-007',
      customerName: 'Roshan',
      primaryMobile: '8554982643',
      email: 'roshanm@excellonsoft.com',
      sourceSystem: 'INSTALL_BASE',
    });
    // Vehicles must be mapped with chassisNumberMasked (not raw chassisNumber)
    expect(result[0].vehicles).toHaveLength(1);
    expect(result[0].vehicles[0]).toMatchObject({
      vehicleRef: 'VEH-IB-008',
      registrationNumber: 'KL07AS6677',
      modelName: 'Bajaj Dominar 250',
      variant: 'Dominar 250 ABS',
      dealerRef: 'DLR-006',
    });
    // chassisNumberMasked must be present and must NOT be the raw chassis number
    expect(result[0].vehicles[0].chassisNumberMasked).toBeDefined();
    expect(result[0].vehicles[0].chassisNumberMasked).not.toBe('MD2A25BZ4NCA00008');
    // Raw chassisNumber must NOT be present in the response (security: masked only)
    expect((result[0].vehicles[0] as unknown as Record<string, unknown>)['chassisNumber']).toBeUndefined();
  });

  it('falls back to Customer Master when IB returns empty', async () => {
    const CM_RECORD = { ...MOCK_IB_RECORD, sourceSystem: 'CUSTOMER_MASTER' as const };
    mockIbAdapter.search.mockResolvedValue([]);
    mockCmAdapter.search.mockResolvedValue([CM_RECORD]);

    const result = await getCallerContextService('8554982643');

    expect(result).toHaveLength(1);
    expect(result[0].sourceSystem).toBe('CUSTOMER_MASTER');
    // IB was tried first
    expect(mockIbAdapter.search).toHaveBeenCalledTimes(1);
    expect(mockCmAdapter.search).toHaveBeenCalledTimes(1);
  });

  it('returns [] when neither IB nor CM find a match', async () => {
    mockIbAdapter.search.mockResolvedValue([]);
    mockCmAdapter.search.mockResolvedValue([]);

    const result = await getCallerContextService('9999999999');

    expect(result).toEqual([]);
  });

  it('returns [] without calling adapters when number has fewer than 3 digits', async () => {
    const result = await getCallerContextService('12');

    expect(result).toEqual([]);
    expect(mockIbAdapter.search).not.toHaveBeenCalled();
    expect(mockCmAdapter.search).not.toHaveBeenCalled();
  });

  it('returns [] without calling adapters when number has no digits at all', async () => {
    const result = await getCallerContextService('+++withheld');

    expect(result).toEqual([]);
    expect(mockIbAdapter.search).not.toHaveBeenCalled();
  });

  it('normalizes +918554982643 (international prefix) → searches with last 10 digits', async () => {
    mockIbAdapter.search.mockResolvedValue([MOCK_IB_RECORD]);

    await getCallerContextService('+918554982643');

    expect(mockIbAdapter.search).toHaveBeenCalledWith(
      expect.anything(),
      '8554982643',
    );
  });

  it('normalizes 08554982643 (11 digits with leading 0) → searches with last 10 digits', async () => {
    mockIbAdapter.search.mockResolvedValue([]);
    mockCmAdapter.search.mockResolvedValue([]);

    await getCallerContextService('08554982643');

    expect(mockIbAdapter.search).toHaveBeenCalledWith(
      expect.anything(),
      '8554982643',
    );
  });

  it('returns [] (does not throw) when IB adapter throws', async () => {
    mockIbAdapter.search.mockRejectedValue(new Error('Install Base unavailable'));

    const result = await getCallerContextService('8554982643');

    expect(result).toEqual([]);
  });

  it('returns [] (does not throw) when CM adapter throws during fallback', async () => {
    mockIbAdapter.search.mockResolvedValue([]);
    mockCmAdapter.search.mockRejectedValue(new Error('Customer Master unavailable'));

    const result = await getCallerContextService('8554982643');

    expect(result).toEqual([]);
  });

  it('returns multiple records when adapter finds multiple matches', async () => {
    const RECORD_2 = { ...MOCK_IB_RECORD, customerRef: 'CUST-IB-008', customerName: 'Kavitha' };
    mockIbAdapter.search.mockResolvedValue([MOCK_IB_RECORD, RECORD_2]);

    const result = await getCallerContextService('8554982643');

    expect(result).toHaveLength(2);
    expect(result[0].customerRef).toBe('CUST-IB-007');
    expect(result[1].customerRef).toBe('CUST-IB-008');
  });
});
