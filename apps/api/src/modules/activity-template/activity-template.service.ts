// =============================================================================
// CCM API — Activity Template Service
//
// Business logic for Activity Template management, including graph integrity
// validation (reachability + closure path checks).
// Source: CCM_Phase5_ActivityFlowConfiguration.md § Features 3–6
// =============================================================================

import { AppError } from '../../shared/errors/AppError';
import { getPool } from '../../shared/database/postgres';
import { ReferenceMasterModel } from '../../shared/models/referenceMaster.model';
import { findActiveActivities } from '../activity-master/activity-master.repository';
import type { CreateTemplateInput, UpdateTemplateInput, StepInput, OutcomeInput } from './activity-template.validator';
import {
  findAllTemplates,
  findTemplateById,
  findActiveTemplateConflict,
  createTemplate,
  updateTemplate,
  type ActivityTemplateSummaryRow,
  type ActivityTemplateFullRow,
  type TemplateStepRow,
  type OutcomeRow,
} from './activity-template.repository';

// ---------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------

export interface OutcomeDto {
  outcomeName: string;
  outcomeType: 'MoveForward' | 'Loop' | 'Close';
  nextStepNo: number | null;
  roleOverride: string | null;
  requiresOtpVerification: boolean;
}

export interface TemplateStepDto {
  stepNo: number;
  activityId: string;
  assignedRole: string;
  slaValue: number | null;
  slaUnit: 'Hours' | 'Days' | null;
  weightPercentage: number;
  isMandatory: boolean;
  isStartStep: boolean;
  outcomes: OutcomeDto[];
}

export interface ActivityTemplateSummaryDto {
  id: string;
  templateName: string;
  appliesTo: string;
  department: string;
  productType: string;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;   // Fix 8: expose audit trail
  createdAt: string;
  updatedAt: string;
}

export interface ActivityTemplateFullDto extends ActivityTemplateSummaryDto {
  steps: TemplateStepDto[];
}

