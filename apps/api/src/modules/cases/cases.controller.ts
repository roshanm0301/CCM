// =============================================================================
// CCM API — Cases Controller
//
// Thin HTTP layer: parse/validate request → call service → return JSON.
// All errors forwarded to global error handler via next(err).
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { createCaseSchema } from './cases.validator';
import {
  getCaseHistoryService,
  duplicateCheckService,
  createCaseService,
  getCaseByIdService,
  getCaseByInteractionIdService,
  getCaseDetailService,
  getDealerCatalogService,
  type DealerCatalogFilters,
} from './cases.service';
import { getPool } from '../../shared/database/postgres';

function requireUser(req: Request): NonNullable<typeof req.user> {
  if (!req.user) throw AppError.unauthorized('Authentication required');
  return req.user;
}

// ---------------------------------------------------------------------------
// GET /api/v1/cases/history?customerRef=...
// ---------------------------------------------------------------------------
export async function getCaseHistoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { customerRef } = req.query as { customerRef?: string };
    if (!customerRef || typeof customerRef !== 'string' || customerRef.trim() === '') {
      throw new AppError('VALIDATION_ERROR', 'customerRef query parameter is required', 400);
    }
    const data = await getCaseHistoryService(customerRef.trim());
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/cases/duplicate-check?customerRef=...&caseNature=...&department=...&caseCategoryId=...&caseSubcategoryId=...&vehicleRef=...
// ---------------------------------------------------------------------------
export async function duplicateCheckController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {
      customerRef,
      caseNature,
      department,
      caseCategoryId,
      caseSubcategoryId,
      vehicleRef,
    } = req.query as Record<string, string | undefined>;

    if (!customerRef || !caseNature || !department || !caseCategoryId || !caseSubcategoryId) {
      throw new AppError(
        'VALIDATION_ERROR',
        'customerRef, caseNature, department, caseCategoryId, and caseSubcategoryId are required',
        400,
      );
    }

    const data = await duplicateCheckService({
      customerRef,
      caseNature,
      department,
      caseCategoryId,
      caseSubcategoryId,
      vehicleRef: vehicleRef || undefined,
    });

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/cases
// ---------------------------------------------------------------------------
export async function createCaseController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const parsed = createCaseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', 422, parsed.error.issues);
    }
    const data = await createCaseService(parsed.data, user.userId);
    res.status(201).json({ success: true, data, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/cases/:id
// ---------------------------------------------------------------------------
export async function getCaseController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const data = await getCaseByIdService(id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/cases/interaction/:interactionId
// ---------------------------------------------------------------------------
export async function getCaseByInteractionController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { interactionId } = req.params as { interactionId: string };
    const data = await getCaseByInteractionIdService(interactionId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/cases/detail?caseId=ISR-001
// ---------------------------------------------------------------------------
export async function getCaseDetailController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { caseId } = req.query as { caseId?: string };
    if (!caseId || typeof caseId !== 'string' || caseId.trim() === '') {
      throw new AppError('VALIDATION_ERROR', 'caseId query parameter is required', 400);
    }
    const data = await getCaseDetailService(caseId.trim());
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/cases/dealer-catalog?page=1&pageSize=20&caseStatus=...
// ---------------------------------------------------------------------------
export async function getDealerCatalogController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);

    // Fetch external_user_ref (dealerRef) for this user from PostgreSQL.
    // The JWT payload carries userId/username/roles only — not externalRef.
    const refResult = await getPool().query<{ external_user_ref: string | null }>(
      'SELECT external_user_ref FROM users WHERE id = $1',
      [user.userId],
    );
    const dealerRef = refResult.rows[0]?.external_user_ref;
    if (!dealerRef) {
      throw new AppError('FORBIDDEN', 'No dealer association found for this user.', 403);
    }

    // Parse query params — all optional.
    // Array filters (department, caseStatus, caseCategory, caseSubcategory) may
    // arrive as repeated params (?department=SALES&department=SERVICE) so we
    // normalise them to string[] regardless of how Express parses them.
    const q = req.query as Record<string, string | string[] | undefined>;

    function toArray(v: string | string[] | undefined): string[] | undefined {
      if (!v) return undefined;
      const arr = Array.isArray(v) ? v : v.split(',');
      const filtered = arr.map((s) => s.trim()).filter(Boolean);
      return filtered.length > 0 ? filtered : undefined;
    }

    const page     = typeof q['page']     === 'string' ? q['page']     : '1';
    const pageSize = typeof q['pageSize'] === 'string' ? q['pageSize'] : '20';

    const filters: DealerCatalogFilters = {
      caseStatus:     toArray(q['caseStatus']),
      caseNature:     typeof q['caseNature']     === 'string' ? q['caseNature']     || undefined : undefined,
      productType:    typeof q['productType']    === 'string' ? q['productType']    || undefined : undefined,
      activityStatus: typeof q['activityStatus'] === 'string' ? q['activityStatus'] || undefined : undefined,
      department:     toArray(q['department']),
      caseCategory:   toArray(q['caseCategory']),
      caseSubcategory: toArray(q['caseSubcategory']),
      dateFrom:       typeof q['dateFrom'] === 'string' ? q['dateFrom'] || undefined : undefined,
      dateTo:         typeof q['dateTo']   === 'string' ? q['dateTo']   || undefined : undefined,
    };

    const data = await getDealerCatalogService(
      dealerRef,
      filters,
      parseInt(page, 10),
      parseInt(pageSize, 10),
    );
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
