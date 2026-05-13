// =============================================================================
// CCM API — Activity Template Validator Unit Tests
//
// Tests Zod schemas and validateTemplateIntegrity for activity templates.
// Source: CCM_Phase5_ActivityFlowConfiguration.md § Features 3–6
// =============================================================================

import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock config + logger before importing anything that transitively loads them
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

vi.mock('../../../config/index', () => ({
  config: {
    nodeEnv: 'test',
    port: 3000,
    logLevel: 'error',
    postgresHost: 'localhost',
    postgresPort: 5432,
    postgresDb: 'ccm_test',
    postgresUser: 'ccm',
    postgresPassword: 'ccm',
    postgresPoolMin: 2,
    postgresPoolMax: 10,
    mongoHost: 'localhost',
    mongoPort: 27017,
    mongoDb: 'ccm_test',
    mongoUser: 'ccm',
    mongoPassword: 'ccm',
    jwtSecret: 'test-secret-that-is-at-least-32-characters-long',
    jwtExpiry: '8h',
    corsAllowedOrigins: 'http://localhost:5173',
  },
}));

vi.mock('../../../shared/database/postgres', () => ({
  getPool: () => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }),
}));

vi.mock('../../activity-master/activity-master.repository', () => ({
  findActiveActivities: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../shared/models/referenceMaster.model', () => ({
  ReferenceMasterModel: {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
    }),
  },
}));

