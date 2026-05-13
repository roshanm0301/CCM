// =============================================================================
// CCM API — Resolution Activity Service
//
// State-machine business logic for the Resolution tab.
// Outcome types: Loop (stay), MoveForward (advance), Close (validate + close).
// Source: CCM_Phase6_Resolution_Activities.md § Wave 2 Track D
// =============================================================================

import { AppError } from '../../shared/errors/AppError';
import { getPool } from '../../shared/database/postgres';
import { CaseModel } from '../../shared/models/case.model';
import { writeAuditEvent } from '../audit/audit.repository';
import {
  getApplicableTemplateService,
  getTemplateService,
} from '../activity-template/activity-template.service';
import type { ActivityTemplateFullDto, TemplateStepDto } from '../activity-template/activity-template.service';
import {
  insertResolutionActivity,
  getActivityState,
  upsertActivityState,
  getResolutionHistory,
} from './resolution-activity.repository';
import type { ResolutionActivityRow, CaseActivityStateRow, UpsertResult } from './resolution-activity.repository';
import type { SaveResolutionActivityInput } from './resolution-activity.validator';

// ---------------------------------------------------------------------------
// Exported DTO shapes
// ---------------------------------------------------------------------------

export interface CurrentActivityDto {
  activityId: string;
  stepNo: number;
  assignedRole: string;
  isMandatory: boolean;
  slaValue: number | null;
  slaUnit: string | null;
  outcomes: Array<{
    outcomeName: string;
    outcomeType: string;
    nextStepNo: number | null;
    roleOverride: string | null;
  }>;
}

export interface ResolutionActivityDto {
  id: string;
  caseId: string;
  templateId: string;
  stepNo: number;
  activityId: string;
  outcomeName: string;
  outcomeType: string;
  performedRole: string;
  performedByUserId: string;
  remarks: string;
  attachmentIds: string[];
  createdAt: string;
}

export interface ResolutionTabDto {
  caseId: string;
  templateId: string;
  currentStepNo: number;
  caseStatus: string;
  activityStatus: string;
  version: number;
  currentActivity: CurrentActivityDto;
  history: ResolutionActivityDto[];
}

export interface SaveActivityResult {
  savedActivity: ResolutionActivityDto;
  updatedState: {
    currentStepNo: number;
    caseStatus: string;
    activityStatus: string;
    version: number;
  };
  caseClosed: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toResolutionActivityDto(row: ResolutionActivityRow): ResolutionActivityDto {
  return {
    id:                row.id,
    caseId:            row.case_id,
    templateId:        row.template_id,
    stepNo:            row.step_no,
    activityId:        row.activity_id,
    outcomeName:       row.outcome_name,
    outcomeType:       row.outcome_type,
    performedRole:     row.performed_role,
    performedByUserId: row.performed_by_user_id,
    remarks:           row.remarks,
    // attachment_ids is stored as a comma-separated string; split into array,
    // filtering out the empty-string element produced by splitting ''.
    attachmentIds: row.attachment_ids
      ? row.attachment_ids.split(',').filter((s) => s.length > 0)
      : [],
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString(),
  };
}

function buildCurrentActivityDto(step: TemplateStepDto): CurrentActivityDto {
  return {
    activityId:   step.activityId,
    stepNo:       step.stepNo,
    assignedRole: step.assignedRole,
    isMandatory:  step.isMandatory,
    slaValue:     step.slaValue,
    slaUnit:      step.slaUnit,
    outcomes:     step.outcomes.map((o) => ({
      outcomeName:  o.outcomeName,
      outcomeType:  o.outcomeType,
      nextStepNo:   o.nextStepNo,
      roleOverride: o.roleOverride,
    })),
  };
}

// ---------------------------------------------------------------------------
// validateMandatorySteps
// ---------------------------------------------------------------------------

/**
 * Check that every mandatory step in the template has at least one history row.
 * Returns an array of error messages for each missing mandatory step (empty = all good).
 */
export function validateMandatorySteps(
  steps: TemplateStepDto[],
  history: ResolutionActivityRow[],
): string[] {
  const completedStepNos = new Set(history.map((h) => h.step_no));
  const errors: string[] = [];

  for (const step of steps) {
    if (step.isMandatory && !completedStepNos.has(step.stepNo)) {
      errors.push(
        `Mandatory step ${step.stepNo} (${step.activityId}) not completed.`,
      );
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// loadResolutionTabService
// ---------------------------------------------------------------------------

/**
 * Load all data needed to render the Resolution tab.
 *
 * If no state row exists for the case, the start step is used as the virtual
 * current step and version=0 signals "no DB row yet".
 */
export async function loadResolutionTabService(
  caseId: string,
  caseNature: string,
  department: string,
  productType: string,
): Promise<ResolutionTabDto> {
  // 1. Resolve template — 404/409 errors bubble up as-is.
  const template: ActivityTemplateFullDto = await getApplicableTemplateService(
    caseNature,
    department,
    productType,
  );

  // 2. Load current state (may not exist yet).
  const state: CaseActivityStateRow | null = await getActivityState(caseId);

  // 3. Determine effective step + status.
  let currentStepNo: number;
  let caseStatus: string;
  let activityStatus: string;
  let version: number;

  if (!state) {
    // No state row — find the start step.
    const startStep = template.steps.find((s) => s.isStartStep);
    if (!startStep) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Activity template has no start step configured.',
        422,
      );
    }
    currentStepNo  = startStep.stepNo;
    caseStatus     = 'Open';
    activityStatus = 'Fresh';
    version        = 0; // signals no DB row yet
  } else {
    currentStepNo  = state.current_step_no;
    caseStatus     = state.case_status;
    activityStatus = state.activity_status;
    version        = state.version;
  }

  // 4. Find the step definition for currentStepNo.
  const currentStep = template.steps.find((s) => s.stepNo === currentStepNo);
  if (!currentStep) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Current step ${currentStepNo} not found in template '${template.id}'.`,
      422,
    );
  }

  // 5. Load history.
  const historyRows = await getResolutionHistory(caseId);

  return {
    caseId,
    templateId:     template.id,
    currentStepNo,
    caseStatus,
    activityStatus,
    version,
    currentActivity: buildCurrentActivityDto(currentStep),
    history:         historyRows.map(toResolutionActivityDto),
  };
}

// ---------------------------------------------------------------------------
// saveActivityService
// ---------------------------------------------------------------------------

/**
 * Persist a resolution activity, advance the state machine, and (on Close)
 * update the MongoDB case document.
 *
 * All PostgreSQL writes run inside a single transaction.
 * MongoDB update is non-transactional but is only attempted after PG commits.
 */
export async function saveActivityService(
  input: SaveResolutionActivityInput,
  userId: string,
  userRoles: string[],
  correlationId: string,
): Promise<SaveActivityResult> {
  // 1. Load template by ID (bypasses applicability params — we already know the templateId).
  const template: ActivityTemplateFullDto = await getTemplateService(input.templateId);

  // 2. Find the step in the template.
  const currentStep = template.steps.find((s) => s.stepNo === input.stepNo);
  if (!currentStep) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Step ${input.stepNo} not found in template '${input.templateId}'.`,
      422,
    );
  }

