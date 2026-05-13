// =============================================================================
// CCM API — Dealers Controller
//
// GET /api/v1/dealers?productType=X&search=X&state=X&city=X&pinCode=X
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { searchDealers, countActiveDealersForProductType } from './dealers.repository';
import { Types } from 'mongoose';

// ---------------------------------------------------------------------------
// GET /api/v1/dealers
// ---------------------------------------------------------------------------
export async function searchDealersController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { productType, search, state, city, pinCode } = req.query as Record<string, string | undefined>;

    if (!productType || typeof productType !== 'string' || productType.trim() === '') {
      throw new AppError('VALIDATION_ERROR', 'productType query parameter is required', 400);
    }

    const [dealerDocs, activeCount] = await Promise.all([
      searchDealers({ productType: productType.trim(), search, state, city, pinCode }),
      countActiveDealersForProductType(productType.trim()),
    ]);

    const dealers = dealerDocs.map((d) => ({
      id:            (d._id as Types.ObjectId).toString(),
      dealerCode:    d.dealerCode,
      dealerName:    d.dealerName,
      branchCode:    d.branchCode,
      branchName:    d.branchName,
      contactNumber: d.contactNumber,
      address:       d.address,
      state:         d.state,
      city:          d.city,
      pinCode:       d.pinCode,
      isActive:      d.isActive,
      productTypes:  d.productTypes,
    }));

    res.status(200).json({
      success: true,
      data: {
        dealers,
        hasActiveDealer: activeCount > 0,
      },
    });
  } catch (err) {
    next(err);
  }
}
