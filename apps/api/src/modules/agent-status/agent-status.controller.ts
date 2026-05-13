// =============================================================================
// CCM API — Agent Status Controller
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { updateAgentStatusSchema } from './agent-status.validator';
import { getAgentStatusService, updateAgentStatusService } from './agent-status.service';

function requireUser(req: Request): NonNullable<typeof req.user> {
  if (!req.user) throw AppError.unauthorized('Authentication required');
  return req.user;
}

// GET /api/v1/agent/status
export async function getAgentStatusController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const result = await getAgentStatusService(user.userId);
    res.status(200).json({ success: true, data: result, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/agent/status
export async function updateAgentStatusController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const parsed = updateAgentStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', 422, parsed.error.issues);
    }
    const result = await updateAgentStatusService(
      user.userId,
      parsed.data.status,
      req.correlationId ?? '',
    );
    res.status(200).json({ success: true, data: result, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}
