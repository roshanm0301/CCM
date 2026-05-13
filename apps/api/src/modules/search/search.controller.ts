// =============================================================================
// CCM API — Search Controller
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { searchSchema } from './search.validator';
import { searchService } from './search.service';

// POST /api/v1/search
export async function searchController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized('Authentication required');

    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', 422, parsed.error.issues);
    }

    const result = await searchService(
      parsed.data.interactionId,
      parsed.data.filter,
      parsed.data.value,
      req.user.userId,
      req.correlationId ?? '',
    );

    res.status(200).json({ success: true, data: result, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}