export interface LookupValueDto {
  code: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toOutcomeDto(row: OutcomeRow): OutcomeDto {
  return {
    outcomeName:             row.outcomeName,
    outcomeType:             row.outcomeType,
    nextStepNo:              row.nextStepNo,
    roleOverride:            row.roleOverride,
    requiresOtpVerification: row.requiresOtpVerification,
  };
}

function toStepDto(row: TemplateStepRow): TemplateStepDto {
  return {
    stepNo:           row.stepNo,
    activityId:       row.activityId,
    assignedRole:     row.assignedRole,
    slaValue:         row.slaValue,
    slaUnit:          row.slaUnit,
    weightPercentage: row.weightPercentage,
    isMandatory:      row.isMandatory,
    isStartStep:      row.isStartStep,
    outcomes:         row.outcomes.map(toOutcomeDto),
  };
}

function toSummaryDto(row: ActivityTemplateSummaryRow): ActivityTemplateSummaryDto {
  return {
    id:           row.id,
    templateName: row.templateName,
    appliesTo:    row.appliesTo,
    department:   row.department,
    productType:  row.productType,
    isActive:     row.isActive,
    createdBy:    row.createdBy,
    updatedBy:    row.updatedBy ?? null,   // Fix 8
    createdAt:    row.createdAt.toISOString(),
    updatedAt:    row.updatedAt.toISOString(),
  };
}

function toFullDto(row: ActivityTemplateFullRow): ActivityTemplateFullDto {
  return {
    ...toSummaryDto(row),
    steps: row.steps.map(toStepDto),
  };
}

function inputToStepRow(s: StepInput): TemplateStepRow {
  return {
    stepNo:           s.stepNo,
    activityId:       s.activityId,
    assignedRole:     s.assignedRole,
    slaValue:         s.slaValue ?? null,
    slaUnit:          s.slaUnit ?? null,
    weightPercentage: s.weightPercentage,
    isMandatory:      s.isMandatory ?? false,
    isStartStep:      s.isStartStep ?? false,
    outcomes:         (s.outcomes ?? []).map((o: OutcomeInput) => ({
      outcomeName:             o.outcomeName,
      outcomeType:             o.outcomeType,
      nextStepNo:              o.nextStepNo ?? null,
      roleOverride:            o.roleOverride ?? null,
      requiresOtpVerification: o.requiresOtpVerification ?? false,
    })),
  };
}

// ---------------------------------------------------------------------------
// Cross-DB reference validators
// ---------------------------------------------------------------------------

/**
 * Fix 4 + Fix 11 — Validates that every step's activityId maps to an active
 * ActivityMaster record (MongoDB) and that every step's assignedRole exists in
 * the PostgreSQL roles table.  Throws 422 on the first detected violation.
 */
async function validateStepReferences(steps: StepInput[]): Promise<void> {
  if (steps.length === 0) return;

  // Fix 4: activityId must exist in ActivityMaster (MongoDB)
  const activeActivities = await findActiveActivities();
  const validActivityIds = new Set(activeActivities.map((a) => a.id));
  const invalidActivitySteps = steps.filter((s) => !validActivityIds.has(s.activityId));
  if (invalidActivitySteps.length > 0) {
    const details = invalidActivitySteps
      .map((s) => `Step ${s.stepNo}: unknown activityId '${s.activityId}'`)
      .join('; ');
    throw new AppError('VALIDATION_ERROR', `Invalid activity references: ${details}`, 422);
  }

  // Fix 11: assignedRole must exist in the PostgreSQL roles table
  const rolesResult = await getPool().query<{ name: string }>('SELECT name FROM roles ORDER BY name');
  const validRoleNames = new Set(rolesResult.rows.map((r) => r.name));
  const invalidRoleSteps = steps.filter((s) => !validRoleNames.has(s.assignedRole));
  if (invalidRoleSteps.length > 0) {
    const details = invalidRoleSteps
      .map((s) => `Step ${s.stepNo}: unknown role '${s.assignedRole}'`)
      .join('; ');
    throw new AppError('VALIDATION_ERROR', `Invalid role references: ${details}`, 422);
  }
}

/**
 * Fix 11 — Validates that the template's appliesTo code exists in PostgreSQL
 * reference_values where reference_type = 'contact_reason'.
 */
async function validateAppliesTo(appliesTo: string): Promise<void> {
  const result = await getPool().query<{ count: string }>(
    `SELECT COUNT(*) AS count
       FROM reference_values
      WHERE reference_type = 'contact_reason'
        AND code = $1
        AND is_active = TRUE`,
    [appliesTo],
  );
  if (parseInt(result.rows[0].count, 10) === 0) {
    throw new AppError('VALIDATION_ERROR', `Invalid 'Applies To' value: '${appliesTo}'`, 422);
  }
}

// ---------------------------------------------------------------------------
// Graph Integrity Validation
// Runs when isActive=true. Returns array of error messages (empty = valid).
// ---------------------------------------------------------------------------

export function validateTemplateIntegrity(steps: StepInput[]): string[] {
  const errors: string[] = [];

  if (steps.length === 0) {
    errors.push('Template must have at least one step.');
    return errors;
  }

  // Fix 2: Step numbers must be unique within the template
  const stepNos = new Set(steps.map((s) => s.stepNo));
  if (steps.length !== stepNos.size) {
    errors.push('Step numbers must be unique within the template.');
  }

  // 1. Exactly one Start Step
  const startSteps = steps.filter((s) => s.isStartStep);
  if (startSteps.length === 0) errors.push('Exactly one Start Step is required.');
  if (startSteps.length > 1)  errors.push('Only one Start Step is allowed.');

  // 2. Every step must have at least one outcome
  for (const s of steps) {
    if (!s.outcomes || s.outcomes.length === 0) {
      errors.push(`Step ${s.stepNo} must have at least one outcome.`);
    }
  }

  // Fix 5: Loop and Close outcomes must not specify a Next Step number
  for (const s of steps) {
    for (const o of s.outcomes ?? []) {
      if ((o.outcomeType === 'Loop' || o.outcomeType === 'Close') && o.nextStepNo !== null) {
        errors.push(
          `Step ${s.stepNo}: ${o.outcomeType} outcome '${o.outcomeName}' must not specify a Next Step.`,
        );
      }
    }
  }

  // Duplicate outcome name within step (case-insensitive, trimmed)
  for (const s of steps) {
    const outcomeNames = (s.outcomes ?? []).map((o) => o.outcomeName.trim().toLowerCase());
    const uniqueNames = new Set(outcomeNames);
    if (outcomeNames.length !== uniqueNames.size) {
      errors.push(`Step ${s.stepNo}: Duplicate outcome name is not allowed within the same step.`);
    }
  }

  // Fix 6: Total Weight % must equal 100 — integer-safe comparison avoids
  // floating-point drift for 3-step splits such as 33.33 + 33.33 + 33.34.
  const totalWeight = steps.reduce((sum, s) => sum + (s.weightPercentage ?? 0), 0);
  if (Math.round(totalWeight * 100) !== 10000) {
    errors.push(`Total Weight % must equal 100 (currently ${totalWeight.toFixed(2)}).`);
  }

  // Only proceed with graph checks if start step is unambiguous and step
  // numbers are unique (ambiguous state makes graph traversal meaningless).
  if (startSteps.length !== 1 || steps.length !== stepNos.size) return errors;

  const startStepNo = startSteps[0].stepNo;

  // Fix 3: MoveForward outcomes must reference step numbers that exist in this template
  for (const s of steps) {
    for (const o of s.outcomes ?? []) {
      if (o.outcomeType === 'MoveForward' && o.nextStepNo !== null && !stepNos.has(o.nextStepNo)) {
        errors.push(
          `Step ${s.stepNo}: MoveForward outcome '${o.outcomeName}' references non-existent Step ${o.nextStepNo}.`,
        );
      }
    }
  }

  // 4. BFS reachability — every step must be reachable from the Start Step
  const visited = new Set<number>();
  const queue: number[] = [startStepNo];
  visited.add(startStepNo);

  while (queue.length > 0) {
    const currentNo = queue.shift()!;
    const current = steps.find((s) => s.stepNo === currentNo);
    if (!current) continue;
    for (const outcome of current.outcomes ?? []) {
      if (
        outcome.outcomeType === 'MoveForward' &&
        outcome.nextStepNo !== null &&
        stepNos.has(outcome.nextStepNo) &&   // only follow valid references
        !visited.has(outcome.nextStepNo)
      ) {
        visited.add(outcome.nextStepNo);
        queue.push(outcome.nextStepNo);
      }
    }
  }

  for (const stepNo of stepNos) {
    if (!visited.has(stepNo)) {
      errors.push(`Step ${stepNo} is unreachable from the Start Step.`);
    }
  }

  // 5. DFS — at least one reachable closure path (a path that reaches a Close outcome)
  const hasReachableClosure = ((): boolean => {
    const seen = new Set<number>();
    function dfs(stepNo: number): boolean {
      if (seen.has(stepNo)) return false;
      seen.add(stepNo);
      const step = steps.find((s) => s.stepNo === stepNo);
      if (!step) return false;
      for (const outcome of step.outcomes ?? []) {
        if (outcome.outcomeType === 'Close') return true;
        if (
          outcome.outcomeType === 'MoveForward' &&
          outcome.nextStepNo !== null &&
          dfs(outcome.nextStepNo)
        ) {
          return true;
        }
        // Loop keeps same step — skip to avoid infinite recursion
      }
      return false;
    }
    return dfs(startStepNo);
  })();

  if (!hasReachableClosure) {
    errors.push('At least one reachable closure path is required.');
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

/** Return all templates (header only) for catalog grid. */
export async function listTemplatesService(): Promise<ActivityTemplateSummaryDto[]> {
  const rows = await findAllTemplates();
  return rows.map(toSummaryDto);
}

/** Return a single template with full steps and outcomes. */
export async function getTemplateService(id: string): Promise<ActivityTemplateFullDto> {
  const row = await findTemplateById(id);
  if (!row) throw AppError.notFound('Activity Template', id);
  return toFullDto(row);
}

/** Create a new activity template. */
export async function createTemplateService(
  input: CreateTemplateInput,
  userId: string,
): Promise<ActivityTemplateFullDto> {
  // Fix 11: validate appliesTo against PostgreSQL reference_values
  await validateAppliesTo(input.appliesTo);

  // Uniqueness: only one active template per applicability combination
  if (input.isActive !== false) {
    const conflict = await findActiveTemplateConflict(input.appliesTo, input.department, input.productType);
    if (conflict) {
      throw AppError.conflict(
        'An active template already exists for the selected applicability combination.',
      );
    }
  }

  // Fix 10: integrity runs for ALL active templates — not gated on steps.length > 0
  // (validateTemplateIntegrity itself produces the 'must have at least one step' error)
  if (input.isActive !== false) {
    const integrityErrors = validateTemplateIntegrity(input.steps);
    if (integrityErrors.length > 0) {
      throw new AppError('VALIDATION_ERROR', 'Template integrity validation failed', 422, integrityErrors);
    }
  }

  // Fix 4 + Fix 11: cross-DB step reference validation (activityId + assignedRole)
  await validateStepReferences(input.steps);

  const stepRows = input.steps.map(inputToStepRow);
  const row = await createTemplate(
    {
      templateName: input.templateName,
      appliesTo:    input.appliesTo,
      department:   input.department,
      productType:  input.productType,
      isActive:     input.isActive ?? true,
      steps:        stepRows,
    },
    userId,
  );
  return toFullDto(row);
}

/** Update (full replace) an existing activity template. */
export async function updateTemplateService(
  id: string,
  input: UpdateTemplateInput,
  userId: string,   // Fix 8: was _userId — now threaded to repository for audit trail
): Promise<ActivityTemplateFullDto> {
  const existing = await findTemplateById(id);
  if (!existing) throw AppError.notFound('Activity Template', id);

  // Fix 11: validate appliesTo against PostgreSQL reference_values
  await validateAppliesTo(input.appliesTo);

  // Uniqueness check excluding self
  if (input.isActive) {
    const conflict = await findActiveTemplateConflict(
      input.appliesTo,
      input.department,
      input.productType,
      id,
    );
    if (conflict) {
      throw AppError.conflict(
        'An active template already exists for the selected applicability combination.',
      );
    }
  }

  // Fix 10: integrity runs for ALL active templates — not gated on steps.length > 0
  if (input.isActive) {
    const integrityErrors = validateTemplateIntegrity(input.steps);
    if (integrityErrors.length > 0) {
      throw new AppError('VALIDATION_ERROR', 'Template integrity validation failed', 422, integrityErrors);
    }
  }

  // Fix 4 + Fix 11: cross-DB step reference validation (activityId + assignedRole)
  await validateStepReferences(input.steps);

  const stepRows = input.steps.map(inputToStepRow);
  const row = await updateTemplate(
    id,
    {
      templateName: input.templateName,
      appliesTo:    input.appliesTo,
      department:   input.department,
      productType:  input.productType,
      isActive:     input.isActive,   // Fix 8: no ?? needed — required by updateTemplateSchema
      steps:        stepRows,
    },
    userId,   // Fix 8: pass actor to repository
  );
  return toFullDto(row);
}

// ---------------------------------------------------------------------------
// Lookup services
// ---------------------------------------------------------------------------

/** Departments from MongoDB referencemasters. */
export async function listDepartmentsForTemplateService(): Promise<LookupValueDto[]> {
  const docs = await ReferenceMasterModel.find(
    { masterType: 'department', isActive: true },
    { code: 1, label: 1, _id: 0 },
  ).sort({ sortOrder: 1 }).lean();
  return docs.map((d) => ({ code: d.code as string, label: d.label as string }));
}

/**
 * Fix 12: Product types from PostgreSQL reference_values — no longer hardcoded.
 * Shares the same data source as the Case Category master product-types endpoint.
 */
export async function listProductTypesForTemplateService(): Promise<LookupValueDto[]> {
  const result = await getPool().query<{ code: string; label: string }>(
    `SELECT code, label
       FROM reference_values
      WHERE reference_type = 'product_type'
        AND is_active = TRUE
      ORDER BY sort_order ASC`,
  );
  return result.rows;
}

/** Applies To — reads contact_reason from PostgreSQL reference_values. */
export async function listAppliesToService(): Promise<LookupValueDto[]> {
  const sql = `
    SELECT code, label
    FROM reference_values
    WHERE reference_type = 'contact_reason'
      AND is_active = TRUE
    ORDER BY sort_order ASC
  `;
  const result = await getPool().query<{ code: string; label: string }>(sql);
  return result.rows;
}

/** Roles — reads from PostgreSQL roles table. */
export async function listRolesService(): Promise<LookupValueDto[]> {
  const sql = `SELECT name AS code, COALESCE(description, name) AS label FROM roles ORDER BY name ASC`;
  const result = await getPool().query<{ code: string; label: string }>(sql);
  return result.rows;
}

// ---------------------------------------------------------------------------
// Feature 7 — Runtime Applicability Lookup
// ---------------------------------------------------------------------------

/**
 * Return the single active template matching the given applicability triple.
 * Throws 404 if no match, 409 if more than one match.
 */
export async function getApplicableTemplateService(
  appliesTo: string,
  department: string,
  productType: string,
): Promise<ActivityTemplateFullDto> {
  const templates = await findAllTemplates();
  const matches = templates.filter(
    (t) =>
      t.isActive &&
      t.appliesTo.toLowerCase() === appliesTo.toLowerCase() &&
      t.department.toLowerCase() === department.toLowerCase() &&
      t.productType.toLowerCase() === productType.toLowerCase(),
  );
  if (matches.length === 0) {
    throw new AppError('NOT_FOUND', 'No active template found for the selected context.', 404);
  }
  if (matches.length > 1) {
    throw new AppError('CONFLICT', 'More than one active template found for the selected context.', 409);
  }
  return getTemplateService(matches[0].id);
}
