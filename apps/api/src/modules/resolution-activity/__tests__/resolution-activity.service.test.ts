// =============================================================================
// CCM API — Resolution Activity Service Unit Tests
//
// Tests the state machine business logic by mocking all external dependencies:
// PostgreSQL pool (including transaction client), activity-template service,
// resolution-activity repository, CaseModel, and audit repository.
//
// Covered scenarios:
//   - loadResolutionTabService: fresh case (no state row), existing state row,
//     missing start step, missing step definition
//   - saveActivityService: Loop stay-in-step, MoveForward advance, Close with
//     mandatory step validation, already-closed case, version mismatch (409),
//     role authorization, concurrent save conflict
//   - validateMandatorySteps: pure function — all mandatory met, some missing
// Source: CCM_Phase6_Resolution_Activities.md § Wave 2 Track D
// =============================================================================

import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';

// ---------------------------------------------------------------------------
// PG transaction client mock — must be defined before any imports
// ---------------------------------------------------------------------------

const mockPgClient = {
  query: vi.fn(),
  release: vi.fn(),
};

// ---------------------------------------------------------------------------
// Mock PostgreSQL pool
// ---------------------------------------------------------------------------

vi.mock('../../../shared/database/postgres', () => ({
  getPool: () => ({
    connect: vi.fn().mockResolvedValue(mockPgClient),
  }),
}));

// ---------------------------------------------------------------------------
// Mock activity-template service
// ---------------------------------------------------------------------------