  // 3. Find the outcome.
  const outcome = currentStep.outcomes.find(
    (o) => o.outcomeName === input.outcomeName,
  );
  if (!outcome) {
    throw new AppError('VALIDATION_ERROR', 'Invalid outcome selected.', 422);
  }

  // 4. Validate outcomeType matches the template definition.
  if (input.outcomeType !== outcome.outcomeType) {
    throw new AppError(
      'VALIDATION_ERROR',
      `outcomeType mismatch: expected '${outcome.outcomeType}' but received '${input.outcomeType}'.`,
      422,
    );
  }

  // 5. Authorization check.
  const hasAssignedRole  = userRoles.includes(currentStep.assignedRole);
  const hasRoleOverride  =
    outcome.roleOverride !== null && userRoles.includes(outcome.roleOverride);
  if (!hasAssignedRole && !hasRoleOverride) {
    throw AppError.forbidden(
      'You are not authorized to perform this activity.',
    );
  }

  // 6. Load current state and check case is not already closed.
  const currentState: CaseActivityStateRow | null = await getActivityState(input.caseId);
  if (currentState && currentState.case_status.includes('Closed')) {
    throw new AppError('VALIDATION_ERROR', 'This case is already closed.', 422);
  }

  // 7. Optimistic lock version check.
  const stateVersion = currentState ? currentState.version : 0;
  if (input.version !== stateVersion) {
    throw AppError.conflict(
      'This activity is no longer active. Please refresh.',
    );
  }

  // 8–12. PostgreSQL transaction.
  const pgClient = await getPool().connect();
  let savedActivityRow: ResolutionActivityRow;
  let newState: CaseActivityStateRow;

