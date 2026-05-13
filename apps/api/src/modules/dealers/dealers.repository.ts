// =============================================================================
// CCM API — Dealers Repository (MongoDB / Mongoose)
//
// All Mongoose operations for dealer search.
// =============================================================================

import { DealerModel, IDealer } from '../../shared/models/dealer.model';

export interface DealerSearchParams {
  productType: string;
  search?: string;
  state?: string;
  city?: string;
  pinCode?: string;
}

/**
 * Search dealers by productType and optional filters.
 * Returns both active and inactive dealers sorted active-first, then by dealerName.
 */
export async function searchDealers(params: DealerSearchParams): Promise<IDealer[]> {
  const filter: Record<string, unknown> = {
    productTypes: params.productType,
  };

  if (params.state && params.state.trim()) {
    filter['state'] = { $regex: new RegExp(`^${params.state.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
  }

  if (params.city && params.city.trim()) {
    filter['city'] = { $regex: new RegExp(`^${params.city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
  }

  if (params.pinCode && params.pinCode.trim()) {
    filter['pinCode'] = params.pinCode.trim();
  }

  if (params.search && params.search.trim()) {
    const escaped = params.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escaped, 'i');
    filter['$or'] = [
      { dealerName: searchRegex },
      { branchName: searchRegex },
    ];
  }

  return DealerModel.find(filter)
    .sort({ isActive: -1, dealerName: 1 })
    .lean() as unknown as IDealer[];
}

/**
 * Count active dealers for a given productType.
 */
export async function countActiveDealersForProductType(productType: string): Promise<number> {
  return DealerModel.countDocuments({
    productTypes: productType,
    isActive: true,
  });
}
