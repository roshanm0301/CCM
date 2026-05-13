// =============================================================================
// CCM API — Resolution Activity Controller
//
// Thin HTTP layer: parse/validate → call service/repository → return JSON.
// All errors forwarded to the global error handler via next(err).
// Source: CCM_Phase6_Resolution_Activities.md § Wave 2 Track D
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { saveResolutionActivitySchema } from './resolution-activity.validator';
import { loadResolutionTabService, saveActivityService } from './resolution-activity.service';
import { getResolutionHistory } from './resolution-activity.repository';
import type { ResolutionActivityRow } from './resolution-activity.repository';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function requireUser(req: Request): NonNullable<typeof req.user> {
  if (!req.user) throw AppError.unauthorized('Authentication required');
  return req.user;
}

function rowToDto(row: ResolutionActivityRow) {
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
    attachmentIds:     row.attachment_ids
      ? row.attachment_ids.split(',').filter((s) => s.length > 0)
      : [],
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// GET / — Load Resolution Tab
// Query: caseId, caseNature, department, productType
// ---------------------------------------------------------------------------

export async function loadResolutionTabController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { caseId, caseNature, department, productType } =
      req.query as Record<string, string | undefined>;

    if (!caseId || !caseNature || !department || !productType) {
      throw new AppError(
        'VALIDATION_ERROR',
        'caseId, caseNature, department, and productType query parameters are required.',
        400,
      );
    }

    // Guard against whitespace-only values that pass the presence check above.
    if (!caseId.trim())      throw new AppError('VALIDATION_ERROR', 'caseId cannot be blank', 400);
    if (!caseNature.trim())  throw new AppError('VALIDATION_ERROR', 'caseNature cannot be blank', 400);
    if (!department.trim())  throw new AppError('VALIDATION_ERROR', 'department cannot be blank', 400);
    if (!productType.trim()) throw new AppError('VALIDATION_ERROR', 'productType cannot be blank', 400);

    const data = await loadResolutionTabService(
      caseId.trim(),
      caseNature.trim(),
      department.trim(),
      productType.trim(),
    );

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST / — Save Resolution Activity
// ---------------------------------------------------------------------------

export async function saveResolutionActivityController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);

    const parsed = saveResolutionActivitySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Request validation failed',
        422,
        parsed.error.issues,
      );
    }

    const userRoles: string[] = Array.isArray(user.roles) ? user.roles : [];

    const data = await saveActivityService(parsed.data, user.userId, userRoles, req.correlationId ?? '');

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /history — Resolution Activity History for a Case
// Query: caseId
// ---------------------------------------------------------------------------

export async function getResolutionHistoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { caseId } = req.query as { caseId?: string };

    if (!caseId || typeof caseId !== 'string' || caseId.trim() === '') {
      throw new AppError(
        'VALIDATION_ERROR',
        'caseId query parameter is required.',
        400,
      );
    }

    const rows = await getResolutionHistory(caseId.trim());
    const data = rows.map(rowToDto);

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