  try {
    await pgClient.query('BEGIN');

    // 7a. Re-validate closed-case guard inside the transaction using SELECT FOR UPDATE.
    // The pre-transaction getActivityState check (step 6) is a fast-path optimisation
    // that avoids acquiring a lock on the happy path, but it has a TOCTOU race window.
    // This locked re-read is the authoritative check — it serialises concurrent Close
    // attempts and ensures the caller receives a 422 (not a generic 409) if the case
    // was closed by a concurrent request between step 6 and now.
    if (currentState) {
      const lockedStateResult = await pgClient.query<{ case_status: string }>(
        `SELECT case_status FROM case_activity_state WHERE case_id = $1 FOR UPDATE`,
        [input.caseId],
      );
      const lockedStatus = lockedStateResult.rows[0]?.case_status ?? '';
      if (lockedStatus.includes('Closed')) {
        throw new AppError('VALIDATION_ERROR', 'This case is already closed.', 422);
      }
    }

    // 8. Insert the activity row.
    const attachmentIds = input.attachmentId ? input.attachmentId : '';
    savedActivityRow = await insertResolutionActivity(
      {
        caseId:            input.caseId,
        templateId:        input.templateId,
        stepNo:            input.stepNo,
        activityId:        input.activityId,
        outcomeName:       input.outcomeName,
        outcomeType:       input.outcomeType,
        performedRole:     currentStep.assignedRole,
        performedByUserId: userId,
        remarks:           input.remarks,
        attachmentIds,
      },
      pgClient,
    );

    // 9. Determine next state.
    let newStepNo: number        = input.stepNo;
    let newCaseStatus: string    = currentState ? currentState.case_status : 'Open';
    let newActivityStatus: string;
    let caseClosed               = false;

    if (input.outcomeType === 'Loop') {
      newStepNo        = input.stepNo;
      newActivityStatus = 'In Progress';
    } else if (input.outcomeType === 'MoveForward') {
      if (outcome.nextStepNo === null) {
        throw new AppError(
          'VALIDATION_ERROR',
          `Outcome '${outcome.outcomeName}' is MoveForward but has no nextStepNo configured.`,
          422,
        );
      }
      const nextStep = template.steps.find((s) => s.stepNo === outcome.nextStepNo);
      if (!nextStep) {
        throw new AppError(
          'VALIDATION_ERROR',
          `MoveForward target step ${outcome.nextStepNo} does not exist in template '${input.templateId}'.`,
          422,
        );
      }
      newStepNo        = outcome.nextStepNo;
      newActivityStatus = 'In Progress';
    } else {
      // Close
      // Need history including the row we just inserted — load from DB within the
      // transaction so it is visible (same connection).
      const historyResult = await pgClient.query<ResolutionActivityRow>(
        `SELECT id, case_id, template_id, step_no, activity_id, outcome_name, outcome_type,
                performed_role, performed_by_user_id, remarks, attachment_ids, created_at
           FROM resolution_activities
          WHERE case_id = $1
          ORDER BY created_at ASC`,
        [input.caseId],
      );
      const mandatoryErrors = validateMandatorySteps(
        template.steps,
        historyResult.rows,
      );
      if (mandatoryErrors.length > 0) {
        throw new AppError(
          'VALIDATION_ERROR',
          mandatoryErrors.join(' '),
          422,
          mandatoryErrors,
        );
      }
      newStepNo        = input.stepNo;
      newCaseStatus    = 'Closed \u2013 Verified';
      newActivityStatus = 'Resolved';
      caseClosed       = true;
    }

    // 10. Upsert state with optimistic lock.
    const upserted: UpsertResult | null = await upsertActivityState(
      {
        caseId:         input.caseId,
        templateId:     input.templateId,
        newStepNo,
        caseStatus:     newCaseStatus,
        activityStatus: newActivityStatus,
        currentVersion: input.version,
        userId,
      },
      pgClient,
    );

    if (!upserted || upserted.status === 'conflict') {
      throw AppError.conflict('Concurrent save detected. Please refresh.');
    }

    newState = upserted.row;

    await pgClient.query('COMMIT');

    // 11. MongoDB update on Close (outside PG transaction — non-transactional).
    if (caseClosed) {
      await CaseModel.updateOne(
        { caseId: input.caseId },
        {
          $set: {
            caseStatus:     'Closed \u2013 Verified',
            activityStatus: 'Resolved',
          },
        },
      );
    }

    // 13. Audit writes — non-fatal.
    try {
      await writeAuditEvent({
        interactionId: null,
        eventName:     'resolution_activity_saved',
        actorUserId:   userId,
        eventPayload:  {
          caseId:      input.caseId,
          templateId:  input.templateId,
          stepNo:      input.stepNo,
          outcomeName: input.outcomeName,
          outcomeType: input.outcomeType,
        },
        correlationId,
      });
    } catch {
      // Audit failure is non-fatal — already logged inside writeAuditEvent.
    }

    if (caseClosed) {
      try {
        await writeAuditEvent({
          interactionId: null,
          eventName:     'case_closed',
          actorUserId:   userId,
          eventPayload:  { caseId: input.caseId },
          correlationId,
        });
      } catch {
        // Non-fatal.
      }
    }

    // 14. Build and return result.
    return {
      savedActivity: toResolutionActivityDto(savedActivityRow),
      updatedState: {
        currentStepNo:  newState.current_step_no,
        caseStatus:     newState.case_status,
        activityStatus: newState.activity_status,
        version:        newState.version,
      },
      caseClosed,
    };
  } catch (err) {
    await pgClient.query('ROLLBACK');
    throw err;
  } finally {
    pgClient.release();
  }
}