vi.mock('../../activity-template/activity-template.service', () => ({
  getApplicableTemplateService: vi.fn(),
  getTemplateService: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock resolution-activity repository
// ---------------------------------------------------------------------------

vi.mock('../resolution-activity.repository', () => ({
  insertResolutionActivity: vi.fn(),
  getActivityState: vi.fn(),
  upsertActivityState: vi.fn(),
  getResolutionHistory: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock CaseModel (MongoDB)
// ---------------------------------------------------------------------------

vi.mock('../../../shared/models/case.model', () => ({
  CaseModel: {
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  },
}));

// ---------------------------------------------------------------------------
// Mock audit repository (non-fatal — failures must not break the flow)
// ---------------------------------------------------------------------------

vi.mock('../../audit/audit.repository', () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import * as templateService from '../../activity-template/activity-template.service';
import * as repo from '../resolution-activity.repository';
import {
  loadResolutionTabService,
  saveActivityService,
  validateMandatorySteps,
} from '../resolution-activity.service';
import type { ActivityTemplateFullDto, TemplateStepDto } from '../../activity-template/activity-template.service';
import type { ResolutionActivityRow, CaseActivityStateRow, UpsertResult } from '../resolution-activity.repository';
import type { SaveResolutionActivityInput } from '../resolution-activity.validator';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockGetApplicableTemplate = templateService.getApplicableTemplateService as MockedFunction<typeof templateService.getApplicableTemplateService>;
const mockGetTemplate           = templateService.getTemplateService           as MockedFunction<typeof templateService.getTemplateService>;
const mockInsertActivity        = repo.insertResolutionActivity                as MockedFunction<typeof repo.insertResolutionActivity>;
const mockGetActivityState      = repo.getActivityState                        as MockedFunction<typeof repo.getActivityState>;
const mockUpsertActivityState   = repo.upsertActivityState                     as MockedFunction<typeof repo.upsertActivityState>;
const mockGetResolutionHistory  = repo.getResolutionHistory                    as MockedFunction<typeof repo.getResolutionHistory>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const step1: TemplateStepDto = {
  stepNo:           1,
  activityId:       'act-001',
  assignedRole:     'agent',
  slaValue:         null,
  slaUnit:          null,
  weightPercentage: 50,
  isMandatory:      true,
  isStartStep:      true,
  outcomes: [
    { outcomeName: 'Loop Back',  outcomeType: 'Loop',        nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
    { outcomeName: 'Advance',    outcomeType: 'MoveForward', nextStepNo: 2,    roleOverride: null, requiresOtpVerification: false },
    { outcomeName: 'Close Case', outcomeType: 'Close',       nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
  ],
};

const step2: TemplateStepDto = {
  stepNo:           2,
  activityId:       'act-002',
  assignedRole:     'agent',
  slaValue:         null,
  slaUnit:          null,
  weightPercentage: 50,
  isMandatory:      true,
  isStartStep:      false,
  outcomes: [
    { outcomeName: 'Close Case', outcomeType: 'Close', nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
  ],
};

const mockTemplate: ActivityTemplateFullDto = {
  id:           'tmpl-001',
  templateName: 'Complaint Flow',
  appliesTo:    'complaint',
  department:   'SALES',
  productType:  'Motorcycle',
  isActive:     true,
  createdBy:    'user-001',
  updatedBy:    'user-001',
  createdAt:    '2026-01-01T00:00:00.000Z',
  updatedAt:    '2026-01-01T00:00:00.000Z',
  steps:        [step1, step2],
};

const freshActivityRow: ResolutionActivityRow = {
  id:                   'act-row-001',
  case_id:              'ISR-001',
  template_id:          'tmpl-001',
  step_no:              1,
  activity_id:          'act-001',
  outcome_name:         'Loop Back',
  outcome_type:         'Loop',
  performed_role:       'agent',
  performed_by_user_id: 'user-001',
  remarks:              'Test remark',
  attachment_ids:       '',
  created_at:           new Date('2026-01-01T00:00:00.000Z'),
};

const freshStateRow: CaseActivityStateRow = {
  case_id:         'ISR-001',
  template_id:     'tmpl-001',
  current_step_no: 1,
  case_status:     'Open',
  activity_status: 'Fresh',
  version:         1,
  last_updated_by: 'user-001',
  updated_at:      new Date('2026-01-01T00:00:00.000Z'),
};

const baseInput: SaveResolutionActivityInput = {
  caseId:      'ISR-001',
  templateId:  'tmpl-001',
  stepNo:      1,
  activityId:  'act-001',
  outcomeName: 'Loop Back',
  outcomeType: 'Loop',
  remarks:     'Test remark',
  attachmentId: undefined,
  version:     0,
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();

  // Default PG client transaction mock — handles BEGIN / COMMIT / ROLLBACK
  // and the inline history SELECT used in Close transitions.
  mockPgClient.query.mockImplementation((sql: string | unknown) => {
    const s = typeof sql === 'string' ? sql.trim() : '';
    if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') {
      return Promise.resolve({ rowCount: 0, rows: [] });
    }
    if (s.includes('FROM resolution_activities')) {
      // Close path: inline history query — default returns empty (override in tests that need rows)
      return Promise.resolve({ rows: [] });
    }
    return Promise.resolve({ rows: [] });
  });

  // Audit always succeeds by default
  vi.mocked(repo).insertResolutionActivity   = mockInsertActivity;
  vi.mocked(repo).getActivityState           = mockGetActivityState;
  vi.mocked(repo).upsertActivityState        = mockUpsertActivityState;
  vi.mocked(repo).getResolutionHistory       = mockGetResolutionHistory;
});

// ===========================================================================
// validateMandatorySteps (pure function — no mocks needed)
// ===========================================================================

describe('validateMandatorySteps', () => {
  it('all mandatory steps have history rows → returns empty array', () => {
    const steps = [step1, step2];
    const history: ResolutionActivityRow[] = [
      { ...freshActivityRow, step_no: 1 },
      { ...freshActivityRow, step_no: 2, id: 'row-002' },
    ];
    const errors = validateMandatorySteps(steps, history);
    expect(errors).toHaveLength(0);
  });

  it('mandatory step 2 has no history row → returns one error message', () => {
    const steps = [step1, step2];
    const history: ResolutionActivityRow[] = [
      { ...freshActivityRow, step_no: 1 },
    ];
    const errors = validateMandatorySteps(steps, history);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('2');
  });

  it('non-mandatory step has no history → no error for that step', () => {
    const nonMandatoryStep2 = { ...step2, isMandatory: false };
    const errors = validateMandatorySteps([step1, nonMandatoryStep2], [
      { ...freshActivityRow, step_no: 1 },
    ]);
    expect(errors).toHaveLength(0);
  });

  it('empty history, two mandatory steps → two errors', () => {
    const errors = validateMandatorySteps([step1, step2], []);
    expect(errors).toHaveLength(2);
  });
});

// ===========================================================================
// loadResolutionTabService
// ===========================================================================

describe('loadResolutionTabService', () => {
  it('fresh case (no state row) → initialises at start step with version=0', async () => {
    mockGetApplicableTemplate.mockResolvedValue(mockTemplate);
    mockGetActivityState.mockResolvedValue(null);
    mockGetResolutionHistory.mockResolvedValue([]);

    const result = await loadResolutionTabService('ISR-001', 'complaint', 'SALES', 'Motorcycle');

    expect(result.currentStepNo).toBe(1);
    expect(result.version).toBe(0);
    expect(result.caseStatus).toBe('Open');
    expect(result.activityStatus).toBe('Fresh');
    expect(result.currentActivity.activityId).toBe('act-001');
    expect(result.history).toHaveLength(0);
  });

  it('existing state row → uses stored step and version', async () => {
    const existingState: CaseActivityStateRow = {
      ...freshStateRow,
      current_step_no: 2,
      version:         3,
      case_status:     'Open',
      activity_status: 'In Progress',
    };
    mockGetApplicableTemplate.mockResolvedValue(mockTemplate);
    mockGetActivityState.mockResolvedValue(existingState);
    mockGetResolutionHistory.mockResolvedValue([freshActivityRow]);

    const result = await loadResolutionTabService('ISR-001', 'complaint', 'SALES', 'Motorcycle');

    expect(result.currentStepNo).toBe(2);
    expect(result.version).toBe(3);
    expect(result.currentActivity.activityId).toBe('act-002');
    expect(result.history).toHaveLength(1);
  });

  it('template with no start step → throws 422', async () => {
    const templateNoStart: ActivityTemplateFullDto = {
      ...mockTemplate,
      steps: [{ ...step1, isStartStep: false }],
    };
    mockGetApplicableTemplate.mockResolvedValue(templateNoStart);
    mockGetActivityState.mockResolvedValue(null);

    await expect(
      loadResolutionTabService('ISR-001', 'complaint', 'SALES', 'Motorcycle'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });
  });

  it('state row references step not in template → throws 422', async () => {
    const badState: CaseActivityStateRow = { ...freshStateRow, current_step_no: 99 };
    mockGetApplicableTemplate.mockResolvedValue(mockTemplate);
    mockGetActivityState.mockResolvedValue(badState);

    await expect(
      loadResolutionTabService('ISR-001', 'complaint', 'SALES', 'Motorcycle'),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});

// ===========================================================================
// saveActivityService — Loop
// ===========================================================================

describe('saveActivityService — Loop outcome', () => {
  it('persists activity, stays on same step, returns version incremented', async () => {
    mockGetTemplate.mockResolvedValue(mockTemplate);
    mockGetActivityState.mockResolvedValue(null);          // version 0 (first save)
    mockInsertActivity.mockResolvedValue(freshActivityRow);
    mockUpsertActivityState.mockResolvedValue({ status: 'inserted', row: { ...freshStateRow, version: 1 } } satisfies UpsertResult);

    const result = await saveActivityService(
      { ...baseInput, outcomeName: 'Loop Back', outcomeType: 'Loop', version: 0 },
      'user-001',
      ['agent'],
      'test-corr-001',
    );

    expect(result.caseClosed).toBe(false);
    expect(result.updatedState.currentStepNo).toBe(1);
    expect(result.updatedState.version).toBe(1);
    expect(mockInsertActivity).toHaveBeenCalledTimes(1);
    expect(mockUpsertActivityState).toHaveBeenCalledTimes(1);
  });

  it('subsequent Loop save (version > 0) uses UPDATE path', async () => {
    mockGetTemplate.mockResolvedValue(mockTemplate);
    mockGetActivityState.mockResolvedValue({ ...freshStateRow, version: 2 });
    mockInsertActivity.mockResolvedValue(freshActivityRow);
    mockUpsertActivityState.mockResolvedValue({ status: 'updated', row: { ...freshStateRow, version: 3 } } satisfies UpsertResult);

    const result = await saveActivityService(
      { ...baseInput, outcomeName: 'Loop Back', outcomeType: 'Loop', version: 2 },
      'user-001',
      ['agent'],
      'test-corr-001',
    );

    expect(result.updatedState.version).toBe(3);
  });
});

// ===========================================================================
// saveActivityService — MoveForward
// ===========================================================================

describe('saveActivityService — MoveForward outcome', () => {
  it('advances to nextStepNo and sets activityStatus In Progress', async () => {
    mockGetTemplate.mockResolvedValue(mockTemplate);
    mockGetActivityState.mockResolvedValue(null);
    mockInsertActivity.mockResolvedValue({
      ...freshActivityRow, outcome_name: 'Advance', outcome_type: 'MoveForward',
    });
    mockUpsertActivityState.mockResolvedValue({ status: 'inserted', row: {
      ...freshStateRow, current_step_no: 2, activity_status: 'In Progress', version: 1,
    } } satisfies UpsertResult);

    const result = await saveActivityService(
      { ...baseInput, outcomeName: 'Advance', outcomeType: 'MoveForward', version: 0 },
      'user-001',
      ['agent'],
      'test-corr-001',
    );

    expect(result.caseClosed).toBe(false);
    expect(result.updatedState.currentStepNo).toBe(2);
    expect(result.updatedState.activityStatus).toBe('In Progress');
    const upsertCall = mockUpsertActivityState.mock.calls[0][0];
    expect(upsertCall.newStepNo).toBe(2);
  });

  it('MoveForward outcome with null nextStepNo in template → throws 422', async () => {
    const badTemplate: ActivityTemplateFullDto = {
      ...mockTemplate,
      steps: [{
        ...step1,
        outcomes: [
          { outcomeName: 'Advance', outcomeType: 'MoveForward', nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
        ],
      }],
    };
    mockGetTemplate.mockResolvedValue(badTemplate);
    mockGetActivityState.mockResolvedValue(null);

    await expect(
      saveActivityService(
        { ...baseInput, outcomeName: 'Advance', outcomeType: 'MoveForward', version: 0 },
        'user-001',
        ['agent'],
        'test-corr-001',
      ),
    ).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });
  });
});

// ===========================================================================
// saveActivityService — Close
// ===========================================================================

describe('saveActivityService — Close outcome', () => {
  it('all mandatory steps complete → closes case, sets Closed – Verified', async () => {
    // Set up: on step 1 (start), then close — but both mandatory steps must be in history
    const closingInput: SaveResolutionActivityInput = {
      ...baseInput,
      outcomeName: 'Close Case',
      outcomeType: 'Close',
      version:     0,
    };

    const historyWithBothSteps: ResolutionActivityRow[] = [
      { ...freshActivityRow, step_no: 1 },
      { ...freshActivityRow, step_no: 2, id: 'row-002' },
    ];

    mockGetTemplate.mockResolvedValue(mockTemplate);
    mockGetActivityState.mockResolvedValue(null);
    mockInsertActivity.mockResolvedValue({
      ...freshActivityRow, outcome_name: 'Close Case', outcome_type: 'Close',
    });
    // Inline history SELECT within transaction returns both steps
    mockPgClient.query.mockImplementation((sql: string | unknown) => {
      const s = typeof sql === 'string' ? sql.trim() : '';
      if (s === 'BEGIN' || s === 'COMMIT') return Promise.resolve({ rowCount: 0, rows: [] });
      if (s.includes('FROM resolution_activities')) {
        return Promise.resolve({ rows: historyWithBothSteps });
      }
      return Promise.resolve({ rows: [] });
    });
    mockUpsertActivityState.mockResolvedValue({ status: 'inserted', row: {
      ...freshStateRow,
      case_status:     'Closed \u2013 Verified',
      activity_status: 'Resolved',
      version:         1,
    } } satisfies UpsertResult);

    const result = await saveActivityService(closingInput, 'user-001', ['agent'], 'test-corr-001');

    expect(result.caseClosed).toBe(true);
    expect(result.updatedState.caseStatus).toBe('Closed \u2013 Verified');
    expect(result.updatedState.activityStatus).toBe('Resolved');
  });

  it('mandatory step 2 not completed → throws 422 with details', async () => {
    const closingInput: SaveResolutionActivityInput = {
      ...baseInput,
      outcomeName: 'Close Case',
      outcomeType: 'Close',
      version:     0,
    };

    mockGetTemplate.mockResolvedValue(mockTemplate);
    mockGetActivityState.mockResolvedValue(null);
    mockInsertActivity.mockResolvedValue({
      ...freshActivityRow, outcome_name: 'Close Case', outcome_type: 'Close',
    });
    // History missing step 2
    mockPgClient.query.mockImplementation((sql: string | unknown) => {
      const s = typeof sql === 'string' ? sql.trim() : '';
      if (s === 'BEGIN' || s === 'ROLLBACK') return Promise.resolve({ rowCount: 0, rows: [] });
      if (s.includes('FROM resolution_activities')) {
        return Promise.resolve({ rows: [{ ...freshActivityRow, step_no: 1 }] });
      }
      return Promise.resolve({ rows: [] });
    });

    await expect(
      saveActivityService(closingInput, 'user-001', ['agent'], 'test-corr-001'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });

    expect(mockPgClient.query).toHaveBeenCalledWith(
      expect.stringContaining('ROLLBACK'),
    );
  });

  it('already closed case → throws 422 before transaction starts', async () => {
    mockGetTemplate.mockResolvedValue(mockTemplate);
    mockGetActivityState.mockResolvedValue({
      ...freshStateRow,
      case_status: 'Closed \u2013 Verified',
      version:     5,
    });

    await expect(
      saveActivityService(
        { ...baseInput, outcomeName: 'Close Case', outcomeType: 'Close', version: 5 },
        'user-001',
        ['agent'],
        'test-corr-001',
      ),
    ).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });

    expect(mockInsertActivity).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// saveActivityService — version conflict (optimistic lock)
// ===========================================================================

describe('saveActivityService — optimistic locking', () => {
  it('stale version (input.version !== stored version) → throws 409 before transaction', async () => {
    mockGetTemplate.mockResolvedValue(mockTemplate);
    mockGetActivityState.mockResolvedValue({ ...freshStateRow, version: 3 }); // stored = 3

    await expect(
      saveActivityService(
        { ...baseInput, version: 2 }, // client thinks it's 2 — stale
        'user-001',
        ['agent'],
        'test-corr-001',
      ),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mockInsertActivity).not.toHaveBeenCalled();
  });

  it('concurrent write (upsertActivityState returns null) → throws 409 and rolls back', async () => {
    mockGetTemplate.mockResolvedValue(mockTemplate);
    mockGetActivityState.mockResolvedValue(null);
    mockInsertActivity.mockResolvedValue(freshActivityRow);
    // Race: another request won the INSERT
    mockUpsertActivityState.mockResolvedValue(null);

    await expect(
      saveActivityService(
        { ...baseInput, version: 0 },
        'user-001',
        ['agent'],
        'test-corr-001',
      ),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mockPgClient.query).toHaveBeenCalledWith(
      expect.stringContaining('ROLLBACK'),
    );
  });
});

// ===========================================================================
// saveActivityService — authorization
// ===========================================================================

describe('saveActivityService — authorization', () => {
  it('user has the assigned role → succeeds', async () => {
    mockGetTemplate.mockResolvedValue(mockTemplate);
    mockGetActivityState.mockResolvedValue(null);
    mockInsertActivity.mockResolvedValue(freshActivityRow);
    mockUpsertActivityState.mockResolvedValue({ status: 'inserted', row: { ...freshStateRow, version: 1 } } satisfies UpsertResult);

    await expect(
      saveActivityService({ ...baseInput, version: 0 }, 'user-001', ['agent'], 'test-corr-001'),
    ).resolves.toBeDefined();
  });

  it('user has roleOverride but not assigned role → succeeds', async () => {
    const templateWithOverride: ActivityTemplateFullDto = {
      ...mockTemplate,
      steps: [{
        ...step1,
        outcomes: [
          { outcomeName: 'Loop Back', outcomeType: 'Loop', nextStepNo: null, roleOverride: 'ccm_agent', requiresOtpVerification: false },
        ],
      }],
    };
    mockGetTemplate.mockResolvedValue(templateWithOverride);
    mockGetActivityState.mockResolvedValue(null);
    mockInsertActivity.mockResolvedValue(freshActivityRow);
    mockUpsertActivityState.mockResolvedValue({ status: 'inserted', row: { ...freshStateRow, version: 1 } } satisfies UpsertResult);

    await expect(
      saveActivityService({ ...baseInput, version: 0 }, 'user-001', ['ccm_agent'], 'test-corr-001'),
    ).resolves.toBeDefined();
  });

  it('user has neither assigned role nor override → throws 403', async () => {
    mockGetTemplate.mockResolvedValue(mockTemplate);
    mockGetActivityState.mockResolvedValue(null);

    await expect(
      saveActivityService({ ...baseInput, version: 0 }, 'dealer-001', ['dealer_service_advisor'], 'test-corr-001'),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(mockInsertActivity).not.toHaveBeenCalled();
  });

  it('invalid outcome name → throws 422', async () => {
    mockGetTemplate.mockResolvedValue(mockTemplate);
    mockGetActivityState.mockResolvedValue(null);

    await expect(
      saveActivityService(
        { ...baseInput, outcomeName: 'NonExistent', version: 0 },
        'user-001',
        ['agent'],
        'test-corr-001',
      ),
    ).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });
  });

  it('outcomeType mismatch (template says Loop, request says MoveForward) → throws 422', async () => {
    mockGetTemplate.mockResolvedValue(mockTemplate);
    mockGetActivityState.mockResolvedValue(null);

    await expect(
      saveActivityService(
        { ...baseInput, outcomeName: 'Loop Back', outcomeType: 'MoveForward', version: 0 },
        'user-001',
        ['agent'],
        'test-corr-001',
      ),
    ).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });
  });
});
