// =============================================================================
// CCM API — Interaction Service Unit Tests
//
// All repository and database calls are mocked. Tests cover business logic:
// state machine guards, concurrent interaction prevention, remarks enforcement.
// Source: CCM_Phase1_Agent_Interaction_Documentation.md §B2–B8, §C2–C9
//         phase1-technical-blueprint.md §6 Interaction State Machine
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';

// ---------------------------------------------------------------------------
// Mock all external dependencies before importing the service under test
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

vi.mock('../../../shared/database/postgres', () => ({
  getPool: vi.fn(() => ({
    connect: vi.fn(),
    query: vi.fn(),
  })),
}));

vi.mock('../interaction.repository', () => ({
  findInteractionById: vi.fn(),
  findOpenInteractionForAgent: vi.fn(),
  createInteraction: vi.fn(),
  updateInteractionContext: vi.fn(),
  transitionToWrapup: vi.fn(),
  closeInteraction: vi.fn(),
  markInteractionIncomplete: vi.fn(),
  upsertWrapup: vi.fn(),
  findWrapupByInteractionId: vi.fn(),
  findEventsByInteractionId: vi.fn(),
  findReferenceValue: vi.fn(),
}));

vi.mock('../../audit/audit.repository', () => ({
  writeAuditEvent: vi.fn(),
}));

vi.mock('../../auth/auth.repository', () => ({
  findUserById: vi.fn(),
}));

vi.mock('../../agent-status/agent-status.repository', () => ({
  getAgentStatusByUserId: vi.fn(),
}));

vi.mock('../../agent-status/agent-status.service', () => ({
  setSystemStatus: vi.fn(),
}));

import * as repo from '../interaction.repository';
import * as auditRepo from '../../audit/audit.repository';
import * as authRepo from '../../auth/auth.repository';
import * as agentStatusRepo from '../../agent-status/agent-status.repository';
import * as agentStatusService from '../../agent-status/agent-status.service';
import { getPool } from '../../../shared/database/postgres';
import {
  createInteractionService,
  updateInteractionContextService,
  saveWrapupService,
  closeInteractionService,
  markIncompleteService,
} from '../interaction.service';
import type { InteractionRow, WrapupRow } from '../interaction.repository';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------
const mockFindInteractionById = repo.findInteractionById as MockedFunction<typeof repo.findInteractionById>;
const mockFindOpenInteractionForAgent = repo.findOpenInteractionForAgent as MockedFunction<typeof repo.findOpenInteractionForAgent>;
const mockCreateInteraction = repo.createInteraction as MockedFunction<typeof repo.createInteraction>;
const mockUpdateInteractionContext = repo.updateInteractionContext as MockedFunction<typeof repo.updateInteractionContext>;
const mockTransitionToWrapup = repo.transitionToWrapup as MockedFunction<typeof repo.transitionToWrapup>;
const mockCloseInteraction = repo.closeInteraction as MockedFunction<typeof repo.closeInteraction>;
const mockMarkInteractionIncomplete = repo.markInteractionIncomplete as MockedFunction<typeof repo.markInteractionIncomplete>;
const mockUpsertWrapup = repo.upsertWrapup as MockedFunction<typeof repo.upsertWrapup>;
const mockFindWrapupByInteractionId = repo.findWrapupByInteractionId as MockedFunction<typeof repo.findWrapupByInteractionId>;
const mockFindReferenceValue = repo.findReferenceValue as MockedFunction<typeof repo.findReferenceValue>;
const mockWriteAuditEvent = auditRepo.writeAuditEvent as MockedFunction<typeof auditRepo.writeAuditEvent>;
const mockFindUserById = authRepo.findUserById as MockedFunction<typeof authRepo.findUserById>;
const mockGetAgentStatusByUserId = agentStatusRepo.getAgentStatusByUserId as MockedFunction<typeof agentStatusRepo.getAgentStatusByUserId>;
const mockSetSystemStatus = agentStatusService.setSystemStatus as MockedFunction<typeof agentStatusService.setSystemStatus>;

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeInteraction(overrides: Partial<InteractionRow> = {}): InteractionRow {
  return {
    id: 'int-test-001',
    channel: 'manual',
    mode: 'manual',
    status: 'IDENTIFYING',
    started_at: new Date('2026-03-22T10:00:00Z'),
    ended_at: null,
    started_by_user_id: 'user-001',
    completion_flag: null,
    current_customer_ref: null,
    current_vehicle_ref: null,
    current_dealer_ref: null,
    correlation_id: 'corr-001',
    created_at: new Date('2026-03-22T10:00:00Z'),
    updated_at: new Date('2026-03-22T10:00:00Z'),
    cti_cmiuuid: null,
    cti_from_number: null,
    customer_phone_number: null,
    ...overrides,
  };
}

