// =============================================================================
// CCM API — Context Controller
//
// Context endpoints return `found: false` (not 404) when data is unavailable
// so that context cards can render gracefully on the frontend.
// Source: phase1-technical-blueprint.md §5.13–5.15
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import {
  getCustomerContextService,
  getVehicleContextService,
  getDealerContextService,
} from './context.service';

function requireUser(req: Request): NonNullable<typeof req.user> {
  if (!req.user) throw AppError.unauthorized('Authentication required');
  return req.user;
}

// GET /api/v1/context/customer/:ref
export async function getCustomerContextController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const { ref } = req.params as { ref: string };
    const interactionId = req.query['interactionId'] as string | undefined;

    const result = await getCustomerContextService(
      ref,
      interactionId,
      user.userId,
      req.correlationId ?? '',
    );

    res.status(200).json({ success: true, data: result, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/context/vehicle/:ref
export async function getVehicleContextController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const { ref } = req.params as { ref: string };
    const interactionId = req.query['interactionId'] as string | undefined;

    const result = await getVehicleContextService(
      ref,
      interactionId,
      user.userId,
      req.correlationId ?? '',
    );

    res.status(200).json({ success: true, data: result, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/context/dealer/:ref
export async function getDealerContextController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const { ref } = req.params as { ref: string };
    const interactionId = req.query['interactionId'] as string | undefined;

    const result = await getDealerContextService(
      ref,
      interactionId,
      user.userId,
      req.correlationId ?? '',
    );

    res.status(200).json({ success: true, data: result, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}
