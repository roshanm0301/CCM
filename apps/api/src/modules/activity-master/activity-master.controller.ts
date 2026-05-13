// =============================================================================
// CCM API — Activity Master Controller
// Source: CCM_Phase5_ActivityFlowConfiguration.md § Feature 1
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { createActivitySchema, updateActivitySchema } from './activity-master.validator';
import {
  listActivitiesService,
  listActiveActivitiesService,
  createActivityService,
  updateActivityService,
} from './activity-master.service';

function requireUser(req: Request): NonNullable<typeof req.user> {
  if (!req.user) throw AppError.unauthorized('Authentication required');
  return req.user;
}

// GET /api/v1/activity-master
export async function listActivitiesController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listActivitiesService();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/activity-master/active
export async function listActiveActivitiesController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listActiveActivitiesService();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/activity-master
export async function createActivityController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const parsed = createActivitySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', 422, parsed.error.issues);
    }
    const data = await createActivityService(parsed.data, user.userId);
    res.status(201).json({ success: true, data, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/activity-master/:id
export async function updateActivityController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const { id } = req.params as { id: string };
    const parsed = updateActivitySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', 422, parsed.error.issues);
    }
    const data = await updateActivityService(id, parsed.data, user.userId);
    res.status(200).json({ success: true, data, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}