function makeWrapup(overrides: Partial<WrapupRow> = {}): WrapupRow {
  return {
    id: 'wrapup-001',
    interaction_id: 'int-test-001',
    contact_reason_code: 'query',
    identification_outcome_code: 'customer_vehicle_identified',
    interaction_disposition_code: 'information_provided',
    remarks: null,
    saved_by_user_id: 'user-001',
    saved_at: new Date('2026-03-22T10:30:00Z'),
    ...overrides,
  };
}

// Mock pool client with transaction support
function makeMockClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  };
}

const CORRELATION_ID = 'corr-test-001';
const USER_ID = 'user-001';
const INTERACTION_ID = 'int-test-001';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteAuditEvent.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// createInteractionService
// ---------------------------------------------------------------------------

describe('createInteractionService', () => {
  it('should create an interaction with IDENTIFYING status when no open interaction exists', async () => {
    mockFindOpenInteractionForAgent.mockResolvedValue(null);

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    const createdRow = makeInteraction({ status: 'IDENTIFYING' });
    mockCreateInteraction.mockResolvedValue(createdRow);

    const result = await createInteractionService(USER_ID, CORRELATION_ID);

    expect(result.status).toBe('IDENTIFYING');
    expect(result.interactionId).toBe('int-test-001');
    expect(result.channel).toBe('manual');
    expect(result.mode).toBe('manual');
  });

  it('should throw 409 conflict when agent already has an open interaction', async () => {
    const openInteraction = makeInteraction({ status: 'IDENTIFYING' });
    mockFindOpenInteractionForAgent.mockResolvedValue(openInteraction);

    // Error code is INTERACTION_ALREADY_ACTIVE (not the old generic CONFLICT) so
    // that the IdleWorkspace auto-resume path can extract existingInteractionId
    // from error.details.  details.existingInteractionId must equal the open
    // interaction's id so the frontend can fetch and resume it.
    await expect(createInteractionService(USER_ID, CORRELATION_ID)).rejects.toMatchObject({
      statusCode: 409,
      code: 'INTERACTION_ALREADY_ACTIVE',
      details: { existingInteractionId: openInteraction.id },
    });
  });

  it('should write interaction_created audit event after creating the interaction', async () => {
    mockFindOpenInteractionForAgent.mockResolvedValue(null);

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    const createdRow = makeInteraction({ status: 'IDENTIFYING' });
    mockCreateInteraction.mockResolvedValue(createdRow);

    await createInteractionService(USER_ID, CORRELATION_ID);

    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'interaction_created', interactionId: 'int-test-001' }),
      expect.anything(),
    );
  });

  it('should throw when the underlying create query fails', async () => {
    mockFindOpenInteractionForAgent.mockResolvedValue(null);

    const mockClient = makeMockClient();
    mockClient.query.mockRejectedValueOnce(new Error('DB failure')); // BEGIN
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    mockCreateInteraction.mockRejectedValue(new Error('DB failure'));

    await expect(createInteractionService(USER_ID, CORRELATION_ID)).rejects.toThrow('DB failure');
  });

  it('should throw 409 INTERACTION_ALREADY_ACTIVE when PostgreSQL exclusion violation (23P01) is caught', async () => {
    // Simulates two concurrent requests: guard check passes for both, but the
    // DB EXCLUDE constraint fires on the second INSERT (race condition).
    mockFindOpenInteractionForAgent.mockResolvedValue(null);

    const pgExclusionError = Object.assign(new Error('exclusion constraint violation'), {
      code: '23P01',
    });

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    mockCreateInteraction.mockRejectedValue(pgExclusionError);

    await expect(createInteractionService(USER_ID, CORRELATION_ID)).rejects.toMatchObject({
      statusCode: 409,
      code: 'INTERACTION_ALREADY_ACTIVE',
      message: 'Agent already has an active interaction in progress',
    });
  });
});

// ---------------------------------------------------------------------------
// updateInteractionContextService
// ---------------------------------------------------------------------------

