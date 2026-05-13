// =============================================================================
// CCM API — Activity Template Service Unit Tests
//
// Tests business logic by mocking the repository, activity-master repository,
// and postgres pool. No real DB connection required.
// Source: CCM_Phase5_ActivityFlowConfiguration.md § Features 3–6
// =============================================================================

import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';

// ---------------------------------------------------------------------------
// Mock postgres pool — must happen before any import that loads the service
//
// validateAppliesTo queries with SELECT COUNT(*) → returns { count: '1' }
// validateStepReferences queries roles with SELECT name → returns { name: 'ccm_agent' }
// We need to distinguish these two queries. We do so by inspecting the SQL
// string inside the mock and routing accordingly.
// ---------------------------------------------------------------------------

vi.mock('../../../shared/database/postgres', () => ({
  getPool: () => ({
    query: vi.fn().mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('SELECT name FROM roles')) {
        // Roles query — return the role used in test fixtures
        return Promise.resolve({ rows: [{ name: 'ccm_agent' }] });
      }
      // appliesTo / any other query — treat as valid (count=1)
      return Promise.resolve({ rows: [{ count: '1' }] });
    }),
  }),
}));

// ---------------------------------------------------------------------------
// Mock activity-master repository
// ---------------------------------------------------------------------------

vi.mock('../../activity-master/activity-master.repository', () => ({
  findActiveActivities: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock template repository
// ---------------------------------------------------------------------------

vi.mock('../activity-template.repository', () => ({
  findAllTemplates:           vi.fn(),
  findTemplateById:           vi.fn(),
  findActiveTemplateConflict: vi.fn(),
  createTemplate:             vi.fn(),
  updateTemplate:             vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock ReferenceMasterModel (used by listDepartmentsForTemplateService)
// ---------------------------------------------------------------------------

vi.mock('../../../shared/models/referenceMaster.model', () => ({
  ReferenceMasterModel: {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

import * as templateRepo from '../activity-template.repository';
import * as activityRepo from '../../activity-master/activity-master.repository';
import type { ActivityTemplateSummaryRow, ActivityTemplateFullRow } from '../activity-template.repository';
import type { ActivityMasterRow } from '../../activity-master/activity-master.repository';
import {
  listTemplatesService,
  getTemplateService,
  createTemplateService,
  updateTemplateService,
  getApplicableTemplateService,
  validateTemplateIntegrity,
} from '../activity-template.service';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockFindAllTemplates           = templateRepo.findAllTemplates           as MockedFunction<typeof templateRepo.findAllTemplates>;
const mockFindTemplateById           = templateRepo.findTemplateById           as MockedFunction<typeof templateRepo.findTemplateById>;
const mockFindActiveTemplateConflict = templateRepo.findActiveTemplateConflict as MockedFunction<typeof templateRepo.findActiveTemplateConflict>;
const mockCreateTemplate             = templateRepo.createTemplate             as MockedFunction<typeof templateRepo.createTemplate>;
const mockUpdateTemplate             = templateRepo.updateTemplate             as MockedFunction<typeof templateRepo.updateTemplate>;
const mockFindActiveActivities       = activityRepo.findActiveActivities       as MockedFunction<typeof activityRepo.findActiveActivities>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockActivityRow: ActivityMasterRow = {
  id:          '507f1f77bcf86cd799439011',
  code:        'CALL_LOG',
  displayName: 'Call Logging',
  description: '',
  isActive:    true,
  createdBy:   'user-001',
  updatedBy:   'user-001',
  createdAt:   new Date('2026-03-25'),
  updatedAt:   new Date('2026-03-25'),
};

const mockSummaryRow: ActivityTemplateSummaryRow = {
  id:           '507f1f77bcf86cd799439021',
  templateName: 'Complaint Flow',
  appliesTo:    'complaint',
  department:   'SALES',
  productType:  'Motorcycle',
  isActive:     true,
  createdBy:    'user-001',
  updatedBy:    'user-001',
  createdAt:    new Date('2026-03-25'),
  updatedAt:    new Date('2026-03-25'),
};

const mockFullRow: ActivityTemplateFullRow = {
  ...mockSummaryRow,
  steps: [
    {
      stepNo:           1,
      activityId:       '507f1f77bcf86cd799439011',
      assignedRole:     'ccm_agent',
      slaValue:         null,
      slaUnit:          null,
      weightPercentage: 100,
      isMandatory:      false,
      isStartStep:      true,
      outcomes: [
        { outcomeName: 'Done', outcomeType: 'Close', nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
  // Default: postgres pool query returns count=1 (appliesTo valid)
  // and roles query returns agent role
});

// ---------------------------------------------------------------------------
// listTemplatesService
// ---------------------------------------------------------------------------

describe('listTemplatesService', () => {
  it('calls findAllTemplates and maps to summary DTOs', async () => {
    mockFindAllTemplates.mockResolvedValue([mockSummaryRow]);

    const result = await listTemplatesService();

    expect(mockFindAllTemplates).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('507f1f77bcf86cd799439021');
    expect(result[0].templateName).toBe('Complaint Flow');
    // Dates are ISO strings
    expect(typeof result[0].createdAt).toBe('string');
  });

  it('returns empty array when no templates exist', async () => {
    mockFindAllTemplates.mockResolvedValue([]);
    const result = await listTemplatesService();
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getTemplateService
// ---------------------------------------------------------------------------

describe('getTemplateService', () => {
  it('found → returns full DTO with steps', async () => {
    mockFindTemplateById.mockResolvedValue(mockFullRow);

    const result = await getTemplateService('507f1f77bcf86cd799439021');

    expect(mockFindTemplateById).toHaveBeenCalledWith('507f1f77bcf86cd799439021');
    expect(result.id).toBe('507f1f77bcf86cd799439021');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].isStartStep).toBe(true);
  });

  it('not found → throws AppError 404', async () => {
    mockFindTemplateById.mockResolvedValue(null);

    await expect(
      getTemplateService('507f1f77bcf86cd799439021'),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });
});

// ---------------------------------------------------------------------------
// createTemplateService
// ---------------------------------------------------------------------------

describe('createTemplateService', () => {
  it('active template: calls validateAppliesTo, validates integrity, creates template', async () => {
    // Set up mocks
    mockFindActiveTemplateConflict.mockResolvedValue(null);
    mockFindActiveActivities.mockResolvedValue([mockActivityRow]);
    mockCreateTemplate.mockResolvedValue(mockFullRow);

    const input = {
      templateName: 'Complaint Flow',
      appliesTo:    'complaint',
      department:   'SALES',
      productType:  'Motorcycle',
      isActive:     true,
      steps: [
        {
          stepNo:           1,
          activityId:       '507f1f77bcf86cd799439011',
          assignedRole:     'ccm_agent',
          slaValue:         null,
          slaUnit:          null,
          weightPercentage: 100,
          isMandatory:      false,
          isStartStep:      true,
          outcomes: [
            { outcomeName: 'Done', outcomeType: 'Close' as const, nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
          ],
        },
      ],
    };

    const result = await createTemplateService(input, 'user-001');

    expect(mockCreateTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ templateName: 'Complaint Flow', isActive: true }),
      'user-001',
    );
    expect(result.templateName).toBe('Complaint Flow');
  });

  it('conflict → throws 409', async () => {
    mockFindActiveTemplateConflict.mockResolvedValue(mockSummaryRow);

    const input = {
      templateName: 'Complaint Flow',
      appliesTo:    'complaint',
      department:   'SALES',
      productType:  'Motorcycle',
      isActive:     true,
      steps: [
        {
          stepNo:           1,
          activityId:       '507f1f77bcf86cd799439011',
          assignedRole:     'ccm_agent',
          slaValue:         null,
          slaUnit:          null,
          weightPercentage: 100,
          isMandatory:      false,
          isStartStep:      true,
          outcomes: [
            { outcomeName: 'Done', outcomeType: 'Close' as const, nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
          ],
        },
      ],
    };

    await expect(
      createTemplateService(input, 'user-001'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });

    expect(mockCreateTemplate).not.toHaveBeenCalled();
  });

  it('integrity failure (empty steps on active template) → throws 422', async () => {
    mockFindActiveTemplateConflict.mockResolvedValue(null);

    const input = {
      templateName: 'Complaint Flow',
      appliesTo:    'complaint',
      department:   'SALES',
      productType:  'Motorcycle',
      isActive:     true,
      steps:        [],  // empty steps → integrity error
    };

    await expect(
      createTemplateService(input, 'user-001'),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
    });

    expect(mockCreateTemplate).not.toHaveBeenCalled();
  });

  it('inactive template: skips integrity check, creates successfully', async () => {
    mockFindActiveActivities.mockResolvedValue([]);
    mockCreateTemplate.mockResolvedValue({ ...mockFullRow, isActive: false, steps: [] });

    const input = {
      templateName: 'Draft Flow',
      appliesTo:    'complaint',
      department:   'SALES',
      productType:  'Motorcycle',
      isActive:     false,
      steps:        [],  // no steps — allowed for inactive draft
    };

    const result = await createTemplateService(input, 'user-001');

    // findActiveTemplateConflict not called for inactive templates
    expect(mockFindActiveTemplateConflict).not.toHaveBeenCalled();
    expect(mockCreateTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
      'user-001',
    );
    expect(result.isActive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateTemplateService
// ---------------------------------------------------------------------------

describe('updateTemplateService', () => {
  it('userId is passed to updateTemplate (Fix 8)', async () => {
    mockFindTemplateById.mockResolvedValue(mockFullRow);
    mockFindActiveTemplateConflict.mockResolvedValue(null);
    mockFindActiveActivities.mockResolvedValue([mockActivityRow]);
    mockUpdateTemplate.mockResolvedValue(mockFullRow);

    const input = {
      templateName: 'Complaint Flow',
      appliesTo:    'complaint',
      department:   'SALES',
      productType:  'Motorcycle',
      isActive:     true,
      steps: [
        {
          stepNo:           1,
          activityId:       '507f1f77bcf86cd799439011',
          assignedRole:     'ccm_agent',
          slaValue:         null,
          slaUnit:          null,
          weightPercentage: 100,
          isMandatory:      false,
          isStartStep:      true,
          outcomes: [
            { outcomeName: 'Done', outcomeType: 'Close' as const, nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
          ],
        },
      ],
    };

    await updateTemplateService('507f1f77bcf86cd799439021', input, 'audit-user');

    expect(mockUpdateTemplate).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439021',
      expect.any(Object),
      'audit-user',
    );
  });

  it('template not found → throws 404', async () => {
    mockFindTemplateById.mockResolvedValue(null);

    const input = {
      templateName: 'Complaint Flow',
      appliesTo:    'complaint',
      department:   'SALES',
      productType:  'Motorcycle',
      isActive:     true,
      steps:        [],
    };

    await expect(
      updateTemplateService('507f1f77bcf86cd799439099', input, 'user-001'),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });
});

// ---------------------------------------------------------------------------
// validateTemplateIntegrity — duplicate outcome names
// ---------------------------------------------------------------------------

describe('validateTemplateIntegrity — duplicate outcome names', () => {
  it('step with duplicate outcome names → returns error containing "Duplicate outcome name"', () => {
    const steps = [
      {
        stepNo:           1,
        activityId:       '507f1f77bcf86cd799439011',
        assignedRole:     'ccm_agent',
        slaValue:         null,
        slaUnit:          null,
        weightPercentage: 100,
        isMandatory:      false,
        isStartStep:      true,
        outcomes: [
          { outcomeName: 'Resolved', outcomeType: 'Close' as const, nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
          { outcomeName: 'Resolved', outcomeType: 'Loop'  as const, nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
        ],
      },
    ];
    const errors = validateTemplateIntegrity(steps);
    expect(errors.some((e) => e.includes('Duplicate outcome name'))).toBe(true);
  });

  it('step with distinct outcome names → should not error on duplicates', () => {
    const steps = [
      {
        stepNo:           1,
        activityId:       '507f1f77bcf86cd799439011',
        assignedRole:     'ccm_agent',
        slaValue:         null,
        slaUnit:          null,
        weightPercentage: 100,
        isMandatory:      false,
        isStartStep:      true,
        outcomes: [
          { outcomeName: 'Resolved',  outcomeType: 'Close' as const, nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
          { outcomeName: 'Escalated', outcomeType: 'Close' as const, nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
        ],
      },
    ];
    const errors = validateTemplateIntegrity(steps);
    expect(errors.some((e) => e.includes('Duplicate outcome name'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getApplicableTemplateService
// ---------------------------------------------------------------------------

describe('getApplicableTemplateService', () => {
  it('findAllTemplates returns one matching active template → calls getTemplateService and returns the result', async () => {
    mockFindAllTemplates.mockResolvedValue([mockSummaryRow]);
    mockFindTemplateById.mockResolvedValue(mockFullRow);

    const result = await getApplicableTemplateService('complaint', 'SALES', 'Motorcycle');

    expect(mockFindTemplateById).toHaveBeenCalledWith('507f1f77bcf86cd799439021');
    expect(result.id).toBe('507f1f77bcf86cd799439021');
  });

  it('findAllTemplates returns no matching template → throws AppError with 404', async () => {
    mockFindAllTemplates.mockResolvedValue([]);

    await expect(
      getApplicableTemplateService('complaint', 'SALES', 'Motorcycle'),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('findAllTemplates returns multiple matching templates → throws AppError with 409', async () => {
    const secondSummaryRow = { ...mockSummaryRow, id: '507f1f77bcf86cd799439022' };
    mockFindAllTemplates.mockResolvedValue([mockSummaryRow, secondSummaryRow]);

    await expect(
      getApplicableTemplateService('complaint', 'SALES', 'Motorcycle'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
  });

  it('findAllTemplates returns a matching template but isActive=false → throws 404 (no active match)', async () => {
    const inactiveRow = { ...mockSummaryRow, isActive: false };
    mockFindAllTemplates.mockResolvedValue([inactiveRow]);

    await expect(
      getApplicableTemplateService('complaint', 'SALES', 'Motorcycle'),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });
});
