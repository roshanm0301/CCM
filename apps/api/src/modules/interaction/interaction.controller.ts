// =============================================================================
// CCM API — Interaction Controller
// =============================================================================

import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { updateContextSchema, saveWrapupSchema } from './interaction.validator';
import {
  createInteractionService,
  getInteractionService,
  updateInteractionContextService,
  saveWrapupService,
  closeInteractionService,
  markIncompleteService,
  listInteractionsService,
  deleteInteractionService,
} from './interaction.service';

function requireUser(req: Request): NonNullable<typeof req.user> {
  if (!req.user) throw AppError.unauthorized('Authentication required');
  return req.user;
}

// POST /api/v1/interactions
export async function createInteractionController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const result = await createInteractionService(user.userId, req.correlationId ?? '');
    res.status(201).json({ success: true, data: result, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/interactions/:id
export async function getInteractionController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const { id } = req.params as { id: string };
    const result = await getInteractionService(id, user.userId, req.correlationId ?? '');
    res.status(200).json({ success: true, data: result, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/interactions/:id/context
export async function updateContextController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const { id } = req.params as { id: string };
    const parsed = updateContextSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', 422, parsed.error.issues);
    }
    const result = await updateInteractionContextService(
      id,
      user.userId,
      parsed.data,
      req.correlationId ?? '',
    );
    res.status(200).json({ success: true, data: result, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/interactions/:id/wrapup
export async function saveWrapupController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const { id } = req.params as { id: string };
    const parsed = saveWrapupSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', 422, parsed.error.issues);
    }
    const result = await saveWrapupService(id, user.userId, parsed.data, req.correlationId ?? '');
    res.status(200).json({ success: true, data: result, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/interactions/:id/close
export async function closeInteractionController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const { id } = req.params as { id: string };
    const result = await closeInteractionService(id, user.userId, req.correlationId ?? '');
    res.status(200).json({ success: true, data: result, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/interactions/:id/incomplete
export async function markIncompleteController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const { id } = req.params as { id: string };
    const result = await markIncompleteService(id, user.userId, req.correlationId ?? '');
    res.status(200).json({ success: true, data: result, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/interactions  (Phase 1.5)
const listInteractionsQuerySchema = z.object({
  status: z.enum(['INCOMPLETE', 'COMPLETE']).optional(),
  // search: free-text filter on agent name or customer name (max 100 chars)
  search: z.string().max(100).optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
});

export async function listInteractionsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    requireUser(req);

    const parsed = listInteractionsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid query parameters', 422, parsed.error.issues);
    }

    const { status, search, page, pageSize } = parsed.data;
    const result = await listInteractionsService({ status, search, page, pageSize });

    res.status(200).json({
      success: true,
      data: result,
      correlationId: req.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/v1/interactions/:id
export async function deleteInteractionController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    await deleteInteractionService(id, req.correlationId ?? '');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
