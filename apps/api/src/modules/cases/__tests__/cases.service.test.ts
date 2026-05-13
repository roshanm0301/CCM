// =============================================================================
// CCM API — Cases Service Unit Tests
//
// Tests all business logic in isolation by mocking the repository layer.
// Source: CCM Phase 4 Case Creation Workspace spec.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the repository module before importing the service
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

vi.mock('../cases.repository', () => ({
  findCasesByCustomerRef: vi.fn(),
  countOpenCases: vi.fn(),
  findCaseById: vi.fn(),
  findCaseByInteractionId: vi.fn(),
  findDuplicateCase: vi.fn(),
  createCase: vi.fn(),
  generateCaseId: vi.fn(),
}));

vi.mock('../../audit/audit.repository', () => ({
  writeAuditEvent: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks for getCaseDetailService dependencies:
//   - CaseModel.findOne (mongoose model — lean query)
//   - DealerModel.findOne (mongoose model — lean query)
//   - getPool (PostgreSQL client)
// ---------------------------------------------------------------------------

const mockCaseModelFindOne = vi.fn();
const mockDealerModelFindOne = vi.fn();

vi.mock('../../../shared/models/case.model', () => ({
  CaseModel: {
    findOne: (...args: unknown[]) => mockCaseModelFindOne(...args),
  },
}));

vi.mock('../../../shared/models/dealer.model', () => ({
  DealerModel: {
    findOne: (...args: unknown[]) => mockDealerModelFindOne(...args),
  },
}));

// Mock getPool — returns a fake pg Pool whose query() can be controlled per test
const mockPoolQuery = vi.fn();

vi.mock('../../../shared/database/postgres', () => ({
  getPool: () => ({ query: mockPoolQuery }),
}));

// Mock cases-dealer.repository (imported by cases.service but not under test here)
vi.mock('../cases-dealer.repository', () => ({
  findCasesForDealer: vi.fn(),
}));

import * as repo from '../cases.repository';
import * as auditRepo from '../../audit/audit.repository';
import {
  getCaseHistoryService,
  duplicateCheckService,
  createCaseService,
  getCaseByIdService,
  getCaseByInteractionIdService,
  getCaseDetailService,
} from '../cases.service';
import { AppError } from '../../../shared/errors/AppError';
import { Types } from 'mongoose';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockFindCasesByCustomerRef = repo.findCasesByCustomerRef as MockedFunction<typeof repo.findCasesByCustomerRef>;
const mockCountOpenCases = repo.countOpenCases as MockedFunction<typeof repo.countOpenCases>;
const mockFindCaseById = repo.findCaseById as MockedFunction<typeof repo.findCaseById>;
const mockFindCaseByInteractionId = repo.findCaseByInteractionId as MockedFunction<typeof repo.findCaseByInteractionId>;
const mockFindDuplicateCase = repo.findDuplicateCase as MockedFunction<typeof repo.findDuplicateCase>;
const mockCreateCase = repo.createCase as MockedFunction<typeof repo.createCase>;
const mockWriteAuditEvent = auditRepo.writeAuditEvent as MockedFunction<typeof auditRepo.writeAuditEvent>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OBJECT_ID_1 = new Types.ObjectId('507f1f77bcf86cd799439011');
const OBJECT_ID_DEALER = new Types.ObjectId('507f1f77bcf86cd799439020');
const OBJECT_ID_CAT = new Types.ObjectId('507f1f77bcf86cd799439030');
const OBJECT_ID_SUBCAT = new Types.ObjectId('507f1f77bcf86cd799439040');

const REGISTERED_AT = new Date('2026-03-20T10:00:00.000Z');
const CREATED_AT = new Date('2026-03-20T10:00:00.000Z');
const UPDATED_AT = new Date('2026-03-20T10:05:00.000Z');

/** A minimal ICase-shaped plain object (lean result) */
function makeCaseDoc(overrides?: Record<string, unknown>) {
  return {
    _id: OBJECT_ID_1,
    caseId: 'ISR-001',
    interactionId: '550e8400-e29b-41d4-a716-446655440000',
    customerRef: 'CUST-001',
    vehicleRef: 'VH-001',
    dealerRef: OBJECT_ID_DEALER,
    caseNature: 'Complaint',
    department: 'Sales',
    priority: 'High',
    productType: 'Motorcycle',
    productTypeSource: 'Derived' as const,
    caseCategoryId: OBJECT_ID_CAT,
    caseSubcategoryId: OBJECT_ID_SUBCAT,
    customerRemarks: 'Customer is not happy',
    agentRemarks: 'Escalated to manager',
    caseStatus: 'Open' as const,
    activityStatus: 'Fresh' as const,
    createdBy: 'user-001',
    registeredAt: REGISTERED_AT,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

const VALID_CREATE_INPUT = {
  interactionId: '550e8400-e29b-41d4-a716-446655440000',
  customerRef: 'CUST-001',
  vehicleRef: 'VH-001',
  caseNature: 'Complaint',
  department: 'Sales',
  priority: 'High',
  productType: 'Motorcycle',
  productTypeSource: 'Derived' as const,
  caseCategoryId: '507f1f77bcf86cd799439030',
  caseSubcategoryId: '507f1f77bcf86cd799439040',
  customerRemarks: 'Customer is not happy',
  agentRemarks: 'Escalated to manager',
  dealerRef: '507f1f77bcf86cd799439020',
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// createCaseService
// ---------------------------------------------------------------------------

describe('createCaseService', () => {
  it('happy path: calls createCase repository and returns mapped DTO with ISR-XXX caseId', async () => {
    const doc = makeCaseDoc();
    mockCreateCase.mockResolvedValue(doc as never);

    const result = await createCaseService(VALID_CREATE_INPUT, 'user-001');

    expect(mockCreateCase).toHaveBeenCalledWith(VALID_CREATE_INPUT, 'user-001');
    expect(result.caseId).toBe('ISR-001');
    expect(result.id).toBe(OBJECT_ID_1.toString());
    expect(result.interactionId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.customerRef).toBe('CUST-001');
    expect(result.caseStatus).toBe('Open');
    expect(result.activityStatus).toBe('Fresh');
  });

  it('DTO contains all required mapped fields', async () => {
    const doc = makeCaseDoc();
    mockCreateCase.mockResolvedValue(doc as never);

    const result = await createCaseService(VALID_CREATE_INPUT, 'user-001');

    expect(result.dealerRef).toBe(OBJECT_ID_DEALER.toString());
    expect(result.caseCategoryId).toBe(OBJECT_ID_CAT.toString());
    expect(result.caseSubcategoryId).toBe(OBJECT_ID_SUBCAT.toString());
    expect(result.productType).toBe('Motorcycle');
    expect(result.productTypeSource).toBe('Derived');
    expect(result.registeredAt).toBe(REGISTERED_AT.toISOString());
    expect(result.createdAt).toBe(CREATED_AT.toISOString());
    expect(result.updatedAt).toBe(UPDATED_AT.toISOString());
  });

  it('throws 409 CONFLICT when repository throws AppError.conflict (1-per-interaction enforcement)', async () => {
    mockCreateCase.mockRejectedValue(
      AppError.conflict('A case has already been registered for this interaction'),
    );

    await expect(createCaseService(VALID_CREATE_INPUT, 'user-001')).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: expect.stringContaining('already been registered'),
    });
  });

  it('bubbles up conflict error when repository signals duplicate interaction', async () => {
    const conflictError = AppError.conflict('A case has already been registered for this interaction');
    mockCreateCase.mockRejectedValue(conflictError);

    await expect(createCaseService(VALID_CREATE_INPUT, 'user-001')).rejects.toBe(conflictError);
  });

  it('maps vehicleRef to null when it is null on the document', async () => {
    const doc = makeCaseDoc({ vehicleRef: null });
    mockCreateCase.mockResolvedValue(doc as never);

    const result = await createCaseService(VALID_CREATE_INPUT, 'user-001');

    expect(result.vehicleRef).toBeNull();
  });

  it('maps priority to null when it is null on the document', async () => {
    const doc = makeCaseDoc({ priority: null });
    mockCreateCase.mockResolvedValue(doc as never);

    const result = await createCaseService(VALID_CREATE_INPUT, 'user-001');

    expect(result.priority).toBeNull();
  });

  it('calls writeAuditEvent with eventName case_created after successful creation', async () => {
    const doc = makeCaseDoc();
    mockCreateCase.mockResolvedValue(doc as never);
    mockWriteAuditEvent.mockResolvedValue(undefined);

    await createCaseService(VALID_CREATE_INPUT, 'user-001');

    expect(mockWriteAuditEvent).toHaveBeenCalledOnce();
    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'case_created',
        interactionId: VALID_CREATE_INPUT.interactionId,
        actorUserId: 'user-001',
        eventPayload: expect.objectContaining({
          caseId: 'ISR-001',
          caseNature: 'Complaint',
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// getCaseHistoryService
// ---------------------------------------------------------------------------

describe('getCaseHistoryService', () => {
  it('happy path: returns array of case history items for a given customerRef', async () => {
    const doc = makeCaseDoc();
    mockFindCasesByCustomerRef.mockResolvedValue([doc] as never);
    mockCountOpenCases.mockResolvedValue(1);

    const result = await getCaseHistoryService('CUST-001');

    expect(mockFindCasesByCustomerRef).toHaveBeenCalledWith('CUST-001');
    expect(mockCountOpenCases).toHaveBeenCalledWith('CUST-001');
    expect(result.cases).toHaveLength(1);
    expect(result.openCaseCount).toBe(1);
  });

  it('returns empty array when no cases found', async () => {
    mockFindCasesByCustomerRef.mockResolvedValue([]);
    mockCountOpenCases.mockResolvedValue(0);

    const result = await getCaseHistoryService('CUST-NONE');

    expect(result.cases).toHaveLength(0);
    expect(result.openCaseCount).toBe(0);
  });

  it('maps all required fields: id, caseId, caseStatus, activityStatus, caseNature, registeredAt', async () => {
    const doc = makeCaseDoc();
    mockFindCasesByCustomerRef.mockResolvedValue([doc] as never);
    mockCountOpenCases.mockResolvedValue(1);

    const result = await getCaseHistoryService('CUST-001');

    const item = result.cases[0];
    expect(item.id).toBe(OBJECT_ID_1.toString());
    expect(item.caseId).toBe('ISR-001');
    expect(item.caseStatus).toBe('Open');
    expect(item.activityStatus).toBe('Fresh');
    expect(item.caseNature).toBe('Complaint');
    expect(item.registeredAt).toBe(REGISTERED_AT.toISOString());
  });

  it('runs findCasesByCustomerRef and countOpenCases in parallel', async () => {
    mockFindCasesByCustomerRef.mockResolvedValue([]);
    mockCountOpenCases.mockResolvedValue(0);

    await getCaseHistoryService('CUST-001');

    // Both mocks must have been called exactly once
    expect(mockFindCasesByCustomerRef).toHaveBeenCalledTimes(1);
    expect(mockCountOpenCases).toHaveBeenCalledTimes(1);
  });

  it('returns multiple cases in the order returned by the repository', async () => {
    const doc1 = makeCaseDoc({ caseId: 'ISR-003', _id: new Types.ObjectId('507f1f77bcf86cd799439011') });
    const doc2 = makeCaseDoc({ caseId: 'ISR-002', _id: new Types.ObjectId('507f1f77bcf86cd799439012') });
    mockFindCasesByCustomerRef.mockResolvedValue([doc1, doc2] as never);
    mockCountOpenCases.mockResolvedValue(2);

    const result = await getCaseHistoryService('CUST-001');

    expect(result.cases).toHaveLength(2);
    expect(result.cases[0].caseId).toBe('ISR-003');
    expect(result.cases[1].caseId).toBe('ISR-002');
  });
});

// ---------------------------------------------------------------------------
// duplicateCheckService
// ---------------------------------------------------------------------------

describe('duplicateCheckService', () => {
  const DUPLICATE_PARAMS = {
    customerRef: 'CUST-001',
    vehicleRef: 'VH-001',
    caseNature: 'Complaint',
    department: 'Sales',
    caseCategoryId: '507f1f77bcf86cd799439030',
    caseSubcategoryId: '507f1f77bcf86cd799439040',
  };

  it('returns isDuplicate: true with existingCase when a matching case is found', async () => {
    const doc = makeCaseDoc();
    mockFindDuplicateCase.mockResolvedValue(doc as never);

    const result = await duplicateCheckService(DUPLICATE_PARAMS);

    expect(result.isDuplicate).toBe(true);
    expect(result.existingCase).toBeDefined();
    expect(result.existingCase!.caseId).toBe('ISR-001');
    expect(result.existingCase!.caseNature).toBe('Complaint');
    expect(result.existingCase!.documentStatus).toBe('Open');
    expect(result.existingCase!.registeredAt).toBe(REGISTERED_AT.toISOString());
  });

  it('returns isDuplicate: false when no duplicate exists', async () => {
    mockFindDuplicateCase.mockResolvedValue(null);

    const result = await duplicateCheckService(DUPLICATE_PARAMS);

    expect(result.isDuplicate).toBe(false);
    expect(result.existingCase).toBeUndefined();
  });

  it('passes all parameters to findDuplicateCase repository function', async () => {
    mockFindDuplicateCase.mockResolvedValue(null);

    await duplicateCheckService(DUPLICATE_PARAMS);

    expect(mockFindDuplicateCase).toHaveBeenCalledWith({
      customerRef: 'CUST-001',
      vehicleRef: 'VH-001',
      caseNature: 'Complaint',
      department: 'Sales',
      caseCategoryId: '507f1f77bcf86cd799439030',
      caseSubcategoryId: '507f1f77bcf86cd799439040',
    });
  });

  it('uses null for vehicleRef when vehicleRef is not provided', async () => {
    mockFindDuplicateCase.mockResolvedValue(null);

    await duplicateCheckService({
      customerRef: 'CUST-001',
      caseNature: 'Complaint',
      department: 'Sales',
      caseCategoryId: '507f1f77bcf86cd799439030',
      caseSubcategoryId: '507f1f77bcf86cd799439040',
    });

    expect(mockFindDuplicateCase).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleRef: null }),
    );
  });
});

// ---------------------------------------------------------------------------
// getCaseByIdService
// ---------------------------------------------------------------------------

describe('getCaseByIdService', () => {
  it('returns the case DTO when a document is found by MongoDB id', async () => {
    const doc = makeCaseDoc();
    mockFindCaseById.mockResolvedValue(doc as never);

    const result = await getCaseByIdService('507f1f77bcf86cd799439011');

    expect(mockFindCaseById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(result.caseId).toBe('ISR-001');
    expect(result.id).toBe(OBJECT_ID_1.toString());
  });

  it('throws 404 NOT_FOUND when no document matches the id', async () => {
    mockFindCaseById.mockResolvedValue(null);

    await expect(getCaseByIdService('507f1f77bcf86cd799439099')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });
});

// ---------------------------------------------------------------------------
// getCaseByInteractionIdService
// ---------------------------------------------------------------------------

describe('getCaseByInteractionIdService', () => {
  it('returns the case DTO when a document is found by interactionId', async () => {
    const doc = makeCaseDoc();
    mockFindCaseByInteractionId.mockResolvedValue(doc as never);

    const result = await getCaseByInteractionIdService('550e8400-e29b-41d4-a716-446655440000');

    expect(mockFindCaseByInteractionId).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
    expect(result).not.toBeNull();
    expect(result!.caseId).toBe('ISR-001');
  });

  it('returns null when no case is found for that interactionId', async () => {
    mockFindCaseByInteractionId.mockResolvedValue(null);

    const result = await getCaseByInteractionIdService('550e8400-e29b-41d4-a716-000000000000');

    expect(result).toBeNull();
  });

  it('maps the full DTO correctly when case is found', async () => {
    const doc = makeCaseDoc();
    mockFindCaseByInteractionId.mockResolvedValue(doc as never);

    const result = await getCaseByInteractionIdService('550e8400-e29b-41d4-a716-446655440000');

    expect(result!.id).toBe(OBJECT_ID_1.toString());
    expect(result!.interactionId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result!.customerRef).toBe('CUST-001');
    expect(result!.caseStatus).toBe('Open');
    expect(result!.activityStatus).toBe('Fresh');
    expect(result!.department).toBe('Sales');
    expect(result!.productType).toBe('Motorcycle');
    expect(result!.createdAt).toBe(CREATED_AT.toISOString());
  });
});

// ---------------------------------------------------------------------------
// getCaseDetailService
// ---------------------------------------------------------------------------

describe('getCaseDetailService', () => {
  /**
   * Builds the minimal lean() result that CaseModel.findOne returns.
   * Uses a string dealerRef ('DLR-001') matching the real Case schema
   * (dealerRef: { type: String }) — NOT an ObjectId.
   * The dealer lookup resolves by dealerCode, not by _id.
   */
  function makeLeanCaseDoc(overrides?: Record<string, unknown>) {
    return {
      ...makeCaseDoc({ dealerRef: 'DLR-001', ...overrides }),
    };
  }

  /** Default PostgreSQL activity-state row returned by getPool().query */
  const DEFAULT_STATE_ROW = {
    current_step_no: 1,
    template_id: 'tpl-001',
    version: 2,
  };

  /** Wire up CaseModel.findOne mock to chain .lean() */
  function setCaseFindOne(value: unknown) {
    mockCaseModelFindOne.mockReturnValue({ lean: () => Promise.resolve(value) });
  }

  /** Wire up DealerModel.findOne mock to chain .lean() */
  function setDealerFindOne(value: unknown) {
    mockDealerModelFindOne.mockReturnValue({ lean: () => Promise.resolve(value) });
  }

  beforeEach(() => {
    // Default happy path: case found, dealer found, activity state present
    setCaseFindOne(makeLeanCaseDoc());
    setDealerFindOne({ dealerCode: 'BAJ-KA-001' });
    // Discriminate by SQL: activity-state query returns DEFAULT_STATE_ROW;
    // channel query returns { channel: 'inbound_call' }.
    mockPoolQuery.mockImplementation((sql: string) => {
      if (sql.includes('case_activity_state')) {
        return Promise.resolve({ rows: [DEFAULT_STATE_ROW] });
      }
      if (sql.includes('interactions')) {
        return Promise.resolve({ rows: [{ channel: 'inbound_call' }] });
      }
      return Promise.resolve({ rows: [] });
    });
  });

  it('resolves dealerRef to dealerCode when DealerModel returns a matching dealer', async () => {
    setDealerFindOne({ dealerCode: 'BAJ-KA-001' });

    const result = await getCaseDetailService('ISR-001');

    // The raw doc has dealerRef = 'DLR-001' (a string code).
    // getCaseDetailService resolves it to the Dealer's dealerCode via DealerModel.findOne.
    expect(result.dealerRef).toBe('BAJ-KA-001');
  });

  it('falls back to the raw dealer code string when DealerModel returns null', async () => {
    setDealerFindOne(null);

    const result = await getCaseDetailService('ISR-001');

    // When no dealer document is found the service falls back to doc.dealerRef (the string code)
    expect(result.dealerRef).toBe('DLR-001');
  });

  it('falls back to the raw dealer code string when dealer document has no dealerCode', async () => {
    setDealerFindOne({ dealerCode: null });

    const result = await getCaseDetailService('ISR-001');

    expect(result.dealerRef).toBe('DLR-001');
  });

  it('returns currentStepNo, currentStepTemplateId, and activityStateVersion from PostgreSQL', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [DEFAULT_STATE_ROW] });

    const result = await getCaseDetailService('ISR-001');

    expect(result.currentStepNo).toBe(1);
    expect(result.currentStepTemplateId).toBe('tpl-001');
    expect(result.activityStateVersion).toBe(2);
  });

  it('returns null activity fields when no PostgreSQL activity state row exists', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const result = await getCaseDetailService('ISR-001');

    expect(result.currentStepNo).toBeNull();
    expect(result.currentStepTemplateId).toBeNull();
    expect(result.activityStateVersion).toBeNull();
  });

  it('throws 404 NOT_FOUND when CaseModel returns null (case not found)', async () => {
    setCaseFindOne(null);

    await expect(getCaseDetailService('ISR-MISSING')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('passes caseId to CaseModel.findOne as a filter field', async () => {
    await getCaseDetailService('ISR-001');

    expect(mockCaseModelFindOne).toHaveBeenCalledWith({ caseId: 'ISR-001' });
  });

  it('queries PostgreSQL with the caseId parameter', async () => {
    await getCaseDetailService('ISR-001');

    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('case_activity_state'),
      ['ISR-001'],
    );
  });

  it('queries DealerModel by dealerCode using the string dealerRef from the case document', async () => {
    await getCaseDetailService('ISR-001');

    // Case.dealerRef is type String (e.g. "DLR-001") — lookup must use dealerCode, NOT _id.
    // Using _id causes a CastError because Dealer._id is ObjectId and "DLR-001" is not one.
    expect(mockDealerModelFindOne).toHaveBeenCalledWith({ dealerCode: 'DLR-001' });
  });

  it('DTO contains all base CaseDto fields alongside the Phase 6 activity fields', async () => {
    const result = await getCaseDetailService('ISR-001');

    // Base CaseDto fields
    expect(result.caseId).toBe('ISR-001');
    expect(result.customerRef).toBe('CUST-001');
    expect(result.caseStatus).toBe('Open');
    expect(result.activityStatus).toBe('Fresh');
    expect(result.productType).toBe('Motorcycle');

    // Phase 6 fields
    expect(result.currentStepNo).toBe(1);
    expect(result.currentStepTemplateId).toBe('tpl-001');
    expect(result.activityStateVersion).toBe(2);
    expect(result.interactionChannel).toBe('inbound_call');
  });

  it('interactionChannel is null when interactionId is null', async () => {
    // Case document has no interactionId — channel query must be skipped.
    setCaseFindOne(makeLeanCaseDoc({ interactionId: null }));

    const result = await getCaseDetailService('ISR-001');

    expect(result.interactionChannel).toBeNull();
    // The channel query (SELECT channel FROM interactions) must NOT be issued.
    expect(mockPoolQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('SELECT channel FROM interactions'),
      expect.anything(),
    );
  });

  it('returns empty string for dealerRef when doc.dealerRef is null/undefined', async () => {
    // Simulate a case document where dealerRef was never set (null guard path).
    // The service initialises resolvedDealerRef via `doc.dealerRef?.toString() ?? ''`
    // and skips the DealerModel lookup entirely when dealerRef is falsy.
    setCaseFindOne(makeLeanCaseDoc({ dealerRef: null }));

    const result = await getCaseDetailService('ISR-001');

    expect(result.dealerRef).toBe('');
    // DealerModel must NOT be queried when dealerRef is null
    expect(mockDealerModelFindOne).not.toHaveBeenCalled();
  });

  it('channel query fails gracefully — interactionChannel is null and case detail still returns', async () => {
    // Arrange: activity-state query succeeds; channel query rejects (transient DB error).
    mockPoolQuery.mockImplementation((sql: string) => {
      if (sql.includes('case_activity_state')) {
        return Promise.resolve({ rows: [DEFAULT_STATE_ROW] });
      }
      if (sql.includes('interactions')) {
        return Promise.reject(new Error('connection timeout'));
      }
      return Promise.resolve({ rows: [] });
    });

    // Act: must NOT throw — channel failure is isolated by .catch()
    const result = await getCaseDetailService('ISR-001');

    // Assert: full DTO is present, channel degrades to null
    expect(result.interactionChannel).toBeNull();

    // Base CaseDto fields must all be present
    expect(result.caseId).toBe('ISR-001');
    expect(result.customerRef).toBe('CUST-001');
    expect(result.caseStatus).toBe('Open');
    expect(result.activityStatus).toBe('Fresh');
    expect(result.productType).toBe('Motorcycle');

    // Activity-state fields must still be resolved from the successful query
    expect(result.currentStepNo).toBe(1);
    expect(result.currentStepTemplateId).toBe('tpl-001');
    expect(result.activityStateVersion).toBe(2);
  });
});