describe('updateInteractionContextService', () => {
  const contextInput = {
    customerRef: 'CUST-001',
    vehicleRef: 'VEH-001',
    dealerRef: 'DLR-001',
    isReselection: false,
  };

  it('should allow context update when interaction is in IDENTIFYING status', async () => {
    const interaction = makeInteraction({ status: 'IDENTIFYING' });
    mockFindInteractionById.mockResolvedValue(interaction);

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    const updated = makeInteraction({
      status: 'CONTEXT_CONFIRMED',
      current_customer_ref: 'CUST-001',
      current_vehicle_ref: 'VEH-001',
      current_dealer_ref: 'DLR-001',
    });
    mockUpdateInteractionContext.mockResolvedValue(updated);

    const result = await updateInteractionContextService(
      INTERACTION_ID, USER_ID, contextInput, CORRELATION_ID,
    );

    expect(result.status).toBe('CONTEXT_CONFIRMED');
    expect(result.currentCustomerRef).toBe('CUST-001');
  });

  it('should allow context update when interaction is in CONTEXT_CONFIRMED status', async () => {
    const interaction = makeInteraction({ status: 'CONTEXT_CONFIRMED' });
    mockFindInteractionById.mockResolvedValue(interaction);

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    const updated = makeInteraction({ status: 'CONTEXT_CONFIRMED', current_customer_ref: 'CUST-002' });
    mockUpdateInteractionContext.mockResolvedValue(updated);

    const result = await updateInteractionContextService(
      INTERACTION_ID, USER_ID, { ...contextInput, customerRef: 'CUST-002' }, CORRELATION_ID,
    );

    expect(result.status).toBe('CONTEXT_CONFIRMED');
  });

  it('should throw 422 when interaction is in NEW status', async () => {
    const interaction = makeInteraction({ status: 'NEW' });
    mockFindInteractionById.mockResolvedValue(interaction);

    await expect(
      updateInteractionContextService(INTERACTION_ID, USER_ID, contextInput, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should throw 422 when interaction is in WRAPUP status', async () => {
    const interaction = makeInteraction({ status: 'WRAPUP' });
    mockFindInteractionById.mockResolvedValue(interaction);

    await expect(
      updateInteractionContextService(INTERACTION_ID, USER_ID, contextInput, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should throw 422 when interaction is in CLOSED status', async () => {
    const interaction = makeInteraction({ status: 'CLOSED' });
    mockFindInteractionById.mockResolvedValue(interaction);

    await expect(
      updateInteractionContextService(INTERACTION_ID, USER_ID, contextInput, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should throw 422 when interaction is in INCOMPLETE status', async () => {
    const interaction = makeInteraction({ status: 'INCOMPLETE' });
    mockFindInteractionById.mockResolvedValue(interaction);

    await expect(
      updateInteractionContextService(INTERACTION_ID, USER_ID, contextInput, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should throw 404 when interaction does not exist', async () => {
    mockFindInteractionById.mockResolvedValue(null);

    await expect(
      updateInteractionContextService(INTERACTION_ID, USER_ID, contextInput, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('should throw 403 when a different user attempts to update the context', async () => {
    const interaction = makeInteraction({ started_by_user_id: 'other-user-999' });
    mockFindInteractionById.mockResolvedValue(interaction);

    await expect(
      updateInteractionContextService(INTERACTION_ID, USER_ID, contextInput, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('should write customer_reselected event when isReselection is true', async () => {
    const interaction = makeInteraction({ status: 'CONTEXT_CONFIRMED' });
    mockFindInteractionById.mockResolvedValue(interaction);

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    const updated = makeInteraction({ status: 'CONTEXT_CONFIRMED', current_customer_ref: 'CUST-002' });
    mockUpdateInteractionContext.mockResolvedValue(updated);

    await updateInteractionContextService(
      INTERACTION_ID, USER_ID, { ...contextInput, isReselection: true }, CORRELATION_ID,
    );

    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'customer_reselected' }),
      expect.anything(),
    );
  });

  it('should write customer_selected and vehicle_selected events when not a reselection', async () => {
    const interaction = makeInteraction({ status: 'IDENTIFYING' });
    mockFindInteractionById.mockResolvedValue(interaction);

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    const updated = makeInteraction({ status: 'CONTEXT_CONFIRMED', current_customer_ref: 'CUST-001' });
    mockUpdateInteractionContext.mockResolvedValue(updated);

    await updateInteractionContextService(INTERACTION_ID, USER_ID, contextInput, CORRELATION_ID);

    const auditCalls = mockWriteAuditEvent.mock.calls.map((c: unknown[]) => (c[0] as { eventName: string }).eventName);
    expect(auditCalls).toContain('customer_selected');
    expect(auditCalls).toContain('vehicle_selected');
    expect(auditCalls).toContain('dealer_loaded');
  });

  // ---- F16: null dealerRef does not block context update ----------------------

  it('should succeed and not throw when dealerRef is null (F16 — dealer missing does not block)', async () => {
    const interaction = makeInteraction({ status: 'IDENTIFYING' });
    mockFindInteractionById.mockResolvedValue(interaction);

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    const updated = makeInteraction({
      status: 'CONTEXT_CONFIRMED',
      current_customer_ref: 'CUST-001',
      current_vehicle_ref: 'VEH-001',
      current_dealer_ref: null,
    });
    mockUpdateInteractionContext.mockResolvedValue(updated);

    const result = await updateInteractionContextService(
      INTERACTION_ID,
      USER_ID,
      { customerRef: 'CUST-001', vehicleRef: 'VEH-001', dealerRef: null, isReselection: false },
      CORRELATION_ID,
    );

    // Service must not throw and must return CONTEXT_CONFIRMED
    expect(result.status).toBe('CONTEXT_CONFIRMED');
    expect(result.currentDealerRef).toBeNull();
  });

  it('should write customer_selected and vehicle_selected when dealerRef is null, but NOT write dealer_loaded', async () => {
    const interaction = makeInteraction({ status: 'IDENTIFYING' });
    mockFindInteractionById.mockResolvedValue(interaction);

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    const updated = makeInteraction({
      status: 'CONTEXT_CONFIRMED',
      current_customer_ref: 'CUST-001',
      current_vehicle_ref: 'VEH-001',
      current_dealer_ref: null,
    });
    mockUpdateInteractionContext.mockResolvedValue(updated);

    await updateInteractionContextService(
      INTERACTION_ID,
      USER_ID,
      { customerRef: 'CUST-001', vehicleRef: 'VEH-001', dealerRef: null, isReselection: false },
      CORRELATION_ID,
    );

    const auditCalls = mockWriteAuditEvent.mock.calls.map(
      (c: unknown[]) => (c[0] as { eventName: string }).eventName,
    );
    expect(auditCalls).toContain('customer_selected');
    expect(auditCalls).toContain('vehicle_selected');
    // dealer_loaded must NOT be written when dealerRef is null
    expect(auditCalls).not.toContain('dealer_loaded');
  });

  it('should transition to CONTEXT_CONFIRMED status even when dealerRef is null', async () => {
    const interaction = makeInteraction({ status: 'IDENTIFYING' });
    mockFindInteractionById.mockResolvedValue(interaction);

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    const updated = makeInteraction({
      status: 'CONTEXT_CONFIRMED',
      current_customer_ref: 'CUST-001',
      current_vehicle_ref: 'VEH-002',
      current_dealer_ref: null,
    });
    mockUpdateInteractionContext.mockResolvedValue(updated);

    const result = await updateInteractionContextService(
      INTERACTION_ID,
      USER_ID,
      { customerRef: 'CUST-001', vehicleRef: 'VEH-002', dealerRef: null, isReselection: false },
      CORRELATION_ID,
    );

    expect(result.status).toBe('CONTEXT_CONFIRMED');
  });
});

// ---------------------------------------------------------------------------
// saveWrapupService
// ---------------------------------------------------------------------------

describe('saveWrapupService', () => {
  const validWrapupInput = {
    contactReasonCode: 'query',
    identificationOutcomeCode: 'customer_vehicle_identified',
    interactionDispositionCode: 'information_provided',
    remarks: undefined,
  };

  function mockReferenceValues(remarksRequired = false) {
    mockFindReferenceValue
      .mockResolvedValueOnce({ code: 'query', metadata: null })
      .mockResolvedValueOnce({ code: 'customer_vehicle_identified', metadata: null })
      .mockResolvedValueOnce({
        code: 'information_provided',
        metadata: remarksRequired ? { remarksRequired: true } : null,
      });
  }

  it('should allow wrapup save when interaction is in CONTEXT_CONFIRMED status', async () => {
    const interaction = makeInteraction({ status: 'CONTEXT_CONFIRMED' });
    mockFindInteractionById.mockResolvedValue(interaction);
    mockReferenceValues();

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    const wrapupRow = makeWrapup();
    mockUpsertWrapup.mockResolvedValue(wrapupRow);

    const result = await saveWrapupService(
      INTERACTION_ID, USER_ID, validWrapupInput, CORRELATION_ID,
    );

    expect(result.status).toBe('WRAPUP');
    expect(result.wrapup.contactReasonCode).toBe('query');
  });

  it('should allow wrapup save when interaction is already in WRAPUP status', async () => {
    const interaction = makeInteraction({ status: 'WRAPUP' });
    mockFindInteractionById.mockResolvedValue(interaction);
    mockReferenceValues();

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    const wrapupRow = makeWrapup();
    mockUpsertWrapup.mockResolvedValue(wrapupRow);

    const result = await saveWrapupService(
      INTERACTION_ID, USER_ID, validWrapupInput, CORRELATION_ID,
    );

    expect(result.status).toBe('WRAPUP');
    // Should not call transitionToWrapup again when already in WRAPUP
    expect(mockTransitionToWrapup).not.toHaveBeenCalled();
  });

  it('should allow wrapup save when interaction is in IDENTIFYING status', async () => {
    const interaction = makeInteraction({ status: 'IDENTIFYING' });
    mockFindInteractionById.mockResolvedValue(interaction);
    mockReferenceValues();

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    const wrapupRow = makeWrapup();
    mockUpsertWrapup.mockResolvedValue(wrapupRow);

    await saveWrapupService(INTERACTION_ID, USER_ID, validWrapupInput, CORRELATION_ID);

    expect(mockTransitionToWrapup).toHaveBeenCalled();
  });

  it('should throw 422 when interaction is in CLOSED status', async () => {
    const interaction = makeInteraction({ status: 'CLOSED' });
    mockFindInteractionById.mockResolvedValue(interaction);

    await expect(
      saveWrapupService(INTERACTION_ID, USER_ID, validWrapupInput, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should throw 422 when interaction is in INCOMPLETE status', async () => {
    const interaction = makeInteraction({ status: 'INCOMPLETE' });
    mockFindInteractionById.mockResolvedValue(interaction);

    await expect(
      saveWrapupService(INTERACTION_ID, USER_ID, validWrapupInput, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should throw 422 when remarks are required for disposition but remarks are blank', async () => {
    const interaction = makeInteraction({ status: 'CONTEXT_CONFIRMED' });
    mockFindInteractionById.mockResolvedValue(interaction);

    // Disposition: no_match_found requires remarks
    mockFindReferenceValue
      .mockResolvedValueOnce({ code: 'query', metadata: null })
      .mockResolvedValueOnce({ code: 'no_verified_match', metadata: null })
      .mockResolvedValueOnce({ code: 'no_match_found', metadata: { remarksRequired: true } });

    await expect(
      saveWrapupService(
        INTERACTION_ID,
        USER_ID,
        {
          contactReasonCode: 'query',
          identificationOutcomeCode: 'no_verified_match',
          interactionDispositionCode: 'no_match_found',
          remarks: '',
        },
        CORRELATION_ID,
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: 'Enter remarks for the selected disposition.',
    });
  });

  it('should throw 422 for no_match_found disposition with whitespace-only remarks', async () => {
    const interaction = makeInteraction({ status: 'CONTEXT_CONFIRMED' });
    mockFindInteractionById.mockResolvedValue(interaction);

    mockFindReferenceValue
      .mockResolvedValueOnce({ code: 'query', metadata: null })
      .mockResolvedValueOnce({ code: 'no_verified_match', metadata: null })
      .mockResolvedValueOnce({ code: 'no_match_found', metadata: { remarksRequired: true } });

    await expect(
      saveWrapupService(
        INTERACTION_ID,
        USER_ID,
        {
          contactReasonCode: 'query',
          identificationOutcomeCode: 'no_verified_match',
          interactionDispositionCode: 'no_match_found',
          remarks: '   ',
        },
        CORRELATION_ID,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it.each([
    ['no_match_found'],
    ['technical_issue'],
    ['abusive_caller'],
    ['incomplete_interaction'],
    ['others'],
  ])(
    'should throw 422 when remarks are blank for mandatory-remarks disposition: %s',
    async (dispositionCode: string) => {
      const interaction = makeInteraction({ status: 'CONTEXT_CONFIRMED' });
      mockFindInteractionById.mockResolvedValue(interaction);

      mockFindReferenceValue
        .mockResolvedValueOnce({ code: 'query', metadata: null })
        .mockResolvedValueOnce({ code: 'customer_vehicle_identified', metadata: null })
        .mockResolvedValueOnce({ code: dispositionCode, metadata: { remarksRequired: true } });

      await expect(
        saveWrapupService(
          INTERACTION_ID,
          USER_ID,
          {
            contactReasonCode: 'query',
            identificationOutcomeCode: 'customer_vehicle_identified',
            interactionDispositionCode: dispositionCode,
            remarks: undefined,
          },
          CORRELATION_ID,
        ),
      ).rejects.toMatchObject({ statusCode: 422 });
    },
  );

  it('should throw 422 when contact reason code does not exist in reference_values', async () => {
    const interaction = makeInteraction({ status: 'CONTEXT_CONFIRMED' });
    mockFindInteractionById.mockResolvedValue(interaction);

    mockFindReferenceValue
      .mockResolvedValueOnce(null) // invalid contact reason
      .mockResolvedValueOnce({ code: 'customer_vehicle_identified', metadata: null })
      .mockResolvedValueOnce({ code: 'information_provided', metadata: null });

    await expect(
      saveWrapupService(
        INTERACTION_ID,
        USER_ID,
        { ...validWrapupInput, contactReasonCode: 'invalid_code' },
        CORRELATION_ID,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should write disposition_saved audit event after saving wrapup', async () => {
    const interaction = makeInteraction({ status: 'CONTEXT_CONFIRMED' });
    mockFindInteractionById.mockResolvedValue(interaction);
    mockReferenceValues();

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    mockUpsertWrapup.mockResolvedValue(makeWrapup());

    await saveWrapupService(INTERACTION_ID, USER_ID, validWrapupInput, CORRELATION_ID);

    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'disposition_saved' }),
      expect.anything(),
    );
  });
});

// ---------------------------------------------------------------------------
// closeInteractionService
// ---------------------------------------------------------------------------

describe('closeInteractionService', () => {
  it('should close interaction when it is in WRAPUP status with valid wrapup', async () => {
    const interaction = makeInteraction({ status: 'WRAPUP' });
    mockFindInteractionById.mockResolvedValue(interaction);

    const wrapup = makeWrapup({ interaction_disposition_code: 'information_provided' });
    mockFindWrapupByInteractionId.mockResolvedValue(wrapup);

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    const closedRow = makeInteraction({
      status: 'CLOSED',
      ended_at: new Date('2026-03-22T11:00:00Z'),
      completion_flag: true,
    });
    mockCloseInteraction.mockResolvedValue(closedRow);

    const result = await closeInteractionService(INTERACTION_ID, USER_ID, CORRELATION_ID);

    expect(result.status).toBe('CLOSED');
    expect(result.completionFlag).toBe(true);
    expect(result.endedAt).toBeDefined();
  });

  it('should throw 422 when trying to close from IDENTIFYING status', async () => {
    const interaction = makeInteraction({ status: 'IDENTIFYING' });
    mockFindInteractionById.mockResolvedValue(interaction);

    await expect(
      closeInteractionService(INTERACTION_ID, USER_ID, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should throw 422 when trying to close from CONTEXT_CONFIRMED status', async () => {
    const interaction = makeInteraction({ status: 'CONTEXT_CONFIRMED' });
    mockFindInteractionById.mockResolvedValue(interaction);

    await expect(
      closeInteractionService(INTERACTION_ID, USER_ID, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should throw 422 when trying to close from NEW status', async () => {
    const interaction = makeInteraction({ status: 'NEW' });
    mockFindInteractionById.mockResolvedValue(interaction);

    await expect(
      closeInteractionService(INTERACTION_ID, USER_ID, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should throw 422 when trying to close an already CLOSED interaction', async () => {
    const interaction = makeInteraction({ status: 'CLOSED' });
    mockFindInteractionById.mockResolvedValue(interaction);

    await expect(
      closeInteractionService(INTERACTION_ID, USER_ID, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should throw 422 when trying to close an INCOMPLETE interaction', async () => {
    const interaction = makeInteraction({ status: 'INCOMPLETE' });
    mockFindInteractionById.mockResolvedValue(interaction);

    await expect(
      closeInteractionService(INTERACTION_ID, USER_ID, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should throw 422 when wrapup record does not exist at close time', async () => {
    const interaction = makeInteraction({ status: 'WRAPUP' });
    mockFindInteractionById.mockResolvedValue(interaction);
    mockFindWrapupByInteractionId.mockResolvedValue(null);

    await expect(
      closeInteractionService(INTERACTION_ID, USER_ID, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should throw 422 when wrapup disposition is incomplete_interaction (use /incomplete endpoint)', async () => {
    const interaction = makeInteraction({ status: 'WRAPUP' });
    mockFindInteractionById.mockResolvedValue(interaction);
    const wrapup = makeWrapup({ interaction_disposition_code: 'incomplete_interaction' });
    mockFindWrapupByInteractionId.mockResolvedValue(wrapup);

    await expect(
      closeInteractionService(INTERACTION_ID, USER_ID, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should write interaction_closed audit event on successful closure', async () => {
    const interaction = makeInteraction({ status: 'WRAPUP' });
    mockFindInteractionById.mockResolvedValue(interaction);
    const wrapup = makeWrapup({ interaction_disposition_code: 'information_provided' });
    mockFindWrapupByInteractionId.mockResolvedValue(wrapup);

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    mockCloseInteraction.mockResolvedValue(
      makeInteraction({ status: 'CLOSED', ended_at: new Date(), completion_flag: true }),
    );

    await closeInteractionService(INTERACTION_ID, USER_ID, CORRELATION_ID);

    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'interaction_closed' }),
      expect.anything(),
    );
  });
});

// ---------------------------------------------------------------------------
// markIncompleteService
// ---------------------------------------------------------------------------

describe('markIncompleteService', () => {
  it('should mark interaction incomplete when in WRAPUP status with incomplete_interaction disposition and remarks', async () => {
    const interaction = makeInteraction({ status: 'WRAPUP' });
    mockFindInteractionById.mockResolvedValue(interaction);

    const wrapup = makeWrapup({
      interaction_disposition_code: 'incomplete_interaction',
      remarks: 'Customer could not be identified',
    });
    mockFindWrapupByInteractionId.mockResolvedValue(wrapup);

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    const incompleteRow = makeInteraction({
      status: 'INCOMPLETE',
      ended_at: new Date('2026-03-22T11:00:00Z'),
      completion_flag: false,
    });
    mockMarkInteractionIncomplete.mockResolvedValue(incompleteRow);

    const result = await markIncompleteService(INTERACTION_ID, USER_ID, CORRELATION_ID);

    expect(result.status).toBe('INCOMPLETE');
    expect(result.completionFlag).toBe(false);
    expect(result.endedAt).toBeDefined();
  });

  it('should throw 422 when trying to mark incomplete from IDENTIFYING status', async () => {
    const interaction = makeInteraction({ status: 'IDENTIFYING' });
    mockFindInteractionById.mockResolvedValue(interaction);

    await expect(
      markIncompleteService(INTERACTION_ID, USER_ID, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should throw 422 when trying to mark incomplete from CONTEXT_CONFIRMED status', async () => {
    const interaction = makeInteraction({ status: 'CONTEXT_CONFIRMED' });
    mockFindInteractionById.mockResolvedValue(interaction);

    await expect(
      markIncompleteService(INTERACTION_ID, USER_ID, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should throw 422 when trying to mark incomplete from CLOSED status', async () => {
    const interaction = makeInteraction({ status: 'CLOSED' });
    mockFindInteractionById.mockResolvedValue(interaction);

    await expect(
      markIncompleteService(INTERACTION_ID, USER_ID, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should throw 422 when wrapup record does not exist', async () => {
    const interaction = makeInteraction({ status: 'WRAPUP' });
    mockFindInteractionById.mockResolvedValue(interaction);
    mockFindWrapupByInteractionId.mockResolvedValue(null);

    await expect(
      markIncompleteService(INTERACTION_ID, USER_ID, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should throw 422 when wrapup disposition is not incomplete_interaction', async () => {
    const interaction = makeInteraction({ status: 'WRAPUP' });
    mockFindInteractionById.mockResolvedValue(interaction);
    const wrapup = makeWrapup({ interaction_disposition_code: 'information_provided' });
    mockFindWrapupByInteractionId.mockResolvedValue(wrapup);

    await expect(
      markIncompleteService(INTERACTION_ID, USER_ID, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should throw 422 when remarks are empty (defense-in-depth check)', async () => {
    const interaction = makeInteraction({ status: 'WRAPUP' });
    mockFindInteractionById.mockResolvedValue(interaction);

    const wrapup = makeWrapup({
      interaction_disposition_code: 'incomplete_interaction',
      remarks: '',
    });
    mockFindWrapupByInteractionId.mockResolvedValue(wrapup);

    await expect(
      markIncompleteService(INTERACTION_ID, USER_ID, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422, message: 'Enter remarks for incomplete interaction.' });
  });

  it('should throw 422 when remarks are whitespace-only', async () => {
    const interaction = makeInteraction({ status: 'WRAPUP' });
    mockFindInteractionById.mockResolvedValue(interaction);

    const wrapup = makeWrapup({
      interaction_disposition_code: 'incomplete_interaction',
      remarks: '   ',
    });
    mockFindWrapupByInteractionId.mockResolvedValue(wrapup);

    await expect(
      markIncompleteService(INTERACTION_ID, USER_ID, CORRELATION_ID),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should write interaction_marked_incomplete audit event on success', async () => {
    const interaction = makeInteraction({ status: 'WRAPUP' });
    mockFindInteractionById.mockResolvedValue(interaction);

    const wrapup = makeWrapup({
      interaction_disposition_code: 'incomplete_interaction',
      remarks: 'Could not verify customer',
    });
    mockFindWrapupByInteractionId.mockResolvedValue(wrapup);

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    mockMarkInteractionIncomplete.mockResolvedValue(
      makeInteraction({ status: 'INCOMPLETE', ended_at: new Date(), completion_flag: false }),
    );

    await markIncompleteService(INTERACTION_ID, USER_ID, CORRELATION_ID);

    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'interaction_marked_incomplete' }),
      expect.anything(),
    );
  });

  // Fix HIGH-2: CTI auto-reset tests for markIncompleteService
  it('marks interaction INCOMPLETE and auto-resets CTI agent to ready_for_calls', async () => {
    const interaction = makeInteraction({ status: 'WRAPUP', started_by_user_id: USER_ID });
    mockFindInteractionById.mockResolvedValue(interaction);

    const wrapup = makeWrapup({
      interaction_disposition_code: 'incomplete_interaction',
      remarks: 'Could not verify customer',
    });
    mockFindWrapupByInteractionId.mockResolvedValue(wrapup);

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    const incompleteRow = makeInteraction({
      status: 'INCOMPLETE',
      ended_at: new Date('2026-03-22T11:00:00Z'),
      completion_flag: false,
      started_by_user_id: USER_ID,
    });
    mockMarkInteractionIncomplete.mockResolvedValue(incompleteRow);

    // Agent is in CTI mode and currently in wrap_up
    mockFindUserById.mockResolvedValue({
      id: USER_ID,
      session_mode: 'cti',
      username: 'agent1',
      display_name: 'Agent One',
      password_hash: 'hash',
      is_active: true,
    });
    mockGetAgentStatusByUserId.mockResolvedValue({
      user_id: USER_ID,
      status_code: 'wrap_up',
      previous_status_code: null,
      changed_at: new Date(),
      changed_by_user_id: 'system',
      correlation_id: null,
    });
    mockSetSystemStatus.mockResolvedValue(undefined);

    const result = await markIncompleteService(INTERACTION_ID, USER_ID, CORRELATION_ID);

    expect(result.status).toBe('INCOMPLETE');
    expect(result.completionFlag).toBe(false);
    expect(mockFindUserById).toHaveBeenCalledWith(USER_ID);
    expect(mockGetAgentStatusByUserId).toHaveBeenCalledWith(USER_ID);
    expect(mockSetSystemStatus).toHaveBeenCalledWith(USER_ID, 'ready_for_calls', CORRELATION_ID);
  });

  it('marks interaction INCOMPLETE but does NOT auto-reset if agent session_mode = manual', async () => {
    const interaction = makeInteraction({ status: 'WRAPUP', started_by_user_id: USER_ID });
    mockFindInteractionById.mockResolvedValue(interaction);

    const wrapup = makeWrapup({
      interaction_disposition_code: 'incomplete_interaction',
      remarks: 'Customer unavailable',
    });
    mockFindWrapupByInteractionId.mockResolvedValue(wrapup);

    const mockClient = makeMockClient();
    (getPool as MockedFunction<typeof getPool>).mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as ReturnType<typeof getPool>);

    const incompleteRow = makeInteraction({
      status: 'INCOMPLETE',
      ended_at: new Date('2026-03-22T11:00:00Z'),
      completion_flag: false,
      started_by_user_id: USER_ID,
    });
    mockMarkInteractionIncomplete.mockResolvedValue(incompleteRow);

    // Agent is in manual mode — auto-reset must NOT fire
    mockFindUserById.mockResolvedValue({
      id: USER_ID,
      session_mode: 'manual',
      username: 'agent1',
      display_name: 'Agent One',
      password_hash: 'hash',
      is_active: true,
    });
    mockGetAgentStatusByUserId.mockResolvedValue({
      user_id: USER_ID,
      status_code: 'wrap_up',
      previous_status_code: null,
      changed_at: new Date(),
      changed_by_user_id: 'system',
      correlation_id: null,
    });
    mockSetSystemStatus.mockResolvedValue(undefined);

    const result = await markIncompleteService(INTERACTION_ID, USER_ID, CORRELATION_ID);

    expect(result.status).toBe('INCOMPLETE');
    // setSystemStatus must NOT have been called for a manual-mode agent
    expect(mockSetSystemStatus).not.toHaveBeenCalled();
  });
});
