// =============================================================================
// CCM API — Master Data Controller
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { getMasterDataService } from './master-data.service';

// GET /api/v1/master-data/:type
export async function getMasterDataController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized('Authentication required');

    const { type } = req.params as { type: string };
    const result = await getMasterDataService(type);

    res.status(200).json({ success: true, data: result, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}
