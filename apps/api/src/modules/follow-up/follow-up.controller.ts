// =============================================================================
// CCM API — Follow-Up Controller
//
// Thin HTTP layer: parse/validate request → call service → return JSON.
// All errors forwarded to global error handler via next(err).
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { addFollowUpSchema } from './follow-up.validator';
import { addFollowUpService, getFollowUpHistoryService } from './follow-up.service';

function requireUser(req: Request): NonNullable<typeof req.user> {
  if (!req.user) throw AppError.unauthorized('Authentication required');
  return req.user;
}

// ---------------------------------------------------------------------------
// POST /api/v1/follow-ups
// ---------------------------------------------------------------------------
export async function addFollowUpController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const parsed = addFollowUpSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', 422, parsed.error.issues);
    }
    const data = await addFollowUpService(parsed.data, user.userId, user.roles, req.correlationId ?? '');
    res.status(201).json({ success: true, data, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/follow-ups?caseId=...
// ---------------------------------------------------------------------------
export async function getFollowUpHistoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { caseId } = req.query as { caseId?: string };
    if (!caseId || typeof caseId !== 'string' || caseId.trim() === '') {
      throw new AppError('VALIDATION_ERROR', 'caseId query parameter is required', 400);
    }
    const data = await getFollowUpHistoryService(caseId.trim());
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