import {
  outcomeSchema,
  stepSchema,
  updateTemplateSchema,
} from '../activity-template.validator';
import { validateTemplateIntegrity } from '../activity-template.service';
import type { StepInput } from '../activity-template.validator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid step with a Close outcome. */
function makeStep(overrides: Partial<StepInput> = {}): StepInput {
  return {
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// outcomeSchema
// ---------------------------------------------------------------------------

describe('outcomeSchema', () => {
  it('valid MoveForward with nextStepNo=2 passes', () => {
    const result = outcomeSchema.safeParse({
      outcomeName: 'Next',
      outcomeType: 'MoveForward',
      nextStepNo: 2,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nextStepNo).toBe(2);
    }
  });

  it('valid Loop with nextStepNo=null passes', () => {
    const result = outcomeSchema.safeParse({
      outcomeName: 'Retry',
      outcomeType: 'Loop',
      nextStepNo: null,
    });
    expect(result.success).toBe(true);
  });

  it('valid Loop with nextStepNo omitted (defaults to null) passes', () => {
    const result = outcomeSchema.safeParse({
      outcomeName: 'Retry',
      outcomeType: 'Loop',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nextStepNo).toBeNull();
    }
  });

  it('valid Close with nextStepNo=null passes', () => {
    const result = outcomeSchema.safeParse({
      outcomeName: 'Done',
      outcomeType: 'Close',
      nextStepNo: null,
    });
    expect(result.success).toBe(true);
  });

  it('Fix 5: Loop with nextStepNo=2 → fails refine', () => {
    const result = outcomeSchema.safeParse({
      outcomeName: 'Retry',
      outcomeType: 'Loop',
      nextStepNo: 2,
    });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages.some((m) => m.includes('must not specify'))).toBe(true);
  });

  it('Fix 5: Close with nextStepNo=2 → fails refine', () => {
    const result = outcomeSchema.safeParse({
      outcomeName: 'Done',
      outcomeType: 'Close',
      nextStepNo: 2,
    });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages.some((m) => m.includes('must not specify'))).toBe(true);
  });

  it('invalid outcomeType → fails enum validation', () => {
    const result = outcomeSchema.safeParse({
      outcomeName: 'X',
      outcomeType: 'Skip',
    });
    expect(result.success).toBe(false);
  });

  it('missing outcomeName → fails', () => {
    const result = outcomeSchema.safeParse({
      outcomeType: 'Close',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// stepSchema — duplicate outcome names
// ---------------------------------------------------------------------------

describe('stepSchema — duplicate outcome names', () => {
  function makeStepPayload(outcomes: { outcomeName: string; outcomeType: string; nextStepNo?: number | null }[]) {
    return {
      stepNo:           1,
      activityId:       '507f1f77bcf86cd799439011',
      assignedRole:     'ccm_agent',
      slaValue:         null,
      slaUnit:          null,
      weightPercentage: 100,
      isMandatory:      false,
      isStartStep:      true,
      outcomes,
    };
  }

  it('two outcomes with identical names → fails with duplicate outcome name message', () => {
    const result = stepSchema.safeParse(
      makeStepPayload([
        { outcomeName: 'Resolved', outcomeType: 'Close', nextStepNo: null },
        { outcomeName: 'Resolved', outcomeType: 'Loop', nextStepNo: null },
      ]),
    );
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages.some((m) => m.includes('Duplicate outcome name is not allowed within the same step.'))).toBe(true);
  });

  it('two outcomes differing only by case ("Resolved" vs "RESOLVED") → fails', () => {
    const result = stepSchema.safeParse(
      makeStepPayload([
        { outcomeName: 'Resolved', outcomeType: 'Close', nextStepNo: null },
        { outcomeName: 'RESOLVED', outcomeType: 'Loop', nextStepNo: null },
      ]),
    );
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages.some((m) => m.includes('Duplicate outcome name is not allowed within the same step.'))).toBe(true);
  });

  it('two outcomes differing only by whitespace ("Resolved" vs " Resolved ") → fails', () => {
    const result = stepSchema.safeParse(
      makeStepPayload([
        { outcomeName: 'Resolved', outcomeType: 'Close', nextStepNo: null },
        { outcomeName: ' Resolved ', outcomeType: 'Loop', nextStepNo: null },
      ]),
    );
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages.some((m) => m.includes('Duplicate outcome name is not allowed within the same step.'))).toBe(true);
  });

  it('two outcomes with distinct names ("Resolved" and "Escalated") → passes', () => {
    const result = stepSchema.safeParse(
      makeStepPayload([
        { outcomeName: 'Resolved', outcomeType: 'Close', nextStepNo: null },
        { outcomeName: 'Escalated', outcomeType: 'MoveForward', nextStepNo: 2 },
      ]),
    );
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateTemplateSchema (Fix 7)
// ---------------------------------------------------------------------------

describe('updateTemplateSchema (Fix 7)', () => {
  function validUpdatePayload() {
    return {
      templateName: 'My Template',
      appliesTo:    'complaint',
      department:   'SALES',
      productType:  'Motorcycle',
      isActive:     true,
      steps:        [],
    };
  }

  it('valid payload with isActive and steps → passes', () => {
    const result = updateTemplateSchema.safeParse(validUpdatePayload());
    expect(result.success).toBe(true);
  });

  it('missing isActive → fails with "isActive is required"', () => {
    const { isActive: _omit, ...payload } = validUpdatePayload();
    const result = updateTemplateSchema.safeParse(payload);
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages.some((m) => m.toLowerCase().includes('isactive'))).toBe(true);
  });

  it('missing steps → fails (steps required)', () => {
    const { steps: _omit, ...payload } = validUpdatePayload();
    const result = updateTemplateSchema.safeParse(payload);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('steps'))).toBe(true);
  });

  it('missing templateName → fails', () => {
    const { templateName: _omit, ...payload } = validUpdatePayload();
    const result = updateTemplateSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateTemplateIntegrity
// ---------------------------------------------------------------------------

describe('validateTemplateIntegrity', () => {
  it('empty steps array → ["Template must have at least one step."]', () => {
    const errors = validateTemplateIntegrity([]);
    expect(errors).toContain('Template must have at least one step.');
  });

  it('Fix 2: two steps with same stepNo → error contains "unique"', () => {
    const steps: StepInput[] = [
      makeStep({ stepNo: 1, isStartStep: true, weightPercentage: 50 }),
      makeStep({ stepNo: 1, isStartStep: false, weightPercentage: 50 }),
    ];
    const errors = validateTemplateIntegrity(steps);
    expect(errors.some((e) => e.toLowerCase().includes('unique'))).toBe(true);
  });

  it('no start step → error about start step', () => {
    const steps: StepInput[] = [
      makeStep({ stepNo: 1, isStartStep: false, weightPercentage: 100 }),
    ];
    const errors = validateTemplateIntegrity(steps);
    expect(errors.some((e) => e.includes('Start Step'))).toBe(true);
  });

  it('two start steps → error about only one start step allowed', () => {
    const steps: StepInput[] = [
      makeStep({ stepNo: 1, isStartStep: true, weightPercentage: 50 }),
      makeStep({ stepNo: 2, isStartStep: true, weightPercentage: 50, outcomes: [
        { outcomeName: 'Done', outcomeType: 'Close', nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
      ]}),
    ];
    const errors = validateTemplateIntegrity(steps);
    expect(errors.some((e) => e.includes('Only one Start Step'))).toBe(true);
  });

  it('step with no outcomes → error about outcomes', () => {
    const steps: StepInput[] = [
      makeStep({ stepNo: 1, isStartStep: true, weightPercentage: 100, outcomes: [] }),
    ];
    const errors = validateTemplateIntegrity(steps);
    expect(errors.some((e) => e.includes('at least one outcome'))).toBe(true);
  });

  it('Fix 3: MoveForward with nextStepNo pointing to non-existent step → error about non-existent step', () => {
    const steps: StepInput[] = [
      makeStep({
        stepNo: 1,
        isStartStep: true,
        weightPercentage: 100,
        outcomes: [
          { outcomeName: 'Next', outcomeType: 'MoveForward', nextStepNo: 99, roleOverride: null, requiresOtpVerification: false },
        ],
      }),
    ];
    const errors = validateTemplateIntegrity(steps);
    expect(errors.some((e) => e.includes('non-existent Step 99'))).toBe(true);
  });

  it('Fix 5: Loop outcome with nextStepNo != null in integrity check → error', () => {
    // The refine on outcomeSchema prevents this at parse time, but we test
    // the runtime integrity check directly with raw StepInput objects.
    const steps: StepInput[] = [
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
          { outcomeName: 'Retry', outcomeType: 'Loop', nextStepNo: 2, roleOverride: null, requiresOtpVerification: false },
        ],
      },
    ];
    const errors = validateTemplateIntegrity(steps);
    expect(errors.some((e) => e.includes('must not specify a Next Step'))).toBe(true);
  });

  it('Fix 5: Close outcome with nextStepNo != null in integrity check → error', () => {
    const steps: StepInput[] = [
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
          { outcomeName: 'Done', outcomeType: 'Close', nextStepNo: 2, roleOverride: null, requiresOtpVerification: false },
        ],
      },
    ];
    const errors = validateTemplateIntegrity(steps);
    expect(errors.some((e) => e.includes('must not specify a Next Step'))).toBe(true);
  });

  it('Fix 6 (float precision): 33.33 + 33.33 + 33.34 = 100.00 → NO error', () => {
    const steps: StepInput[] = [
      makeStep({ stepNo: 1, isStartStep: true,  weightPercentage: 33.33, outcomes: [
        { outcomeName: 'Next', outcomeType: 'MoveForward', nextStepNo: 2, roleOverride: null, requiresOtpVerification: false },
      ]}),
      makeStep({ stepNo: 2, isStartStep: false, weightPercentage: 33.33, outcomes: [
        { outcomeName: 'Next', outcomeType: 'MoveForward', nextStepNo: 3, roleOverride: null, requiresOtpVerification: false },
      ]}),
      makeStep({ stepNo: 3, isStartStep: false, weightPercentage: 33.34, outcomes: [
        { outcomeName: 'Done', outcomeType: 'Close', nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
      ]}),
    ];
    const errors = validateTemplateIntegrity(steps);
    expect(errors.some((e) => e.includes('Weight %'))).toBe(false);
    // Also verify overall validity
    expect(errors).toHaveLength(0);
  });

  it('Fix 6: weights 33 + 33 + 33 (total=99) → error about weight', () => {
    const steps: StepInput[] = [
      makeStep({ stepNo: 1, isStartStep: true,  weightPercentage: 33, outcomes: [
        { outcomeName: 'Next', outcomeType: 'MoveForward', nextStepNo: 2, roleOverride: null, requiresOtpVerification: false },
      ]}),
      makeStep({ stepNo: 2, isStartStep: false, weightPercentage: 33, outcomes: [
        { outcomeName: 'Next', outcomeType: 'MoveForward', nextStepNo: 3, roleOverride: null, requiresOtpVerification: false },
      ]}),
      makeStep({ stepNo: 3, isStartStep: false, weightPercentage: 33, outcomes: [
        { outcomeName: 'Done', outcomeType: 'Close', nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
      ]}),
    ];
    const errors = validateTemplateIntegrity(steps);
    expect(errors.some((e) => e.includes('Weight %'))).toBe(true);
  });

  it('valid 2-step template (start → step 2 Close) → no errors', () => {
    const steps: StepInput[] = [
      makeStep({
        stepNo: 1,
        isStartStep: true,
        weightPercentage: 50,
        outcomes: [
          { outcomeName: 'Next', outcomeType: 'MoveForward', nextStepNo: 2, roleOverride: null, requiresOtpVerification: false },
        ],
      }),
      makeStep({
        stepNo: 2,
        isStartStep: false,
        weightPercentage: 50,
        outcomes: [
          { outcomeName: 'Done', outcomeType: 'Close', nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
        ],
      }),
    ];
    const errors = validateTemplateIntegrity(steps);
    expect(errors).toHaveLength(0);
  });

  it('valid single-step template with Close outcome → no errors', () => {
    const steps: StepInput[] = [
      makeStep({ stepNo: 1, isStartStep: true, weightPercentage: 100 }),
    ];
    const errors = validateTemplateIntegrity(steps);
    expect(errors).toHaveLength(0);
  });

  it('unreachable step → error about unreachable', () => {
    const steps: StepInput[] = [
      makeStep({
        stepNo: 1,
        isStartStep: true,
        weightPercentage: 50,
        outcomes: [
          // Points to step 2 (reachable), but step 3 is never referenced
          { outcomeName: 'Next', outcomeType: 'MoveForward', nextStepNo: 2, roleOverride: null, requiresOtpVerification: false },
        ],
      }),
      makeStep({
        stepNo: 2,
        isStartStep: false,
        weightPercentage: 25,
        outcomes: [
          { outcomeName: 'Done', outcomeType: 'Close', nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
        ],
      }),
      makeStep({
        stepNo: 3,
        isStartStep: false,
        weightPercentage: 25,
        outcomes: [
          { outcomeName: 'Done', outcomeType: 'Close', nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
        ],
      }),
    ];
    const errors = validateTemplateIntegrity(steps);
    expect(errors.some((e) => e.includes('unreachable'))).toBe(true);
  });

  it('no closure path (all MoveForward, no Close) → error about closure path', () => {
    // Step 1 → Step 2 → Step 1 (cycle, no Close anywhere)
    const steps: StepInput[] = [
      makeStep({
        stepNo: 1,
        isStartStep: true,
        weightPercentage: 50,
        outcomes: [
          { outcomeName: 'Next', outcomeType: 'MoveForward', nextStepNo: 2, roleOverride: null, requiresOtpVerification: false },
        ],
      }),
      makeStep({
        stepNo: 2,
        isStartStep: false,
        weightPercentage: 50,
        outcomes: [
          { outcomeName: 'Back', outcomeType: 'MoveForward', nextStepNo: 1, roleOverride: null, requiresOtpVerification: false },
        ],
      }),
    ];
    const errors = validateTemplateIntegrity(steps);
    expect(errors.some((e) => e.includes('closure path'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateTemplateIntegrity — duplicate outcome names
// ---------------------------------------------------------------------------

describe('validateTemplateIntegrity — duplicate outcome names', () => {
  it('step with duplicate outcome names → returns error containing "Duplicate outcome name"', () => {
    const steps: StepInput[] = [
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
          { outcomeName: 'Resolved', outcomeType: 'Close',  nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
          { outcomeName: 'Resolved', outcomeType: 'Loop',   nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
        ],
      },
    ];
    const errors = validateTemplateIntegrity(steps);
    expect(errors.some((e) => e.includes('Duplicate outcome name'))).toBe(true);
  });

  it('step with distinct outcome names → should not error on duplicates', () => {
    const steps: StepInput[] = [
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
          { outcomeName: 'Resolved',  outcomeType: 'Close', nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
          { outcomeName: 'Escalated', outcomeType: 'Close', nextStepNo: null, roleOverride: null, requiresOtpVerification: false },
        ],
      },
    ];
    const errors = validateTemplateIntegrity(steps);
    expect(errors.some((e) => e.includes('Duplicate outcome name'))).toBe(false);
  });
});
